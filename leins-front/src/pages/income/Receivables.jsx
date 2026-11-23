// src/pages/income/Receivables.jsx
import { useEffect, useMemo, useState, useCallback } from 'react';
import { usePeriod } from '../../context/PeriodContext';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import { useSearchParams, useNavigate } from 'react-router-dom';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import DateInput from 'components/DateInput';
import { listSiiDocuments, exportSiiDocumentsCsv } from '../../services/siiDocumentsApi';
import { toast } from 'components/Toaster';
import {
   FiltroIcon,
   BuscarIcon,
   SincronizarIcon,
   DescargarIcon,
   DocumentoIcon,
   CheckIcon,
   CobrarIcon,
   CalendarioIcon,
   VerIcon,
   IzquierdaIcon,
   DerechaIcon,
} from '../../components/icons/SidebarIcons';

const RECEIVABLE_DOC_TYPES = '33,34,61';

function periodToYYYYMM({ month, year }) {
   const m = String(month).padStart(2, '0');
   return `${year}-${m}`;
}

function todayYYYYMM() {
   const d = new Date();
   const m = String(d.getMonth() + 1).padStart(2, '0');
   return `${d.getFullYear()}-${m}`;
}

// Formato de moneda chilena con espacio: "$ 1.530.000"
function formatClp(value) {
   const num = Math.round(Number(value || 0));
   const formatted = Math.abs(num).toLocaleString('es-CL');
   return num < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
}

const intFmt = new Intl.NumberFormat('es-CL');

// Formato de fecha chilena con guiones: DD-MM-YYYY
function fmtDateChilean(s) {
   if (!s) return '—';
   try {
      const cleanStr = String(s).slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
         const [y, m, d] = cleanStr.split('-');
         return `${d}-${m}-${y}`;
      }
      const parsed = new Date(s);
      if (Number.isNaN(parsed.getTime())) return '—';
      const d = String(parsed.getDate()).padStart(2, '0');
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const y = parsed.getFullYear();
      return `${d}-${m}-${y}`;
   } catch {
      return '—';
   }
}

// Subtítulo de días restantes de vencimiento: "Vence en 26 días"
function getDueDaysLabel(dueDateStr) {
   if (!dueDateStr) return null;
   try {
      const cleanStr = String(dueDateStr).slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return null;
      const [y, m, d] = cleanStr.split('-').map(Number);
      const due = new Date(y, m - 1, d);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      due.setHours(0, 0, 0, 0);
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0) return `Vence en ${diffDays} día${diffDays === 1 ? '' : 's'}`;
      if (diffDays === 0) return 'Vence hoy';
      const past = Math.abs(diffDays);
      return `Vencida hace ${past} día${past === 1 ? '' : 's'}`;
   } catch {
      return null;
   }
}

function invoiceStatus(totalAmount, remainingAmount, docTypeCode) {
   if (docTypeCode === 61) return 'credit_note';
   const total = Number(totalAmount || 0);
   const remaining = Number(remainingAmount || 0);
   if (remaining <= 0) return 'paid';
   if (remaining < total) return 'partial';
   return 'pending';
}

