// leins-front/src/components/bank/BatchBoletearConfirmModal.jsx
import React, { useState } from 'react';
import Modal from 'components/Modal';
import { toast } from 'components/Toaster';
import { enqueueBatchBoletas } from '../../services/boletaQueueApi';
import {
   DocumentTextIcon,
   BanknotesIcon,
   ShieldCheckIcon,
   CheckCircleIcon,
} from '@heroicons/react/24/outline';

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
         toast.success(`¡${count} boletas exentas enviadas a la cola del Bot SII con éxito!`);
         if (onSuccess) onSuccess();
         onClose();
      } catch (err) {
         toast.error(err.message || 'Error al encolar boletas masivas');
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title={`¿Estás seguro de generar ${totalCount} boleta${totalCount > 1 ? 's' : ''}?`} maxWidth="max-w-2xl">
         <div className="space-y-4 text-sm text-[var(--text-main)]">
            {/* Tarjeta de Resumen */}
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
               <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                     <CheckCircleIcon className="w-4 h-4" />
                     <span>Emisión Masiva de Boletas Exentas</span>
                  </div>
                  <p className="text-xs text-[var(--text-soft)] mt-1">
                     Se enviarán al Bot de Harry como <strong>Boletas Exentas (DTE 41)</strong> y se conciliarán automáticamente en cuanto el bot suba los PDF.
                  </p>
               </div>
               <div className="text-right sm:border-l sm:border-emerald-500/20 sm:pl-4">
                  <div className="text-[11px] uppercase font-semibold text-[var(--text-soft)]">Total a Boletear</div>
                  <div className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                     {fmtCLP(totalAmount)}
                  </div>
                  <div className="text-[11px] font-medium text-[var(--text-soft)]">
                     {totalCount} movimiento{totalCount > 1 ? 's' : ''} seleccionado{totalCount > 1 ? 's' : ''}
                  </div>
               </div>
            </div>

            {/* Listado con scroll de los movimientos seleccionados */}
            <div className="rounded-xl border border-[var(--border-subtle)] overflow-hidden">
               <div className="bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold text-[var(--text-soft)] flex justify-between">
                  <span>Movimientos Seleccionados ({totalCount})</span>
                  <span>Monto</span>
               </div>
               <div className="max-h-56 overflow-y-auto divide-y divide-[var(--border-subtle)] text-xs">
                  {selectedTransactions.map((tx, idx) => {
                     const monto = tx.remaining != null ? tx.remaining : Math.abs(tx.monto || 0);
                     return (
                        <div key={tx._id || tx.id || idx} className="p-2.5 flex items-center justify-between gap-3 hover:bg-[var(--surface-1)]">
                           <div className="min-w-0">
                              <div className="font-medium text-[var(--heading)] truncate">
                                 {tx.descripcion || '(Sin descripción)'}
                              </div>
                              <div className="text-[11px] text-[var(--text-soft)]">
                                 {tx.fecha || 'Fecha desconocida'} • {tx.cuenta_corriente || 'Cta Cte'}
                              </div>
                           </div>
                           <div className="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                              {fmtCLP(monto)}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2.5 pt-3 border-t border-[var(--border-subtle)]">
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-medium border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] text-[var(--text-soft)] transition"
               >
                  Cancelar
               </button>
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirm}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm flex items-center gap-1.5 disabled:opacity-50"
               >
                  {isSubmitting ? (
                     <span>Enviando al Bot...</span>
                  ) : (
                     <>
                        <DocumentTextIcon className="w-4 h-4" />
                        <span>Confirmar y Enviar al Bot ({totalCount})</span>
                     </>
                  )}
               </button>
            </div>
         </div>
      </Modal>
   );
}
