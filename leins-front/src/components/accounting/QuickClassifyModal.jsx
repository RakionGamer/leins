import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import AccountSelect from './AccountSelect';
import { getAccounts, upsertRule } from '../../services/accountingApi';
import { toast } from '../Toaster';
import { TagIcon, CheckIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function QuickClassifyModal({ isOpen, onClose, document, entityId, onSuccess }) {
   const [accounts, setAccounts] = useState([]);
   const [loadingAccounts, setLoadingAccounts] = useState(false);
   const [saving, setSaving] = useState(false);
   const [selectedAccountId, setSelectedAccountId] = useState(null);

   useEffect(() => {
      if (!isOpen || !entityId) return;

      setSelectedAccountId(document?.accounting_account?.id || null);
      setLoadingAccounts(true);

      getAccounts(entityId)
         .then((accs) => {
            // Filtrar cuentas imputables (no títulos)
            const postable = Array.isArray(accs) ? accs.filter(a => !a.is_title) : [];
            setAccounts(postable);
         })
         .catch((err) => {
            toast.error(err.message || 'Error al cargar plan de cuentas');
         })
         .finally(() => {
            setLoadingAccounts(false);
         });
   }, [isOpen, entityId, document]);

   const handleSave = async (e) => {
      e?.preventDefault();
      if (!selectedAccountId) {
         toast.error('Debe seleccionar una cuenta contable');
         return;
      }

      setSaving(true);
      try {
         await upsertRule({
            entityId,
            counterparty_rut: document.counterparty_rut,
            counterparty_name: document.counterparty_name,
            account_id: selectedAccountId,
         });

         toast.success(`Cuenta contable asignada a ${document.counterparty_name || document.counterparty_rut}`);
         onSuccess?.();
         onClose();
      } catch (err) {
         toast.error(err.message || 'Error al guardar la clasificación contable');
      } finally {
         setSaving(false);
      }
   };

   if (!isOpen || !document) return null;

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Clasificación Contable de Documento" maxWidth="max-w-lg">
         <form onSubmit={handleSave} className="space-y-4">
            <div className="bg-surface-1 p-4 rounded-2xl border border-border-subtle/60 space-y-2">
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wider">
                  Tercero / Contraparte
               </div>
               <div className="text-sm font-bold text-heading">
                  {document.counterparty_name || 'Sin Razón Social'}
               </div>
               <div className="text-xs font-mono text-text-soft">
                  RUT: {document.counterparty_rut || 'Sin RUT'}
               </div>
               <p className="text-[11.5px] text-text-soft pt-1 border-t border-border-subtle/40">
                  Al imputar este tercero, todas sus facturas (actuales y futuras) quedarán automáticamente clasificadas y centralizadas a esta cuenta.
               </p>
            </div>

            <div className="space-y-1.5">
               <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">
                  Cuenta Contable de Imputación (Resultado o Inventario)
               </label>
               {loadingAccounts ? (
                  <div className="h-11 flex items-center justify-center text-xs text-brand gap-2 border border-border-subtle rounded-2xl bg-bg-content">
                     <ArrowPathIcon className="w-4 h-4 animate-spin" />
                     <span>Cargando plan de cuentas...</span>
                  </div>
               ) : (
                  <AccountSelect
                     accounts={accounts}
                     value={selectedAccountId}
                     onChange={(acc) => setSelectedAccountId(acc?.id || null)}
                     placeholder="Buscar cuenta (ej: 61.01.01 Costo de Venta, 11.07.10 Inventario...)"
                  />
               )}
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl border border-border-subtle text-text-main text-xs font-semibold hover:bg-surface-2 transition cursor-pointer"
               >
                  Cancelar
               </button>
               <button
                  type="submit"
                  disabled={saving || !selectedAccountId}
                  className="px-5 py-2.5 rounded-xl bg-brand hover:bg-brand/90 text-white text-xs font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
               >
                  {saving ? (
                     <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                     </>
                  ) : (
                     <>
                        <CheckIcon className="w-4 h-4 stroke-2" />
                        <span>Asignar y Clasificar</span>
                     </>
                  )}
               </button>
            </div>
         </form>
      </Modal>
   );
}
