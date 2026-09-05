// src/pages/income/Receivables.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { useSearchParams } from 'react-router-dom';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import DateInput from 'components/DateInput';
import { listSiiDocuments, exportSiiDocumentsCsv } from '../../services/siiDocumentsApi';
import {
   DocumentDuplicateIcon,
   BanknotesIcon,
   ClockIcon,
   CurrencyDollarIcon,
   CalendarDaysIcon,
   HashtagIcon,
   IdentificationIcon,
   FunnelIcon,
   ArrowPathIcon,
   ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

const RECEIVABLE_DOC_TYPES = '33,34';

function periodToYYYYMM({ month, year }) {
   const m = String(month).padStart(2, '0');
   return `${year}-${m}`;
}

function todayYYYYMM() {
   const d = new Date();
   const m = String(d.getMonth() + 1).padStart(2, '0');
   return `${d.getFullYear()}-${m}`;
}

const currencyFmt = new Intl.NumberFormat('es-CL', {
   style: 'currency', currency: 'CLP', maximumFractionDigits: 0
});
const clp = (n) => currencyFmt.format(Number(n ?? 0));

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
}

// deriva el estado de pago de una factura a partir del total y el saldo pendiente
function invoiceStatus(totalAmount, remainingAmount) {
   const total = Number(totalAmount || 0);
   const remaining = Number(remainingAmount || 0);
   if (remaining <= 0) return 'paid';
   if (remaining < total) return 'partial';
   return 'pending';
}

