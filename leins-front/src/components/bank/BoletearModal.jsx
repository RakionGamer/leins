// leins-front/src/components/bank/BoletearModal.jsx
import React, { useState, useEffect } from 'react';
import Modal from 'components/Modal';
import { toast } from 'components/Toaster';
import { enqueueBoleta } from '../../services/boletaQueueApi';
import {
   DocumentTextIcon,
   BanknotesIcon,
   ShieldCheckIcon,
   UserIcon,
} from '@heroicons/react/24/outline';

const fmtCLP = (val) =>
   new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
   }).format(Number(val) || 0);

export default function BoletearModal({
   isOpen,
   onClose,
   transaction,
   entityId,
   onSuccess,
}) {
   const [amount, setAmount] = useState('');
   const [description, setDescription] = useState('');
   const [isExempt, setIsExempt] = useState(true);
   const [customerRut, setCustomerRut] = useState('');
   const [customerName, setCustomerName] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   useEffect(() => {
      if (transaction) {
         const remaining = transaction.remaining != null ? transaction.remaining : Math.abs(transaction.monto || 0);
         setAmount(String(Math.round(remaining)));
         setDescription(transaction.descripcion || 'Venta de servicios');
         setIsExempt(true);
         setCustomerRut('');
         setCustomerName('');
      }
   }, [transaction]);

   if (!isOpen || !transaction) return null;

   const handleSubmit = async (e) => {
      e.preventDefault();
      const numAmount = Math.round(Number(amount));
      if (!Number.isFinite(numAmount) || numAmount <= 0) {
         toast.error('El monto debe ser un numero mayor a 0');
         return;
      }

      setIsSubmitting(true);
      try {
         await enqueueBoleta({
            entityId,
            bank_transaction_id: transaction.id || transaction.raw?.id,
            amount: numAmount,
            description: description.trim() || transaction.descripcion || 'Venta',
            customer_rut: customerRut.trim() || null,
            customer_name: customerName.trim() || 'Consumidor Final',
            is_exempt: isExempt,
            doc_type_code: isExempt ? 41 : 39,
         });

         toast.success('Solicitud de boleta enviada a cola con exito');
         if (onSuccess) onSuccess();
         onClose();
      } catch (err) {
         toast.error(err.message || 'Error al solicitar boleteo');
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Solicitar Boleta (Bot SII)">
         <form onSubmit={handleSubmit} className="space-y-4 text-sm text-[var(--text-main)]">
            {/* Resumen del movimiento bancario */}
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300">
               <div className="flex items-center gap-2 font-semibold text-xs uppercase tracking-wider mb-1">
                  <BanknotesIcon className="w-4 h-4 text-emerald-600" />
                  <span>Abono Bancario de Origen</span>
               </div>
               <div className="flex justify-between items-center text-xs mt-1 text-[var(--text-soft)]">
                  <span>Fecha: {transaction.fecha || String(transaction.raw?.issued_at || '').slice(0, 10)}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                     {fmtCLP(Math.abs(transaction.monto || 0))}
                  </span>
               </div>
               <div className="text-xs text-[var(--text-soft)] truncate mt-1">
                  {transaction.descripcion}
               </div>
            </div>

            {/* Monto y Tipo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
               <div>
                  <label className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-1">
                     Monto a Boletear ($ CLP) *
                  </label>
                  <input
                     type="number"
                     required
                     min="1"
                     step="1"
                     className="w-full h-10 px-3 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] focus:ring-2 focus:ring-[var(--brand)] focus:outline-none"
                     value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-1">
                     Tipo de Boleta *
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                     <button
                        type="button"
                        onClick={() => setIsExempt(true)}
                        className={`flex-1 py-2 px-2 text-xs rounded-xl font-medium border transition ${
                           isExempt
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-[var(--surface-1)] text-[var(--text-soft)] border-[var(--border-subtle)] hover:bg-[var(--surface-2)]'
                        }`}
                     >
                        Exenta (DTE 41)
                     </button>
                     <button
                        type="button"
                        onClick={() => setIsExempt(false)}
                        className={`flex-1 py-2 px-2 text-xs rounded-xl font-medium border transition ${
                           !isExempt
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : 'bg-[var(--surface-1)] text-[var(--text-soft)] border-[var(--border-subtle)] hover:bg-[var(--surface-2)]'
                        }`}
                     >
                        Afecta IVA (DTE 39)
                     </button>
                  </div>
               </div>
            </div>

            {/* Glosa / Detalle */}
            <div>
               <label className="block text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-1">
                  Descripción / Glosa para la Boleta *
               </label>
               <input
                  type="text"
                  required
                  maxLength={500}
                  className="w-full h-10 px-3 text-sm rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] focus:ring-2 focus:ring-[var(--brand)] focus:outline-none"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej: Venta de servicios / productos"
               />
            </div>

            {/* Receptor opcional */}
            <div className="pt-2 border-t border-[var(--border-subtle)]">
               <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mb-2">
                  <UserIcon className="w-3.5 h-3.5" />
                  <span>Receptor (Opcional - por defecto Consumidor Final)</span>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                     type="text"
                     placeholder="RUT Cliente (ej: 12345678-9)"
                     className="w-full h-9 px-3 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] focus:ring-2 focus:ring-[var(--brand)] focus:outline-none"
                     value={customerRut}
                     onChange={(e) => setCustomerRut(e.target.value)}
                  />
                  <input
                     type="text"
                     placeholder="Nombre / Razón Social"
                     className="w-full h-9 px-3 text-xs rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] focus:ring-2 focus:ring-[var(--brand)] focus:outline-none"
                     value={customerName}
                     onChange={(e) => setCustomerName(e.target.value)}
                  />
               </div>
            </div>

            {/* Nota informativa */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[var(--surface-1)] text-xs text-[var(--text-soft)]">
               <ShieldCheckIcon className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
               <span>
                  Al confirmar, esta boleta se encola automáticamente. El worker del SII la emitirá y
                  conciliará este abono en cuanto termine.
               </span>
            </div>

            {/* Botones de acción */}
            <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-subtle)]">
               <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] transition"
               >
                  Cancelar
               </button>
               <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1.5 transition disabled:opacity-50"
               >
                  {isSubmitting ? (
                     <span>Encolando...</span>
                  ) : (
                     <>
                        <DocumentTextIcon className="w-4 h-4" />
                        <span>Enviar a Boletear</span>
                     </>
                  )}
               </button>
            </div>
         </form>
      </Modal>
   );
}
