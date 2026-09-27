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
   generateSiiEntries,
   getAccounts,
} from '../../services/accountingApi';
import {
   DocumentTextIcon,
   PlusIcon,
   SparklesIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
   ChevronDownIcon,
   ChevronRightIcon,
   TrashIcon,
   ArrowPathIcon,
   DocumentDuplicateIcon,
   BanknotesIcon,
   ChartBarIcon,
   CurrencyDollarIcon,
   ReceiptRefundIcon,
   CheckCircleIcon,
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl = 'w-full h-9 px-3 text-sm rounded border border-gray-300 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-400 transition-colors shadow-2xs';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-9 flex items-center justify-center gap-2 px-3 rounded border border-gray-300 bg-white text-gray-700 text-sm font-medium shadow-2xs hover:bg-gray-50 focus:outline-none transition-colors cursor-pointer';

function Pill({ children, colorClass = 'bg-gray-100 text-gray-700 border-gray-200' }) {
   return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
         {children}
      </span>
   );
}

function EntriesSummary({ entries }) {
   const stats = useMemo(() => {
      let totalDebe = 0;
      let totalHaber = 0;
      let countAnnulled = 0;
      for (const e of entries ?? []) {
         if (e.status === 'ANNULLED') {
            countAnnulled++;
         } else {
            totalDebe += Number(e.total_debit || 0);
            totalHaber += Number(e.total_credit || 0);
         }
      }
      return { totalCount: entries.length, totalDebe, totalHaber, countAnnulled, balance: totalDebe - totalHaber };
   }, [entries]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-600 rounded-md">
               <DocumentDuplicateIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Asientos</div>
               <div className="text-lg font-bold text-gray-900">{stats.totalCount}</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-md">
               <BanknotesIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Debe</div>
               <div className="text-lg font-bold text-gray-900">{clp(stats.totalDebe)}</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-md">
               <ChartBarIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Haber</div>
               <div className="text-lg font-bold text-gray-900">{clp(stats.totalHaber)}</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-600 rounded-md">
               <ReceiptRefundIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Anulados</div>
               <div className="text-lg font-bold text-gray-900">{stats.countAnnulled}</div>
            </div>
         </div>
         <div className="col-span-2 xl:col-span-1 rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-700 rounded-md">
               <CurrencyDollarIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Balance Mes</div>
               <div className="text-lg font-bold text-gray-900">{clp(stats.balance)}</div>
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
   const [generating, setGenerating] = useState(false);

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

   const handleGenerateSII = async () => {
      if (!window.confirm(`¿Deseas generar automáticamente los asientos contables para los documentos del periodo ${filterMonth}?`)) return;
      setGenerating(true);
      setErr(null);
      try {
         const res = await generateSiiEntries({
            entityId,
            month: filterMonth,
         });
         toast.success(`Generación SII completa: ${res.createdCount} asientos creados, ${res.skippedCount} ignorados por ya existir.`);
         loadData();
      } catch (e) {
         setErr(e.message || 'Error al generar asientos desde SII');
      } finally {
         setGenerating(false);
      }
   };

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

   const handleClearFilters = () => {
      setSearch('');
      setSourceFilter('');
      setStatusFilter('');
      const d = new Date();
      setFilterMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
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

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-4">
         {/* Top Header Card */}
         <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Libro Diario - Asientos Contables</h2>
                  <p className="text-xs text-gray-500 mt-1">Registro de movimientos contables, compras/ventas sincronizadas e impositivas.</p>
               </div>
               <div className="flex flex-wrap items-center gap-2">
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
                     className="h-9 flex items-center justify-center gap-2 px-3 rounded border border-gray-800 bg-gray-800 text-white text-sm font-medium shadow-2xs hover:bg-gray-900 transition-colors cursor-pointer"
                  >
                     <PlusIcon className="w-4 h-4 stroke-2" />
                     <span>Nuevo Asiento Manual</span>
                  </button>
               </div>
            </div>

            {/* Filter Section */}
            <div className="space-y-3">
               <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                     <FunnelIcon className="w-4 h-4 text-gray-500" /> Filtros de Búsqueda
                  </div>
                  <button
                     onClick={handleClearFilters}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-3.5 h-3.5" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-gray-50/80 p-3 rounded-lg border border-gray-200">
                  <div className="space-y-1 md:col-span-4 relative">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Concepto / Glosa</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Buscar por concepto o N° asiento..."
                           className={`${ctrl} pl-9`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1 md:col-span-3">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Mes de Operación</label>
                     <input
                        type="month"
                        className={ctrl}
                        value={filterMonth}
                        onChange={(e) => setFilterMonth(e.target.value)}
                     />
                  </div>
                  <div className="space-y-1 md:col-span-3">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Origen</label>
                     <select className={selectCtrl} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                        <option value="">Todos los orígenes</option>
                        <option value="MANUAL">Manual</option>
                        <option value="SII_PURCHASE">SII Compra</option>
                        <option value="SII_SALE">SII Venta</option>
                        <option value="BANK_MOVEMENT">Banco</option>
                     </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Estado</label>
                     <select className={selectCtrl} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="POSTED">Vigentes</option>
                        <option value="ANNULLED">Anulados</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Summary Cards */}
         <EntriesSummary entries={entries} />

         {/* Error Notice */}
         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Entries Table */}
         <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            {loading ? (
               <div className="p-8 text-center text-gray-500 font-medium text-sm flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-400" /> Cargando asientos contables...
               </div>
            ) : entries.length === 0 ? (
               <div className="p-10 text-center text-gray-500">
                  <DocumentTextIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-800">No se encontraron asientos contables</p>
                  <p className="text-xs text-gray-500 mt-1">No hay asientos contables registrados para el filtro seleccionado.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                     <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                        <tr>
                           <th className="py-2.5 px-3 w-8"></th>
                           <th className="py-2.5 px-3">N° Asiento</th>
                           <th className="py-2.5 px-3">Fecha</th>
                           <th className="py-2.5 px-3">Origen</th>
                           <th className="py-2.5 px-3">Concepto / Glosa</th>
                           <th className="py-2.5 px-3 text-right">Total Debe</th>
                           <th className="py-2.5 px-3 text-right">Total Haber</th>
                           <th className="py-2.5 px-3 text-center">Estado</th>
                           <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200">
                        {entries.map((entry) => {
                           const isExpanded = expandedEntryId === entry.id;
                           const isAnnulled = entry.status === 'ANNULLED';

                           return (
                              <React.Fragment key={entry.id}>
                                 <tr
                                    className={`hover:bg-gray-50/80 transition-colors cursor-pointer group ${
                                       isAnnulled ? 'opacity-60 bg-gray-50' : ''
                                    }`}
                                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                                 >
                                    <td className="py-2.5 px-3 text-gray-400">
                                       {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                                    </td>
                                    <td className="py-2.5 px-3 font-mono font-bold text-gray-900">#{entry.entry_number || entry.id}</td>
                                    <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{entry.entry_date}</td>
                                    <td className="py-2.5 px-3">
                                       <span className="inline-flex px-2 py-0.5 bg-gray-100 rounded text-[11px] font-medium text-gray-700 border border-gray-200">
                                          {entry.source_type === 'SII_PURCHASE' ? 'Compra SII' :
                                           entry.source_type === 'SII_SALE' ? 'Venta SII' :
                                           entry.source_type === 'BANK_MOVEMENT' ? 'Banco' :
                                           entry.source_type === 'MANUAL' ? 'Manual' : entry.source_type}
                                       </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-medium text-gray-800 truncate max-w-[280px]">{entry.concept}</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{clp(entry.total_debit)}</td>
                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{clp(entry.total_credit)}</td>
                                    <td className="py-2.5 px-3 text-center">
                                       <Pill
                                          colorClass={
                                             isAnnulled
                                                ? 'bg-gray-100 text-gray-500 border-gray-200 line-through'
                                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          }
                                       >
                                          {isAnnulled ? 'ANULADO' : 'VIGENTE'}
                                       </Pill>
                                    </td>
                                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                       {!isAnnulled && (
                                          <button
                                             onClick={() => handleAnnul(entry)}
                                             className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition outline-none"
                                             title="Anular asiento"
                                          >
                                             <TrashIcon className="w-4 h-4" />
                                          </button>
                                       )}
                                    </td>
                                 </tr>

                                 {/* Expanded Details */}
                                 {isExpanded && (
                                    <tr>
                                       <td colSpan={9} className="p-0 bg-gray-50/70">
                                          <div className="p-4 space-y-3 border-y border-gray-200">
                                             {entry.sii_document && (
                                                <div className="mb-3 p-3 rounded-md bg-white border border-gray-200 flex flex-wrap gap-5 items-center">
                                                   <div>
                                                      <span className="text-[10px] font-semibold uppercase text-gray-500 block">Tipo Doc SII</span>
                                                      <span className="text-xs font-semibold text-gray-800">{entry.sii_document.document_type}</span>
                                                   </div>
                                                   <div>
                                                      <span className="text-[10px] font-semibold uppercase text-gray-500 block">Folio</span>
                                                      <span className="text-xs font-mono font-bold text-gray-900">N° {entry.sii_document.folio}</span>
                                                   </div>
                                                   <div>
                                                      <span className="text-[10px] font-semibold uppercase text-gray-500 block">Monto Neto</span>
                                                      <span className="text-xs font-mono font-medium text-gray-800">{clp(entry.sii_document.net_amount)}</span>
                                                   </div>
                                                   <div>
                                                      <span className="text-[10px] font-semibold uppercase text-gray-500 block">IVA</span>
                                                      <span className="text-xs font-mono font-medium text-gray-800">{clp(entry.sii_document.tax_amount)}</span>
                                                   </div>
                                                   <div>
                                                      <span className="text-[10px] font-semibold uppercase text-gray-500 block">Total Documento</span>
                                                      <span className="text-xs font-mono font-bold text-gray-900">{clp(entry.sii_document.total_amount)}</span>
                                                   </div>
                                                </div>
                                             )}
                                             <h4 className="text-[11px] uppercase font-semibold text-gray-600 tracking-wider">
                                                Movimientos de Libro Diario (N° {entry.entry_number || entry.id})
                                             </h4>
                                             <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                                                <table className="min-w-full text-xs text-left">
                                                   <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200 uppercase tracking-wider">
                                                      <tr>
                                                         <th className="py-2 px-3">Código</th>
                                                         <th className="py-2 px-3">Cuenta Contable</th>
                                                         <th className="py-2 px-3">Descripción</th>
                                                         <th className="py-2 px-3">RUT Contraparte</th>
                                                         <th className="py-2 px-3">Centro Costo</th>
                                                         <th className="py-2 px-3 text-right">Debe</th>
                                                         <th className="py-2 px-3 text-right">Haber</th>
                                                      </tr>
                                                   </thead>
                                                   <tbody className="divide-y divide-gray-200">
                                                      {entry.items?.map((it) => (
                                                         <tr key={it.id} className="hover:bg-gray-50/80">
                                                            <td className="py-2 px-3 font-mono font-bold text-gray-900">
                                                               {it.account?.code || '-'}
                                                            </td>
                                                            <td className="py-2 px-3 font-medium text-gray-800">
                                                               {it.account?.name || '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-gray-600">{it.description || '-'}</td>
                                                            <td className="py-2 px-3 font-mono text-gray-600">
                                                               {it.counterparty_rut || '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-gray-600">{it.cost_center || '-'}</td>
                                                            <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
                                                               {Number(it.debit) > 0 ? clp(it.debit) : '-'}
                                                            </td>
                                                            <td className="py-2 px-3 text-right font-mono font-semibold text-gray-900">
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
            )}
         </div>

         {/* Create Manual Entry Modal */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo Asiento Contable Manual" maxWidth="max-w-4xl">
            <form onSubmit={handleSubmitManual} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Fecha</label>
                     <DateInput
                        required
                        className={ctrl}
                        value={formData.entry_date}
                        onChange={(v) => setFormData({ ...formData, entry_date: v })}
                     />
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Concepto / Glosa General</label>
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

               {/* Item Table */}
               <div className="space-y-3">
                  <div className="flex items-center justify-between">
                     <h4 className="text-xs uppercase font-bold text-text-soft">Movimientos (Debe y Haber)</h4>
                     <button
                        type="button"
                        onClick={addRow}
                        className="text-xs font-bold text-brand hover:underline flex items-center gap-1"
                     >
                        <PlusIcon className="w-4 h-4" /> Agregar Línea
                     </button>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-border-subtle">
                     <table className="min-w-full text-xs text-left">
                        <thead className="bg-surface-2 text-text-soft font-semibold">
                           <tr>
                              <th className="py-2.5 px-3">Cuenta Contable</th>
                              <th className="py-2.5 px-3">Detalle</th>
                              <th className="py-2.5 px-3">RUT Contraparte</th>
                              <th className="py-2.5 px-3 w-28 text-right">Debe ($)</th>
                              <th className="py-2.5 px-3 w-28 text-right">Haber ($)</th>
                              <th className="py-2.5 px-2 w-10 text-center"></th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle/50">
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
                                          className="text-text-soft hover:text-danger p-1"
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

               {/* Modal Totals Summary */}
               <div className="p-3.5 rounded-lg bg-gray-50 border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-4">
                     <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-semibold">Total Debe</span>
                        <span className="text-sm font-bold text-gray-900 font-mono">{clp(modalTotals.debit)}</span>
                     </div>
                     <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-semibold">Total Haber</span>
                        <span className="text-sm font-bold text-gray-900 font-mono">{clp(modalTotals.credit)}</span>
                     </div>
                  </div>

                  <div>
                     {modalTotals.diff === 0 ? (
                        <Pill colorClass="bg-emerald-50 text-emerald-700 border-emerald-200">
                           <CheckCircleIcon className="w-3.5 h-3.5 text-emerald-600" /> Asiento Cuadrado
                        </Pill>
                     ) : (
                        <Pill colorClass="bg-red-50 text-red-700 border-red-200">
                           Diferencia: {clp(modalTotals.diff)}
                        </Pill>
                     )}
                  </div>
               </div>

               <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                  <button
                     type="button"
                     onClick={() => setModalOpen(false)}
                     className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={submitting || modalTotals.diff > 0.05}
                     className="px-4 py-1.5 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-900 transition disabled:opacity-50"
                  >
                     {submitting ? 'Guardando...' : 'Guardar Asiento'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}
