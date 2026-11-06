// leins-front/src/components/income/BoletaQueuePanel.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { listBoletaRequests, cancelBoletaRequest } from '../../services/boletaQueueApi';
import { toast } from 'components/Toaster';
import {
   DocumentTextIcon,
   ArrowPathIcon,
   CheckCircleIcon,
   ClockIcon,
   ExclamationTriangleIcon,
   XCircleIcon,
   ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

const fmtCLP = (val) =>
   new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
   }).format(Number(val) || 0);

export default function BoletaQueuePanel({ entityId }) {
   const [requests, setRequests] = useState([]);
   const [loading, setLoading] = useState(true);
   const [statusFilter, setStatusFilter] = useState('all');
   const [cancellingId, setCancellingId] = useState(null);

   const loadData = useCallback(async () => {
      if (!entityId) return;
      try {
         const res = await listBoletaRequests({
            entityId,
            status: statusFilter,
            limit: 100,
         });
         setRequests(res.rows || []);
      } catch (err) {
         console.error('Error cargando cola de boletas:', err);
      } finally {
         setLoading(false);
      }
   }, [entityId, statusFilter]);

   useEffect(() => {
      loadData();
      // Auto-refresco cada 10 segundos para ver el worker en vivo
      const interval = setInterval(loadData, 10000);
      return () => clearInterval(interval);
   }, [loadData]);

   const handleCancel = async (id) => {
      if (!window.confirm('¿Deseas cancelar esta solicitud de boleta?')) return;
      setCancellingId(id);
      try {
         await cancelBoletaRequest(id, entityId);
         toast.success('Solicitud cancelada');
         loadData();
      } catch (err) {
         toast.error(err.message || 'Error al cancelar');
      } finally {
         setCancellingId(null);
      }
   };

   // Contadores rápidos
   const counts = requests.reduce(
      (acc, r) => {
         if (r.status === 'pending') acc.pending++;
         else if (r.status === 'processing') acc.processing++;
         else if (r.status === 'completed') acc.completed++;
         else if (r.status === 'failed' || r.status === 'posiblemente_emitida') acc.error++;
         return acc;
      },
      { pending: 0, processing: 0, completed: 0, error: 0 }
   );

   return (
      <div className="space-y-4">
         {/* Tarjetas de estado rápido */}
         <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
                  <ClockIcon className="w-5 h-5" />
               </div>
               <div>
                  <div className="text-[11px] font-semibold text-[var(--text-soft)] uppercase tracking-wider">
                     En Cola (Pendientes)
                  </div>
                  <div className="text-lg font-bold text-[var(--heading)]">{counts.pending}</div>
               </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" />
               </div>
               <div>
                  <div className="text-[11px] font-semibold text-[var(--text-soft)] uppercase tracking-wider">
                     Procesando en SII
                  </div>
                  <div className="text-lg font-bold text-blue-600">{counts.processing}</div>
               </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
                  <CheckCircleIcon className="w-5 h-5" />
               </div>
               <div>
                  <div className="text-[11px] font-semibold text-[var(--text-soft)] uppercase tracking-wider">
                     Emitidas y Conciliadas
                  </div>
                  <div className="text-lg font-bold text-emerald-600">{counts.completed}</div>
               </div>
            </div>

            <div className="p-3.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-xs flex items-center gap-3">
               <div className="p-2.5 rounded-xl bg-red-500/10 text-red-600">
                  <ExclamationTriangleIcon className="w-5 h-5" />
               </div>
               <div>
                  <div className="text-[11px] font-semibold text-[var(--text-soft)] uppercase tracking-wider">
                     Con Error / Revisar
                  </div>
                  <div className="text-lg font-bold text-red-600">{counts.error}</div>
               </div>
            </div>
         </div>

         {/* Barra de Filtros y Recarga */}
         <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--bg-content)] border border-[var(--border-subtle)]">
            <div className="flex items-center gap-1.5">
               <span className="text-xs font-semibold text-[var(--text-soft)] uppercase tracking-wider mr-1">
                  Filtrar:
               </span>
               {[
                  { key: 'all', label: 'Todos' },
                  { key: 'pending', label: 'Pendientes' },
                  { key: 'processing', label: 'En proceso' },
                  { key: 'completed', label: 'Emitidas' },
                  { key: 'failed', label: 'Errores' },
               ].map((f) => (
                  <button
                     key={f.key}
                     type="button"
                     onClick={() => setStatusFilter(f.key)}
                     className={`px-3 py-1 rounded-xl text-xs font-medium transition ${
                        statusFilter === f.key
                           ? 'bg-[var(--brand)] text-white shadow-xs font-semibold'
                           : 'bg-[var(--surface-1)] text-[var(--text-soft)] hover:bg-[var(--surface-2)]'
                     }`}
                  >
                     {f.label}
                  </button>
               ))}
            </div>

            <button
               type="button"
               onClick={() => {
                  setLoading(true);
                  loadData();
               }}
               className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] transition"
            >
               <ArrowPathIcon className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
               <span>Actualizar</span>
            </button>
         </div>

         {/* Tabla de Solicitudes */}
         <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-content)] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
               <table className="min-w-full text-xs text-left">
                  <thead className="bg-[var(--surface-2)] text-[var(--text-soft)] border-b border-[var(--border-subtle)]">
                     <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Tipo</th>
                        <th className="p-3">Glosa / Detalle</th>
                        <th className="p-3 text-right">Monto</th>
                        <th className="p-3">Folio SII</th>
                        <th className="p-3">Estado</th>
                        <th className="p-3 text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                     {requests.length === 0 ? (
                        <tr>
                           <td colSpan={8} className="p-8 text-center text-[var(--text-soft)]">
                              No hay solicitudes de boletas registradas para este filtro.
                           </td>
                        </tr>
                     ) : (
                        requests.map((r) => {
                           const isPending = r.status === 'pending';
                           const isProcessing = r.status === 'processing';
                           const isCompleted = r.status === 'completed';
                           const isFailed = r.status === 'failed';
                           const isMaybe = r.status === 'posiblemente_emitida';

                           return (
                              <tr key={r.id} className="hover:bg-[var(--surface-1)] transition">
                                 <td className="p-3 font-mono font-medium">#{r.id}</td>
                                 <td className="p-3 whitespace-nowrap text-[var(--text-soft)]">
                                    {r.created_at ? new Date(r.created_at).toLocaleString('es-CL') : '—'}
                                 </td>
                                 <td className="p-3">
                                    <span
                                       className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                          r.is_exempt
                                             ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                             : 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                       }`}
                                    >
                                       {r.is_exempt ? 'Exenta (41)' : 'Afecta (39)'}
                                    </span>
                                 </td>
                                 <td className="p-3">
                                    <div className="font-medium text-[var(--text-main)] truncate max-w-xs">
                                       {r.description || 'Venta'}
                                    </div>
                                    {r.customer_name && (
                                       <div className="text-[10px] text-[var(--text-soft)]">
                                          Receptor: {r.customer_name} {r.customer_rut ? `(${r.customer_rut})` : ''}
                                       </div>
                                    )}
                                 </td>
                                 <td className="p-3 text-right font-bold text-[var(--heading)]">
                                    {fmtCLP(r.amount)}
                                 </td>
                                 <td className="p-3 font-semibold text-[var(--brand)]">
                                    {r.folio ? `Folio #${r.folio}` : '—'}
                                 </td>
                                 <td className="p-3 whitespace-nowrap">
                                    {isPending && (
                                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 border border-amber-500/20">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                          En Cola
                                       </span>
                                    )}
                                    {isProcessing && (
                                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 border border-blue-500/20 animate-pulse">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                          Emitiendo en SII...
                                       </span>
                                    )}
                                    {isCompleted && (
                                       <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                                          <CheckCircleIcon className="w-3.5 h-3.5" />
                                          Emitida y Conciliada
                                       </span>
                                    )}
                                    {isFailed && (
                                       <span
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 border border-red-500/20"
                                          title={r.error_message}
                                       >
                                          <XCircleIcon className="w-3.5 h-3.5" />
                                          Error en SII
                                       </span>
                                    )}
                                    {isMaybe && (
                                       <span
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-orange-500/10 text-orange-600 border border-orange-500/20"
                                          title={r.error_message}
                                       >
                                          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
                                          Posiblemente emitida
                                       </span>
                                    )}
                                 </td>
                                 <td className="p-3 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-1.5">
                                       {r.pdf_path && (
                                          <a
                                             href={r.pdf_path}
                                             target="_blank"
                                             rel="noreferrer"
                                             className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] text-[var(--brand)] transition shadow-xs"
                                          >
                                             <ArrowDownTrayIcon className="w-3 h-3" />
                                             PDF
                                          </a>
                                       )}
                                       {(isPending || isFailed) && (
                                          <button
                                             type="button"
                                             disabled={cancellingId === r.id}
                                             onClick={() => handleCancel(r.id)}
                                             className="px-2.5 py-1 text-xs font-medium rounded-lg border border-red-500/30 text-red-600 hover:bg-red-500/10 transition disabled:opacity-50"
                                          >
                                             {cancellingId === r.id ? '...' : 'Cancelar'}
                                          </button>
                                       )}
                                    </div>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
   );
}
