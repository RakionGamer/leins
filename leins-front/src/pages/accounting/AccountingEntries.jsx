import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import Modal from '../../components/Modal';
import DateInput from '../../components/DateInput';
import { toast } from '../../components/Toaster';
import { usePeriod } from '../../context/PeriodContext';
import {
   getEntries,
   createEntry,
   annulEntry,
   clearAnnulledEntries,
   getAccounts,
} from '../../services/accountingApi';
import {
   ChevronDownIcon,
   ChevronRightIcon,
   TrashIcon,
   PlusIcon,
   CheckIcon,
   BookOpenIcon,
   DocumentDuplicateIcon,
   ArrowTrendingUpIcon,
   ArrowTrendingDownIcon,
   ArrowPathIcon,
   MagnifyingGlassIcon,
   PencilSquareIcon,
} from '@heroicons/react/24/outline';

const formatClp = (n) => {
   const val = Number(n || 0);
   return `$ ${Math.abs(val).toLocaleString('es-CL')}`;
};

const ctrl = 'w-full h-11 px-4 text-xs rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder:text-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition font-medium';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

const SOURCE_LABELS = {
   SII_PURCHASE: 'Compra SII',
   SII_HONORARY: 'Honorarios SII',
   SII_SALE: 'Venta SII',
   BANK_MOVEMENT: 'Banco',
   MANUAL: 'Manual',
};

const getSourceInfo = (entry) => {
   if (entry.source_type === 'SII_PURCHASE' && entry.concept && entry.concept.startsWith('Boleta de Honorarios')) {
      return { label: 'Honorarios SII' };
   }
   return { label: SOURCE_LABELS[entry.source_type] || entry.source_type };
};

function todayYYYYMM() {
   const d = new Date();
   const m = String(d.getMonth() + 1).padStart(2, '0');
   return `${d.getFullYear()}-${m}`;
}

