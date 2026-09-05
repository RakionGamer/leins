import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { useAuth } from '../../context/AuthContext';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import {
   listBankAccounts,
   createBankAccount,
   updateBankAccount,
   deleteBankAccount,
   revealBankAccountNumber
} from '../../services/entitiesApi';
import { toast } from 'components/Toaster';

const DEFAULT_FORM = {
   bankName: '',
   accountNumber: '',
   currency: 'CLP',
   initialBalance: '',
   initialBalanceDate: '',
};

const CURRENCY_OPTIONS = [
   { value: 'CLP', label: 'CLP' },
   { value: 'USD', label: 'DOLAR' },
];

const clpFmt = new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

function normalizeCurrency(input) {
   const raw = String(input || '').trim().toUpperCase();
   if (raw === 'DOLAR') return 'USD';
   if (raw === 'USD') return 'USD';
   return 'CLP';
}

export default function BankAccountsPage() {
   const queryClient = useQueryClient();
   const { isClient } = useAuth();
   const { entityId, ready, permissions } = useEntityRequired();
   const canDelete = permissions?.can_delete ?? true;
   const canCreate = permissions?.can_create ?? true;
   const canUpdate = permissions?.can_update ?? true;
   const [form, setForm] = useState(DEFAULT_FORM);
   const [editingId, setEditingId] = useState(null);
   const [saving, setSaving] = useState(false);
   const [deletingId, setDeletingId] = useState(null);
   const [revealingId, setRevealingId] = useState(null);
   const [revealedNumbers, setRevealedNumbers] = useState({});

   const {
      data,
      isLoading,
      isFetching,
      error
   } = useQuery({
      queryKey: ['bankAccounts', entityId],
      queryFn: ({ signal }) => listBankAccounts({ entityId, signal }),
      enabled: !!entityId
   });

   const rows = data?.rows || [];
   const total = Number(data?.total || rows.length || 0);

   const formTitle = useMemo(
      () => (editingId ? 'Editar cuenta bancaria' : 'Agregar cuenta bancaria'),
      [editingId]
   );

   const resetForm = () => {
      setForm(DEFAULT_FORM);
      setEditingId(null);
   };

   const refreshAccounts = async () => {
      await queryClient.invalidateQueries({ queryKey: ['bankAccounts', entityId] });
      await queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
      await queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
      await queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
   };

   const onSubmit = async (e) => {
      e.preventDefault();
      if (!entityId) return;

      const bankName = String(form.bankName || '').trim();
      const accountNumber = String(form.accountNumber || '').trim();
      const currency = normalizeCurrency(form.currency || 'CLP');
      const initialBalanceInput = String(form.initialBalance || '').trim();
      const initialBalance = initialBalanceInput === '' ? undefined : Number(initialBalanceInput.replace(/\./g, '').replace(',', '.'));
      const initialBalanceDate = form.initialBalanceDate || undefined;

      if (!bankName) return toast.error('Ingresa el nombre del banco');
      if (!editingId && !accountNumber) return toast.error('Ingresa el numero de cuenta');
      if (!['CLP', 'USD'].includes(currency)) return toast.error('Moneda invalida');
      if (initialBalance !== undefined && !Number.isFinite(initialBalance)) return toast.error('Saldo inicial invalido');

      try {
         setSaving(true);
         if (editingId) {
            await updateBankAccount({
               entityId,
               id: editingId,
               bankName,
               accountNumber,
               currency,
               initialBalance,
               initialBalanceDate
            });
            toast.success('Cuenta bancaria actualizada');
         } else {
            await createBankAccount({
               entityId,
               bankName,
               accountNumber,
               currency,
               initialBalance,
               initialBalanceDate
            });
            toast.success('Cuenta bancaria creada');
         }

         await refreshAccounts();
         resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo guardar la cuenta bancaria');
      } finally {
         setSaving(false);
      }
   };

   const startEdit = (row) => {
      setEditingId(Number(row.id));
      setForm({
         bankName: row.bank_name || '',
         accountNumber: '',
         currency: row.currency || 'CLP',
         initialBalance: row.initial_balance != null ? String(row.initial_balance) : '',
         initialBalanceDate: row.initial_balance_date || '',
      });
   };

   const onDelete = async (row) => {
      if (!entityId) return;
      const ok = window.confirm(`Eliminar la cuenta ${row.bank_name} - ${row.account_number}?`);
      if (!ok) return;

      try {
         setDeletingId(Number(row.id));
         await deleteBankAccount({ entityId, id: row.id });
         toast.success('Cuenta bancaria eliminada');
         await refreshAccounts();
         if (Number(editingId) === Number(row.id)) resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo eliminar la cuenta bancaria');
      } finally {
         setDeletingId(null);
      }
   };

   const onReveal = async (row) => {
      if (!entityId) return;
      const ok = window.confirm(
         'Vas a revelar el numero completo de una cuenta bancaria. Esta accion quedara auditada en el sistema. ¿Deseas continuar?'
      );
      if (!ok) return;

      try {
         setRevealingId(Number(row.id));
         const out = await revealBankAccountNumber({ entityId, id: row.id });
         const full = out?.row?.account_number_full;
         if (!full) throw new Error('No fue posible revelar el numero de cuenta');

         setRevealedNumbers((prev) => ({ ...prev, [row.id]: full }));
         toast.success('Numero revelado por 15 segundos');

         setTimeout(() => {
            setRevealedNumbers((prev) => {
               const next = { ...prev };
               delete next[row.id];
               return next;
            });
         }, 15000);
      } catch (err) {
         toast.error(err?.message || 'No se pudo revelar el numero de cuenta');
      } finally {
         setRevealingId(null);
      }
   };

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   if (isClient) {
      return (
         <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <h1 className="text-lg font-semibold">Seccion administrada por tu administrador</h1>
            <p className="mt-1 text-sm">
               La gestion de cuentas bancarias no esta disponible para cuentas de cliente. Si necesitas agregar o modificar una cuenta, contacta a tu administrador.
            </p>
         </div>
      );
   }

   return (
      <div className="animate-fade-in space-y-5">
         <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
               <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-[var(--heading)]">Mantenedor de cuentas bancarias</h1>
                  <p className="text-sm text-[var(--text-soft)] mt-1">
                     Administra las cuentas asociadas a la entidad seleccionada.
                  </p>
               </div>
               <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm">
                  <span className="text-[var(--text-soft)]">Total cuentas</span>
                  <span className="font-semibold text-[var(--heading)]">{total}</span>
                  {isFetching && <span className="text-xs text-[var(--text-soft)]">(actualizando)</span>}
               </div>
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className="xl:col-span-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] p-4">
               <h2 className="text-lg font-semibold text-[var(--heading)]">{formTitle}</h2>
               <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                  <div className="flex flex-col gap-1">
                     <label htmlFor="bank-name" className="text-sm text-[var(--text-soft)]">Banco</label>
                     <input
                        id="bank-name"
                        type="text"
                        value={form.bankName}
                        onChange={(e) => setForm((s) => ({ ...s, bankName: e.target.value }))}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                        placeholder="Ej: Banco de Chile"
                        maxLength={120}
                        autoComplete="off"
                     />
                  </div>

                  <div className="flex flex-col gap-1">
                     <label htmlFor="account-number" className="text-sm text-[var(--text-soft)]">Numero de cuenta</label>
                     <input
                        id="account-number"
                        type="text"
                        value={form.accountNumber}
                        onChange={(e) => setForm((s) => ({ ...s, accountNumber: e.target.value }))}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                        placeholder={editingId ? 'Deja vacio para mantener el numero actual' : 'Ej: 00123456789'}
                        maxLength={31}
                        autoComplete="off"
                     />
                  </div>

                  <div className="flex flex-col gap-1">
                     <label htmlFor="account-currency" className="text-sm text-[var(--text-soft)]">Moneda</label>
                     <select
                        id="account-currency"
                        value={form.currency}
                        onChange={(e) => setForm((s) => ({ ...s, currency: e.target.value }))}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                     >
                        {CURRENCY_OPTIONS.map((opt) => (
                           <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                     </select>
                  </div>

                  <div className="flex flex-col gap-1">
                     <label htmlFor="account-initial-balance" className="text-sm text-[var(--text-soft)]">Saldo inicial</label>
                     <input
                        id="account-initial-balance"
                        type="text"
                        inputMode="decimal"
                        value={form.initialBalance}
                        onChange={(e) => setForm((s) => ({ ...s, initialBalance: e.target.value }))}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                        placeholder="Ej: 1500000"
                     />
                  </div>

                  <div className="flex flex-col gap-1">
                     <label htmlFor="account-initial-balance-date" className="text-sm text-[var(--text-soft)]">Saldo inicial al dia</label>
                     <input
                        id="account-initial-balance-date"
                        type="date"
                        value={form.initialBalanceDate}
                        onChange={(e) => setForm((s) => ({ ...s, initialBalanceDate: e.target.value }))}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                     />
                     <p className="text-xs text-[var(--text-soft)]">
                        El sistema calculara el saldo de cada movimiento a partir de esta fecha. Los movimientos anteriores no mostraran saldo calculado.
                     </p>
                  </div>

                  {(editingId ? canUpdate : canCreate) ? (
                  <div className="flex items-center gap-2 pt-1">
                     <button
                        type="submit"
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand)]'}`}
                     >
                        {saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Agregar cuenta')}
                     </button>
                     {editingId && (
                        <button
                           type="button"
                           onClick={resetForm}
                           className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)]"
                        >
                           Cancelar
                        </button>
                     )}
                  </div>
                  ) : (
                     <div className="pt-1 text-sm text-[var(--text-soft)]">
                        No tienes permiso para {editingId ? 'editar' : 'crear'} cuentas bancarias en esta entidad.
                     </div>
                  )}
               </form>
            </section>

            <section className="xl:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] p-4">
               <h2 className="text-lg font-semibold text-[var(--heading)]">Cuentas existentes</h2>

               {error && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                     {error?.message || 'No se pudieron cargar las cuentas bancarias'}
                  </div>
               )}

               {isLoading ? (
                  <div className="mt-4 text-sm text-[var(--text-soft)]">Cargando cuentas bancarias...</div>
               ) : (
                  <div className="mt-4 overflow-x-auto">
                     <table className="w-full min-w-[640px] text-sm">
                        <thead>
                           <tr className="border-b border-[var(--border-subtle)] text-[var(--text-soft)]">
                              <th className="text-left py-2 px-2">Banco</th>
                              <th className="text-left py-2 px-2">Cuenta</th>
                              <th className="text-left py-2 px-2">Moneda</th>
                              <th className="text-left py-2 px-2">Saldo inicial</th>
                              <th className="text-left py-2 px-2">ID</th>
                              <th className="text-right py-2 px-2">Acciones</th>
                           </tr>
                        </thead>
                        <tbody>
                           {rows.length === 0 && (
                              <tr>
                                 <td colSpan={6} className="py-6 text-center text-[var(--text-soft)]">
                                    Aun no hay cuentas bancarias registradas para esta entidad.
                                 </td>
                              </tr>
                           )}
                           {rows.map((row) => (
                              <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                                 <td className="py-2 px-2 text-[var(--text-main)]">{row.bank_name}</td>
                                 <td className="py-2 px-2 text-[var(--text-main)]">
                                    {revealedNumbers[row.id] || row.account_number}
                                 </td>
                                 <td className="py-2 px-2 text-[var(--text-main)]">{row.currency_label || row.currency}</td>
                                 <td className="py-2 px-2 text-[var(--text-main)]">
                                    {clpFmt.format(Number(row.initial_balance || 0))}
                                    {row.initial_balance_date && (
                                       <div className="text-[11px] text-[var(--text-soft)]">al {row.initial_balance_date}</div>
                                    )}
                                 </td>
                                 <td className="py-2 px-2 text-[var(--text-soft)]">{row.id}</td>
                                 <td className="py-2 px-2">
                                    <div className="flex justify-end gap-2">
                                       {canUpdate && (
                                          <button
                                             type="button"
                                             onClick={() => onReveal(row)}
                                             disabled={Number(revealingId) === Number(row.id)}
                                             className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                          >
                                             {Number(revealingId) === Number(row.id) ? 'Ver...' : 'Ver'}
                                          </button>
                                       )}
                                       {canUpdate && (
                                          <button
                                             type="button"
                                             onClick={() => startEdit(row)}
                                             className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--surface-1)]"
                                          >
                                             Editar
                                          </button>
                                       )}
                                       {canDelete && (
                                          <button
                                             type="button"
                                             onClick={() => onDelete(row)}
                                             disabled={Number(deletingId) === Number(row.id)}
                                             className={`px-3 py-1.5 rounded-md text-white ${Number(deletingId) === Number(row.id) ? 'bg-gray-400' : 'bg-[var(--danger)]'}`}
                                          >
                                             {Number(deletingId) === Number(row.id) ? 'Eliminando...' : 'Eliminar'}
                                          </button>
                                       )}
                                    </div>
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </section>
         </div>
      </div>
   );
}
