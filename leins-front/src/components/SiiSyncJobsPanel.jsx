import { useCallback, useEffect, useMemo, useState } from 'react';
import {
   ArrowPathIcon,
   CheckCircleIcon,
   ClockIcon,
   ExclamationTriangleIcon,
   EyeIcon,
   InformationCircleIcon,
   XCircleIcon,
} from '@heroicons/react/24/outline';
import { useEntity } from '../context/EntityContext';
import { listSiiSyncJobs, startSiiSync } from '../services/entitiesApi';
import Modal from './Modal';
import Tooltip from './Tooltip';
import { toast } from './Toaster';

const TYPE_LABELS = {
   boletas: 'Boletas',
   invoices: 'Compras',
   'sales-invoices': 'Facturas de venta',
   honorarios: 'Boletas de honorarios',
};

const STATUS_CONFIG = {
   pending: {
      label: 'Pendiente',
      Icon: ClockIcon,
      className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:ring-amber-700/40',
   },
   running: {
      label: 'En proceso',
      Icon: ArrowPathIcon,
      className: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:ring-blue-700/40',
   },
   success: {
      label: 'Finalizada',
      Icon: CheckCircleIcon,
      className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:ring-emerald-700/40',
   },
   failed: {
      label: 'Fallida',
      Icon: XCircleIcon,
      className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/20 dark:text-red-300 dark:ring-red-700/40',
   },
};

const STATUS_FILTERS = [
   { key: 'all', label: 'Todos' },
   { key: 'active', label: 'En proceso' },
   { key: 'success', label: 'Finalizadas' },
   { key: 'failed', label: 'Fallidas' },
];

function formatDate(value) {
   if (!value) return '-';
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return '-';

   return new Intl.DateTimeFormat('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
   }).format(date);
}

function formatPeriod(job) {
   if (!job?.period_year) return '-';
   if (!job.period_month) return `${job.period_year} completo`;
   return `${job.period_year}-${String(job.period_month).padStart(2, '0')}`;
}

function parseSkipReasons(value) {
   if (!value) return {};

   const parsed = typeof value === 'string'
      ? (() => {
         try {
            return JSON.parse(value);
         } catch {
            return {};
         }
      })()
      : value;

   return parsed && typeof parsed === 'object' ? parsed : {};
}

function formatSkipReasons(value) {
   const parsed = parseSkipReasons(value);

   return Object.entries(parsed)
      .filter(([, count]) => Number(count) > 0)
      .map(([reason, count]) => `${reason}: ${count}`)
      .join(', ');
}