export default function AccountingEntries() {
   const { entityId, ready } = useEntityRequired();
   const { period } = usePeriod();

   const [entries, setEntries] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   // Estado de asientos expandidos (soporta cualquier asiento de forma independiente sin forzar ninguno)
   const [expandedIds, setExpandedIds] = useState(new Set());

   const toggleExpand = (id) => {
      setExpandedIds((prev) => {
         const next = new Set(prev);
         if (next.has(id)) next.delete(id);
         else next.add(id);
         return next;
      });
   };

   const [mode, setMode] = useState('month');
   const [fromDate, setFromDate] = useState('');
   const [toDate, setToDate] = useState('');
   const [filterMonth, setFilterMonth] = useState(() => todayYYYYMM());
   const [search, setSearch] = useState('');
   const [sourceFilter, setSourceFilter] = useState('');
   const [statusFilter, setStatusFilter] = useState('');

   // Paginación visual
   const [page, setPage] = useState(1);
   const pageSize = 10;

   // Modal Asiento Manual
   const [modalOpen, setModalOpen] = useState(false);
   const [formData, setFormData] = useState({
      entry_date: new Date().toISOString().substring(0, 10),
      concept: '',
      items: [
         { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
         { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
      ],
   });
   const [submitting, setSubmitting] = useState(false);
   const [modalErr, setModalErr] = useState(null);

   const loadData = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const [entriesData, accountsData] = await Promise.all([
            getEntries({
               entityId,
               month: mode === 'month' ? filterMonth : undefined,
               from: mode === 'range' ? fromDate : undefined,
               to: mode === 'range' ? toDate : undefined,
               source_type: sourceFilter,
               status: statusFilter,
               q: search,
            }),
            getAccounts({ entityId }),
         ]);

         const rows = entriesData.rows || [];
         setEntries(rows);
         setAccounts(Array.isArray(accountsData) ? accountsData : []);
      } catch (e) {
         setErr(e.message || 'Error al cargar asientos contables');
      } finally {
         setLoading(false);
      }
   }, [entityId, filterMonth, sourceFilter, statusFilter, search, mode, fromDate, toDate]);

   useEffect(() => {
      if (ready && entityId) {
         loadData();
      }
   }, [ready, entityId, loadData]);

   const handleAnnul = async (entry) => {
      if (!window.confirm(`¿Seguro que deseas anular el asiento N° ${entry.entry_number || entry.id}?`)) return;
      setLoading(true);
      try {
         await annulEntry(entry.id, entityId);
         toast.success(`Asiento N° ${entry.entry_number || entry.id} anulado.`);
         loadData();
      } catch (e) {
         setErr(e.message || 'Error al anular asiento');
         setLoading(false);
      }
   };

   // Resumen Estadístico
   const stats = useMemo(() => {
      let totalDebe = 0, totalHaber = 0, vigentes = 0, anulados = 0;
      for (const e of entries ?? []) {
         if (e.status === 'ANNULLED') {
            anulados++;
         } else {
            vigentes++;
            totalDebe += Number(e.total_debit || 0);
            totalHaber += Number(e.total_credit || 0);
         }
      }
      const cuadran = Math.abs(totalDebe - totalHaber) < 1;
      return { total: entries?.length ?? 0, totalDebe, totalHaber, vigentes, anulados, cuadran };
   }, [entries]);

   const accountById = useMemo(() => new Map(accounts.map((a) => [String(a.id), a])), [accounts]);

   const modalTotals = useMemo(() => {
      let d = 0;
      let c = 0;
      formData.items.forEach((it) => {
         d += Number(it.debit) || 0;
         c += Number(it.credit) || 0;
      });
      return { debit: Math.round(d * 100) / 100, credit: Math.round(c * 100) / 100, diff: Math.abs(d - c) };
   }, [formData.items]);

   const addRow = () => {
      setFormData({
         ...formData,
         items: [
            ...formData.items,
            { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
         ],
      });
   };

   const removeRow = (index) => {
      if (formData.items.length <= 2) return;
      const newItems = [...formData.items];
      newItems.splice(index, 1);
      setFormData({ ...formData, items: newItems });
   };

   const updateRow = (index, field, value) => {
      const newItems = [...formData.items];
      newItems[index] = { ...newItems[index], [field]: value };
      setFormData({ ...formData, items: newItems });
   };

   const getRowIssues = (row) => {
      const acc = accountById.get(String(row.account_id));
      const issues = {};
      if (!acc) return issues;
      if (acc.is_title) issues.account = 'Cuenta título: no acepta movimientos';
      else if (acc.is_active === false) issues.account = 'Cuenta bloqueada';
      if (acc.require_rut && !String(row.counterparty_rut || '').trim()) issues.rut = 'RUT obligatorio';
      if (acc.require_reference && !String(row.description || '').trim()) issues.description = 'Glosa obligatoria';
      if (acc.cost_center_requirement === 'REQUIRED' && !String(row.cost_center || '').trim()) issues.cost_center = 'Centro de costo obligatorio';
      return issues;
   };

   const handleImportBankTx = async () => {
      const idStr = window.prompt("Ingrese el ID del movimiento bancario a importar:");
      if (!idStr) return;
      const txId = Number(idStr);
      if (!txId) {
         toast.error("ID inválido");
         return;
      }
      try {
         const { autofindCandidates, listReconciliations } = await import('../../services/reconcileApi');

         const [response, recons] = await Promise.all([
            autofindCandidates({ entityId, bank_transaction_id: txId, limit: 1 }),
            listReconciliations({ entityId, bank_transaction_id: txId, limit: 1 }).catch(() => null)
         ]);

         if (!response || !response.bank) {
            toast.error("No se encontró el movimiento con ese ID.");
            return;
         }

         const tx = response.bank;
         const amount = Number(tx.amount || 0);
         const type = amount >= 0 ? 'income' : 'expense';
         const absAmount = Math.abs(amount);
         const date = tx.issued_at ? tx.issued_at.substring(0, 10) : new Date().toISOString().substring(0, 10);

         let rut = '';
         let contrapartidaDesc = 'Contrapartida';
         let conceptText = `Importado: ${tx.description || ''}`;

         if (recons?.rows?.[0]?.document) {
            const doc = recons.rows[0].document;
            rut = doc.counterparty_rut;
            contrapartidaDesc = `Cancelación Fac. N° ${doc.folio} - ${doc.counterparty_name || ''}`;
            conceptText = `Pago/Cobro de Factura N° ${doc.folio} (${doc.counterparty_name || ''})`;
         } else if (response.best) {
            rut = response.best.counterparty_rut;
            contrapartidaDesc = `Sugerencia Fac. N° ${response.best.folio}`;
         }

         setFormData({
            ...formData,
            entry_date: date,
            concept: conceptText,
            items: [
               { account_id: '', description: tx.description || '', debit: type === 'income' ? absAmount : '', credit: type === 'expense' ? absAmount : '', counterparty_rut: rut, cost_center: '' },
               { account_id: '', description: contrapartidaDesc, debit: type === 'expense' ? absAmount : '', credit: type === 'income' ? absAmount : '', counterparty_rut: rut, cost_center: '' },
            ]
         });
         toast.success("Datos importados del banco.");
      } catch (e) {
         toast.error(e.message || "Error al importar el movimiento bancario");
      }
   };

   const handleSubmitManual = async (e) => {
      e.preventDefault();
      setModalErr(null);

      for (let i = 0; i < formData.items.length; i++) {
         const row = formData.items[i];
         if (!row.account_id) continue;
         const first = Object.values(getRowIssues(row))[0];
         if (first) {
            const acc = accountById.get(String(row.account_id));
            const msg = `Línea ${i + 1} (${acc.code} - ${acc.name}): ${first}.`;
            setModalErr(msg);
            toast.error(msg);
            return;
         }
      }

      if (modalTotals.diff > 0.05) {
         toast.error('El asiento no está cuadrado. La suma del Debe debe ser igual a la suma del Haber.');
         return;
      }

      const validItems = formData.items
         .filter((it) => it.account_id && ((Number(it.debit) || 0) > 0 || (Number(it.credit) || 0) > 0))
         .map((it) => ({
            account_id: Number(it.account_id),
            description: it.description || formData.concept,
            debit: Number(it.debit) || 0,
            credit: Number(it.credit) || 0,
            counterparty_rut: it.counterparty_rut || null,
            cost_center: it.cost_center || null,
         }));

      if (validItems.length < 2) {
         toast.error('Ingresa al menos 2 movimientos válidos con cuenta y monto.');
         return;
      }

      setSubmitting(true);
      setErr(null);
      try {
         await createEntry({
            entityId,
            entry_date: formData.entry_date,
            concept: formData.concept,
            source_type: 'MANUAL',
            items: validItems,
         });
         toast.success('Asiento contable registrado correctamente');
         setModalOpen(false);
         loadData();
      } catch (e) {
         const msg = e?.response?.data?.message || e?.message || 'Error al registrar asiento contable';
         setModalErr(msg);
         toast.error(msg);
      } finally {
         setSubmitting(false);
      }
   };

   // Paginación
   const totalEntries = entries.length;
   const totalPages = Math.ceil(totalEntries / pageSize) || 1;
   const paginatedEntries = useMemo(() => {
      const start = (page - 1) * pageSize;
      return entries.slice(start, start + pageSize);
   }, [entries, page, pageSize]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
         {/* ======================================================== */}
         {/* 1. Header: Breadcrumb, Título & Botones de Acción       */}
         {/* ======================================================== */}
         <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
               <div className="flex items-center gap-1.5 text-xs text-[#8E9BB5] font-medium mb-1">
                  <span>Contabilidad</span>
                  <span>›</span>
                  <span className="text-[#55607A]">Asientos contables</span>
               </div>
               <h1 className="text-2xl sm:text-3xl font-nunito font-black text-[#0A1A3F] tracking-tight">
                  Libro diario
               </h1>
               <p className="text-xs sm:text-sm text-[#55607A] font-medium mt-0.5">
                  Registro de tus asientos contables, en orden cronológico.
               </p>
            </div>

            {/* Botones de acción */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
               <button
                  type="button"
                  onClick={async () => {
                     try {
                        toast.loading("Generando asientos desde el SII...", { id: "sii-sync" });
                        const { generateSiiEntries } = await import('../../services/accountingApi');
                        const res = await generateSiiEntries({ entityId });
                        toast.success(`¡Listo! Se crearon ${res.createdCount || 0} asientos nuevos.`, { id: "sii-sync" });
                        loadData();
                     } catch (e) {
                        toast.error(e.message || "Error al sincronizar SII", { id: "sii-sync" });
                     }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-bold transition shadow-xs cursor-pointer"
               >
                  <ArrowPathIcon className="w-4 h-4 text-[#0A1A3F] stroke-[2]" />
                  <span>Sincronizar</span>
               </button>

               <button
                  type="button"
                  onClick={async () => {
                     if (!window.confirm("¿Estás seguro de eliminar permanentemente todos los asientos anulados? Esta acción no se puede deshacer.")) return;
                     try {
                        toast.loading("Limpiando asientos anulados...", { id: "clear-annulled" });
                        const res = await clearAnnulledEntries(entityId);
                        toast.success(`¡Limpieza completa! Se eliminaron ${res.deletedCount || 0} asientos anulados.`, { id: "clear-annulled" });
                        loadData();
                     } catch (e) {
                        toast.error(e.message || "Error al limpiar asientos anulados", { id: "clear-annulled" });
                     }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-bold transition shadow-xs cursor-pointer"
               >
                  <span>Limpiar anulados</span>
               </button>

               <button
                  type="button"
                  onClick={async () => {
                     if (!window.confirm("¡CUIDADO! Esto borrará absolutamente TODOS los asientos contables (incluyendo manuales). No afectará facturas, bancos ni conciliaciones. Podrás reconstruirlos con 'Sincronizar SII'. ¿Proceder?")) return;
                     try {
                        toast.loading("Borrando todos los asientos...", { id: "delete-all" });
                        const { deleteAllEntries } = await import('../../services/accountingApi');
                        const res = await deleteAllEntries(entityId);
                        toast.success(`¡Limpieza profunda completa! Se eliminaron ${res.deletedCount || 0} asientos.`, { id: "delete-all" });
                        loadData();
                     } catch (e) {
                        toast.error(e.message || "Error al borrar todos los asientos", { id: "delete-all" });
                     }
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-bold transition shadow-xs cursor-pointer"
               >
                  <TrashIcon className="w-4 h-4 text-[#0A1A3F] stroke-[2]" />
                  <span>Borrar todos</span>
               </button>

               <button
                  type="button"
                  onClick={() => {
                     setFormData({
                        entry_date: new Date().toISOString().substring(0, 10),
                        concept: '',
                        items: [
                           { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
                           { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
                        ],
                     });
                     setModalErr(null);
                     setModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] text-white text-xs font-bold transition shadow-xs cursor-pointer"
               >
                  <PlusIcon className="w-4 h-4 stroke-[2.5]" />
                  <span>Asiento manual</span>
               </button>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 2. Tarjeta de Filtros de Búsqueda                       */}
         {/* ======================================================== */}
         <div className="bg-white rounded-2xl border border-[#E2EAFD] p-5 shadow-xs space-y-4">
            {/* Header de la tarjeta de filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
               <div className="flex items-center gap-2 text-sm font-bold text-[#0A1A3F]">
                  <svg className="w-4 h-4 text-[#1F6BFF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                     <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                  </svg>
                  <span>Filtros de búsqueda</span>
               </div>
               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => {
                        setSearch('');
                        setSourceFilter('');
                        setStatusFilter('');
                        setMode('month');
                        setFilterMonth(todayYYYYMM());
                        setFromDate('');
                        setToDate('');
                        setPage(1);
                     }}
                     disabled={loading}
                     className="flex items-center gap-1.5 text-xs font-semibold text-[#8E9BB5] hover:text-[#0A1A3F] transition cursor-pointer disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-3.5 h-3.5" />
                     <span>Limpiar filtros</span>
                  </button>

                  <div className="inline-flex p-1 bg-[#F5F8FF] rounded-xl border border-[#E2EAFD] text-xs font-medium">
                     <button
                        type="button"
                        onClick={() => {
                           setMode('month');
                           setFromDate('');
                           setToDate('');
                           if (!filterMonth) setFilterMonth(todayYYYYMM());
                           setPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                           mode === 'month'
                              ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                        }`}
                     >
                        Por mes
                     </button>
                     <button
                        type="button"
                        onClick={() => {
                           setMode('range');
                           setFilterMonth('');
                           setPage(1);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs transition cursor-pointer ${
                           mode === 'range'
                              ? 'bg-white text-[#0A1A3F] font-bold shadow-xs'
                              : 'text-[#55607A] hover:text-[#0A1A3F] font-semibold'
                        }`}
                     >
                        Por rango
                     </button>
                  </div>
               </div>
            </div>

            {/* Inputs de filtros en 4 columnas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
               {/* 1. Concepto o glosa */}
               <div>
                  <label className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     Concepto o glosa
                  </label>
                  <div className="relative flex items-center">
                     <MagnifyingGlassIcon className="w-4 h-4 text-[#8E9BB5] absolute left-3.5 pointer-events-none" />
                     <input
                        type="text"
                        placeholder="Busca por glosa, N° o RUT"
                        className="w-full h-11 pl-10 pr-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder:text-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition"
                        value={search}
                        onChange={(e) => {
                           setSearch(e.target.value);
                           setPage(1);
                        }}
                     />
                  </div>
               </div>

               {/* 2. Mes de Operación o Rango */}
               <div>
                  <label className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     {mode === 'month' ? 'Mes de operación' : 'Rango de fechas'}
                  </label>
                  {mode === 'month' ? (
                     <div className="relative flex items-center">
                        <input
                           type="month"
                           disabled={loading}
                           className="w-full h-11 px-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition cursor-pointer"
                           value={filterMonth}
                           onChange={(e) => {
                              setFilterMonth(e.target.value);
                              setPage(1);
                           }}
                        />
                     </div>
                  ) : (
                     <div className="flex items-center gap-1.5">
                        <DateInput
                           disabled={loading}
                           className="w-full h-11 px-3 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] transition cursor-pointer"
                           value={fromDate}
                           onChange={(v) => {
                              setFromDate(v);
                              setPage(1);
                           }}
                           placeholder="Desde"
                        />
                        <span className="text-[#8E9BB5] font-bold text-xs">—</span>
                        <DateInput
                           disabled={loading}
                           className="w-full h-11 px-3 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] transition cursor-pointer"
                           value={toDate}
                           onChange={(v) => {
                              setToDate(v);
                              setPage(1);
                           }}
                           min={fromDate || undefined}
                           placeholder="Hasta"
                        />
                     </div>
                  )}
               </div>

               {/* 3. Origen */}
               <div>
                  <label className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     Origen
                  </label>
                  <select
                     className="w-full h-11 px-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition cursor-pointer"
                     value={sourceFilter}
                     onChange={(e) => {
                        setSourceFilter(e.target.value);
                        setPage(1);
                     }}
                  >
                     <option value="">Todos los orígenes</option>
                     <option value="MANUAL">Manual</option>
                     <option value="SII_PURCHASE">SII Compra</option>
                     <option value="SII_HONORARY">Honorarios SII</option>
                     <option value="SII_SALE">SII Venta</option>
                     <option value="BANK_MOVEMENT">Banco</option>
                  </select>
               </div>

               {/* 4. Estado */}
               <div>
                  <label className="block text-[11px] font-bold text-[#55607A] uppercase tracking-wider mb-1.5">
                     Estado
                  </label>
                  <select
                     className="w-full h-11 px-4 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] focus:border-[#1F6BFF] transition cursor-pointer"
                     value={statusFilter}
                     onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                     }}
                  >
                     <option value="">Todos</option>
                     <option value="POSTED">Vigentes</option>
                     <option value="ANNULLED">Anulados</option>
                  </select>
               </div>
            </div>
         </div>

         {/* ======================================================== */}
         {/* 3. Tarjetas KPI de Resumen (5 Cards Jeito)               */}
         {/* ======================================================== */}
         <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Total asientos */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 shadow-xs flex items-center gap-3.5">
               <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                  <BookOpenIcon className="w-5 h-5 stroke-[2.2]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-semibold">Total asientos</div>
                  <div className="font-nunito font-black text-xl text-[#0A1A3F] tracking-tight mt-0.5">
                     {stats.total}
                  </div>
               </div>
            </div>

            {/* Card 2: Total debe */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 shadow-xs flex items-center gap-3.5">
               <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                  <ArrowTrendingUpIcon className="w-5 h-5 stroke-[2.2]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-semibold">Total debe</div>
                  <div className="font-nunito font-black text-xl text-[#0A1A3F] tracking-tight mt-0.5">
                     {formatClp(stats.totalDebe)}
                  </div>
               </div>
            </div>

            {/* Card 3: Total haber */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 shadow-xs flex items-center gap-3.5">
               <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                  <ArrowTrendingDownIcon className="w-5 h-5 stroke-[2.2]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-semibold">Total haber</div>
                  <div className="font-nunito font-black text-xl text-[#0A1A3F] tracking-tight mt-0.5">
                     {formatClp(stats.totalHaber)}
                  </div>
               </div>
            </div>

            {/* Card 4: Asientos vigentes */}
            <div className="bg-white rounded-2xl border border-[#E2EAFD] p-4 shadow-xs flex items-center gap-3.5">
               <div className="w-10 h-10 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF] shrink-0">
                  <DocumentDuplicateIcon className="w-5 h-5 stroke-[2.2]" />
               </div>
               <div>
                  <div className="text-xs text-[#55607A] font-semibold">Asientos vigentes</div>
                  <div className="font-nunito font-black text-xl text-[#0A1A3F] tracking-tight mt-0.5">
                     {stats.vigentes}
                  </div>
               </div>
            </div>

            {/* Card 5: Debe y haber Cuadran (Vibrant Royal Blue) */}
            <div className={`col-span-2 lg:col-span-1 rounded-2xl p-4 shadow-xs flex items-center gap-3.5 text-white ${
               stats.cuadran ? 'bg-[#1F6BFF]' : 'bg-rose-600'
            }`}>
               <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white shrink-0">
                  <CheckIcon className="w-5 h-5 stroke-[3]" />
               </div>
               <div>
                  <div className="text-xs text-white/80 font-medium">Debe y haber</div>
                  <div className="font-nunito font-black text-xl text-white tracking-tight mt-0.5">
                     {stats.cuadran ? 'Cuadran' : 'Descuadre'}
                  </div>
               </div>
            </div>
         </div>

         {err && (
            <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl border border-rose-200 text-xs font-semibold">
               Error: {err}
            </div>
         )}

         {/* ======================================================== */}
         {/* 4. Tabla de Asientos Contables                          */}
         {/* ======================================================== */}
         <div className="bg-white rounded-3xl border border-[#E2EAFD] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
               <table className="w-full text-left text-xs border-collapse">
                  <thead>
                     <tr className="bg-[#F0F4FD] text-[#55607A] border-b border-[#E2EAFD]">
                        <th className="py-3 px-3 w-8 text-center"></th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A]">N° asiento</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A]">Fecha</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A]">Origen</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A]">Concepto / glosa</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A] text-right">Total debe</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A] text-right">Total haber</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A] text-center">Estado</th>
                        <th className="py-3 px-3 font-bold text-xs text-[#55607A] text-right pr-4">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F0F4FD] font-medium text-[#0A1A3F]">
                     {loading ? (
                        <tr>
                           <td colSpan={9} className="py-16 text-center">
                              <div className="flex flex-col items-center justify-center gap-3">
                                 <ArrowPathIcon className="w-8 h-8 animate-spin text-[#1F6BFF]" />
                                 <span className="text-xs text-[#55607A] font-medium">Cargando libro diario...</span>
                              </div>
                           </td>
                        </tr>
                     ) : paginatedEntries.length === 0 ? (
                        <tr>
                           <td colSpan={9} className="py-16 text-center text-[#8E9BB5] italic">
                              Sin asientos registrados. Ajusta los filtros de búsqueda.
                           </td>
                        </tr>
                     ) : (
                        paginatedEntries.map((entry) => {
                           const isExpanded = expandedIds.has(entry.id);
                           const isAnnulled = entry.status === 'ANNULLED';
                           const sourceInfo = getSourceInfo(entry);

                           return (
                              <React.Fragment key={entry.id}>
                                 {/* Fila Principal de Asiento */}
                                 <tr
                                    className={`hover:bg-[#F8FAFF] transition-colors cursor-pointer border-b border-[#F0F4FD] ${
                                       isAnnulled ? 'opacity-60 bg-gray-50/50' : 'bg-white'
                                    }`}
                                    onClick={() => toggleExpand(entry.id)}
                                 >
                                    <td className="py-3.5 px-3 text-[#8E9BB5] text-center">
                                       <div className="flex items-center justify-center">
                                          {isExpanded ? (
                                             <ChevronDownIcon className="w-4 h-4 stroke-[2.5]" />
                                          ) : (
                                             <ChevronRightIcon className="w-4 h-4 stroke-[2.5]" />
                                          )}
                                       </div>
                                    </td>
                                    <td className="py-3.5 px-3 font-bold text-[#0A1A3F] text-xs">
                                       #{entry.entry_number || entry.id}
                                    </td>
                                    <td className="py-3.5 px-3 text-[#55607A] text-xs whitespace-nowrap">
                                       {entry.entry_date}
                                    </td>
                                    <td className="py-3.5 px-3 whitespace-nowrap">
                                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EFF3FF] text-[#1F6BFF]">
                                          {sourceInfo.label}
                                       </span>
                                    </td>
                                    <td className="py-3.5 px-3 font-medium text-[#0A1A3F] text-xs">
                                       <span className="truncate max-w-sm block" title={entry.concept}>
                                          {entry.concept}
                                       </span>
                                    </td>
                                    <td className="py-3.5 px-3 text-right font-bold text-[#0A1A3F] text-xs tabular-nums whitespace-nowrap">
                                       {formatClp(entry.total_debit)}
                                    </td>
                                    <td className="py-3.5 px-3 text-right font-bold text-[#0A1A3F] text-xs tabular-nums whitespace-nowrap">
                                       {formatClp(entry.total_credit)}
                                    </td>
                                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                                       {isAnnulled ? (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-600">
                                             <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                                             Anulado
                                          </span>
                                       ) : (
                                          <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-[#EFF3FF] text-[#1F6BFF]">
                                             <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF]"></span>
                                             Vigente
                                          </span>
                                       )}
                                    </td>
                                    <td className="py-3.5 px-3 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                       <div className="flex items-center justify-end gap-1.5">
                                          <button
                                             type="button"
                                             onClick={() => {
                                                setFormData({
                                                   entry_date: entry.entry_date || new Date().toISOString().substring(0, 10),
                                                   concept: entry.concept || '',
                                                   items: entry.items?.length ? entry.items.map(it => ({
                                                      account_id: it.account_id || '',
                                                      description: it.description || '',
                                                      debit: it.debit || '',
                                                      credit: it.credit || '',
                                                      counterparty_rut: it.counterparty_rut || '',
                                                      cost_center: it.cost_center || '',
                                                   })) : [
                                                      { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
                                                      { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
                                                   ],
                                                });
                                                setModalErr(null);
                                                setModalOpen(true);
                                             }}
                                             className="p-1 rounded-lg text-[#8E9BB5] hover:text-[#0A1A3F] hover:bg-[#EEF3FF] transition cursor-pointer"
                                             title="Ver detalle / Editar copia"
                                          >
                                             <PencilSquareIcon className="w-4 h-4 stroke-[2]" />
                                          </button>
                                          {!isAnnulled && (
                                             <button
                                                type="button"
                                                onClick={() => handleAnnul(entry)}
                                                className="p-1 rounded-lg text-[#8E9BB5] hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                title="Anular asiento"
                                             >
                                                <TrashIcon className="w-4 h-4 stroke-[2]" />
                                             </button>
                                          )}
                                       </div>
                                    </td>
                                 </tr>

                                 {/* Sub-filas de Movimientos Contables (Alineadas pixel-perfect al diseño oficial Jeito) */}
                                 {isExpanded && (
                                    <>
                                       {entry.sii_document && (
                                          <tr className="bg-[#FAFBFD] border-b border-[#F0F4FD] text-xs">
                                             <td colSpan={3}></td>
                                             <td colSpan={6} className="py-2.5 px-3">
                                                <div className="inline-flex flex-wrap items-center gap-4 text-[11px] text-[#55607A] bg-white px-3 py-1.5 rounded-xl border border-[#E2EAFD] shadow-2xs">
                                                   <span><b className="text-[#0A1A3F]">Doc SII:</b> {entry.sii_document.document_type || 'DTE'} N° {entry.sii_document.folio}</span>
                                                   {entry.sii_document.net_amount != null && <span><b className="text-[#0A1A3F]">Neto:</b> {formatClp(entry.sii_document.net_amount)}</span>}
                                                   {entry.sii_document.tax_amount != null && <span><b className="text-[#0A1A3F]">IVA:</b> {formatClp(entry.sii_document.tax_amount)}</span>}
                                                   {entry.sii_document.total_amount != null && <span><b className="text-[#0A1A3F]">Total:</b> {formatClp(entry.sii_document.total_amount)}</span>}
                                                </div>
                                             </td>
                                          </tr>
                                       )}
                                       {entry.items?.map((it, idx) => {
                                          const acc = it.account || accountById.get(String(it.account_id));
                                          const accCode = acc?.code || it.account_code || '';
                                          const accName = acc?.name || it.description || '';
                                          const rut = it.counterparty_rut || '';
                                          const cc = it.cost_center || '';

                                          return (
                                             <tr
                                                key={it.id || idx}
                                                className="bg-[#FAFBFD] hover:bg-[#F2F6FE] transition-colors border-b border-[#F0F4FD]/80 text-xs"
                                             >
                                                <td colSpan={3}></td>
                                                {/* Columna Origen: Badge con código de cuenta */}
                                                <td className="py-2.5 px-3 whitespace-nowrap">
                                                   {accCode ? (
                                                      <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold bg-white text-[#0A1A3F] border border-[#E2EAFD] shadow-2xs">
                                                         {accCode}
                                                      </span>
                                                   ) : (
                                                      <span className="text-[#8E9BB5]">—</span>
                                                   )}
                                                </td>
                                                {/* Columna Concepto / glosa: Nombre de la cuenta */}
                                                <td className="py-2.5 px-3 font-medium text-[#55607A]">
                                                   <div className="flex items-center gap-2">
                                                      <span className="truncate max-w-sm block" title={accName}>
                                                         {accName || '—'}
                                                      </span>
                                                      {rut && (
                                                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#F0F4FD] text-[#55607A] font-mono shrink-0">
                                                            {rut}
                                                         </span>
                                                      )}
                                                      {cc && (
                                                         <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#EFF3FF] text-[#1F6BFF] font-semibold shrink-0">
                                                            CC: {cc}
                                                         </span>
                                                      )}
                                                   </div>
                                                </td>
                                                {/* Columna Total debe */}
                                                <td className="py-2.5 px-3 text-right font-medium text-[#55607A] tabular-nums whitespace-nowrap">
                                                   {Number(it.debit) > 0 ? formatClp(it.debit) : '—'}
                                                </td>
                                                {/* Columna Total haber */}
                                                <td className="py-2.5 px-3 text-right font-medium text-[#55607A] tabular-nums whitespace-nowrap">
                                                   {Number(it.credit) > 0 ? formatClp(it.credit) : '—'}
                                                </td>
                                                <td colSpan={2}></td>
                                             </tr>
                                          );
                                       })}
                                    </>
                                 )}
                              </React.Fragment>
                           );
                        })
                     )}
                  </tbody>
               </table>
            </div>

            {/* Paginación Oficial Jeito */}
            {!loading && totalEntries > 0 && (
               <div className="p-4 bg-white border-t border-[#F0F4FD] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="text-[#8E9BB5] font-medium">
                     Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalEntries)} de {totalEntries}
                  </div>
                  {totalPages > 1 && (
                     <div className="flex items-center gap-1.5 self-center sm:self-auto">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                           <button
                              key={p}
                              type="button"
                              onClick={() => setPage(p)}
                              className={`w-7 h-7 rounded-full text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                 page === p
                                    ? 'bg-[#1F6BFF] text-white shadow-xs'
                                    : 'text-[#55607A] hover:bg-[#EEF3FF] hover:text-[#0A1A3F]'
                              }`}
                           >
                              {p}
                           </button>
                        ))}
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* ======================================================== */}
         {/* 5. Modal Nuevo Asiento Manual                            */}
         {/* ======================================================== */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Asiento Contable Manual" maxWidth="max-w-4xl">
            <form onSubmit={handleSubmitManual} className="flex flex-col h-full max-h-[calc(90vh-4rem)]">
               <div className="p-4 overflow-y-auto space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div>
                        <label className="block text-xs font-semibold uppercase text-[#55607A] mb-1">Fecha</label>
                        <DateInput
                           required
                           className={ctrl}
                           value={formData.entry_date}
                           onChange={(v) => setFormData({ ...formData, entry_date: v })}
                        />
                     </div>
                     <div className="md:col-span-2">
                        <label className="block text-xs font-semibold uppercase text-[#55607A] mb-1">Concepto / Glosa General</label>
                        <input
                           type="text"
                           required
                           className={ctrl}
                           placeholder="Ej: Pago de arriendo del mes..."
                           value={formData.concept}
                           onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                        />
                     </div>
                  </div>

                  {modalErr && (
                     <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-xs font-semibold">
                        {modalErr}
                     </div>
                  )}

                  <div className="border border-[#E2EAFD] rounded-2xl overflow-hidden bg-white shadow-xs">
                     <div className="p-3 bg-[#F8FAFF] border-b border-[#E2EAFD] flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[#0A1A3F]">Movimientos (Debe / Haber)</h4>
                        <div className="flex items-center gap-3 text-xs font-bold">
                           <span className="text-[#0A1A3F]">Total Debe: {formatClp(modalTotals.debit)}</span>
                           <span className="text-[#0A1A3F]">Total Haber: {formatClp(modalTotals.credit)}</span>
                           {modalTotals.diff > 0.05 ? (
                              <span className="text-rose-600 bg-rose-50 px-2.5 py-0.5 rounded-full">
                                 Descuadre: {formatClp(modalTotals.diff)}
                              </span>
                           ) : (
                              <span className="text-[#1F6BFF] bg-[#EFF3FF] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                 <CheckIcon className="w-3.5 h-3.5 stroke-[3]" /> Cuadrado
                              </span>
                           )}
                        </div>
                     </div>
                     <div className="p-3 overflow-x-auto">
                        <table className="w-full text-xs">
                           <thead>
                              <tr className="text-[#55607A] border-b border-[#E2EAFD]">
                                 <th className="p-2 text-left font-bold w-1/3">Cuenta Contable</th>
                                 <th className="p-2 text-left font-bold">Glosa Línea</th>
                                 <th className="p-2 text-right font-bold w-28">Debe</th>
                                 <th className="p-2 text-right font-bold w-28">Haber</th>
                                 <th className="p-2 text-left font-bold w-28">RUT</th>
                                 <th className="p-2 text-center font-bold w-10"></th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-[#F0F4FD]">
                              {formData.items.map((it, idx) => (
                                 <tr key={idx} className="hover:bg-[#F8FAFF]">
                                    <td className="p-2">
                                       <select
                                          className="w-full h-9 px-2 text-xs rounded-lg border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                          value={it.account_id}
                                          onChange={(e) => updateRow(idx, 'account_id', e.target.value)}
                                       >
                                          <option value="">Selecciona cuenta...</option>
                                          {accounts.map((acc) => (
                                             <option key={acc.id} value={acc.id} disabled={acc.is_title}>
                                                {acc.code} - {acc.name}
                                             </option>
                                          ))}
                                       </select>
                                    </td>
                                    <td className="p-2">
                                       <input
                                          type="text"
                                          placeholder="Glosa..."
                                          className="w-full h-9 px-2 text-xs rounded-lg border border-[#E2EAFD] bg-white text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                          value={it.description}
                                          onChange={(e) => updateRow(idx, 'description', e.target.value)}
                                       />
                                    </td>
                                    <td className="p-2">
                                       <input
                                          type="number"
                                          step="any"
                                          placeholder="0"
                                          className="w-full h-9 px-2 text-xs rounded-lg border border-[#E2EAFD] bg-white text-[#0A1A3F] text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                          value={it.debit}
                                          onChange={(e) => updateRow(idx, 'debit', e.target.value)}
                                       />
                                    </td>
                                    <td className="p-2">
                                       <input
                                          type="number"
                                          step="any"
                                          placeholder="0"
                                          className="w-full h-9 px-2 text-xs rounded-lg border border-[#E2EAFD] bg-white text-[#0A1A3F] text-right font-mono focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                          value={it.credit}
                                          onChange={(e) => updateRow(idx, 'credit', e.target.value)}
                                       />
                                    </td>
                                    <td className="p-2">
                                       <input
                                          type="text"
                                          placeholder="12.345.678-9"
                                          className="w-full h-9 px-2 text-xs rounded-lg border border-[#E2EAFD] bg-white text-[#0A1A3F] font-mono focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                          value={it.counterparty_rut}
                                          onChange={(e) => updateRow(idx, 'counterparty_rut', e.target.value)}
                                       />
                                    </td>
                                    <td className="p-2 text-center">
                                       {formData.items.length > 2 && (
                                          <button
                                             type="button"
                                             onClick={() => removeRow(idx)}
                                             className="p-1 text-[#8E9BB5] hover:text-rose-600 transition cursor-pointer"
                                             title="Eliminar línea"
                                          >
                                             <TrashIcon className="w-4 h-4" />
                                          </button>
                                       )}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                     <div className="p-3 bg-[#FAFBFD] border-t border-[#E2EAFD] flex items-center justify-between">
                        <button
                           type="button"
                           onClick={addRow}
                           className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E2EAFD] bg-white hover:bg-[#EEF3FF] text-[#0A1A3F] text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                           <PlusIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                           <span>Agregar Línea</span>
                        </button>
                     </div>
                  </div>
               </div>

               <div className="p-4 border-t border-[#E2EAFD] bg-white flex items-center justify-end gap-3 shrink-0">
                  <button
                     type="button"
                     onClick={handleImportBankTx}
                     className="px-4 py-2.5 rounded-full border border-[#E2EAFD] bg-[#EFF3FF] hover:bg-[#DDE8FF] text-[#1F6BFF] text-xs font-bold transition cursor-pointer mr-auto"
                  >
                     Importar Movimiento Bancario
                  </button>
                  <button
                     type="button"
                     onClick={() => setModalOpen(false)}
                     className="px-5 py-2.5 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-bold transition cursor-pointer"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={submitting || modalTotals.diff > 0.05}
                     className="px-6 py-2.5 rounded-full bg-[#1F6BFF] hover:bg-[#1657D7] disabled:opacity-50 text-white text-xs font-bold shadow-xs transition cursor-pointer"
                  >
                     {submitting ? 'Guardando...' : 'Guardar Asiento'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}