const STATUS_LABEL = {
   paid: { label: 'Pagada', colorClass: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400' },
   partial: { label: 'Parcial', colorClass: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-400' },
   pending: { label: 'Pendiente', colorClass: 'bg-red-100 text-red-700 ring-red-200 dark:bg-red-900/30 dark:text-red-400' },
};

function ResumenPagina({ items }) {
   let invoiced = 0, collected = 0, pending = 0, pendingCount = 0;

   for (const r of items ?? []) {
      const total = Number(r.total_amount || 0);
      const remaining = Number(r.remaining_amount || 0);
      invoiced += total;
      collected += total - remaining;
      pending += remaining;
      if (remaining > 0) pendingCount += 1;
   }

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Facturado</div>
               <div className="text-xl font-bold text-heading">{clp(invoiced)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl"><BanknotesIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Cobrado</div>
               <div className="text-xl font-bold text-heading">{clp(collected)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><CurrencyDollarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Por Cobrar</div>
               <div className="text-xl font-bold text-brand">{clp(pending)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl"><ClockIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Facturas Pendientes</div>
               <div className="text-xl font-bold text-heading">{pendingCount}</div>
            </div>
         </div>
      </div>
   );
}

function MonthField({ value, onChange, disabled = false }) {
   return (
      <div className="space-y-1.5 w-full">
         <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Mes de Emisión</label>
         <input disabled={disabled} type="month" className={ctrl} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
   );
}

function DateRangeField({ from, to, onFrom, onTo, disabled = false }) {
   const invalid = from && to && new Date(to) < new Date(from);
   return (
      <div className="space-y-1.5 w-full">
         <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Rango de Fechas</label>
         <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <DateInput disabled={disabled} className={ctrl} value={from || ''} onChange={onFrom} />
            <span className="hidden sm:inline text-text-soft font-medium shrink-0">-</span>
            <DateInput disabled={disabled} className={`${ctrl} ${invalid ? 'ring-2 ring-danger border-danger' : ''}`} value={to || ''} onChange={onTo} min={from || undefined} />
         </div>
      </div>
   );
}

function ViewModeToggle({ mode, onChange }) {
   const btn = (key, label) => (
      <button
         type="button"
         onClick={() => onChange(key)}
         className={`h-9 px-4 text-sm font-medium rounded-xl transition ${mode === key ? 'bg-bg-content shadow ring-1 ring-border-subtle text-heading' : 'text-text-soft hover:text-heading'}`}
      >
         {label}
      </button>
   );
   return (
      <div className="inline-flex p-1 bg-surface-2 rounded-2xl ring-1 ring-border-subtle/40 items-center">
         {btn('month', 'Por mes')}
         {btn('range', 'Por rango')}
      </div>
   );
}

function useDebounced(value, delay = 300) {
   const [d, setD] = useState(value);
   useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay]);
   return d;
}

export default function Receivables() {
   const { period } = usePeriod();
   const { entityId: activeEntityId, ready } = useEntityRequired();
   const [sp, setSp] = useSearchParams();

   const [rows, setRows] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [exporting, setExporting] = useState(false);

   const dateFmt = useMemo(() => new Intl.DateTimeFormat('es-CL'), []);
   const fmtDate = (s) => (s ? dateFmt.format(new Date(s)) : '-');

   const orderArrow = (o) => (o === 'asc' ? '↑' : '↓');
   const intFmt = useMemo(() => new Intl.NumberFormat('es-CL'), []);
   const parsePosInt = (v, def) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def; };

   const [page, setPage] = useState(() => parsePosInt(sp.get('page'), 1));
   const allowedPageSizes = [20, 50, 100, 200];
   const [pageSize, setPageSize] = useState(() => { const n = Number(sp.get('limit')); return allowedPageSizes.includes(n) ? n : 50; });

   const [statusFilter, setStatusFilter] = useState(() => ['paid', 'pending'].includes(sp.get('status')) ? sp.get('status') : '');
   const [clientFilter, setClientFilter] = useState(() => sp.get('client') || '');
   const [mode, setMode] = useState(() => (sp.get('mode') === 'range' ? 'range' : 'month'));
   const [filterMonth, setFilterMonth] = useState(() => sp.get('month') || todayYYYYMM());
   const [fromDate, setFromDate] = useState(() => sp.get('from') || '');
   const [toDate, setToDate] = useState(() => sp.get('to') || '');
   const [entityId, setEntityId] = useState(() => sp.get('entity_id') || (activeEntityId ? String(activeEntityId) : ''));

   const ALLOWED_SORT = new Set(['issue_date', 'folio', 'total_amount', 'remaining_amount']);
   const ALLOWED_ORDER = new Set(['asc', 'desc']);
   const [sort, setSort] = useState(() => ALLOWED_SORT.has(sp.get('sort')) ? sp.get('sort') : 'issue_date');
   const [order, setOrder] = useState(() => ALLOWED_ORDER.has(sp.get('order')) ? sp.get('order') : 'desc');

   const [total, setTotal] = useState(0);
   const [totalPages, setTotalPages] = useState(1);
   const [hasPrev, setHasPrev] = useState(false);
   const [hasNext, setHasNext] = useState(false);

   const effectiveMonth = useMemo(() => filterMonth || (period ? periodToYYYYMM(period) : todayYYYYMM()), [filterMonth, period]);
   const debEntityId = useDebounced(entityId, 300);
   const debClientFilter = useDebounced(clientFilter, 300);

   const buildListParams = useCallback(({ pageOverride = page, limitOverride = pageSize, signal } = {}) => {
      const effectiveEntityId = debEntityId && /^\d+$/.test(String(debEntityId)) ? Number(debEntityId) : undefined;
      return {
         entityId: effectiveEntityId,
         operationType: 'INCOME',
         type: RECEIVABLE_DOC_TYPES,
         status: statusFilter || undefined,
         client: debClientFilter.trim() || undefined,
         month: mode === 'month' ? effectiveMonth : undefined,
         from: mode === 'range' ? (fromDate || undefined) : undefined,
         to: mode === 'range' ? (toDate || undefined) : undefined,
         page: pageOverride,
         limit: limitOverride,
         sort,
         order,
         signal,
      };
   }, [page, pageSize, sort, order, mode, effectiveMonth, fromDate, toDate, debEntityId, statusFilter, debClientFilter]);

   const rangeInvalid = mode === 'range' && fromDate && toDate && new Date(toDate) < new Date(fromDate);

   const handleExportCsv = async () => {
      setExporting(true);
      setErr(null);
      try {
         const { blob, filename } = await exportSiiDocumentsCsv(buildListParams());
         const url = window.URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = filename;
         document.body.appendChild(a);
         a.click();
         a.remove();
         window.URL.revokeObjectURL(url);
      } catch (e) {
         setErr(e.message || 'no se pudo exportar el listado');
      } finally {
         setExporting(false);
      }
   };

   const resetToFirstPage = () => setPage(1);

   const switchToMonth = () => { setMode('month'); setFromDate(''); setToDate(''); if (!filterMonth) setFilterMonth(todayYYYYMM()); resetToFirstPage(); };
   const switchToRange = () => { setMode('range'); setFilterMonth(''); resetToFirstPage(); };

   const handleClearFilters = () => {
      setEntityId(activeEntityId ? String(activeEntityId) : '');
      setStatusFilter(''); setClientFilter(''); setMode('month'); setFilterMonth(todayYYYYMM());
      setFromDate(''); setToDate(''); setPageSize(50); resetToFirstPage();
   };

   useEffect(() => {
      const nextEntity = activeEntityId ? String(activeEntityId) : '';
      if (nextEntity !== entityId) {
         setEntityId(nextEntity);
         setPage(1);
      }
   }, [activeEntityId, entityId]);

   useEffect(() => {
      if (!ready || !entityId) {
         setRows([]);
         setTotal(0);
         setTotalPages(1);
         setHasPrev(false);
         setHasNext(false);
         setErr(null);
         setLoading(false);
         return;
      }
      if (rangeInvalid) { setRows([]); setTotal(0); setHasPrev(false); setHasNext(false); setErr(null); setLoading(false); return; }
      const ctrl = new AbortController();
      setLoading(true); setErr(null);
      (async () => {
         try {
            const payload = await listSiiDocuments(buildListParams({ signal: ctrl.signal }));
            const mapped = payload.rows.map((it) => ({
               id: it.id,
               issue_date: it.issue_date,
               due_date: it.due_date,
               folio: it.folio,
               counterparty_rut: it.counterparty_rut,
               counterparty_name: it.counterparty_name,
               total_amount: Number(it.total_amount || 0),
               remaining_amount: Number(it.remaining_amount || 0),
            }));

            setRows(mapped);
            const totalPagesCalc = Number(payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? mapped.length) / pageSize)));
            setTotal(Number(payload.total ?? mapped.length));
            setTotalPages(totalPagesCalc);
            setHasPrev(page > 1);
            setHasNext(page < totalPagesCalc);
         } catch (e) {
            if (e.name !== 'AbortError') setErr(e.message || 'error');
         } finally {
            setLoading(false);
         }
      })();
      return () => ctrl.abort();
   }, [buildListParams, page, pageSize, rangeInvalid, ready, entityId]);

   useEffect(() => {
      const p = new URLSearchParams();
      if (statusFilter) p.set('status', statusFilter);
      if (clientFilter.trim()) p.set('client', clientFilter.trim());
      if (entityId) p.set('entity_id', String(entityId));
      p.set('mode', mode); p.set('sort', sort); p.set('order', order);
      if (mode === 'month') p.set('month', effectiveMonth);
      else { if (fromDate) p.set('from', fromDate); if (toDate) p.set('to', toDate); }
      p.set('page', String(page)); p.set('limit', String(pageSize));
      setSp(p, { replace: true });
   }, [statusFilter, clientFilter, entityId, mode, sort, order, effectiveMonth, fromDate, toDate, page, pageSize, setSp]);

   const toggleSort = (col) => {
      setOrder((s) => (sort === col ? (s === 'asc' ? 'desc' : 'asc') : 'asc'));
      setSort(col);
      setPage(1);
   };

   const start = total ? (page - 1) * pageSize + 1 : 0;
   const end = total ? Math.min(total, page * pageSize) : 0;
   const showingLabel = total ? `Mostrando ${intFmt.format(start)}-${intFmt.format(end)} de ${intFmt.format(total)}` : 'Sin resultados';

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   return (
      <div className="space-y-6">
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Cuentas por Cobrar</h2>
                  <p className="text-sm text-text-soft mt-1">Facturas de venta pagadas y pendientes, según las conciliaciones bancarias.</p>
               </div>
               <button
                  onClick={handleExportCsv}
                  disabled={exporting || !entityId || rangeInvalid}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand bg-brand/10 hover:bg-brand hover:text-white rounded-2xl transition-colors disabled:opacity-50 disabled:pointer-events-none shrink-0"
               >
                  <ArrowDownTrayIcon className="w-4 h-4" /> {exporting ? 'Descargando...' : 'Descargar CSV'}
               </button>
            </div>

            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                     <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
                  </div>
                  <div className="flex items-center gap-3">
                     <button onClick={handleClearFilters} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50">
                        <ArrowPathIcon className="w-4 h-4" /> Limpiar Filtros
                     </button>
                     <ViewModeToggle mode={mode} onChange={(k) => k === 'month' ? switchToMonth() : switchToRange()} />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-3">
                     <label htmlFor="clientFilter" className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Cliente</label>
                     <input
                        id="clientFilter"
                        disabled={loading}
                        className={ctrl}
                        type="text"
                        placeholder="RUT o razon social"
                        value={clientFilter}
                        onChange={(e) => { setClientFilter(e.target.value); resetToFirstPage(); }}
                     />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Estado</label>
                     <select disabled={loading} className={selectCtrl} value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); resetToFirstPage(); }}>
                        <option value="">Todas</option>
                        <option value="pending">Pendientes</option>
                        <option value="paid">Pagadas</option>
                     </select>
                  </div>

                  <div className="md:col-span-5">
                     {mode === 'month' ? (
                        <MonthField value={filterMonth} onChange={(v) => { setFilterMonth(v); resetToFirstPage(); }} disabled={loading} />
                     ) : (
                        <DateRangeField from={fromDate} to={toDate} onFrom={(v) => { setFromDate(v); resetToFirstPage(); }} onTo={(v) => { setToDate(v); resetToFirstPage(); }} disabled={loading} />
                     )}
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Por Pág.</label>
                     <select disabled={loading} className={selectCtrl} value={pageSize} onChange={(e) => { setPageSize(Math.min(200, Number(e.target.value) || 50)); resetToFirstPage(); }}>
                        <option value={20}>20 filas</option>
                        <option value={50}>50 filas</option>
                        <option value={100}>100 filas</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         <ResumenPagina items={rows} />

         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading && <div className="p-10 text-center text-brand font-medium animate-pulse">cargando registros...</div>}
            {err && <div className="p-10 text-center text-danger font-medium bg-danger/5">Error: {err}</div>}

            {!loading && !err && (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft">
                        <tr>
                           <th className={`p-4 font-semibold ${sort === 'issue_date' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 hover:text-brand transition" onClick={() => toggleSort('issue_date')}>
                                 <CalendarDaysIcon className="w-4 h-4" /> Emisión {sort === 'issue_date' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold ${sort === 'folio' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 hover:text-brand transition" onClick={() => toggleSort('folio')}>
                                 <HashtagIcon className="w-4 h-4" /> Folio {sort === 'folio' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold"><div className="flex items-center gap-2"><IdentificationIcon className="w-4 h-4" /> Cliente</div></th>
                           <th className="p-4 font-semibold">Vencimiento</th>
                           <th className={`p-4 font-semibold text-right ${sort === 'total_amount' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 justify-end w-full hover:text-brand transition" onClick={() => toggleSort('total_amount')}>
                                 Total {sort === 'total_amount' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold text-right ${sort === 'remaining_amount' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 justify-end w-full hover:text-brand transition" onClick={() => toggleSort('remaining_amount')}>
                                 Saldo pendiente {sort === 'remaining_amount' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold text-center">Estado</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {rows.length === 0 ? (
                           <tr><td colSpan={7} className="p-10 text-center text-text-soft italic">no se encontraron facturas para los filtros aplicados.</td></tr>
                        ) : rows.map((r) => {
                           const status = invoiceStatus(r.total_amount, r.remaining_amount);
                           const { label, colorClass } = STATUS_LABEL[status];
                           return (
                              <tr key={r.id} className="hover:bg-brand/5 transition-colors">
                                 <td className="p-4 whitespace-nowrap font-medium text-text-main">{fmtDate(r.issue_date)}</td>
                                 <td className="p-4 font-mono text-text-soft">{r.folio || '-'}</td>
                                 <td className="p-4 truncate max-w-[220px] text-text-main font-medium">{r.counterparty_name || r.counterparty_rut || '-'}</td>
                                 <td className="p-4 whitespace-nowrap text-text-soft">{fmtDate(r.due_date)}</td>
                                 <td className="p-4 text-right font-bold text-text-main">{clp(r.total_amount)}</td>
                                 <td className="p-4 text-right font-mono text-text-soft">{clp(r.remaining_amount)}</td>
                                 <td className="p-4 text-center"><Pill colorClass={colorClass}>{label}</Pill></td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </div>

         {!loading && !err && total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm bg-bg-content p-4 rounded-3xl border border-border-subtle shadow-sm">
               <div className="text-text-soft font-medium">
                  {showingLabel} - Página <span className="text-text-main font-bold">{intFmt.format(page)}</span> de {intFmt.format(totalPages)}
               </div>
               <div className="flex gap-1">
                  <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" onClick={() => setPage(p => p - 1)} disabled={!hasPrev}>anterior</button>
                  <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" onClick={() => setPage(p => p + 1)} disabled={!hasNext}>siguiente</button>
               </div>
            </div>
         )}
      </div>
   );
}
