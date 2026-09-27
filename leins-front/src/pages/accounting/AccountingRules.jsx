import { useState, useEffect, useCallback, useMemo } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import Modal from '../../components/Modal';
import { toast } from '../../components/Toaster';
import {
   getRules,
   upsertRule,
   deleteRule,
   getAccounts,
} from '../../services/accountingApi';
import {
   UserGroupIcon,
   PlusIcon,
   TrashIcon,
   ArrowPathIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
   DocumentDuplicateIcon,
   BuildingStorefrontIcon,
   TagIcon,
} from '@heroicons/react/24/outline';

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand';

function Pill({ children, colorClass = 'bg-brand/10 text-brand ring-brand/20' }) {
   return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ring-1 ${colorClass}`}>
         {children}
      </span>
   );
}

function RulesSummary({ rules }) {
   const stats = useMemo(() => {
      const accountsCount = new Set(rules.map((r) => r.account_id)).size;
      const costCentersCount = new Set(rules.map((r) => r.cost_center).filter(Boolean)).size;
      return { total: rules.length, accountsCount, costCentersCount };
   }, [rules]);

   return (
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl">
               <DocumentDuplicateIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Reglas Configuradas</div>
               <div className="text-xl font-bold text-heading">{stats.total} RUTs</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
               <TagIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Cuentas Mapeadas</div>
               <div className="text-xl font-bold text-heading">{stats.accountsCount} Cuentas</div>
            </div>
         </div>
         <div className="rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl">
               <BuildingStorefrontIcon className="w-6 h-6" />
            </div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Centros de Costo</div>
               <div className="text-xl font-bold text-brand">{stats.costCentersCount} Centros</div>
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

   const [modalOpen, setModalOpen] = useState(false);
   const [formData, setFormData] = useState({
      counterparty_rut: '',
      counterparty_name: '',
      account_id: '',
      cost_center: '',
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

      setSubmitting(true);
      setErr(null);
      try {
         await upsertRule({
            entityId,
            counterparty_rut: formData.counterparty_rut,
            counterparty_name: formData.counterparty_name,
            account_id: Number(formData.account_id),
            cost_center: formData.cost_center,
         });
         toast.success('Regla de asignación guardada correctamente');
         setModalOpen(false);
         loadRules();
      } catch (e) {
         setErr(e.message || 'Error al guardar la regla');
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
            (r.account && r.account.name.toLowerCase().includes(q))
      );
   }, [rules, search]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Top Header Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Reglas de Asignación por RUT</h2>
                  <p className="text-sm text-text-soft mt-1">
                     Define qué cuenta contable y centro de costo se imputan automáticamente al sincronizar documentos del SII.
                  </p>
               </div>
               <button
                  onClick={() => {
                     setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
                     setModalOpen(true);
                  }}
                  className={`${btnCtrl} bg-brand text-white hover:bg-brand-hover border-transparent`}
               >
                  <PlusIcon className="w-5 h-5 stroke-2" />
                  <span>Nueva Regla</span>
               </button>
            </div>

            {/* Filter Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-sm font-semibold text-text-main">
                  <FunnelIcon className="w-5 h-5 text-brand" /> Filtros de Búsqueda
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-12 relative">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Buscar por RUT o Nombre</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3.5 top-3 text-text-soft" />
                        <input
                           type="text"
                           placeholder="Buscar por RUT de proveedor/cliente o cuenta asignada..."
                           className={`${ctrl} pl-10`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* Summary Cards */}
         <RulesSummary rules={rules} />

         {/* Error Notice */}
         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Rules Table */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-10 text-center text-brand font-medium animate-pulse flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" /> Cargando reglas de asociación...
               </div>
            ) : filteredRules.length === 0 ? (
               <div className="p-12 text-center text-text-soft">
                  <UserGroupIcon className="w-12 h-12 mx-auto text-text-soft/50 mb-3" />
                  <p className="text-base font-semibold">No hay reglas de asignación configuradas</p>
                  <p className="text-sm mt-1 mb-4">Por defecto las compras se imputan a "Gastos Administrativos". Crea reglas para categorizarlas automáticamente.</p>
                  <button
                     onClick={() => {
                        setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
                        setModalOpen(true);
                     }}
                     className={`${btnCtrl} bg-brand text-white mx-auto`}
                  >
                     Crear Primera Regla
                  </button>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft font-semibold">
                        <tr>
                           <th className="p-4">RUT Proveedor / Cliente</th>
                           <th className="p-4">Razón Social / Nombre</th>
                           <th className="p-4">Cuenta Contable Destino</th>
                           <th className="p-4">Centro de Costo</th>
                           <th className="p-4 text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {filteredRules.map((rule) => (
                           <tr key={rule.id} className="hover:bg-brand/5 transition-colors group">
                              <td className="p-4 font-mono font-bold text-brand">{rule.counterparty_rut}</td>
                              <td className="p-4 font-medium text-heading">{rule.counterparty_name || '-'}</td>
                              <td className="p-4 font-medium text-heading">
                                 {rule.account ? (
                                    <div className="flex items-center gap-2">
                                       <span className="font-mono text-brand font-bold">{rule.account.code}</span>
                                       <span>{rule.account.name}</span>
                                    </div>
                                 ) : (
                                    '-'
                                 )}
                              </td>
                              <td className="p-4 text-text-soft">
                                 {rule.cost_center ? (
                                    <Pill colorClass="bg-purple-500/10 text-purple-600 ring-purple-500/20">{rule.cost_center}</Pill>
                                 ) : (
                                    <span className="text-text-soft/60 italic">No asignado</span>
                                 )}
                              </td>
                              <td className="p-4 text-center">
                                 <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button
                                       onClick={() => handleDelete(rule)}
                                       className="p-1.5 rounded-lg text-text-soft hover:text-danger hover:bg-danger/10 transition outline-none"
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
            )}
         </div>

         {/* Create Rule Modal */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Regla de Asignación por RUT" maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">RUT Proveedor / Cliente</label>
                  <input
                     type="text"
                     required
                     placeholder="Ej: 76.123.456-7"
                     className={ctrl}
                     value={formData.counterparty_rut}
                     onChange={(e) => setFormData({ ...formData, counterparty_rut: e.target.value })}
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Razón Social (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Servicios Eléctricos SpA"
                     className={ctrl}
                     value={formData.counterparty_name}
                     onChange={(e) => setFormData({ ...formData, counterparty_name: e.target.value })}
                  />
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