function StatusBadge({ status }) {
   const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
   const Icon = config.Icon;

   return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${config.className}`}>
         <Icon className={`h-4 w-4 ${status === 'running' ? 'animate-spin' : ''}`} />
         {config.label}
      </span>
   );
}

function Metric({ label, value }) {
   return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-text-soft ring-1 ring-border-subtle/60">
         <span>{label}</span>
         <span className="font-bold text-text-main">{Number(value || 0).toLocaleString('es-CL')}</span>
      </span>
   );
}

function getRequesterLabel(job) {
   const requester = job?.requester;
   if (!requester) return job?.requested_by ? `ID ${job.requested_by}` : 'Sistema';

   const fullName = [requester.name, requester.last_name].filter(Boolean).join(' ').trim();
   return fullName || requester.username || requester.email || `ID ${requester.id}`;
}

function getRequesterDetail(job) {
   const requester = job?.requester;
   if (!requester) return job?.requested_by ? `ID ${job.requested_by}` : 'Sistema';

   const main = getRequesterLabel(job);
   const email = requester.email ? ` - ${requester.email}` : '';
   return `${main}${email}`;
}

function DetailItem({ label, value }) {
   return (
      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-3">
         <div className="text-xs font-semibold uppercase tracking-wide text-text-soft">{label}</div>
         <div className="mt-1 break-words text-sm font-semibold text-text-main">{value || '-'}</div>
      </div>
   );
}

function LatestSummaryCard({ type, job }) {
   return (
      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
         <div className="flex items-start justify-between gap-3">
            <div>
               <div className="text-sm font-bold text-heading">{TYPE_LABELS[type] || type}</div>
               <div className="mt-1 text-xs text-text-soft">
                  {job ? `Última carga: ${formatDate(job.finished_at || job.started_at || job.created_at || job.createdAt)}` : 'Sin registros'}
               </div>
            </div>
            {job && <StatusBadge status={job.status} />}
         </div>
         <div className="mt-3 flex flex-wrap gap-2">
            <Metric label="Nuevas" value={job?.rows_inserted} />
            <Metric label="Actualizadas" value={job?.rows_updated} />
            <Metric label="Omitidas" value={job?.rows_skipped} />
         </div>
      </div>
   );
}

function JobDetailModal({ job, onClose }) {
   const skipReasons = Object.entries(parseSkipReasons(job?.skip_reasons_json))
      .filter(([, count]) => Number(count) > 0);

   return (
      <Modal isOpen={Boolean(job)} onClose={onClose} title={job ? `Detalle job #${job.id}` : 'Detalle job'} maxWidth="max-w-4xl">
         {job && (
            <div className="space-y-5">
               <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <DetailItem label="Tipo" value={TYPE_LABELS[job.sync_type] || job.sync_type} />
                  <DetailItem label="Periodo" value={formatPeriod(job)} />
                  <DetailItem label="Inicio" value={formatDate(job.started_at || job.created_at || job.createdAt)} />
                  <DetailItem label="Fin" value={formatDate(job.finished_at)} />
                  <DetailItem label="Solicitado por" value={getRequesterDetail(job)} />
               </div>

               <div className="rounded-2xl border border-border-subtle bg-bg-content p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                     <h4 className="text-sm font-bold text-heading">Resultado</h4>
                     <StatusBadge status={job.status} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                     <Metric label="Leídas" value={job.rows_read} />
                     <Metric label="Procesadas" value={job.rows_processed} />
                     <Metric label="Nuevas" value={job.rows_inserted} />
                     <Metric label="Actualizadas" value={job.rows_updated} />
                     <Metric label="Omitidas" value={job.rows_skipped} />
                  </div>
               </div>

               <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                     <h4 className="text-sm font-bold text-heading">Motivos de omisión</h4>
                     {skipReasons.length ? (
                        <div className="mt-3 space-y-2">
                           {skipReasons.map(([reason, count]) => (
                              <div key={reason} className="flex items-center justify-between gap-3 rounded-xl bg-bg-content px-3 py-2 text-sm">
                                 <span className="font-medium text-text-main">{reason}</span>
                                 <span className="font-bold text-text-soft">{Number(count).toLocaleString('es-CL')}</span>
                              </div>
                           ))}
                        </div>
                     ) : (
                        <p className="mt-3 text-sm text-text-soft">Sin omisiones registradas.</p>
                     )}
                  </div>

                  <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4">
                     <h4 className="text-sm font-bold text-heading">Error</h4>
                     {job.error_message ? (
                        <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-xl bg-danger/5 p-3 text-xs font-medium leading-relaxed text-danger">
                           {job.error_message}
                        </pre>
                     ) : (
                        <p className="mt-3 text-sm text-text-soft">Sin error registrado.</p>
                     )}
                  </div>
               </div>
            </div>
         )}
      </Modal>
   );
}

