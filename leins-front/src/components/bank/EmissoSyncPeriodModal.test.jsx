import React from 'react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockSyncEmisso = vi.fn();
const mockListBankAccounts = vi.fn();

vi.mock('../../utils/fetchWithAuth', () => ({
   fetchWithAuth: vi.fn(),
}));

vi.mock('components/Toaster', () => ({
   toast: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
   },
}));

vi.mock('components/Modal', () => ({
   default: ({ isOpen, title, children }) =>
      isOpen ? (
         <div data-testid="modal">
            <h2>{title}</h2>
            {children}
         </div>
      ) : null,
}));

// Tests de API cliente real (con fetchWithAuth mockeado)
describe('entitiesApi bank quota propagation', () => {
   beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
   });

   test('listBankAccounts preserva emisso_sync_quota y syncEmissoBankAccount adjunta status/payload en 429', async () => {
      const { fetchWithAuth } = await import('../../utils/fetchWithAuth');
      const api = await import('../../services/entitiesApi');

      fetchWithAuth.mockResolvedValueOnce({
         ok: true,
         status: 200,
         json: async () => ({
            ok: true,
            total: 1,
            rows: [{ id: 10, bank_name: 'Banco de Chile' }],
            emisso_sync_quota: { used: 12, limit: 100, remaining: 88, period: '2026-11' },
         }),
      });

      const listOut = await api.listBankAccounts({ entityId: 5 });
      expect(listOut.emisso_sync_quota).toEqual({
         used: 12,
         limit: 100,
         remaining: 88,
         period: '2026-11',
      });

      fetchWithAuth.mockResolvedValueOnce({
         ok: false,
         status: 429,
         json: async () => ({
            statusCode: 429,
            message: 'Limite alcanzado',
            code: 'EMISSO_MONTHLY_LIMIT_REACHED',
            emisso_sync_quota: { used: 100, limit: 100, remaining: 0, period: '2026-11' },
         }),
      });

      await expect(api.syncEmissoBankAccount({ entityId: 5, id: 10 })).rejects.toMatchObject({
         status: 429,
         message: 'Limite alcanzado',
         payload: expect.objectContaining({
            code: 'EMISSO_MONTHLY_LIMIT_REACHED',
            emisso_sync_quota: expect.objectContaining({ used: 100, limit: 100, remaining: 0 }),
         }),
      });
   });
});

