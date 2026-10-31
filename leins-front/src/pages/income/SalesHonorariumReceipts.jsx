// src/pages/income/SalesHonorariumReceipts.jsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { useSearchParams } from 'react-router-dom';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import SiiSyncButton from 'components/SiiSyncButton';
import DateInput from 'components/DateInput';
import { listSiiDocuments } from '../../services/siiDocumentsApi';
import DocumentReconcileModal from '../../components/bank/DocumentReconcileModal';
import QuickClassifyModal from '../../components/accounting/QuickClassifyModal';
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
   FunnelIcon,
   MagnifyingGlassIcon,
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

function useDebounced(value, delay = 300) {
   const [debounced, setDebounced] = useState(value);
   useEffect(() => {
      const handler = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(handler);
   }, [value, delay]);
   return debounced;
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
         <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Mes de Operación</label>
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
      is_reconciled: row.is_reconciled,
      reconciliation_status: row.reconciliation_status,
      remaining_amount: row.remaining_amount,
      is_classified: row.is_classified,
      is_exception: row.is_exception,
      accounting_account_id: row.accounting_account_id,
      classification_status: row.classification_status,
      accounting_account: row.accounting_account,
      is_centralized: row.is_centralized,
      centralization_status: row.centralization_status,
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
   const [searchQuery, setSearchQuery] = useState(() => sp.get('q') || '');
   const debSearchQuery = useDebounced(searchQuery, 300);
   const [centralizationFilter, setCentralizationFilter] = useState(() => sp.get('centralization') || 'all');

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
   const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
   const [documentToReconcile, setDocumentToReconcile] = useState(null);
   const [classifyModalOpen, setClassifyModalOpen] = useState(false);
   const [documentToClassify, setDocumentToClassify] = useState(null);

   const handleOpenReconcile = (doc) => {
      setDocumentToReconcile(doc);
      setReconcileModalOpen(true);
   };

   const handleQuickClassify = (doc) => {
      setDocumentToClassify(doc);
      setClassifyModalOpen(true);
   };

   const reloadData = () => setRefreshKey((k) => k + 1);

   const dateFmt = useMemo(() => new Intl.DateTimeFormat('es-CL'), []);
   const fmtDate = (s) => (s ? dateFmt.format(new Date(s)) : '');

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

      let reconciliationStatus = undefined;
      let classificationStatus = undefined;
      let centralizationStatus = undefined;

      if (centralizationFilter === 'unreconciled') reconciliationStatus = 'unreconciled';
      else if (centralizationFilter === 'unclassified') classificationStatus = 'unclassified';
      else if (centralizationFilter === 'pending') centralizationStatus = 'pending';
      else if (centralizationFilter === 'centralized') centralizationStatus = 'centralized';

      const response = await listSiiDocuments({
         entityId: activeEntityId,
         operationType: activeConfig.operationType,
         type: activeConfig.type,
         q: debSearchQuery?.trim() || undefined,
         source: sourceFilter || undefined,
         month: mode === 'month' ? effectiveMonth : undefined,
         from: mode === 'range' ? fromDate : undefined,
         to: mode === 'range' ? toDate : undefined,
         reconciliationStatus,
         classificationStatus,
         centralizationStatus,
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
   }, [activeConfig, activeEntityId, centralizationFilter, debSearchQuery, effectiveMonth, fromDate, mode, order, page, pageSize, rangeInvalid, ready, sort, sourceFilter, toDate]);

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
      if (searchQuery) params.set('q', searchQuery);
      if (centralizationFilter && centralizationFilter !== 'all') params.set('centralization', centralizationFilter);
      if (mode === 'month') params.set('month', effectiveMonth);
      if (mode === 'range') {
         if (fromDate) params.set('from', fromDate);
         if (toDate) params.set('to', toDate);
      }
      setSp(params, { replace: true });
   }, [activeEntityId, activeTab, centralizationFilter, effectiveMonth, fromDate, mode, order, page, pageSize, searchQuery, setSp, sort, sourceFilter, toDate]);

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
      setSearchQuery('');
      setCentralizationFilter('all');
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
         const header = ['Fecha', 'Folio', 'Tipo', 'RUT', 'Razon_Social', 'Bruto_CLP', 'Retencion_CLP', 'Liquido_CLP', 'Estado_Pago', 'Clasificacion', 'Origen'];
         const body = allRows.map((row) => [
            row.issue_date || '',
            row.folio || '',
            row.doc_type || '',
            row.counterparty_rut || '',
            row.counterparty_name || '',
            row.gross_amount,
            row.tax_withheld,
            row.total_amount,
            row.is_reconciled ? 'Pagado' : 'Sin conciliar',
            row.accounting_account?.name || (row.is_classified ? 'Clasificado' : 'Sin clasificar'),
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
         <DocumentReconcileModal
            isOpen={reconcileModalOpen}
            onClose={() => setReconcileModalOpen(false)}
            document={documentToReconcile}
            entityId={activeEntityId}
            onSuccess={reloadData}
         />

         <QuickClassifyModal
            isOpen={classifyModalOpen}
            onClose={() => setClassifyModalOpen(false)}
            document={documentToClassify}
            entityId={activeEntityId}
            onSuccess={reloadData}
         />

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
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                     <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
                  </div>

                  <div className="flex items-center gap-3">
                     <button type="button" onClick={clearFilters} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50">
                        <ArrowPathIcon className="w-4 h-4" />
                        Limpiar filtros
                     </button>
                     <ViewModeToggle mode={mode} onChange={switchMode} />
                  </div>
               </div>

               <div className="bg-surface-1 p-4 rounded-2xl border border-border-subtle/50 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                     <div className="space-y-1.5 md:col-span-1">
                        <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider truncate" title="ID Entidad">ID Ent.</label>
                        <input disabled className={ctrl} type="text" value={activeEntityId || ''} placeholder="Entidad" />
                     </div>

                     <div className="space-y-1.5 md:col-span-3">
                        <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Buscar</label>
                        <div className="relative">
                           <input
                              type="text"
                              className={`${ctrl} pl-9`}
                              placeholder="Folio, RUT o Razón Social..."
                              value={searchQuery}
                              onChange={(e) => { setSearchQuery(e.target.value); resetToFirstPage(); }}
                              disabled={loading}
                           />
                           <MagnifyingGlassIcon className="w-4 h-4 text-text-soft absolute left-3 top-3.5" />
                        </div>
                     </div>

                     <div className="space-y-1.5 md:col-span-2">
                        <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Origen</label>
                        <select disabled={loading} className={selectCtrl} value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); resetToFirstPage(); }}>
                           <option value="">Todos</option>
                           <option value="SII">SII</option>
                           <option value="MANUAL">Manual</option>
                        </select>
                     </div>

                     <div className={mode === 'range' ? 'md:col-span-4' : 'md:col-span-4'}>
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
                        <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Por pág.</label>
                        <select disabled={loading} className={selectCtrl} value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value) || 50); resetToFirstPage(); }}>
                           <option value={20}>20 filas</option>
                           <option value={50}>50 filas</option>
                           <option value={100}>100 filas</option>
                           <option value={200}>200 filas</option>
                        </select>
                     </div>
                  </div>

                  {/* Filtro de Centralización */}
                  <div className="pt-3 border-t border-border-subtle/50 flex flex-wrap items-center gap-3">
                     <span className="text-xs font-semibold text-text-soft uppercase tracking-wider">Centralización:</span>
                     <div className="inline-flex p-1 bg-surface-2 rounded-2xl ring-1 ring-border-subtle/40 items-center gap-1 text-xs font-medium">
                        {[
                           { key: 'all', label: 'Todos' },
                           { key: 'unreconciled', label: 'Sin conciliar' },
                           { key: 'unclassified', label: 'Sin clasificar' },
                           { key: 'pending', label: 'Pendientes' },
                        ].map((f) => (
                           <button
                              key={f.key}
                              type="button"
                              onClick={() => { setCentralizationFilter(f.key); resetToFirstPage(); }}
                              className={`px-3 py-1.5 rounded-xl transition ${
                                 centralizationFilter === f.key
                                    ? 'bg-bg-content shadow ring-1 ring-border-subtle text-brand font-semibold'
                                    : 'text-text-soft hover:text-heading'
                              }`}
                           >
                              {f.label}
                           </button>
                        ))}
                     </div>
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
                              <button type="button" className="flex items-center gap-1 hover:text-brand transition" onClick={() => toggleSort('issue_date')}>
                                 Fecha {sort === 'issue_date' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold ${sort === 'folio' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-1 hover:text-brand transition" onClick={() => toggleSort('folio')}>
                                 Folio {sort === 'folio' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold text-center ${sort === 'doc_type_code' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center justify-center gap-1 w-full hover:text-brand transition" onClick={() => toggleSort('doc_type_code')}>
                                 Tipo {sort === 'doc_type_code' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold ${sort === 'counterparty_rut' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-1 hover:text-brand transition" onClick={() => toggleSort('counterparty_rut')}>
                                 RUT {sort === 'counterparty_rut' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold ${sort === 'counterparty_name' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-1 hover:text-brand transition" onClick={() => toggleSort('counterparty_name')}>
                                 Razón Social / Profesional {sort === 'counterparty_name' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold text-right ${sort === 'amount_net' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-1 justify-end w-full hover:text-brand transition" onClick={() => toggleSort('amount_net')}>
                                 Bruto {sort === 'amount_net' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold text-right ${sort === 'amount_tax_no_credit' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-1 justify-end w-full hover:text-brand transition" onClick={() => toggleSort('amount_tax_no_credit')}>
                                 Retención {sort === 'amount_tax_no_credit' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold text-right ${sort === 'total_amount' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-1 justify-end w-full hover:text-brand transition" onClick={() => toggleSort('total_amount')}>
                                 Líquido {sort === 'total_amount' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold text-center">Estado Pago</th>
                           <th className="p-4 font-semibold text-center">Clasificación Contable</th>
                           <th className="p-4 font-semibold text-center">Origen</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {rows.length === 0 ? (
                           <tr>
                              <td colSpan={11} className="p-10 text-center text-text-soft italic">no se encontraron boletas de honorarios para los filtros aplicados.</td>
                           </tr>
                        ) : rows.map((row) => (
                           <tr key={row.id} className="hover:bg-brand/5 transition-colors group">
                              <td className="p-4 whitespace-nowrap font-medium text-text-main">{row.issue_date || '-'}</td>
                              <td className="p-4 font-mono text-text-soft">{row.folio || '-'}</td>
                              <td className="p-4 text-center">
                                 <span className="inline-flex px-2 py-1 bg-surface-2 rounded-md font-mono text-xs font-semibold text-text-soft border border-border-subtle/50">
                                    {row.doc_type}
                                 </span>
                              </td>
                              <td className="p-4 whitespace-nowrap font-mono text-xs text-text-soft">
                                 {row.counterparty_rut || '-'}
                              </td>
                              <td className="p-4 truncate max-w-[220px] font-medium text-text-main" title={row.counterparty_name}>
                                 {row.counterparty_name || '-'}
                              </td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(row.gross_amount)}</td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(row.tax_withheld)}</td>
                              <td className="p-4 text-right font-bold text-text-main">{clp(row.total_amount)}</td>
                              <td className="p-4 text-center whitespace-nowrap">
                                 {row.is_reconciled ? (
                                    <button
                                       type="button"
                                       onClick={() => handleOpenReconcile(row)}
                                       className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20 hover:bg-emerald-500/20 hover:ring-emerald-500/40 transition-all cursor-pointer shadow-none active:scale-95"
                                       title="Ver movimientos bancarios vinculados o desconciliar"
                                    >
                                       <span>Pagado</span>
                                    </button>
                                 ) : (
                                    <button
                                       type="button"
                                       onClick={() => handleOpenReconcile(row)}
                                       className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 hover:bg-amber-500/20 hover:ring-amber-500/40 transition-all cursor-pointer shadow-none active:scale-95"
                                       title={row.remaining_amount ? `Pendiente: ${clp(row.remaining_amount)} • Clic para conciliar con banco` : 'Clic para buscar egreso bancario y conciliar'}
                                    >
                                       <span>Sin conciliar</span>
                                    </button>
                                 )}
                              </td>
                              <td className="p-4 text-center whitespace-nowrap">
                                 {row.is_classified ? (
                                    <button
                                       type="button"
                                       onClick={() => handleQuickClassify(row)}
                                       className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer shadow-none active:scale-95 ${
                                          row.is_exception
                                             ? 'bg-purple-500/10 text-purple-700 ring-1 ring-purple-500/20 hover:bg-purple-500/20 hover:ring-purple-500/40'
                                             : 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20 hover:bg-blue-500/20 hover:ring-blue-500/40'
                                       }`}
                                       title={row.is_exception ? `Excepción asignada a este folio: ${row.accounting_account?.code || ''} ${row.accounting_account?.name || ''}` : (row.accounting_account?.name || 'Editar clasificación')}
                                    >
                                       <span>{row.accounting_account?.code || (row.is_exception ? 'Excepción' : 'Clasificado')}</span>
                                       {row.accounting_account?.name && (
                                          <span className="text-[11px] font-normal truncate max-w-[120px]">
                                             {row.accounting_account.name}
                                          </span>
                                       )}
                                    </button>
                                 ) : (
                                    <button
                                       type="button"
                                       onClick={() => handleQuickClassify(row)}
                                       className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20 hover:bg-amber-500/20 hover:ring-amber-500/40 transition-all cursor-pointer shadow-none active:scale-95"
                                       title="Clic para clasificar con una cuenta contable"
                                    >
                                       <span>Sin clasificar</span>
                                    </button>
                                 )}
                              </td>
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
