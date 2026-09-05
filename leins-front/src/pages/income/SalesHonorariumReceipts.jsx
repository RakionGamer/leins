import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { useSearchParams } from 'react-router-dom';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import SiiSyncButton from 'components/SiiSyncButton';
import DateInput from 'components/DateInput';
import { listSiiDocuments } from '../../services/siiDocumentsApi';
import { getSiiDocumentTypeLabel } from '../../utils/siiConstants';
import {
   ArrowDownTrayIcon,
   ArrowPathIcon,
   BanknotesIcon,
   CalendarDaysIcon,
   DocumentTextIcon,
   HashtagIcon,
   IdentificationIcon,
   TagIcon,
} from '@heroicons/react/24/outline';

const DOC_TYPES = {
   received: '1002',
};

const TABS = [
   { key: 'received', label: 'Recibidas', operationType: 'EXPENSE', type: DOC_TYPES.received },
];

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = `${ctrl} appearance-none cursor-pointer`;
const btnCtrl = 'h-11 inline-flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand disabled:opacity-50 disabled:pointer-events-none';

const currencyFmt = new Intl.NumberFormat('es-CL', {
   style: 'currency',
   currency: 'CLP',
   maximumFractionDigits: 0,
});
const intFmt = new Intl.NumberFormat('es-CL');
const clp = (value) => currencyFmt.format(Number(value || 0));

function periodToYYYYMM({ month, year }) {
   return `${year}-${String(month).padStart(2, '0')}`;
}

