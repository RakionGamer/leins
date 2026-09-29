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
import { listTransactions } from '../../services/entitiesApi';
import {
   ChevronDownIcon,
   ChevronRightIcon,
   TrashIcon,
   PlusIcon,
   CheckCircleIcon,
   DocumentDuplicateIcon,
   BanknotesIcon,
   ChartBarIcon,
   BookOpenIcon,
   CurrencyDollarIcon,
   FunnelIcon,
   ArrowPathIcon,
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
}

const SOURCE_BADGES = {
   SII_PURCHASE: { label: 'Compra SII', colorClass: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30' },
   SII_SALE: { label: 'Venta SII', colorClass: 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30' },
   BANK_MOVEMENT: { label: 'Banco', colorClass: 'bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:ring-purple-500/30' },
   MANUAL: { label: 'Manual', colorClass: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30' },
};

function ResumenAsientos({ entries }) {
   const fmt = new Intl.NumberFormat('es-CL');
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
      return { total: entries?.length ?? 0, totalDebe, totalHaber, vigentes, anulados };
   }, [entries]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-5">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Asientos</div>
               <div className="text-xl font-bold text-heading">{stats.total}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl"><BanknotesIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Debe</div>
               <div className="text-xl font-bold text-heading">$ {fmt.format(stats.totalDebe)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl"><ChartBarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Haber</div>
               <div className="text-xl font-bold text-heading">$ {fmt.format(stats.totalHaber)}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl"><BookOpenIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Asientos Vigentes</div>
               <div className="text-xl font-bold text-heading">{stats.vigentes}</div>
            </div>
         </div>
         <div className="col-span-2 xl:col-span-1 rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><CurrencyDollarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Total Registrado</div>
               <div className="text-xl font-bold text-brand">$ {fmt.format(stats.totalDebe)}</div>
            </div>
         </div>
      </div>
   );
}

export default function AccountingEntries() {
   const { entityId, ready } = useEntityRequired();
   const { period } = usePeriod();

   const [entries, setEntries] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   const [expandedEntryId, setExpandedEntryId] = useState(null);

   const [filterMonth, setFilterMonth] = useState(() => {
      if (period?.year && period?.month) {
         return `${period.year}-${String(period.month).padStart(2, '0')}`;
      }
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
   });
   const [search, setSearch] = useState('');
   const [sourceFilter, setSourceFilter] = useState('');
   const [statusFilter, setStatusFilter] = useState('');

   const [mostrarFiltros, setMostrarFiltros] = useState(true);

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

   const loadData = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const [entriesData, accountsData] = await Promise.all([
            getEntries({
               entityId,
               month: filterMonth,
               source_type: sourceFilter,
               status: statusFilter,
               q: search,
            }),
            getAccounts({ entityId }),
         ]);

         setEntries(entriesData.rows || []);
         setAccounts(Array.isArray(accountsData) ? accountsData : []);
      } catch (e) {
         setErr(e.message || 'Error al cargar asientos contables');
      } finally {
         setLoading(false);
      }
   }, [entityId, filterMonth, sourceFilter, statusFilter, search]);

   useEffect(() => {
      if (ready && entityId) {
         loadData();
      }
   }, [ready, entityId, loadData]);

   const handleAnnul = async (entry) => {
      if (!window.confirm(`¿Seguro que deseas anular el asiento N° ${entry.entry_number}?`)) return;
      setLoading(true);
      try {
         await annulEntry(entry.id, entityId);
         toast.success(`Asiento N° ${entry.entry_number} anulado.`);
         loadData();
      } catch (e) {
         setErr(e.message || 'Error al anular asiento');
         setLoading(false);
      }
   };

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

   const handleSubmitManual = async (e) => {
      e.preventDefault();
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
         setErr(e.message || 'Error al registrar asiento contable');
      } finally {
         setSubmitting(false);
      }
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
         // En autofind, el type viene omitido, pero lo deducimos del amount
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
      } catch(e) {
          toast.error(e.message || "Error al importar el movimiento bancario");
      }
   };

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Libro Diario - Asientos Contables</h2>
                  <p className="text-sm text-text-soft mt-1">Registro cronológico de movimientos contables y transacciones financieras.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button
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
                     className="h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-semibold transition shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-200"
                  >
                     <ArrowPathIcon className="w-5 h-5 stroke-2" />
                     <span>Sincronizar SII</span>
                  </button>
                  <button
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
                     className="h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-semibold transition shadow-sm hover:bg-red-100 dark:hover:bg-red-500/20 focus:outline-none focus:ring-2 focus:ring-red-200"
                  >
                     <TrashIcon className="w-5 h-5 stroke-2" />
                     <span>Limpiar Anulados</span>
                  </button>
                  <button
                     onClick={() => {
                        setFormData({
                           entry_date: new Date().toISOString().substring(0, 10),
                           concept: '',
                           items: [
                              { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
                              { account_id: '', description: '', debit: '', credit: '', counterparty_rut: '', cost_center: '' },
                           ],
                        });
                        setModalOpen(true);
                     }}
                     className="h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-brand/20 bg-brand/5 text-brand text-sm font-semibold transition shadow-sm hover:bg-brand hover:text-white focus:outline-none focus:ring-2 focus:ring-brand cursor-pointer"
                  >
                     <PlusIcon className="w-5 h-5 stroke-2" />
                     <span>Asiento Manual</span>
                  </button>
               </div>
            </div>

            {/* Filter Section */}
            <div className="space-y-4">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                     <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
                  </div>
                  <button
                     onClick={() => { setSearch(''); setSourceFilter(''); setStatusFilter(''); loadData(); }}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-4 h-4" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Concepto / Glosa</label>
                     <input
                        type="text"
                        placeholder="Buscar por concepto o N° asiento..."
                        className={ctrl}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                     />
                  </div>
                  <div className="space-y-1.5 md:col-span-3">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Mes de Operación</label>
                     <input
                        type="month"
                        className={ctrl}
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                     />
                  </div>
                  <div className="space-y-1.5 md:col-span-3">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Origen</label>
                     <select
                        className={selectCtrl}
                        value={sourceFilter}
                        onChange={(e) => setSourceFilter(e.target.value)}
                     >
                        <option value="">Todos los orígenes</option>
                        <option value="MANUAL">Manual</option>
                        <option value="SII_PURCHASE">SII Compra</option>
                        <option value="SII_SALE">SII Venta</option>
                        <option value="BANK_MOVEMENT">Banco</option>
                     </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Estado</label>
                     <select
                        className={selectCtrl}
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                     >
                        <option value="">Todos</option>
                        <option value="POSTED">Vigentes</option>
                        <option value="ANNULLED">Anulados</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Resumen Tarjetas */}
         <ResumenAsientos entries={entries} />

         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Tabla de Asientos */}
         <div className={`bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden transition-all ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <div className="overflow-x-auto">
               <table className="min-w-full text-sm text-left">
                  <thead className="bg-surface-2 border-b border-border-subtle text-text-soft font-semibold">
                     <tr>
                        <th className="p-4 w-8"></th>
                        <th className="p-4 font-semibold">N° Asiento</th>
                        <th className="p-4 font-semibold">Fecha</th>
                        <th className="p-4 font-semibold">Origen</th>
                        <th className="p-4 font-semibold">Concepto / Glosa</th>
                        <th className="p-4 font-semibold text-right">Total Debe</th>
                        <th className="p-4 font-semibold text-right">Total Haber</th>
                        <th className="p-4 font-semibold text-center">Estado</th>
                        <th className="p-4 font-semibold text-center">Acciones</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle/50">
                     {entries.length === 0 ? (
                        <tr>
                           <td className="p-10 text-center text-text-soft italic" colSpan={9}>
                              Sin resultados. Ajusta filtros.
                           </td>
                        </tr>
                     ) : entries.map((entry) => {
                           const isExpanded = expandedEntryId === entry.id;
                           const isAnnulled = entry.status === 'ANNULLED';
                           const sourceInfo = SOURCE_BADGES[entry.source_type] || { label: entry.source_type, colorClass: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30' };

                           return (
                              <React.Fragment key={entry.id}>
                                 <tr
                                    className={`hover:bg-brand/5 transition-colors cursor-pointer group ${
                                       isAnnulled ? 'opacity-60' : ''
                                    }`}
                                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                                 >
                                    <td className="p-4 text-text-soft">
                                       {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                    </td>
                                    <td className="p-4 font-mono font-bold text-heading">#{entry.entry_number || entry.id}</td>
                                    <td className="p-4 font-medium text-text-main whitespace-nowrap">{entry.entry_date}</td>
                                    <td className="p-4">
                                       <Pill colorClass={sourceInfo.colorClass}>
                                          {sourceInfo.label}
                                       </Pill>
                                    </td>
                                    <td className="p-4 font-medium text-text-main truncate max-w-[280px]">{entry.concept}</td>
                                    <td className="p-4 text-right font-mono font-bold text-heading">{clp(entry.total_debit)}</td>
                                    <td className="p-4 text-right font-mono font-bold text-heading">{clp(entry.total_credit)}</td>
                                    <td className="p-4 text-center">
                                       <Pill colorClass={isAnnulled ? 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:ring-rose-500/30' : 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30'}>
                                          {isAnnulled ? 'ANULADO' : 'VIGENTE'}
                                       </Pill>
                                    </td>
                                    <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                                       {!isAnnulled && (
                                          <button
                                             onClick={() => handleAnnul(entry)}
                                             className="p-1.5 rounded-lg text-text-soft hover:text-danger hover:bg-danger/10 transition outline-none focus:ring-2 focus:ring-danger"
                                             title="Anular asiento"
                                          >
                                             <TrashIcon className="w-5 h-5" />
                                          </button>
                                       )}
                                    </td>
                                 </tr>

                           {isExpanded && (
                              <tr>
                                 <td colSpan={9} className="p-0 bg-surface-1">
                                    <div className="p-5 space-y-4 border-b border-border-subtle">
                                       {entry.sii_document && (
                                          <div className="p-4 rounded-2xl bg-bg-content border border-border-subtle flex flex-wrap gap-6 items-center">
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-text-soft block">Tipo Doc SII</span>
                                                <span className="text-xs font-semibold text-heading">{entry.sii_document.document_type}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-text-soft block">Folio</span>
                                                <span className="text-xs font-mono font-bold text-heading">N° {entry.sii_document.folio}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-text-soft block">Monto Neto</span>
                                                <span className="text-xs font-mono font-medium text-text-main">{clp(entry.sii_document.net_amount)}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-text-soft block">IVA</span>
                                                <span className="text-xs font-mono font-medium text-text-main">{clp(entry.sii_document.tax_amount)}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-text-soft block">Total Documento</span>
                                                <span className="text-xs font-mono font-bold text-heading">{clp(entry.sii_document.total_amount)}</span>
                                             </div>
                                          </div>
                                       )}
                                       <h4 className="text-xs uppercase font-bold text-text-soft tracking-wider">
                                          Movimientos de Libro Diario (N° {entry.entry_number || entry.id})
                                       </h4>
                                       <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-content">
                                          <table className="min-w-full text-xs text-left">
                                             <thead className="bg-surface-2 text-text-soft font-semibold uppercase tracking-wider">
                                                <tr>
                                                   <th className="py-2.5 px-4">Código</th>
                                                   <th className="py-2.5 px-4">Cuenta Contable</th>
                                                   <th className="py-2.5 px-4">Descripción</th>
                                                   <th className="py-2.5 px-4">RUT Contraparte</th>
                                                   <th className="py-2.5 px-4">Centro Costo</th>
                                                   <th className="py-2.5 px-4 text-right">Debe</th>
                                                   <th className="py-2.5 px-4 text-right">Haber</th>
                                                </tr>
                                             </thead>
                                             <tbody className="divide-y divide-border-subtle/50">
                                                {entry.items?.map((it) => (
                                                   <tr key={it.id} className="hover:bg-surface-1">
                                                      <td className="py-2.5 px-4 font-mono font-bold text-heading">
                                                         {it.account?.code || '-'}
                                                      </td>
                                                      <td className="py-2.5 px-4 font-medium text-text-main">
                                                         {it.account?.name || '-'}
                                                      </td>
                                                      <td className="py-2.5 px-4 text-text-soft">{it.description || '-'}</td>
                                                      <td className="py-2.5 px-4 font-mono text-text-soft">
                                                         {it.counterparty_rut || '-'}
                                                      </td>
                                                      <td className="py-2.5 px-4 text-text-soft">{it.cost_center || '-'}</td>
                                                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-heading">
                                                         {Number(it.debit) > 0 ? clp(it.debit) : '-'}
                                                      </td>
                                                      <td className="py-2.5 px-4 text-right font-mono font-semibold text-heading">
                                                         {Number(it.credit) > 0 ? clp(it.credit) : '-'}
                                                      </td>
                                                   </tr>
                                                ))}
                                             </tbody>
                                          </table>
                                       </div>
                                    </div>
                                 </td>
                              </tr>
                           )}
                        </React.Fragment>
                     );
                  })}
               </tbody>
            </table>
         </div>
      </div>

         {/* Modal Nuevo Asiento Manual */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Asiento Contable Manual" maxWidth="max-w-4xl">
            <form onSubmit={handleSubmitManual} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                     <label className="block text-xs font-semibold uppercase text-[var(--text-soft)] mb-1">Fecha</label>
                     <DateInput
                        required
                        className={ctrl}
                        value={formData.entry_date}
                        onChange={(v) => setFormData({ ...formData, entry_date: v })}
                     />
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-xs font-semibold uppercase text-[var(--text-soft)] mb-1">Concepto / Glosa General</label>
                     <input
                        type="text"
                        required
                        placeholder="Ej: Pago arriendo oficina septiembre"
                        className={ctrl}
                        value={formData.concept}
                        onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                     />
                  </div>
               </div>

               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <h4 className="text-xs uppercase font-bold text-[var(--text-soft)]">Movimientos (Debe y Haber)</h4>
                     <button
                        type="button"
                        onClick={addRow}
                        className="text-xs font-bold text-[var(--brand)] hover:underline flex items-center gap-1"
                     >
                        <PlusIcon className="w-4 h-4" /> Agregar Línea
                     </button>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
                     <table className="min-w-full text-xs text-left">
                        <thead className="bg-[var(--surface-2)] text-[var(--text-soft)] font-semibold">
                           <tr>
                              <th className="py-2.5 px-3">Cuenta Contable</th>
                              <th className="py-2.5 px-3">Detalle</th>
                              <th className="py-2.5 px-3">RUT Contraparte</th>
                              <th className="py-2.5 px-3 w-28 text-right">Debe ($)</th>
                              <th className="py-2.5 px-3 w-28 text-right">Haber ($)</th>
                              <th className="py-2.5 px-2 w-10 text-center"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[var(--border-subtle)]">
                           {formData.items.map((row, idx) => (
                              <tr key={idx}>
                                 <td className="p-2">
                                    <select
                                       required
                                       className={`${selectCtrl} h-9 text-xs`}
                                       value={row.account_id}
                                       onChange={(e) => updateRow(idx, 'account_id', e.target.value)}
                                    >
                                       <option value="">Seleccionar cuenta...</option>
                                       {accounts.map((acc) => (
                                          <option key={acc.id} value={acc.id}>
                                             {acc.code} - {acc.name} ({acc.type})
                                          </option>
                                       ))}
                                    </select>
                                 </td>
                                 <td className="p-2">
                                    <input
                                       type="text"
                                       placeholder="Glosa opcional"
                                       className={`${ctrl} h-9 text-xs`}
                                       value={row.description}
                                       onChange={(e) => updateRow(idx, 'description', e.target.value)}
                                    />
                                 </td>
                                 <td className="p-2">
                                    <input
                                       type="text"
                                       placeholder="12.345.678-9"
                                       className={`${ctrl} h-9 text-xs`}
                                       value={row.counterparty_rut}
                                       onChange={(e) => updateRow(idx, 'counterparty_rut', e.target.value)}
                                    />
                                 </td>
                                 <td className="p-2">
                                    <input
                                       type="number"
                                       min="0"
                                       step="any"
                                       placeholder="0"
                                       className={`${ctrl} h-9 text-xs text-right font-mono`}
                                       value={row.debit}
                                       onChange={(e) => updateRow(idx, 'debit', e.target.value)}
                                    />
                                 </td>
                                 <td className="p-2">
                                    <input
                                       type="number"
                                       min="0"
                                       step="any"
                                       placeholder="0"
                                       className={`${ctrl} h-9 text-xs text-right font-mono`}
                                       value={row.credit}
                                       onChange={(e) => updateRow(idx, 'credit', e.target.value)}
                                    />
                                 </td>
                                 <td className="p-2 text-center">
                                    {formData.items.length > 2 && (
                                       <button
                                          type="button"
                                          onClick={() => removeRow(idx)}
                                          className="text-[var(--text-soft)] hover:text-[var(--danger)] p-1"
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
               </div>

               <div className="p-3.5 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                     <div>
                        <span className="text-[10px] text-[var(--text-soft)] block uppercase font-semibold">Total Debe</span>
                        <span className="text-sm font-bold text-[var(--heading)] font-mono">{clp(modalTotals.debit)}</span>
                     </div>
                     <div>
                        <span className="text-[10px] text-[var(--text-soft)] block uppercase font-semibold">Total Haber</span>
                        <span className="text-sm font-bold text-[var(--heading)] font-mono">{clp(modalTotals.credit)}</span>
                     </div>
                  </div>

                  <div>
                     {modalTotals.diff === 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20">
                           <CheckCircleIcon className="w-3.5 h-3.5" /> Asiento Cuadrado
                        </span>
                     ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-[var(--danger)]/10 text-[var(--danger)] border-[var(--danger)]/20">
                           Diferencia: {clp(modalTotals.diff)}
                        </span>
                     )}
                  </div>
               </div>

               <div className="flex justify-end gap-2 pt-4 border-t border-[var(--border-subtle)]">
                  <button
                     type="button"
                     onClick={handleImportBankTx}
                     className="px-4 py-2 text-sm font-medium text-brand bg-brand/10 border border-brand/20 rounded-lg hover:bg-brand/20 transition mr-auto"
                  >
                     Importar Movimiento Bancario
                  </button>
                  <button
                     type="button"
                     onClick={() => setModalOpen(false)}
                     className="px-4 py-2 text-sm font-medium text-[var(--text-main)] bg-[var(--surface-1)] border border-[var(--border-subtle)] rounded-lg hover:bg-[var(--surface-2)] transition"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={submitting || modalTotals.diff > 0.05}
                     className="px-6 py-2 bg-[var(--brand)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                     {submitting ? 'Guardando...' : 'Guardar Asiento'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}
