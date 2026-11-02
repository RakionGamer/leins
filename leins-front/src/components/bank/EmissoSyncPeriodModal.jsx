import React, { useState } from 'react';
import Modal from '../Modal';
import { syncEmissoBankAccount } from '../../services/entitiesApi';
import { toast } from 'components/Toaster';

const MONTHS = [
   { value: '01', label: 'Enero' },
   { value: '02', label: 'Febrero' },
   { value: '03', label: 'Marzo' },
   { value: '04', label: 'Abril' },
   { value: '05', label: 'Mayo' },
   { value: '06', label: 'Junio' },
   { value: '07', label: 'Julio' },
   { value: '08', label: 'Agosto' },
   { value: '09', label: 'Septiembre' },
   { value: '10', label: 'Octubre' },
   { value: '11', label: 'Noviembre' },
   { value: '12', label: 'Diciembre' },
];

const currentYear = new Date().getFullYear();
const currentMonth = String(new Date().getMonth() + 1).padStart(2, '0');
const YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

export default function EmissoSyncPeriodModal({
   isOpen,
   onClose,
   entityId,
   account,
   onSyncCompleted
}) {
   const [mode, setMode] = useState('single'); // 'single' o 'range'
   const [singleMonth, setSingleMonth] = useState(currentMonth);
   const [singleYear, setSingleYear] = useState(String(currentYear));

   const [fromMonth, setFromMonth] = useState('01');
   const [fromYear, setFromYear] = useState(String(currentYear));
   const [toMonth, setToMonth] = useState(currentMonth);
   const [toYear, setToYear] = useState(String(currentYear));

   const [loading, setLoading] = useState(false);

   if (!isOpen || !account) return null;

   const handleSync = async () => {
      setLoading(true);
      try {
         let payload = {
            entityId,
            id: account.id,
         };

         if (mode === 'single') {
            const period = `${singleYear}-${singleMonth}`;
            payload.periods = [period];
         } else {
            payload.fromPeriod = `${fromYear}-${fromMonth}`;
            payload.toPeriod = `${toYear}-${toMonth}`;
         }

         const resp = await syncEmissoBankAccount(payload);
         toast.success(
            `Sincronización finalizada: ${resp.saved || 0} movimientos nuevos, ${resp.updated || 0} actualizados`
         );

         if (onSyncCompleted) {
            await onSyncCompleted();
         }
         onClose();
      } catch (err) {
         toast.error(err?.message || 'Error al sincronizar movimientos del período');
      } finally {
         setLoading(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Sincronizar Movimientos del Banco" maxWidth="max-w-lg">
         <div className="space-y-5">
            {/* Resumen de la cuenta */}
            <div className="p-3 bg-surface-1 rounded-xl border border-border-subtle text-xs">
               <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-heading">
                     🏦 {account.bank_name || 'Banco'}
                  </span>
                  <span className="badge badge-sm badge-ghost font-mono">
                     Cuenta: {account.account_number}
                  </span>
               </div>
            </div>

            {/* Pestañas de modo */}
            <div className="flex rounded-lg bg-surface-1 p-1 border border-border-subtle text-xs">
               <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`flex-1 py-1.5 font-medium rounded-md transition ${mode === 'single' ? 'bg-primary text-white shadow-sm' : 'text-text-soft hover:text-heading'}`}
               >
                  Mes específico
               </button>
               <button
                  type="button"
                  onClick={() => setMode('range')}
                  className={`flex-1 py-1.5 font-medium rounded-md transition ${mode === 'range' ? 'bg-primary text-white shadow-sm' : 'text-text-soft hover:text-heading'}`}
               >
                  Rango de meses
               </button>
            </div>

            {/* Contenido según el modo */}
            {mode === 'single' ? (
               <div className="space-y-2">
                  <label className="text-xs font-medium text-text-soft">Selecciona el mes y año a descargar:</label>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[11px] text-text-soft block mb-1">Mes</label>
                        <select
                           value={singleMonth}
                           onChange={(e) => setSingleMonth(e.target.value)}
                           className="select select-bordered select-sm w-full bg-surface-1"
                        >
                           {MONTHS.map((m) => (
                              <option key={m.value} value={m.value}>
                                 {m.label}
                              </option>
                           ))}
                        </select>
                     </div>
                     <div>
                        <label className="text-[11px] text-text-soft block mb-1">Año</label>
                        <select
                           value={singleYear}
                           onChange={(e) => setSingleYear(e.target.value)}
                           className="select select-bordered select-sm w-full bg-surface-1"
                        >
                           {YEARS.map((y) => (
                              <option key={y} value={String(y)}>
                                 {y}
                              </option>
                           ))}
                        </select>
                     </div>
                  </div>
               </div>
            ) : (
               <div className="space-y-3">
                  <div>
                     <label className="text-xs font-semibold text-heading block mb-1.5">Desde:</label>
                     <div className="grid grid-cols-2 gap-2">
                        <select
                           value={fromMonth}
                           onChange={(e) => setFromMonth(e.target.value)}
                           className="select select-bordered select-sm w-full bg-surface-1"
                        >
                           {MONTHS.map((m) => (
                              <option key={m.value} value={m.value}>
                                 {m.label}
                              </option>
                           ))}
                        </select>
                        <select
                           value={fromYear}
                           onChange={(e) => setFromYear(e.target.value)}
                           className="select select-bordered select-sm w-full bg-surface-1"
                        >
                           {YEARS.map((y) => (
                              <option key={y} value={String(y)}>
                                 {y}
                              </option>
                           ))}
                        </select>
                     </div>
                  </div>

                  <div>
                     <label className="text-xs font-semibold text-heading block mb-1.5">Hasta:</label>
                     <div className="grid grid-cols-2 gap-2">
                        <select
                           value={toMonth}
                           onChange={(e) => setToMonth(e.target.value)}
                           className="select select-bordered select-sm w-full bg-surface-1"
                        >
                           {MONTHS.map((m) => (
                              <option key={m.value} value={m.value}>
                                 {m.label}
                              </option>
                           ))}
                        </select>
                        <select
                           value={toYear}
                           onChange={(e) => setToYear(e.target.value)}
                           className="select select-bordered select-sm w-full bg-surface-1"
                        >
                           {YEARS.map((y) => (
                              <option key={y} value={String(y)}>
                                 {y}
                              </option>
                           ))}
                        </select>
                     </div>
                  </div>
               </div>
            )}

            {/* Aviso informativo de cero duplicados */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-800 dark:text-emerald-300">
               <p className="font-semibold mb-0.5">🛡️ Protección contra duplicados</p>
               <p>
                  Los movimientos se fusionan automáticamente. Puedes sincronizar cualquier mes las veces que sea necesario:
                  nunca se duplicarán y tus conciliaciones existentes se conservarán al 100%.
               </p>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="btn btn-sm btn-ghost"
               >
                  Cancelar
               </button>
               <button
                  type="button"
                  onClick={handleSync}
                  disabled={loading}
                  className="btn btn-sm btn-primary gap-1.5"
               >
                  {loading && <span className="loading loading-spinner loading-xs" />}
                  ⚡ Sincronizar período
               </button>
            </div>
         </div>
      </Modal>
   );
}
