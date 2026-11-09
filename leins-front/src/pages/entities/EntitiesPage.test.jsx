import React from 'react';
import { describe, expect, test, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import EntitiesPage from './EntitiesPage';
import * as entitiesApi from '../../services/entitiesApi';

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

vi.mock('./EntityCredentialsPanel', () => ({
   default: ({ entity }) => <div data-testid="credentials-panel">{entity?.name}</div>,
}));

vi.mock('./ClientUsersPanel', () => ({
   default: ({ entity }) => <div data-testid="clients-panel">{entity?.name}</div>,
}));

const setEntityMock = vi.fn();
vi.mock('../../context/EntityContext', () => ({
   useEntity: () => ({
      entityId: 2,
      setEntity: setEntityMock,
   }),
}));

vi.mock('../../services/entitiesApi', () => ({
   listEntities: vi.fn(),
   createEntity: vi.fn(),
   updateEntity: vi.fn(),
   changeEntityState: vi.fn(),
   deleteEntity: vi.fn(),
}));

const MOCK_ROWS = [
   {
      id: 1,
      name: 'Alpha SpA',
      legal_name: 'Alpha Servicios SpA',
      rut: '9.111.111-1',
      state_id: 1,
      permissions: { can_create: true, can_update: true, can_delete: true, is_admin: true },
   },
   {
      id: 2,
      name: 'Beta Ltda',
      legal_name: 'Beta Comercial Ltda',
      rut: '76.543.210-K',
      state_id: 2,
      permissions: { can_create: true, can_update: true, can_delete: false, is_admin: true },
   },
];

function renderPage() {
   const qc = new QueryClient({
      defaultOptions: { queries: { retry: false } },
   });
   return render(
      <QueryClientProvider client={qc}>
         <EntitiesPage />
      </QueryClientProvider>
   );
}

describe('EntitiesPage', () => {
   beforeEach(() => {
      vi.clearAllMocks();
      entitiesApi.listEntities.mockResolvedValue({
         ok: true,
         total: MOCK_ROWS.length,
         rows: MOCK_ROWS,
      });
   });

   test('corrige estilos de selectores Ordenar por / Dirección y sincroniza ordenamiento', async () => {
      renderPage();

      await screen.findByText('Alpha SpA');

      const sortBySelect = screen.getByLabelText('Ordenar por');
      const sortOrderSelect = screen.getByLabelText('Dirección');
      const pageSizeSelect = screen.getByLabelText('Filas por página');

      [sortBySelect, sortOrderSelect, pageSizeSelect].forEach((el) => {
         expect(el.className).toContain('pr-9');
         expect(el.className).not.toContain('px-2');
      });

      fireEvent.change(sortBySelect, { target: { value: 'rut' } });
      await waitFor(() => {
         expect(entitiesApi.listEntities).toHaveBeenLastCalledWith(
            expect.objectContaining({ sort: 'rut', order: 'asc' })
         );
      });

      const quickDirBtn = screen.getByRole('button', { name: /cambiar dirección a descendente/i });
      fireEvent.click(quickDirBtn);
      await waitFor(() => {
         expect(entitiesApi.listEntities).toHaveBeenLastCalledWith(
            expect.objectContaining({ sort: 'rut', order: 'desc' })
         );
      });

      // Clic en cabecera ID cambia columna y reinicia a asc
      const idHeaderBtn = screen.getByRole('button', { name: /^ID$/i });
      fireEvent.click(idHeaderBtn);
      await waitFor(() => {
         expect(entitiesApi.listEntities).toHaveBeenLastCalledWith(
            expect.objectContaining({ sort: 'id', order: 'asc' })
         );
      });
   });

   test('renderiza botón de tres puntos por fila, abre menú en Portal con todas las acciones y respeta permisos', async () => {
      renderPage();

      await screen.findByText('Alpha SpA');

      // No hay botones sueltos horizontales en la tabla
      expect(screen.queryByRole('button', { name: 'Credenciales' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Clientes' })).not.toBeInTheDocument();

      const alphaTrigger = screen.getByRole('button', { name: 'Acciones para Alpha SpA' });
      fireEvent.click(alphaTrigger);

      const menu = await screen.findByRole('menu', { name: 'Acciones de Alpha SpA' });
      // Debe renderizarse vía Portal fuera del contenedor scroll de la tabla
      expect(menu.closest('.overflow-x-auto')).toBeNull();

      const menuScope = within(menu);
      expect(menuScope.getByRole('menuitem', { name: /Seleccionar/i })).toBeEnabled();
      expect(menuScope.getByRole('menuitem', { name: /Editar/i })).toBeInTheDocument();
      expect(menuScope.getByRole('menuitem', { name: /Credenciales/i })).toBeInTheDocument();
      expect(menuScope.getByRole('menuitem', { name: /Clientes/i })).toBeInTheDocument();
      expect(menuScope.getByRole('menuitem', { name: /Desactivar/i })).toBeInTheDocument();
      expect(menuScope.getByRole('menuitem', { name: /Eliminar/i })).toBeInTheDocument();

      // Abrir Credenciales desde el menú cierra el menú y abre el modal
      fireEvent.click(menuScope.getByRole('menuitem', { name: /Credenciales/i }));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(await screen.findByTestId('credentials-panel')).toHaveTextContent('Alpha SpA');

      // Fila inactiva sin permiso delete: Seleccionar deshabilitado, muestra Activar, sin Eliminar
      const betaTrigger = screen.getByRole('button', { name: 'Acciones para Beta Ltda' });
      fireEvent.click(betaTrigger);

      const betaMenu = await screen.findByRole('menu', { name: 'Acciones de Beta Ltda' });
      const betaScope = within(betaMenu);
      expect(betaScope.getByRole('menuitem', { name: /Seleccionar/i })).toBeDisabled();
      expect(betaScope.getByRole('menuitem', { name: /Activar/i })).toBeInTheDocument();
      expect(betaScope.queryByRole('menuitem', { name: /Eliminar/i })).not.toBeInTheDocument();

      // Cerrar con Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
   });
});
