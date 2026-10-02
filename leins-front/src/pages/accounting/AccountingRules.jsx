import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import Modal from '../../components/Modal';
import { toast } from '../../components/Toaster';
import {
   getRules,
   upsertRule,
   upsertBulkRules,
   deleteRule,
   getAccounts,
} from '../../services/accountingApi';
import {
   PlusIcon,
   TrashIcon,
   ArrowPathIcon,
   DocumentDuplicateIcon,
   TagIcon,
   BookOpenIcon,
   CurrencyDollarIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
   PencilIcon,
} from '@heroicons/react/24/outline';

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
}

function ResumenReglas({ rules }) {
   const stats = useMemo(() => {
      const ruts = new Set();
      const accounts = new Set();
      let costCenters = 0;

      for (const r of rules ?? []) {
         if (r.counterparty_rut) ruts.add(r.counterparty_rut);
         if (r.account_id) accounts.add(r.account_id);
         if (r.cost_center) costCenters++;
      }
      return { total: rules?.length ?? 0, ruts: ruts.size, accounts: accounts.size, costCenters };
   }, [rules]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Reglas</div>
               <div className="text-xl font-bold text-heading">{stats.total}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl"><TagIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">RUTs Configurados</div>
               <div className="text-xl font-bold text-heading">{stats.ruts}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl"><BookOpenIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Cuentas Asignadas</div>
               <div className="text-xl font-bold text-heading">{stats.accounts}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><CurrencyDollarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Centros de Costo</div>
               <div className="text-xl font-bold text-brand">{stats.costCenters}</div>
            </div>
         </div>
      </div>
   );
}

