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
   syncQuota = null,
   onQuotaUpdate,
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

   const used = Math.max(0, Number(syncQuota?.used ?? 0));
   const limit = Math.max(1, Number(syncQuota?.limit ?? 100));
   const limitReached = Boolean(syncQuota && used >= limit);

   const handleSync = async () => {
      if (limitReached) {
         toast.error(`Has alcanzado el límite mensual de sincronizaciones manuales (${used}/${limit}) para este mes. La sincronización automática cada 4 horas sigue activa.`);
         return;
      }

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
         if (resp?.emisso_sync_quota && onQuotaUpdate) {
            onQuotaUpdate(resp.emisso_sync_quota);
         }
         toast.success(
            `Sincronización finalizada: ${resp.saved || 0} movimientos nuevos, ${resp.updated || 0} actualizados`
         );

         if (onSyncCompleted) {
            await onSyncCompleted(resp);
         }
         onClose();
      } catch (err) {
         if (err?.payload?.emisso_sync_quota && onQuotaUpdate) {
            onQuotaUpdate(err.payload.emisso_sync_quota);
         }
         toast.error(err?.message || 'Error al sincronizar movimientos del período');
      } finally {
         setLoading(false);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Sincronizar Movimientos del Banco" maxWidth="max-w-lg">
         <div className="space-y-4">
            {/* Resumen de la cuenta */}
            <div className="p-3.5 bg-surface-1 rounded-xl border border-border-subtle text-xs space-y-2">
               <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm text-heading">
                     {account.bank_name || 'Banco'}
                  </span>
                  <span className="font-mono text-[11px] text-text-soft bg-surface-2 px-2 py-0.5 rounded border border-border-subtle">
                     Cuenta: {account.account_number}
                  </span>
               </div>
               {syncQuota && (
                  <div className="flex items-center justify-between pt-2 border-t border-border-subtle/70">
                     <span className="text-text-soft">Sincronizaciones manuales del mes</span>
                     <span
                        className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${
                           limitReached
                              ? 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30'
                              : used >= Math.floor(limit * 0.85)
                                 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                                 : 'bg-surface-2 text-heading border-border-subtle'
                        }`}
                     >
                        {used}/{limit}
                     </span>
                  </div>
               )}
            </div>

            {limitReached && (
               <div className="p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs">
                  Has alcanzado el límite mensual de {limit} sincronizaciones manuales ({used}/{limit}). La sincronización automática cada 4 horas continúa activa.
               </div>
            )}

            {/* Pestañas de modo (Segmented Control estilo neutral tipo Cloudflare) */}
            <div className="grid grid-cols-2 p-1 bg-surface-2 rounded-xl border border-border-subtle text-xs">
               <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`py-2 px-3 rounded-lg text-center font-medium transition-all cursor-pointer ${
                     mode === 'single'
                        ? 'bg-bg-content text-heading font-semibold shadow-xs border border-border-subtle'
                        : 'text-text-soft hover:text-heading'
                  }`}
               >
                  Mes específico
               </button>
               <button
                  type="button"
                  onClick={() => setMode('range')}
                  className={`py-2 px-3 rounded-lg text-center font-medium transition-all cursor-pointer ${
                     mode === 'range'
                        ? 'bg-bg-content text-heading font-semibold shadow-xs border border-border-subtle'
                        : 'text-text-soft hover:text-heading'
                  }`}
               >
                  Rango de meses
               </button>
            </div>

            {/* Contenido según el modo */}
            {mode === 'single' ? (
               <div className="p-4 rounded-xl border border-border-subtle bg-surface-1 space-y-3">
                  <label className="text-xs font-semibold text-heading block">
                     Selecciona el mes y año a descargar:
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                     <div>
                        <label className="text-[11px] text-text-soft block mb-1">Mes</label>
                        <select
                           value={singleMonth}
                           onChange={(e) => setSingleMonth(e.target.value)}
                           className="select select-bordered select-sm w-full bg-bg-content text-heading text-xs rounded-lg"
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
                           className="select select-bordered select-sm w-full bg-bg-content text-heading text-xs rounded-lg"
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
               <div className="p-4 rounded-xl border border-border-subtle bg-surface-1 space-y-4">
                  <div>
                     <label className="text-xs font-semibold text-heading block mb-1.5">Desde:</label>
                     <div className="grid grid-cols-2 gap-2">
                        <select
                           value={fromMonth}
                           onChange={(e) => setFromMonth(e.target.value)}
                           className="select select-bordered select-sm w-full bg-bg-content text-heading text-xs rounded-lg"
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
                           className="select select-bordered select-sm w-full bg-bg-content text-heading text-xs rounded-lg"
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
                           className="select select-bordered select-sm w-full bg-bg-content text-heading text-xs rounded-lg"
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
                           className="select select-bordered select-sm w-full bg-bg-content text-heading text-xs rounded-lg"
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

            {/* Aviso informativo de cero duplicados (Neutral / Formal) */}
            <div className="p-3.5 bg-surface-1 border border-border-subtle rounded-xl text-xs space-y-1">
               <p className="font-semibold text-heading">Protección contra duplicados</p>
               <p className="text-text-soft leading-relaxed">
                  Los movimientos se fusionan automáticamente mediante verificación estricta. Puedes sincronizar cualquier mes las veces que sea necesario:
                  las transacciones no se duplicarán y las conciliaciones existentes se conservarán intactas.
               </p>
            </div>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
               <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-text-soft hover:text-heading hover:bg-surface-2 transition cursor-pointer"
               >
                  Cancelar
               </button>
               <button
                  type="button"
                  onClick={handleSync}
                  disabled={loading || limitReached}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand text-white hover:bg-brand-strong transition shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
               >
                  {loading && <span className="loading loading-spinner loading-xs" />}
                  <span>Sincronizar período</span>
               </button>
            </div>
         </div>
      </Modal>
   );
}