export default function SiiSyncJobsPanel({
   title = 'Sincronizaciones SII',
   types = [],
   limit = 8,
   refreshKey = 0,
}) {
   const { entityId } = useEntity();
   const [items, setItems] = useState([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [tick, setTick] = useState(0);
   const [selectedJob, setSelectedJob] = useState(null);
   const [retryingId, setRetryingId] = useState(null);
   const [statusFilter, setStatusFilter] = useState('all');

   const typesKey = Array.isArray(types) ? types.join('|') : '';
   const selectedTypes = useMemo(() => typesKey.split('|').filter(Boolean), [typesKey]);
   const hasRunning = items.some((item) => item.status === 'running' || item.status === 'pending');
   const summaryTypes = useMemo(() => {
      if (selectedTypes.length) return selectedTypes;
      return [...new Set(items.map((item) => item.sync_type).filter(Boolean))];
   }, [items, selectedTypes]);
   const latestByType = useMemo(() => summaryTypes.map((type) => ({
      type,
      job: items.find((item) => item.sync_type === type) || null,
   })), [items, summaryTypes]);
   const visibleItems = useMemo(() => {
      if (statusFilter === 'active') {
         return items.filter((item) => item.status === 'pending' || item.status === 'running');
      }
      if (statusFilter === 'success' || statusFilter === 'failed') {
         return items.filter((item) => item.status === statusFilter);
      }
      return items;
   }, [items, statusFilter]);

   const loadJobs = useCallback(async ({ signal } = {}) => {
      if (!entityId) {
         setItems([]);
         return;
      }

      setLoading(true);
      setError('');

      try {
         const requests = selectedTypes.length
            ? selectedTypes.map((type) => listSiiSyncJobs({ entityId, type, limit, signal }))
            : [listSiiSyncJobs({ entityId, limit, signal })];

         const responses = await Promise.all(requests);
         const merged = responses
            .flatMap((response) => response.items)
            .sort((a, b) => new Date(b.created_at || b.createdAt || 0) - new Date(a.created_at || a.createdAt || 0))
            .slice(0, limit);

         setItems(merged);
      } catch (err) {
         if (err.name !== 'AbortError') {
            setError(err.message || 'No se pudo cargar el historial');
         }
      } finally {
         setLoading(false);
      }
   }, [entityId, limit, selectedTypes]);

   useEffect(() => {
      const controller = new AbortController();
      loadJobs({ signal: controller.signal });
      return () => controller.abort();
   }, [loadJobs, refreshKey, tick]);

   useEffect(() => {
      if (!hasRunning) return undefined;
      const id = setInterval(() => setTick((value) => value + 1), 10000);
      return () => clearInterval(id);
   }, [hasRunning]);

   const retryJob = async (job) => {
      if (!job || !entityId) return;

      setRetryingId(job.id);
      try {
         const result = await startSiiSync({
            entityId,
            year: job.period_year,
            month: job.period_month ? String(job.period_month).padStart(2, '0') : 'ALL',
            type: job.sync_type,
         });

         toast({
            type: result?.duplicated ? 'warning' : 'info',
            title: result?.duplicated ? 'Proceso ya iniciado' : 'Reintento iniciado',
            message: result?.duplicated
               ? `Ya existe una sincronización en proceso. Job ${result.jobId}.`
               : `Nuevo job ${result.jobId} creado desde el reintento.`,
         });
         setTick((value) => value + 1);
      } catch (err) {
         toast({ type: 'error', title: 'No se pudo reintentar', message: err.message });
      } finally {
         setRetryingId(null);
      }
   };

   if (!entityId) return null;

   return (
      <>
      <JobDetailModal job={selectedJob} onClose={() => setSelectedJob(null)} />
      <div className="rounded-3xl border border-border-subtle bg-bg-content shadow-sm">
         <div className="flex flex-col gap-3 border-b border-border-subtle p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
               <h3 className="text-lg font-bold text-heading">{title}</h3>
               <p className="mt-1 text-sm text-text-soft">Últimos procesos ejecutados para la entidad activa.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
               <div className="inline-flex rounded-2xl bg-surface-2 p-1 ring-1 ring-border-subtle/60">
                  {STATUS_FILTERS.map((filter) => (
                     <button
                        key={filter.key}
                        type="button"
                        onClick={() => setStatusFilter(filter.key)}
                        className={`h-8 rounded-xl px-3 text-xs font-semibold transition ${statusFilter === filter.key ? 'bg-bg-content text-heading shadow-sm ring-1 ring-border-subtle' : 'text-text-soft hover:text-heading'}`}
                     >
                        {filter.label}
                     </button>
                  ))}
               </div>
               <button
                  type="button"
                  onClick={() => setTick((value) => value + 1)}
                  disabled={loading}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-border-subtle bg-surface-1 px-3 text-sm font-semibold text-text-main transition hover:bg-surface-2 hover:text-brand disabled:opacity-50"
               >
                  <ArrowPathIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Actualizar
               </button>
            </div>
         </div>

         {!error && latestByType.length > 0 && (
            <div className="grid grid-cols-1 gap-3 border-b border-border-subtle p-4 lg:grid-cols-2">
               {latestByType.map(({ type, job }) => (
                  <LatestSummaryCard key={type} type={type} job={job} />
               ))}
            </div>
         )}

         {error && (
            <div className="m-4 flex items-center gap-2 rounded-2xl border border-danger/30 bg-danger/5 p-3 text-sm font-medium text-danger">
               <ExclamationTriangleIcon className="h-5 w-5 shrink-0" />
               {error}
            </div>
         )}

         {!error && !loading && visibleItems.length === 0 && (
            <div className="p-6 text-sm text-text-soft">
               {items.length === 0 ? 'Aún no hay sincronizaciones registradas.' : 'No hay sincronizaciones para el filtro seleccionado.'}
            </div>
         )}

         {!error && (loading || visibleItems.length > 0) && (
            <div className="overflow-x-auto">
               <table className="min-w-full text-left text-sm">
                  <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-text-soft">
                     <tr>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Tipo</th>
                        <th className="px-4 py-3">Periodo</th>
                        <th className="px-4 py-3">Métricas</th>
                        <th className="px-4 py-3">Inicio</th>
                        <th className="px-4 py-3">Fin</th>
                        <th className="px-4 py-3">Solicitado por</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/60">
                     {loading && visibleItems.length === 0 ? (
                        <tr>
                           <td colSpan={8} className="px-4 py-6 text-center text-brand">Cargando historial...</td>
                        </tr>
                     ) : visibleItems.map((job) => {
                        const skipReasons = formatSkipReasons(job.skip_reasons_json);
                        const errorText = job.error_message || '';

                        return (
                           <tr key={job.id} className="hover:bg-brand/5">
                              <td className="px-4 py-3">
                                 <div className="flex items-center gap-2">
                                    <StatusBadge status={job.status} />
                                    {errorText && (
                                       <Tooltip content={errorText} position="right">
                                          <InformationCircleIcon className="h-4 w-4 text-danger" />
                                       </Tooltip>
                                    )}
                                 </div>
                              </td>
                              <td className="px-4 py-3 font-semibold text-text-main">{TYPE_LABELS[job.sync_type] || job.sync_type}</td>
                              <td className="px-4 py-3 font-mono text-text-soft">{formatPeriod(job)}</td>
                              <td className="px-4 py-3">
                                 <div className="flex min-w-[360px] flex-wrap gap-2">
                                    <Metric label="Leídas" value={job.rows_read} />
                                    <Metric label="Procesadas" value={job.rows_processed} />
                                    <Metric label="Nuevas" value={job.rows_inserted} />
                                    <Metric label="Actualizadas" value={job.rows_updated} />
                                    <Tooltip content={skipReasons || 'Sin omisiones registradas'} position="top">
                                       <span>
                                          <Metric label="Omitidas" value={job.rows_skipped} />
                                       </span>
                                    </Tooltip>
                                 </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-text-soft">{formatDate(job.started_at || job.created_at || job.createdAt)}</td>
                              <td className="px-4 py-3 whitespace-nowrap text-text-soft">{formatDate(job.finished_at)}</td>
                              <td className="px-4 py-3">
                                 <Tooltip content={getRequesterDetail(job)} position="top">
                                    <span className="inline-flex max-w-[160px] truncate text-sm font-semibold text-text-main">
                                       {getRequesterLabel(job)}
                                    </span>
                                 </Tooltip>
                              </td>
                              <td className="px-4 py-3 text-center">
                                 <div className="flex items-center justify-center gap-2">
                                    {job.status === 'failed' && (
                                       <Tooltip content="Reintentar sincronización" position="left">
                                          <button
                                             type="button"
                                             onClick={() => retryJob(job)}
                                             disabled={retryingId === job.id}
                                             className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle bg-surface-1 text-text-soft transition hover:bg-brand/10 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50"
                                          >
                                             <ArrowPathIcon className={`h-4 w-4 ${retryingId === job.id ? 'animate-spin' : ''}`} />
                                          </button>
                                       </Tooltip>
                                    )}
                                    <Tooltip content="Ver detalle del job" position="left">
                                       <button
                                          type="button"
                                          onClick={() => setSelectedJob(job)}
                                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-subtle bg-surface-1 text-text-soft transition hover:bg-brand/10 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
                                       >
                                          <EyeIcon className="h-4 w-4" />
                                       </button>
                                    </Tooltip>
                                 </div>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>
            </div>
         )}
      </div>
      </>
   );
}
