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
      ruts_text: '',
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

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!formData.account_id) return;
      
      const lines = formData.ruts_text.split('\n').map(l => l.trim()).filter(l => l);
      const ruts = lines.map(line => {
         // Si la línea contiene espacio, intentamos separar RUT y Nombre
         const match = line.match(/^([0-9kK.-]+)\s*(.*)$/);
         if (match) {
            return { rut: match[1].trim(), name: match[2].trim() };
         }
         return { rut: line, name: '' };
      });

      if (ruts.length === 0) {
         toast.error("Debe ingresar al menos un RUT");
         return;
      }

      setSubmitting(true);
      setErr(null);
      try {
         await upsertBulkRules({
            entityId,
            account_id: Number(formData.account_id),
            cost_center: formData.cost_center,
            ruts
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
      if (!search.trim()) return rules;
      const q = search.toLowerCase().trim();
      return rules.filter(
         (r) =>
            (r.counterparty_rut && r.counterparty_rut.toLowerCase().includes(q)) ||
            (r.counterparty_name && r.counterparty_name.toLowerCase().includes(q)) ||
            (r.account && r.account.name.toLowerCase().includes(q)) ||
            (r.account && r.account.type.toLowerCase().includes(q))
      );
   }, [rules, search]);

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
         return a.account.code.localeCompare(b.account.code, undefined, { numeric: true });
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
                        setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
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
                     <div className="overflow-x-auto">
                        <table className="min-w-full text-sm text-left">
                           <thead className="bg-surface-1 border-b border-border-subtle text-text-soft font-semibold text-xs uppercase tracking-wider">
                              <tr>
                                 <th className="p-3 pl-5">RUT</th>
                                 <th className="p-3">Razón Social / Nombre</th>
                                 <th className="p-3">Rol Contable</th>
                                 <th className="p-3">Centro de Costo</th>
                                 <th className="p-3 text-center">Acciones</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border-subtle/50">
                              {group.rules.map((rule) => (
                                 <tr key={rule.id} className="hover:bg-brand/5 transition-colors group/row">
                                    <td className="p-3 pl-5 font-mono font-bold text-heading whitespace-nowrap">{rule.counterparty_rut}</td>
                                    <td className="p-3 font-medium text-text-main">{rule.counterparty_name || '-'}</td>
                                    <td className="p-3">
                                       <Pill colorClass={getRoleColor(getRoleFromAccount(rule.account))}>
                                          {getRoleFromAccount(rule.account)}
                                       </Pill>
                                    </td>
                                    <td className="p-3 text-text-soft">
                                       {rule.cost_center ? (
                                          <Pill colorClass="bg-emerald-100 text-emerald-700 ring-emerald-200">
                                             {rule.cost_center}
                                          </Pill>
                                       ) : (
                                          <span className="italic text-xs text-text-soft/70">No asignado</span>
                                       )}
                                    </td>
                                    <td className="p-3 text-center">
                                       <div className="flex items-center justify-center opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity gap-1">
                                          <button
                                             onClick={() => handleDelete(rule)}
                                             className="p-1.5 rounded-lg text-text-soft hover:text-danger hover:bg-danger/10 transition outline-none focus:ring-2 focus:ring-danger"
                                             title="Eliminar regla"
                                          >
                                             <TrashIcon className="w-5 h-5" />
                                          </button>
                                       </div>
                                    </td>
                                 </tr>
                              ))}
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
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">2. RUTs a asociar (Uno por línea)</label>
                  <textarea
                     required
                     rows={8}
                     placeholder="Pega los RUTs aquí. Ej:&#10;76.123.456-7&#10;12.345.678-9 Nombre Opcional"
                     className="w-full p-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm font-mono"
                     value={formData.ruts_text}
                     onChange={(e) => setFormData({ ...formData, ruts_text: e.target.value })}
                  />
                  <p className="text-xs text-text-soft mt-1.5">
                     Ingresa un RUT por línea. Opcionalmente puedes agregar el nombre al lado separado por un espacio. <strong>Tip: Puedes copiar y pegar una columna entera desde Excel.</strong>
                  </p>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Cuenta Contable Destino</label>
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