// Componente Resumen de Página oficial Jeito (4 tarjetas KPI)
function ResumenPagina({ items = [] }) {
   const fmt = new Intl.NumberFormat('es-CL');
   let invoiced = 0;
   let collected = 0;
   let pending = 0;
   let pendingCount = 0;

   for (const r of items ?? []) {
      const mult = r.doc_type_code === 61 ? -1 : 1;
      const total = Number(r.total_amount || 0) * mult;
      const remaining = r.doc_type_code === 61 ? 0 : Number(r.remaining_amount || 0);
      invoiced += total;
      collected += (total - remaining);
      pending += remaining;
      if (remaining > 0 && mult === 1) pendingCount += 1;
   }

   return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {/* 1. Total facturado */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
               <DocumentoIcon className="w-5 h-5 text-[#0A1A3F]" />
            </div>
            <div>
               <div className="text-xs text-[#55607A] font-medium">Total facturado</div>
               <div className="text-2xl font-black font-nunito text-[#0A1A3F] mt-0.5 tabular-nums">{formatClp(invoiced)}</div>
            </div>
         </div>

         {/* 2. Total cobrado */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
               <CheckIcon className="w-5 h-5 text-[#0A1A3F]" />
            </div>
            <div>
               <div className="text-xs text-[#55607A] font-medium">Total cobrado</div>
               <div className="text-2xl font-black font-nunito text-[#0A1A3F] mt-0.5 tabular-nums">{formatClp(collected)}</div>
            </div>
         </div>

         {/* 3. Por cobrar (Tarjeta Azul Vivo Oficial Jeito) */}
         <div className="bg-[#1F6BFF] text-white rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
            <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
               <CobrarIcon className="w-5 h-5 stroke-white" />
            </div>
            <div>
               <div className="text-xs text-white/80 font-medium">Por cobrar</div>
               <div className="text-2xl font-black font-nunito text-white mt-0.5 tabular-nums">{formatClp(pending)}</div>
            </div>
         </div>

         {/* 4. Facturas pendientes */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
            <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
               <CalendarioIcon className="w-5 h-5 text-[#0A1A3F]" />
            </div>
            <div>
               <div className="text-xs text-[#55607A] font-medium">Facturas pendientes</div>
               <div className="text-2xl font-black font-nunito text-[#0A1A3F] mt-0.5">{fmt.format(pendingCount)}</div>
            </div>
         </div>
      </div>
   );
}

function useDebounced(value, delay = 300) {
   const [d, setD] = useState(value);
   useEffect(() => {
      const t = setTimeout(() => setD(value), delay);
      return () => clearTimeout(t);
   }, [value, delay]);
   return d;
}

export default function Receivables() {
   const { period } = usePeriod();
   const { entityId: activeEntityId, ready } = useEntityRequired();
   const [sp, setSp] = useSearchParams();
   const navigate = useNavigate();

   const [rows, setRows] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [exporting, setExporting] = useState(false);

   const parsePosInt = (v, def) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? Math.trunc(n) : def;
   };

   const [page, setPage] = useState(() => parsePosInt(sp.get('page'), 1));
   const allowedPageSizes = [20, 50, 100, 200];
   const [pageSize, setPageSize] = useState(() => {
      const n = Number(sp.get('limit'));
      return allowedPageSizes.includes(n) ? n : 50;
   });

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
         setErr(e.message || 'No se pudo exportar el listado');
      } finally {
         setExporting(false);
      }
   };

   const resetToFirstPage = () => setPage(1);

   const switchToMonth = () => {
      setMode('month');
      setFromDate('');
      setToDate('');
      if (!filterMonth) setFilterMonth(todayYYYYMM());
      resetToFirstPage();
   };

   const switchToRange = () => {
      setMode('range');
      setFilterMonth('');
      resetToFirstPage();
   };

   const handleClearFilters = () => {
      setEntityId(activeEntityId ? String(activeEntityId) : '');
      setStatusFilter('');
      setClientFilter('');
      setMode('month');
      setFilterMonth(todayYYYYMM());
      setFromDate('');
      setToDate('');
      setPageSize(50);
      resetToFirstPage();
   };

   const handleViewDoc = (r) => {
      if (r.folio) {
         navigate(`/income/sales-boletas?folio=${encodeURIComponent(r.folio)}`);
      } else {
         navigate(`/income/sales-boletas`);
      }
   };

   const handleReminder = (r) => {
      toast.success(`Recordatorio de cobro enviado para ${r.counterparty_name || 'el cliente'} (Folio ${r.folio || ''})`);
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
      if (rangeInvalid) {
         setRows([]);
         setTotal(0);
         setHasPrev(false);
         setHasNext(false);
         setErr(null);
         setLoading(false);
         return;
      }
      const ctrl = new AbortController();
      setLoading(true);
      setErr(null);
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
               credit_notes_applied: Number(it.credit_notes_applied || 0),
               doc_type_code: it.doc_type_code,
               nce_nde_reference: it.nce_nde_reference,
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
      p.set('mode', mode);
      p.set('sort', sort);
      p.set('order', order);
      if (mode === 'month') p.set('month', effectiveMonth);
      else {
         if (fromDate) p.set('from', fromDate);
         if (toDate) p.set('to', toDate);
      }
      p.set('page', String(page));
      p.set('limit', String(pageSize));
      setSp(p, { replace: true });
   }, [statusFilter, clientFilter, entityId, mode, sort, order, effectiveMonth, fromDate, toDate, page, pageSize, setSp]);

   const toggleSort = (col) => {
      setOrder((s) => (sort === col ? (s === 'asc' ? 'desc' : 'asc') : 'desc'));
      setSort(col);
      setPage(1);
   };

   const start = total ? (page - 1) * pageSize + 1 : 0;
   const end = total ? Math.min(total, page * pageSize) : 0;

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   return (
      <div className="flex flex-col gap-6">
         {/* ========================================================
             1. BREADCRUMBS & TITULAR
             ======================================================== */}
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[#8E9BB5] font-medium">
               <span>Ingresos</span>
               <span>&gt;</span>
               <span className="text-[#0A1A3F]">Cuentas por cobrar</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
               <div>
                  <h1 className="text-3xl font-black font-nunito text-[#0A1A3F] tracking-tight">
                     Cuentas por cobrar
                  </h1>
                  <p className="text-xs text-[#55607A] font-normal mt-1">
                     Facturas de venta pagadas y pendientes, según tus conciliaciones bancarias.
                  </p>
               </div>

               {/* Botón Descargar CSV */}
               <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={exporting || !entityId || rangeInvalid}
                  className="rounded-full border border-[#E2EAFD] bg-white hover:bg-[#EEF3FF] text-[#0A1A3F] font-bold text-xs px-4 py-2 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer disabled:opacity-50"
               >
                  <DescargarIcon className="w-4 h-4 text-[#0A1A3F]" />
                  <span>{exporting ? 'Descargando...' : 'Descargar CSV'}</span>
               </button>
            </div>
         </div>

         {/* ========================================================
             2. FILTROS DE BÚSQUEDA
             ======================================================== */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs space-y-4">
            {/* Cabecera del filtro */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div className="flex items-center gap-2 text-sm font-bold font-nunito text-[#0A1A3F]">
                  <FiltroIcon className="w-4 h-4 text-[#0A1A3F]" />
                  <span>Filtros de búsqueda</span>
               </div>
               <div className="flex items-center gap-4">
                  <button
                     type="button"
                     onClick={handleClearFilters}
                     disabled={loading}
                     className="text-xs font-semibold text-[#55607A] hover:text-[#1F6BFF] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  >
                     <SincronizarIcon className="w-3.5 h-3.5" />
                     <span>Limpiar filtros</span>
                  </button>

                  {/* Switch Por mes / Por rango */}
                  <div className="inline-flex p-0.5 bg-[#EEF3FF] rounded-full items-center gap-0.5">
                     <button
                        type="button"
                        onClick={switchToMonth}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                           mode === 'month'
                              ? 'bg-white text-[#0A1A3F] shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F]'
                        }`}
                     >
                        Por mes
                     </button>
                     <button
                        type="button"
                        onClick={switchToRange}
                        className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                           mode === 'range'
                              ? 'bg-white text-[#0A1A3F] shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F]'
                        }`}
                     >
                        Por rango
                     </button>
                  </div>
               </div>
            </div>

            {/* Inputs de filtro: CLIENTE, ESTADO, MES DE EMISIÓN, POR PÁGINA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
               {/* CLIENTE */}
               <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Cliente</label>
                  <div className="relative flex items-center">
                     <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8E9BB5]">
                        <BuscarIcon className="w-4 h-4 text-[#8E9BB5]" />
                     </div>
                     <input
                        type="text"
                        placeholder="RUT o razón social"
                        value={clientFilter}
                        onChange={(e) => { setClientFilter(e.target.value); resetToFirstPage(); }}
                        className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF]"
                     />
                  </div>
               </div>

               {/* ESTADO */}
               <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Estado</label>
                  <select
                     value={statusFilter}
                     onChange={(e) => { setStatusFilter(e.target.value); resetToFirstPage(); }}
                     className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                  >
                     <option value="">Todos</option>
                     <option value="pending">Pendientes</option>
                     <option value="paid">Pagadas</option>
                  </select>
               </div>

               {/* MES DE EMISIÓN / RANGO */}
               <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">
                     {mode === 'month' ? 'Mes de emisión' : 'Rango de fechas'}
                  </label>
                  {mode === 'month' ? (
                     <input
                        type="month"
                        value={filterMonth}
                        onChange={(e) => { setFilterMonth(e.target.value); resetToFirstPage(); }}
                        className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                     />
                  ) : (
                     <div className="flex items-center gap-1.5">
                        <DateInput
                           value={fromDate}
                           onChange={(v) => { setFromDate(v); resetToFirstPage(); }}
                           className="w-full h-10 px-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F]"
                        />
                        <span className="text-[#8E9BB5]">-</span>
                        <DateInput
                           value={toDate}
                           onChange={(v) => { setToDate(v); resetToFirstPage(); }}
                           min={fromDate || undefined}
                           className="w-full h-10 px-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F]"
                        />
                     </div>
                  )}
               </div>

               {/* POR PÁGINA */}
               <div className="space-y-1">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Por página</label>
                  <select
                     value={pageSize}
                     onChange={(e) => { setPageSize(Number(e.target.value) || 50); resetToFirstPage(); }}
                     className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                  >
                     <option value={20}>20 filas</option>
                     <option value={50}>50 filas</option>
                     <option value={100}>100 filas</option>
                  </select>
               </div>
            </div>
         </div>

         {/* ========================================================
             3. RESUMEN DE PÁGINA (4 TARJETAS DE CIFRAS KPI)
             ======================================================== */}
         <ResumenPagina items={rows} />

         {/* ========================================================
             4. TABLA DE CUENTAS POR COBRAR
             ======================================================== */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs space-y-4">
            {loading && (
               <div className="py-12 text-center text-[#1F6BFF] font-semibold text-xs animate-pulse">
                  Cargando registros...
               </div>
            )}

            {err && (
               <div className="py-8 text-center text-red-600 font-semibold text-xs">
                  Error: {err}
               </div>
            )}

            {!loading && !err && (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-left">
                     <thead>
                        <tr className="border-b border-[#E2EAFD] text-xs font-bold text-[#55607A]">
                           <th className="py-3 px-3">
                              <button
                                 type="button"
                                 className="flex items-center gap-1 hover:text-[#1F6BFF] transition-colors"
                                 onClick={() => toggleSort('issue_date')}
                              >
                                 <span>Emisión</span>
                                 <span className="text-[10px]">{sort === 'issue_date' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                              </button>
                           </th>
                           <th className="py-3 px-3">
                              <button
                                 type="button"
                                 className="flex items-center gap-1 hover:text-[#1F6BFF] transition-colors"
                                 onClick={() => toggleSort('folio')}
                              >
                                 <span>Folio</span>
                                 <span className="text-[10px]">{sort === 'folio' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                              </button>
                           </th>
                           <th className="py-3 px-3">Cliente</th>
                           <th className="py-3 px-3">Vencimiento</th>
                           <th className="py-3 px-3 text-right">
                              <button
                                 type="button"
                                 className="flex items-center gap-1 justify-end w-full hover:text-[#1F6BFF] transition-colors"
                                 onClick={() => toggleSort('total_amount')}
                              >
                                 <span>Total</span>
                                 <span className="text-[10px]">{sort === 'total_amount' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                              </button>
                           </th>
                           <th className="py-3 px-3 text-right">
                              <button
                                 type="button"
                                 className="flex items-center gap-1 justify-end w-full hover:text-[#1F6BFF] transition-colors"
                                 onClick={() => toggleSort('remaining_amount')}
                              >
                                 <span>Saldo pendiente</span>
                                 <span className="text-[10px]">{sort === 'remaining_amount' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                              </button>
                           </th>
                           <th className="py-3 px-3 text-center">Estado</th>
                           <th className="py-3 px-3 text-right">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#EFF3FF]">
                        {rows.length === 0 ? (
                           <tr>
                              <td colSpan={8} className="py-12 text-center text-xs text-[#8E9BB5] italic">
                                 No se encontraron facturas para los filtros aplicados.
                              </td>
                           </tr>
                        ) : (
                           rows.map((r) => {
                              const isNC = r.doc_type_code === 61;
                              const mult = isNC ? -1 : 1;
                              const remaining = isNC ? 0 : Math.max(0, Number(r.remaining_amount || 0));
                              const status = invoiceStatus(r.total_amount, remaining, r.doc_type_code);

                              return (
                                 <tr key={r.id} className="hover:bg-[#F8FAFF] transition-colors group">
                                    {/* Emisión */}
                                    <td className="py-3.5 px-3 text-xs font-medium text-[#0A1A3F] tabular-nums whitespace-nowrap">
                                       {fmtDateChilean(r.issue_date)}
                                    </td>

                                    {/* Folio */}
                                    <td className="py-3.5 px-3 text-xs font-bold text-[#0A1A3F] font-nunito whitespace-nowrap">
                                       {r.folio || '—'}
                                    </td>

                                    {/* Cliente */}
                                    <td className="py-3.5 px-3 min-w-[180px] max-w-[260px]">
                                       <div className="text-xs font-bold text-[#0A1A3F] truncate">
                                          {r.counterparty_name || r.counterparty_rut || 'Sin cliente'}
                                          {isNC && (
                                             <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFF3FF] text-[#1F6BFF]">
                                                NC
                                             </span>
                                          )}
                                       </div>
                                       {r.counterparty_name && r.counterparty_rut && (
                                          <div className="text-[11px] text-[#8E9BB5] font-medium mt-0.5">
                                             {r.counterparty_rut}
                                          </div>
                                       )}
                                    </td>

                                    {/* Vencimiento */}
                                    <td className="py-3.5 px-3 whitespace-nowrap">
                                       <div className="text-xs font-medium text-[#0A1A3F] tabular-nums">
                                          {fmtDateChilean(r.due_date)}
                                       </div>
                                       {remaining > 0 && r.due_date && (
                                          <div className="text-[11px] text-[#8E9BB5] font-medium mt-0.5">
                                             {getDueDaysLabel(r.due_date)}
                                          </div>
                                       )}
                                    </td>

                                    {/* Total */}
                                    <td className="py-3.5 px-3 text-xs font-bold text-[#0A1A3F] tabular-nums text-right whitespace-nowrap">
                                       {formatClp(r.total_amount * mult)}
                                    </td>

                                    {/* Saldo pendiente */}
                                    <td className="py-3.5 px-3 text-xs font-medium text-[#0A1A3F] tabular-nums text-right whitespace-nowrap">
                                       {isNC || remaining <= 0 ? '—' : formatClp(remaining)}
                                    </td>

                                    {/* Estado */}
                                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                       <div className="flex items-center justify-center gap-1.5">
      {status === 'paid' && (
         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E5EDFF] text-[#1459F5]">
            <span className="w-2 h-2 rounded-full bg-[#1459F5] shrink-0" />
            <span>Pagada</span>
         </span>
      )}
      {status === 'pending' && (
         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border-[1.5px] border-[#BACBF7] bg-[#F2F6FF] text-[#0A1A3F]">
            <span className="w-2 h-2 rounded-full border-2 border-[#0A1A3F] bg-transparent shrink-0" />
            <span>Pendiente</span>
         </span>
      )}
      {status === 'partial' && (
         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#FFF4E5] text-[#D97706]">
            <span className="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
            <span>Parcial</span>
         </span>
      )}
      {status === 'credit_note' && (
         <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#E5EDFF] text-[#1459F5]">
            <span>Nota Crédito</span>
         </span>
      )}
   </div>
</td>

{/* Acciones */}
<td className="py-3.5 px-3 whitespace-nowrap text-right">
   <div className="inline-flex items-center justify-end gap-3.5">
      {remaining > 0 && !isNC && (
         <button
            type="button"
            onClick={() => handleReminder(r)}
            className="inline-flex items-center justify-center px-3.5 py-1 rounded-full text-xs font-bold bg-[#E5EDFF] text-[#1459F5] hover:bg-[#D6E3FF] transition-colors cursor-pointer"
            title="Enviar recordatorio de cobro"
         >
            Recordar cobro
         </button>
      )}
      <button
         type="button"
         onClick={() => handleViewDoc(r)}
         className="inline-flex items-center gap-1 text-xs font-bold text-[#4E6185] hover:text-[#1459F5] transition-colors cursor-pointer py-1"
         title="Ver detalle del documento"
      >
         <VerIcon className="w-4 h-4 text-[#4E6185]" />
         <span>Ver</span>
      </button>
   </div>
</td>
                                 </tr>
                              );
                           })
                        )}
                     </tbody>
                  </table>
               </div>
            )}

            {/* Paginación */}
            {!loading && !err && total > 0 && (
               <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-[#EFF3FF] text-xs font-medium text-[#55607A]">
                  <div>
                     Mostrando {intFmt.format(start)}–{intFmt.format(end)} de {intFmt.format(total)}
                  </div>

                  <div className="flex items-center gap-2">
                     <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={!hasPrev}
                        className="p-1.5 rounded-lg border border-[#E2EAFD] hover:bg-[#EEF3FF] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                     >
                        <IzquierdaIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </button>

                     <div className="w-7 h-7 rounded-full bg-[#1F6BFF] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                        {intFmt.format(page)}
                     </div>

                     <button
                        type="button"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={!hasNext}
                        className="p-1.5 rounded-lg border border-[#E2EAFD] hover:bg-[#EEF3FF] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                     >
                        <DerechaIcon className="w-4 h-4 text-[#0A1A3F]" />
                     </button>
                  </div>
               </div>
            )}
         </div>
      </div>
   );
}