function todayYYYYMM() {
   const d = new Date();
   return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function ViewModeToggle({ mode, onChange }) {
   const button = (key, label) => (
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
         {button('month', 'Por mes')}
         {button('range', 'Por rango')}
      </div>
   );
}

function SummaryCard({ label, value, Icon, tone = 'brand' }) {
   const toneClasses = {
      brand: 'bg-brand/10 text-brand',
      green: 'bg-green-500/10 text-green-600',
      blue: 'bg-blue-500/10 text-blue-600',
      amber: 'bg-amber-500/10 text-amber-600',
   };

   return (
      <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
         <div className={`p-3 rounded-xl ${toneClasses[tone] || toneClasses.brand}`}>
            <Icon className="w-6 h-6" />
         </div>
         <div>
            <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">{label}</div>
            <div className="text-xl font-bold text-heading">{value}</div>
         </div>
      </div>
   );
}

function MonthField({ value, onChange, disabled }) {
   return (
      <div className="space-y-1.5 w-full">
         <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Mes</label>
         <input disabled={disabled} type="month" className={ctrl} value={value || ''} onChange={(e) => onChange(e.target.value)} />
      </div>
   );
}

function DateRangeField({ from, to, onFrom, onTo, disabled }) {
   const invalid = from && to && new Date(to) < new Date(from);

   return (
      <div className="space-y-1.5 w-full">
         <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Rango de fechas</label>
         <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <DateInput disabled={disabled} className={ctrl} value={from || ''} onChange={onFrom} />
            <span className="hidden sm:inline text-text-soft font-medium shrink-0">-</span>
            <DateInput disabled={disabled} className={`${ctrl} ${invalid ? 'ring-2 ring-danger border-danger' : ''}`} value={to || ''} onChange={onTo} min={from || undefined} />
         </div>
      </div>
   );
}

function normalizeDocument(row) {
   const total = Number(row.total_amount || 0);
   const gross = Number(row.amount_net ?? row.net_amount ?? row.total_amount ?? 0);
   const withheld = Number(row.amount_tax_no_credit ?? row.tax_withheld ?? 0);

   return {
      id: row.id,
      entity_id: row.entity_id,
      issue_date: row.issue_date,
      folio: row.folio,
      doc_type_code: row.doc_type_code,
      doc_type: getSiiDocumentTypeLabel(row.doc_type_code),
      counterparty_rut: row.counterparty_rut,
      counterparty_name: row.counterparty_name,
      gross_amount: gross,
      tax_withheld: withheld,
      total_amount: total,
      source: row.source,
   };
}

export default function SalesHonorariumReceipts() {
   const { period } = usePeriod();
   const { entityId: activeEntityId, ready } = useEntityRequired();
   const [sp, setSp] = useSearchParams();

   const [activeTab, setActiveTab] = useState('received');
   const [mode, setMode] = useState(() => (sp.get('mode') === 'range' ? 'range' : 'month'));
   const [filterMonth, setFilterMonth] = useState(() => sp.get('month') || todayYYYYMM());
   const [fromDate, setFromDate] = useState(() => sp.get('from') || '');
   const [toDate, setToDate] = useState(() => sp.get('to') || '');
   const [sourceFilter, setSourceFilter] = useState(() => sp.get('source') || '');
   const [page, setPage] = useState(() => Math.max(1, Number(sp.get('page')) || 1));
   const [pageSize, setPageSize] = useState(() => {
      const size = Number(sp.get('limit'));
      return [20, 50, 100, 200].includes(size) ? size : 50;
   });
   const [sort, setSort] = useState(() => sp.get('sort') || 'issue_date');
   const [order, setOrder] = useState(() => sp.get('order') === 'asc' ? 'asc' : 'desc');

   const [rows, setRows] = useState([]);
   const [total, setTotal] = useState(0);
   const [totalPages, setTotalPages] = useState(1);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState('');
   const [refreshKey, setRefreshKey] = useState(0);
   const [exportingCsv, setExportingCsv] = useState(false);

   const activeConfig = useMemo(() => (
      TABS.find((tab) => tab.key === activeTab) || TABS[0]
   ), [activeTab]);

   const effectiveMonth = useMemo(() => (
      filterMonth || (period ? periodToYYYYMM(period) : todayYYYYMM())
   ), [filterMonth, period]);

   const rangeInvalid = mode === 'range' && fromDate && toDate && new Date(toDate) < new Date(fromDate);

   const loadDocuments = useCallback(async ({ pageOverride, limitOverride, signal } = {}) => {
      if (!ready || !activeEntityId || rangeInvalid) {
         return { rows: [], total: 0, totalPages: 1 };
      }

      const response = await listSiiDocuments({
         entityId: activeEntityId,
         operationType: activeConfig.operationType,
         type: activeConfig.type,
         source: sourceFilter || undefined,
         month: mode === 'month' ? effectiveMonth : undefined,
         from: mode === 'range' ? fromDate : undefined,
         to: mode === 'range' ? toDate : undefined,
         page: pageOverride || page,
         limit: limitOverride || pageSize,
         sort,
         order,
         signal,
      });

      return {
         rows: response.rows.map(normalizeDocument),
         total: response.total,
         totalPages: response.totalPages,
      };
   }, [activeConfig, activeEntityId, effectiveMonth, fromDate, mode, order, page, pageSize, rangeInvalid, ready, sort, sourceFilter, toDate]);

   useEffect(() => {
      if (!ready || !activeEntityId) {
         setRows([]);
         setTotal(0);
         setTotalPages(1);
         setLoading(false);
         setError('');
         return undefined;
      }

      if (rangeInvalid) {
         setRows([]);
         setTotal(0);
         setTotalPages(1);
         setLoading(false);
         setError('');
         return undefined;
      }

      const controller = new AbortController();
      setLoading(true);
      setError('');

      loadDocuments({ signal: controller.signal })
         .then((result) => {
            setRows(result.rows);
            setTotal(result.total);
            setTotalPages(Math.max(1, result.totalPages || 1));
         })
         .catch((err) => {
            if (err.name !== 'AbortError') setError(err.message || 'No se pudieron cargar las boletas de honorarios');
         })
         .finally(() => setLoading(false));

      return () => controller.abort();
   }, [activeEntityId, loadDocuments, rangeInvalid, ready, refreshKey]);

   useEffect(() => {
      const params = new URLSearchParams();
      params.set('tab', activeTab);
      params.set('mode', mode);
      params.set('sort', sort);
      params.set('order', order);
      params.set('page', String(page));
      params.set('limit', String(pageSize));
      if (activeEntityId) params.set('entity_id', String(activeEntityId));
      if (sourceFilter) params.set('source', sourceFilter);
      if (mode === 'month') params.set('month', effectiveMonth);
      if (mode === 'range') {
         if (fromDate) params.set('from', fromDate);
         if (toDate) params.set('to', toDate);
      }
      setSp(params, { replace: true });
   }, [activeEntityId, activeTab, effectiveMonth, fromDate, mode, order, page, pageSize, setSp, sort, sourceFilter, toDate]);

   const resetToFirstPage = () => setPage(1);

   const switchTab = (key) => {
      setActiveTab(key);
      resetToFirstPage();
   };

   const switchMode = (nextMode) => {
      setMode(nextMode);
      if (nextMode === 'month') {
         setFromDate('');
         setToDate('');
         if (!filterMonth) setFilterMonth(todayYYYYMM());
      } else {
         setFilterMonth('');
      }
      resetToFirstPage();
   };

   const clearFilters = () => {
      setMode('month');
      setFilterMonth(todayYYYYMM());
      setFromDate('');
      setToDate('');
      setSourceFilter('');
      setPageSize(50);
      resetToFirstPage();
   };

   const orderArrow = (o) => (o === 'asc' ? '↑' : '↓');
   const toggleSort = (field) => {
      setOrder((current) => (sort === field ? (current === 'asc' ? 'desc' : 'asc') : 'asc'));
      setSort(field);
      resetToFirstPage();
   };

   const summary = useMemo(() => rows.reduce((acc, row) => ({
      docs: acc.docs + 1,
      gross: acc.gross + Number(row.gross_amount || 0),
      withheld: acc.withheld + Number(row.tax_withheld || 0),
      total: acc.total + Number(row.total_amount || 0),
   }), { docs: 0, gross: 0, withheld: 0, total: 0 }), [rows]);

   const exportCSV = async () => {
      setExportingCsv(true);
      try {
         const pageLimit = 200;
         let currentPage = 1;
         let maxPage = 1;
         const allRows = [];

         do {
            const result = await loadDocuments({ pageOverride: currentPage, limitOverride: pageLimit });
            allRows.push(...result.rows);
            maxPage = Math.max(1, result.totalPages || 1);
            currentPage += 1;
         } while (currentPage <= maxPage);

         if (!allRows.length) return;

         const delimiter = ';';
         const csvEscape = (value) => {
            const text = String(value ?? '');
            return (text.includes(delimiter) || text.includes('"') || text.includes('\n'))
               ? `"${text.replace(/"/g, '""')}"`
               : text;
         };
         const header = ['Fecha', 'Folio', 'Tipo', 'Contraparte', 'RUT', 'Bruto_CLP', 'Retencion_CLP', 'Liquido_CLP', 'Origen'];
         const body = allRows.map((row) => [
            row.issue_date,
            row.folio,
            row.doc_type,
            row.counterparty_name || '',
            row.counterparty_rut || '',
            row.gross_amount,
            row.tax_withheld,
            row.total_amount,
            row.source || 'SII',
         ]);

         const csv = [header, ...body].map((line) => line.map(csvEscape).join(delimiter)).join('\r\n');
         const blob = new Blob([`\uFEFFsep=${delimiter}\r\n${csv}`], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const link = document.createElement('a');
         link.href = url;
         link.download = `boletas_honorarios_${activeTab}.csv`;
         link.click();
         URL.revokeObjectURL(url);
      } catch (err) {
         setError(err.message || 'No se pudo exportar CSV');
      } finally {
         setExportingCsv(false);
      }
   };

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   const start = total ? (page - 1) * pageSize + 1 : 0;
   const end = total ? Math.min(total, page * pageSize) : 0;
   const hasPrev = page > 1;
   const hasNext = page < totalPages;

   return (
      <div className="space-y-6">
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col gap-4 border-b border-border-subtle pb-5 md:flex-row md:items-center md:justify-between">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Boletas de honorarios</h2>
                  <p className="text-sm text-text-soft mt-1">Consulta boletas de honorarios recibidas desde el SII.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className={btnCtrl}>
                     <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                     Actualizar
                  </button>
                  <SiiSyncButton
                     type="honorarios"
                     label="Sincronizar recibidas"
                     directions="received"
                     onSyncSuccess={() => setRefreshKey((value) => value + 1)}
                  />
               </div>
            </div>

            <div className="mt-5 space-y-4">
               <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {TABS.length > 1 && (
                     <div className="inline-flex rounded-2xl bg-surface-2 p-1 ring-1 ring-border-subtle/60">
                        {TABS.map((tab) => (
                           <button
                              key={tab.key}
                              type="button"
                              onClick={() => switchTab(tab.key)}
                              className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${activeTab === tab.key ? 'bg-bg-content text-heading shadow-sm ring-1 ring-border-subtle' : 'text-text-soft hover:text-heading'}`}
                           >
                              {tab.label}
                           </button>
                        ))}
                     </div>
                  )}

                  <div className="flex items-center gap-3">
                     <button type="button" onClick={clearFilters} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50">
                        <ArrowPathIcon className="w-4 h-4" />
                        Limpiar filtros
                     </button>
                     <ViewModeToggle mode={mode} onChange={switchMode} />
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">ID Ent.</label>
                     <input disabled className={ctrl} type="text" value={activeEntityId || ''} placeholder="Selecciona entidad" />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Origen</label>
                     <select disabled={loading} className={selectCtrl} value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); resetToFirstPage(); }}>
                        <option value="">Todos</option>
                        <option value="SII">SII</option>
                        <option value="MANUAL">Manual</option>
                     </select>
                  </div>

                  <div className={mode === 'range' ? 'md:col-span-6' : 'md:col-span-5'}>
                     {mode === 'month' ? (
                        <MonthField value={effectiveMonth} onChange={(value) => { setFilterMonth(value); resetToFirstPage(); }} disabled={loading} />
                     ) : (
                        <DateRangeField
                           from={fromDate}
                           to={toDate}
                           onFrom={(value) => { setFromDate(value); resetToFirstPage(); }}
                           onTo={(value) => { setToDate(value); resetToFirstPage(); }}
                           disabled={loading}
                        />
                     )}
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Por pag.</label>
                     <select disabled={loading} className={selectCtrl} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 50); resetToFirstPage(); }}>
                        <option value={20}>20 filas</option>
                        <option value={50}>50 filas</option>
                        <option value={100}>100 filas</option>
                        <option value={200}>200 filas</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <SummaryCard label="Documentos" value={intFmt.format(summary.docs)} Icon={DocumentTextIcon} />
            <SummaryCard label="Bruto pagina" value={clp(summary.gross)} Icon={BanknotesIcon} tone="green" />
            <SummaryCard label="Retencion" value={clp(summary.withheld)} Icon={TagIcon} tone="amber" />
            <SummaryCard label="Liquido" value={clp(summary.total)} Icon={BanknotesIcon} tone="blue" />
         </div>

         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading && <div className="p-10 text-center text-brand font-medium animate-pulse">cargando boletas de honorarios...</div>}
            {error && <div className="p-10 text-center text-danger font-medium bg-danger/5">Error: {error}</div>}

            {!loading && !error && (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft">
                        <tr>
                           <th className={`p-4 font-semibold ${sort === 'issue_date' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 hover:text-brand transition" onClick={() => toggleSort('issue_date')}>
                                 <CalendarDaysIcon className="w-4 h-4" />
                                 Fecha {sort === 'issue_date' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold ${sort === 'folio' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 hover:text-brand transition" onClick={() => toggleSort('folio')}>
                                 <HashtagIcon className="w-4 h-4" />
                                 Folio {sort === 'folio' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold"><div className="flex items-center gap-2 justify-center"><TagIcon className="w-4 h-4" /> Tipo</div></th>
                           <th className="p-4 font-semibold"><div className="flex items-center gap-2"><IdentificationIcon className="w-4 h-4" /> Contraparte</div></th>
                           <th className="p-4 font-semibold text-right">Bruto</th>
                           <th className="p-4 font-semibold text-right">Retencion</th>
                           <th className={`p-4 font-semibold text-right ${sort === 'total_amount' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 justify-end w-full hover:text-brand transition" onClick={() => toggleSort('total_amount')}>
                                 Liquido {sort === 'total_amount' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold text-center">Origen</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {rows.length === 0 ? (
                           <tr>
                              <td colSpan={8} className="p-10 text-center text-text-soft italic">no se encontraron boletas de honorarios para los filtros aplicados.</td>
                           </tr>
                        ) : rows.map((row) => (
                           <tr key={row.id} className="hover:bg-brand/5 transition-colors">
                              <td className="p-4 whitespace-nowrap font-medium text-text-main">{row.issue_date || '-'}</td>
                              <td className="p-4 font-mono text-text-soft">{row.folio || '-'}</td>
                              <td className="p-4 text-center">
                                 <span className="inline-flex px-2 py-1 bg-surface-2 rounded-md font-mono text-xs font-semibold text-text-soft border border-border-subtle/50">
                                    {row.doc_type}
                                 </span>
                              </td>
                              <td className="p-4">
                                 <div className="font-medium text-text-main truncate max-w-[260px]">{row.counterparty_name || row.counterparty_rut || '-'}</div>
                                 {row.counterparty_name && row.counterparty_rut && (
                                    <div className="text-xs text-text-soft font-mono">{row.counterparty_rut}</div>
                                 )}
                              </td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(row.gross_amount)}</td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(row.tax_withheld)}</td>
                              <td className="p-4 text-right font-bold text-text-main">{clp(row.total_amount)}</td>
                              <td className="p-4 text-center">
                                 <span className="inline-flex rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand ring-1 ring-brand/20">
                                    {row.source || 'SII'}
                                 </span>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
         </div>

         {!loading && !error && total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm bg-bg-content p-4 rounded-3xl border border-border-subtle shadow-sm">
               <div className="text-text-soft font-medium">
                  Mostrando {intFmt.format(start)}-{intFmt.format(end)} de {intFmt.format(total)} - Pagina <span className="text-text-main font-bold">{intFmt.format(page)}</span> de {intFmt.format(totalPages)}
               </div>
               <div className="flex items-center gap-3">
                  <button type="button" onClick={exportCSV} disabled={exportingCsv || !total} className={btnCtrl}>
                     <ArrowDownTrayIcon className="w-5 h-5" />
                     {exportingCsv ? 'exportando...' : 'exportar csv'}
                  </button>
                  <div className="flex gap-1">
                     <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" onClick={() => setPage((value) => value - 1)} disabled={!hasPrev}>anterior</button>
                     <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" onClick={() => setPage((value) => value + 1)} disabled={!hasNext}>siguiente</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
