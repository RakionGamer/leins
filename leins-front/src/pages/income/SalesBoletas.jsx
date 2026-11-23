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
import QuickClassifyModal from '../../components/accounting/QuickClassifyModal';
import DocumentReconcileModal from '../../components/bank/DocumentReconcileModal';
import BoletaQueuePanel from '../../components/income/BoletaQueuePanel';
import { deleteManualIncome, listSiiDocuments } from '../../services/siiDocumentsApi';
import { SII_DOCUMENT_FILTERS, getSiiDocumentTypeLabel } from '../../utils/siiConstants';
import { toast } from 'components/Toaster';
import {
   DocumentDuplicateIcon,
   DocumentTextIcon,
   ChartBarIcon,
   PencilSquareIcon,
   CalendarDaysIcon,
   PlusIcon,
   FunnelIcon,
   ArrowPathIcon,
   TrashIcon,
   LinkIcon,
   ReceiptRefundIcon,
   CheckIcon,
   ArrowDownTrayIcon,
   MagnifyingGlassIcon,
   ChevronLeftIcon,
   ChevronRightIcon,
} from '@heroicons/react/24/outline';

// Formato de moneda chilena con espacio: "$ 12.480.300"
function formatClp(value) {
   const num = Math.round(Number(value || 0));
   const formatted = Math.abs(num).toLocaleString('es-CL');
   return num < 0 ? `-$ ${formatted}` : `$ ${formatted}`;
}

const intFmt = new Intl.NumberFormat('es-CL');

function periodToYYYYMM({ month, year }) {
   const m = String(month).padStart(2, '0');
   return `${year}-${m}`;
}

function todayYYYYMM() {
   const d = new Date();
   const m = String(d.getMonth() + 1).padStart(2, '0');
   return `${d.getFullYear()}-${m}`;
}

// Badge doble oficial Jeito (ej: [FAC | 33], [EXE | 34], [BTE | 39], [NC | 61])
function DocTypeBadge({ code, name }) {
   const c = Number(code);
   let label = 'DOC';
   let bgLeft = 'bg-[#0A1A3F]';

   if (c === 33) {
      label = 'FAC';
      bgLeft = 'bg-[#0A1A3F]';
   } else if (c === 34) {
      label = 'EXE';
      bgLeft = 'bg-[#1F6BFF]';
   } else if (c === 39) {
      label = 'BTE';
      bgLeft = 'bg-[#1F6BFF]';
   } else if (c === 41) {
      label = 'BEE';
      bgLeft = 'bg-[#1F6BFF]';
   } else if (c === 61) {
      label = 'NC';
      bgLeft = 'bg-[#E5484D]';
   } else if (c === 56) {
      label = 'ND';
      bgLeft = 'bg-[#13285C]';
   } else {
      label = name ? name.slice(0, 3).toUpperCase() : 'DOC';
      bgLeft = 'bg-[#0A1A3F]';
   }

   return (
      <div className="inline-flex items-center rounded-md overflow-hidden text-[10px] font-bold shadow-2xs">
         <span className={`${bgLeft} text-white px-2 py-0.5 tracking-wider font-nunito`}>{label}</span>
         <span className="bg-[#EEF3FF] text-[#0A1A3F] px-1.5 py-0.5 font-nunito font-extrabold">{c || ''}</span>
      </div>
   );
}

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

