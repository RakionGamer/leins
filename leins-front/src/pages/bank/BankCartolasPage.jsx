import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useAuth } from '../../context/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import ReconcileSuggestionsPanel from 'components/ReconcileSuggestionsPanel';
import DateInput from 'components/DateInput'
import { fetchSuggestionsCount, autofindCandidates, reconcileOne, reconcileDirectExpense, reconcileBankTransaction, searchBankReconcileCandidates, reconcileBulk, listReconciliations, unreconcile, deleteBankTransaction } from '../../services/reconcileApi';
import { getAccounts } from '../../services/accountingApi';
import AccountSelect from '../../components/accounting/AccountSelect';
import { uploadBankExcel, listBankAccounts, syncEmissoBankAccount } from '../../services/entitiesApi';
import { toast } from 'components/Toaster';
import PrimaryButton from 'components/PrimaryButton';
import { getRutFromRow } from '../../utils/validators';
import { normalizeAmount, fmtCLP, hexToRgba, toYmd } from '../../utils/formatters';
import { SII_DOCUMENT_TYPES, docTag, getSiiDocumentTypeLabel } from '../../utils/siiConstants';
import {
   ExcelIcon,
   DocumentoIcon,
   MasIcon,
   CheckIcon,
   FiltroIcon,
   BuscarIcon,
   VerIcon,
   MasOpcionesIcon,
   IzquierdaIcon,
   DerechaIcon,
   ConciliarIcon,
   EliminarIcon,
   SincronizarIcon,
   CalendarioIcon,
   IngresosIcon,
   EgresosIcon,
   SubirIcon,
   CerrarIcon,
} from '../../components/icons/SidebarIcons';
import { getDashboardSummary } from '../../services/dashboardApi';
import { listDailySalesGroups, listSiiDocuments } from '../../services/siiDocumentsApi';
import BankCartolaDuplicatesAlert from '../../components/bank/BankCartolaDuplicatesAlert';
import EmissoSyncPeriodModal from '../../components/bank/EmissoSyncPeriodModal';

import BatchBoletearConfirmModal from '../../components/bank/BatchBoletearConfirmModal';
import { getActiveBoletaMap, cancelBoletaRequest, retryBoletaRequest } from '../../services/boletaQueueApi';

// importamos nuestras nuevas herramientas de react query
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useBankTransactions } from '../../hooks/useBankTransactions';
import { useBankTotals } from '../../hooks/useBankTotals';

// ===========================
// utils & constants
// ===========================
const MAX_SIZE_MB = 10;
const allowedExt = ['.xlsx', '.xls'];
const STANDARD_TEMPLATE_HEADERS = ['Fecha', 'Descripcion', 'Monto', 'Saldo', 'No Documento', 'Sucursal'];
const SPLIT_DEBIT_CREDIT_TEMPLATE_HEADERS = ['Fecha', 'Descripcion', 'Abonos', 'Cargos', 'Saldo', 'No Documento', 'Sucursal'];
const TEMPLATE_COLUMN_WIDTHS = [
   { wch: 12 },
   { wch: 36 },
   { wch: 14 },
   { wch: 14 },
   { wch: 14 },
   { wch: 16 },
   { wch: 16 },
];
const TEMPLATE_GUIDE_COLUMN_WIDTHS = [
   { wch: 18 },
   { wch: 12 },
   { wch: 30 },
   { wch: 58 },
];
const SUGGESTIONS_BADGE_CAP = 50;

const buildTemplateGuideRows = ({ splitDebitCredit = false } = {}) => ([
   ['Campo', 'Obligatorio', 'Formato', 'Descripcion'],
   ['Fecha', 'Si', 'DD/MM/YYYY, DD-MM-YYYY o YYYY-MM-DD', 'Fecha del movimiento bancario'],
   ['Descripcion', 'Si', 'Texto', 'Descripcion del movimiento'],
   ...(splitDebitCredit
      ? [
         ['Abonos', 'Si', 'Numero positivo', 'Monto de entrada. Debe venir vacio si la fila es cargo'],
         ['Cargos', 'Si', 'Numero positivo', 'Monto de salida. Debe venir vacio si la fila es abono'],
      ]
      : [
         ['Monto', 'Si', 'Numero con signo', 'Usa positivo para abono y negativo para cargo'],
      ]),
   ['Saldo', 'No', 'Numero', 'Saldo disponible despues del movimiento'],
   ['No Documento', 'No', 'Texto', 'Referencia interna del banco'],
   ['Sucursal', 'No', 'Texto', 'Sucursal o canal del movimiento'],
   ['Regla', '-', '-', 'No agregues filas de resumen como saldo inicial o saldo final'],
]);

const downloadMovementsTemplate = (headers, filename, { splitDebitCredit = false } = {}) => {
   const wb = XLSX.utils.book_new();
   const ws = XLSX.utils.aoa_to_sheet([headers]);
   const guideWs = XLSX.utils.aoa_to_sheet(buildTemplateGuideRows({ splitDebitCredit }));
   ws['!cols'] = TEMPLATE_COLUMN_WIDTHS.slice(0, headers.length);
   guideWs['!cols'] = TEMPLATE_GUIDE_COLUMN_WIDTHS;
   XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
   XLSX.utils.book_append_sheet(wb, guideWs, 'Guia');
   XLSX.writeFile(wb, filename);
};

const isAllowed = (file) => {
   if (!file) return false;
   const name = file.name?.toLowerCase() || '';
   const okExt = allowedExt.some(ext => name.endsWith(ext));
   const okSize = file.size <= MAX_SIZE_MB * 1024 * 1024;
   return okExt && okSize;
};

const normalizeHeaderKey = (value) => String(value || '')
   .normalize('NFD')
   .replace(/[\u0300-\u036f]/g, '')
   .toLowerCase()
   .replace(/\s+/g, ' ')
   .replace(/[^a-z0-9/ ]/g, '')
   .trim();

const hasDescripcionHeader = (headerSet) =>
   headerSet.has('descripcion')
   || Array.from(headerSet).some(k => k.startsWith('descripcion'));

const hasAbonosHeader = (headerSet) =>
   headerSet.has('abonos')
   || headerSet.has('abono')
   || headerSet.has('haber')
   || headerSet.has('depositos')
   || headerSet.has('deposito');

const hasCargosHeader = (headerSet) =>
   headerSet.has('cargos')
   || headerSet.has('cargo')
   || headerSet.has('debe')
   || headerSet.has('retiros')
   || headerSet.has('retiro');

const detectMovementsHeader = (headerSet, { splitDebitCredit = false } = {}) => {
   const hasFecha = headerSet.has('fecha');
   const hasDesc = hasDescripcionHeader(headerSet);
   const hasMonto = headerSet.has('monto') || headerSet.has('importe');
   const hasAbonos = hasAbonosHeader(headerSet);
   const hasCargos = hasCargosHeader(headerSet);

   if (splitDebitCredit) {
      if (hasFecha && hasDesc && hasAbonos && hasCargos) return { ok: true, mode: 'split' };

      const missingSplit = [];
      if (!hasFecha) missingSplit.push('Fecha');
      if (!hasDesc) missingSplit.push('Descripcion');
      if (!hasAbonos) missingSplit.push('Abonos');
      if (!hasCargos) missingSplit.push('Cargos');

      return {
         ok: false,
         missing: missingSplit,
         message: `Formato no valido. Debe incluir: Fecha, Descripcion, Abonos, Cargos${missingSplit.length ? ` (faltan: ${missingSplit.join(', ')})` : ''}.`,
      };
   }

   if (hasFecha && hasDesc && hasMonto) return { ok: true, mode: 'monto' };

   const missing = [];
   if (!hasFecha) missing.push('Fecha');
   if (!hasDesc) missing.push('Descripcion');
   if (!hasMonto) missing.push('Monto');

   return {
      ok: false,
      missing,
      message: `Formato no valido. Debe incluir: Fecha, Descripcion, Monto${missing.length ? ` (faltan: ${missing.join(', ')})` : ''}. Puedes descargar la plantilla.`
   };
};

const toVisibleHeaders = (row = []) => row
   .map(v => String(v ?? '').trim())
   .filter(Boolean)
   .slice(0, 20);

const pickLikelyHeaderRow = (rows2D = []) => {
   let best = null;

   rows2D.forEach((row, idx) => {
      const visible = toVisibleHeaders(row);
      if (!visible.length) return;

      const headerSet = new Set(visible.map(normalizeHeaderKey).filter(Boolean));
      const hasFecha = headerSet.has('fecha') ? 1 : 0;
      const hasDesc = hasDescripcionHeader(headerSet) ? 1 : 0;
      const hasMonto = (headerSet.has('monto') || headerSet.has('importe')) ? 1 : 0;
      const hasSplit = (hasAbonosHeader(headerSet) ? 1 : 0) + (hasCargosHeader(headerSet) ? 1 : 0);
      const score = (hasFecha * 3) + (hasDesc * 3) + (hasMonto * 3) + (hasSplit * 3) + (Math.min(visible.length, 8) * 0.1);

      if (!best || score > best.score) {
         best = { index: idx, score, visible, headerSet };
      }
   });

   return best;
};

const validateMovementsExcelFile = async (file, { splitDebitCredit = false } = {}) => {
   const buffer = await file.arrayBuffer();
   const wb = XLSX.read(buffer, { type: 'array' });
   const sheetName = wb.SheetNames?.[0];
   if (!sheetName) {
      return { ok: false, message: 'El archivo Excel no contiene hojas.' };
   }

   const ws = wb.Sheets[sheetName];
   const rows2D = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: false });
   if (!rows2D.length) {
      return { ok: false, message: 'El archivo Excel no contiene datos.' };
   }

   const maxRowsToScan = Math.min(rows2D.length, 30);
   const topRows = rows2D.slice(0, maxRowsToScan);
   let detectedHeader = null;
   let headerRowIndex = -1;

   for (let i = 0; i < topRows.length; i += 1) {
      const row = topRows[i] || [];
      const headerSet = new Set(row.map(normalizeHeaderKey).filter(Boolean));
      const detected = detectMovementsHeader(headerSet, { splitDebitCredit });
      if (detected.ok) {
         detectedHeader = detected;
         headerRowIndex = i;
         break;
      }
   }

   if (!detectedHeader) {
      const likely = pickLikelyHeaderRow(topRows);
      const fallback = detectMovementsHeader(likely?.headerSet || new Set(), { splitDebitCredit });
      return {
         ...fallback,
         detectedColumns: likely?.visible || [],
         headerRow: Number.isInteger(likely?.index) ? likely.index + 1 : null
      };
   }

   // Analizar filas de datos y extraer duplicados
   const headerRow = headerRowIndex + 1;
   const headers = (rows2D[headerRowIndex] || []).map(normalizeHeaderKey);
   const colIndex = {
      fecha: headers.findIndex(h => h === 'fecha'),
      desc: headers.findIndex(h => hasDescripcionHeader(new Set([h]))),
      monto: headers.findIndex(h => h === 'monto' || h === 'importe'),
      abonos: headers.findIndex(h => hasAbonosHeader(new Set([h]))),
      cargos: headers.findIndex(h => hasCargosHeader(new Set([h]))),
      doc: headers.findIndex(h => h && h.includes('documento')),
      saldo: headers.findIndex(h => h === 'saldo'),
   };

   const dataRows = [];
   for (let i = headerRow; i < rows2D.length; i += 1) {
      const r = rows2D[i];
      if (!r || !r.length) continue;
      if (r.every(cell => cell === null || cell === undefined || String(cell).trim() === '')) continue;

      const rawDate = colIndex.fecha >= 0 ? r[colIndex.fecha] : null;
      const rawDesc = colIndex.desc >= 0 ? r[colIndex.desc] : null;
      const rawMonto = colIndex.monto >= 0 ? r[colIndex.monto] : null;
      const rawAbono = colIndex.abonos >= 0 ? r[colIndex.abonos] : null;
      const rawCargo = colIndex.cargos >= 0 ? r[colIndex.cargos] : null;
      const rawDoc = colIndex.doc >= 0 ? r[colIndex.doc] : null;

      let amount = 0;
      if (splitDebitCredit) {
         const a = normalizeAmount(rawAbono);
         const c = normalizeAmount(rawCargo);
         if (rawAbono && a > 0) amount = a;
         else if (rawCargo && c > 0) amount = -c;
         else amount = 0;
      } else {
         amount = normalizeAmount(rawMonto);
      }

      const d = parseDateToYmd(rawDate) || String(rawDate || '').trim();
      const desc = String(rawDesc || '').trim();

      dataRows.push({
         excelRowNumber: i + 1,
         rowIndex2D: i,
         date: d,
         rawDate: String(rawDate || '').trim(),
         amount,
         desc,
         doc: rawDoc ? String(rawDoc).trim() : '',
      });
   }

   // Agrupar filas para detectar duplicados (misma fecha, monto y descripción)
   const groupsMap = new Map();
   dataRows.forEach((r) => {
      const cleanDesc = r.desc.toLowerCase().replace(/\s+/g, ' ');
      const key = `${r.date}__${r.amount}__${cleanDesc}`;
      if (!groupsMap.has(key)) {
         groupsMap.set(key, []);
      }
      groupsMap.get(key).push(r);
   });

   const duplicateGroups = [];
   let groupId = 1;
   groupsMap.forEach((gRows, key) => {
      if (gRows.length > 1) {
         duplicateGroups.push({
            id: `dup-${groupId++}`,
            key,
            date: gRows[0].date || gRows[0].rawDate,
            amount: gRows[0].amount,
            desc: gRows[0].desc,
            rows: gRows,
            selectedRowNumbers: new Set([gRows[0].excelRowNumber]), // por defecto deja 1
         });
      }
   });

   return {
      ok: true,
      mode: detectedHeader.mode,
      headerRow,
      wb,
      ws,
      sheetName,
      rows2D,
      totalDataRows: dataRows.length,
      duplicateGroups,
   };
};

const FILTER_PANEL_ID = "cartolas-filtros";
const FILTER_HEADING_ID = "cartolas-filtros-titulo";

const DEFAULT_FILTERS = {
   tipo: "Todos",
   fechaIni: "",
   fechaFin: "",
   montoFiltro: "",
   ctaCorriente: "",
   descripcion: "",
   cuenta: "",
   nroDocumento: "",
   folioConciliado: "",
};

function parseDateToYmd(value) {
   if (!value) return null;
   const text = String(value).trim();
   const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
   if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

   const cl = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
   if (cl) {
      const [, day, month, year] = cl;
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
   }

   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return null;
   return date.toISOString().slice(0, 10);
}

function addDaysYmd(ymd, days) {
   if (!ymd) return null;
   const date = new Date(`${ymd}T12:00:00`);
   if (Number.isNaN(date.getTime())) return null;
   date.setDate(date.getDate() + days);
   return date.toISOString().slice(0, 10);
}

function getDocumentPendingAmount(doc) {
   const remaining = Number(doc?.remaining_amount);
   if (Number.isFinite(remaining)) return Math.max(0, remaining);

   const total = Number(doc?.total_amount ?? doc?.total ?? 0);
   return Number.isFinite(total) && total > 0 ? total : 0;
}

function getBankTransactionDate(row) {
   return parseDateToYmd(
      row?.raw?.issued_at ||
      row?.raw?.movement_date ||
      row?.raw?.date ||
      row?.fecha
   );
}

// ===========================
// componentes ui puros
// ===========================
const TabButton = React.memo(function TabButton({ active, onClick, children, rightBadge }) {
   return (
      <button
         type="button"
         onClick={onClick}
         className={`px-3.5 py-1 text-xs rounded-full flex items-center gap-1.5 transition-all cursor-pointer select-none ${
            active
               ? "bg-white text-[#0A1A3F] font-bold shadow-xs"
               : "text-[#55607A] hover:text-[#0A1A3F] font-semibold"
         }`}
         role="tab"
         aria-selected={active}
         tabIndex={active ? 0 : -1}
      >
         <span>{children}</span>
         {rightBadge}
      </button>
   );
});

function useTweenNumber(value, durationMs = 300) {
   const [display, setDisplay] = React.useState(Number(value) || 0);
   const prevRef = React.useRef(Number(value) || 0);
   const rafRef = React.useRef(0);

   React.useEffect(() => {
      const from = prevRef.current;
      const to = Number(value) || 0;
      if (from === to) return;

      const start = performance.now();
      cancelAnimationFrame(rafRef.current);

      const tick = (now) => {
         const t = Math.min(1, (now - start) / durationMs);
         const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
         setDisplay(from + (to - from) * eased);
         if (t < 1) {
            rafRef.current = requestAnimationFrame(tick);
         } else {
            prevRef.current = to;
            setDisplay(to);
         }
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(rafRef.current);
   }, [value, durationMs]);

   return display;
}

function AnimatedAmount({ value, fmt, busy = false, bold = false, danger = false }) {
   const tween = useTweenNumber(value ?? 0, 500);
   const text = fmt ? fmt(Math.round(tween)) : Math.round(tween).toLocaleString();

   return (
      <span className={`inline-flex items-center gap-2 ${bold ? 'font-extrabold' : 'font-semibold'}`}>
         <span className={danger ? 'text-[var(--danger)]' : ''}>{text}</span>
         {busy && (
            <span className="relative inline-flex">
               <span className="animate-pulse w-2 h-2 rounded-full bg-[var(--text-soft)]/50" />
               <span className="animate-pulse w-2 h-2 rounded-full bg-[var(--text-soft)]/50 ml-1 [animation-delay:120ms]" />
               <span className="animate-pulse w-2 h-2 rounded-full bg-[var(--text-soft)]/50 ml-1 [animation-delay:240ms]" />
            </span>
         )}
      </span>
   );
}


const formatYmdToDmy = (ymd) => {
   if (!ymd || typeof ymd !== 'string') return ymd || '—';
   const parts = ymd.split('-');
   if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
   }
   return ymd;
};

const renderDocBadge = (docType, folio) => {
   const tag = docTag(docType);
   const codeStr = String(docType ?? '');
   const isFac = codeStr === '33' || codeStr === '34' || codeStr === '46' || tag?.abbr?.startsWith('FAC');
   const isBte = codeStr === '39' || codeStr === '41' || tag?.abbr?.startsWith('BTE');
   const abbr = isFac ? 'FAC' : (isBte ? 'BTE' : (tag?.abbr || 'DOC'));
   const bgColor = isBte ? '#1F6BFF' : (isFac ? '#0A1A3F' : (tag?.color || '#1F6BFF'));
   return (
      <span className="inline-flex items-center rounded-md overflow-hidden text-[10px] font-bold border border-[#E2EAFD] shadow-2xs">
         <span className="px-2 h-5 flex items-center text-white" style={{ backgroundColor: bgColor }}>
            {abbr}
         </span>
         <span className="px-2 h-5 flex items-center bg-white text-[#0A1A3F] font-semibold border-l border-[#E2EAFD]">
            {folio || '—'}
         </span>
      </span>
   );
};

