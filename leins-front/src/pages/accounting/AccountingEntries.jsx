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
   getAccounts,
} from '../../services/accountingApi';
import {
   ChevronDownIcon,
   ChevronRightIcon,
   TrashIcon,
   PlusIcon,
   CheckCircleIcon,
} from '@heroicons/react/24/outline';

const clp = (n) =>
   new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(n || 0));

const ctrl = 'w-full h-9 px-3 text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--heading)] placeholder-[var(--text-soft)] focus:outline-none focus:border-[var(--brand)] transition-colors shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

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

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="animate-fade-in">
         {/* PANEL: Filtros */}
         <div
            className={[
               "relative bg-[var(--bg-content)] shadow-sm transition-all duration-300 ease-out origin-top",
               mostrarFiltros ? "z-[80] opacity-100 max-h-[1000px] py-3 px-4 space-y-3 scale-100 overflow-visible mb-4" : "z-0 opacity-0 max-h-0 p-0 pointer-events-none scale-[.98] overflow-hidden",
            ].join(" ")}
         >
            <h2 className="text-xl font-semibold text-[var(--heading)]">
               Libro Diario - Asientos Contables
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
               <div className="flex flex-col gap-1 md:col-span-2">
                  <label className="text-[12px] text-[var(--text-soft)]">Concepto / Glosa</label>
                  <input
                     type="text"
                     placeholder="Buscar por concepto o N° asiento..."
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] placeholder-[var(--text-soft)] focus:outline-none focus:border-[var(--brand)]"
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[var(--text-soft)]">Mes de Operación</label>
                  <input
                     type="month"
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] focus:outline-none focus:border-[var(--brand)]"
                     value={filterMonth}
                     onChange={(e) => setFilterMonth(e.target.value)}
                  />
               </div>
               <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[var(--text-soft)]">Origen</label>
                  <select
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] focus:outline-none focus:border-[var(--brand)] appearance-none"
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
               <div className="flex flex-col gap-1">
                  <label className="text-[12px] text-[var(--text-soft)]">Estado</label>
                  <select
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] focus:outline-none focus:border-[var(--brand)] appearance-none"
                     value={statusFilter}
                     onChange={(e) => setStatusFilter(e.target.value)}
                  >
                     <option value="">Todos los estados</option>
                     <option value="POSTED">Vigentes</option>
                     <option value="ANNULLED">Anulados</option>
                  </select>
               </div>
               <div className="flex items-end gap-2">
                  <button
                     disabled={loading}
                     className={`px-4 py-2 rounded-lg ${loading ? "opacity-60 cursor-not-allowed" : "bg-[var(--brand)] text-white hover:opacity-90"}`}
                     onClick={loadData}
                  >
                     {loading ? "Cargando…" : "Filtrar"}
                  </button>
               </div>
            </div>
         </div>

         {/* Toolbar y Tabs */}
         <div className="bg-[var(--bg-content)] py-2 px-4 shadow-sm mb-4">
            <div className="flex items-center justify-between gap-3">
               <div className="flex flex-wrap items-center gap-2" role="tablist">
                  <button className="px-3 py-2 rounded-lg flex items-center gap-2 bg-[var(--surface-2)] text-[var(--heading)]">
                     <span>Asientos</span>
                  </button>
               </div>
               <div className="flex items-center gap-2">
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
                     className="flex items-center gap-2 px-3 md:px-6 py-2.5 bg-[var(--brand)] text-white font-medium rounded-xl shadow-lg shadow-brand/20 hover:opacity-90 hover:-translate-y-0.5 transition-all"
                  >
                     <PlusIcon className="w-4 h-4 stroke-2" />
                     <span className="hidden xl:block">Asiento Manual</span>
                  </button>
                  <button type="button" onClick={() => setMostrarFiltros(v => !v)} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-1)]" title="Mostrar/Ocultar filtros">
                     🔍
                  </button>
               </div>
            </div>
         </div>

         {err && <div className="p-4 bg-[var(--danger)]/10 text-[var(--danger)] rounded-lg mb-4 text-sm font-medium">Error: {err}</div>}

         {/* Tabla de Asientos */}
         <div className={`bg-[var(--bg-content)] overflow-auto shadow-sm transition-all animate-fade-in ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <table className="min-w-full text-sm">
               <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--heading)]">
                  <tr className="text-left">
                     <th className="px-3 py-2 w-8"></th>
                     <th className="px-3 py-2">N° Asiento</th>
                     <th className="px-3 py-2">Fecha</th>
                     <th className="px-3 py-2">Origen</th>
                     <th className="px-3 py-2">Concepto / Glosa</th>
                     <th className="px-3 py-2 text-right">Total Debe</th>
                     <th className="px-3 py-2 text-right">Total Haber</th>
                     <th className="px-3 py-2 text-center">Estado</th>
                     <th className="px-3 py-2 text-right">Acciones</th>
                  </tr>
               </thead>
               <tbody>
                  {entries.length === 0 && (
                     <tr>
                        <td className="px-3 py-8 text-center text-[var(--text-soft)]" colSpan={9}>
                           Sin resultados. Ajusta filtros.
                        </td>
                     </tr>
                  )}
                  {entries.map((entry) => {
                     const isExpanded = expandedEntryId === entry.id;
                     const isAnnulled = entry.status === 'ANNULLED';

                     return (
                        <React.Fragment key={entry.id}>
                           <tr
                              className={`border-b border-[var(--border-subtle)] hover:bg-[var(--surface-1)] transition-colors cursor-pointer group ${
                                 isAnnulled ? 'opacity-60' : ''
                              }`}
                              onClick={() => setExpandedEntryId(isExpanded ? null : entry.id)}
                           >
                              <td className="px-3 py-2 text-[var(--text-soft)]">
                                 {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                              </td>
                              <td className="px-3 py-2 font-mono font-bold text-[var(--heading)]">#{entry.entry_number || entry.id}</td>
                              <td className="px-3 py-2 font-medium text-[var(--text-main)] whitespace-nowrap">{entry.entry_date}</td>
                              <td className="px-3 py-2">
                                 <span className="inline-flex px-2 py-0.5 bg-[var(--surface-2)] rounded-full text-[10px] font-medium text-[var(--text-main)] border border-[var(--border-subtle)]">
                                    {entry.source_type === 'SII_PURCHASE' ? 'Compra SII' :
                                     entry.source_type === 'SII_SALE' ? 'Venta SII' :
                                     entry.source_type === 'BANK_MOVEMENT' ? 'Banco' :
                                     entry.source_type === 'MANUAL' ? 'Manual' : entry.source_type}
                                 </span>
                              </td>
                              <td className="px-3 py-2 font-medium text-[var(--text-main)] truncate max-w-[280px]">{entry.concept}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-[var(--heading)]">{clp(entry.total_debit)}</td>
                              <td className="px-3 py-2 text-right font-mono font-bold text-[var(--heading)]">{clp(entry.total_credit)}</td>
                              <td className="px-3 py-2 text-center">
                                 <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                                    isAnnulled
                                       ? 'bg-[var(--surface-1)] text-[var(--text-soft)] border-[var(--border-subtle)] line-through'
                                       : 'bg-[var(--success)]/10 text-[var(--success)] border-[var(--success)]/20'
                                 }`}>
                                    {isAnnulled ? 'ANULADO' : 'VIGENTE'}
                                 </span>
                              </td>
                              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                                 {!isAnnulled && (
                                    <button
                                       onClick={() => handleAnnul(entry)}
                                       className="p-1 rounded text-[var(--text-soft)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition outline-none"
                                       title="Anular asiento"
                                    >
                                       <TrashIcon className="w-4 h-4" />
                                    </button>
                                 )}
                              </td>
                           </tr>

                           {isExpanded && (
                              <tr>
                                 <td colSpan={9} className="p-0 bg-[var(--surface-1)]">
                                    <div className="p-4 space-y-3 border-b border-[var(--border-subtle)]">
                                       {entry.sii_document && (
                                          <div className="mb-3 p-3 rounded-lg bg-[var(--bg-content)] border border-[var(--border-subtle)] flex flex-wrap gap-5 items-center">
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-[var(--text-soft)] block">Tipo Doc SII</span>
                                                <span className="text-xs font-semibold text-[var(--heading)]">{entry.sii_document.document_type}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-[var(--text-soft)] block">Folio</span>
                                                <span className="text-xs font-mono font-bold text-[var(--heading)]">N° {entry.sii_document.folio}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-[var(--text-soft)] block">Monto Neto</span>
                                                <span className="text-xs font-mono font-medium text-[var(--text-main)]">{clp(entry.sii_document.net_amount)}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-[var(--text-soft)] block">IVA</span>
                                                <span className="text-xs font-mono font-medium text-[var(--text-main)]">{clp(entry.sii_document.tax_amount)}</span>
                                             </div>
                                             <div>
                                                <span className="text-[10px] font-semibold uppercase text-[var(--text-soft)] block">Total Documento</span>
                                                <span className="text-xs font-mono font-bold text-[var(--heading)]">{clp(entry.sii_document.total_amount)}</span>
                                             </div>
                                          </div>
                                       )}
                                       <h4 className="text-[11px] uppercase font-semibold text-[var(--text-soft)] tracking-wider">
                                          Movimientos de Libro Diario (N° {entry.entry_number || entry.id})
                                       </h4>
                                       <div className="overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-content)]">
                                          <table className="min-w-full text-xs text-left">
                                             <thead className="bg-[var(--surface-2)] text-[var(--heading)] font-semibold uppercase tracking-wider">
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
                                             <tbody>
                                                {entry.items?.map((it, idx) => (
                                                   <tr key={it.id} className={`${idx !== (entry.items?.length - 1) ? 'border-b border-[var(--border-subtle)]' : ''} hover:bg-[var(--surface-1)]`}>
                                                      <td className="py-2 px-3 font-mono font-bold text-[var(--heading)]">
                                                         {it.account?.code || '-'}
                                                      </td>
                                                      <td className="py-2 px-3 font-medium text-[var(--text-main)]">
                                                         {it.account?.name || '-'}
                                                      </td>
                                                      <td className="py-2 px-3 text-[var(--text-soft)]">{it.description || '-'}</td>
                                                      <td className="py-2 px-3 font-mono text-[var(--text-soft)]">
                                                         {it.counterparty_rut || '-'}
                                                      </td>
                                                      <td className="py-2 px-3 text-[var(--text-soft)]">{it.cost_center || '-'}</td>
                                                      <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--heading)]">
                                                         {Number(it.debit) > 0 ? clp(it.debit) : '-'}
                                                      </td>
                                                      <td className="py-2 px-3 text-right font-mono font-semibold text-[var(--heading)]">
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
