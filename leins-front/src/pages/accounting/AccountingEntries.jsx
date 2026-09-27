import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import { usePeriod } from '../../context/PeriodContext';
import {
   getEntries,
   createEntry,
   annulEntry,
   generateSiiEntries,
   getAccounts,
} from '../../services/accountingApi';
import DateInput from '../../components/DateInput';
import {
   DocumentTextIcon,
   PlusIcon,
   SparklesIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
   XMarkIcon,
   CheckCircleIcon,
   ChevronDownIcon,
   ChevronRightIcon,
   TrashIcon,
   ArrowPathIcon,
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl =
   'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

export default function AccountingEntries() {
   const { entityId, ready } = useEntityRequired();
   const { period } = usePeriod();

   const [entries, setEntries] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [msg, setMsg] = useState(null);

   const [expandedEntryId, setExpandedEntryId] = useState(null);

   // Filtros
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

   // Modal Manual
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

   // Modal SII Generator
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
      setMsg(null);
      try {
         const res = await generateSiiEntries({
            entityId,
            month: filterMonth,
         });
         setMsg(`Generación SII completa: ${res.createdCount} asientos creados, ${res.skippedCount} ignorados por ya existir.`);
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
         setMsg(`Asiento N° ${entry.entry_number} anulado.`);
         loadData();
      } catch (e) {
         setErr(e.message || 'Error al anular asiento');
         setLoading(false);
      }
   };

   // Totales manual modal
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
         alert('El asiento no está cuadrado. La suma del Debe debe ser igual a la suma del Haber.');
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
         alert('Ingresa al menos 2 movimientos válidos con cuenta y monto.');
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
         setMsg('Asiento contable registrado correctamente');
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
      <div className="space-y-6">
         {/* Encabezado */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand/10 text-brand rounded-2xl">
                     <DocumentTextIcon className="w-7 h-7" />
                  </div>
                  <div>
                     <h2 className="text-2xl font-bold text-heading tracking-tight">Libro Diario - Asientos Contables</h2>
                     <p className="text-sm text-text-soft mt-0.5">Registro cronológico de movimientos contables.</p>
                  </div>
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={handleGenerateSII}
                     disabled={generating || loading}
                     className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand bg-brand/10 hover:bg-brand hover:text-white rounded-2xl transition disabled:opacity-50"
                  >
                     <SparklesIcon className="w-4 h-4" /> {generating ? 'Generando SII...' : 'Generar Asientos SII'}
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
                     className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-2xl shadow transition"
                  >
                     <PlusIcon className="w-4 h-4" /> Nuevo Asiento Manual
                  </button>
               </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
               <div className="md:col-span-4 relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3.5 top-3 text-text-soft" />
                  <input
                     type="text"
                     placeholder="Buscar por concepto o N° asiento..."
                     className={`${ctrl} pl-10`}
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
               <div className="md:col-span-3">
                  <input
                     type="month"
                     className={ctrl}
                     value={filterMonth}
                     onChange={(e) => setFilterMonth(e.target.value)}
                  />
               </div>
               <div className="md:col-span-3">
                  <select className={selectCtrl} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                     <option value="">Todos los origenes</option>
                     <option value="MANUAL">Manual</option>
                     <option value="SII_PURCHASE">SII Compra</option>
                     <option value="SII_SALE">SII Venta</option>
                     <option value="BANK_MOVEMENT">Banco</option>
                  </select>
               </div>
               <div className="md:col-span-2">
                  <select className={selectCtrl} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                     <option value="">Todos los estados</option>
                     <option value="POSTED">Vigentes</option>
                     <option value="ANNULLED">Anulados</option>
                  </select>
               </div>
            </div>
         </div>

         {/* Alertas */}
         {msg && (
            <div className="p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-200 flex items-center gap-3">
               <CheckCircleIcon className="w-5 h-5 shrink-0" />
               <span className="text-sm font-medium">{msg}</span>
            </div>
         )}
         {err && (
            <div className="p-4 bg-rose-50 text-rose-700 rounded-2xl border border-rose-200 flex items-center gap-3">
               <XMarkIcon className="w-5 h-5 shrink-0" />
               <span className="text-sm font-medium">{err}</span>
            </div>
         )}

         {/* Tabla de Asientos */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-10 text-center text-brand font-medium animate-pulse flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" /> Cargando asientos contables...
               </div>
            ) : entries.length === 0 ? (
               <div className="p-12 text-center text-text-soft">
                  <DocumentTextIcon className="w-12 h-12 mx-auto text-text-soft/50 mb-3" />
                  <p className="text-base font-semibold">No se encontraron asientos para los filtros seleccionados</p>
                  <p className="text-sm mt-1">Prueba haciendo clic en "Generar Asientos SII" para procesar las compras y ventas.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft text-xs uppercase font-semibold">
                        <tr>
                           <th className="p-4 w-10"></th>
                           <th className="p-4">N° Asiento</th>
                           <th className="p-4">Fecha</th>
                           <th className="p-4">Origen</th>
                           <th className="p-4">Concepto / Glosa</th>
                           <th className="p-4 text-right">Total Debe</th>
                           <th className="p-4 text-right">Total Haber</th>
                           <th className="p-4 text-center">Estado</th>
                           <th className="p-4 text-right">Acción</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {entries.map((entry) => {
                           const isExpanded = expandedEntryId === entry.id;
                           const isAnnulled = entry.status === 'ANNULLED';

                           return (
                              <React.Fragment key={entry.id}>
                                 <tr
                                    className={`hover:bg-brand/5 transition cursor-pointer ${
                                       isAnnulled ? 'opacity-60 bg-rose-50/20' : ''
                                    }`}
                                    onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                                 >
                                    <td className="p-4 text-text-soft">
                                       {isExpanded ? <ChevronDownIcon className="w-5 h-5" /> : <ChevronRightIcon className="w-5 h-5" />}
                                    </td>
                                    <td className="p-4 font-mono font-bold text-brand">#{entry.entry_number || entry.id}</td>
                                    <td className="p-4 font-medium text-heading whitespace-nowrap">{entry.entry_date}</td>
                                    <td className="p-4">
                                       <span className="text-xs px-2 py-0.5 rounded-full bg-surface-2 font-semibold text-text-soft border border-border-subtle">
                                          {entry.source_type}
                                       </span>
                                    </td>
                                    <td className="p-4 font-medium text-heading truncate max-w-[280px]">{entry.concept}</td>
                                    <td className="p-4 text-right font-mono font-semibold text-emerald-600">{clp(entry.total_debit)}</td>
                                    <td className="p-4 text-right font-mono font-semibold text-blue-600">{clp(entry.total_credit)}</td>
                                    <td className="p-4 text-center">
                                       <span
                                          className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                                             isAnnulled ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                          }`}
                                       >
                                          {isAnnulled ? 'ANULADO' : 'VIGENTE'}
                                       </span>
                                    </td>
                                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                       {!isAnnulled && (
                                          <button
                                             onClick={() => handleAnnul(entry)}
                                             className="text-xs text-rose-600 hover:text-rose-800 font-semibold underline"
                                          >
                                             Anular
                                          </button>
                                       )}
                                    </td>
                                 </tr>

                                 {/* Fila desplegable con detalle de movimientos */}
                                 {isExpanded && (
                                    <tr>
                                       <td colSpan={9} className="p-0 bg-surface-1">
                                          <div className="p-5 space-y-3 border-y border-border-subtle/80">
                                             <h4 className="text-xs uppercase font-bold text-text-soft tracking-wider">
                                                Movimientos del Asiento N° {entry.entry_number || entry.id}
                                             </h4>
                                             <div className="overflow-x-auto rounded-2xl border border-border-subtle bg-bg-content">
                                                <table className="min-w-full text-xs text-left">
                                                   <thead className="bg-surface-2 text-text-soft font-semibold border-b border-border-subtle">
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
                                                         <tr key={it.id} className="hover:bg-brand/5">
                                                            <td className="py-2.5 px-4 font-mono font-bold text-brand">
                                                               {it.account?.code || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 font-medium text-heading">
                                                               {it.account?.name || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-text-soft">{it.description || '-'}</td>
                                                            <td className="py-2.5 px-4 font-mono text-text-soft">
                                                               {it.counterparty_rut || '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-text-soft">{it.cost_center || '-'}</td>
                                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                                                               {Number(it.debit) > 0 ? clp(it.debit) : '-'}
                                                            </td>
                                                            <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-600">
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

         {/* Modal Crear Asiento Manual */}
         {modalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-bg-content rounded-3xl p-6 border border-border-subtle shadow-xl w-full max-w-4xl space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                     <h3 className="text-xl font-bold text-heading">Nuevo Asiento Contable Manual</h3>
                     <button onClick={() => setModalOpen(false)} className="text-text-soft hover:text-heading">
                        <XMarkIcon className="w-6 h-6" />
                     </button>
                  </div>

                  <form onSubmit={handleSubmitManual} className="space-y-4 overflow-y-auto pr-1 flex-1">
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

                     {/* Tabla dinámica de ítems */}
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

                     {/* Resumen Totales del Asiento */}
                     <div className="p-4 rounded-2xl bg-surface-1 border border-border-subtle flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-4">
                           <div>
                              <span className="text-xs text-text-soft block uppercase font-semibold">Total Debe</span>
                              <span className="text-base font-bold text-emerald-600 font-mono">{clp(modalTotals.debit)}</span>
                           </div>
                           <div>
                              <span className="text-xs text-text-soft block uppercase font-semibold">Total Haber</span>
                              <span className="text-base font-bold text-blue-600 font-mono">{clp(modalTotals.credit)}</span>
                           </div>
                        </div>

                        <div>
                           {modalTotals.diff === 0 ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                                 <CheckCircleIcon className="w-4 h-4" /> Asiento Cuadrado
                              </span>
                           ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                                 Diferencia: {clp(modalTotals.diff)}
                              </span>
                           )}
                        </div>
                     </div>

                     <div className="flex justify-end gap-3 pt-3 border-t border-border-subtle">
                        <button
                           type="button"
                           onClick={() => setModalOpen(false)}
                           className="px-4 py-2.5 text-sm font-semibold text-text-soft hover:bg-surface-2 rounded-2xl transition"
                        >
                           Cancelar
                        </button>
                        <button
                           type="submit"
                           disabled={submitting || modalTotals.diff > 0.05}
                           className="px-5 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-2xl shadow transition disabled:opacity-50"
                        >
                           {submitting ? 'Guardando...' : 'Guardar Asiento'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
}
