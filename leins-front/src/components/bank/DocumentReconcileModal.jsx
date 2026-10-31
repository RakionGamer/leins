// src/components/bank/DocumentReconcileModal.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Modal from '../Modal';
import {
   fetchDocumentReconcileCandidates,
   reconcileOne,
   listReconciliations,
   unreconcile,
} from '../../services/reconcileApi';
import { toast } from '../Toaster';
import {
   BuildingLibraryIcon,
   CalendarDaysIcon,
   CheckCircleIcon,
   ArrowPathIcon,
   MagnifyingGlassIcon,
   SparklesIcon,
   LinkIcon,
   ArrowUturnLeftIcon,
} from '@heroicons/react/24/outline';

function useDebounced(value, delay = 300) {
   const [debounced, setDebounced] = useState(value);
   useEffect(() => {
      const handler = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handler);
   }, [value, delay]);
   return debounced;
}

const currencyFmt = new Intl.NumberFormat('es-CL', {
   style: 'currency',
   currency: 'CLP',
   maximumFractionDigits: 0,
});
const clp = (val) => currencyFmt.format(Number(val || 0));

export default function DocumentReconcileModal({
   isOpen,
   onClose,
   document: doc,
   entityId,
   onSuccess,
}) {
   const [candidates, setCandidates] = useState([]);
   const [loadingCandidates, setLoadingCandidates] = useState(false);
   const [reconcilingId, setReconcilingId] = useState(null);

   const [reconciliations, setReconciliations] = useState([]);
   const [loadingReconciliations, setLoadingReconciliations] = useState(false);
   const [unreconcilingId, setUnreconcilingId] = useState(null);

   const [searchQuery, setSearchQuery] = useState('');
   const debSearchQuery = useDebounced(searchQuery, 300);

   const dateFmt = useMemo(() => new Intl.DateTimeFormat('es-CL'), []);
   const fmtDate = (val) => {
      if (!val) return '-';
      try {
         const parts = String(val).slice(0, 10).split('-');
         if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
         return dateFmt.format(new Date(val));
      } catch {
         return String(val);
      }
   };

   const isPaid = Boolean(doc?.is_reconciled);

   const loadCandidates = useCallback(async (signal) => {
      if (!entityId || !doc?.id) return;
      setLoadingCandidates(true);
      try {
         const res = await fetchDocumentReconcileCandidates({
            entityId,
            document_id: doc.id,
            q: debSearchQuery?.trim() || '',
            limit: 20,
            signal,
         });
         setCandidates(Array.isArray(res.candidates) ? res.candidates : []);
      } catch (err) {
         if (err.name !== 'AbortError') {
            toast.error(err.message || 'Error al buscar movimientos bancarios');
         }
      } finally {
         setLoadingCandidates(false);
      }
   }, [entityId, doc?.id, debSearchQuery]);

   const loadReconciliations = useCallback(async () => {
      if (!entityId || !doc?.id) return;
      setLoadingReconciliations(true);
      try {
         const res = await listReconciliations({
            entityId,
            document_id: doc.id,
            limit: 10,
         });
         const items = Array.isArray(res.rows ?? res.data ?? res) ? (res.rows ?? res.data ?? res) : [];
         setReconciliations(items);
      } catch (err) {
         console.warn('Error al cargar conciliaciones existentes:', err);
      } finally {
         setLoadingReconciliations(false);
      }
   }, [entityId, doc?.id]);

   // 1. Cargar conciliaciones existentes (solo cuando se abre el modal o cambia el documento)
   useEffect(() => {
      if (!isOpen || !doc?.id || !entityId) {
         setReconciliations([]);
         return;
      }
      loadReconciliations();
   }, [isOpen, doc?.id, entityId, loadReconciliations]);

   // 2. Cargar candidatos en cartola (cuando se abre el modal o cambia la búsqueda)
   useEffect(() => {
      if (!isOpen || !doc?.id || !entityId) {
         setCandidates([]);
         setSearchQuery('');
         return;
      }

      if (isPaid) {
         setCandidates([]);
         return;
      }

      const ctrl = new AbortController();
      loadCandidates(ctrl.signal);

      return () => ctrl.abort();
   }, [isOpen, doc?.id, entityId, isPaid, loadCandidates]);

   const handleReconcile = async (candidate) => {
      if (!entityId || !doc?.id || !candidate?.id) return;
      setReconcilingId(candidate.id);
      try {
         const remainingDoc = Math.abs(Number(doc.remaining_amount ?? doc.total_amount ?? 0));
         const remainingBank = Math.abs(Number(candidate.remaining_amount || candidate.amount || 0));
         const matchAmount = Math.min(remainingDoc > 0 ? remainingDoc : remainingBank, remainingBank);

         await reconcileOne({
            entityId,
            bank_transaction_id: candidate.id,
            document_id: doc.id,
            amount: matchAmount > 0 ? matchAmount : undefined,
         });

         toast.success(`Documento conciliado con el movimiento de ${clp(matchAmount)}`);
         onSuccess?.();
         onClose();
      } catch (err) {
         toast.error(err.message || 'Error al conciliar con el banco');
      } finally {
         setReconcilingId(null);
      }
   };

   const handleUnreconcile = async (recId) => {
      if (!entityId || !recId) return;
      setUnreconcilingId(recId);
      try {
         await unreconcile(recId, {
            entityId,
            kind: 'document',
         });
         toast.success('Conciliación revertida');
         onSuccess?.();
         loadReconciliations();
         // Al desconciliar, la factura vuelve a estar pendiente, por lo que cargamos sugerencias de cartola
         loadCandidates();
      } catch (err) {
         toast.error(err.message || 'Error al desconciliar');
      } finally {
         setUnreconcilingId(null);
      }
   };

   if (!isOpen || !doc) return null;

   const isSale = doc.operation_type === 'INCOME' || [39, 41, 1001].includes(doc.doc_type_code);
   const isHonorarium = [1002].includes(doc.doc_type_code) || String(doc.doc_type || '').toLowerCase().includes('honorario');
   const counterpartyLabel = isSale
      ? 'Cliente / Razón Social'
      : isHonorarium
      ? 'Prestador / Emisor'
      : 'Proveedor / Razón Social';
   const nameMatchBadgeLabel = isSale
      ? 'Cliente en glosa'
      : isHonorarium
      ? 'Prestador en glosa'
      : '{nameMatchBadgeLabel}';
   const cartolaSectionTitle = isSale
      ? 'Abonos y transferencias en cartola'
      : 'Cargos y transferencias en cartola';
   const paidStatusLabel = isSale ? 'Cobrado' : 'Pagado';
   const paidNoticeText = isSale
      ? 'Este documento se encuentra totalmente cobrado y conciliado con el banco'
      : 'Esta factura se encuentra totalmente pagada y conciliada con el banco';

   const docTotal = Number(doc.total_amount ?? doc.total ?? 0);
   const docRemaining = Number(doc.remaining_amount ?? (isPaid ? 0 : docTotal));

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Conciliación con Banco" maxWidth="max-w-2xl">
         <div className="space-y-4">
            {/* Header del Documento */}
            <div className="p-4 rounded-2xl bg-surface-1 border border-border-subtle/80 space-y-3">
               <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/50 pb-2">
                  <div className="flex items-center gap-2">
                     <span className="font-semibold text-xs text-brand font-mono bg-brand/10 px-2 py-0.5 rounded-md">
                        {doc.doc_type || 'Documento'}
                     </span>
                     <span className="font-bold text-heading text-sm">
                        Folio #{doc.folio || doc.id}
                     </span>
                     <span className="text-xs text-text-soft">
                        ({fmtDate(doc.date || doc.issue_date)})
                     </span>
                  </div>
                  <div>
                     {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                           <CheckCircleIcon className="w-3.5 h-3.5" /> {paidStatusLabel}
                        </span>
                     ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                           Sin conciliar
                        </span>
                     )}
                  </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                     <span className="text-text-soft block uppercase tracking-wider text-[10px] font-semibold">
                        {counterpartyLabel}
                     </span>
                     <div className="font-semibold text-heading truncate mt-0.5" title={doc.counterparty_name || doc.client_name}>
                        {doc.counterparty_name || doc.client_name || '-'}
                     </div>
                     <div className="font-mono text-text-soft text-[11px]">
                        RUT: {doc.counterparty_rut || doc.client_rut || 'Sin RUT'}
                     </div>
                  </div>

                  <div className="sm:text-right">
                     <span className="text-text-soft block uppercase tracking-wider text-[10px] font-semibold">
                        Monto Total / Pendiente
                     </span>
                     <div className="text-base font-bold text-heading mt-0.5">
                        {clp(docTotal)}
                     </div>
                     {!isPaid && docRemaining < docTotal && docRemaining > 0 && (
                        <div className="text-amber-600 font-semibold text-[11px]">
                           Saldo pendiente: {clp(docRemaining)}
                        </div>
                     )}
                  </div>
               </div>
            </div>

            {/* Sección de Movimientos Bancarios Vinculados */}
            {((isPaid && loadingReconciliations) || reconciliations.length > 0) && (
               <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-text-soft uppercase tracking-wider">
                     <LinkIcon className="w-4 h-4 text-emerald-600" />
                     Movimientos Bancarios Vinculados
                  </div>

                  {loadingReconciliations ? (
                     <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 flex items-center justify-between animate-pulse">
                        <div className="space-y-2">
                           <div className="h-4 w-48 bg-emerald-500/20 rounded-md"></div>
                           <div className="h-3 w-64 bg-emerald-500/10 rounded-md"></div>
                        </div>
                        <div className="h-8 w-24 bg-emerald-500/10 rounded-xl"></div>
                     </div>
                  ) : (
                     <div className="divide-y divide-border-subtle/50 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                        {reconciliations.map((rec) => {
                           const bankName = rec.bank_name || rec.bank_account?.bank_name || 'Banco';
                           const accountLabel = rec.account_label || '';
                           const txDate = rec.bank_issued_at || rec.issued_at;
                           const txDesc = rec.bank_description || rec.description;
                           const txAmount = rec.amount_applied || rec.bank_amount || rec.amount;

                           return (
                              <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 first:pt-0">
                                 <div className="space-y-0.5 text-xs">
                                    <div className="font-semibold text-heading flex flex-wrap items-center gap-2">
                                       <BuildingLibraryIcon className="w-4 h-4 text-brand shrink-0" />
                                       <span>{bankName}</span>
                                       {accountLabel && <span className="font-mono text-text-soft text-[11px]">• {accountLabel}</span>}
                                       {txDate && <span className="font-mono text-text-soft text-[11px]">• {fmtDate(txDate)}</span>}
                                    </div>
                                    {txDesc && (
                                       <div className="text-text-main text-[11.5px] truncate max-w-[380px]" title={txDesc}>
                                          {txDesc}
                                       </div>
                                    )}
                                    <div className="text-text-soft font-mono text-[11px]">
                                       Monto pagado: <span className="font-bold text-heading">{clp(txAmount)}</span>
                                    </div>
                                 </div>

                                 <div>
                                    <button
                                       type="button"
                                       onClick={() => handleUnreconcile(rec.id)}
                                       disabled={unreconcilingId === rec.id}
                                       className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/10 border border-danger/20 rounded-xl transition disabled:opacity-50 cursor-pointer"
                                       title="Deshacer esta conciliación"
                                    >
                                       <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                                       {unreconcilingId === rec.id ? 'Revirtiendo...' : 'Desconciliar'}
                                    </button>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            )}

            {/* Si ya está pagado/cobrado: Mostramos aviso informativo y NO mostramos la búsqueda de cartola */}
            {isPaid ? (
               <div className="p-4 rounded-2xl bg-surface-1 border border-border-subtle/70 text-center space-y-1">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                     <CheckCircleIcon className="w-4 h-4" />
                     <span>{paidNoticeText}</span>
                  </div>
                  <p className="text-[11.5px] text-text-soft">
                     Para vincularla a un movimiento diferente, primero haz clic en &quot;Desconciliar&quot; en el movimiento superior.
                  </p>
               </div>
            ) : (
               /* Sección de Búsqueda y Sugerencias de Movimientos Bancarios (Solo cuando está Sin Conciliar) */
               <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                     <div className="flex items-center gap-1.5 text-xs font-semibold text-text-soft uppercase tracking-wider">
                        <SparklesIcon className="w-4 h-4 text-brand" />
                        {cartolaSectionTitle}
                     </div>

                     <div className="relative w-full sm:w-64">
                        <input
                           type="text"
                           className="w-full h-9 pl-8 pr-3 text-xs rounded-xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm"
                           placeholder="Buscar por monto o glosa..."
                           value={searchQuery}
                           onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        <MagnifyingGlassIcon className="w-3.5 h-3.5 text-text-soft absolute left-2.5 top-2.5" />
                     </div>
                  </div>

                  {loadingCandidates ? (
                     <div className="p-8 text-center text-brand font-medium text-xs flex items-center justify-center gap-2">
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Buscando coincidencias en la cartola bancaria...
                     </div>
                  ) : candidates.length === 0 ? (
                     <div className="p-8 text-center bg-surface-1 rounded-2xl border border-border-subtle text-text-soft text-xs space-y-1">
                        <p className="font-semibold text-text-main">No se encontraron cargos bancarios pendientes coincidentes.</p>
                        <p>Puedes ingresar palabras clave o el monto en el buscador superior para revisar la cartola.</p>
                     </div>
                  ) : (
                     <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {candidates.map((cand) => {
                           const isReconciling = reconcilingId === cand.id;
                           // Coincide casi todo: mismo monto + (coincide RUT o nombre de proveedor en glosa)
                           const isBestSuggestion = Boolean(
                              (cand.is_exact_amount && (cand.is_rut_match || cand.is_name_match)) ||
                              (cand.is_rut_match && cand.is_name_match)
                           );

                           return (
                              <div
                                 key={cand.id}
                                 className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group ${
                                    isBestSuggestion
                                       ? 'border-emerald-500/50 bg-emerald-500/[0.04] ring-1 ring-emerald-500/25 hover:border-emerald-500/70 hover:bg-emerald-500/[0.07]'
                                       : 'border-border-subtle/70 bg-surface-1 hover:border-brand/40'
                                 }`}
                              >
                                 <div className="space-y-1.5 text-xs flex-1 min-w-0">
                                    {/* Badges de Coincidencia (copiando el estilo de píldora de la tabla, sin iconos) */}
                                    <div className="flex flex-wrap items-center gap-1.5">
                                       {isBestSuggestion && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-600 text-white shadow-xs">
                                             Mejor sugerencia
                                          </span>
                                       )}
                                       {cand.is_exact_amount && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20">
                                             Mismo monto
                                          </span>
                                       )}
                                       {cand.is_rut_match && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-600 ring-1 ring-sky-500/20">
                                             Coincide RUT
                                          </span>
                                       )}
                                       {cand.is_name_match && (
                                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-600 ring-1 ring-purple-500/20">
                                             Proveedor en glosa
                                          </span>
                                       )}
                                    </div>

                                    <div className="font-semibold text-heading truncate text-sm" title={cand.description}>
                                       {cand.description || '(Sin descripción)'}
                                    </div>

                                    <div className="flex flex-wrap items-center gap-2.5 text-[11px] text-text-soft font-mono">
                                       <span>{fmtDate(cand.issue_date)}</span>
                                       <span>•</span>
                                       <span>{cand.account_label || 'Cuenta Bancaria'}</span>
                                       {cand.document_ref && (
                                          <>
                                             <span>•</span>
                                             <span>N°: {cand.document_ref}</span>
                                          </>
                                       )}
                                    </div>
                                 </div>

                                 <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2 shrink-0">
                                    <div className="text-right">
                                       <div className={`text-base font-bold font-mono ${isBestSuggestion ? 'text-emerald-600' : 'text-brand'}`}>
                                          {clp(cand.remaining_amount || cand.amount)}
                                       </div>
                                       {cand.remaining_amount < cand.amount && (
                                          <div className="text-[10px] text-text-soft">
                                             Total: {clp(cand.amount)}
                                          </div>
                                       )}
                                    </div>

                                    <button
                                       type="button"
                                       onClick={() => handleReconcile(cand)}
                                       disabled={isReconciling || Boolean(reconcilingId)}
                                       className={`px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer ${
                                          isBestSuggestion
                                             ? 'bg-emerald-600 hover:bg-emerald-700'
                                             : 'bg-brand hover:opacity-90'
                                       }`}
                                    >
                                       {isReconciling ? (
                                          <>
                                             <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                                             Conciliando...
                                          </>
                                       ) : (
                                          <>
                                             <LinkIcon className="w-3.5 h-3.5" />
                                             Conciliar
                                          </>
                                       )}
                                    </button>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  )}
               </div>
            )}

            <div className="flex justify-end pt-2 border-t border-border-subtle/50">
               <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-soft hover:text-heading bg-surface-2 transition cursor-pointer"
               >
                  Cerrar
               </button>
            </div>
         </div>
      </Modal>
   );
}
