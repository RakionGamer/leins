// src/pages/income/SalesBoletas.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { useSearchParams } from 'react-router-dom';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import SiiSyncButton from 'components/SiiSyncButton';
import DateInput from 'components/DateInput';
import Modal from 'components/Modal';
import ManualIncomeForm from './components/ManualIncomeForm';
import EditIncomeForm from './components/EditIncomeForm';
import { deleteManualIncome, listSiiDocuments } from '../../services/siiDocumentsApi';
import { SII_DOCUMENT_FILTERS, getSiiDocumentTypeLabel } from '../../utils/siiConstants';
import { toast } from 'components/Toaster';
import {
   DocumentDuplicateIcon,
   BanknotesIcon,
   ChartBarIcon,
   CurrencyDollarIcon,
   PencilSquareIcon,
   CalendarDaysIcon,
   HashtagIcon,
   TagIcon,
   IdentificationIcon,
   PlusIcon,
   FunnelIcon,
   ArrowPathIcon,
   TrashIcon
} from '@heroicons/react/24/outline';

function ResumenPagina({ items }) {
   const fmt = new Intl.NumberFormat('es-CL');
   let exento = 0, afecto = 0, iva = 0, total = 0;

   for (const r of items ?? []) {
      exento += Number(r.exempt_amount ?? r.exento ?? 0);
      afecto += Number(r.net_amount ?? r.afecto ?? 0);
      iva += Number(r.vat_amount ?? r.iva ?? 0);
      total += Number(r.total_amount ?? r.total ?? 0);
   }

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Documentos</div>
               <div className="text-xl font-bold text-heading">{items?.length ?? 0}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-green-500/10 text-green-600 rounded-xl"><BanknotesIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Exento</div>
               <div className="text-xl font-bold text-heading">$ {fmt.format(exento)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl"><ChartBarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Afecto + IVA</div>
               <div className="text-xl font-bold text-heading">$ {fmt.format(afecto + iva)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><CurrencyDollarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Total Final</div>
               <div className="text-xl font-bold text-brand">$ {fmt.format(total)}</div>
            </div>
         </div>
      </div>
   );
}

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
const btnCtrl = 'h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
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

function MonthField({ value, contextValue, onChange, disabled = false }) {
   return (
      <div className="space-y-1.5 w-full">
         <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Mes de Operación</label>
         <div className="flex items-center gap-2">
            <input disabled={disabled} type="month" className={ctrl} value={value || ''} onChange={(e) => onChange(e.target.value)} />
         </div>
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

function useDebounced(value, delay = 300) {
   const [d, setD] = useState(value);
   useEffect(() => { const t = setTimeout(() => setD(value), delay); return () => clearTimeout(t) }, [value, delay]);
   return d;
}

export default function SalesBoletas() {
   const [exportingCsv, setExportingCsv] = useState(false);

   const [isManualModalOpen, setIsManualModalOpen] = useState(false);
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [documentToEdit, setDocumentToEdit] = useState(null);

   const { period } = usePeriod();
   const { entityId: activeEntityId, ready } = useEntityRequired();
   const [sp, setSp] = useSearchParams();

   const [rows, setRows] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   const dateFmt = useMemo(() => new Intl.DateTimeFormat('es-CL'), []);
   const fmtDate = (s) => (s ? dateFmt.format(new Date(s)) : '');

   const orderArrow = (o) => (o === 'asc' ? '↑' : '↓');
   const intFmt = useMemo(() => new Intl.NumberFormat('es-CL'), []);
   const parsePosInt = (v, def) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def; };

   const [page, setPage] = useState(() => parsePosInt(sp.get('page'), 1));
   const allowedPageSizes = [20, 50, 100, 200];
   const [pageSize, setPageSize] = useState(() => { const n = Number(sp.get('limit')); return allowedPageSizes.includes(n) ? n : 50; });

   const [docType, setDocType] = useState(() => sp.get('type') || '');
   const [sourceFilter, setSourceFilter] = useState(() => sp.get('source') || '');
   const [folioFilter, setFolioFilter] = useState(() => sp.get('folio') || '');
   const [clientFilter, setClientFilter] = useState(() => sp.get('client') || '');
   const [mode, setMode] = useState(() => (sp.get('mode') === 'range' ? 'range' : 'month'));
   const [filterMonth, setFilterMonth] = useState(() => sp.get('month') || todayYYYYMM());
   const [fromDate, setFromDate] = useState(() => sp.get('from') || '');
   const [toDate, setToDate] = useState(() => sp.get('to') || '');
   const [entityId, setEntityId] = useState(() => sp.get('entity_id') || (activeEntityId ? String(activeEntityId) : ''));

   const ALLOWED_SORT = new Set(['issue_date', 'folio', 'total_amount', 'created_at', 'updated_at']);
   const ALLOWED_ORDER = new Set(['asc', 'desc']);
   const [sort, setSort] = useState(() => ALLOWED_SORT.has(sp.get('sort')) ? sp.get('sort') : 'issue_date');
   const [order, setOrder] = useState(() => ALLOWED_ORDER.has(sp.get('order')) ? sp.get('order') : 'desc');

   const [total, setTotal] = useState(0);
   const [totalPages, setTotalPages] = useState(1);
   const [hasPrev, setHasPrev] = useState(false);
   const [hasNext, setHasNext] = useState(false);
   const [refreshTrigger, setRefreshTrigger] = useState(0);

   const pageTotals = useMemo(() => rows.reduce((acc, r) => ({
      exento: acc.exento + (Number(r.exento) || 0),
      afecto: acc.afecto + (Number(r.afecto) || 0),
      iva: acc.iva + (Number(r.iva) || 0),
      total: acc.total + (Number(r.total) || 0),
   }), { exento: 0, afecto: 0, iva: 0, total: 0 }), [rows]);

   const effectiveMonth = useMemo(() => filterMonth || (period ? periodToYYYYMM(period) : todayYYYYMM()), [filterMonth, period]);
   const debEntityId = useDebounced(entityId, 300);
   const debFolioFilter = useDebounced(folioFilter, 300);
   const debClientFilter = useDebounced(clientFilter, 300);

   const buildListParams = useCallback(({ pageOverride = page, limitOverride = pageSize, signal } = {}) => {
      const effectiveEntityId = debEntityId && /^\d+$/.test(String(debEntityId)) ? Number(debEntityId) : undefined;
      return {
         entityId: effectiveEntityId,
         operationType: 'INCOME',
         type: docType || undefined,
         source: sourceFilter || undefined,
         folio: debFolioFilter.trim() || undefined,
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
   }, [docType, page, pageSize, sort, order, mode, effectiveMonth, fromDate, toDate, debEntityId, sourceFilter, debFolioFilter, debClientFilter]);

   const rangeInvalid = mode === 'range' && fromDate && toDate && new Date(toDate) < new Date(fromDate);

   const reloadData = () => setRefreshTrigger(prev => prev + 1);
   const resetToFirstPage = () => setPage(1);

   const openEditModal = (row) => {
      setDocumentToEdit(row);
      setIsEditModalOpen(true);
   };

   const handleDelete = async (id) => {
      const isConfirmed = window.confirm("¿Está seguro que desea eliminar este registro manual? Esta acción no se puede deshacer.");
      if (!isConfirmed) return;

      try {
         await deleteManualIncome(id);
         toast.success('registro eliminado con exito');
         reloadData();
      } catch (error) {
         toast.error(error.message || "ocurrio un error al intentar eliminar el registro.");
      }
   };
   
   const switchToMonth = () => { setMode('month'); setFromDate(''); setToDate(''); if (!filterMonth) setFilterMonth(todayYYYYMM()); resetToFirstPage(); };
   const switchToRange = () => { setMode('range'); setFilterMonth(''); resetToFirstPage(); };

   const handleClearFilters = () => {
      setEntityId(activeEntityId ? String(activeEntityId) : '');
      setDocType(''); setSourceFilter(''); setFolioFilter(''); setClientFilter(''); setMode('month'); setFilterMonth(todayYYYYMM());
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
            const items = payload.rows;
            const mapped = items.map((it) => {
               const exento = Number(it.exempt_amount ?? it.amount_exempt ?? 0);
               const afecto = Number(it.net_amount ?? it.amount_net ?? 0);
               const iva = Number(it.vat_amount ?? it.amount_vat ?? 0);
               const total = Number(it.total_amount ?? (exento + afecto + iva));
               return {
                  id: it.id,
                  entity_id: it.entity_id,
                  date: it.issue_date,
                  folio: it.folio,
                  doc_type: getSiiDocumentTypeLabel(it.doc_type_code),
                  doc_type_code: it.doc_type_code,
                  client_name: it.counterparty_name || it.counterparty_rut || '',
                  counterparty_rut: it.counterparty_rut,
                  counterparty_name: it.counterparty_name,
                  exento, afecto, iva, total,
                  source: it.source
               };
            });

            setRows(mapped);
            setTotal(Number(payload.total ?? mapped.length));
            setTotalPages(Number(payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? mapped.length) / pageSize))));
            setHasPrev(page > 1);
            setHasNext(page < Number(payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? mapped.length) / pageSize))));
         } catch (e) {
            if (e.name !== 'AbortError') setErr(e.message || 'error');
         } finally {
            setLoading(false);
         }
      })();
      return () => ctrl.abort();
   }, [buildListParams, page, pageSize, rangeInvalid, refreshTrigger, ready, entityId]);

   useEffect(() => {
      const p = new URLSearchParams();
      if (docType) p.set('type', docType);
      if (sourceFilter) p.set('source', sourceFilter);
      if (folioFilter.trim()) p.set('folio', folioFilter.trim());
      if (clientFilter.trim()) p.set('client', clientFilter.trim());
      if (entityId) p.set('entity_id', String(entityId));
      p.set('mode', mode); p.set('sort', sort); p.set('order', order);
      if (mode === 'month') p.set('month', effectiveMonth);
      else { if (fromDate) p.set('from', fromDate); if (toDate) p.set('to', toDate); }
      p.set('page', String(page)); p.set('limit', String(pageSize));
      setSp(p, { replace: true });
   }, [docType, sourceFilter, folioFilter, clientFilter, entityId, mode, sort, order, effectiveMonth, fromDate, toDate, page, pageSize, setSp]);

   const exportCSV = async () => {
      setExportingCsv(true);
      try {
         const DELIM = ';';
         const csvEscape = (v) => {
            const s = String(v ?? '');
            return (s.includes(DELIM) || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
         };
         const header = ['Fecha', 'Folio', 'Tipo', 'Cliente', 'Exento_CLP', 'Afecto_CLP', 'IVA_CLP', 'Total_CLP', 'Origen'];

         const perPage = 200;

         const allRows = [];
         let currentPage = 1;
         let totalPagesLocal = 1;

         do {
            const payload = await listSiiDocuments(buildListParams({ pageOverride: currentPage, limitOverride: perPage }));
            const items = payload.rows;

            for (const it of items) {
               const exento = Number(it.exempt_amount ?? it.amount_exempt ?? 0);
               const afecto = Number(it.net_amount ?? it.amount_net ?? 0);
               const iva = Number(it.vat_amount ?? it.amount_vat ?? 0);
               const total = Number(it.total_amount ?? (exento + afecto + iva));
               allRows.push([
                  it.issue_date || '',
                  it.folio || '',
                  getSiiDocumentTypeLabel(it.doc_type_code),
                  it.counterparty_name || it.counterparty_rut || '',
                  exento, afecto, iva, total,
                  it.source || 'SII'
               ]);
            }
            totalPagesLocal = Number(payload.totalPages ?? 1);
            currentPage += 1;
         } while (currentPage <= totalPagesLocal);

         if (!allRows.length) return;
         const rowsCsv = [header, ...allRows].map(row => row.map(csvEscape).join(DELIM)).join('\r\n');

         const content = `\uFEFFsep=${DELIM}\r\n${rowsCsv}`;
         const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a'); a.href = url;
         a.download = `ventas_sii.csv`;
         a.click();
         URL.revokeObjectURL(url);
      } catch (e) {
         alert(e.message || 'Error export');
      } finally {
         setExportingCsv(false);
      }
   };

   const start = total ? (page - 1) * pageSize + 1 : 0;
   const end = total ? Math.min(total, page * pageSize) : 0;
   const showingLabel = total ? `Mostrando ${intFmt.format(start)}-${intFmt.format(end)} de ${intFmt.format(total)}` : 'Sin resultados';

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   return (
      <div className="space-y-6">
         {/* modal de creacion */}
         <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Registrar Ingreso Manual" maxWidth="max-w-3xl">
            {/* el renderizado condicional destruye el formulario al cerrar, limpiando sus estados */}
            {isManualModalOpen && (
               <ManualIncomeForm
                  entityId={entityId}
                  onSuccess={() => { setIsManualModalOpen(false); reloadData(); }}
                  onCancel={() => setIsManualModalOpen(false)}
               />
            )}
         </Modal>

         {/* modal de edicion */}
         <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Registro" maxWidth="max-w-3xl">
            {/* aqui ya teniamos documentToEdit, le sumamos la validacion del modal */}
            {isEditModalOpen && documentToEdit && (
               <EditIncomeForm
                  document={documentToEdit}
                  onSuccess={() => { setIsEditModalOpen(false); reloadData(); }}
                  onCancel={() => setIsEditModalOpen(false)}
               />
            )}
         </Modal>

         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Ventas (Boletas y Facturas)</h2>
                  <p className="text-sm text-text-soft mt-1">Gestione sus boletas y facturas electrónicas, además de ingresos manuales.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <SiiSyncButton type="boletas" onSyncSuccess={reloadData} />
                  <SiiSyncButton
                     type="sales-invoices"
                     onSyncSuccess={reloadData}
                     documentTypeOptions={[
                        { value: 33, label: '33 - Factura Afecta' },
                        { value: 34, label: '34 - Factura Exenta' },
                     ]}
                  />
                  <button onClick={() => setIsManualModalOpen(true)} className={`${btnCtrl} text-brand border-brand/20 bg-brand/5`} title="Añadir un nuevo ingreso manual">
                     <PlusIcon className="w-5 h-5 stroke-2" /> <span className="hidden sm:inline">Añadir Ingreso</span>
                  </button>
               </div>
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
                  <div className="space-y-1.5 md:col-span-1">
                     <label htmlFor="entityId" className="block text-xs font-semibold text-text-soft uppercase tracking-wider truncate" title="ID Entidad">ID Ent.</label>
                     <input id="entityId" disabled className={ctrl} type="text" placeholder="Selecciona entidad arriba" value={entityId} />
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                     <label htmlFor="folioFilter" className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Folio</label>
                     <input
                        id="folioFilter"
                        disabled={loading}
                        className={ctrl}
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 992"
                        value={folioFilter}
                        onChange={(e) => { setFolioFilter(e.target.value); resetToFirstPage(); }}
                     />
                  </div>

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
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Tipo</label>
                     <select disabled={loading} className={selectCtrl} value={docType} onChange={(e) => { setDocType(e.target.value); resetToFirstPage(); }}>
                        <option value="">Todos los tipos</option>
                        {SII_DOCUMENT_FILTERS.income.map((option) => (
                           <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                     </select>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Origen</label>
                     <select disabled={loading} className={selectCtrl} value={sourceFilter} onChange={(e) => { setSourceFilter(e.target.value); resetToFirstPage(); }}>
                        <option value="">Todos</option>
                        <option value="SII">SII</option>
                        <option value="MANUAL">Manual</option>
                     </select>
                  </div>

                  <div className="md:col-span-4">
                     {mode === 'month' ? (
                        <MonthField value={filterMonth} contextValue={period ? periodToYYYYMM(period) : todayYYYYMM()} onChange={(v) => { setFilterMonth(v); resetToFirstPage(); }} disabled={loading} />
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
                              <button type="button" className="flex items-center gap-2 hover:text-brand transition" onClick={() => { setOrder(s => (sort === 'issue_date' ? (s === 'asc' ? 'desc' : 'asc') : 'asc')); setSort('issue_date'); setPage(1); }}>
                                 <CalendarDaysIcon className="w-4 h-4" /> Fecha {sort === 'issue_date' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className={`p-4 font-semibold ${sort === 'folio' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 hover:text-brand transition" onClick={() => { setOrder(s => (sort === 'folio' ? (s === 'asc' ? 'desc' : 'asc') : 'asc')); setSort('folio'); setPage(1); }}>
                                 <HashtagIcon className="w-4 h-4" /> Folio {sort === 'folio' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold"><div className="flex items-center gap-2 justify-center"><TagIcon className="w-4 h-4" /> Tipo</div></th>
                           <th className="p-4 font-semibold"><div className="flex items-center gap-2"><IdentificationIcon className="w-4 h-4" /> Receptor (Opc)</div></th>
                           <th className="p-4 font-semibold text-right">Exento</th>
                           <th className="p-4 font-semibold text-right">Afecto</th>
                           <th className="p-4 font-semibold text-right">IVA</th>
                           <th className={`p-4 font-semibold text-right ${sort === 'total_amount' ? 'text-brand' : ''}`}>
                              <button type="button" className="flex items-center gap-2 justify-end w-full hover:text-brand transition" onClick={() => { setOrder(s => (sort === 'total_amount' ? (s === 'asc' ? 'desc' : 'asc') : 'asc')); setSort('total_amount'); setPage(1); }}>
                                 Total {sort === 'total_amount' ? orderArrow(order) : ''}
                              </button>
                           </th>
                           <th className="p-4 font-semibold text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {rows.length === 0 ? (
                           <tr><td colSpan={9} className="p-10 text-center text-text-soft italic">no se encontraron registros para los filtros aplicados.</td></tr>
                        ) : rows.map(r => (
                           <tr key={r.id} className="hover:bg-brand/5 transition-colors group">
                              <td className="p-4 whitespace-nowrap">
                                 <div className="flex items-center gap-3">
                                    <span className="font-medium text-text-main">{fmtDate(r.date)}</span>
                                    {r.source === 'MANUAL' && <Pill colorClass="bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-900/30 dark:text-purple-400">manual</Pill>}
                                 </div>
                              </td>
                              <td className="p-4 font-mono text-text-soft">{r.folio || '-'}</td>
                              <td className="p-4 text-center">
                                 <span className="inline-flex px-2 py-1 bg-surface-2 rounded-md font-mono text-xs font-semibold text-text-soft border border-border-subtle/50">
                                    {r.doc_type}
                                 </span>
                              </td>
                              <td className="p-4 truncate max-w-[200px] text-text-main font-medium">{r.client_name || '-'}</td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(r.exento)}</td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(r.afecto)}</td>
                              <td className="p-4 text-right font-mono text-text-soft">{clp(r.iva)}</td>
                              <td className="p-4 text-right font-bold text-text-main">{clp(r.total)}</td>
                              <td className="p-4 text-center">
                                 <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    {r.source === 'MANUAL' ? (
                                       <>
                                          <button onClick={() => openEditModal(r)} className="p-1.5 rounded-lg text-text-soft hover:text-brand hover:bg-brand/10 transition outline-none focus:ring-2 focus:ring-brand" title="editar registro">
                                             <PencilSquareIcon className="w-5 h-5" />
                                          </button>
                                          <button onClick={() => handleDelete(r.id)} className="p-1.5 rounded-lg text-text-soft hover:text-danger hover:bg-danger/10 transition outline-none focus:ring-2 focus:ring-danger" title="eliminar registro">
                                             <TrashIcon className="w-5 h-5" />
                                          </button>
                                       </>
                                    ) : (
                                       <span className="text-xs text-text-soft italic">no editable</span>
                                    )}
                                 </div>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                     <tfoot className="bg-surface-2 border-t-2 border-border-subtle text-text-main font-bold">
                        <tr>
                           <td colSpan={4} className="p-4 uppercase tracking-wider text-xs text-text-soft text-right">totales de esta página:</td>
                           <td className="p-4 text-right">{clp(pageTotals.exento)}</td>
                           <td className="p-4 text-right">{clp(pageTotals.afecto)}</td>
                           <td className="p-4 text-right">{clp(pageTotals.iva)}</td>
                           <td className="p-4 text-right text-brand">{clp(pageTotals.total)}</td>
                           <td></td>
                        </tr>
                     </tfoot>
                  </table>
               </div>
            )}
         </div>

         {!loading && !err && total > 0 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm bg-bg-content p-4 rounded-3xl border border-border-subtle shadow-sm">
               <div className="text-text-soft font-medium">
                  {showingLabel} - Página <span className="text-text-main font-bold">{intFmt.format(page)}</span> de {intFmt.format(totalPages)}
               </div>
               <div className="flex items-center gap-3">
                  <button onClick={exportCSV} disabled={exportingCsv || !total} className="px-4 py-2 bg-surface-2 hover:bg-surface-1 text-text-main rounded-xl font-medium transition border border-border-subtle disabled:opacity-50">
                     {exportingCsv ? 'exportando...' : 'exportar csv'}
                  </button>
                  <div className="flex gap-1">
                     <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" onClick={() => setPage(p => p - 1)} disabled={!hasPrev}>anterior</button>
                     <button className="px-4 py-2 bg-brand/10 text-brand rounded-xl font-bold hover:bg-brand hover:text-white transition disabled:opacity-30 disabled:pointer-events-none" onClick={() => setPage(p => p + 1)} disabled={!hasNext}>siguiente</button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}