export default function BankCartolasPage() {
   const queryClient = useQueryClient();
   const { auth, isClient } = useAuth();
   const { entityId, ready, permissions } = useEntityRequired();
   const { can } = usePermissions();
   const canBoletear = can('bank_movements', 'boletear');
   const canSyncBank = can('bank_movements', 'bank_sync');
   const canUploadCartola = can('bank_movements', 'upload_cartola');
   const canReconcile = can('bank_movements', 'reconcile');
   const canUnreconcile = can('bank_movements', 'unreconcile');
   const canDeleteMovement = can('bank_movements', 'delete_movement');
   const canCreate = canUploadCartola;
   const canUpdate = canReconcile;
   const canDelete = canDeleteMovement;

   const hasAuth = !!(auth?.accessToken || localStorage.getItem("accessToken"));
   const headers = useMemo(() => {
      const token = auth?.accessToken || localStorage.getItem("accessToken");
      return {
         "Content-Type": "application/json",
         ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
   }, [auth]);

   // ===========================
   // estado principal
   // ===========================
   const [tab, setTab] = useState("todos");
   const [soloPorConciliar, setSoloPorConciliar] = useState(false);
   const [mostrarFiltros, setMostrarFiltros] = useState(true);

   // paginacion
   const [pageSize, setPageSize] = useState(50);
   const [page, setPage] = useState(0);

   // filtros de formulario (inputs)
   const [tipo, setTipo] = useState("Todos");
   const [fechaIni, setFechaIni] = useState("");
   const [fechaFin, setFechaFin] = useState("");
   const [montoFiltro, setMontoFiltro] = useState("");
   const [ctaCorriente, setCtaCorriente] = useState("");
   const [descripcion, setDescripcion] = useState("");
   const [cuenta, setCuenta] = useState("");
   const [nroDocumento, setNroDocumento] = useState("");
   const [folioConciliado, setFolioConciliado] = useState("");
   const [reconciliationDetailTxId, setReconciliationDetailTxId] = useState(null);
   const [reconciliationDetailTxAmount, setReconciliationDetailTxAmount] = useState(0);
   const [undoingReconciliationId, setUndoingReconciliationId] = useState(null);
   const [deletingTxId, setDeletingTxId] = useState(null);
   const [selectedBoleteoIds, setSelectedBoleteoIds] = useState(new Set());
   const [batchBoletearModalOpen, setBatchBoletearModalOpen] = useState(false);
   const [openActionMenuId, setOpenActionMenuId] = useState(null);
   const [quickSearch, setQuickSearch] = useState('');

   useEffect(() => {
      const handleClickOutside = () => setOpenActionMenuId(null);
      if (openActionMenuId) {
         window.addEventListener('click', handleClickOutside);
         return () => window.removeEventListener('click', handleClickOutside);
      }
   }, [openActionMenuId]);

   const handleQuickSearchChange = (e) => {
      const val = e.target.value;
      setQuickSearch(val);
      setDescripcion(val);
      setApplied((prev) => ({ ...prev, descripcion: val }));
      setPage(0);
   };



   // filtros aplicados (los que disparan la busqueda)
   const [applied, setApplied] = useState(DEFAULT_FILTERS);

   // helper para inyectar el filtro de tipo segun la pestana
   const effectiveFilters = useMemo(() => {
      if (tab === 'abonos') return { ...applied, tipo: 'Abonos' };
      if (tab === 'cargos') return { ...applied, tipo: 'Cargos' };
      return { ...applied };
   }, [tab, applied]);

   const reconcileSuggestionType = useMemo(() => {
      const movementType = effectiveFilters.tipo;
      if (movementType === 'Abonos') return 'income';
      if (movementType === 'Cargos') return 'expense';
      return null;
   }, [effectiveFilters.tipo]);

   const reconcileSuggestionAccountId = useMemo(() => {
      const parsed = Number(effectiveFilters.ctaCorriente);
      return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
   }, [effectiveFilters.ctaCorriente]);

   // ===========================
   // integracion react query
   // ===========================

   // 1. listado de movimientos
   const { transactions: bankRows, total, isLoading: loadingMovs } = useBankTransactions(entityId, {
      limit: pageSize,
      offset: page * pageSize,
      soloPendientes: soloPorConciliar,
      filters: effectiveFilters
   });

   const currentMonth = useMemo(() => {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
   }, []);

   const { data: dashboardSummary } = useQuery({
      queryKey: ['dashboardSummary', entityId, currentMonth, 'month'],
      queryFn: () => getDashboardSummary({ entityId, month: currentMonth, scope: 'month' }),
      enabled: Boolean(entityId),
      staleTime: 60000,
   });

   const qualityBank = dashboardSummary?.quality?.bank || {};

   const rowStats = useMemo(() => {
      let abonosSum = 0;
      let cargosSum = 0;
      let reconciledCount = 0;
      let pendingCount = 0;
      for (const r of bankRows) {
         if (r.monto > 0) abonosSum += r.monto;
         else if (r.monto < 0) cargosSum += Math.abs(r.monto);
         const remaining = Math.max(0, Number(r.raw?.remaining_amount ?? Math.abs(r.monto)));
         if (remaining === 0) reconciledCount++;
         else pendingCount++;
      }
      return { abonosSum, cargosSum, reconciledCount, pendingCount };
   }, [bankRows]);

   const reconciledPercent = qualityBank.reconciledRatio != null
      ? Number(qualityBank.reconciledRatio)
      : (rowStats.reconciledCount + rowStats.pendingCount > 0
         ? (rowStats.reconciledCount / (rowStats.reconciledCount + rowStats.pendingCount)) * 100
         : 100);

   const pendingMovements = qualityBank.pendingTransactions != null
      ? Number(qualityBank.pendingTransactions)
      : rowStats.pendingCount;

   const abonosSum = rowStats.abonosSum;
   const cargosSum = rowStats.cargosSum;

   const totalPages = Math.max(1, Math.ceil(total / pageSize));
   const startItem = total === 0 ? 0 : page * pageSize + 1;
   const endItem = Math.min(total, (page + 1) * pageSize);

   const renderPageNumbers = () => {
      const pages = [];
      const maxButtons = 5;
      if (totalPages <= maxButtons) {
         for (let i = 0; i < totalPages; i++) pages.push(i);
      } else {
         pages.push(0);
         if (page > 2) pages.push('ellipsis-start');
         const startP = Math.max(1, page - 1);
         const endP = Math.min(totalPages - 2, page + 1);
         for (let i = startP; i <= endP; i++) {
            if (!pages.includes(i)) pages.push(i);
         }
         if (page < totalPages - 3) pages.push('ellipsis-end');
         if (!pages.includes(totalPages - 1)) pages.push(totalPages - 1);
      }
      return pages;
   };

   // 2. totales para los badges
   const currentTxIds = useMemo(() => {
      return (bankRows || []).map(r => r.id || r.raw?.id).filter(Boolean);
   }, [bankRows]);

   const { data: boletaMap = {} } = useQuery({
      queryKey: ['activeBoletaMap', entityId, currentTxIds.join(',')],
      queryFn: () => getActiveBoletaMap({ entityId, ids: currentTxIds }),
      enabled: Boolean(entityId && currentTxIds.length > 0),
      staleTime: 10000,
      refetchInterval: 15000,
   });

   const selectableBoleteoRows = useMemo(() => {
      return (bankRows || []).filter((r) => {
         const remaining = Math.max(0, Number(r.raw?.remaining_amount ?? Math.abs(r.monto)));
         const abono = r.monto > 0 ? r.monto : 0;
         const bankTxId = r.raw?.id ?? (typeof r._id === 'string' && r._id.startsWith('tx-') ? Number(r._id.replace('tx-', '')) : r._id);
         const boletaStatus = boletaMap[bankTxId]?.status;
         return abono > 0 && remaining > 0 && (!boletaStatus || boletaStatus === 'cancelled' || boletaStatus === 'failed');
      });
   }, [bankRows, boletaMap]);

   const selectedBoleteoTransactions = useMemo(() => {
      return (bankRows || []).filter((r) => {
         const bankTxId = r.raw?.id ?? (typeof r._id === 'string' && r._id.startsWith('tx-') ? Number(r._id.replace('tx-', '')) : r._id);
         return selectedBoleteoIds.has(bankTxId);
      });
   }, [bankRows, selectedBoleteoIds]);

   const allSelectableChecked = selectableBoleteoRows.length > 0 && selectableBoleteoRows.every((r) => {
      const bankTxId = r.raw?.id ?? (typeof r._id === 'string' && r._id.startsWith('tx-') ? Number(r._id.replace('tx-', '')) : r._id);
      return selectedBoleteoIds.has(bankTxId);
   });

   const handleToggleSelectAllBoleteo = () => {
      if (allSelectableChecked) {
         setSelectedBoleteoIds(new Set());
      } else {
         const next = new Set();
         selectableBoleteoRows.forEach((r) => {
            const bankTxId = r.raw?.id ?? (typeof r._id === 'string' && r._id.startsWith('tx-') ? Number(r._id.replace('tx-', '')) : r._id);
            if (bankTxId) next.add(bankTxId);
         });
         setSelectedBoleteoIds(next);
      }
   };

   const handleToggleRowBoleteo = (bankTxId) => {
      setSelectedBoleteoIds((prev) => {
         const next = new Set(prev);
         if (next.has(bankTxId)) {
            next.delete(bankTxId);
         } else {
            next.add(bankTxId);
         }
         return next;
      });
   };

   const { abonosTotal, cargosTotal, abonosLoading, cargosLoading } = useBankTotals(entityId, {
      soloPendientes: soloPorConciliar,
      filters: applied
   });

   const {
      data: reconciliationDetailData,
      isLoading: loadingReconciliationDetail,
   } = useQuery({
      queryKey: ['bankReconciliationDetail', entityId, reconciliationDetailTxId],
      queryFn: () => listReconciliations({
         entityId,
         bank_transaction_id: reconciliationDetailTxId,
         limit: 100,
         offset: 0,
      }),
      enabled: Boolean(entityId && reconciliationDetailTxId),
   });

   const reconciliationDetailRows = reconciliationDetailData?.rows || [];

   // 3. cuentas contables para clasificacion de egresos directos
   const { data: accountingAccountsData } = useQuery({
      queryKey: ['accountingAccounts', entityId],
      queryFn: () => getAccounts({ entityId }),
      enabled: Boolean(entityId),
   });
   const availableAccounts = useMemo(() => {
      const list = Array.isArray(accountingAccountsData) ? accountingAccountsData : [];
      return list.filter(a => !a.is_title);
   }, [accountingAccountsData]);

   const handleUndoReconciliation = useCallback(async (row) => {
      if (!window.confirm('Deshacer esta conciliacion?')) return;

      setUndoingReconciliationId(row.id);
      try {
         await unreconcile({
            id: row.id,
            entityId,
            kind: row.kind === 'bank_transaction' ? 'bank_transaction' : 'document',
         });

         toast.success('Conciliacion deshecha');
         queryClient.invalidateQueries({ queryKey: ['bankReconciliationDetail', entityId, reconciliationDetailTxId] });
         queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
         queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
      } catch (e) {
         toast.error(e.message || 'No se pudo deshacer la conciliacion');
      } finally {
         setUndoingReconciliationId(null);
      }
   }, [entityId, reconciliationDetailTxId, queryClient]);

   const handleDeleteTransaction = useCallback(async (bankTxId) => {
      if (!window.confirm('Eliminar este movimiento bancario? Esta accion no se puede deshacer.')) return;

      setDeletingTxId(bankTxId);
      try {
         await deleteBankTransaction({ id: bankTxId, entityId });

         toast.success('Movimiento eliminado');
         queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
         queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
      } catch (e) {
         toast.error(e.message || 'No se pudo eliminar el movimiento');
      } finally {
         setDeletingTxId(null);
      }
   }, [entityId, queryClient]);

   // 3. conteo de sugerencias ultra-rapido
   const {
      data: sugData,
      isLoading: sugLoading,
      isFetching: sugFetching,
      isError: sugIsError
   } = useQuery({
      queryKey: ['sugerenciasCount', {
         entityId,
         dateFrom: applied.fechaIni,
         dateTo: applied.fechaFin,
         type: reconcileSuggestionType,
         accountId: reconcileSuggestionAccountId,
         daysWindow: 45,
         cap: SUGGESTIONS_BADGE_CAP
      }],
      queryFn: ({ signal }) => fetchSuggestionsCount({
         entityId,
         accountId: reconcileSuggestionAccountId || undefined,
         type: reconcileSuggestionType || undefined,
         dateFrom: toYmd(applied.fechaIni) || undefined,
         dateTo: toYmd(applied.fechaFin) || undefined,
         daysWindow: 45,
         cap: SUGGESTIONS_BADGE_CAP,
         signal // permite cancelar la peticion si el usuario cambia de filtros rapido
      }),
      // ahora que es liviano, podemos dejarlo habilitado siempre que haya una entidad
      enabled: !!entityId,
      refetchOnMount: 'always',
      // si falla, preferimos mostrarlo rapido en vez de reintentar y dejar el badge
      // "cargando" para siempre (sugData nunca se llena si la consulta nunca resuelve)
      retry: 1
   });

   const { data: accountsData, isLoading: loadingAccounts } = useQuery({
      queryKey: ['bankAccounts', entityId],
      queryFn: ({ signal }) => listBankAccounts({ entityId, signal }),
      enabled: !!entityId
   });

   const sugBadgeLoading = Boolean(entityId) && !sugIsError && (sugLoading || sugFetching || !sugData);
   const sugerenciasCount = Number(sugData?.total || 0);
   const sugerenciasBadgeText = sugIsError
      ? '—'
      : sugData?.is_capped
         ? `${Number(sugData?.cap || SUGGESTIONS_BADGE_CAP)}+`
         : String(Number(sugerenciasCount || 0));

   // variables derivadas
   const loading = loadingMovs;
   const cuentasDisponibles = useMemo(() => {
      const rows = Array.isArray(accountsData?.rows) ? accountsData.rows : [];
      return rows.map((r) => ({
         id: String(r.id),
         label: r.label || [r.bank_name, r.account_number, r.currency].filter(Boolean).join(' - ') || `Cuenta ${r.id}`,
      }));
   }, [accountsData]);

   useEffect(() => {
      if (!ctaCorriente) return;
      const exists = cuentasDisponibles.some((c) => String(c.id) === String(ctaCorriente));
      if (!exists) setCtaCorriente('');
   }, [ctaCorriente, cuentasDisponibles]);

   const selectedUploadAccountId = useMemo(() => {
      const fromFilter = Number(ctaCorriente);
      if (Number.isInteger(fromFilter) && fromFilter > 0) return fromFilter;

      if (cuentasDisponibles.length === 1) {
         const only = Number(cuentasDisponibles[0].id);
         return Number.isInteger(only) && only > 0 ? only : null;
      }

      return null;
   }, [ctaCorriente, cuentasDisponibles]);

   const [isManualSyncing, setIsManualSyncing] = useState(false);

   const currentSelectedAccount = useMemo(() => {
      const rows = Array.isArray(accountsData?.rows) ? accountsData.rows : [];
      if (!rows.length) return null;
      if (ctaCorriente) {
         return rows.find((r) => String(r.id) === String(ctaCorriente)) || rows[0];
      }
      return rows[0];
   }, [accountsData, ctaCorriente]);

   const formatLastSync = (dateStr) => {
      if (!dateStr) return null;
      try {
         const d = new Date(dateStr);
         if (isNaN(d.getTime())) return null;
         return d.toLocaleDateString('es-CL', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
         });
      } catch {
         return null;
      }
   };

   const [showSyncPeriodModal, setShowSyncPeriodModal] = useState(false);

   const emissoSyncQuota = accountsData?.emisso_sync_quota || null;
   const emissoSyncUsed = Math.max(0, Number(emissoSyncQuota?.used ?? 0));
   const emissoSyncLimit = Math.max(1, Number(emissoSyncQuota?.limit ?? 100));
   const emissoLimitReached = Boolean(emissoSyncQuota && emissoSyncUsed >= emissoSyncLimit);
   const hasEmissoQuotaLoaded = Boolean(emissoSyncQuota);

   const updateCachedEmissoQuota = useCallback((nextQuota) => {
      if (!entityId || !nextQuota || typeof nextQuota !== 'object') return;
      queryClient.setQueryData(['bankAccounts', entityId], (prev) => {
         if (!prev || typeof prev !== 'object') return prev;
         return {
            ...prev,
            emisso_sync_quota: nextQuota,
         };
      });
   }, [entityId, queryClient]);

   const handleManualEmissoSync = async () => {
      if (!entityId || !currentSelectedAccount?.id) return;
      if (!currentSelectedAccount.emisso_connection_id) {
         toast.info("Esta cuenta no tiene una conexión automática de Emisso configurada.");
         return;
      }
      if (emissoLimitReached) {
         toast.error(`Has alcanzado el límite mensual de sincronizaciones manuales (${emissoSyncUsed}/${emissoSyncLimit}) para este mes. La sincronización automática cada 4 horas sigue activa.`);
         return;
      }

      setIsManualSyncing(true);
      try {
         const resp = await syncEmissoBankAccount({
            entityId,
            id: currentSelectedAccount.id,
         });
         if (resp?.emisso_sync_quota) {
            updateCachedEmissoQuota(resp.emisso_sync_quota);
         }
         toast.success(`Sincronización completada: ${resp.saved || 0} nuevos, ${resp.updated || 0} actualizados`);
         await queryClient.invalidateQueries({ queryKey: ['bankAccounts', entityId] });
         await queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         await queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
         await queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
      } catch (err) {
         if (err?.payload?.emisso_sync_quota) {
            updateCachedEmissoQuota(err.payload.emisso_sync_quota);
         }
         if (err?.status === 429) {
            await queryClient.invalidateQueries({ queryKey: ['bankAccounts', entityId] });
         }
         toast.error(err?.message || "Error al sincronizar con el banco");
      } finally {
         setIsManualSyncing(false);
      }
   };

   // ===========================
   // modales y subidas de excel
   // ===========================
   const [showUploadModal, setShowUploadModal] = useState(false);
   const [uploadFile, setUploadFile] = useState(null);
   const [uploadErr, setUploadErr] = useState('');
   const [isUploading, setIsUploading] = useState(false);
   const [isDownloadingTemplate, setIsDownloadingTemplate] = useState(false);
   const [uploadResult, setUploadResult] = useState(null);
   const [uploadAccountId, setUploadAccountId] = useState('');
   const [uploadSplitDebitCredit, setUploadSplitDebitCredit] = useState(false);
   const [showSkippedDetails, setShowSkippedDetails] = useState(false);
   const [parsedWorkbookInfo, setParsedWorkbookInfo] = useState(null);
   const [duplicateGroups, setDuplicateGroups] = useState([]);

   const totalOmittedCount = useMemo(() => {
      let count = 0;
      duplicateGroups.forEach((g) => {
         g.rows.forEach((r) => {
            if (!g.selectedRowNumbers.has(r.excelRowNumber)) {
               count++;
            }
         });
      });
      return count;
   }, [duplicateGroups]);

   const handleUpdateGroupSelection = (groupId, nextSelectedRowNumbers) => {
      setDuplicateGroups((prev) =>
         prev.map((g) => (g.id === groupId ? { ...g, selectedRowNumbers: nextSelectedRowNumbers } : g))
      );
   };

   const handleOmitAllDuplicates = () => {
      setDuplicateGroups((prev) =>
         prev.map((g) => ({
            ...g,
            selectedRowNumbers: new Set([g.rows[0].excelRowNumber]),
         }))
      );
      toast.success('Se configuró para omitir las copias repetidas (se subirá 1 de cada grupo).');
   };

   const handleKeepAllDuplicates = () => {
      setDuplicateGroups((prev) =>
         prev.map((g) => ({
            ...g,
            selectedRowNumbers: new Set(g.rows.map((r) => r.excelRowNumber)),
         }))
      );
      toast.success('Se configuró para conservar todos los movimientos duplicados.');
   };

   const openUploadModal = () => {
      setUploadFile(null);
      setUploadErr('');
      setUploadResult(null);
      setParsedWorkbookInfo(null);
      setDuplicateGroups([]);
      setUploadSplitDebitCredit(false);
      setShowSkippedDetails(false);
      const initialAcc = selectedUploadAccountId
         ? String(selectedUploadAccountId)
         : (cuentasDisponibles.length === 1 ? String(cuentasDisponibles[0].id) : '');
      setUploadAccountId(initialAcc);
      setShowUploadModal(true);
   };

   const closeUploadModal = () => {
      if (isUploading) return;
      setShowUploadModal(false);
      setShowSkippedDetails(false);
      setUploadResult(null);
      setUploadFile(null);
      setParsedWorkbookInfo(null);
      setDuplicateGroups([]);
      setUploadErr('');
   };

   const onPickFile = async (f) => {
      setUploadErr('');
      setUploadResult(null);
      setParsedWorkbookInfo(null);
      setDuplicateGroups([]);

      if (!f) return setUploadFile(null);
      if (!isAllowed(f)) {
         setUploadErr(`Adjunta un Excel .xlsx/.xls de hasta ${MAX_SIZE_MB} MB`);
         setUploadFile(null);
         return;
      }

      try {
         const check = await validateMovementsExcelFile(f, { splitDebitCredit: uploadSplitDebitCredit });
         if (!check.ok) {
            const detected = Array.isArray(check.detectedColumns) && check.detectedColumns.length
               ? ` Columnas detectadas${check.headerRow ? ` (fila ${check.headerRow})` : ''}: ${check.detectedColumns.join(', ')}.`
               : '';
            setUploadErr(`${check.message || 'El archivo no cumple el formato de movimientos'}${detected}`);
            setUploadFile(null);
            return;
         }

         setParsedWorkbookInfo({
            wb: check.wb,
            ws: check.ws,
            sheetName: check.sheetName,
            rows2D: check.rows2D,
            headerRow: check.headerRow,
            totalDataRows: check.totalDataRows,
         });
         setDuplicateGroups(check.duplicateGroups || []);
      } catch (_err) {
         setUploadErr('No se pudo leer el Excel. Verifica que no este dañado y prueba nuevamente.');
         setUploadFile(null);
         return;
      }

      setUploadFile(f);
   };

   const handleUploadExcel = async () => {
      if (!uploadFile || !entityId) return setUploadErr('Selecciona un Excel valido');

      const selectedAccount = Number(uploadAccountId);
      const resolvedAccountId = Number.isInteger(selectedAccount) && selectedAccount > 0
         ? selectedAccount
         : selectedUploadAccountId;

      if (!resolvedAccountId) return setUploadErr('Selecciona una cuenta bancaria para la carga');

      setIsUploading(true);
      setUploadErr('');
      try {
         let fileToUpload = uploadFile;

         // Si hay duplicados que el usuario decidió omitir, generar el Excel limpio
         if (totalOmittedCount > 0 && parsedWorkbookInfo?.rows2D) {
            const omittedIndices = new Set();
            duplicateGroups.forEach((g) => {
               g.rows.forEach((r) => {
                  if (!g.selectedRowNumbers.has(r.excelRowNumber)) {
                     omittedIndices.add(r.rowIndex2D);
                  }
               });
            });

            if (omittedIndices.size > 0) {
               const cleanRows2D = parsedWorkbookInfo.rows2D.filter((_, idx) => !omittedIndices.has(idx));
               const cleanWb = XLSX.utils.book_new();
               const cleanWs = XLSX.utils.aoa_to_sheet(cleanRows2D);
               if (parsedWorkbookInfo.ws['!cols']) cleanWs['!cols'] = parsedWorkbookInfo.ws['!cols'];
               XLSX.utils.book_append_sheet(cleanWb, cleanWs, parsedWorkbookInfo.sheetName || 'Movimientos');

               parsedWorkbookInfo.wb.SheetNames.forEach((sName) => {
                  if (sName !== parsedWorkbookInfo.sheetName && parsedWorkbookInfo.wb.Sheets[sName]) {
                     XLSX.utils.book_append_sheet(cleanWb, parsedWorkbookInfo.wb.Sheets[sName], sName);
                  }
               });

               const cleanBuffer = XLSX.write(cleanWb, { type: 'array', bookType: 'xlsx' });
               fileToUpload = new File([cleanBuffer], uploadFile.name, {
                  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
               });
            }
         }

         const resp = await uploadBankExcel({
            entityId,
            accountId: resolvedAccountId,
            file: fileToUpload,
            splitDebitCredit: uploadSplitDebitCredit,
         });
         setUploadResult(resp);
         // recargamos las listas tras la subida exitosa
         queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
      } catch (err) {
         setUploadErr(err?.message || 'No se pudo subir el archivo');
      } finally {
         setIsUploading(false);
      }
   };

   const handleDownloadTemplate = async () => {
      setIsDownloadingTemplate(true);
      setUploadErr('');

      try {
         if (uploadSplitDebitCredit) {
            downloadMovementsTemplate(SPLIT_DEBIT_CREDIT_TEMPLATE_HEADERS, 'plantilla_movimientos_bancarios_abonos_cargos.xlsx', { splitDebitCredit: true });
            return;
         }

         downloadMovementsTemplate(STANDARD_TEMPLATE_HEADERS, 'plantilla_movimientos_bancarios.xlsx');
      } catch (err) {
         setUploadErr(err?.message || 'No se pudo descargar la plantilla');
      } finally {
         setIsDownloadingTemplate(false);
      }
   };

   // ===========================
   // modal de conciliacion individual
   // ===========================
   const [reconcileTx, setReconcileTx] = useState(null);
   const [modalClosing, setModalClosing] = useState(false);
   const [menuDelay, setMenuDelay] = useState(false);
   const [ctaDelay, setCtaDelay] = useState(false);

   const [loadingAuto, setLoadingAuto] = useState(false);
   const [autoCandidates, setAutoCandidates] = useState([]);
   const [searchCandidates, setSearchCandidates] = useState([]);
   const [loadingDocumentSearch, setLoadingDocumentSearch] = useState(false);
   const [documentSearchError, setDocumentSearchError] = useState('');
   const [bankCandidates, setBankCandidates] = useState([]);
   const [loadingBankSearch, setLoadingBankSearch] = useState(false);
   const [bankSearchError, setBankSearchError] = useState('');
   const [selectedDocId, setSelectedDocId] = useState(null);
   const [selectedDocIds, setSelectedDocIds] = useState([]);
   const [selectedTargetKind, setSelectedTargetKind] = useState('document');
   const [dailySalesGroups, setDailySalesGroups] = useState([]);
   const [loadingDailySales, setLoadingDailySales] = useState(false);
   const [dailySalesError, setDailySalesError] = useState('');
   const [savingDailyGroupKey, setSavingDailyGroupKey] = useState('');

   const [showPayableDetail, setShowPayableDetail] = React.useState(false);
   const [detailAnchor, setDetailAnchor] = React.useState({ x: 0, y: 0 });

   const [assignAmount, setAssignAmount] = useState("");
   const [isEditingAssign, setIsEditingAssign] = useState(false);
   const [isTyping, setIsTyping] = React.useState(false);
   const typingTimer = React.useRef(null);

   const [isSaving, setIsSaving] = React.useState(false);
   const [saveState, setSaveState] = React.useState('idle');

   const txRemaining = Math.max(0, Number(reconcileTx?.raw?.remaining_amount ?? Math.abs(Number(reconcileTx?.monto || 0))));
   const reconcileDocumentSide = Number(reconcileTx?.monto || 0) < 0 ? 'expense' : 'income';

   // Estados de Egreso Directo (estilo Chipax)
   const [expenseType, setExpenseType] = useState('GASTO');
   const [expenseAccountId, setExpenseAccountId] = useState(null);
   const [expenseCounterparty, setExpenseCounterparty] = useState('');
   const [expenseRut, setExpenseRut] = useState('');
   const [expenseConcept, setExpenseConcept] = useState('');
   const [expenseAmount, setExpenseAmount] = useState('');
   const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);
   const reconcileTxDate = useMemo(() => getBankTransactionDate(reconcileTx), [reconcileTx]);
   const documentCandidates = useMemo(() => {
      const byId = new Map();
      for (const item of [...(Array.isArray(autoCandidates) ? autoCandidates : []), ...(Array.isArray(searchCandidates) ? searchCandidates : [])]) {
         if (!item?.id) continue;
         byId.set(Number(item.id), { ...item, target_kind: 'document' });
      }
      return Array.from(byId.values());
   }, [autoCandidates, searchCandidates]);
   const bankTransferCandidates = useMemo(() => (
      (Array.isArray(bankCandidates) ? bankCandidates : []).map((item) => ({ ...item, target_kind: 'bank_transaction' }))
   ), [bankCandidates]);
   const targetCandidates = selectedTargetKind === 'bank_transaction' ? bankTransferCandidates : documentCandidates;
   const selectedDoc = useMemo(() => targetCandidates.find(d => Number(d.id) === Number(selectedDocId)), [targetCandidates, selectedDocId]);
   const selectedDocuments = useMemo(() => {
      if (selectedDocIds.length === 0) return [];
      const byId = new Map(targetCandidates.map((item) => [Number(item.id), item]));
      return selectedDocIds.map((id) => byId.get(Number(id))).filter(Boolean);
   }, [targetCandidates, selectedDocIds]);
   const selectedDocumentsPending = useMemo(() => (
      selectedDocuments.reduce((sum, item) => sum + Math.max(0, Number(item.remaining_amount || 0)), 0)
   ), [selectedDocuments]);
   const hasMultipleSelectedDocuments = selectedDocuments.length > 1;

   const maxAssignable = useMemo(() => {
      const tx = Math.max(0, Number(txRemaining || 0));
      if (hasMultipleSelectedDocuments) return Math.min(tx, selectedDocumentsPending);
      const doc = Math.max(0, Number(selectedDoc?.remaining_amount || 0));
      return Math.min(tx, doc);
   }, [hasMultipleSelectedDocuments, selectedDocumentsPending, txRemaining, selectedDoc]);

   const assigned = useMemo(() => Math.max(0, normalizeAmount(assignAmount)), [assignAmount]);
   const txRemainingAfter = useMemo(() => Math.max(0, Number(txRemaining || 0) - assigned), [txRemaining, assigned]);
   const isFullyAssigned = txRemainingAfter === 0 && assigned > 0;
   const selectedDocumentAllocation = useMemo(() => {
      const allocation = new Map();
      if (selectedDocuments.length === 0) return allocation;

      let remainingToApply = Number(assigned || 0);
      for (const doc of selectedDocuments) {
         const docPending = Math.max(0, Number(doc.remaining_amount || 0));
         const amount = Math.min(docPending, remainingToApply);
         allocation.set(Number(doc.id), amount);
         remainingToApply -= amount;
      }

      return allocation;
   }, [assigned, selectedDocuments, selectedTargetKind]);

   const payableBreakdown = React.useMemo(() => {
      if (hasMultipleSelectedDocuments) {
         const total = selectedDocuments.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
         const pending = selectedDocumentsPending;
         const alreadyAssigned = Math.max(0, total - pending);
         const nowAssigned = Number(assigned || 0);
         const remaining = Math.max(0, pending - nowAssigned);
         return { total, alreadyAssigned, nowAssigned, remaining };
      }
      const total = Number(selectedDoc?.total_amount || 0);
      const alreadyAssigned = Number(selectedDoc?.remaining_amount || 0) < total ? total - Number(selectedDoc?.remaining_amount || 0) : 0;
      const nowAssigned = Number(assigned || 0);
      const remaining = Math.max(0, Number(selectedDoc?.remaining_amount || 0) - nowAssigned);
      return { total, alreadyAssigned, nowAssigned, remaining };
   }, [assigned, hasMultipleSelectedDocuments, selectedDoc, selectedDocuments, selectedDocumentsPending]);

   const handleAssignChange = (e) => {
      setAssignAmount(e.target.value);
      setIsTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setIsTyping(false), 250);
   };

   // autollenar maximo
   useEffect(() => {
      if (selectedDoc || hasMultipleSelectedDocuments) {
         setAssignAmount(String(Math.floor(maxAssignable)));
         setIsTyping(true);
         clearTimeout(typingTimer.current);
         typingTimer.current = setTimeout(() => setIsTyping(false), 250);
      } else {
         setAssignAmount("");
      }
   }, [hasMultipleSelectedDocuments, selectedDoc, maxAssignable]);

   const closeConciliar = useCallback(() => {
      setSelectedDocId(null);
      setSelectedDocIds([]);
      setReconcileTx(null);
      setMenuDelay(false);
      setIsEditingAssign(false);
   }, []);

   const closeConciliarSmooth = useCallback((delay = 200) => {
      setModalClosing(true);
      setTimeout(() => {
         setModalClosing(false);
         closeConciliar();
      }, delay);
   }, [closeConciliar]);

   const openConciliar = (row) => {
      setSelectedDocId(null);
      setSelectedDocIds([]);
      setSelectedTargetKind('document');
      setModalQuery('');
      setModalTipo('');
      setModalSortConfig({ key: 'issue_date', dir: 'none' });
      setSearchCandidates([]);
      setDocumentSearchError('');
      setBankCandidates([]);
      setBankSearchError('');
      setDailySalesGroups([]);
      setDailySalesError('');
      setSavingDailyGroupKey('');
      setReconcileTx(row);

      // Prellenar datos para Egreso Directo (Chipax style)
      const cleanMonto = Math.max(0, Number(row?.raw?.remaining_amount ?? Math.abs(Number(row?.monto || row?.raw?.amount || 0))));
      const cleanDesc = row?.descripcion || row?.raw?.description || '';
      const cleanRut = getRutFromRow(row) || '';
      setExpenseType('GASTO');
      setExpenseAccountId(null);
      setExpenseAmount(cleanMonto ? String(cleanMonto) : '');
      setExpenseCounterparty(cleanDesc);
      setExpenseRut(cleanRut);
      setExpenseConcept(cleanDesc);
      setIsSubmittingExpense(false);
      setIsEditingAssign(false);

      setMenuDelay(true);
      setTimeout(() => setMenuDelay(false), 600);
   };

   const handleReconcileDirectExpense = async (e) => {
      e?.preventDefault();
      if (!entityId || !reconcileTx) return;

      if (!expenseAccountId) {
         toast.error('Debes seleccionar una cuenta contable');
         return;
      }

      const parsedAmount = Number(expenseAmount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
         toast.error('El monto debe ser un número positivo');
         return;
      }

      const bankTxId = reconcileTx?.raw?.id ?? (typeof reconcileTx?._id === 'string' && reconcileTx._id.startsWith('tx-') ? Number(reconcileTx._id.replace('tx-', '')) : Number(reconcileTx?._id));

      setIsSubmittingExpense(true);
      try {
         await reconcileDirectExpense({
            entityId,
            bank_transaction_id: bankTxId,
            account_id: expenseAccountId,
            counterparty_rut: expenseRut || null,
            counterparty_name: expenseCounterparty || null,
            concept: expenseConcept || null,
            expense_type: expenseType,
            amount: parsedAmount,
         });

         toast.success('Egreso conciliado y asiento contable generado exitosamente');
         queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
         queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
         queryClient.invalidateQueries({ queryKey: ['reconciliations'] });
         queryClient.invalidateQueries({ queryKey: ['entries'] });
         queryClient.invalidateQueries({ queryKey: ['cashFlow'] });
         queryClient.invalidateQueries({ queryKey: ['incomeStatement'] });
         closeConciliar();
      } catch (err) {
         toast.error(err.message || 'Error al conciliar el egreso');
      } finally {
         setIsSubmittingExpense(false);
      }
   };

   useEffect(() => {
      if (reconcileTx) {
         setCtaDelay(true);
         const t = setTimeout(() => setCtaDelay(false), 300);
         return () => clearTimeout(t);
      }
      setCtaDelay(false);
   }, [reconcileTx]);

   // busqueda automatica de candidatos al abrir
   useEffect(() => {
      if (!reconcileTx || !entityId) return;
      const controller = new AbortController();
      (async () => {
         try {
            setLoadingAuto(true);
            const bankTxId = reconcileTx?.raw?.id ?? (typeof reconcileTx?._id === 'string' && reconcileTx._id.startsWith('tx-') ? Number(reconcileTx._id.replace('tx-', '')) : Number(reconcileTx?._id));
            const montoAbs = Math.abs(Number(reconcileTx?.monto || 0));
            const rut = getRutFromRow(reconcileTx);

            const out = await autofindCandidates({ entityId, bank_transaction_id: bankTxId, amount: montoAbs, rut, limit: 10, signal: controller.signal });
            setAutoCandidates(out?.candidates ?? out?.rows ?? []);
         } catch (e) {
            if (e?.name !== 'AbortError') console.error('autofind error', e);
         } finally {
            setLoadingAuto(false);
         }
      })();
      return () => controller.abort();
   }, [reconcileTx, entityId]);

   useEffect(() => {
      if (!reconcileTx || !entityId || reconcileDocumentSide !== 'income' || !reconcileTxDate) {
         setDailySalesGroups([]);
         setDailySalesError('');
         setLoadingDailySales(false);
         return undefined;
      }

      const controller = new AbortController();

      (async () => {
         try {
            setLoadingDailySales(true);
            setDailySalesError('');

            const from = addDaysYmd(reconcileTxDate, -3);
            const to = addDaysYmd(reconcileTxDate, 3);

            const out = await listDailySalesGroups({
               entityId,
               from,
               to,
               signal: controller.signal,
            });

            const txAmount = Math.max(0, Number(reconcileTx?.raw?.remaining_amount ?? Math.abs(Number(reconcileTx?.monto || 0))));

            const nextGroups = (out.rows || [])
               .map((group) => {
                  const total = Math.round(Number(group.total_amount || 0));

                  return {
                     ...group,
                     docs: Array.isArray(group.docs) ? group.docs : [],
                     total,
                     diff: Math.round(total - txAmount),
                     distance: Math.abs(new Date(`${group.date}T12:00:00`) - new Date(`${reconcileTxDate}T12:00:00`)),
                  };
               })
               .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || a.distance - b.distance || a.date.localeCompare(b.date));

            setDailySalesGroups(nextGroups);
         } catch (err) {
            if (err?.name !== 'AbortError') {
               setDailySalesError(err.message || 'No se pudieron agrupar ventas por dia');
            }
         } finally {
            setLoadingDailySales(false);
         }
      })();

      return () => controller.abort();
   }, [entityId, reconcileDocumentSide, reconcileTx, reconcileTxDate]);

   const reconcileSelected = useCallback(async () => {
      const hasDocumentSelection = selectedDocuments.length > 0;
      const hasSingleSelection = selectedDocId != null;
      if (!reconcileTx || (!hasDocumentSelection && !hasSingleSelection)) return;
      try {
         setLoadingAuto(true);
         const bankTxId = reconcileTx.raw?.id ?? (typeof reconcileTx._id === 'string' && reconcileTx._id.startsWith('tx-') ? Number(reconcileTx._id.replace('tx-', '')) : reconcileTx._id);
         const amountToApply = Math.max(0, Number(assigned || 0));
         if (!(amountToApply > 0)) throw new Error('Ingresa un monto valido a asignar');

         let pairs = [];
         if (selectedDocuments.length > 1) {
            let remainingToApply = amountToApply;
            pairs = selectedDocuments
               .map((doc) => {
                  const docPending = Math.max(0, Number(doc.remaining_amount || 0));
                  const amount = Math.min(docPending, remainingToApply);
                  remainingToApply -= amount;
                  return {
                     bank_transaction_id: bankTxId,
                     document_id: selectedTargetKind === 'document' ? Number(doc.id) : null,
                     target_bank_transaction_id: selectedTargetKind === 'bank_transaction' ? Number(doc.id) : null,
                     amount,
                  };
               })
               .filter((pair) => (pair.document_id || pair.target_bank_transaction_id) && pair.amount > 0);

            if (!pairs.length) throw new Error('No hay monto disponible para aplicar a los registros seleccionados');

            await reconcileBulk({
               entityId,
               pairs,
               method: 'manual-multi',
            });
         } else {
            if (selectedTargetKind === 'bank_transaction') {
               await reconcileBankTransaction({
                  entityId,
                  bank_transaction_id: bankTxId,
                  target_bank_transaction_id: Number(selectedDocuments[0]?.id || selectedDocId),
                  amount: amountToApply,
               });
            } else {
               await reconcileOne({
                  entityId,
                  bank_transaction_id: bankTxId,
                  document_id: Number(selectedDocuments[0]?.id || selectedDocId),
                  amount: amountToApply,
               });
            }
         }

         const picked = targetCandidates.find(d => Number(d.id) === Number(selectedDocId));
         const actualReconciledCount = selectedDocuments.length > 1 ? pairs.length : 1;
         
         toast.success(actualReconciledCount > 1
            ? `${actualReconciledCount} registros conciliados correctamente`
            : picked
               ? `${selectedTargetKind === 'bank_transaction' ? 'Movimiento' : 'Folio'} ${picked.folio ?? picked.id} conciliado correctamente`
               : selectedTargetKind === 'bank_transaction' ? 'Movimiento cruzado correctamente' : 'Documento conciliado correctamente'
         );

         closeConciliarSmooth();
         // invalidamos cache maestra
         queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
         queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
      } catch (e) {
         toast.error(e.message || 'No se pudo conciliar');
         throw e;
      } finally {
         setLoadingAuto(false);
      }
   }, [reconcileTx, selectedDocId, selectedDocuments, assigned, entityId, selectedTargetKind, targetCandidates, closeConciliarSmooth, queryClient]);

   const reconcileDailySalesGroup = useCallback(async (group) => {
      if (!reconcileTx || !entityId || !group?.docs?.length) return;

      const bankTxId = reconcileTx.raw?.id ?? (typeof reconcileTx._id === 'string' && reconcileTx._id.startsWith('tx-') ? Number(reconcileTx._id.replace('tx-', '')) : reconcileTx._id);
      const txAvailable = Math.max(0, Number(reconcileTx?.raw?.remaining_amount ?? Math.abs(Number(reconcileTx?.monto || 0))));

      try {
         setSavingDailyGroupKey(group.key);

         let remainingToApply = txAvailable;

         const pairs = group.docs
            .map((doc) => {
               const docPending = getDocumentPendingAmount(doc);
               const amount = Math.min(docPending, remainingToApply);

               remainingToApply -= amount;

               return {
                  bank_transaction_id: bankTxId,
                  document_id: Number(doc.id),
                  amount,
               };
            })
            .filter((pair) => pair.document_id && pair.amount > 0);

         if (!pairs.length) {
            toast.error('No hay saldo pendiente para aplicar en este dia');
            return;
         }

         await reconcileBulk({
            entityId,
            pairs,
            method: 'daily_sales_group',
         });

         const appliedTotal = pairs.reduce((sum, pair) => sum + Number(pair.amount || 0), 0);
         toast.success(`Abono aplicado a venta diaria ${group.date}: ${fmtCLP(appliedTotal)} en ${pairs.length} documento(s)`);
         closeConciliarSmooth();
         queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
         queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
         queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
      } catch (err) {
         toast.error(err.message || 'No se pudo conciliar la venta diaria');
      } finally {
         setSavingDailyGroupKey('');
      }
   }, [closeConciliarSmooth, entityId, queryClient, reconcileTx]);

   const handleSave = React.useCallback(async () => {
      const hasSelection = selectedDocuments.length > 0 || Boolean(selectedDocId);
      if (!hasSelection || Number(assigned) <= 0 || isSaving) return;
      try {
         setIsSaving(true);
         setSaveState('saving');
         await reconcileSelected();
         setSaveState('done');
      } catch (err) {
         setSaveState('error');
      } finally {
         setTimeout(() => setIsSaving(false), 300);
      }
   }, [selectedDocId, selectedDocuments.length, selectedTargetKind, assigned, isSaving, reconcileSelected]);

   const handleReconcileApplied = () => {
      queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
      queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
      queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
   };

   const handleOpenSuggestions = useCallback(() => {
      setTab("sugerencias");
      setPage(0);
   }, []);

   // ===========================
   // handlers de ui y atajos
   // ===========================
   const applyAndFetch = () => {
      setApplied({ tipo, fechaIni, fechaFin, montoFiltro, ctaCorriente, descripcion, cuenta, nroDocumento, folioConciliado });
      setPage(0);
      setMostrarFiltros(true);
   };

   const resetAll = useCallback(() => {
      setTab('todos');
      setMostrarFiltros(true);
      setTipo("Todos"); setFechaIni(""); setFechaFin(""); setMontoFiltro(""); setCtaCorriente(""); setDescripcion(""); setCuenta(""); setNroDocumento(""); setFolioConciliado("");
      setApplied(DEFAULT_FILTERS);
      setSoloPorConciliar(false);
      setPage(0);
   }, []);

   const switchTabWithReset = React.useCallback((nextTab) => {
      setTab(nextTab);
      if (nextTab === 'abonos' || nextTab === 'cargos') setSoloPorConciliar(true);
      else setSoloPorConciliar(false);

      setTipo("Todos"); setFechaIni(""); setFechaFin(""); setMontoFiltro(""); setCtaCorriente(""); setDescripcion(""); setCuenta(""); setNroDocumento(""); setFolioConciliado("");
      setApplied(DEFAULT_FILTERS);
      setPage(0);
   }, []);

   useEffect(() => {
      if (tab === 'abonos' || tab === 'cargos') setMostrarFiltros(true);
   }, [tab]);

   useEffect(() => {
      const h = (e) => {
         const isMac = navigator.platform.toLowerCase().includes("mac");
         if ((isMac ? e.metaKey : e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            setMostrarFiltros((v) => !v);
         }
      };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
   }, []);

   useEffect(() => {
      const onKey = (e) => {
         if (e.key !== 'Escape') return;
         if (showUploadModal) { e.preventDefault(); setShowUploadModal(false); return; }
         if (showPayableDetail) { e.preventDefault(); setShowPayableDetail(false); return; }
         if (reconcileTx) { e.preventDefault(); closeConciliarSmooth(); }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [showUploadModal, showPayableDetail, reconcileTx, closeConciliarSmooth]);

   useEffect(() => {
      if (!reconcileTx) return;
      const onEnter = (e) => {
         if (e.key !== 'Enter' || isSaving) return;
         if ((document.activeElement?.tagName || '').toLowerCase() === 'textarea') return;
         const hasSelection = selectedTargetKind === 'document' ? selectedDocuments.length > 0 : Boolean(selectedDocId);
         if (hasSelection && Number(assigned) > 0) {
            e.preventDefault();
            handleSave();
         }
      };
      window.addEventListener('keydown', onEnter);
      return () => window.removeEventListener('keydown', onEnter);
   }, [reconcileTx, selectedDocId, selectedDocuments.length, selectedTargetKind, assigned, isSaving, handleSave]);

   // filtros locales para el modal de resultados
   const [modalQuery, setModalQuery] = useState('');
   const [modalTipo, setModalTipo] = useState('');
   const [modalPage, setModalPage] = useState(1);
   const [modalTotalPages, setModalTotalPages] = useState(1);
   const [modalSortConfig, setModalSortConfig] = useState({ key: 'issue_date', dir: 'none' });
   const [debouncedQuery, setDebouncedQuery] = useState('');
   
   useEffect(() => {
      setModalPage(1);
   }, [debouncedQuery, modalTipo]);

   useEffect(() => {
      const t = setTimeout(() => setDebouncedQuery(modalQuery.trim().toLowerCase()), 250);
      return () => clearTimeout(t);
   }, [modalQuery]);

   useEffect(() => {
      if (selectedTargetKind !== 'document' || !reconcileTx || !entityId) {
         setSearchCandidates([]);
         setDocumentSearchError('');
         setLoadingDocumentSearch(false);
         setModalTotalPages(1);
         return undefined;
      }

      const controller = new AbortController();
      (async () => {
         try {
            setLoadingDocumentSearch(true);
            setDocumentSearchError('');

            const out = await listSiiDocuments({
               entityId,
               operationType: reconcileDocumentSide === 'income' ? 'INCOME' : 'EXPENSE',
               type: modalTipo || undefined,
               q: debouncedQuery,
               pendingOnly: true,
               page: modalPage,
               limit: 50,
               sort: 'issue_date',
               order: 'desc',
               signal: controller.signal,
            });

            setSearchCandidates(out.rows || []);
            setModalTotalPages(out.totalPages || 1);
         } catch (err) {
            if (err?.name !== 'AbortError') {
               setDocumentSearchError(err.message || 'No se pudieron buscar documentos');
               setSearchCandidates([]);
               setModalTotalPages(1);
            }
         } finally {
            setLoadingDocumentSearch(false);
         }
      })();

      return () => controller.abort();
   }, [debouncedQuery, entityId, modalTipo, reconcileDocumentSide, reconcileTx, selectedTargetKind, modalPage]);

   useEffect(() => {
      if (selectedTargetKind !== 'bank_transaction' || !reconcileTx || !entityId) {
         setBankCandidates([]);
         setBankSearchError('');
         setLoadingBankSearch(false);
         return undefined;
      }

      const controller = new AbortController();
      (async () => {
         try {
            setLoadingBankSearch(true);
            setBankSearchError('');
            const bankTxId = reconcileTx?.raw?.id ?? (typeof reconcileTx?._id === 'string' && reconcileTx._id.startsWith('tx-') ? Number(reconcileTx._id.replace('tx-', '')) : Number(reconcileTx?._id));

            const out = await searchBankReconcileCandidates({
               entityId,
               bank_transaction_id: bankTxId,
               q: debouncedQuery.length >= 2 ? debouncedQuery : '',
               limit: 50,
               signal: controller.signal,
            });

            setBankCandidates(out.rows || []);
         } catch (err) {
            if (err?.name !== 'AbortError') {
               setBankSearchError(err.message || 'No se pudieron buscar movimientos');
               setBankCandidates([]);
            }
         } finally {
            setLoadingBankSearch(false);
         }
      })();

      return () => controller.abort();
   }, [debouncedQuery, entityId, reconcileTx, selectedTargetKind]);

   const modalFiltered = useMemo(() => {
      let rows = [...targetCandidates];
      if (selectedTargetKind === 'document' && modalTipo) {
         rows = rows.filter(d => String(d.doc_type_code ?? '') === String(modalTipo));
      }
      if (debouncedQuery) {
         const cleanQuery = debouncedQuery.replace(/[\.\-\s]/g, '').toLowerCase();
         rows = rows.filter(d => {
            const folioStr = String(d.folio ?? '').toLowerCase();
            const rutStr = String(d.counterparty_rut ?? d.counterparty_tax_id ?? d.rut ?? '').toLowerCase();
            const cleanRut = rutStr.replace(/[\.\-\s]/g, '');
            const nameStr = String(d.counterparty_name ?? d.description ?? '').toLowerCase();
            const accountStr = String(d.account_label ?? '').toLowerCase();
            const dateStr = String(d.issue_date ?? '').toLowerCase();
            const text = `${folioStr} ${rutStr} ${nameStr} ${accountStr} ${dateStr}`;
            
            const matchesText = text.includes(debouncedQuery) || (cleanQuery.length > 0 && (cleanRut.includes(cleanQuery) || folioStr.includes(cleanQuery)));
            const matchesMonto = !Number.isNaN(Number(debouncedQuery)) && (String(Math.round(Number(d.total_amount || 0))).includes(debouncedQuery) || String(Math.round(Number(d.remaining_amount || 0))).includes(debouncedQuery));
            return matchesText || matchesMonto;
         });
      }

      if (modalSortConfig.dir !== 'none') {
         const { key, dir } = modalSortConfig;
         const mult = dir === 'asc' ? 1 : -1;
         
         rows.sort((a, b) => {
            if (key === 'issue_date') {
               const da = a.issue_date ? new Date(a.issue_date).getTime() : 0;
               const db = b.issue_date ? new Date(b.issue_date).getTime() : 0;
               return (da - db) * mult;
            }
            if (key === 'remaining_amount') {
               const ra = Number(a.remaining_amount || 0);
               const rb = Number(b.remaining_amount || 0);
               return (ra - rb) * mult;
            }
            if (key === 'total_amount') {
               const ta = Number(a.total_amount || 0);
               const tb = Number(b.total_amount || 0);
               return (ta - tb) * mult;
            }
            if (key === 'type') {
               const typeA = (a.target_kind || selectedTargetKind) === 'bank_transaction' ? (a.bank_type === 'expense' ? 'Cargo' : 'Abono') : getSiiDocumentTypeLabel(a.doc_type_code);
               const typeB = (b.target_kind || selectedTargetKind) === 'bank_transaction' ? (b.bank_type === 'expense' ? 'Cargo' : 'Abono') : getSiiDocumentTypeLabel(b.doc_type_code);
               return String(typeA || '').localeCompare(String(typeB || '')) * mult;
            }
            if (key === 'description') {
               const descA = a.counterparty_name || a.description || "";
               const descB = b.counterparty_name || b.description || "";
               return String(descA || '').localeCompare(String(descB || '')) * mult;
            }
            return 0;
         });
      }

      return rows;
   }, [debouncedQuery, modalTipo, selectedTargetKind, targetCandidates, modalSortConfig]);

   const modalTypeOptions = useMemo(() => (
      reconcileDocumentSide === 'income'
         ? [
            { value: '', label: 'Todas las ventas' },
            { value: '1001', label: SII_DOCUMENT_TYPES[1001].label },
            { value: '33', label: SII_DOCUMENT_TYPES[33].label },
            { value: '34', label: SII_DOCUMENT_TYPES[34].label },
            { value: '39', label: SII_DOCUMENT_TYPES[39].label },
            { value: '41', label: SII_DOCUMENT_TYPES[41].label },
         ]
         : [
            { value: '', label: 'Todas las compras' },
            { value: '1002', label: SII_DOCUMENT_TYPES[1002].label },
            { value: '33', label: SII_DOCUMENT_TYPES[33].label },
            { value: '34', label: SII_DOCUMENT_TYPES[34].label },
         ]
   ), [reconcileDocumentSide]);

   const isCandidateSelected = useCallback((candidate) => {
      if (!candidate?.id) return false;
      return selectedDocIds.some((id) => Number(id) === Number(candidate?.id));
   }, [selectedDocIds]);

   const toggleCandidateSelection = useCallback((candidate) => {
      if (!candidate?.id) return;
      const kind = candidate.target_kind || selectedTargetKind;

      setSelectedTargetKind(kind);
      setSelectedDocIds((current) => {
         const id = Number(candidate.id);
         const exists = current.some((item) => Number(item) === id);
         const next = exists ? current.filter((item) => Number(item) !== id) : [...current, id];
         setSelectedDocId(next.length ? next[next.length - 1] : null);
         return next;
      });
   }, [selectedTargetKind]);

   const exportXLSX = () => {
      const rows = bankRows.map((r) => ({
         fecha: r.fecha ?? "",
         cuenta_corriente: r.cuenta_corriente ?? "",
         documento: r.documento ?? "",
         descripcion: r.descripcion || "",
         cargo: r.monto < 0 ? Math.abs(r.monto) : 0,
         abono: r.monto > 0 ? r.monto : 0,
         estado: r.raw?.remaining_amount === 0 ? "conciliado" : "pendiente",
         fuente: r.source,
      }));

      const headers = ["fecha", "cuenta_corriente", "documento", "descripcion", "cargo", "abono", "estado", "fuente"];
      const data = [headers, ...rows.map((o) => headers.map((h) => o[h]))];
      const ws = XLSX.utils.aoa_to_sheet(data);
      ws["!cols"] = headers.map((h, idx) => ({ wch: Math.min(Math.max(h.length + 2, 12), 40) }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Cartolas");
      XLSX.writeFile(wb, "cartolas-filtradas.xlsx");
   };

   // variables visuales
   const menuLoading = loadingAuto || menuDelay || loadingDocumentSearch || loadingBankSearch;
   const bankCardTheme = {
      '--bankcard-surface': 'var(--bg-content)',
      '--bankcard-surface-2': 'var(--surface-1)',
      '--bankcard-border': 'var(--border-subtle)',
      '--bankcard-text': 'var(--heading)',
      '--bankcard-soft': 'var(--text-soft)',
      '--bankcard-link': 'var(--brand)',
      '--bankcard-accent': '#5CB9A5',
      '--bankcard-success': 'var(--success)',
      '--bankcard-warning': 'var(--warning)',
      '--bankcard-danger': 'var(--danger)',
      '--bankcard-gradient': 'linear-gradient(135deg, var(--surface-1) 0%, var(--bg-content) 100%)',
      '--bankcard-ring': 'var(--brand-soft-bg)',
   };

   if (!hasAuth) {
      return (
         <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
            <h1 className="text-lg font-semibold">Tu sesion no esta disponible</h1>
            <p className="mt-1 text-sm">
               Inicia sesion nuevamente para cargar este modulo.
            </p>
         </div>
      );
   }

   if (!ready) {
      return <EntityRequiredNotice />;
   }

   return (
      <div className="animate-fade-in space-y-6">
         {/* 1. Header con Breadcrumb, Título y Acciones */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <div className="flex items-center gap-1.5 text-xs text-[#8E9BB5] mb-1">
                  <span>Banco</span>
                  <span>&gt;</span>
                  <span className="text-[#0A1A3F] font-medium">Movimientos bancarios</span>
               </div>
               <h1 className="text-3xl font-black font-nunito text-[#0A1A3F] tracking-tight">
                  Movimientos bancarios
               </h1>
               <p className="text-xs text-[#55607A] mt-1">
                  Tus cartolas en un solo lugar. Concilia cada movimiento con su boleta o factura.
               </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
               {/* Botón XLSX */}
               <button
                  type="button"
                  onClick={exportXLSX}
                  disabled={loading}
                  className="rounded-full border border-[#E2EAFD] bg-white text-[#0A1A3F] text-xs font-bold px-4 py-2 flex items-center gap-2 shadow-xs hover:bg-[#F8FAFC] transition cursor-pointer disabled:opacity-50"
                  title="Exportar movimientos a Excel (XLSX)"
               >
                  <ExcelIcon className="w-4 h-4" />
                  <span>XLSX</span>
               </button>

               {/* Botón Generar boletas */}
               {canBoletear && (
                  <button
                     type="button"
                     disabled={selectedBoleteoIds.size === 0}
                     onClick={() => setBatchBoletearModalOpen(true)}
                     className={`rounded-full border border-[#E2EAFD] bg-white text-[#0A1A3F] text-xs font-bold px-4 py-2 flex items-center gap-2 shadow-xs hover:bg-[#F8FAFC] transition ${
                        selectedBoleteoIds.size > 0 ? 'cursor-pointer active:scale-95' : 'opacity-60 cursor-not-allowed'
                     }`}
                     title={
                        selectedBoleteoIds.size > 0
                           ? `Generar ${selectedBoleteoIds.size} boleta(s) exenta(s) en lote`
                           : 'Selecciona abonos con las casillas para generar boletas'
                     }
                  >
                     <DocumentoIcon className="w-4 h-4 text-[#0A1A3F]" />
                     <span>Generar boletas ({selectedBoleteoIds.size})</span>
                  </button>
               )}

               {/* Botón Agregar movimiento */}
               {canUploadCartola && (
                  <button
                     type="button"
                     onClick={openUploadModal}
                     className="rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold px-5 py-2.5 flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
                  >
                     <SubirIcon className="w-4 h-4 text-white" dotColor="white" />
                     <span>Agregar movimiento</span>
                  </button>
               )}

               {/* Sincronización automática/manual con banco (Emisso) */}
               {currentSelectedAccount?.emisso_connection_id && canSyncBank && (
                  <div className="inline-flex items-center rounded-full border border-[#E2EAFD] bg-white shadow-xs overflow-hidden h-9">
                     <button
                        type="button"
                        onClick={handleManualEmissoSync}
                        disabled={isManualSyncing || currentSelectedAccount?.sync_status === 'syncing' || emissoLimitReached}
                        className="inline-flex items-center gap-1.5 px-3.5 h-full text-xs font-bold text-[#0A1A3F] hover:bg-[#F8FAFC] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={
                           emissoLimitReached
                              ? `Límite mensual alcanzado (${emissoSyncUsed}/${emissoSyncLimit} sincronizaciones manuales este mes). La sincronización automática cada 4 horas sigue activa.`
                              : `Actualizar movimientos manualmente con el banco (${emissoSyncUsed} de ${emissoSyncLimit} usos este mes)`
                        }
                     >
                        <svg className={`w-3.5 h-3.5 text-[#1F6BFF] shrink-0 ${isManualSyncing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                        <span>{isManualSyncing ? 'Sincronizando...' : 'Actualizar movimientos'}</span>
                        <span
                           data-testid="emisso-sync-counter"
                           className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold leading-none ${
                              emissoLimitReached
                                 ? 'bg-red-50 text-red-600 border border-red-200'
                                 : emissoSyncUsed >= Math.floor(emissoSyncLimit * 0.85)
                                    ? 'bg-amber-50 text-amber-600 border border-amber-200'
                                    : 'bg-[#EEF3FF] text-[#1F6BFF]'
                           }`}
                        >
                           {hasEmissoQuotaLoaded ? `${emissoSyncUsed}/${emissoSyncLimit}` : `—/${emissoSyncLimit}`}
                        </span>
                     </button>

                     <button
                        type="button"
                        onClick={() => setShowSyncPeriodModal(true)}
                        disabled={isManualSyncing || currentSelectedAccount?.sync_status === 'syncing' || emissoLimitReached}
                        className="px-3 h-full text-xs font-semibold text-[#8E9BB5] hover:text-[#0A1A3F] hover:bg-[#F8FAFC] border-l border-[#E2EAFD] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        title={
                           emissoLimitReached
                              ? `Límite mensual alcanzado (${emissoSyncUsed}/${emissoSyncLimit}). Espera al próximo mes o utiliza la sincronización automática.`
                              : 'Sincronizar mes específico o rango histórico'
                        }
                     >
                        <span>Histórico</span>
                     </button>
                  </div>
               )}
            </div>
         </div>

         {/* 2. Cuatro Tarjetas KPI */}
         <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Tarjeta 1: Conciliación general */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex flex-col justify-between shadow-xs">
               <div className="flex items-center justify-between">
                  <span className="font-nunito font-bold text-sm text-[#0A1A3F]">
                     {reconciledPercent.toLocaleString('es-CL', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}% conciliado
                  </span>
                  <span className="text-xs text-[#8E9BB5] font-medium">
                     {pendingMovements} movimientos por revisar
                  </span>
               </div>
               <div className="w-full bg-[#EEF3FF] h-2.5 rounded-full overflow-hidden mt-3">
                  <div
                     className="bg-[#1F6BFF] h-full rounded-full transition-all duration-500"
                     style={{ width: `${Math.min(100, Math.max(0, reconciledPercent))}%` }}
                  />
               </div>
            </div>

            {/* Tarjeta 2: Sugerencias de conciliación */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
               <div className="w-11 h-11 rounded-xl bg-[#EFF3FF] flex items-center justify-center shrink-0">
                  <ConciliarIcon className="w-5 h-5 text-[#0A1A3F]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-medium">Sugerencias de conciliación</div>
                  <div className="font-nunito font-black text-2xl text-[#0A1A3F] leading-tight mt-0.5">
                     {sugBadgeLoading ? '…' : sugerenciasCount}
                  </div>
               </div>
            </div>

            {/* Tarjeta 3: Abonos del mes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
               <div className="w-11 h-11 rounded-xl bg-[#EFF3FF] flex items-center justify-center shrink-0">
                  <IngresosIcon className="w-5 h-5 text-[#0A1A3F]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-medium">Abonos del mes</div>
                  <div className="font-nunito font-black text-xl text-[#0A1A3F] leading-tight mt-0.5 tabular-nums">
                     $ {Math.abs(abonosSum).toLocaleString('es-CL')}
                  </div>
               </div>
            </div>

            {/* Tarjeta 4: Cargos del mes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 flex items-center gap-3.5 shadow-xs">
               <div className="w-11 h-11 rounded-xl bg-[#EFF3FF] flex items-center justify-center shrink-0">
                  <EgresosIcon className="w-5 h-5 text-[#0A1A3F]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-medium">Cargos del mes</div>
                  <div className="font-nunito font-black text-xl text-[#0A1A3F] leading-tight mt-0.5 tabular-nums">
                     $ {Math.abs(cargosSum).toLocaleString('es-CL')}
                  </div>
               </div>
            </div>
         </div>

         {/* 3. Toolbar: Pestañas de estado, Por conciliar, Selector de cuentas, Búsqueda y Filtros en tarjeta blanca Jeito */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-3 md:p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-4">
            {/* Grupo izquierdo: Pestañas en cápsula + Por conciliar */}
            <div className="flex flex-wrap items-center gap-3">
               <div className="inline-flex p-1 bg-[#EEF3FF] rounded-full items-center gap-1">
                  <button
                     type="button"
                     onClick={resetAll}
                     className={`px-4 py-1.5 text-xs rounded-full font-bold transition-all cursor-pointer ${
                        tab === "todos"
                           ? "bg-white text-[#0A1A3F] shadow-xs"
                           : "text-[#55607A] hover:text-[#0A1A3F]"
                     }`}
                  >
                     Todos
                  </button>

                  <button
                     type="button"
                     onClick={handleOpenSuggestions}
                     className={`px-3.5 py-1.5 text-xs rounded-full font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        tab === "sugerencias"
                           ? "bg-white text-[#0A1A3F] shadow-xs"
                           : "text-[#55607A] hover:text-[#0A1A3F]"
                     }`}
                  >
                     <span>Sugerencias</span>
                     {sugBadgeLoading ? (
                        <span className="inline-block w-3 h-3 border-2 border-[#1F6BFF] border-t-transparent rounded-full animate-spin"></span>
                     ) : (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#1F6BFF] text-white font-bold leading-none">
                           {sugerenciasBadgeText}
                        </span>
                     )}
                  </button>

                  <button
                     type="button"
                     onClick={() => switchTabWithReset("abonos")}
                     className={`px-3.5 py-1.5 text-xs rounded-full font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        tab === "abonos"
                           ? "bg-white text-[#0A1A3F] shadow-xs"
                           : "text-[#55607A] hover:text-[#0A1A3F]"
                     }`}
                  >
                     <span>Abonos</span>
                     {abonosLoading ? (
                        <span className="inline-block w-3 h-3 border-2 border-[#1F6BFF] border-t-transparent rounded-full animate-spin"></span>
                     ) : (
                        <span className="text-xs font-bold text-[#55607A] ml-0.5">{abonosTotal}</span>
                     )}
                  </button>

                  <button
                     type="button"
                     onClick={() => switchTabWithReset("cargos")}
                     className={`px-3.5 py-1.5 text-xs rounded-full font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                        tab === "cargos"
                           ? "bg-white text-[#0A1A3F] shadow-xs"
                           : "text-[#55607A] hover:text-[#0A1A3F]"
                     }`}
                  >
                     <span>Cargos</span>
                     {cargosLoading ? (
                        <span className="inline-block w-3 h-3 border-2 border-[#1F6BFF] border-t-transparent rounded-full animate-spin"></span>
                     ) : (
                        <span className="text-xs font-bold text-[#55607A] ml-0.5">{cargosTotal}</span>
                     )}
                  </button>
               </div>

               {tab !== "sugerencias" && (
                  <label className="inline-flex items-center gap-2.5 text-xs font-bold text-[#0A1A3F] ml-1 cursor-pointer select-none">
                     <input
                        type="checkbox"
                        className="w-5 h-5 rounded-lg border-2 border-[#C3D4FA] text-[#1F6BFF] focus:ring-0 accent-[#1F6BFF] cursor-pointer transition-colors"
                        checked={soloPorConciliar}
                        onChange={(e) => {
                           setSoloPorConciliar(e.target.checked);
                           setPage(0);
                        }}
                     />
                     <span>Por conciliar</span>
                  </label>
               )}
            </div>

            {/* Grupo derecho: Selector cuenta, Búsqueda rápida y Filtros */}
            <div className="flex flex-wrap items-center gap-2.5">
               {/* Selector de cuenta */}
               <div className="relative">
                  <select
                     value={ctaCorriente}
                     onChange={(e) => {
                        setCtaCorriente(e.target.value);
                        setApplied(prev => ({ ...prev, ctaCorriente: e.target.value }));
                        setPage(0);
                     }}
                     className="rounded-full border border-[#E2EAFD] bg-white text-xs font-semibold px-4 py-2 pr-9 text-[#0A1A3F] appearance-none cursor-pointer focus:outline-none focus:border-[#1F6BFF] shadow-xs"
                  >
                     <option value="">Todas las cuentas</option>
                     {cuentasDisponibles.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                     ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-[#55607A]">
                     <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                     </svg>
                  </div>
               </div>

               {/* Búsqueda rápida */}
               <div className="relative">
                  <BuscarIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E9BB5]" />
                  <input
                     type="text"
                     placeholder="Monto, glosa o N° doc."
                     value={quickSearch}
                     onChange={handleQuickSearchChange}
                     className="rounded-full border border-[#E2EAFD] bg-white pl-10 pr-4 py-2 text-xs text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF] shadow-xs w-52 sm:w-60"
                  />
               </div>

               {/* Botón Filtros */}
               <button
                  type="button"
                  onClick={() => setMostrarFiltros((v) => !v)}
                  aria-expanded={mostrarFiltros}
                  aria-controls={FILTER_PANEL_ID}
                  className={`rounded-full border border-[#E2EAFD] px-4 py-2 text-xs font-bold flex items-center gap-2 shadow-xs transition cursor-pointer ${
                     mostrarFiltros
                        ? 'bg-[#EEF3FF] text-[#1F6BFF] border-[#1F6BFF]'
                        : 'bg-white text-[#0A1A3F] hover:bg-[#F8FAFC]'
                  }`}
                  title={mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
               >
                  <FiltroIcon className="w-3.5 h-3.5 text-[#0A1A3F]" />
                  <span>Filtros</span>
               </button>
            </div>
         </div>

         {/* 4. Panel desplegable de filtros estilo Ventas (idéntico a SalesBoletas) */}
         <div
            id={FILTER_PANEL_ID}
            role="region"
            aria-labelledby={FILTER_HEADING_ID}
            aria-hidden={!mostrarFiltros}
            className={[
               "relative transition-all duration-300 ease-out origin-top",
               mostrarFiltros
                  ? "z-[80] opacity-100 max-h-[1400px] mb-4 scale-100 overflow-visible"
                  : "z-0 opacity-0 max-h-0 mb-0 p-0 pointer-events-none scale-[.98] overflow-hidden",
            ].join(" ")}
         >
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs space-y-4">
               {/* Header del panel (idéntico a Ventas) */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold font-nunito text-[#0A1A3F]">
                     <FiltroIcon className="w-4 h-4 text-[#0A1A3F]" />
                     <span id={FILTER_HEADING_ID}>Filtros de búsqueda</span>
                  </div>
                  <div className="flex items-center gap-4">
                     <button
                        type="button"
                        onClick={resetAll}
                        disabled={loading}
                        className="text-xs font-semibold text-[#55607A] hover:text-[#1F6BFF] flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                     >
                        <SincronizarIcon className="w-3.5 h-3.5" />
                        <span>Limpiar filtros</span>
                     </button>

                     <button
                        type="button"
                        onClick={() => setMostrarFiltros(false)}
                        className="text-xs font-semibold text-[#8E9BB5] hover:text-[#0A1A3F] transition-colors cursor-pointer"
                        title="Ocultar filtros"
                     >
                        Ocultar
                     </button>
                  </div>
               </div>

               {/* Campos de filtro estilo Ventas (Fila 1) */}
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

                  {/* NRO DOCUMENTO */}
                  <div className="space-y-1 lg:col-span-2">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">N° Documento</label>
                     <input
                        type="text"
                        placeholder="Ej: 000001890"
                        value={nroDocumento}
                        onChange={(e) => setNroDocumento(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyAndFetch()}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF]"
                     />
                  </div>

                  {/* DESCRIPCIÓN O GLOSA */}
                  <div className="space-y-1 lg:col-span-4">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Descripción o glosa</label>
                     <div className="relative">
                        <BuscarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8E9BB5]" />
                        <input
                           type="text"
                           placeholder="Buscar por descripción..."
                           value={descripcion}
                           onChange={(e) => setDescripcion(e.target.value)}
                           onKeyDown={(e) => e.key === "Enter" && applyAndFetch()}
                           className="w-full h-10 pl-9 pr-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF]"
                        />
                     </div>
                  </div>

                  {/* CUENTA CORRIENTE */}
                  <div className="space-y-1 lg:col-span-3">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Cuenta corriente</label>
                     <select
                        value={ctaCorriente}
                        onChange={(e) => setCtaCorriente(e.target.value)}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                     >
                        <option value="">Todas las cuentas</option>
                        {cuentasDisponibles.map((c) => (
                           <option key={c.id} value={c.id}>{c.label}</option>
                        ))}
                     </select>
                  </div>

                  {/* TIPO */}
                  <div className="space-y-1 lg:col-span-2">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Tipo</label>
                     <select
                        value={tab === 'abonos' ? 'Abonos' : tab === 'cargos' ? 'Cargos' : tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        disabled={tab === 'abonos' || tab === 'cargos'}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer disabled:opacity-60"
                     >
                        <option value="Todos">Todos los tipos</option>
                        <option value="Abonos">Abonos</option>
                        <option value="Cargos">Cargos</option>
                     </select>
                  </div>
               </div>

               {/* Campos de filtro (Fila 2) */}
               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-3 items-end pt-1">
                  {/* MONTO */}
                  <div className="space-y-1 lg:col-span-2">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Monto exacto</label>
                     <input
                        type="text"
                        placeholder="Ej: 120000"
                        value={montoFiltro}
                        onChange={(e) => setMontoFiltro(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyAndFetch()}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF]"
                     />
                  </div>

                  {/* FECHA DESDE */}
                  <div className="space-y-1 lg:col-span-3">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Fecha desde</label>
                     <DateInput
                        id="f-fecha-ini"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                        value={fechaIni}
                        onChange={setFechaIni}
                     />
                  </div>

                  {/* FECHA HASTA */}
                  <div className="space-y-1 lg:col-span-3">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Fecha hasta</label>
                     <DateInput
                        id="f-fecha-fin"
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                        value={fechaFin}
                        onChange={setFechaFin}
                        min={fechaIni || undefined}
                     />
                  </div>

                  {/* CUENTA CONTRAPARTE */}
                  <div className="space-y-1 lg:col-span-2">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Cuenta contraparte</label>
                     <input
                        type="text"
                        placeholder="N° cuenta contraparte..."
                        value={cuenta}
                        onChange={(e) => setCuenta(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyAndFetch()}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:border-[#1F6BFF]"
                     />
                  </div>

                  {/* FILAS POR PÁGINA */}
                  <div className="space-y-1 lg:col-span-2">
                     <label className="block text-[10px] font-bold uppercase tracking-wider text-[#55607A]">Por página</label>
                     <select
                        value={pageSize}
                        onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
                        className="w-full h-10 px-3 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                     >
                        <option value={25}>25 filas</option>
                        <option value={50}>50 filas</option>
                        <option value={100}>100 filas</option>
                        <option value={200}>200 filas</option>
                     </select>
                  </div>
               </div>

               {/* Acciones del panel de filtros */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3.5 border-t border-[#E2EAFD]">
                  <div className="text-xs text-[#8E9BB5] flex items-center gap-1.5">
                     <span>Presiona</span>
                     <kbd className="px-1.5 py-0.5 rounded-md border border-[#E2EAFD] bg-[#F8FAFC] text-[11px] font-mono text-[#0A1A3F] font-semibold">Enter</kbd>
                     <span>para aplicar filtros en cualquier momento</span>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                     <button
                        type="button"
                        onClick={resetAll}
                        className="px-4 py-2 text-xs font-bold text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#F8FAFC] rounded-full border border-[#E2EAFD] transition cursor-pointer"
                     >
                        Limpiar filtros
                     </button>

                     <button
                        type="button"
                        disabled={loading}
                        onClick={applyAndFetch}
                        className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#1F6BFF] hover:bg-[#1657D7] rounded-full shadow-xs transition disabled:opacity-60 cursor-pointer"
                     >
                        <BuscarIcon className="w-3.5 h-3.5" />
                        <span>{loading ? "Buscando..." : "Filtrar"}</span>
                     </button>
                  </div>
               </div>
            </div>
         </div>

         {/* 5. Panel de sugerencias de conciliación (si tab === 'sugerencias') */}
         {tab === 'sugerencias' && (
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs">
               <ReconcileSuggestionsPanel
                  baseUrl="https://api.leinsadvisor.cl/api/v1"
                  headers={headers}
                  entityId={entityId}
                  accountId={reconcileSuggestionAccountId}
                  type={reconcileSuggestionType}
                  dateFrom={toYmd(applied.fechaIni)}
                  dateTo={toYmd(applied.fechaFin)}
                  onApplied={handleReconcileApplied}
               />
            </div>
         )}

         {/* 6. Tabla de movimientos bancarios (si tab !== 'sugerencias') */}
         {tab !== 'sugerencias' && (
            <div className={`bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs space-y-4 transition-all animate-fade-in ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
               <div className="overflow-x-auto -mx-6 px-6">
                  <table className="min-w-full text-left text-xs">
                     <thead className="border-b border-[#E2EAFD] text-[#55607A] font-bold">
                        <tr>
                           <th className="pb-3 px-3 w-8 text-center">
                              <input
                                 type="checkbox"
                                 checked={allSelectableChecked}
                                 onChange={handleToggleSelectAllBoleteo}
                                 disabled={selectableBoleteoRows.length === 0}
                                 className="w-4 h-4 rounded border-[#C3D4FA] text-[#1F6BFF] focus:ring-0 accent-[#1F6BFF] cursor-pointer disabled:opacity-30"
                                 title={allSelectableChecked ? "Deseleccionar todos" : "Seleccionar todos los abonos pendientes"}
                              />
                           </th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] whitespace-nowrap">Fecha / cuenta ⇅</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] whitespace-nowrap">N° doc.</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A]">Descripción</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] text-right whitespace-nowrap">Cargo</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] text-right whitespace-nowrap">Abono</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] text-right whitespace-nowrap">Saldo</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] text-center whitespace-nowrap">Estado</th>
                           <th className="pb-3 px-4 font-bold text-[#55607A] text-right whitespace-nowrap">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#F0F4FE]">
                        {bankRows.length === 0 && (
                           <tr>
                              <td className="py-12 text-center text-[#8E9BB5] font-medium" colSpan={9}>
                                 Sin movimientos para los filtros seleccionados.
                              </td>
                           </tr>
                        )}

                        {bankRows.map((r) => {
                           const remaining = Math.max(0, Number(r.raw?.remaining_amount ?? Math.abs(r.monto)));
                           const cargo = r.monto < 0 ? Math.abs(r.monto) : 0;
                           const abono = r.monto > 0 ? r.monto : 0;
                           const bankTxId = r.raw?.id ?? (typeof r._id === 'string' && r._id.startsWith('tx-') ? Number(r._id.replace('tx-', '')) : r._id);
                           const appliedSum = Number(r.raw?.applied_sum || 0);
                           const boletaStatus = boletaMap[bankTxId]?.status;
                           const isSelectableForBoleteo = abono > 0 && remaining > 0 && (!boletaStatus || boletaStatus === 'cancelled' || boletaStatus === 'failed');

                           return (
                              <tr key={r._id || bankTxId} className="hover:bg-[#F8FAFF] transition-colors">
                                 <td className="py-3.5 px-3 text-center">
                                    {isSelectableForBoleteo ? (
                                       <input
                                          type="checkbox"
                                          checked={selectedBoleteoIds.has(bankTxId)}
                                          onChange={() => handleToggleRowBoleteo(bankTxId)}
                                          className="w-4 h-4 rounded border-[#C3D4FA] text-[#1F6BFF] focus:ring-0 accent-[#1F6BFF] cursor-pointer"
                                          title="Seleccionar para generar boleta exenta"
                                       />
                                    ) : (
                                       <input
                                          type="checkbox"
                                          disabled
                                          checked={false}
                                          className="w-4 h-4 rounded border-[#E2EAFD] opacity-20 cursor-not-allowed"
                                       />
                                    )}
                                 </td>

                                 <td className="py-3.5 px-4 whitespace-nowrap">
                                    <div className="text-xs font-semibold text-[#0A1A3F]">{r.fecha}</div>
                                    <div className="text-[11px] text-[#8E9BB5] mt-0.5">
                                       {r.cuenta_corriente
                                          ? (String(r.cuenta_corriente).includes('••••')
                                                ? r.cuenta_corriente
                                                : `Cta. cte. ••••${String(r.cuenta_corriente).slice(-4)}`)
                                          : (r.source === 'bank' ? 'Cta. cte.' : 'SII')}
                                    </div>
                                 </td>

                                 <td className="py-3.5 px-4 whitespace-nowrap text-xs text-[#55607A] font-medium">
                                    {r.documento || '—'}
                                 </td>

                                 <td className="py-3.5 px-4">
                                    <div className="text-xs font-bold text-[#0A1A3F] leading-snug">
                                       {r.descripcion}
                                    </div>
                                    {Boolean(r.raw?.suggestion_count || r.has_suggestion) && (
                                       <div className="text-[11px] text-[#1F6BFF] font-semibold mt-0.5">
                                          {r.raw?.suggestion_count === 1
                                             ? '1 sugerencia con calce exacto'
                                             : `${r.raw?.suggestion_count || 1} sugerencias con calce exacto`}
                                       </div>
                                    )}
                                 </td>

                                 <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    {cargo > 0 ? (
                                       <span className="text-xs font-bold text-[#0A1A3F] tabular-nums">
                                          -$ {Math.abs(cargo).toLocaleString('es-CL')}
                                       </span>
                                    ) : (
                                       <span className="text-[#8E9BB5]">—</span>
                                    )}
                                 </td>

                                 <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    {abono > 0 ? (
                                       <span className="text-xs font-bold text-[#1F6BFF] tabular-nums">
                                          +$ {Math.abs(abono).toLocaleString('es-CL')}
                                       </span>
                                    ) : (
                                       <span className="text-[#8E9BB5]">—</span>
                                    )}
                                 </td>

                                 <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    {r.raw?.balance != null ? (
                                       <span className="text-xs font-medium text-[#55607A] tabular-nums">
                                          $ {Math.abs(Number(r.raw.balance)).toLocaleString('es-CL')}
                                       </span>
                                    ) : (
                                       <span className="text-[#8E9BB5]">—</span>
                                    )}
                                 </td>

                                 <td className="py-3.5 px-4 text-center whitespace-nowrap">
                                    <div className="flex flex-col items-center justify-center">
                                       {remaining === 0 ? (
                                          <>
                                             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF3FF] text-[#1F6BFF] text-xs font-bold shadow-xs">
                                                <span className="w-2 h-2 rounded-full bg-[#1F6BFF]" />
                                                <span>Conciliado</span>
                                             </span>
                                             <span className="text-[10px] text-[#8E9BB5] font-medium mt-0.5">
                                                $ {Math.abs(Number(r.monto)).toLocaleString('es-CL')} conciliado
                                             </span>
                                          </>
                                       ) : (
                                          <>
                                             <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#EEF3FF] border-2 border-[#C3D4FA] text-[#0A1A3F] text-xs font-bold shadow-xs">
                                                <svg className="w-2.5 h-2.5 text-[#0A1A3F]" viewBox="0 0 16 16">
                                                   <circle cx="8" cy="8" r="4.5" stroke="currentColor" strokeWidth="2.75" fill="none" />
                                                </svg>
                                                <span>Por conciliar</span>
                                             </span>
                                             <span className="text-[10px] text-[#8E9BB5] font-medium mt-0.5">
                                                $ {Math.abs(remaining).toLocaleString('es-CL')} por asignar
                                             </span>
                                          </>
                                       )}

                                       {/* Estados de boleta electrónica si aplica */}
                                       {boletaStatus === 'pending' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 mt-1">
                                             <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                             Boleteo en cola
                                          </span>
                                       )}
                                       {boletaStatus === 'processing' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 mt-1 animate-pulse">
                                             <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                             Emitiendo en SII...
                                          </span>
                                       )}
                                       {boletaStatus === 'completed' && (
                                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 mt-1">
                                             <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                             Folio {boletaMap[bankTxId]?.folio || 'Emitida'}
                                          </span>
                                       )}
                                       {boletaStatus === 'failed' && (
                                          <div className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 mt-1">
                                             <span>❌ Error boleta</span>
                                          </div>
                                       )}
                                    </div>
                                 </td>

                                 <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-2">
                                       {remaining === 0 ? (
                                          <button
                                             type="button"
                                             onClick={() => {
                                                setReconciliationDetailTxId(bankTxId);
                                                setReconciliationDetailTxAmount(Math.abs(r.monto));
                                             }}
                                             className="inline-flex items-center gap-1.5 text-xs font-bold text-[#55607A] hover:text-[#1F6BFF] transition-colors cursor-pointer"
                                          >
                                             <VerIcon className="w-3.5 h-3.5 text-[#55607A]" />
                                             <span>Detalle</span>
                                          </button>
                                       ) : (
                                          <>
                                             {canReconcile && (
                                                <button
                                                   type="button"
                                                   onClick={() => openConciliar(r)}
                                                   className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
                                                >
                                                   <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                      <polyline points="3.5 8.5 6.5 11.5 12.5 5.5" />
                                                   </svg>
                                                   <span>Conciliar</span>
                                                </button>
                                             )}

                                             <div className="relative">
                                                <button
                                                   type="button"
                                                   onClick={(e) => {
                                                      e.stopPropagation();
                                                      setOpenActionMenuId(openActionMenuId === bankTxId ? null : bankTxId);
                                                   }}
                                                   className="p-1 rounded-full text-[#8E9BB5] hover:text-[#0A1A3F] hover:bg-[#EEF3FF] transition cursor-pointer"
                                                   title="Más opciones"
                                                >
                                                   <MasOpcionesIcon className="w-4 h-4" />
                                                </button>

                                                {openActionMenuId === bankTxId && (
                                                   <div
                                                      className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-lg border border-[#E2EAFD] py-1 z-30 animate-fade-in"
                                                      onClick={(e) => e.stopPropagation()}
                                                   >
                                                      {appliedSum > 0 && (
                                                         <button
                                                            type="button"
                                                            onClick={() => {
                                                               setOpenActionMenuId(null);
                                                               setReconciliationDetailTxId(bankTxId);
                                                               setReconciliationDetailTxAmount(Math.abs(r.monto));
                                                            }}
                                                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-[#0A1A3F] hover:bg-[#EEF3FF] flex items-center gap-2 cursor-pointer"
                                                         >
                                                            <VerIcon className="w-3.5 h-3.5 text-[#55607A]" />
                                                            <span>Ver detalle</span>
                                                         </button>
                                                      )}
                                                      {canDeleteMovement && appliedSum <= 0 && (
                                                         <button
                                                            type="button"
                                                            disabled={deletingTxId === bankTxId}
                                                            onClick={() => {
                                                               setOpenActionMenuId(null);
                                                               handleDeleteTransaction(bankTxId);
                                                            }}
                                                            className="w-full text-left px-3.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                                         >
                                                            <EliminarIcon className="w-3.5 h-3.5 text-red-600" />
                                                            <span>{deletingTxId === bankTxId ? 'Eliminando...' : 'Eliminar movimiento'}</span>
                                                         </button>
                                                      )}
                                                   </div>
                                                )}
                                             </div>
                                          </>
                                       )}
                                    </div>
                                 </td>
                              </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>

               {/* Paginación exacta estilo Jeito */}
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[#E2EAFD]">
                  <div className="text-xs text-[#8E9BB5] font-medium">
                     Mostrando {startItem}–{endItem} de {total}
                  </div>

                  <div className="flex items-center gap-1.5 self-center sm:self-auto">
                     <button
                        type="button"
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 rounded-lg border border-[#E2EAFD] text-[#55607A] hover:bg-[#EEF3FF] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Anterior"
                     >
                        <IzquierdaIcon className="w-4 h-4" />
                     </button>

                     {renderPageNumbers().map((p, idx) => {
                        if (typeof p === 'string') {
                           return <span key={`ellipsis-${idx}`} className="text-xs text-[#8E9BB5] px-1 select-none">…</span>;
                        }
                        const isActive = p === page;
                        return (
                           <button
                              key={p}
                              type="button"
                              onClick={() => setPage(p)}
                              className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center transition-colors cursor-pointer ${
                                 isActive
                                    ? 'bg-[#1F6BFF] text-white shadow-xs'
                                    : 'text-[#55607A] hover:bg-[#EEF3FF] hover:text-[#0A1A3F]'
                              }`}
                           >
                              {p + 1}
                           </button>
                        );
                     })}

                     <button
                        type="button"
                        onClick={() => setPage(p => p + 1)}
                        disabled={(page + 1) * pageSize >= total}
                        className="p-1.5 rounded-lg border border-[#E2EAFD] text-[#55607A] hover:bg-[#EEF3FF] disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                        title="Siguiente"
                     >
                        <DerechaIcon className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            </div>
         )}
         {/* ===== Modal Conciliar (Jeito Oficial Pixel-Perfect) ===== */}
         {reconcileTx && (
            <div
               className="fixed inset-0 z-[200] bg-[#0A1A3F]/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
               onClick={() => { if (!showPayableDetail) closeConciliarSmooth(); }}
            >
               <div
                  className={`w-full max-w-5xl max-h-[92vh] flex flex-col bg-white rounded-3xl shadow-2xl border border-[#E2EAFD] overflow-hidden ${
                     modalClosing ? 'animate-[fadeOutDown_.18s_ease-in_forwards]' : 'opacity-0 translate-y-2 animate-[fadeInUp_.24s_ease-out_forwards]'
                  }`}
                  onClick={(e) => e.stopPropagation()}
               >
                  {/* Header */}
                  <div className="px-6 py-4 sm:py-5 border-b border-[#E2EAFD] flex items-center justify-between bg-white shrink-0">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                           <CheckIcon className="w-5 h-5 stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                           <h2 className="font-nunito font-black text-lg text-[#0A1A3F] leading-tight">
                              {reconcileDocumentSide === 'income' ? 'Conciliar abono' : 'Conciliar cargo'}
                           </h2>
                           <p className="text-xs text-[#55607A] font-medium mt-0.5">
                              Elige la boleta o factura que corresponde a este movimiento.
                           </p>
                        </div>
                     </div>
                     <button
                        type="button"
                        onClick={closeConciliarSmooth}
                        className="p-2 rounded-full text-[#8E9BB5] hover:text-[#0A1A3F] hover:bg-[#EEF3FF] transition cursor-pointer"
                        title="Cerrar"
                     >
                        <CerrarIcon className="w-5 h-5" />
                     </button>
                  </div>

                  {/* Body (scrollable) */}
                  <div className="px-6 py-5 overflow-y-auto space-y-5 grow">
                     {/* Top 2 Comparison Cards */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Card A: Movimiento bancario */}
                        <div className="bg-[#F8FAFF] rounded-2xl border border-[#E2EAFD] p-4 flex items-center justify-between shadow-xs">
                           <div className="min-w-0 pr-2">
                              <div className="text-xs text-[#8E9BB5] font-medium truncate">
                                 Movimiento bancario  {formatYmdToDmy(reconcileTx.fecha)} · Cta. cte. {
                                    reconcileTx.cuenta_corriente
                                       ? (reconcileTx.cuenta_corriente.includes('•') ? reconcileTx.cuenta_corriente : `••••${reconcileTx.cuenta_corriente.slice(-4)}`)
                                       : '••••'
                                 }
                              </div>
                              <div className="font-nunito font-black text-sm text-[#0A1A3F] uppercase tracking-wide mt-1 truncate max-w-xs md:max-w-sm">
                                 {reconcileTx.descripcion || (reconcileDocumentSide === 'income' ? 'ABONO VENTAS DÉBITO/CRÉDITO' : 'CARGO')}
                              </div>
                              <div className="text-xs text-[#55607A] font-medium mt-1">
                                 N° documento {reconcileTx.documento || reconcileTx.raw?.document_number || '—'} · por asignar $ {txRemaining.toLocaleString('es-CL')}
                              </div>
                           </div>
                           <div className="text-right shrink-0">
                              {reconcileTx.monto >= 0 ? (
                                 <div className="font-nunito font-black text-2xl text-[#1F6BFF] tabular-nums whitespace-nowrap">
                                    +$ {Math.abs(reconcileTx.monto).toLocaleString('es-CL')}
                                 </div>
                              ) : (
                                 <div className="font-nunito font-black text-2xl text-[#0A1A3F] tabular-nums whitespace-nowrap">
                                    -$ {Math.abs(reconcileTx.monto).toLocaleString('es-CL')}
                                 </div>
                              )}
                           </div>
                        </div>

                        {/* Card B: Seleccionado y Diferencia */}
                        <div className="bg-[#F8FAFF] rounded-2xl border border-[#E2EAFD] p-4 flex flex-col justify-between shadow-xs">
                           <div>
                              <div className="flex items-center justify-between">
                                 <span className="text-xs text-[#55607A] font-medium">Seleccionado</span>
                                 <div className="flex items-center gap-1">
                                    {isEditingAssign ? (
                                       <div className="flex items-center border border-[#1F6BFF] rounded-lg px-2 py-0.5 bg-white shadow-2xs">
                                          <span className="text-xs text-[#8E9BB5] mr-1">$</span>
                                          <input
                                             type="number"
                                             autoFocus
                                             className="w-24 text-right text-sm font-black text-[#0A1A3F] focus:outline-none tabular-nums"
                                             value={assignAmount}
                                             min={0}
                                             max={maxAssignable}
                                             onChange={handleAssignChange}
                                             onBlur={() => setIsEditingAssign(false)}
                                             onKeyDown={(e) => { if (e.key === 'Enter') setIsEditingAssign(false); }}
                                          />
                                       </div>
                                    ) : (
                                       <button
                                          type="button"
                                          onClick={() => { if (selectedDocuments.length > 0 || Boolean(selectedDocId)) setIsEditingAssign(true); }}
                                          className="font-nunito font-black text-sm text-[#0A1A3F] tabular-nums hover:text-[#1F6BFF] transition cursor-pointer"
                                          title="Haz clic para ajustar el monto asignado"
                                       >
                                          $ {assigned.toLocaleString('es-CL')}
                                       </button>
                                    )}
                                 </div>
                              </div>
                              <div className="flex items-center justify-between mt-1">
                                 <span className="text-xs text-[#55607A] font-medium">Diferencia</span>
                                 <span className={`font-nunito font-black text-sm tabular-nums ${
                                    txRemainingAfter === 0 && assigned > 0 ? 'text-[#1F6BFF]' : 'text-[#0A1A3F]'
                                 }`}>
                                    $ {txRemainingAfter.toLocaleString('es-CL')}
                                 </span>
                              </div>
                           </div>
                           <div className="w-full bg-[#EEF3FF] h-2 rounded-full overflow-hidden mt-3">
                              <div
                                 className="h-full bg-[#1F6BFF] rounded-full transition-all duration-300"
                                 style={{
                                    width: `${txRemaining > 0 ? Math.min(100, Math.round((assigned / txRemaining) * 100)) : 100}%`
                                 }}
                              />
                           </div>
                        </div>
                     </div>

                     {/* Ventas agrupadas por día (Sólo para abonos / ingresos) */}
                     {reconcileDocumentSide === 'income' && (
                        <div>
                           <div className="flex flex-wrap items-center gap-2 mb-2">
                              <h3 className="font-nunito font-bold text-sm text-[#0A1A3F]">Ventas agrupadas por día</h3>
                              <p className="text-xs text-[#8E9BB5]">
                                 Suma boletas y facturas del mismo día para conciliarlas contra este abono.
                              </p>
                              {loadingDailySales && (
                                 <span className="text-xs text-[#1F6BFF] animate-pulse font-medium ml-1">agrupando...</span>
                              )}
                           </div>

                           <div className="bg-[#F8FAFF] rounded-2xl border border-[#E2EAFD] overflow-hidden">
                              {dailySalesError ? (
                                 <div className="px-4 py-3 text-xs text-red-500 font-medium">{dailySalesError}</div>
                              ) : loadingDailySales ? (
                                 <div className="px-4 py-3 text-xs text-[#8E9BB5] font-medium">Buscando ventas cercanas a la fecha del movimiento...</div>
                              ) : dailySalesGroups.length === 0 ? (
                                 <div className="px-4 py-3 text-xs text-[#8E9BB5] font-medium">No hay ventas pendientes agrupables cerca de esta fecha.</div>
                              ) : (
                                 <div className="max-h-56 overflow-auto">
                                    <table className="w-full text-xs border-collapse">
                                       <thead>
                                          <tr className="bg-[#F4F7FE] border-b border-[#E2EAFD] text-[#55607A]">
                                             <th className="py-2.5 px-4 text-left font-semibold w-[130px]">Día</th>
                                             <th className="py-2.5 px-4 text-left font-semibold">Documentos</th>
                                             <th className="py-2.5 px-4 text-right font-semibold w-[130px]">Total día</th>
                                             <th className="py-2.5 px-4 text-right font-semibold w-[130px]">Diferencia</th>
                                             <th className="py-2.5 px-4 text-right w-[140px]"></th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-[#E2EAFD]">
                                          {dailySalesGroups.slice(0, 8).map((group) => {
                                             const exactMatch = Math.abs(group.diff) <= 1;
                                             const canApply = txRemaining > 0 && group.docs.length > 0;
                                             const isSavingGroup = savingDailyGroupKey === group.key;

                                             return (
                                                <tr key={group.key} className="hover:bg-[#EEF3FF]/40 transition-colors">
                                                   <td className="py-2.5 px-4 whitespace-nowrap">
                                                      <div className="font-semibold text-[#0A1A3F]">{group.date}</div>
                                                      {exactMatch && (
                                                         <div className="text-[11px] text-[#1F6BFF] font-semibold mt-0.5">Calce exacto</div>
                                                      )}
                                                   </td>
                                                   <td className="py-2.5 px-4">
                                                      <div className="flex items-center gap-2 flex-wrap">
                                                         {group.docs.slice(0, 3).map((doc) => (
                                                            <React.Fragment key={doc.id}>
                                                               {renderDocBadge(doc.doc_type_code, doc.folio || doc.id)}
                                                            </React.Fragment>
                                                         ))}
                                                         {group.docs.length > 3 && (
                                                            <span className="text-[10px] font-semibold text-[#8E9BB5]">
                                                               +{group.docs.length - 3}
                                                            </span>
                                                         )}
                                                         <span className="text-xs text-[#55607A]">
                                                            {group.docs.length} documento{group.docs.length > 1 ? 's' : ''} pendiente{group.docs.length > 1 ? 's' : ''}
                                                         </span>
                                                      </div>
                                                   </td>
                                                   <td className="py-2.5 px-4 text-right font-bold text-[#0A1A3F] tabular-nums whitespace-nowrap">
                                                      $ {group.total.toLocaleString('es-CL')}
                                                   </td>
                                                   <td className="py-2.5 px-4 text-right font-bold tabular-nums whitespace-nowrap">
                                                      <span className={exactMatch ? 'text-[#1F6BFF]' : 'text-[#55607A]'}>
                                                         $ {Math.abs(group.diff).toLocaleString('es-CL')}
                                                      </span>
                                                   </td>
                                                   <td className="py-2.5 px-4 text-right whitespace-nowrap">
                                                      <button
                                                         type="button"
                                                         disabled={!canApply || Boolean(savingDailyGroupKey)}
                                                         onClick={() => reconcileDailySalesGroup(group)}
                                                         className="bg-[#1F6BFF] hover:bg-[#1657D7] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-xs transition cursor-pointer"
                                                         title={!canApply ? 'No hay saldo disponible para aplicar' : 'Aplicar este abono a la venta del día'}
                                                      >
                                                         {isSavingGroup ? 'Aplicando...' : 'Aplicar a día'}
                                                      </button>
                                                   </td>
                                                </tr>
                                             );
                                          })}
                                       </tbody>
                                    </table>
                                 </div>
                              )}
                           </div>
                        </div>
                     )}

                     {/* Toolbar & Selector de Tipo de Conciliación */}
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="inline-flex p-1 bg-[#EEF3FF] rounded-full items-center gap-1 self-start">
                           <button
                              type="button"
                              onClick={() => {
                                 setSelectedTargetKind('document');
                                 setSelectedDocId(null);
                                 setSelectedDocIds([]);
                                 setModalTipo('');
                              }}
                              className={`px-3.5 py-1 text-xs rounded-full transition-all cursor-pointer ${
                                 selectedTargetKind === 'document'
                                    ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                                    : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                              }`}
                           >
                              Documentos SII
                           </button>
                           <button
                              type="button"
                              onClick={() => {
                                 setSelectedTargetKind('bank_transaction');
                                 setSelectedDocId(null);
                                 setSelectedDocIds([]);
                                 setModalTipo('');
                              }}
                              className={`px-3.5 py-1 text-xs rounded-full transition-all cursor-pointer ${
                                 selectedTargetKind === 'bank_transaction'
                                    ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                                    : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                              }`}
                           >
                              Movimientos bancarios (traspaso)
                           </button>
                           {reconcileDocumentSide === 'expense' && (
                              <button
                                 type="button"
                                 onClick={() => {
                                    setSelectedTargetKind('direct_expense');
                                    setSelectedDocId(null);
                                    setSelectedDocIds([]);
                                    setModalTipo('');
                                 }}
                                 className={`px-3.5 py-1 text-xs rounded-full transition-all cursor-pointer ${
                                    selectedTargetKind === 'direct_expense'
                                       ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                                       : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                                 }`}
                              >
                                 Egreso directo (sin factura)
                              </button>
                           )}
                        </div>

                        {selectedTargetKind !== 'direct_expense' && (
                           <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
                              <div className="relative flex items-center">
                                 <BuscarIcon className="w-3.5 h-3.5 text-[#8E9BB5] absolute left-3 pointer-events-none" />
                                 <input
                                    type="text"
                                    value={modalQuery}
                                    onChange={(e) => {
                                       setModalQuery(e.target.value);
                                       setModalPage(1);
                                    }}
                                    placeholder={
                                       selectedTargetKind === 'bank_transaction'
                                          ? 'Buscar por descripción, banco o monto'
                                          : 'Busca por folio, RUT, contraparte o monto'
                                    }
                                    className="bg-white rounded-xl border border-[#E2EAFD] pl-8 pr-3.5 py-1.5 text-xs text-[#0A1A3F] placeholder-[#8E9BB5] w-64 md:w-80 focus:outline-none focus:border-[#1F6BFF]"
                                 />
                              </div>

                              {selectedTargetKind === 'document' && (
                                 <select
                                    value={modalTipo}
                                    onChange={(e) => {
                                       setModalTipo(e.target.value);
                                       setModalPage(1);
                                    }}
                                    className="bg-white rounded-xl border border-[#E2EAFD] px-3.5 py-1.5 text-xs font-semibold text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF] cursor-pointer"
                                 >
                                    {modalTypeOptions.map((opt) => (
                                       <option key={opt.value} value={opt.value}>
                                          {opt.label}
                                       </option>
                                    ))}
                                 </select>
                              )}
                           </div>
                        )}
                     </div>

                     {/* Content based on selectedTargetKind */}
                     {selectedTargetKind === 'direct_expense' ? (
                        <div className="bg-[#F8FAFF] rounded-2xl border border-[#E2EAFD] p-5 shadow-xs">
                           <div className="mb-4">
                              <h3 className="font-nunito font-bold text-sm text-[#0A1A3F]">
                                 Egreso Directo (Sin documento tributario SII)
                              </h3>
                              <p className="text-xs text-[#8E9BB5] mt-0.5">
                                 Registra y concilia de inmediato gastos comunes, remuneraciones, arriendos, impuestos o compras menores.
                              </p>
                           </div>

                           <div className="flex gap-2 mb-4">
                              {['GASTO', 'COSTO', 'IMPUESTO'].map((t) => (
                                 <button
                                    key={t}
                                    type="button"
                                    onClick={() => setExpenseType(t)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                       expenseType === t
                                          ? 'bg-[#1F6BFF] text-white shadow-xs'
                                          : 'bg-white border border-[#E2EAFD] text-[#55607A] hover:bg-[#EEF3FF]'
                                    }`}
                                 >
                                    {t}
                                 </button>
                              ))}
                           </div>

                           <form onSubmit={handleReconcileDirectExpense} className="space-y-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                    <label className="block text-xs font-semibold text-[#55607A] mb-1">
                                       Monto a Conciliar ($ CLP) *
                                    </label>
                                    <div className="relative">
                                       <span className="absolute left-3 top-2 text-xs text-[#8E9BB5]">$</span>
                                       <input
                                          type="number"
                                          value={expenseAmount}
                                          onChange={(e) => setExpenseAmount(e.target.value)}
                                          min="1"
                                          max={txRemaining || undefined}
                                          required
                                          className="w-full pl-7 pr-3 py-2 text-xs font-semibold rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                                          placeholder="0"
                                       />
                                    </div>
                                    <p className="text-[11px] text-[#8E9BB5] mt-1">
                                       Saldo disponible del movimiento: <span className="font-bold text-[#0A1A3F]">$ {txRemaining.toLocaleString('es-CL')}</span>
                                    </p>
                                 </div>

                                 <div>
                                    <label className="block text-xs font-semibold text-[#55607A] mb-1">
                                       Fecha del Movimiento Bancario
                                    </label>
                                    <input
                                       type="text"
                                       readOnly
                                       value={formatYmdToDmy(reconcileTx.fecha)}
                                       className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2EAFD] bg-[#EEF3FF]/50 text-[#55607A] cursor-not-allowed select-none"
                                    />
                                    <p className="text-[11px] text-[#8E9BB5] mt-1">
                                       Cuenta: <span className="font-semibold text-[#0A1A3F]">{reconcileTx.cuenta_corriente || '—'}</span>
                                    </p>
                                 </div>

                                 <div>
                                    <label className="block text-xs font-semibold text-[#55607A] mb-1">
                                       Proveedor / Beneficiario *
                                    </label>
                                    <input
                                       type="text"
                                       value={expenseCounterparty}
                                       onChange={(e) => setExpenseCounterparty(e.target.value)}
                                       required
                                       placeholder="Ej: Municipalidad de Providencia, Inmobiliaria SpA..."
                                       className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                                    />
                                 </div>

                                 <div>
                                    <label className="block text-xs font-semibold text-[#55607A] mb-1">
                                       RUT Beneficiario (Opcional)
                                    </label>
                                    <input
                                       type="text"
                                       value={expenseRut}
                                       onChange={(e) => setExpenseRut(e.target.value)}
                                       placeholder="Ej: 69.070.100-5"
                                       className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                                    />
                                 </div>

                                 <div className="md:col-span-2">
                                    <label className="block text-xs font-semibold text-[#55607A] mb-1">
                                       Glosa / Concepto del Egreso *
                                    </label>
                                    <input
                                       type="text"
                                       value={expenseConcept}
                                       onChange={(e) => setExpenseConcept(e.target.value)}
                                       required
                                       placeholder="Ej: Pago arriendo oficina local 101, Patente comercial..."
                                       className="w-full px-3 py-2 text-xs rounded-xl border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:border-[#1F6BFF]"
                                    />
                                 </div>

                                 <div className="md:col-span-2">
                                    <div className="flex items-center justify-between mb-1">
                                       <label className="block text-xs font-bold text-[#0A1A3F] uppercase tracking-wider">
                                          Clasificación Contable (Plan de Cuentas) *
                                       </label>
                                       <span className="text-[11px] text-[#8E9BB5]">
                                          Cuenta al Debe (Gasto/Costo)
                                       </span>
                                    </div>
                                    <AccountSelect
                                       accounts={availableAccounts}
                                       value={expenseAccountId}
                                       onChange={(val) => setExpenseAccountId(val)}
                                       placeholder="Buscar y seleccionar cuenta contable (ej: Arriendos, Remuneraciones...)"
                                       allowClear={true}
                                    />
                                 </div>
                              </div>

                              <div className="pt-3 border-t border-[#E2EAFD] flex items-center justify-end gap-3">
                                 <button
                                    type="button"
                                    onClick={() => setSelectedTargetKind('document')}
                                    className="px-4 py-2 text-xs font-bold text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#EEF3FF] rounded-full transition cursor-pointer"
                                 >
                                    Cancelar
                                 </button>
                                 <button
                                    type="submit"
                                    disabled={isSubmittingExpense || !expenseAccountId || !Number(expenseAmount)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold shadow-xs transition cursor-pointer"
                                 >
                                    {isSubmittingExpense ? (
                                       <>
                                          <span className="inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                          <span>Guardando y Conciliando...</span>
                                       </>
                                    ) : (
                                       <>
                                          <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                                          <span>Guardar y Conciliar Egreso</span>
                                       </>
                                    )}
                                 </button>
                              </div>
                           </form>
                        </div>
                     ) : (
                        <div className="bg-white rounded-2xl border border-[#E2EAFD] overflow-hidden shadow-xs">
                           <div className="overflow-x-auto">
                              <table className="w-full text-xs border-collapse">
                                 <thead>
                                    <tr className="bg-[#F4F7FE] border-b border-[#E2EAFD] text-[#55607A]">
                                       <th
                                          className="py-3 px-4 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#EEF3FF] select-none transition-colors"
                                          onClick={() => setModalSortConfig(s => ({ key: 'remaining_amount', dir: s.key === 'remaining_amount' ? (s.dir === 'none' ? 'desc' : (s.dir === 'desc' ? 'asc' : 'none')) : 'desc' }))}
                                          title="Ordenar por saldo"
                                       >
                                          Saldo por asignar {modalSortConfig.key === 'remaining_amount' ? (modalSortConfig.dir === 'asc' ? '↑' : modalSortConfig.dir === 'desc' ? '↓' : '') : ''}
                                       </th>
                                       <th
                                          className="py-3 px-4 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#EEF3FF] select-none transition-colors"
                                          onClick={() => setModalSortConfig(s => ({ key: 'total_amount', dir: s.key === 'total_amount' ? (s.dir === 'none' ? 'desc' : (s.dir === 'desc' ? 'asc' : 'none')) : 'desc' }))}
                                          title="Ordenar por monto"
                                       >
                                          Monto {modalSortConfig.key === 'total_amount' ? (modalSortConfig.dir === 'asc' ? '↑' : modalSortConfig.dir === 'desc' ? '↓' : '') : ''}
                                       </th>
                                       <th
                                          className="py-3 px-4 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#EEF3FF] select-none transition-colors"
                                          onClick={() => setModalSortConfig(s => ({ key: 'issue_date', dir: s.key === 'issue_date' ? (s.dir === 'none' ? 'desc' : (s.dir === 'desc' ? 'asc' : 'none')) : 'desc' }))}
                                          title="Ordenar por fecha"
                                       >
                                          Fecha {modalSortConfig.key === 'issue_date' ? (modalSortConfig.dir === 'asc' ? '↑' : modalSortConfig.dir === 'desc' ? '↓' : '') : ''}
                                       </th>
                                       <th
                                          className="py-3 px-4 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#EEF3FF] select-none transition-colors"
                                          onClick={() => setModalSortConfig(s => ({ key: 'type', dir: s.key === 'type' ? (s.dir === 'none' ? 'desc' : (s.dir === 'desc' ? 'asc' : 'none')) : 'desc' }))}
                                          title="Ordenar por tipo"
                                       >
                                          Tipo {modalSortConfig.key === 'type' ? (modalSortConfig.dir === 'asc' ? '↑' : modalSortConfig.dir === 'desc' ? '↓' : '') : ''}
                                       </th>
                                       <th
                                          className="py-3 px-4 text-left font-semibold whitespace-nowrap cursor-pointer hover:bg-[#EEF3FF] select-none transition-colors"
                                          onClick={() => setModalSortConfig(s => ({ key: 'description', dir: s.key === 'description' ? (s.dir === 'none' ? 'desc' : (s.dir === 'desc' ? 'asc' : 'none')) : 'desc' }))}
                                          title="Ordenar por descripción"
                                       >
                                          Descripción {modalSortConfig.key === 'description' ? (modalSortConfig.dir === 'asc' ? '↑' : modalSortConfig.dir === 'desc' ? '↓' : '') : ''}
                                       </th>
                                       <th className="py-3 px-4 text-right font-semibold whitespace-nowrap"></th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-[#E2EAFD]">
                                    {menuLoading ? (
                                       <tr>
                                          <td colSpan={6} className="py-8 text-center text-xs text-[#1F6BFF] font-medium animate-pulse">
                                             {selectedTargetKind === 'bank_transaction'
                                                ? 'Buscando movimientos...'
                                                : debouncedQuery.length >= 2
                                                ? 'Buscando documentos...'
                                                : 'Buscando sugerencias...'}
                                          </td>
                                       </tr>
                                    ) : (selectedTargetKind === 'bank_transaction' ? bankSearchError : documentSearchError) ? (
                                       <tr>
                                          <td colSpan={6} className="py-8 text-center text-xs text-red-500 font-medium">
                                             {selectedTargetKind === 'bank_transaction' ? bankSearchError : documentSearchError}
                                          </td>
                                       </tr>
                                    ) : modalFiltered.length === 0 ? (
                                       <tr>
                                          <td colSpan={6} className="py-8 text-center text-xs text-[#8E9BB5] font-medium">
                                             {selectedTargetKind === 'bank_transaction'
                                                ? 'No se encontraron movimientos pendientes para cruzar.'
                                                : debouncedQuery
                                                ? 'No se encontraron documentos pendientes para la búsqueda.'
                                                : 'No hay documentos pendientes sugeridos.'}
                                          </td>
                                       </tr>
                                    ) : (
                                       modalFiltered.map((d) => {
                                          const selected = isCandidateSelected(d);
                                          const isBank = (d.target_kind || selectedTargetKind) === 'bank_transaction';
                                          const pendingAmount = Math.max(0, Number(d.remaining_amount || 0));
                                          const totalAmount = Number(d.total_amount || d.monto || 0);
                                          const dateStr = d.issue_date || d.fecha || '—';
                                          const descStr = isBank
                                             ? `${d.cuenta_corriente || d.banco || ''} ${d.descripcion || ''}`.trim() || 'Movimiento bancario'
                                             : `${d.counterparty_name || d.description || '—'}${d.counterparty_rut || d.counterparty_tax_id || d.rut ? ` · ${d.counterparty_rut || d.counterparty_tax_id || d.rut}` : ''}`;

                                          return (
                                             <tr
                                                key={`${d.target_kind || selectedTargetKind}-${d.id}`}
                                                className={`transition-colors ${
                                                   selected ? 'bg-[#EEF3FF]/70' : 'hover:bg-[#F8FAFF]'
                                                }`}
                                             >
                                                <td className="py-3 px-4 font-bold text-[#0A1A3F] tabular-nums whitespace-nowrap">
                                                   $ {Math.abs(pendingAmount).toLocaleString('es-CL')}
                                                </td>
                                                <td className="py-3 px-4 font-medium text-[#55607A] tabular-nums whitespace-nowrap">
                                                   $ {Math.abs(totalAmount).toLocaleString('es-CL')}
                                                </td>
                                                <td className="py-3 px-4 text-[#55607A] whitespace-nowrap">
                                                   {dateStr}
                                                </td>
                                                <td className="py-3 px-4 whitespace-nowrap">
                                                   {isBank ? (
                                                      <span className="inline-flex items-center rounded-md overflow-hidden text-[10px] font-bold border border-[#E2EAFD] shadow-2xs">
                                                         <span className="px-2 h-5 flex items-center bg-[#5CB9A5] text-white">
                                                            {d.bank_type === 'expense' ? 'CARGO' : 'ABONO'}
                                                         </span>
                                                         <span className="px-2 h-5 flex items-center bg-white text-[#0A1A3F] font-semibold border-l border-[#E2EAFD]">
                                                            {d.documento || d.id}
                                                         </span>
                                                      </span>
                                                   ) : (
                                                      renderDocBadge(d.doc_type_code, d.folio || d.id)
                                                   )}
                                                </td>
                                                <td className="py-3 px-4">
                                                   <div className="truncate max-w-xs md:max-w-md text-xs font-medium text-[#55607A]" title={descStr}>
                                                      {descStr}
                                                   </div>
                                                </td>
                                                <td className="py-3 px-4 text-right whitespace-nowrap">
                                                   <button
                                                      type="button"
                                                      onClick={() => toggleCandidateSelection(d)}
                                                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold shadow-xs transition cursor-pointer ${
                                                         selected
                                                            ? 'bg-[#1F6BFF] hover:bg-[#1657D7] text-white'
                                                            : 'border border-[#C3D4FA] bg-white hover:bg-[#EEF3FF] text-[#0A1A3F]'
                                                      }`}
                                                   >
                                                      {selected ? (
                                                         <>
                                                            <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                                                            <span>Seleccionado</span>
                                                         </>
                                                      ) : (
                                                         <span>Seleccionar</span>
                                                      )}
                                                   </button>
                                                </td>
                                             </tr>
                                          );
                                       })
                                    )}
                                 </tbody>
                              </table>
                           </div>

                           {/* Paginación si aplica */}
                           {selectedTargetKind === 'document' && modalTotalPages > 1 && (
                              <div className="flex items-center justify-between px-4 py-3 bg-[#F8FAFF] border-t border-[#E2EAFD] text-xs text-[#55607A]">
                                 <div>Página {modalPage} de {modalTotalPages}</div>
                                 <div className="flex gap-2">
                                    <button
                                       type="button"
                                       className="px-3 py-1 rounded-lg border border-[#E2EAFD] bg-white hover:bg-[#EEF3FF] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                                       disabled={modalPage <= 1}
                                       onClick={() => setModalPage((p) => Math.max(1, p - 1))}
                                    >
                                       Anterior
                                    </button>
                                    <button
                                       type="button"
                                       className="px-3 py-1 rounded-lg border border-[#E2EAFD] bg-white hover:bg-[#EEF3FF] disabled:opacity-40 disabled:pointer-events-none transition cursor-pointer"
                                       disabled={modalPage >= modalTotalPages}
                                       onClick={() => setModalPage((p) => Math.min(modalTotalPages, p + 1))}
                                    >
                                       Siguiente
                                    </button>
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-4 bg-white border-t border-[#E2EAFD] flex items-center justify-between shrink-0">
                     <div>
                        {txRemainingAfter === 0 && assigned > 0 ? (
                           <div className="flex items-center gap-2 text-xs font-bold text-[#1F6BFF]">
                              <span className="w-2 h-2 rounded-full bg-[#1F6BFF]" />
                              <span>Todo cuadra: diferencia $ 0</span>
                           </div>
                        ) : assigned > 0 ? (
                           <div className="flex items-center gap-2 text-xs font-semibold text-[#55607A]">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              <span>Falta asignar $ {txRemainingAfter.toLocaleString('es-CL')}</span>
                           </div>
                        ) : (
                           <div className="flex items-center gap-2 text-xs font-medium text-[#8E9BB5]">
                              <span>Selecciona uno o más documentos para conciliar</span>
                           </div>
                        )}
                     </div>

                     <div className="flex items-center gap-3">
                        <button
                           type="button"
                           onClick={closeConciliarSmooth}
                           className="px-5 py-2 text-xs font-bold text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#EEF3FF] rounded-full transition cursor-pointer"
                        >
                           Cancelar
                        </button>
                        <button
                           type="button"
                           onClick={handleSave}
                           disabled={isSaving || !assigned || assigned <= 0}
                           className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold shadow-xs transition cursor-pointer"
                        >
                           <CheckIcon className="w-4 h-4 stroke-[2.5]" />
                           <span>{isSaving || saveState === 'saving' ? 'Conciliando...' : 'Confirmar conciliación'}</span>
                        </button>
                     </div>
                  </div>
               </div>

               {/* Detalle flotante (preservado) */}
               {showPayableDetail && (
                  <div className="fixed inset-0 z-[210]" onClick={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); setShowPayableDetail(false); } }}>
                     <div className="absolute inset-0 bg-black/5" />
                     <div className="fixed z-[211] w-[min(680px,92vw)] rounded-2xl bg-white text-[#0A1A3F] shadow-2xl border border-[#E2EAFD]" style={{ left: Math.max(12, detailAnchor.x - 12), top: detailAnchor.y + 8, transform: 'translateX(-100%)' }}>
                        <div className="px-5 py-4 border-b border-[#E2EAFD] flex items-center justify-between">
                           <h4 className="text-base font-bold text-[#0A1A3F]">Detalle</h4>
                           <button type="button" onClick={() => setShowPayableDetail(false)} className="h-7 w-7 rounded-full border border-[#E2EAFD] hover:bg-[#EEF3FF] text-[#55607A] flex items-center justify-center">×</button>
                        </div>
                        <div className="px-5 pt-4 pb-4 overflow-x-auto">
                           <table className="w-full min-w-[520px] text-xs">
                              <thead><tr className="text-[#55607A] border-b border-[#E2EAFD]"><th className="text-left py-2">Tipo</th><th className="text-left py-2">Fecha</th><th className="text-left py-2">Descripción</th><th className="text-right py-2">Monto</th></tr></thead>
                              <tbody className="divide-y divide-[#E2EAFD]">
                                 <tr>
                                    <td className="py-2.5 font-medium">Doc original</td>
                                    <td className="py-2.5">{selectedDoc?.issue_date || "—"}</td>
                                    <td className="py-2.5">{selectedDoc?.counterparty_name || "—"}</td>
                                    <td className="py-2.5 text-right font-bold text-[#0A1A3F] tabular-nums">$ {Math.abs(Number(payableBreakdown.total || 0)).toLocaleString('es-CL')}</td>
                                 </tr>
                                 <tr>
                                    <td className="py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF3FF] text-[#1F6BFF]">Asignado</span></td>
                                    <td className="py-2.5">{formatYmdToDmy(reconcileTx?.fecha)}</td>
                                    <td className="py-2.5 text-[#55607A]">Monto asignado ahora</td>
                                    <td className="py-2.5 text-right font-bold text-[#1F6BFF] tabular-nums">-$ {Math.abs(Number(payableBreakdown.nowAssigned || 0)).toLocaleString('es-CL')}</td>
                                 </tr>
                              </tbody>
                              <tfoot><tr><td className="pt-3 text-[#55607A] font-semibold" colSpan={3}>Saldo por pagar</td><td className="pt-3 text-right font-bold text-[#0A1A3F] tabular-nums">$ {Math.abs(Number(payableBreakdown.remaining || 0)).toLocaleString('es-CL')}</td></tr></tfoot>
                           </table>
                        </div>
                     </div>
                  </div>
               )}
            </div>
         )}

         {/* ===== modal subir excel ===== */}
         {showUploadModal && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center" onClick={(e) => { if (e.target === e.currentTarget) closeUploadModal(); }}>
               <div className="absolute inset-0 bg-black/40" />
               <div className="relative w-[min(980px,96vw)] max-h-[85vh] rounded-xl bg-[var(--bg-content)] text-[var(--text-main)] shadow-2xl border border-[var(--border-subtle)] flex flex-col">
                  <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                     <h3 className="text-lg font-semibold text-[var(--heading)]">Subir Excel</h3>
                     <button className="h-8 w-8 rounded-full border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--surface-1)]" onClick={closeUploadModal} disabled={isUploading}>×</button>
                  </div>
                  <div className="px-5 pt-4 pb-2 overflow-y-auto grow">
                     {!uploadResult ? (
                        <>
                           <div className="mb-3 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                 <div className="text-xs text-[var(--text-soft)] space-y-1">
                                    <div className={!uploadSplitDebitCredit ? 'font-medium text-[var(--heading)]' : ''}>
                                       Formato normal: {STANDARD_TEMPLATE_HEADERS.join(', ')}.
                                    </div>
                                    <div className={uploadSplitDebitCredit ? 'font-medium text-[var(--heading)]' : ''}>
                                       Con abonos y cargos separados: {SPLIT_DEBIT_CREDIT_TEMPLATE_HEADERS.join(', ')}.
                                    </div>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={handleDownloadTemplate}
                                    disabled={isUploading || isDownloadingTemplate}
                                    className="px-3 py-1.5 rounded-md text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60"
                                 >
                                    {isDownloadingTemplate ? 'Descargando...' : 'Descargar plantilla'}
                                 </button>
                              </div>
                              <div className="text-xs text-[var(--text-soft)]">
                                 {selectedUploadAccountId
                                    ? 'Se preselecciono la cuenta del filtro actual'
                                    : 'Selecciona una cuenta bancaria de la entidad'}
                              </div>
                              {!loadingAccounts && cuentasDisponibles.length === 0 && (
                                 <div className="text-xs text-amber-700">
                                    No hay cuentas creadas para esta entidad. Ve a Banco &gt; Cuentas bancarias para registrarlas.
                                 </div>
                              )}
                              <div className="flex flex-col gap-1">
                                 <div className="flex items-center justify-between">
                                    <label htmlFor="upload-account-id" className="text-xs text-[var(--text-soft)]">Cuenta bancaria destino</label>
                                    {uploadFile && !(Number(uploadAccountId) > 0 || !!selectedUploadAccountId) && (
                                       <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">* Selecciona una cuenta para habilitar la subida</span>
                                    )}
                                 </div>
                                 <select
                                    id="upload-account-id"
                                    className={`border bg-[var(--surface-1)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm transition ${uploadFile && !(Number(uploadAccountId) > 0 || !!selectedUploadAccountId) ? "border-amber-500 ring-1 ring-amber-500/20" : "border-[var(--border-subtle)]"}`}
                                    value={uploadAccountId}
                                    onChange={(e) => setUploadAccountId(e.target.value)}
                                    disabled={isUploading}
                                 >
                                    <option value="">Seleccionar cuenta...</option>
                                    {loadingAccounts && <option value="" disabled>Cargando cuentas...</option>}
                                    {!loadingAccounts && cuentasDisponibles.length === 0 && <option value="" disabled>Sin cuentas registradas</option>}
                                    {cuentasDisponibles.map((c) => (
                                       <option key={c.id} value={c.id}>{c.label}</option>
                                    ))}
                                 </select>
                              </div>
                              <label className="flex items-start gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-main)]">
                                 <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={uploadSplitDebitCredit}
                                    onChange={(e) => {
                                       setUploadSplitDebitCredit(e.target.checked);
                                       setUploadFile(null);
                                       setUploadErr('');
                                    }}
                                    disabled={isUploading}
                                 />
                                 <span>
                                    La planilla incluye abonos y cargos por separado
                                    <span className="block text-[var(--text-soft)]">Marca esta opcion si el Excel trae columnas Abonos y Cargos en vez de una sola columna Monto.</span>
                                 </span>
                              </label>
                           </div>
                           <label className="block border-2 border-dashed border-[var(--border-subtle)] rounded-lg p-6 text-center cursor-pointer hover:bg-[var(--surface-1)]">
                              {uploadFile ? (
                                 <div className="text-sm">
                                    <div className="font-medium mb-1 text-[var(--heading)]">Archivo seleccionado:</div>
                                    <div className="truncate text-[var(--text-main)]">{uploadFile.name}</div>
                                    <button
                                       type="button"
                                       className="mt-2 text-[12px] underline text-blue-600"
                                       onClick={(e) => {
                                          e.preventDefault();
                                          setUploadFile(null);
                                          setParsedWorkbookInfo(null);
                                          setDuplicateGroups([]);
                                          setUploadErr('');
                                       }}
                                       disabled={isUploading}
                                    >
                                       Quitar
                                    </button>
                                 </div>
                              ) : (
                                 <div className="text-sm text-[var(--text-soft)]">Arrastra tu Excel aqui o haz clic para buscar</div>
                              )}
                              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] || null)} disabled={isUploading} />
                           </label>
                           {uploadErr && <div className="mt-3 text-[13px] text-red-500">{uploadErr}</div>}

                           {/* Alerta interactiva de movimientos duplicados encontrados en el Excel */}
                           {duplicateGroups.length > 0 && (
                              <BankCartolaDuplicatesAlert
                                 duplicateGroups={duplicateGroups}
                                 onUpdateGroupSelection={handleUpdateGroupSelection}
                                 onOmitAllDuplicates={handleOmitAllDuplicates}
                                 onKeepAllDuplicates={handleKeepAllDuplicates}
                                 totalDataRows={parsedWorkbookInfo?.totalDataRows || 0}
                                 totalOmittedCount={totalOmittedCount}
                              />
                           )}
                        </>
                     ) : (
                        <div className="text-sm text-[var(--text-main)] space-y-4">
                           {/* Resumen de procesamiento - Estilo neutro y solido */}
                           <div className="grid grid-cols-3 gap-3">
                              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-center">
                                 <div className="text-xs font-medium text-[var(--text-soft)]">Filas leídas</div>
                                 <div className="mt-1 text-2xl font-semibold text-[var(--heading)]">
                                    {uploadResult.total_rows ?? 0}
                                 </div>
                              </div>
                              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-center">
                                 <div className="text-xs font-medium text-[var(--text-soft)]">Nuevos guardados</div>
                                 <div className="mt-1 text-2xl font-semibold text-[var(--heading)]">
                                    {uploadResult.saved_rows ?? uploadResult.valid_rows ?? 0}
                                 </div>
                              </div>
                              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3 text-center">
                                 <div className="text-xs font-medium text-[var(--text-soft)]">Omitidos</div>
                                 <div className="mt-1 text-2xl font-semibold text-[var(--heading)]">
                                    {uploadResult.skipped_rows ?? 0}
                                 </div>
                              </div>
                           </div>

                           {/* Banner informativo de proteccion de conciliaciones cuando hay omitidos */}
                           {Number(uploadResult.skipped_rows) > 0 && (
                              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] p-3.5 space-y-3">
                                 <div className="flex items-start gap-2.5">
                                    <svg className="w-4 h-4 text-[var(--text-soft)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                       <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <div className="text-xs leading-relaxed">
                                       <div className="font-semibold text-[var(--heading)]">
                                          Protección contra duplicados activa
                                       </div>
                                       <div className="mt-0.5 text-[var(--text-soft)]">
                                          Estos movimientos no se crearon nuevamente para proteger tus conciliaciones de registros dobles.
                                       </div>
                                    </div>
                                 </div>

                                 {uploadResult.skipped_details?.length > 0 && (
                                    <div className="pt-2 border-t border-[var(--border-subtle)]">
                                       <button
                                          type="button"
                                          onClick={() => setShowSkippedDetails((prev) => !prev)}
                                          className="text-xs font-medium text-[var(--text-main)] hover:text-[var(--heading)] flex items-center gap-1.5 cursor-pointer"
                                       >
                                          <span>{showSkippedDetails ? '▲ Ocultar' : '▼ Ver'} detalle de omitidos ({uploadResult.skipped_details.length})</span>
                                       </button>

                                       {showSkippedDetails && (
                                          <div className="mt-2.5 h-44 max-h-44 overflow-y-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-content)]">
                                             <table className="w-full text-xs text-left">
                                                <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--heading)] font-medium">
                                                   <tr>
                                                      <th className="p-2 border-b border-[var(--border-subtle)]">Fila</th>
                                                      <th className="p-2 border-b border-[var(--border-subtle)]">Fecha</th>
                                                      <th className="p-2 border-b border-[var(--border-subtle)]">Monto</th>
                                                      <th className="p-2 border-b border-[var(--border-subtle)]">Descripción</th>
                                                      <th className="p-2 border-b border-[var(--border-subtle)]">Motivo</th>
                                                   </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-main)]">
                                                   {uploadResult.skipped_details.map((item, idx) => (
                                                      <tr key={idx} className="hover:bg-[var(--surface-1)]">
                                                         <td className="p-2 font-mono text-[var(--text-soft)]">#{item.rowNumber || idx + 1}</td>
                                                         <td className="p-2 whitespace-nowrap">{item.date || '-'}</td>
                                                         <td className="p-2 font-medium whitespace-nowrap">{fmtCLP(item.amount)}</td>
                                                         <td className="p-2 max-w-[200px] truncate" title={item.description || ''}>
                                                            {item.description || '-'}
                                                         </td>
                                                         <td className="p-2 text-[var(--text-soft)] whitespace-nowrap">
                                                            {item.enrichedExisting ? 'Ya existía (datos actualizados)' : (item.skippedReason || 'Ya registrado en la cuenta')}
                                                         </td>
                                                      </tr>
                                                   ))}
                                                </tbody>
                                             </table>
                                          </div>
                                       )}
                                    </div>
                                 )}
                              </div>
                           )}

                           {/* Previsualización de movimientos válidos guardados */}
                           {uploadResult.preview_valid?.length > 0 && (
                              <div>
                                 <div className="text-xs font-semibold text-[var(--heading)] mb-1.5">
                                    Movimientos registrados recientemente ({uploadResult.preview_valid.length}):
                                 </div>
                                 <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden max-h-44 overflow-y-auto">
                                    <table className="w-full text-xs text-left">
                                       <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--heading)]">
                                          <tr>
                                             <th className="p-2 border-b border-[var(--border-subtle)]">Fecha</th>
                                             <th className="p-2 border-b border-[var(--border-subtle)]">Monto</th>
                                             <th className="p-2 border-b border-[var(--border-subtle)]">Detalle</th>
                                          </tr>
                                       </thead>
                                       <tbody className="divide-y divide-[var(--border-subtle)]">
                                          {uploadResult.preview_valid.slice(0, 5).map((r, i) => (
                                             <tr key={i} className="border-t hover:bg-[var(--surface-1)]">
                                                <td className="p-2 whitespace-nowrap">{r.movementDate}</td>
                                                <td className="p-2 font-medium whitespace-nowrap">{fmtCLP(r.amount)}</td>
                                                <td className="p-2 truncate max-w-[240px]" title={r.detail}>{r.detail}</td>
                                             </tr>
                                          ))}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                  <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0">
                     {!uploadResult ? (
                        <>
                           <button type="button" className="px-4 py-2 rounded-md border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--surface-1)]" onClick={closeUploadModal} disabled={isUploading}>Cancelar</button>
                           <button
                              type="button"
                              onClick={() => {
                                 if (!(Number(uploadAccountId) > 0 || !!selectedUploadAccountId)) {
                                    toast.error("Por favor, selecciona una cuenta bancaria destino en la lista superior.");
                                    const el = document.getElementById("upload-account-id");
                                    if (el) {
                                       el.scrollIntoView({ behavior: "smooth", block: "center" });
                                       el.focus();
                                    }
                                    return;
                                 }
                                 handleUploadExcel();
                              }}
                              disabled={!uploadFile || isUploading}
                              className={`px-4 py-2 rounded-md text-white font-medium transition ${
                                 !uploadFile
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : !(Number(uploadAccountId) > 0 || !!selectedUploadAccountId)
                                       ? "bg-amber-600 hover:bg-amber-700 cursor-pointer"
                                       : "bg-teal-600 hover:bg-teal-700 cursor-pointer"
                              }`}
                           >
                              {isUploading
                                 ? "Subiendo..."
                                 : !(Number(uploadAccountId) > 0 || !!selectedUploadAccountId)
                                    ? "Selecciona una cuenta"
                                    : totalOmittedCount > 0
                                       ? `Subir (${(parsedWorkbookInfo?.totalDataRows || 0) - totalOmittedCount} movimientos)`
                                       : "Subir"}
                           </button>
                        </>
                     ) : (
                        <button type="button" className="px-4 py-2 rounded-md bg-teal-600 text-white" onClick={closeUploadModal}>Cerrar y ver resultados</button>
                     )}
                  </div>
               </div>
            </div>
         )}

         <EmissoSyncPeriodModal
            isOpen={showSyncPeriodModal}
            onClose={() => setShowSyncPeriodModal(false)}
            entityId={entityId}
            account={currentSelectedAccount}
            syncQuota={emissoSyncQuota}
            onQuotaUpdate={updateCachedEmissoQuota}
            onSyncCompleted={async (resp) => {
               if (resp?.emisso_sync_quota) {
                  updateCachedEmissoQuota(resp.emisso_sync_quota);
               }
               await queryClient.invalidateQueries({ queryKey: ['bankAccounts', entityId] });
               await queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
               await queryClient.invalidateQueries({ queryKey: ['bankTotals'] });
               await queryClient.invalidateQueries({ queryKey: ['sugerenciasCount'] });
            }}
         />

         {reconciliationDetailTxId != null && (
            <div
               className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center"
               onClick={() => setReconciliationDetailTxId(null)}
            >
               <div
                  className="w-[95vw] max-w-3xl max-h-[85vh] overflow-hidden bg-[var(--bg-content)] rounded-2xl shadow-2xl flex flex-col opacity-0 translate-y-2 animate-[fadeInUp_.2s_ease-out_forwards]"
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between shrink-0">
                     <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0 w-9 h-9 rounded-lg bg-[var(--brand-soft-bg,rgba(0,0,0,.06))] flex items-center justify-center text-[var(--brand)]">
                           <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
                        </div>
                        <div className="min-w-0">
                           <div className="text-lg font-semibold text-[var(--heading)] truncate">Detalle de conciliación</div>
                           <div className="text-xs text-[var(--text-soft)]">Movimiento bancario #{reconciliationDetailTxId}</div>
                        </div>
                     </div>
                     <button
                        type="button"
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-soft)] hover:bg-[var(--surface-1)] hover:text-[var(--text-main)] transition-colors"
                        onClick={() => setReconciliationDetailTxId(null)}
                        aria-label="Cerrar"
                     >
                        ✕
                     </button>
                  </div>

                  <div className="p-5 overflow-auto">
                     {loadingReconciliationDetail ? (
                        <div className="space-y-2">
                           {[0, 1, 2].map((i) => (
                              <div key={i} className="h-11 rounded-lg bg-[var(--surface-1)] animate-pulse" />
                           ))}
                        </div>
                     ) : reconciliationDetailRows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center py-12 text-[var(--text-soft)]">
                           <div className="w-12 h-12 mb-3 rounded-full bg-[var(--surface-1)] flex items-center justify-center text-xl">🔍</div>
                           <div className="text-sm">No se encontraron aplicaciones para este movimiento.</div>
                        </div>
                     ) : (
                        <>
                           {(() => {
                              const totalApplied = reconciliationDetailRows.reduce((sum, row) => sum + Number(row.amount_applied || 0), 0);
                              const totalAmount = Number(reconciliationDetailTxAmount || 0);
                              const pending = Math.max(0, totalAmount - totalApplied);
                              const isComplete = pending <= 0.01;

                              return (
                                 <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3">
                                       <div className="text-xs text-[var(--text-soft)] mb-1">Monto del movimiento</div>
                                       <div className="text-lg font-semibold text-[var(--heading)]">{fmtCLP(totalAmount)}</div>
                                    </div>
                                    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3">
                                       <div className="text-xs text-[var(--text-soft)] mb-1">Total aplicado</div>
                                       <div className="text-lg font-semibold text-[var(--heading)]">{fmtCLP(totalApplied)}</div>
                                    </div>
                                    <div
                                       className="rounded-xl border px-4 py-3"
                                       style={{
                                          borderColor: isComplete ? 'var(--success)' : 'var(--warning)',
                                          background: isComplete ? 'var(--success-bg)' : 'var(--warning-bg)',
                                       }}
                                    >
                                       <div className="text-xs mb-1" style={{ color: isComplete ? 'var(--success)' : 'var(--warning)' }}>
                                          Saldo por conciliar
                                       </div>
                                       <div className="text-lg font-bold" style={{ color: isComplete ? 'var(--success)' : 'var(--warning)' }}>
                                          {isComplete ? '✓ Conciliado' : fmtCLP(pending)}
                                       </div>
                                    </div>
                                 </div>
                              );
                           })()}

                           <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)]">
                              <table className="min-w-full text-sm">
                                 <thead className="bg-[var(--surface-2)] text-[var(--heading)]">
                                    <tr>
                                       <th className="text-left p-3 font-medium">Documento</th>
                                       <th className="text-left p-3 font-medium">Fecha doc.</th>
                                       <th className="text-left p-3 font-medium">RUT</th>
                                       <th className="text-right p-3 font-medium">Monto doc.</th>
                                       <th className="text-right p-3 font-medium">Aplicado</th>
                                       <th className="text-right p-3 font-medium">Acciones</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-[var(--border-subtle)]">
                                    {reconciliationDetailRows.map((row) => {
                                       const isBankMatch = row.kind === 'bank_transaction';
                                       const tag = isBankMatch ? null : docTag(row.doc_type_code);

                                       return (
                                          <tr key={`${row.kind || 'document'}-${row.id}`} className="hover:bg-[var(--surface-1)] transition-colors">
                                             <td className="p-3">
                                                {isBankMatch ? (
                                                   <span className="inline-flex items-center rounded-md overflow-hidden text-[10px] font-semibold">
                                                      <span className="px-2 h-5 flex items-center bg-[var(--brand)] text-white">
                                                         {row.target_bank_type === 'expense' ? 'Cargo' : 'Abono'}
                                                      </span>
                                                      <span className="px-2 h-5 flex items-center bg-[var(--bg-content)] text-[var(--text-soft)] border border-l-0 border-[var(--border-subtle)]">
                                                         {row.folio || `MOV-${row.target_bank_transaction_id}`}
                                                      </span>
                                                   </span>
                                                ) : (
                                                   <span className="inline-flex items-center rounded-md overflow-hidden text-[10px] font-semibold">
                                                      <span className="px-2 h-5 flex items-center" style={{ background: tag.color, color: '#fff' }}>
                                                         {tag.abbr}
                                                      </span>
                                                      <span className="px-2 h-5 flex items-center bg-[var(--bg-content)] text-[var(--text-soft)] border border-l-0 border-[var(--border-subtle)]">
                                                         {row.folio || row.document_id}
                                                      </span>
                                                   </span>
                                                )}
                                             </td>
                                             <td className="p-3 text-[var(--text-main)]">{row.issue_date || '-'}</td>
                                             <td className="p-3 text-[var(--text-main)]">{isBankMatch ? (row.bank_description || '-') : (row.counterparty_rut || '-')}</td>
                                             <td className="p-3 text-right text-[var(--text-main)]">{fmtCLP(row.doc_amount || 0)}</td>
                                             <td className="p-3 text-right font-semibold text-[var(--heading)]">{fmtCLP(row.amount_applied || 0)}</td>
                                             <td className="p-3 text-right">
                                                {canUnreconcile && (
                                                   <button
                                                      type="button"
                                                      className="px-2.5 py-1 rounded-md text-xs font-medium border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white transition-colors disabled:opacity-50"
                                                      onClick={() => handleUndoReconciliation(row)}
                                                      disabled={undoingReconciliationId === row.id}
                                                   >
                                                      {undoingReconciliationId === row.id ? "..." : "Deshacer"}
                                                   </button>
                                                )}
                                             </td>
                                          </tr>
                                       );
                                    })}
                                 </tbody>
                              </table>
                           </div>
                        </>
                     )}
                  </div>
               </div>
            </div>
         )}

         <BatchBoletearConfirmModal
            isOpen={batchBoletearModalOpen}
            onClose={() => setBatchBoletearModalOpen(false)}
            selectedTransactions={selectedBoleteoTransactions}
            entityId={entityId}
            onSuccess={() => {
               setSelectedBoleteoIds(new Set());
               queryClient.invalidateQueries({ queryKey: ['activeBoletaMap'] });
               queryClient.invalidateQueries({ queryKey: ['bankTransactions'] });
            }}
         />
      </div>
   );
}
