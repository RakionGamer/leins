// leins-front/src/components/bank/BatchBoletearConfirmModal.jsx
import React, { useState } from 'react';
import Modal from 'components/Modal';
import { toast } from 'components/Toaster';
import { enqueueBatchBoletas } from '../../services/boletaQueueApi';
import { DocumentTextIcon } from '@heroicons/react/24/outline';

const fmtCLP = (val) =>
   new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
   }).format(Number(val) || 0);

export default function BatchBoletearConfirmModal({
   isOpen,
   onClose,
   selectedTransactions = [],
   entityId,
   onSuccess,
}) {
   const [isSubmitting, setIsSubmitting] = useState(false);

   if (!isOpen || selectedTransactions.length === 0) return null;

   const totalCount = selectedTransactions.length;
   const totalAmount = selectedTransactions.reduce((sum, tx) => {
      const remaining = tx.remaining != null ? tx.remaining : Math.abs(tx.monto || 0);
      return sum + remaining;
   }, 0);

   const handleConfirm = async () => {
      setIsSubmitting(true);
      try {
         const transactionsPayload = selectedTransactions.map((tx) => ({
            bank_transaction_id: tx.id || tx.raw?.id,
            amount: tx.remaining != null ? tx.remaining : Math.abs(tx.monto || 0),
            description: tx.descripcion || 'Venta',
         }));

         const res = await enqueueBatchBoletas({
            entityId,
            transactions: transactionsPayload,
         });

         const count = res.totalCreated || totalCount;
         toast.success(`¡${count} boletas exentas enviadas a emisión con éxito!`);
         if (onSuccess) onSuccess();
         onClose();
      } catch (err) {
         toast.error(err.message || 'Error al encolar boletas masivas');
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <Modal
         isOpen={isOpen}
         onClose={onClose}
         title={`¿Estás seguro de generar ${totalCount} boleta${totalCount > 1 ? 's' : ''}?`}
         maxWidth="max-w-2xl"
      >
         <div className="space-y-4 text-sm text-[var(--text-main)]">
            {/* Tarjeta de Resumen Corporativa y Neutra */}
            <div className="p-4 rounded-xl bg-[var(--surface-1)] border border-[var(--border-subtle)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
               <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                     <span className="text-xs font-semibold text-[var(--heading)] tracking-wide uppercase">
                        Emisión Masiva
                     </span>
                     <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--surface-2)] text-[var(--text-soft)] border border-[var(--border-subtle)]">
                        Boleta Exenta (DTE 41)
                     </span>
                  </div>
                  <p className="text-xs text-[var(--text-soft)] leading-relaxed">
                     Las operaciones seleccionadas se enviarán para su emisión oficial ante el Servicio de Impuestos Internos.
                  </p>
               </div>
               <div className="text-left sm:text-right sm:border-l sm:border-[var(--border-subtle)] sm:pl-5 shrink-0">
                  <div className="text-[11px] uppercase font-semibold text-[var(--text-soft)] tracking-wider">
                     Monto Total
                  </div>
                  <div className="text-xl font-bold font-mono text-[var(--heading)]">
                     {fmtCLP(totalAmount)}
                  </div>
                  <div className="text-[11px] text-[var(--text-soft)] font-medium">
                     {totalCount} movimiento{totalCount > 1 ? 's' : ''}
                  </div>
               </div>
            </div>

            {/* Listado de movimientos seleccionados */}
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden bg-[var(--bg-content)]">
               <div className="bg-[var(--surface-2)] px-3 py-2 text-[11px] font-semibold text-[var(--text-soft)] uppercase tracking-wider flex justify-between">
                  <span>Movimientos Seleccionados ({totalCount})</span>
                  <span>Monto</span>
               </div>
               <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                  {selectedTransactions.map((tx, idx) => {
                     const monto = tx.remaining != null ? tx.remaining : Math.abs(tx.monto || 0);
                     return (
                        <div
                           key={tx._id || tx.id || idx}
                           className="p-3 flex items-center justify-between gap-3 hover:bg-[var(--surface-1)] transition-colors"
                        >
                           <div className="min-w-0">
                              <div className="font-medium text-[var(--heading)] truncate">
                                 {tx.descripcion || '(Sin descripción)'}
                              </div>
                              <div className="text-[11px] text-[var(--text-soft)] mt-0.5">
                                 {tx.fecha || 'Fecha desconocida'} • {tx.cuenta_corriente || 'Cta Cte'}
                              </div>
                           </div>
                           <div className="font-semibold font-mono text-[var(--heading)] whitespace-nowrap pl-3">
                              {fmtCLP(monto)}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end items-center gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text-soft)] hover:text-[var(--heading)] transition cursor-pointer disabled:opacity-50"
               >
                  Cancelar
               </button>
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 shadow-sm transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
               >
                  {isSubmitting ? (
                     <span>Enviando a emisión...</span>
                  ) : (
                     <>
                        <DocumentTextIcon className="w-4 h-4" />
                        <span>Confirmar emisión ({totalCount})</span>
                     </>
                  )}
               </button>
            </div>
         </div>
      </Modal>
   );
}