const MONTH_NAMES = [
   'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
   'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

function useDebounced(value, delay = 300) {
   const [d, setD] = useState(value);
   useEffect(() => {
      const t = setTimeout(() => setD(value), delay);
      return () => clearTimeout(t);
   }, [value, delay]);
   return d;
}

export default function SalesBoletas() {
   const [mainTab, setMainTab] = useState('documents'); // 'documents' | 'queue'
   const { period } = usePeriod();
   const { entityId: activeEntityId, ready } = useEntityRequired();
   const [sp, setSp] = useSearchParams();

   const [exportingCsv, setExportingCsv] = useState(false);
   const [isManualModalOpen, setIsManualModalOpen] = useState(false);
   const [isEditModalOpen, setIsEditModalOpen] = useState(false);
   const [documentToEdit, setDocumentToEdit] = useState(null);
   const [classifyModalOpen, setClassifyModalOpen] = useState(false);
   const [documentToClassify, setDocumentToClassify] = useState(null);
   const [reconcileModalOpen, setReconcileModalOpen] = useState(false);
   const [documentToReconcile, setDocumentToReconcile] = useState(null);

   const handleOpenReconcile = (doc) => {
      setDocumentToReconcile(doc);
      setReconcileModalOpen(true);
   };

   const [centralizationFilter, setCentralizationFilter] = useState(() => sp.get('centralization') || 'all');

   const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
   const [documentToLink, setDocumentToLink] = useState(null);
   const [linkFolio, setLinkFolio] = useState('');
   const [isLinking, setIsLinking] = useState(false);

   const [rows, setRows] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

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

   const [docType, setDocType] = useState(() => sp.get('type') || '');
   const [sourceFilter, setSourceFilter] = useState(() => sp.get('source') || '');
   const [folioFilter, setFolioFilter] = useState(() => sp.get('folio') || '');
   const [clientFilter, setClientFilter] = useState(() => sp.get('client') || '');
   const [mode, setMode] = useState(() => (sp.get('mode') === 'range' ? 'range' : 'month'));
   const [filterMonth, setFilterMonth] = useState(() => sp.get('month') || todayYYYYMM());
   const [fromDate, setFromDate] = useState(() => sp.get('from') || '');
   const [toDate, setToDate] = useState(() => sp.get('to') || '');
   const [entityId, setEntityId] = useState(() => sp.get('entityId') || sp.get('entity_id') || (activeEntityId ? String(activeEntityId) : ''));

   const ALLOWED_SORT = new Set(['issue_date', 'folio', 'total_amount', 'created_at', 'updated_at']);
   const [sort, setSort] = useState(() => ALLOWED_SORT.has(sp.get('sort')) ? sp.get('sort') : 'issue_date');
   const [order, setOrder] = useState(() => (sp.get('order') === 'asc' ? 'asc' : 'desc'));

   const [total, setTotal] = useState(0);
   const [totalPages, setTotalPages] = useState(1);
   const [hasPrev, setHasPrev] = useState(false);
   const [hasNext, setHasNext] = useState(false);
   const [refreshTrigger, setRefreshTrigger] = useState(0);

   // Totales calculados para las 5 tarjetas superiores
   const summaryTotals = useMemo(() => {
      let exentoBruto = 0;
      let afectoIvaBruto = 0;
      let notasCredito = 0;
      let totalFinal = 0;

      for (const r of rows) {
         const isNc = Number(r.doc_type_code) === 61;
         const ex = Number(r.exento || 0);
         const af = Number(r.afecto || 0);
         const iv = Number(r.iva || 0);
         const tot = Number(r.total || (ex + af + iv));

         if (isNc) {
            notasCredito += tot;
            totalFinal -= tot;
         } else {
            exentoBruto += ex;
            afectoIvaBruto += (af + iv);
            totalFinal += tot;
         }
      }

      return {
         documentos: rows.length,
         exentoBruto,
         afectoIvaBruto,
         notasCredito,
         totalFinal,
      };
   }, [rows]);

   const effectiveMonth = useMemo(() => filterMonth || (period ? periodToYYYYMM(period) : todayYYYYMM()), [filterMonth, period]);
   const debEntityId = useDebounced(entityId, 300);
   const debFolioFilter = useDebounced(folioFilter, 300);
   const debClientFilter = useDebounced(clientFilter, 300);

   const buildListParams = useCallback(({ pageOverride = page, limitOverride = pageSize, signal } = {}) => {
      const effectiveEntityId = debEntityId && /^\d+$/.test(String(debEntityId)) ? Number(debEntityId) : undefined;
      let reconciliationStatus = undefined;
      let classificationStatus = undefined;
      let centralizationStatus = undefined;

      if (centralizationFilter === 'unreconciled') reconciliationStatus = 'unreconciled';
      else if (centralizationFilter === 'unclassified') classificationStatus = 'unclassified';
      else if (centralizationFilter === 'pending') centralizationStatus = 'pending';
      else if (centralizationFilter === 'centralized') centralizationStatus = 'centralized';

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
         reconciliationStatus,
         classificationStatus,
         centralizationStatus,
         page: pageOverride,
         limit: limitOverride,
         sort,
         order,
         signal,
      };
   }, [docType, page, pageSize, sort, order, mode, effectiveMonth, fromDate, toDate, debEntityId, sourceFilter, debFolioFilter, debClientFilter, centralizationFilter]);

   const rangeInvalid = mode === 'range' && fromDate && toDate && new Date(toDate) < new Date(fromDate);

   const reloadData = () => setRefreshTrigger((prev) => prev + 1);
   const resetToFirstPage = () => setPage(1);

   const handleQuickClassify = (doc) => {
      setDocumentToClassify(doc);
      setClassifyModalOpen(true);
   };

   const openEditModal = (row) => {
      setDocumentToEdit(row);
      setIsEditModalOpen(true);
   };

   const handleDelete = async (id) => {
      const isConfirmed = window.confirm('¿Está seguro que desea eliminar este registro manual? Esta acción no se puede deshacer.');
      if (!isConfirmed) return;

      try {
         await deleteManualIncome(id);
         toast.success('Registro eliminado con éxito');
         reloadData();
      } catch (error) {
         toast.error(error.message || 'Ocurrió un error al intentar eliminar el registro.');
      }
   };

   const openLinkModal = (row) => {
      setDocumentToLink(row);
      setLinkFolio('');
      setIsLinkModalOpen(true);
   };

   const handleLinkSubmit = async (e) => {
      e.preventDefault();
      if (!linkFolio.trim()) {
         toast.error('Debe ingresar un folio');
         return;
      }
      setIsLinking(true);
      try {
         const { linkSiiDocumentReference } = await import('../../services/siiDocumentsApi');
         await linkSiiDocumentReference(documentToLink.id, linkFolio.trim());
         toast.success('Nota de Crédito vinculada con éxito');
         setIsLinkModalOpen(false);
         reloadData();
      } catch (error) {
         toast.error(error.message || 'Ocurrió un error al intentar vincular el documento.');
      } finally {
         setIsLinking(false);
      }
   };

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
      setDocType('');
      setSourceFilter('');
      setFolioFilter('');
      setClientFilter('');
      setMode('month');
      setFilterMonth(todayYYYYMM());
      setFromDate('');
      setToDate('');
      setCentralizationFilter('all');
      setPageSize(50);
      resetToFirstPage();
   };

   useEffect(() => {
      if (!ready || !activeEntityId) return;
      const nextEntity = String(activeEntityId);
      if (nextEntity !== entityId) {
         setEntityId(nextEntity);
         setPage(1);
      }
   }, [activeEntityId, entityId, ready]);

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
            const items = payload.rows || [];
            const mapped = items.map((it) => {
               const exento = Number(it.exempt_amount ?? it.amount_exempt ?? 0);
               const afecto = Number(it.net_amount ?? it.amount_net ?? 0);
               const iva = Number(it.vat_amount ?? it.amount_vat ?? 0);
               const total = Number(it.total_amount ?? (exento + afecto + iva));
               return {
                  id: it.id,
                  entity_id: it.entity_id,
                  date: it.issue_date || it.date || it.created_at || it.createdAt,
                  folio: it.folio,
                  doc_type: getSiiDocumentTypeLabel(it.doc_type_code),
                  doc_type_code: it.doc_type_code,
                  client_name: it.counterparty_name || it.counterparty_rut || '',
                  counterparty_rut: it.counterparty_rut,
                  counterparty_name: it.counterparty_name,
                  exento,
                  afecto,
                  iva,
                  total,
                  credit_notes_applied: Number(it.credit_notes_applied || 0),
                  source: it.source,
                  nce_nde_reference: it.nce_nde_reference,
                  is_reconciled: it.is_reconciled,
                  reconciliation_status: it.reconciliation_status,
                  remaining_amount: it.remaining_amount,
                  is_classified: it.is_classified,
                  is_exception: it.is_exception,
                  accounting_account_id: it.accounting_account_id,
                  classification_status: it.classification_status,
                  accounting_account: it.accounting_account,
                  is_centralized: it.is_centralized,
                  centralization_status: it.centralization_status,
               };
            });

            setRows(mapped);
            setTotal(Number(payload.total ?? mapped.length));
            setTotalPages(Number(payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? mapped.length) / pageSize))));
            setHasPrev(page > 1);
            setHasNext(page < Number(payload.totalPages ?? Math.max(1, Math.ceil((payload.total ?? mapped.length) / pageSize))));
         } catch (e) {
            if (e.name !== 'AbortError') setErr(e.message || 'Error al cargar documentos');
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
      if (entityId) {
         p.set('entityId', String(entityId));
         p.set('entity_id', String(entityId));
      }
      p.set('mode', mode);
      p.set('sort', sort);
      p.set('order', order);
      if (centralizationFilter && centralizationFilter !== 'all') p.set('centralization', centralizationFilter);
      if (mode === 'month') p.set('month', effectiveMonth);
      else {
         if (fromDate) p.set('from', fromDate);
         if (toDate) p.set('to', toDate);
      }
      p.set('page', String(page));
      p.set('limit', String(pageSize));
      setSp(p, { replace: true });
   }, [docType, sourceFilter, folioFilter, clientFilter, entityId, mode, sort, order, effectiveMonth, fromDate, toDate, page, pageSize, centralizationFilter, setSp]);

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
            const items = payload.rows || [];

            for (const it of items) {
               const exento = Number(it.exempt_amount ?? it.amount_exempt ?? 0);
               const afecto = Number(it.net_amount ?? it.amount_net ?? 0);
               const iva = Number(it.vat_amount ?? it.amount_vat ?? 0);
               const tot = Number(it.total_amount ?? (exento + afecto + iva));
               allRows.push([
                  it.issue_date || '',
                  it.folio || '',
                  getSiiDocumentTypeLabel(it.doc_type_code),
                  it.counterparty_name || it.counterparty_rut || '',
                  exento,
                  afecto,
                  iva,
                  tot,
                  it.source === 'MANUAL' ? 'Manual' : 'SII'
               ]);
            }
            totalPagesLocal = Number(payload.totalPages ?? 1);
            currentPage += 1;
         } while (currentPage <= totalPagesLocal);

         if (!allRows.length) return;
         const rowsCsv = [header, ...allRows].map((row) => row.map(csvEscape).join(DELIM)).join('\r\n');
         const content = `\uFEFFsep=${DELIM}\r\n${rowsCsv}`;
         const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
         const url = URL.createObjectURL(blob);
         const a = document.createElement('a');
         a.href = url;
         a.download = `ventas_sii.csv`;
         a.click();
         URL.revokeObjectURL(url);
      } catch (e) {
         toast.error(e.message || 'Error al exportar');
      } finally {
         setExportingCsv(false);
      }
   };

   const start = total ? (page - 1) * pageSize + 1 : 0;
   const end = total ? Math.min(total, page * pageSize) : 0;

   // Formato de texto del período para subtítulo
   const currentMonthNumber = Number(effectiveMonth.split('-')[1] || 1);
   const currentYearNumber = effectiveMonth.split('-')[0] || '';
   const periodMonthText = MONTH_NAMES[currentMonthNumber - 1] || 'el período';

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   return (
      <div className="space-y-6 text-[#0A1A3F] font-sans">
         {/* Modales de funcionalidad intacta */}
         <Modal isOpen={isManualModalOpen} onClose={() => setIsManualModalOpen(false)} title="Registrar Ingreso Manual" maxWidth="max-w-3xl">
            {isManualModalOpen && (
               <ManualIncomeForm
                  entityId={entityId || activeEntityId}
                  onSuccess={() => { setIsManualModalOpen(false); reloadData(); }}
                  onCancel={() => setIsManualModalOpen(false)}
               />
            )}
         </Modal>

         <DocumentReconcileModal
            isOpen={reconcileModalOpen}
            onClose={() => setReconcileModalOpen(false)}
            document={documentToReconcile}
            entityId={entityId || activeEntityId}
            onSuccess={reloadData}
         />

         <QuickClassifyModal
            isOpen={classifyModalOpen}
            onClose={() => setClassifyModalOpen(false)}
            document={documentToClassify}
            entityId={entityId || activeEntityId}
            onSuccess={reloadData}
         />

         <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Editar Registro" maxWidth="max-w-3xl">
            {isEditModalOpen && documentToEdit && (
               <EditIncomeForm
                  document={documentToEdit}
                  onSuccess={() => { setIsEditModalOpen(false); reloadData(); }}
                  onCancel={() => setIsEditModalOpen(false)}
               />
            )}
         </Modal>

         <Modal isOpen={isLinkModalOpen} onClose={() => setIsLinkModalOpen(false)} title="Vincular Nota de Crédito" maxWidth="max-w-md">
            {isLinkModalOpen && documentToLink && (
               <form onSubmit={handleLinkSubmit} className="space-y-4">
                  <p className="text-sm text-[#55607A]">
                     Ingresa el <strong className="text-[#0A1A3F]">Folio de la Factura</strong> a la que aplica esta Nota de Crédito (Folio NC: {documentToLink.folio}).
                  </p>
                  <div>
                     <label className="block text-xs font-bold uppercase tracking-wider text-[#55607A] mb-1">Folio de la Factura</label>
                     <input
                        type="text"
                        required
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                        placeholder="Ej: 835"
                        value={linkFolio}
                        onChange={(e) => setLinkFolio(e.target.value)}
                     />
                  </div>
                  <div className="flex justify-end gap-3 pt-4 border-t border-[#EFF3FF]">
                     <button
                        type="button"
                        onClick={() => setIsLinkModalOpen(false)}
                        className="px-4 py-2 text-xs font-bold text-[#55607A] hover:bg-[#EEF3FF] rounded-full transition-colors"
                     >
                        Cancelar
                     </button>
                     <button
                        type="submit"
                        disabled={isLinking}
                        className="px-5 py-2 bg-[#1F6BFF] text-white text-xs font-bold rounded-full hover:bg-[#1657D7] shadow-sm transition-colors disabled:opacity-50"
                     >
                        {isLinking ? 'Vinculando...' : 'Vincular Factura'}
                     </button>
                  </div>
               </form>
            )}
         </Modal>

         {/* ========================================================
             1. BREADCRUMBS & TITULAR
             ======================================================== */}
         <div className="flex flex-col gap-4">
            <div className="flex items-center gap-1.5 text-xs text-[#8E9BB5] font-medium">
               <span>Ingresos</span>
               <span>&gt;</span>
               <span className="text-[#0A1A3F]">Ventas</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
               <div>
                  <h1 className="text-3xl font-black font-nunito text-[#0A1A3F] tracking-tight">
                     Ventas (boletas y facturas)
                  </h1>
                  <p className="text-xs text-[#55607A] font-normal mt-1">
                     Tus boletas y facturas electrónicas, además de los ingresos que registras a mano.
                  </p>
               </div>

               {/* Pestañas superiores y Botones de Sincronización / Añadir */}
               <div className="flex flex-wrap items-center gap-2.5">
                  {/* Selector de tipo de ingreso */}
                  <div className="inline-flex p-1 bg-[#EEF3FF] rounded-full items-center gap-1">
                     <button
                        type="button"
                        onClick={() => setMainTab('documents')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                           mainTab === 'documents'
                              ? 'bg-white text-[#0A1A3F] shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F]'
                        }`}
                     >
                        Documentos electrónicos
                     </button>
                     <button
                        type="button"
                        onClick={() => setMainTab('queue')}
                        className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                           mainTab === 'queue'
                              ? 'bg-white text-[#0A1A3F] shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F]'
                        }`}
                     >
                        Otros (sin SII)
                     </button>
                  </div>

                  {/* Botón: Sincronizar boletas */}
                  <SiiSyncButton
                     type="boletas"
                     onSyncSuccess={reloadData}
                     className="rounded-full border border-[#E2EAFD] bg-white hover:bg-[#EEF3FF] text-[#0A1A3F] font-bold text-xs px-4 py-2 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                     label={
                        <>
                           <ArrowPathIcon className="w-3.5 h-3.5 text-[#0A1A3F]" />
                           <span>Sincronizar boletas</span>
                        </>
                     }
                  />

                  {/* Botón: Sincronizar facturas */}
                  <SiiSyncButton
                     type="sales-invoices"
                     onSyncSuccess={reloadData}
                     documentTypeOptions={[
                        { value: 33, label: '33 - Factura Afecta' },
                        { value: 34, label: '34 - Factura Exenta' },
                        { value: 61, label: '61 - Nota de Crédito' },
                     ]}
                     className="rounded-full border border-[#E2EAFD] bg-white hover:bg-[#EEF3FF] text-[#0A1A3F] font-bold text-xs px-4 py-2 transition-colors flex items-center gap-1.5 shadow-xs whitespace-nowrap cursor-pointer"
                     label={
                        <>
                           <ArrowPathIcon className="w-3.5 h-3.5 text-[#0A1A3F]" />
                           <span>Sincronizar facturas</span>
                        </>
                     }
                  />

                  {/* Botón Primario: + Añadir ingreso */}
                  <button
                     type="button"
                     onClick={() => setIsManualModalOpen(true)}
                     className="rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white font-black text-xs px-5 py-2 transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap cursor-pointer"
                  >
                     <span className="text-sm font-bold leading-none">+</span>
                     <span>Añadir ingreso</span>
                  </button>
               </div>
            </div>
         </div>

         {mainTab === 'queue' ? (
            <BoletaQueuePanel entityId={entityId} />
         ) : (
            <>
               {/* ========================================================
                   2. TARJETA DE FILTROS DE BÚSQUEDA
                   ======================================================== */}
               <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs space-y-4">
                  {/* Cabecera del filtro */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                     <div className="flex items-center gap-2 text-sm font-bold font-nunito text-[#0A1A3F]">
                        <FunnelIcon className="w-4 h-4 text-[#0A1A3F] stroke-[2]" />
                        <span>Filtros de búsqueda</span>
                     </div>
                     <div className="flex items-center gap-4">
                        <button
                           type="button"
                           onClick={handleClearFilters}
                           disabled={loading}
                           className="text-xs font-semibold text-[#55607A] hover:text-[#1F6BFF] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                        >
                           <ArrowPathIcon className="w-3.5 h-3.5" />
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

                  {/* Campos de filtro */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 items-end">
                     {/* ID ENT. */}
                     <div className="space-y-1 lg:col-span-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">ID Ent.</label>
                        <input
                           disabled
                           type="text"
                           value={entityId || ''}
                           className="w-full h-10 px-3 text-xs font-bold rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F]"
                        />
                     </div>

                     {/* FOLIO */}
                     <div className="space-y-1 lg:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Folio</label>
                        <input
                           type="text"
                           inputMode="numeric"
                           placeholder="Ej: 1605"
                           value={folioFilter}
                           onChange={(e) => { setFolioFilter(e.target.value); resetToFirstPage(); }}
                           className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF]"
                        />
                     </div>

                     {/* CLIENTE */}
                     <div className="space-y-1 lg:col-span-3">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Cliente</label>
                        <div className="relative flex items-center">
                           <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8E9BB5]">
                              <MagnifyingGlassIcon className="w-4 h-4" />
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

                     {/* TIPO */}
                     <div className="space-y-1 lg:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Tipo</label>
                        <select
                           value={docType}
                           onChange={(e) => { setDocType(e.target.value); resetToFirstPage(); }}
                           className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                        >
                           <option value="">Todos los tipos</option>
                           {SII_DOCUMENT_FILTERS.income.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                           ))}
                        </select>
                     </div>

                     {/* ORIGEN */}
                     <div className="space-y-1 lg:col-span-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Origen</label>
                        <select
                           value={sourceFilter}
                           onChange={(e) => { setSourceFilter(e.target.value); resetToFirstPage(); }}
                           className="w-full h-10 px-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                        >
                           <option value="">Todos</option>
                           <option value="SII">SII</option>
                           <option value="BOLETA_WORKER">Emisión Automática</option>
                           <option value="MANUAL">Manual</option>
                        </select>
                     </div>

                     {/* MES DE OPERACIÓN / RANGO */}
                     <div className="space-y-1 lg:col-span-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">
                           {mode === 'month' ? 'Mes de operación' : 'Rango de fechas'}
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
                     <div className="space-y-1 lg:col-span-1">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Por página</label>
                        <select
                           value={pageSize}
                           onChange={(e) => { setPageSize(Number(e.target.value) || 50); resetToFirstPage(); }}
                           className="w-full h-10 px-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                        >
                           <option value={20}>20 filas</option>
                           <option value={50}>50 filas</option>
                           <option value={100}>100 filas</option>
                        </select>
                     </div>
                  </div>

                  {/* Fila inferior: Centralización */}
                  <div className="flex items-center gap-3 pt-3 border-t border-[#EFF3FF]">
                     <span className="text-[10px] font-bold uppercase tracking-wider text-[#55607A]">
                        Centralización
                     </span>
                     <div className="inline-flex p-0.5 bg-[#EEF3FF] rounded-full items-center gap-0.5">
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
                              className={`px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
                                 centralizationFilter === f.key
                                    ? 'bg-white text-[#0A1A3F] shadow-xs'
                                    : 'text-[#55607A] hover:text-[#0A1A3F]'
                              }`}
                           >
                              {f.label}
                           </button>
                        ))}
                     </div>
                  </div>
               </div>

               {/* ========================================================
                   3. CINCO TARJETAS DE CIFRAS (KPI)
                   ======================================================== */}
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Card 1: Documentos */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
                     <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                        <DocumentTextIcon className="w-5 h-5 stroke-[2]" />
                     </div>
                     <div>
                        <div className="text-xs text-[#55607A] font-medium">Documentos</div>
                        <div className="text-2xl font-black font-nunito text-[#0A1A3F] mt-0.5">{intFmt.format(total || rows.length)}</div>
                     </div>
                  </div>

                  {/* Card 2: Exento total */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
                     <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                        <DocumentDuplicateIcon className="w-5 h-5 stroke-[2]" />
                     </div>
                     <div>
                        <div className="text-xs text-[#55607A] font-medium">Exento total</div>
                        <div className="text-xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-0.5">{formatClp(summaryTotals.exentoBruto)}</div>
                     </div>
                  </div>

                  {/* Card 3: Afecto + IVA total */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
                     <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                        <ChartBarIcon className="w-5 h-5 stroke-[2]" />
                     </div>
                     <div>
                        <div className="text-xs text-[#55607A] font-medium">Afecto + IVA total</div>
                        <div className="text-xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-0.5">{formatClp(summaryTotals.afectoIvaBruto)}</div>
                     </div>
                  </div>

                  {/* Card 4: Notas de crédito */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
                     <div className="h-10 w-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                        <ReceiptRefundIcon className="w-5 h-5 stroke-[2]" />
                     </div>
                     <div>
                        <div className="text-xs text-[#55607A] font-medium">Notas de crédito</div>
                        <div className="text-xl font-black font-nunito text-[#0A1A3F] tabular-nums mt-0.5">
                           {summaryTotals.notasCredito > 0 ? `-$ ${intFmt.format(summaryTotals.notasCredito)}` : '-$ 0'}
                        </div>
                     </div>
                  </div>

                  {/* Card 5: Total final (Tarjeta Azul Vivo Oficial) */}
                  <div className="col-span-2 lg:col-span-1 bg-[#1F6BFF] text-white rounded-2xl p-4 flex items-center gap-3.5 shadow-sm">
                     <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center text-white shrink-0">
                        <CheckIcon className="w-5 h-5 stroke-[3]" />
                     </div>
                     <div>
                        <div className="text-xs text-white/80 font-medium">Total final</div>
                        <div className="text-xl font-black font-nunito text-white tabular-nums mt-0.5">{formatClp(summaryTotals.totalFinal)}</div>
                     </div>
                  </div>
               </div>

               {/* ========================================================
                   4. TABLA DE DOCUMENTOS
                   ======================================================== */}
               <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs space-y-4">
                  {/* Encabezado de la tabla */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                     <div>
                        <h2 className="text-base font-bold font-nunito text-[#0A1A3F]">
                           Documentos
                        </h2>
                        <p className="text-xs text-[#55607A] mt-0.5">
                           {intFmt.format(total || rows.length)} documentos en {periodMonthText} {currentYearNumber}
                        </p>
                     </div>
                     <button
                        type="button"
                        onClick={exportCSV}
                        disabled={exportingCsv || !total}
                        className="text-xs font-semibold text-[#55607A] hover:text-[#1F6BFF] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                     >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        <span>{exportingCsv ? 'Exportando...' : 'Exportar Excel'}</span>
                     </button>
                  </div>

                  {/* Tabla */}
                  {loading && (
                     <div className="py-12 text-center text-[#1F6BFF] font-semibold text-xs animate-pulse">
                        Cargando documentos...
                     </div>
                  )}

                  {err && (
                     <div className="py-8 text-center text-red-600 font-semibold text-xs">
                        Error al cargar documentos: {err}
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
                                       onClick={() => {
                                          setOrder((s) => (sort === 'issue_date' ? (s === 'asc' ? 'desc' : 'asc') : 'desc'));
                                          setSort('issue_date');
                                          setPage(1);
                                       }}
                                    >
                                       <span>Fecha</span>
                                       <span className="text-[10px]">{sort === 'issue_date' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                                    </button>
                                 </th>
                                 <th className="py-3 px-3">
                                    <button
                                       type="button"
                                       className="flex items-center gap-1 hover:text-[#1F6BFF] transition-colors"
                                       onClick={() => {
                                          setOrder((s) => (sort === 'folio' ? (s === 'asc' ? 'desc' : 'asc') : 'desc'));
                                          setSort('folio');
                                          setPage(1);
                                       }}
                                    >
                                       <span>Folio</span>
                                       <span className="text-[10px]">{sort === 'folio' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                                    </button>
                                 </th>
                                 <th className="py-3 px-3 text-center">Tipo</th>
                                 <th className="py-3 px-3">Receptor</th>
                                 <th className="py-3 px-3 text-right">Exento</th>
                                 <th className="py-3 px-3 text-right">Afecto</th>
                                 <th className="py-3 px-3 text-right">IVA</th>
                                 <th className="py-3 px-3 text-right">
                                    <button
                                       type="button"
                                       className="flex items-center gap-1 justify-end w-full hover:text-[#1F6BFF] transition-colors"
                                       onClick={() => {
                                          setOrder((s) => (sort === 'total_amount' ? (s === 'asc' ? 'desc' : 'asc') : 'desc'));
                                          setSort('total_amount');
                                          setPage(1);
                                       }}
                                    >
                                       <span>Total</span>
                                       <span className="text-[10px]">{sort === 'total_amount' ? (order === 'asc' ? '↑' : '↓') : '⇅'}</span>
                                    </button>
                                 </th>
                                 <th className="py-3 px-3 text-center">Cobro</th>
                                 <th className="py-3 px-3 text-center">Clasificación</th>
                                 <th className="py-3 px-3 text-center">Origen</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-[#EFF3FF]">
                              {rows.length === 0 ? (
                                 <tr>
                                    <td colSpan={11} className="py-12 text-center text-xs text-[#8E9BB5] italic">
                                       No se encontraron documentos para los filtros aplicados.
                                    </td>
                                 </tr>
                              ) : (
                                 rows.map((r) => (
                                    <tr key={r.id} className="hover:bg-[#F8FAFF] transition-colors group">
                                       {/* Fecha */}
                                       <td className="py-3.5 px-3 text-xs font-medium text-[#0A1A3F] tabular-nums whitespace-nowrap">
                                          {fmtDateChilean(r.date)}
                                       </td>

                                       {/* Folio */}
                                       <td className="py-3.5 px-3 text-xs font-bold text-[#0A1A3F] font-nunito whitespace-nowrap">
                                          {r.folio || '—'}
                                       </td>

                                       {/* Tipo (Badge oficial dual) */}
                                       <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                          <div className="flex items-center justify-center gap-1.5">
                                             <DocTypeBadge code={r.doc_type_code} name={r.doc_type} />
                                             {r.credit_notes_applied > 0 && r.doc_type_code !== 61 && (
                                                <span
                                                   className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700"
                                                   title={`Se han descontado ${formatClp(r.credit_notes_applied)} en Notas de Crédito`}
                                                >
                                                   {r.credit_notes_applied >= r.total ? 'Anulada' : 'Corregida'}
                                                </span>
                                             )}
                                          </div>
                                       </td>

                                       {/* Receptor */}
                                       <td className="py-3.5 px-3 min-w-[180px] max-w-[260px]">
                                          <div className="text-xs font-bold text-[#0A1A3F] truncate">
                                             {r.client_name || r.counterparty_name || 'Sin nombre'}
                                          </div>
                                          {r.counterparty_rut && (
                                             <div className="text-[11px] text-[#8E9BB5] font-medium mt-0.5">
                                                {r.counterparty_rut}
                                             </div>
                                          )}
                                       </td>

                                       {/* Exento */}
                                       <td className="py-3.5 px-3 text-xs text-[#55607A] tabular-nums text-right whitespace-nowrap">
                                          {r.exento > 0 ? formatClp(r.exento) : '—'}
                                       </td>

                                       {/* Afecto */}
                                       <td className="py-3.5 px-3 text-xs text-[#55607A] tabular-nums text-right whitespace-nowrap">
                                          {r.afecto > 0 ? formatClp(r.afecto) : '—'}
                                       </td>

                                       {/* IVA */}
                                       <td className="py-3.5 px-3 text-xs text-[#55607A] tabular-nums text-right whitespace-nowrap">
                                          {r.iva > 0 ? formatClp(r.iva) : '—'}
                                       </td>

                                       {/* Total */}
                                       <td className="py-3.5 px-3 text-xs font-bold text-[#0A1A3F] tabular-nums text-right whitespace-nowrap">
                                          {formatClp(r.total)}
                                       </td>

                                       {/* Cobro */}
                                       <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                          {r.is_reconciled ? (
                                             <button
                                                type="button"
                                                onClick={() => handleOpenReconcile(r)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EEF3FF] text-[#1F6BFF] hover:bg-[#DCE5FF] transition-colors cursor-pointer shadow-xs"
                                                title="Cobrado y conciliado con banco"
                                             >
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF]" />
                                                <span>Cobrado</span>
                                             </button>
                                          ) : (
                                             <button
                                                type="button"
                                                onClick={() => handleOpenReconcile(r)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#0A1A3F] text-white hover:bg-[#13285C] transition-colors cursor-pointer shadow-xs"
                                                title={r.remaining_amount ? `Pendiente: ${formatClp(r.remaining_amount)}` : 'Pendiente de cobro'}
                                             >
                                                <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                                <span>Pendiente</span>
                                             </button>
                                          )}
                                       </td>

                                       {/* Clasificación */}
                                       <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                          {r.is_classified ? (
                                             <button
                                                type="button"
                                                onClick={() => handleQuickClassify(r)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#EEF3FF] text-[#1F6BFF] hover:bg-[#DCE5FF] transition-colors cursor-pointer shadow-xs"
                                                title={r.accounting_account?.name || 'Clasificado'}
                                             >
                                                <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF]" />
                                                <span>Clasificado</span>
                                             </button>
                                          ) : (
                                             <button
                                                type="button"
                                                onClick={() => handleQuickClassify(r)}
                                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-[#E2EAFD] bg-white text-[#0A1A3F] hover:bg-[#EEF3FF] transition-colors cursor-pointer shadow-xs"
                                                title="Sin clasificar contablemente"
                                             >
                                                <span className="w-2 h-2 rounded-full border border-[#55607A]" />
                                                <span>Sin clasificar</span>
                                             </button>
                                          )}
                                       </td>

                                       {/* Origen */}
                                       <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                          <div className="inline-flex items-center gap-1.5 justify-center">
                                             <span className="bg-[#EEF3FF] text-[#55607A] text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                                                {r.source === 'MANUAL' ? 'Manual' : 'SII'}
                                             </span>

                                             {r.doc_type_code === 61 && !r.nce_nde_reference && (
                                                <button
                                                   type="button"
                                                   onClick={() => openLinkModal(r)}
                                                   className="p-1 rounded-lg text-[#1F6BFF] hover:bg-[#EFF3FF] transition-colors"
                                                   title="Vincular a Factura"
                                                >
                                                   <LinkIcon className="w-3.5 h-3.5" />
                                                </button>
                                             )}

                                             {r.source === 'MANUAL' && (
                                                <div className="flex items-center gap-0.5">
                                                   <button
                                                      type="button"
                                                      onClick={() => openEditModal(r)}
                                                      className="p-1 rounded-lg text-[#55607A] hover:text-[#1F6BFF] hover:bg-[#EFF3FF] transition-colors"
                                                      title="Editar registro manual"
                                                   >
                                                      <PencilSquareIcon className="w-3.5 h-3.5" />
                                                   </button>
                                                   <button
                                                      type="button"
                                                      onClick={() => handleDelete(r.id)}
                                                      className="p-1 rounded-lg text-[#55607A] hover:text-red-600 hover:bg-red-50 transition-colors"
                                                      title="Eliminar registro manual"
                                                   >
                                                      <TrashIcon className="w-3.5 h-3.5" />
                                                   </button>
                                                </div>
                                             )}
                                          </div>
                                       </td>
                                    </tr>
                                 ))
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
                              className="p-1.5 rounded-lg border border-[#E2EAFD] hover:bg-[#EEF3FF] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                           >
                              <ChevronLeftIcon className="w-4 h-4 text-[#0A1A3F]" />
                           </button>

                           <div className="w-7 h-7 rounded-full bg-[#1F6BFF] text-white font-bold text-xs flex items-center justify-center shadow-xs">
                              {intFmt.format(page)}
                           </div>

                           <button
                              type="button"
                              onClick={() => setPage((p) => p + 1)}
                              disabled={!hasNext}
                              className="p-1.5 rounded-lg border border-[#E2EAFD] hover:bg-[#EEF3FF] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                           >
                              <ChevronRightIcon className="w-4 h-4 text-[#0A1A3F]" />
                           </button>
                        </div>
                     </div>
                  )}
               </div>
            </>
         )}
      </div>
   );
}
