import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { useAuth } from '../../context/AuthContext';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from 'components/EntityRequiredNotice';
import ReconcileSuggestionsPanel from 'components/ReconcileSuggestionsPanel';
import DateInput from 'components/DateInput'
import { fetchSuggestionsCount, autofindCandidates, reconcileOne, reconcileBankTransaction, searchBankReconcileCandidates, reconcileBulk, listReconciliations, unreconcile, deleteBankTransaction } from '../../services/reconcileApi';
import { uploadBankExcel, listBankAccounts } from '../../services/entitiesApi';
import { toast } from 'components/Toaster';
import PrimaryButton from 'components/PrimaryButton';
import { getRutFromRow } from '../../utils/validators';
import { normalizeAmount, fmtCLP, hexToRgba, toYmd } from '../../utils/formatters';
import { SII_DOCUMENT_TYPES, docTag, getSiiDocumentTypeLabel } from '../../utils/siiConstants';
import { listDailySalesGroups, listSiiDocuments } from '../../services/siiDocumentsApi';

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
   for (let i = 0; i < topRows.length; i += 1) {
      const row = topRows[i] || [];
      const headerSet = new Set(row.map(normalizeHeaderKey).filter(Boolean));
      const detected = detectMovementsHeader(headerSet, { splitDebitCredit });
      if (detected.ok) {
         return { ok: true, mode: detected.mode, headerRow: i + 1 };
      }
   }

   const likely = pickLikelyHeaderRow(topRows);
   const fallback = detectMovementsHeader(likely?.headerSet || new Set(), { splitDebitCredit });
   return {
      ...fallback,
      detectedColumns: likely?.visible || [],
      headerRow: Number.isInteger(likely?.index) ? likely.index + 1 : null
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
         onClick={onClick}
         className={`px-3 py-2 rounded-lg flex items-center gap-2 ${active ? "bg-[var(--surface-2)] text-[var(--heading)]" :
            "text-[var(--text-main)] hover:bg-[var(--surface-1)]"
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

export default function BankCartolasPage() {
   const queryClient = useQueryClient();
   const { auth, isClient } = useAuth();
   const { entityId, ready, permissions } = useEntityRequired();
   const canDelete = permissions?.can_delete ?? true;
   // agregar movimientos, conciliar y deshacer conciliaciones quedan reservados al administrador;
   // el cliente solo puede ver el detalle y eliminar movimientos propios sin conciliar
   const canCreate = (permissions?.can_create ?? true) && !isClient;

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
   const [reconciliationDetailTxId, setReconciliationDetailTxId] = useState(null);
   const [reconciliationDetailTxAmount, setReconciliationDetailTxAmount] = useState(0);
   const [undoingReconciliationId, setUndoingReconciliationId] = useState(null);
   const [deletingTxId, setDeletingTxId] = useState(null);

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

   // 2. totales para los badges
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
         cap: SUGGESTIONS_BADGE_CAP
      }],
      queryFn: ({ signal }) => fetchSuggestionsCount({
         entityId,
         accountId: reconcileSuggestionAccountId || undefined,
         type: reconcileSuggestionType || undefined,
         dateFrom: toYmd(applied.fechaIni) || undefined,
         dateTo: toYmd(applied.fechaFin) || undefined,
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

   const openUploadModal = () => {
      setUploadFile(null);
      setUploadErr('');
      setUploadResult(null);
      setUploadSplitDebitCredit(false);
      setUploadAccountId(selectedUploadAccountId ? String(selectedUploadAccountId) : '');
      setShowUploadModal(true);
   };

   const closeUploadModal = () => {
      if (isUploading) return;
      setShowUploadModal(false);
   };

   const onPickFile = async (f) => {
      setUploadErr('');
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
         const resp = await uploadBankExcel({
            entityId,
            accountId: resolvedAccountId,
            file: uploadFile,
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
   const [isTyping, setIsTyping] = React.useState(false);
   const typingTimer = React.useRef(null);

   const [isSaving, setIsSaving] = React.useState(false);
   const [saveState, setSaveState] = React.useState('idle');

   const txRemaining = Math.max(0, Number(reconcileTx?.raw?.remaining_amount ?? Math.abs(Number(reconcileTx?.monto || 0))));
   const reconcileDocumentSide = Number(reconcileTx?.monto || 0) < 0 ? 'expense' : 'income';
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
      if (selectedTargetKind !== 'document' || selectedDocIds.length === 0) return [];
      const byId = new Map(documentCandidates.map((item) => [Number(item.id), item]));
      return selectedDocIds.map((id) => byId.get(Number(id))).filter(Boolean);
   }, [documentCandidates, selectedDocIds, selectedTargetKind]);
   const selectedDocumentsPending = useMemo(() => (
      selectedDocuments.reduce((sum, item) => sum + Math.max(0, Number(item.remaining_amount || 0)), 0)
   ), [selectedDocuments]);
   const hasMultipleSelectedDocuments = selectedTargetKind === 'document' && selectedDocuments.length > 1;

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
      if (selectedTargetKind !== 'document' || selectedDocuments.length === 0) return allocation;

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
      setModalSortDate('none');
      setSearchCandidates([]);
      setDocumentSearchError('');
      setBankCandidates([]);
      setBankSearchError('');
      setDailySalesGroups([]);
      setDailySalesError('');
      setSavingDailyGroupKey('');
      setReconcileTx(row);
      setMenuDelay(true);
      setTimeout(() => setMenuDelay(false), 600);
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
      const hasDocumentSelection = selectedTargetKind === 'document' && selectedDocuments.length > 0;
      const hasSingleSelection = selectedTargetKind !== 'document' && selectedDocId;
      if (!reconcileTx || (!hasDocumentSelection && !hasSingleSelection)) return;
      try {
         setLoadingAuto(true);
         const bankTxId = reconcileTx.raw?.id ?? (typeof reconcileTx._id === 'string' && reconcileTx._id.startsWith('tx-') ? Number(reconcileTx._id.replace('tx-', '')) : reconcileTx._id);
         const amountToApply = Math.max(0, Number(assigned || 0));
         if (!(amountToApply > 0)) throw new Error('Ingresa un monto valido a asignar');

         if (selectedTargetKind === 'bank_transaction') {
            await reconcileBankTransaction({
               entityId,
               bank_transaction_id: bankTxId,
               target_bank_transaction_id: Number(selectedDocId),
               amount: amountToApply,
            });
         } else if (selectedDocuments.length > 1) {
            let remainingToApply = amountToApply;
            const pairs = selectedDocuments
               .map((doc) => {
                  const docPending = Math.max(0, Number(doc.remaining_amount || 0));
                  const amount = Math.min(docPending, remainingToApply);
                  remainingToApply -= amount;
                  return {
                     bank_transaction_id: bankTxId,
                     document_id: Number(doc.id),
                     amount,
                  };
               })
               .filter((pair) => pair.document_id && pair.amount > 0);

            if (!pairs.length) throw new Error('No hay monto disponible para aplicar a los documentos seleccionados');

            await reconcileBulk({
               entityId,
               pairs,
               method: 'manual-multi',
            });
         } else {
            await reconcileOne({
               entityId,
               bank_transaction_id: bankTxId,
               document_id: Number(selectedDocuments[0]?.id || selectedDocId),
               amount: amountToApply,
            });
         }

         const picked = targetCandidates.find(d => Number(d.id) === Number(selectedDocId));
         toast.success(selectedDocuments.length > 1
            ? `${selectedDocuments.length} documentos aplicados correctamente`
            : picked
               ? `${selectedTargetKind === 'bank_transaction' ? 'Movimiento' : 'Folio'} ${picked.folio ?? picked.id} aplicado correctamente`
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
      const hasSelection = selectedTargetKind === 'document' ? selectedDocuments.length > 0 : Boolean(selectedDocId);
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
      setApplied({ tipo, fechaIni, fechaFin, montoFiltro, ctaCorriente, descripcion, cuenta, nroDocumento });
      setPage(0);
      setMostrarFiltros(true);
   };

   const resetAll = useCallback(() => {
      setTab('todos');
      setMostrarFiltros(true);
      setTipo("Todos"); setFechaIni(""); setFechaFin(""); setMontoFiltro(""); setCtaCorriente(""); setDescripcion(""); setCuenta(""); setNroDocumento("");
      setApplied(DEFAULT_FILTERS);
      setSoloPorConciliar(false);
      setPage(0);
   }, []);

   const switchTabWithReset = React.useCallback((nextTab) => {
      setTab(nextTab);
      if (nextTab === 'abonos' || nextTab === 'cargos') setSoloPorConciliar(true);
      else setSoloPorConciliar(false);

      setTipo("Todos"); setFechaIni(""); setFechaFin(""); setMontoFiltro(""); setCtaCorriente(""); setDescripcion(""); setCuenta(""); setNroDocumento("");
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
   const [modalSortDate, setModalSortDate] = useState('none');
   const [debouncedQuery, setDebouncedQuery] = useState('');
   useEffect(() => {
      const t = setTimeout(() => setDebouncedQuery(modalQuery.trim().toLowerCase()), 250);
      return () => clearTimeout(t);
   }, [modalQuery]);

   useEffect(() => {
      if (selectedTargetKind !== 'document' || !reconcileTx || !entityId || debouncedQuery.length < 2) {
         setSearchCandidates([]);
         setDocumentSearchError('');
         setLoadingDocumentSearch(false);
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
               page: 1,
               limit: 50,
               sort: 'issue_date',
               order: 'desc',
               signal: controller.signal,
            });

            setSearchCandidates(out.rows || []);
         } catch (err) {
            if (err?.name !== 'AbortError') {
               setDocumentSearchError(err.message || 'No se pudieron buscar documentos');
               setSearchCandidates([]);
            }
         } finally {
            setLoadingDocumentSearch(false);
         }
      })();

      return () => controller.abort();
   }, [debouncedQuery, entityId, modalTipo, reconcileDocumentSide, reconcileTx, selectedTargetKind]);

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
         rows = rows.filter(d => {
            const text = `${d.folio ?? ''} ${d.counterparty_rut ?? ''} ${d.counterparty_name ?? ''} ${d.description ?? ''} ${d.account_label ?? ''} ${d.issue_date ?? ''}`.toLowerCase();
            const matchesText = text.includes(debouncedQuery);
            const matchesMonto = !Number.isNaN(Number(debouncedQuery)) && (String(Math.round(Number(d.total_amount || 0))).includes(debouncedQuery) || String(Math.round(Number(d.remaining_amount || 0))).includes(debouncedQuery));
            return matchesText || matchesMonto;
         });
      }

      if (modalSortDate === 'asc') {
         rows.sort((a, b) => {
            const da = a.issue_date ? new Date(a.issue_date).getTime() : 0;
            const db = b.issue_date ? new Date(b.issue_date).getTime() : 0;
            return da - db;
         });
      } else if (modalSortDate === 'desc') {
         rows.sort((a, b) => {
            const da = a.issue_date ? new Date(a.issue_date).getTime() : 0;
            const db = b.issue_date ? new Date(b.issue_date).getTime() : 0;
            return db - da;
         });
      }

      return rows;
   }, [debouncedQuery, modalTipo, selectedTargetKind, targetCandidates, modalSortDate]);

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
      const kind = candidate?.target_kind || selectedTargetKind;
      if (kind === 'bank_transaction') return Number(selectedDocId) === Number(candidate?.id);
      return selectedDocIds.some((id) => Number(id) === Number(candidate?.id));
   }, [selectedDocId, selectedDocIds, selectedTargetKind]);

   const toggleCandidateSelection = useCallback((candidate) => {
      if (!candidate?.id) return;
      const kind = candidate.target_kind || selectedTargetKind;

      if (kind === 'bank_transaction') {
         setSelectedTargetKind('bank_transaction');
         setSelectedDocIds([]);
         setSelectedDocId(Number(candidate.id));
         return;
      }

      setSelectedTargetKind('document');
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
      <div className="animate-fade-in">
         {/* PANEL: Buscar movimientos */}
         <div
            id={FILTER_PANEL_ID}
            role="region"
            aria-labelledby={FILTER_HEADING_ID}
            aria-hidden={!mostrarFiltros}
            className={[
               "relative bg-[var(--bg-content)] shadow-sm transition-all duration-300 ease-out origin-top",
               mostrarFiltros ? "z-[80] opacity-100 max-h-[1000px] py-3 space-y-3 scale-100 overflow-visible" : "z-0 opacity-0 max-h-0 p-0 pointer-events-none scale-[.98] overflow-hidden",
            ].join(" ")}
         >
            <h2 id={FILTER_HEADING_ID} className="text-xl font-semibold text-[var(--heading)]">
               Buscar movimientos
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
               {!(tab === 'abonos' || tab === 'cargos') && (
                  <div className="flex flex-col gap-1">
                     <label htmlFor="f-tipo" className="text-[12px] text-[var(--text-soft)]">Tipo</label>
                     <select
                        id="f-tipo"
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                        autoComplete="off"
                        onKeyDown={(e) => e.key === "Enter" && applyAndFetch()}
                     >
                        <option>Todos</option>
                        <option>Abonos</option>
                        <option>Cargos</option>
                     </select>
                  </div>
               )}

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-fecha-ini" className="text-[12px] text-[var(--text-soft)]">Fecha inicial</label>
                  <DateInput id="f-fecha-ini" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={fechaIni} onChange={setFechaIni} />
               </div>

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-fecha-fin" className="text-[12px] text-[var(--text-soft)]">Fecha final</label>
                  <DateInput id="f-fecha-fin" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={fechaFin} onChange={setFechaFin} min={fechaIni || undefined} />
               </div>

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-monto" className="text-[12px] text-[var(--text-soft)]">Monto</label>
                  <input id="f-monto" type="text" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={montoFiltro} onChange={(e) => setMontoFiltro(e.target.value)} placeholder="Ej: 120000" autoComplete="off" onKeyDown={(e) => e.key === "Enter" && applyAndFetch()} />
               </div>

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-cta" className="text-[12px] text-[var(--text-soft)]">Cuenta corriente</label>
                  <select id="f-cta" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={ctaCorriente} onChange={(e) => setCtaCorriente(e.target.value)} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && applyAndFetch()}>
                     <option value="">Todas</option>
                     {loadingAccounts && <option value="" disabled>Cargando cuentas...</option>}
                     {!loadingAccounts && cuentasDisponibles.length === 0 && <option value="" disabled>Sin cuentas registradas</option>}
                     {cuentasDisponibles.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
                  </select>
               </div>

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-descripcion" className="text-[12px] text-[var(--text-soft)]">Descripción</label>
                  <input id="f-descripcion" type="text" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Texto en descripcion" autoComplete="off" onKeyDown={(e) => e.key === "Enter" && applyAndFetch()} />
               </div>

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-cuenta" className="text-[12px] text-[var(--text-soft)]">Cuenta</label>
                  <input id="f-cuenta" type="text" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={cuenta} onChange={(e) => setCuenta(e.target.value)} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && applyAndFetch()} />
               </div>

               <div className="flex flex-col gap-1">
                  <label htmlFor="f-doc" className="text-[12px] text-[var(--text-soft)]">Número documento</label>
                  <input id="f-doc" type="text" className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2" value={nroDocumento} onChange={(e) => setNroDocumento(e.target.value)} autoComplete="off" onKeyDown={(e) => e.key === "Enter" && applyAndFetch()} />
               </div>

               <div className="flex items-end gap-2">
                  <button
                     disabled={loading}
                     className={`px-4 py-2 rounded-lg ${loading ? "opacity-60 cursor-not-allowed" : "bg-[var(--brand)] text-white"}`}
                     onClick={applyAndFetch}
                  >
                     {loading ? "Cargando…" : "Filtrar"}
                  </button>
               </div>

            </div>
         </div>

         {/* pestañas estilo barra */}
         <div className="bg-[var(--bg-content)] py-2 shadow-sm">
            <div className="flex items-center justify-between gap-3">
               <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Vistas de cartolas">
                  <TabButton active={tab === "todos"} onClick={resetAll}>Todos</TabButton>

                  <TabButton
                     active={tab === "sugerencias"}
                     onClick={handleOpenSuggestions}
                     rightBadge={
                        sugBadgeLoading
                           ? <span className="inline-block w-3 h-3 border-2 border-[var(--warning)] border-t-transparent rounded-full animate-spin"></span>
                           : <span
                              title={sugIsError ? 'No se pudo calcular; prueba acotar fechas o cuenta' : undefined}
                              className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--warning-bg)] text-[var(--warning)] min-w-[2ch] text-center"
                           >
                              {sugerenciasBadgeText}
                           </span>
                     }
                  >
                     Sugerencias conciliación
                  </TabButton>

                  <TabButton
                     active={tab === "abonos"}
                     onClick={() => switchTabWithReset("abonos")}
                     rightBadge={
                        abonosLoading
                           ? <span className="inline-block w-3 h-3 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></span>
                           : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-soft-bg,rgba(0,0,0,.05))] text-[var(--brand)] min-w-[2ch] text-center">{abonosTotal}</span>
                     }
                  >
                     Abonos
                  </TabButton>

                  <TabButton
                     active={tab === "cargos"}
                     onClick={() => switchTabWithReset("cargos")}
                     rightBadge={
                        cargosLoading
                           ? <span className="inline-block w-3 h-3 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></span>
                           : <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--brand-soft-bg,rgba(0,0,0,.05))] text-[var(--brand)] min-w-[2ch] text-center">{cargosTotal}</span>
                     }
                  >
                     Cargos
                  </TabButton>

                  {tab !== "sugerencias" && (
                     <label className="ml-2 inline-flex items-center gap-2 text-[var(--text-main)]">
                        <input
                           type="checkbox"
                           className="accent-[var(--brand)]"
                           checked={soloPorConciliar}
                           onChange={(e) => {
                              setSoloPorConciliar(e.target.checked);
                              setPage(0);
                           }}
                        />
                        Por conciliar
                     </label>
                  )}
               </div>

               <div className="flex items-center gap-2">
                  {tab !== 'sugerencias' && (
                     <div className="flex items-center gap-2">
                        {canCreate && (
                           <div className="relative group">
                              <PrimaryButton onClick={openUploadModal} className="flex items-center gap-2 px-3 md:px-6 py-2.5 bg-brand text-white font-medium rounded-xl shadow-lg shadow-brand/20 hover:bg-brand-strong hover:-translate-y-0.5 transition-all">
                                 <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" className="shrink-0"><path d="M12 3l4 4h-3v6h-2V7H8l4-4zm-7 14h14v2H5v-2z" /></svg>
                                 <span className="hidden xl:block">Agregar movimiento</span>
                              </PrimaryButton>
                           </div>
                        )}
                        <div className="relative group">
                           <button type="button" onClick={() => setMostrarFiltros(v => !v)} aria-expanded={mostrarFiltros} aria-controls={FILTER_PANEL_ID} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-1)]" title="Mostrar/Ocultar filtros (Ctrl/⌘+K)">
                              🔍 <span className="sr-only">Filtros</span>
                           </button>
                           <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-xs px-2 py-1 rounded-md z-[90] bg-[var(--surface-2)] text-[var(--text-main)] shadow opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              {mostrarFiltros ? "Ocultar filtros" : "Mostrar filtros"}
                           </div>
                        </div>
                        <div className="relative group">
                           <button onClick={exportXLSX} disabled={loading} className={`p-2 rounded-lg border border-[var(--border-subtle)] ${loading ? "opacity-60 cursor-not-allowed" : "hover:bg-[var(--surface-1)]"}`}>
                              {loading ? "…" : "XLSX"}
                           </button>
                           <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap text-xs px-2 py-1 rounded-md z-[90] bg-[var(--surface-2)] text-[var(--text-main)] shadow opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                              Exportar XLSX
                           </div>
                        </div>
                     </div>
                  )}
               </div>
            </div>
         </div>

         {/* panel de sugerencias de conciliacion */}
         {tab === 'sugerencias' && (
            <div className="bg-[var(--bg-content)] shadow-sm p-3 mb-4 rounded-lg">
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

         {/* tabla */}
         {tab !== 'sugerencias' && (
            <div className={`bg-[var(--bg-content)] overflow-auto shadow-sm transition-all animate-fade-in ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
               <table className="min-w-full text-sm">
                  <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--heading)]">
                     <tr className="text-left">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2">Fecha</th>
                        <th className="px-3 py-2">Cuenta Corriente</th>
                        <th className="px-3 py-2">Número Documento</th>
                        <th className="px-3 py-2">Descripción</th>
                        <th className="px-3 py-2 text-right">Cargo</th>
                        <th className="px-3 py-2 text-right">Abono</th>
                        <th className="px-3 py-2 text-right">Saldo</th>
                        <th className="px-3 py-2">Estado Conciliación</th>
                        <th className="px-3 py-2 text-right">Acciones</th>
                     </tr>
                  </thead>
                  <tbody>
                     {bankRows.length === 0 && (
                        <tr>
                           <td className="px-3 py-8 text-center text-[var(--text-soft)]" colSpan={10}>
                              Sin resultados. Ajusta filtros o carga CSV.
                           </td>
                        </tr>
                     )}

                     {bankRows.map((r) => {
                        // en la nueva api, los rows traen remaining_amount desde raw
                        const remaining = Math.max(0, Number(r.raw?.remaining_amount ?? Math.abs(r.monto)));
                        const cargo = r.monto < 0 ? Math.abs(r.monto) : 0;
                        const abono = r.monto > 0 ? r.monto : 0;
                        const bankTxId = r.raw?.id ?? (typeof r._id === 'string' && r._id.startsWith('tx-') ? Number(r._id.replace('tx-', '')) : r._id);
                        const appliedSum = Number(r.raw?.applied_sum || 0);

                        return (
                           <tr key={r._id} className="border-t border-[var(--border-subtle)]">
                              <td className="px-3 py-2"><input type="checkbox" /></td>
                              <td className="px-3 py-2 whitespace-nowrap">{r.fecha}</td>
                              <td className="px-3 py-2">
                                 {r.source === "bank" ? "Banco" : "SII"}
                                 <div className="text-[11px] text-[var(--text-soft)]">
                                    {r.cuenta_corriente || "—"}
                                 </div>
                              </td>
                              <td className="px-3 py-2">{r.documento || "—"}</td>
                              <td className="px-3 py-2">{r.descripcion}</td>
                              <td className="px-3 py-2 text-right">{cargo ? fmtCLP(cargo) : "—"}</td>
                              <td className="px-3 py-2 text-right">{abono ? fmtCLP(abono) : "—"}</td>
                              <td className="px-3 py-2 text-right">
                                 {r.raw?.balance != null ? fmtCLP(r.raw.balance) : "—"}
                              </td>
                              <td className="px-3 py-2">
                                 <div className="flex items-center justify-between gap-2">
                                    <div className={`text-[12px] ${remaining > 0 ? "text-[var(--warning)]" : "text-[var(--success)]"}`}>
                                       {remaining > 0
                                          ? `${fmtCLP(remaining)} por conciliar`
                                          : `${fmtCLP(Math.abs(r.monto))} conciliado`}
                                    </div>
                                    {remaining > 0 && canCreate && (
                                       <button
                                          className="px-3 py-1 rounded-lg bg-[var(--brand)] text-white text-xs"
                                          onClick={() => openConciliar(r)}
                                       >
                                          Conciliar
                                       </button>
                                    )}
                                 </div>
                              </td>
                              <td className="px-3 py-2 text-right">
                                 <div className="flex items-center justify-end gap-2">
                                    <button
                                       type="button"
                                       disabled={appliedSum <= 0}
                                       onClick={() => {
                                          setReconciliationDetailTxId(bankTxId);
                                          setReconciliationDetailTxAmount(Math.abs(r.monto));
                                       }}
                                       className={`px-3 py-1 rounded border border-[var(--border-subtle)] text-xs ${appliedSum > 0
                                          ? 'hover:bg-[var(--surface-1)] text-[var(--brand)]'
                                          : 'opacity-50 cursor-not-allowed text-[var(--text-soft)]'
                                          }`}
                                    >
                                       Detalle
                                    </button>
                                    {canDelete && appliedSum <= 0 && (
                                       <button
                                          type="button"
                                          disabled={deletingTxId === bankTxId}
                                          onClick={() => handleDeleteTransaction(bankTxId)}
                                          className="px-3 py-1 rounded border border-[var(--danger)] text-[var(--danger)] text-xs hover:bg-[var(--danger)]/10 disabled:opacity-50"
                                       >
                                          {deletingTxId === bankTxId ? "..." : "Eliminar"}
                                       </button>
                                    )}
                                 </div>
                              </td>
                           </tr>
                        );
                     })}
                  </tbody>
               </table>

               {/* paginación */}
               <div className="flex items-center gap-3 mt-3 p-3 border-t border-[var(--border-subtle)]">
                  <span>
                     Página {page + 1} de {Math.max(1, Math.ceil(total / pageSize))}
                  </span>
                  <button className="px-3 py-1 rounded border" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))}>
                     ◀ Anterior
                  </button>
                  <button className="px-3 py-1 rounded border" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>
                     Siguiente ▶
                  </button>
                  <select className="px-2 py-1 border rounded text-[var(--heading)] bg-[var(--surface-1)]" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                     <option value={25}>25</option>
                     <option value={50}>50</option>
                     <option value={100}>100</option>
                     <option value={200}>200</option>
                  </select>
               </div>
            </div>
         )}
         {/* ===== Modal Conciliar (intacto) ===== */}
         {reconcileTx && (
            <div
               className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center"
               onClick={() => { if (!showPayableDetail) closeConciliarSmooth(); }}
            >
               <div
                  className={`w-[98vw] max-w-[1400px] min-h-[80vh] max-h-[92vh] overflow-hidden bg-[var(--bg-content)] rounded-2xl shadow-2xl ${modalClosing ? 'animate-[fadeOutDown_.18s_ease-in_forwards]' : 'opacity-0 translate-y-2 animate-[fadeInUp_.24s_ease-out_forwards]'}`}
                  onClick={(e) => e.stopPropagation()}
               >
                  <div className="sticky top-0 z-10 bg-[var(--bg-content)] border-b border-[var(--border-subtle)]">
                     <div className="px-6 pt-4 pb-2 flex items-center justify-between">
                        <div className="text-xl font-semibold text-[var(--heading)]">Conciliar</div>
                        <button className="px-3 py-1 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-1)] text-sm" onClick={closeConciliarSmooth}>
                           Cerrar
                        </button>
                     </div>
                  </div>

                  <div className="px-6 py-2 h-[calc(92vh-64px)] overflow-auto">
                     {!(selectedTargetKind === 'bank_transaction' && selectedDoc) ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                           <section className="lg:col-span-6">
                              <div className="w-full max-w-[420px]">
                                 <h3 className="text-[var(--heading)] font-medium mb-2">Movimiento Bancario</h3>
                                 <div className="mb-3 border-t border" />
                                 <div className="relative w-full rounded-md shadow-lg border bg-[var(--bankcard-surface)] border-[var(--bankcard-border)] p-3 md:p-4 ring-1 ring-transparent hover:ring-[var(--bankcard-ring)] transition-all duration-200" style={bankCardTheme}>
                                    <div className="absolute inset-x-0 -top-[1px] h-1 rounded-t-md" style={{ background: 'var(--bankcard-gradient)' }} />
                                    <div className="flex items-start justify-between gap-2">
                                       <div className="min-w-0">
                                          <div className="flex items-center gap-2">
                                             <div className="text-[10px] uppercase tracking-wide text-[var(--bankcard-soft)]">{reconcileTx.fecha || "—"}</div>
                                             <span className="inline-flex items-center px-1.5 py-[2px] text-[9px] rounded-full font-medium" style={{ background: '#5CB9A5', color: '#FFFFFF' }} title={reconcileTx?.monto >= 0 ? 'Abono' : 'Cargo'}>
                                                Mov. bancario • CC
                                             </span>
                                          </div>
                                          <div className="mt-0.5 font-semibold leading-[1.25] text-[13px] md:text-[14px] text-[var(--bankcard-text)] truncate">
                                             {reconcileTx.descripcion || "(sin descripcion)"}
                                          </div>
                                       </div>
                                       <div className="text-right shrink-0">
                                          <div className="text-base md:text-lg font-extrabold">{fmtCLP?.(Math.abs(reconcileTx.monto))}</div>
                                       </div>
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                       <div className="text-[11px] text-[var(--bankcard-soft)] truncate">{reconcileTx.cuenta_corriente || "—"}</div>
                                       <div className="text-[11px]">
                                          <span className={isFullyAssigned ? "text-[var(--bankcard-success)] mr-1" : "text-[var(--bankcard-link)] mr-1"}>Saldo por asignar</span>
                                          <b className={isFullyAssigned ? "text-[var(--bankcard-success)]" : "text-[var(--bankcard-link)]"}>{fmtCLP?.(txRemainingAfter)}</b>
                                          {isFullyAssigned && <span className="ml-1 inline-flex items-center text-[var(--bankcard-success)]" title="Completamente asignado">✓</span>}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           </section>

                           <section className="lg:col-span-6 flex justify-end">
                              <div className="w-full max-w-[420px]">
                                 <h3 className="text-[var(--heading)] font-medium mb-2">Documentos de respaldo</h3>
                                 <div className="mb-3 border-t border" />
                                 <div className="border border-dashed border-[var(--border-subtle)] rounded-xl p-6 text-[var(--text-soft)] text-sm flex items-center justify-center">
                                    Selecciona documentos de respaldo para conciliarlos contra este movimiento bancario
                                 </div>
                              </div>
                           </section>

                           <section className="lg:col-span-12">
                              <div className="flex justify-center min-h-6">
                                 {selectedTargetKind === 'document' && selectedDocuments.length > 0 && !menuLoading && !ctaDelay ? (
                                    <div className="flex flex-col md:flex-row md:items-center justify-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 py-3">
                                       <div className="text-sm text-[var(--text-main)]">
                                          <span className="font-semibold">{selectedDocuments.length}</span> documento(s) seleccionados
                                          <span className="mx-2 text-[var(--text-soft)]">|</span>
                                          max: <span className="font-semibold">{fmtCLP?.(maxAssignable)}</span>
                                       </div>
                                       <div className="flex items-stretch rounded-md overflow-hidden shadow-sm">
                                          <span className="inline-flex items-center px-3 bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--text-soft)] select-none">$</span>
                                          <input
                                             type="number"
                                             className="h-9 w-40 border border-l-0 border-[var(--border-subtle)] bg-[var(--bg-content)] text-[var(--heading)] px-3 text-right focus:outline-none focus:ring-2 focus:ring-[var(--bankcard-ring)]"
                                             value={assignAmount}
                                             min={0}
                                             max={maxAssignable}
                                             onChange={handleAssignChange}
                                             placeholder="0"
                                          />
                                       </div>
                                       <button
                                          type="button"
                                          onClick={handleSave}
                                          disabled={isSaving || !assigned || assigned <= 0}
                                          className={`px-5 py-2 rounded-md text-white text-sm font-medium transition ${(!assigned || assigned <= 0) ? 'bg-teal-400/60 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-600'}`}
                                       >
                                          {saveState === 'saving' ? 'Guardando...' : 'Guardar conciliacion'}
                                       </button>
                                    </div>
                                 ) : !(selectedTargetKind === 'document' ? selectedDocuments.length > 0 : selectedDocId) && !menuLoading && !ctaDelay && (
                                    <button className="px-6 py-2 rounded bg-emerald-400/60 text-white cursor-not-allowed" disabled>No hay nada que guardar</button>
                                 )}
                              </div>
                           </section>

                           {reconcileDocumentSide === 'income' && (
                              <section className="lg:col-span-12">
                                 <div className="mb-3 flex items-center justify-between gap-3">
                                    <div>
                                       <h3 className="text-[var(--heading)] font-medium">Ventas agrupadas por dia</h3>
                                       <p className="text-xs text-[var(--text-soft)] mt-0.5">
                                          Suma boletas y facturas emitidas el mismo dia para conciliarlas contra este abono.
                                       </p>
                                    </div>
                                    {loadingDailySales && (
                                       <span className="text-xs text-[var(--brand)] animate-pulse">agrupando...</span>
                                    )}
                                 </div>

                                 <div className="border rounded-xl border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden">
                                    {dailySalesError ? (
                                       <div className="px-4 py-3 text-sm text-[var(--danger)]">{dailySalesError}</div>
                                    ) : loadingDailySales ? (
                                       <div className="px-4 py-3 text-sm text-[var(--text-soft)]">Buscando ventas cercanas a la fecha del movimiento...</div>
                                    ) : dailySalesGroups.length === 0 ? (
                                       <div className="px-4 py-3 text-sm text-[var(--text-soft)]">No hay ventas pendientes agrupables cerca de esta fecha.</div>
                                    ) : (
                                       <div className="max-h-56 overflow-auto">
                                          <table className="min-w-full text-sm table-fixed border-collapse">
                                             <thead className="sticky top-0 text-[var(--heading)] z-[1]">
                                                <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                                                   <th className="px-3 py-2 text-left w-[140px]">Dia</th>
                                                   <th className="px-3 py-2 text-left">Documentos</th>
                                                   <th className="px-3 py-2 text-right w-[150px]">Total dia</th>
                                                   <th className="px-3 py-2 text-right w-[150px]">Diferencia</th>
                                                   <th className="px-3 py-2 text-right w-[150px]"></th>
                                                </tr>
                                             </thead>
                                             <tbody>
                                                {dailySalesGroups.slice(0, 8).map((group) => {
                                                   const exactMatch = Math.abs(group.diff) <= 1;
                                                   const canApply = txRemaining > 0 && group.docs.length > 0;
                                                   const isSavingGroup = savingDailyGroupKey === group.key;

                                                   return (
                                                      <tr key={group.key} className={`border-b border-[var(--border-subtle)] ${exactMatch ? 'bg-emerald-500/10' : ''}`}>
                                                         <td className="px-3 py-2 whitespace-nowrap">
                                                            <div className="font-semibold text-[var(--heading)]">{group.date}</div>
                                                            {exactMatch && <div className="text-[10px] text-[var(--success)]">calce exacto</div>}
                                                         </td>
                                                         <td className="px-3 py-2">
                                                            <div className="flex flex-wrap gap-1.5">
                                                               {group.docs.slice(0, 5).map((doc) => {
                                                                  const tag = docTag(doc.doc_type_code);
                                                                  return (
                                                                     <span key={doc.id} title={getSiiDocumentTypeLabel(doc.doc_type_code)} className="inline-flex items-center rounded-md overflow-hidden text-[10px] font-semibold">
                                                                        <span className="px-2 h-5 flex items-center" style={{ background: tag.color, color: '#fff' }}>{tag.abbr}</span>
                                                                        <span className="px-2 h-5 flex items-center bg-[var(--bg-content)] text-[var(--text-soft)] border border-l-0 border-[var(--border-subtle)]">{doc.folio || doc.id}</span>
                                                                     </span>
                                                                  );
                                                               })}
                                                               {group.docs.length > 5 && (
                                                                  <span className="inline-flex items-center h-5 px-2 rounded-md text-[10px] bg-[var(--bg-content)] text-[var(--text-soft)] border border-[var(--border-subtle)]">
                                                                     +{group.docs.length - 5}
                                                                  </span>
                                                               )}
                                                            </div>
                                                            <div className="mt-1 text-[11px] text-[var(--text-soft)]">{group.docs.length} documentos pendientes</div>
                                                         </td>
                                                         <td className="px-3 py-2 text-right font-semibold">{fmtCLP?.(group.total)}</td>
                                                         <td className={`px-3 py-2 text-right ${exactMatch ? 'text-[var(--success)]' : 'text-[var(--text-soft)]'}`}>
                                                            {group.diff === 0 ? '$0' : fmtCLP?.(Math.abs(group.diff))}
                                                         </td>
                                                         <td className="px-3 py-2 text-right">
                                                            <button
                                                               type="button"
                                                               disabled={!canApply || Boolean(savingDailyGroupKey)}
                                                               onClick={() => reconcileDailySalesGroup(group)}
                                                               className={`inline-flex items-center justify-center px-3 py-1 rounded-lg text-xs font-medium transition ${canApply ? 'bg-[var(--brand)] text-white hover:bg-[var(--brand-strong)]' : 'bg-[var(--surface-2)] text-[var(--text-soft)] cursor-not-allowed'}`}
                                                               title={!canApply ? 'No hay saldo disponible para aplicar' : 'Aplicar este abono a la venta del dia'}
                                                            >
                                                               {isSavingGroup ? 'Aplicando...' : 'Aplicar a dia'}
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
                              </section>
                           )}

                           <section className="lg:col-span-12">
                              <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                                 <select
                                    value={selectedTargetKind}
                                    onChange={(e) => {
                                       setSelectedTargetKind(e.target.value);
                                       setSelectedDocId(null);
                                       setSelectedDocIds([]);
                                       setModalTipo('');
                                    }}
                                    className="w-full md:w-[190px] h-8 text-xs border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-md px-2"
                                 >
                                    <option value="document">Documentos SII</option>
                                    <option value="bank_transaction">Movimientos bancarios</option>
                                 </select>
                                 <input
                                    type="text"
                                    placeholder={selectedTargetKind === 'bank_transaction' ? 'Buscar por descripcion, banco, referencia o monto' : 'Buscar por folio, RUT, contraparte o monto'}
                                    value={modalQuery}
                                    onChange={(e) => setModalQuery(e.target.value)}
                                    className="w-full md:flex-1 h-8 text-xs border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-md px-2"
                                 />
                                 {selectedTargetKind === 'document' && (
                                    <select value={modalTipo} onChange={(e) => setModalTipo(e.target.value)} className="w-full md:w-[200px] h-8 text-xs border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-md px-2">
                                       {modalTypeOptions.map((option) => (
                                          <option key={option.value || 'all'} value={option.value}>{option.label}</option>
                                       ))}
                                    </select>
                                 )}
                              </div>
                              <div className="border rounded-xl border-[var(--border-subtle)] bg-[var(--surface-1)] overflow-hidden">
                                 <div className="max-h-[48vh] overflow-auto">
                                    <table className="min-w-full text-sm table-fixed border-collapse">
                                       <thead className="sticky top-0 text-[var(--heading)] z-[1]">
                                          <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-1)]">
                                             <th className="px-3 py-2 text-left">Saldo por Asignar</th>
                                             <th className="px-3 py-2 text-left">Monto</th>
                                             <th
                                                className="pl-3 pr-1 py-2 text-left w-[120px] cursor-pointer hover:bg-[var(--surface-2)] select-none transition-colors"
                                                onClick={() => setModalSortDate(s => s === 'none' ? 'desc' : (s === 'desc' ? 'asc' : 'none'))}
                                                title="Ordenar por fecha"
                                             >
                                                Fecha {modalSortDate === 'asc' ? '↑' : modalSortDate === 'desc' ? '↓' : ''}
                                             </th>
                                             <th className="pl-1 pr-3 py-2 text-left w-[110px]">Tipo</th>
                                             <th className="px-3 py-2 text-left">Descripción</th>
                                             <th className="px-3 py-2 text-right"></th>
                                          </tr>
                                       </thead>
                                       <tbody>
                                          {menuLoading ? (
                                             <tr><td className="px-3 py-4" colSpan={6}>{selectedTargetKind === 'bank_transaction' ? 'Buscando movimientos...' : debouncedQuery.length >= 2 ? 'Buscando documentos...' : 'Buscando sugerencias...'}</td></tr>
                                          ) : (selectedTargetKind === 'bank_transaction' ? bankSearchError : documentSearchError) ? (
                                             <tr><td className="px-3 py-6 text-center text-[var(--danger)]" colSpan={6}>{selectedTargetKind === 'bank_transaction' ? bankSearchError : documentSearchError}</td></tr>
                                          ) : modalFiltered.length === 0 ? (
                                             <tr><td className="px-3 py-6 text-center text-[var(--text-soft)]" colSpan={6}>{selectedTargetKind === 'bank_transaction' ? 'No se encontraron movimientos pendientes para cruzar.' : debouncedQuery ? 'No se encontraron documentos pendientes para la busqueda.' : 'No hay documentos pendientes sugeridos.'}</td></tr>
                                          ) : (
                                             modalFiltered.map((d) => (
                                                <tr key={`${d.target_kind || selectedTargetKind}-${d.id}`} className={`border-b border-[var(--border-subtle)] ${isCandidateSelected(d) ? 'bg-[var(--surface-2)]' : ''}`}>
                                                   <td className="px-3 py-2">
                                                      {isCandidateSelected(d) ? (
                                                         <div className="text-right">
                                                            <div className="text-[var(--danger)] font-semibold">{fmtCLP?.(Math.max(0, Number(d.remaining_amount || 0) - Number(selectedDocumentAllocation.get(Number(d.id)) ?? assigned)))}</div>
                                                            <div className="text-[10px] text-[var(--text-soft)] -mt-0.5">Saldo por pagar</div>
                                                         </div>
                                                      ) : (fmtCLP?.(d.remaining_amount) ?? d.remaining_amount)}
                                                   </td>
                                                   <td className="px-3 py-2">{fmtCLP?.(d.total_amount) ?? d.total_amount}</td>
                                                   <td className="pl-3 pr-1 py-2">{d.issue_date || "—"}</td>
                                                   <td className="pl-1 pr-3 py-2 whitespace-nowrap">
                                                      {(d.target_kind || selectedTargetKind) === 'bank_transaction' ? (
                                                         <span className="inline-flex items-center px-2 h-5 rounded-md text-[10px] font-semibold bg-[var(--brand)] text-white">
                                                            {d.bank_type === 'expense' ? 'Cargo' : 'Abono'}
                                                         </span>
                                                      ) : (() => {
                                                         const tag = docTag(d.doc_type_code);
                                                         const solid = tag.color, light = hexToRgba(tag.color, 0.12), divider = hexToRgba(tag.color, 0.35);
                                                         if (!d.folio) return <span title={getSiiDocumentTypeLabel(d.doc_type_code)} className="inline-flex items-center px-2 h-5 rounded-md text-[10px] font-semibold" style={{ background: solid, color: '#fff' }}>{tag.abbr}</span>;
                                                         return (
                                                            <span title={getSiiDocumentTypeLabel(d.doc_type_code)} className="inline-flex items-stretch rounded-md overflow-hidden text-[10px] font-semibold">
                                                               <span className="px-2 h-5 flex items-center" style={{ background: solid, color: '#fff' }}>{tag.abbr}</span>
                                                               <span className="px-2 h-5 flex items-center" style={{ background: light, color: solid, borderLeft: `1px solid ${divider}` }}>{d.folio}</span>
                                                            </span>
                                                         );
                                                      })()}
                                                   </td>
                                                   <td className="px-3 py-2">
                                                      <div className="truncate max-w-[320px]">
                                                         {d.counterparty_rut ? `${d.counterparty_rut} - ` : ''}{d.counterparty_name || d.description || "—"}
                                                      </div>
                                                      {d.account_label && <div className="text-[10px] text-[var(--text-soft)] truncate max-w-[320px]">{d.account_label}</div>}
                                                   </td>
                                                   <td className="px-3 py-2 text-right">
                                                      <button className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${isCandidateSelected(d) ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-amber-400 hover:bg-amber-500 text-black'}`} onClick={() => toggleCandidateSelection(d)}>
                                                         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                                                         <span>{isCandidateSelected(d) ? 'Seleccionado' : 'Seleccionar'}</span>
                                                      </button>
                                                   </td>
                                                </tr>
                                             ))
                                          )}
                                       </tbody>
                                    </table>
                                 </div>
                              </div>
                           </section>
                        </div>
                     ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                           <section className="lg:col-span-5 lg:pr-6">
                              <h3 className="text-[var(--heading)] font-medium mb-2">Movimiento Bancario</h3>
                              <div className="mb-3 border-t border" />
                              <div className="relative w-full rounded-md shadow-lg border bg-[var(--bankcard-surface)] border-[var(--bankcard-border)] p-3 md:p-4 ring-1 ring-transparent hover:ring-[var(--bankcard-ring)] transition-all duration-200" style={bankCardTheme}>
                                 <div className="absolute inset-x-0 -top-[1px] h-1 rounded-t-md" style={{ background: 'var(--bankcard-gradient)' }} />
                                 <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-2">
                                          <div className="text-[10px] uppercase tracking-wide text-[var(--bankcard-soft)]">{reconcileTx.fecha || "—"}</div>
                                          <span className="inline-flex items-center px-1.5 py-[2px] text-[9px] rounded-full font-medium" style={{ background: '#5CB9A5', color: '#FFFFFF' }}>Mov. bancario • CC</span>
                                       </div>
                                       <div className="mt-0.5 font-semibold leading-[1.25] text-[13px] md:text-[14px] text-[var(--bankcard-text)] truncate">{reconcileTx.descripcion || "(sin descripcion)"}</div>
                                    </div>
                                    <div className="text-right shrink-0">
                                       <div className="text-base md:text-lg font-extrabold">{fmtCLP?.(Math.abs(reconcileTx.monto))}</div>
                                    </div>
                                 </div>
                                 <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-[11px] text-[var(--bankcard-soft)] truncate">{reconcileTx.cuenta_corriente || "—"}</div>
                                    <div className="text-[11px]">
                                       <span className={isFullyAssigned ? "text-[var(--bankcard-success)] mr-1" : "text-[var(--bankcard-link)] mr-1"}>Saldo por asignar</span>
                                       <span className={isFullyAssigned ? "text-[var(--bankcard-success)]" : "text-[var(--bankcard-link)]"}><AnimatedAmount value={txRemainingAfter} fmt={fmtCLP} busy={isTyping} bold={false} /></span>
                                       {isFullyAssigned && <span className="ml-1 inline-flex items-center text-[var(--bankcard-success)]">✓</span>}
                                    </div>
                                 </div>
                              </div>
                           </section>

                           <section className="lg:col-span-2 flex flex-col items-center justify-center">
                              <h4 className="text-[var(--text-soft)] text-sm mb-2">Monto a asignar</h4>
                              <div className="flex items-stretch rounded-md overflow-hidden shadow-sm">
                                 <span className="inline-flex items-center px-3 bg-[var(--surface-2)] border border-[var(--border-subtle)] text-[var(--text-soft)] select-none">$</span>
                                 <input type="number" className="h-10 w-40 md:w-44 border border-l-0 border-[var(--border-subtle)] bg-[var(--bg-content)] text-[var(--heading)] px-3 text-right focus:outline-none focus:ring-2 focus:ring-[var(--bankcard-ring)]" value={assignAmount} min={0} max={maxAssignable} onChange={handleAssignChange} placeholder="0" />
                              </div>
                              <div className="mt-3 opacity-60 text-xs">máx: {fmtCLP?.(maxAssignable)}</div>
                              <div className="hidden lg:block mt-6 text-2xl select-none">➜</div>
                              {(selectedTargetKind === 'document' ? selectedDocuments.length > 0 : selectedDocId) && (
                                 <div className="mt-6 w-full flex flex-col items-center">
                                    <button type="button" onClick={handleSave} disabled={isSaving || !assigned || assigned <= 0} className={`px-5 py-3 rounded-md text-white text-sm font-medium transition ${(!assigned || assigned <= 0) ? 'bg-teal-400/60 cursor-not-allowed' : 'bg-teal-500 hover:bg-teal-600'}`}>
                                       {saveState === 'saving' && <span className="inline-flex items-center gap-2"><span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Guardando…</span>}
                                       {saveState === 'done' && <span className="inline-flex items-center gap-2"><span>✓</span> Guardado</span>}
                                       {saveState !== 'saving' && saveState !== 'done' && <span className="inline-flex items-center gap-2"><span>✓</span> Guardar conciliación</span>}
                                    </button>
                                 </div>
                              )}
                           </section>

                           <section className="lg:col-span-5">
                              <div className="flex items-center justify-between mb-3">
                                 <h3 className="text-[var(--heading)] font-medium">{selectedTargetKind === 'bank_transaction' ? 'Movimiento seleccionado' : hasMultipleSelectedDocuments ? 'Documentos seleccionados' : 'Documento seleccionado'}</h3>
                              </div>
                              <div className="relative w-full rounded-md shadow-lg border bg-[var(--bankcard-surface)] border-[var(--bankcard-border)] p-3 md:p-4" style={bankCardTheme}>
                                 <div className="absolute inset-x-0 -top-[1px] h-1 rounded-t-md" style={{ background: 'var(--bankcard-gradient)' }} />
                                 <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-2">
                                          <div className="text-[12px] text-[var(--bankcard-soft)]">{hasMultipleSelectedDocuments ? `${selectedDocuments.length} documentos` : selectedDoc?.issue_date || "—"}</div>
                                          {hasMultipleSelectedDocuments ? (
                                             <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-[var(--brand)] text-white">Lote</span>
                                          ) : selectedTargetKind === 'bank_transaction' ? (
                                             <span className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold bg-[var(--brand)] text-white">
                                                {selectedDoc?.bank_type === 'expense' ? 'Cargo' : 'Abono'}
                                             </span>
                                          ) : (() => {
                                             const tag = docTag(selectedDoc?.doc_type_code);
                                             const solid = tag.color, light = hexToRgba(tag.color, 0.12), divider = hexToRgba(tag.color, 0.35);
                                             return selectedDoc?.folio ? (
                                                <span title={getSiiDocumentTypeLabel(selectedDoc?.doc_type_code)} className="inline-flex items-stretch rounded-full overflow-hidden text-[10px] font-semibold leading-none">
                                                   <span className="px-2 h-5 flex items-center" style={{ background: solid, color: '#fff' }}>{tag.abbr}</span>
                                                   <span className="px-2 h-5 flex items-center" style={{ background: light, color: solid, borderLeft: `1px solid ${divider}` }}>{selectedDoc.folio}</span>
                                                </span>
                                             ) : <span title={getSiiDocumentTypeLabel(selectedDoc?.doc_type_code)} className="inline-flex items-center px-2 h-5 rounded-full text-[10px] font-semibold" style={{ background: solid, color: '#fff' }}>{tag.abbr}</span>;
                                          })()}
                                       </div>
                                       <div className="mt-1 font-semibold text-[13px] md:text-[14px] text-[var(--bankcard-text)] truncate">{hasMultipleSelectedDocuments ? `${selectedDocuments.length} documentos seleccionados` : selectedDoc?.counterparty_name || selectedDoc?.description || selectedDoc?.descripcion || "(sin descripcion)"}</div>
                                    </div>
                                    <div className="shrink-0 text-right flex flex-col items-end gap-2">
                                       <button onClick={() => { setSelectedDocId(null); setSelectedDocIds([]); }} className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-[var(--surface-2)] hover:bg-[var(--surface-1)] border border-[var(--border-subtle)] text-[var(--text-soft)]">×</button>
                                       <div className="text-base md:text-lg font-extrabold">{fmtCLP?.(hasMultipleSelectedDocuments ? selectedDocumentsPending : selectedDoc?.total_amount || 0)}</div>
                                    </div>
                                 </div>
                                 <div className="mt-2 flex items-center justify-between gap-2">
                                    <div className="text-[11px] text-[var(--bankcard-soft)] truncate">{hasMultipleSelectedDocuments ? 'Suma de saldos pendientes' : selectedDoc?.account_label || selectedDoc?.counterparty_tax_id || selectedDoc?.counterparty_rut || "—"}</div>
                                    <div className="flex items-center gap-2 text-[12px] font-medium text-[var(--danger)]">
                                       <button type="button" className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-main)] text-[11px] hover:bg-[var(--surface-2)]" onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setDetailAnchor({ x: r.left, y: r.bottom }); setShowPayableDetail(true); }}>i</button>
                                       <span className="underline decoration-dotted underline-offset-2">Saldo por pagar</span>
                                       <AnimatedAmount value={Math.max(0, Number(hasMultipleSelectedDocuments ? selectedDocumentsPending : selectedDoc?.remaining_amount || 0) - Number(assigned || 0))} fmt={fmtCLP} busy={isTyping} danger />
                                    </div>
                                 </div>
                              </div>
                           </section>
                        </div>
                     )}
                  </div>
               </div>
               {showPayableDetail && (
                  <div className="fixed inset-0 z-[70]" onClick={(e) => { if (e.target === e.currentTarget) { e.stopPropagation(); setShowPayableDetail(false); } }}>
                     <div className="absolute inset-0 bg-black/5" />
                     <div className="fixed z-[71] w-[min(680px,92vw)] rounded-xl bg-[var(--bg-content)] text-[var(--text-main)] shadow-2xl border border-[var(--border-subtle)]" style={{ left: Math.max(12, detailAnchor.x - 12), top: detailAnchor.y + 8, transform: 'translateX(-100%)' }}>
                        <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
                           <h4 className="text-lg font-semibold text-[var(--heading)]">Detalle</h4>
                           <button onClick={() => setShowPayableDetail(false)} className="h-8 w-8 rounded-full border hover:bg-[var(--surface-1)] text-[var(--text-soft)]">×</button>
                        </div>
                        <div className="px-5 pt-4 pb-2 overflow-x-auto">
                           <table className="w-full min-w-[560px] text-sm">
                              <thead><tr className="text-[var(--text-soft)] border-b"><th className="text-left py-2">Tipo</th><th className="text-left py-2">Fecha</th><th className="text-left py-2">Descripción</th><th className="text-right py-2">Monto</th></tr></thead>
                              <tbody>
                                 <tr className="border-b">
                                    <td className="py-2">Doc original</td>
                                    <td className="py-2">{selectedDoc?.issue_date || "—"}</td>
                                    <td className="py-2">{selectedDoc?.counterparty_name || "—"}</td>
                                    <td className="py-2 text-right font-medium">{fmtCLP?.(payableBreakdown.total)}</td>
                                 </tr>
                                 <tr className="border-b">
                                    <td className="py-2"><span className="px-2 h-5 rounded-full text-[11px] font-semibold bg-[#F5D9A7] text-[#7A5E1A]">Asignado</span></td>
                                    <td className="py-2">{reconcileTx?.fecha || "—"}</td>
                                    <td className="py-2">Monto asignado ahora</td>
                                    <td className="py-2 text-right font-medium">-{fmtCLP?.(payableBreakdown.nowAssigned)}</td>
                                 </tr>
                              </tbody>
                              <tfoot><tr><td className="pt-3 text-[var(--text-soft)]" colSpan={3}>Saldo por pagar</td><td className="pt-3 text-right font-semibold">{fmtCLP?.(payableBreakdown.remaining)}</td></tr></tfoot>
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
                                 <label htmlFor="upload-account-id" className="text-xs text-[var(--text-soft)]">Cuenta bancaria destino</label>
                                 <select
                                    id="upload-account-id"
                                    className="border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-main)] rounded-md px-3 py-2 text-sm"
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
                                    <button type="button" className="mt-2 text-[12px] underline text-blue-600" onClick={(e) => { e.preventDefault(); setUploadFile(null); }} disabled={isUploading}>Quitar</button>
                                 </div>
                              ) : (
                                 <div className="text-sm text-[var(--text-soft)]">Arrastra tu Excel aqui o haz clic para buscar</div>
                              )}
                              <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => onPickFile(e.target.files?.[0] || null)} disabled={isUploading} />
                           </label>
                           {uploadErr && <div className="mt-3 text-[13px] text-red-500">{uploadErr}</div>}
                        </>
                     ) : (
                        <div className="text-sm text-[var(--text-main)]">
                           <div className="grid grid-cols-2 gap-3 mb-4">
                              <div>Filas totales: <b>{uploadResult.total_rows}</b></div>
                              <div>Validas: <b className="text-emerald-600">{uploadResult.valid_rows}</b></div>
                           </div>
                           {uploadResult.preview_valid?.length > 0 && (
                              <div className="border border-[var(--border-subtle)] rounded-lg overflow-hidden">
                                 <table className="w-full text-xs text-left">
                                    <thead className="bg-[var(--surface-2)] text-[var(--heading)]"><tr><th className="p-2">Fecha</th><th className="p-2">Monto</th><th className="p-2">Detalle</th></tr></thead>
                                    <tbody>{uploadResult.preview_valid.slice(0, 5).map((r, i) => <tr key={i} className="border-t"><td className="p-2">{r.movementDate}</td><td className="p-2">{fmtCLP(r.amount)}</td><td className="p-2">{r.detail}</td></tr>)}</tbody>
                                 </table>
                              </div>
                           )}
                        </div>
                     )}
                  </div>
                  <div className="px-5 py-4 border-t border-[var(--border-subtle)] flex justify-end gap-2 shrink-0">
                     {!uploadResult ? (
                        <>
                           <button type="button" className="px-4 py-2 rounded-md border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--surface-1)]" onClick={closeUploadModal} disabled={isUploading}>Cancelar</button>
                           <button type="button" onClick={handleUploadExcel} disabled={!uploadFile || isUploading || !(Number(uploadAccountId) > 0 || !!selectedUploadAccountId)} className={`px-4 py-2 rounded-md text-white font-medium ${(!uploadFile || !(Number(uploadAccountId) > 0 || !!selectedUploadAccountId)) ? 'bg-gray-400' : 'bg-teal-500'}`}>{isUploading ? 'Subiendo...' : 'Subir'}</button>
                        </>
                     ) : (
                        <button type="button" className="px-4 py-2 rounded-md bg-teal-600 text-white" onClick={closeUploadModal}>Cerrar y ver resultados</button>
                     )}
                  </div>
               </div>
            </div>
         )}
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
                                                {canDelete && !isClient && (
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
      </div>
   );
}