// Tests UI para EmissoSyncPeriodModal y BankCartolasPage
describe('Emisso monthly sync counter & limit UI', () => {
   beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();
   });

   test('EmissoSyncPeriodModal muestra cuota X/100 y bloquea botón al llegar a 100/100', async () => {
      vi.doMock('../../services/entitiesApi', () => ({
         syncEmissoBankAccount: mockSyncEmisso,
      }));
      const { default: EmissoSyncPeriodModal } = await import('./EmissoSyncPeriodModal');

      const onQuotaUpdate = vi.fn();
      const onSyncCompleted = vi.fn();
      const onClose = vi.fn();
      const nextQuota = { used: 43, limit: 100, remaining: 57, period: '2026-11' };
      mockSyncEmisso.mockResolvedValueOnce({ ok: true, saved: 2, updated: 1, emisso_sync_quota: nextQuota });

      const { rerender } = render(
         <EmissoSyncPeriodModal
            isOpen
            onClose={onClose}
            entityId={5}
            account={{ id: 10, bank_name: 'Banco de Chile', account_number: '****1234' }}
            syncQuota={{ used: 42, limit: 100, remaining: 58, period: '2026-11' }}
            onQuotaUpdate={onQuotaUpdate}
            onSyncCompleted={onSyncCompleted}
         />
      );

      expect(screen.getByText('42/100')).toBeInTheDocument();
      const syncBtn = screen.getByRole('button', { name: /Sincronizar período/i });
      expect(syncBtn).toBeEnabled();

      fireEvent.click(syncBtn);
      await waitFor(() => {
         expect(mockSyncEmisso).toHaveBeenCalledTimes(1);
         expect(onQuotaUpdate).toHaveBeenCalledWith(nextQuota);
      });

      rerender(
         <EmissoSyncPeriodModal
            isOpen
            onClose={onClose}
            entityId={5}
            account={{ id: 10, bank_name: 'Banco de Chile', account_number: '****1234' }}
            syncQuota={{ used: 100, limit: 100, remaining: 0, period: '2026-11' }}
            onQuotaUpdate={onQuotaUpdate}
            onSyncCompleted={onSyncCompleted}
         />
      );

      expect(screen.getByText('100/100')).toBeInTheDocument();
      expect(screen.getByText(/Has alcanzado el límite mensual de 100 sincronizaciones manuales/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sincronizar período/i })).toBeDisabled();
   });

   test('BankCartolasPage muestra contador X/100 dentro del botón Actualizar movimientos, incrementa al sincronizar y bloquea en 100/100', async () => {
      vi.doMock('../../context/AuthContext', () => ({
         useAuth: () => ({ auth: { accessToken: 'test-token' }, isClient: false }),
      }));
      vi.doMock('../../hooks/useEntityRequired', () => ({
         useEntityRequired: () => ({
            entityId: 5,
            ready: true,
            permissions: { can_create: true, can_update: true, can_delete: true },
         }),
      }));
      vi.doMock('components/EntityRequiredNotice', () => ({ default: () => null }));
      vi.doMock('components/ReconcileSuggestionsPanel', () => ({ default: () => null }));
      vi.doMock('components/DateInput', () => ({ default: () => <input /> }));
      vi.doMock('../../components/accounting/AccountSelect', () => ({ default: () => null }));
      vi.doMock('components/PrimaryButton', () => ({
         default: ({ children, ...props }) => <button {...props}>{children}</button>,
      }));
      vi.doMock('../../components/bank/BankCartolaDuplicatesAlert', () => ({ default: () => null }));
      vi.doMock('../../components/bank/BatchBoletearConfirmModal', () => ({ default: () => null }));
      vi.doMock('../../services/reconcileApi', () => ({
         fetchSuggestionsCount: vi.fn().mockResolvedValue({ total: 0, is_capped: false }),
         autofindCandidates: vi.fn(),
         reconcileOne: vi.fn(),
         reconcileDirectExpense: vi.fn(),
         reconcileBankTransaction: vi.fn(),
         searchBankReconcileCandidates: vi.fn(),
         reconcileBulk: vi.fn(),
         listReconciliations: vi.fn().mockResolvedValue({ rows: [] }),
         unreconcile: vi.fn(),
         deleteBankTransaction: vi.fn(),
      }));
      vi.doMock('../../services/accountingApi', () => ({
         getAccounts: vi.fn().mockResolvedValue([]),
      }));
      vi.doMock('../../services/siiDocumentsApi', () => ({
         listDailySalesGroups: vi.fn(),
         listSiiDocuments: vi.fn(),
      }));
      vi.doMock('../../services/boletaQueueApi', () => ({
         getActiveBoletaMap: vi.fn().mockResolvedValue({}),
         cancelBoletaRequest: vi.fn(),
         retryBoletaRequest: vi.fn(),
      }));
      vi.doMock('../../hooks/useBankTransactions', () => ({
         useBankTransactions: () => ({ transactions: [], total: 0, isLoading: false }),
      }));
      vi.doMock('../../hooks/useBankTotals', () => ({
         useBankTotals: () => ({ abonosTotal: 0, cargosTotal: 0, abonosLoading: false, cargosLoading: false }),
      }));

      let quotaCount = 12;
      mockListBankAccounts.mockImplementation(async () => ({
         rows: [{
            id: 10,
            entity_id: 5,
            bank_name: 'Banco de Chile',
            account_number: '****1234',
            currency: 'CLP',
            label: 'Banco de Chile - ****1234 - CLP',
            emisso_connection_id: 'conn-1',
            sync_status: 'idle',
            last_synced_at: '2026-11-08T12:00:00Z',
         }],
         total: 1,
         emisso_sync_quota: {
            used: quotaCount,
            limit: 100,
            remaining: Math.max(0, 100 - quotaCount),
            period: '2026-11',
         },
      }));
      mockSyncEmisso.mockImplementation(async () => {
         quotaCount += 1;
         return {
            ok: true,
            saved: 3,
            updated: 0,
            emisso_sync_quota: {
               used: quotaCount,
               limit: 100,
               remaining: Math.max(0, 100 - quotaCount),
               period: '2026-11',
            },
         };
      });

      vi.doMock('../../services/entitiesApi', () => ({
         uploadBankExcel: vi.fn(),
         listBankAccounts: mockListBankAccounts,
         syncEmissoBankAccount: mockSyncEmisso,
      }));

      const { default: BankCartolasPage } = await import('../../pages/bank/BankCartolasPage');

      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
         <QueryClientProvider client={qc}>
            <BankCartolasPage />
         </QueryClientProvider>
      );

      const counter = await screen.findByTestId('emisso-sync-counter');
      expect(counter).toHaveTextContent('12/100');

      const syncBtn = counter.closest('button');
      const histBtn = screen.getByRole('button', { name: 'Histórico' });
      expect(syncBtn).toHaveTextContent('Actualizar movimientos');
      expect(syncBtn).toBeEnabled();
      expect(histBtn).toBeEnabled();

      // Al sincronizar manualmente, pasa a 13/100 inmediatamente
      fireEvent.click(syncBtn);
      await waitFor(() => {
         expect(mockSyncEmisso).toHaveBeenCalledWith({ entityId: 5, id: 10 });
         expect(screen.getByTestId('emisso-sync-counter')).toHaveTextContent('13/100');
      });

      // Simulamos llegada a 100/100 -> ambos botones quedan deshabilitados
      quotaCount = 100;
      await qc.invalidateQueries({ queryKey: ['bankAccounts', 5] });
      await waitFor(() => {
         expect(screen.getByTestId('emisso-sync-counter')).toHaveTextContent('100/100');
         expect(screen.getByTestId('emisso-sync-counter').closest('button')).toBeDisabled();
         expect(screen.getByRole('button', { name: 'Histórico' })).toBeDisabled();
      });
   });
});