export default function AccountingRules() {
   const { entityId, ready } = useEntityRequired();

   const [rules, setRules] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [search, setSearch] = useState('');
   const [accountFilter, setAccountFilter] = useState('');
   const [roleFilter, setRoleFilter] = useState('');

   const clearFilters = () => {
      setSearch('');
      setAccountFilter('');
      setRoleFilter('');
      loadRules();
   };

   const [modalOpen, setModalOpen] = useState(false);
   const [formData, setFormData] = useState({
      account_id: '',
      cost_center: '',
      ruts: [{ rut: '', name: '' }],
   });
   const [submitting, setSubmitting] = useState(false);

   const loadRules = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const [rulesData, accountsData] = await Promise.all([
            getRules({ entityId }),
            getAccounts({ entityId }),
         ]);
         setRules(Array.isArray(rulesData) ? rulesData : []);
         setAccounts(Array.isArray(accountsData) ? accountsData : []);
      } catch (e) {
         setErr(e.message || 'Error al cargar reglas');
      } finally {
         setLoading(false);
      }
   }, [entityId]);

   useEffect(() => {
      if (ready && entityId) {
         loadRules();
      }
   }, [ready, entityId, loadRules]);

   const addRutRow = () => {
      setFormData(prev => ({ ...prev, ruts: [...prev.ruts, { rut: '', name: '' }] }));
   };
   
   const removeRutRow = (index) => {
      setFormData(prev => ({ ...prev, ruts: prev.ruts.filter((_, i) => i !== index) }));
   };

   const updateRutRow = (index, field, value) => {
      setFormData(prev => {
         const newRuts = [...prev.ruts];
         newRuts[index][field] = value;
         return { ...prev, ruts: newRuts };
      });
   };

   const handleEditGroup = (group) => {
      const ruts = group.rules.map(r => ({ rut: r.counterparty_rut || '', name: r.counterparty_name || '' }));
      setFormData({
         account_id: group.account ? group.account.id : '',
         cost_center: group.rules[0]?.cost_center || '',
         ruts: ruts.length ? ruts : [{ rut: '', name: '' }],
      });
      setModalOpen(true);
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.account_id) return;
      
      const ruts = formData.ruts.map(r => ({ rut: String(r.rut).trim(), name: String(r.name).trim() })).filter(r => r.rut);

      setSubmitting(true);
      setErr(null);
      try {
         await upsertBulkRules({
            entityId,
            account_id: Number(formData.account_id),
            cost_center: formData.cost_center,
            ruts,
            replace_account: true
         });
         toast.success(`Se guardaron ${ruts.length} reglas correctamente`);
         setModalOpen(false);
         loadRules();
      } catch (e) {
         setErr(e.message || 'Error al guardar las reglas');
      } finally {
         setSubmitting(false);
      }
   };

   const handleDelete = async (rule) => {
      if (!window.confirm(`¿Seguro que deseas eliminar la regla para ${rule.counterparty_rut}?`)) return;
      setLoading(true);
      try {
         await deleteRule(rule.id, entityId);
         toast.success('Regla eliminada correctamente');
         loadRules();
      } catch (e) {
         setErr(e.message || 'Error al eliminar regla');
         setLoading(false);
      }
   };

   const filteredRules = useMemo(() => {
      let result = rules;
      
      if (accountFilter) {
         result = result.filter(r => r.account_id && String(r.account_id) === accountFilter);
      }
      
      if (roleFilter) {
         result = result.filter(r => getRoleFromAccount(r.account) === roleFilter);
      }

      if (search.trim()) {
         const q = search.toLowerCase().trim();
         result = result.filter(
            (r) =>
               (r.counterparty_rut && r.counterparty_rut.toLowerCase().includes(q)) ||
               (r.counterparty_name && r.counterparty_name.toLowerCase().includes(q)) ||
               (r.account && r.account.name && r.account.name.toLowerCase().includes(q)) ||
               (r.account && r.account.code && r.account.code.toLowerCase().includes(q))
         );
      }
      return result;
   }, [rules, search, accountFilter, roleFilter]);

   const groupedRules = useMemo(() => {
      const groups = {};
      for (const rule of filteredRules) {
         const accId = rule.account_id || 'unassigned';
         if (!groups[accId]) {
            groups[accId] = {
               account: rule.account,
               rules: []
            };
         }
         groups[accId].rules.push(rule);
      }
      return Object.values(groups).sort((a, b) => {
         if (!a.account) return 1;
         if (!b.account) return -1;
         const codeA = a.account.code || '';
         const codeB = b.account.code || '';
         return codeA.localeCompare(codeB, undefined, { numeric: true });
      });
   }, [filteredRules]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Reglas de Asignación por RUT</h2>
                  <p className="text-sm text-text-soft mt-1">Automatice la imputación contable de documentos asociando RUTs a cuentas específicas.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={() => {
                        setFormData({ account_id: '', cost_center: '', ruts: [{ rut: '', name: '' }] });
                        setModalOpen(true);
                     }}
                     className={`${btnCtrl} text-brand border-brand/20 bg-brand/5`}
                     title="Crear nueva regla de asignación"
                  >
                     <PlusIcon className="w-5 h-5 stroke-2" />
                     <span>Nueva Regla</span>
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
                     onClick={clearFilters}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-4 h-4" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-4 relative">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Buscar por RUT o Nombre</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-text-soft/70" />
                        <input
                           type="text"
                           placeholder="Buscar RUT, nombre, cuenta..."
                           className={`${ctrl} pl-10`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Filtrar por Cuenta Contable</label>
                     <select 
                        className={selectCtrl}
                        value={accountFilter}
                        onChange={(e) => setAccountFilter(e.target.value)}
                     >
                        <option value="">Todas las cuentas</option>
                        {accounts.map(acc => (
                           <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                        ))}
                     </select>
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Rol (Tipo de Entidad)</label>
                     <select 
                        className={selectCtrl}
                        value={roleFilter}
                        onChange={(e) => setRoleFilter(e.target.value)}
                     >
                        <option value="">Todos los roles</option>
                        <option value="Cliente">Cliente</option>
                        <option value="Proveedor">Proveedor</option>
                        <option value="Prestador de Servicios (BH)">Prestador de Servicios (BH)</option>
                        <option value="Colaborador (Liq)">Colaborador (Liq)</option>
                        <option value="Otro">Otro</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Resumen Tarjetas */}
         <ResumenReglas rules={rules} />

         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Rules Table Grouped */}
         <div className={`space-y-6 transition-all ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            {groupedRules.length === 0 ? (
               <div className="bg-bg-content rounded-3xl border border-border-subtle p-10 text-center text-text-soft italic shadow-sm">
                  Sin resultados. Ajusta filtros o crea nuevas reglas.
               </div>
            ) : (
               groupedRules.map((group, index) => (
                  <div key={index} className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
                     <div className="bg-surface-2 border-b border-border-subtle p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                           {group.account ? (
                              <>
                                 <Pill colorClass="bg-brand/10 text-brand ring-brand/20">
                                    {group.account.code}
                                 </Pill>
                                 <h3 className="font-bold text-heading text-lg">{group.account.name}</h3>
                                 <Pill colorClass="bg-slate-100 text-slate-700 ring-slate-200">
                                    {group.account.type}
                                 </Pill>
                              </>
                           ) : (
                              <h3 className="font-bold text-heading text-lg">Sin Cuenta Asignada</h3>
                           )}
                        </div>
                        <div className="text-sm text-text-soft font-medium">
                           {group.rules.length} RUT(s)
                        </div>
                     </div>
                     <div className="overflow-x-auto p-4">
                        <table className="min-w-full text-sm text-left">
                           <thead className="bg-surface-1 border-b border-border-subtle text-text-soft font-semibold text-xs uppercase tracking-wider">
                              <tr>
                                 <th className="p-3 pl-5 w-1/2">Proveedores / RUTs Asociados</th>
                                 <th className="p-3">Centro de Costo</th>
                                 <th className="p-3 text-center">Rol Inferido</th>
                                 <th className="p-3 text-center">Acciones</th>
                              </tr>
                           </thead>
                           <tbody>
                              <tr className="hover:bg-brand/5 transition-colors group/row">
                                 <td className="p-3 pl-5">
                                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-2">
                                       {group.rules.map((rule) => (
                                          <div key={rule.id} className="text-xs text-text-main">
                                             <span className="font-mono font-bold">{rule.counterparty_rut}</span> 
                                             {rule.counterparty_name ? <span className="text-text-soft ml-1">- {rule.counterparty_name}</span> : ''}
                                          </div>
                                       ))}
                                    </div>
                                 </td>
                                 <td className="p-3 text-text-soft">
                                    {group.rules[0]?.cost_center ? (
                                       <Pill colorClass="bg-emerald-100 text-emerald-700 ring-emerald-200">
                                          {group.rules[0].cost_center}
                                       </Pill>
                                    ) : (
                                       <span className="italic text-xs text-text-soft/70">No asignado</span>
                                    )}
                                 </td>
                                 <td className="p-3 text-center">
                                    <Pill colorClass={getRoleColor(getRoleFromAccount(group.account))}>
                                       {getRoleFromAccount(group.account)}
                                    </Pill>
                                 </td>
                                 <td className="p-3 text-center">
                                    <div className="flex items-center justify-center gap-2">
                                       <button
                                          onClick={() => handleEditGroup(group)}
                                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-text-soft border border-border-subtle hover:text-brand hover:border-brand/30 hover:bg-brand/5 transition text-xs font-semibold shadow-sm"
                                          title="Editar grupo"
                                       >
                                          <PencilIcon className="w-4 h-4" /> Editar Grupo
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           </tbody>
                        </table>
                     </div>
                  </div>
               ))
            )}
         </div>

         {/* Create Rule Modal */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Asignación Masiva de RUTs a Cuenta" maxWidth="max-w-xl">
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">1. Cuenta Contable Destino</label>
                  <select
                     required
                     className={selectCtrl}
                     value={formData.account_id}
                     onChange={(e) => setFormData({ ...formData, account_id: e.target.value })}
                  >
                     <option value="">Seleccionar cuenta...</option>
                     {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                           {acc.code} - {acc.name} ({acc.type})
                        </option>
                     ))}
                  </select>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-2">2. RUTs y Razones Sociales</label>
                  <div className="space-y-3 max-h-60 overflow-y-auto p-1 pr-2">
                     {formData.ruts.map((r, i) => (
                        <div key={i} className="flex gap-2 items-center">
                           <input 
                              type="text" 
                              placeholder="RUT" 
                              required
                              className={`${ctrl} w-1/3 font-mono`} 
                              value={r.rut} 
                              onChange={e => updateRutRow(i, 'rut', e.target.value)} 
                           />
                           <input 
                              type="text" 
                              placeholder="Razón Social (Opcional)" 
                              className={`${ctrl} w-2/3`} 
                              value={r.name} 
                              onChange={e => updateRutRow(i, 'name', e.target.value)} 
                           />
                           <button 
                              type="button" 
                              onClick={() => removeRutRow(i)} 
                              className="p-2 text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition"
                           >
                              <TrashIcon className="w-5 h-5" />
                           </button>
                        </div>
                     ))}
                  </div>
                  <button 
                     type="button" 
                     onClick={addRutRow} 
                     className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-brand-hover bg-brand/10 hover:bg-brand/20 px-3 py-1.5 rounded-lg transition"
                  >
                     <PlusIcon className="w-4 h-4" /> Agregar otro RUT
                  </button>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Centro de Costo (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Casa Matriz / Proyecto Alpha"
                     className={ctrl}
                     value={formData.cost_center}
                     onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                  />
               </div>

               <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                  <button
                     type="button"
                     onClick={() => setModalOpen(false)}
                     className="px-4 py-2 text-text-soft font-medium hover:text-text-main hover:bg-surface-2 rounded-xl transition"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={submitting}
                     className="px-5 py-2 bg-brand text-white font-semibold rounded-xl hover:bg-brand-hover shadow-sm transition disabled:opacity-50"
                  >
                     {submitting ? 'Guardando...' : 'Guardar Regla'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}

