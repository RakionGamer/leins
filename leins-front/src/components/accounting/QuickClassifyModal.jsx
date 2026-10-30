import React, { useState, useEffect } from 'react';
import Modal from '../Modal';
import AccountSelect from './AccountSelect';
import { getAccounts, classifyDocument } from '../../services/accountingApi';
import { toast } from '../Toaster';
import {
   TagIcon,
   CheckIcon,
   ArrowPathIcon,
   BuildingOffice2Icon,
   DocumentTextIcon,
   SparklesIcon,
} from '@heroicons/react/24/outline';

export default function QuickClassifyModal({ isOpen, onClose, document, entityId, onSuccess }) {
   const [accounts, setAccounts] = useState([]);
   const [loadingAccounts, setLoadingAccounts] = useState(false);
   const [saving, setSaving] = useState(false);
   const [selectedAccountId, setSelectedAccountId] = useState(null);
   const [scope, setScope] = useState('RULE'); // 'RULE' | 'DOCUMENT'

   useEffect(() => {
      if (!isOpen || !entityId) return;

      setSelectedAccountId(document?.accounting_account?.id || null);
      // Si el documento ya venía marcado con excepción individual, seleccionamos por defecto 'DOCUMENT'
      setScope(document?.is_exception ? 'DOCUMENT' : 'RULE');
      setLoadingAccounts(true);

      getAccounts({ entityId: Number(entityId) })
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
         await classifyDocument({
            entityId,
            document_id: document.id,
            account_id: selectedAccountId,
            scope,
            counterparty_rut: document.counterparty_rut,
            counterparty_name: document.counterparty_name,
         });

         if (scope === 'DOCUMENT') {
            toast.success(`Cuenta contable asignada exclusivamente a la factura Folio #${document.folio || document.id}`);
         } else {
            toast.success(`Regla guardada: cuenta contable asignada a todas las facturas de ${document.counterparty_name || document.counterparty_rut}`);
         }
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
      <Modal isOpen={isOpen} onClose={onClose} title="Clasificación Contable de Compra" maxWidth="max-w-lg">
         <form onSubmit={handleSave} className="space-y-4">
            {/* Cabecera del Documento y Proveedor */}
            <div className="bg-surface-1 p-4 rounded-2xl border border-border-subtle/60 space-y-2.5">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text-soft uppercase tracking-wider">
                     <DocumentTextIcon className="w-4 h-4 text-brand" />
                     <span>Documento Folio #{document.folio || document.id}</span>
                  </div>
                  {document.is_exception && (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-700 ring-1 ring-purple-500/20">
                        <SparklesIcon className="w-3 h-3" /> Excepción activa
                     </span>
                  )}
               </div>

               <div className="border-t border-border-subtle/40 pt-2 space-y-0.5">
                  <div className="text-sm font-bold text-heading truncate" title={document.counterparty_name || 'Sin Razón Social'}>
                     {document.counterparty_name || 'Sin Razón Social'}
                  </div>
                  <div className="text-xs font-mono text-text-soft">
                     RUT: {document.counterparty_rut || 'Sin RUT'}
                  </div>
               </div>
            </div>

            {/* Selector de Alcance: Regla General vs Solo esta Factura */}
            <div className="space-y-1.5">
               <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">
                  Alcance de la Imputación
               </label>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Opción 1: Regla General */}
                  <button
                     type="button"
                     onClick={() => setScope('RULE')}
                     className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        scope === 'RULE'
                           ? 'border-brand bg-brand/5 ring-1 ring-brand text-brand'
                           : 'border-border-subtle bg-bg-content text-text-soft hover:bg-surface-1'
                     }`}
                  >
                     <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-heading">
                           <BuildingOffice2Icon className={`w-4 h-4 ${scope === 'RULE' ? 'text-brand' : 'text-text-soft'}`} />
                           <span>Regla de Proveedor</span>
                        </div>
                        {scope === 'RULE' && <CheckIcon className="w-4 h-4 text-brand stroke-2" />}
                     </div>
                     <p className="text-[11px] text-text-soft leading-snug">
                        Aplica a <strong>todas</strong> las facturas pasadas y futuras de este proveedor.
                     </p>
                  </button>

                  {/* Opción 2: Solo esta Factura */}
                  <button
                     type="button"
                     onClick={() => setScope('DOCUMENT')}
                     className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        scope === 'DOCUMENT'
                           ? 'border-purple-600 bg-purple-500/5 ring-1 ring-purple-600 text-purple-700'
                           : 'border-border-subtle bg-bg-content text-text-soft hover:bg-surface-1'
                     }`}
                  >
                     <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-heading">
                           <TagIcon className={`w-4 h-4 ${scope === 'DOCUMENT' ? 'text-purple-600' : 'text-text-soft'}`} />
                           <span>Solo esta Factura</span>
                        </div>
                        {scope === 'DOCUMENT' && <CheckIcon className="w-4 h-4 text-purple-600 stroke-2" />}
                     </div>
                     <p className="text-[11px] text-text-soft leading-snug">
                        Excepción: imputa <strong>únicamente</strong> este Folio #{document.folio || document.id}.
                     </p>
                  </button>
               </div>
            </div>

            {/* Selector de Cuenta Contable */}
            <div className="space-y-1.5">
               <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">
                  Cuenta Contable de Imputación (Resultado, Costo o Activo)
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
                     onChange={(val) => {
                        const id = typeof val === 'object' && val !== null ? val.id : val;
                        setSelectedAccountId(id || null);
                     }}
                     placeholder="Buscar cuenta (ej: 61.04.01 Gastos de Oficina, 11.07 Activo Fijo...)"
                  />
               )}
            </div>

            {/* Botones de Acción */}
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
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-semibold shadow-sm transition flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                     scope === 'DOCUMENT' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-brand hover:bg-brand/90'
                  }`}
               >
                  {saving ? (
                     <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        <span>Guardando...</span>
                     </>
                  ) : (
                     <>
                        <CheckIcon className="w-4 h-4 stroke-2" />
                        <span>{scope === 'DOCUMENT' ? 'Aplicar a este Documento' : 'Guardar Regla de Proveedor'}</span>
                     </>
                  )}
               </button>
            </div>
         </form>
      </Modal>
   );
}
