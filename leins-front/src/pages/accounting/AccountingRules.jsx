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

function RulesSummary({ rules }) {
   const stats = useMemo(() => {
      const accountsCount = new Set(rules.map((r) => r.account_id)).size;
      const costCentersCount = new Set(rules.map((r) => r.cost_center).filter(Boolean)).size;
      return { total: rules.length, accountsCount, costCentersCount };
   }, [rules]);

   return (
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-600 rounded-md">
               <DocumentDuplicateIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Reglas Configuradas</div>
               <div className="text-lg font-bold text-gray-900">{stats.total} RUTs</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-md">
               <TagIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Cuentas Mapeadas</div>
               <div className="text-lg font-bold text-gray-900">{stats.accountsCount} Cuentas</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-700 rounded-md">
               <BuildingStorefrontIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Centros de Costo</div>
               <div className="text-lg font-bold text-gray-900">{stats.costCentersCount} Centros</div>
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
      <div className="space-y-4">
         {/* Top Header Card */}
         <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Reglas de Asignación por RUT</h2>
                  <p className="text-xs text-gray-500 mt-1">
                     Define qué cuenta contable y centro de costo se imputan automáticamente al sincronizar documentos del SII.
                  </p>
               </div>
               <button
                  onClick={() => {
                     setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
                     setModalOpen(true);
                  }}
                  className="h-9 flex items-center justify-center gap-2 px-3 rounded border border-gray-800 bg-gray-800 text-white text-sm font-medium shadow-2xs hover:bg-gray-900 transition-colors cursor-pointer"
               >
                  <PlusIcon className="w-4 h-4 stroke-2" />
                  <span>Nueva Regla</span>
               </button>
            </div>

            {/* Filter Section */}
            <div className="space-y-3">
               <div className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <FunnelIcon className="w-4 h-4 text-gray-500" /> Filtros de Búsqueda
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start bg-gray-50/80 p-3 rounded-lg border border-gray-200">
                  <div className="space-y-1 md:col-span-12 relative">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Buscar por RUT o Nombre</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Buscar por RUT de proveedor/cliente o cuenta asignada..."
                           className={`${ctrl} pl-9`}
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
         {err && <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-xs font-medium">Error: {err}</div>}

         {/* Rules Table */}
         <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            {loading ? (
               <div className="p-8 text-center text-gray-500 font-medium text-sm flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-400" /> Cargando reglas de asociación...
               </div>
            ) : filteredRules.length === 0 ? (
               <div className="p-10 text-center text-gray-500">
                  <UserGroupIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-800">No hay reglas de asignación configuradas</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">Por defecto las compras se imputan a "Gastos Administrativos". Crea reglas para categorizarlas automáticamente.</p>
                  <button
                     onClick={() => {
                        setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
                        setModalOpen(true);
                     }}
                     className="h-9 px-4 rounded border border-gray-800 bg-gray-800 text-white text-xs font-medium mx-auto hover:bg-gray-900 transition-colors"
                  >
                     Crear Primera Regla
                  </button>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                     <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                        <tr>
                           <th className="py-2.5 px-3">RUT Proveedor / Cliente</th>
                           <th className="py-2.5 px-3">Razón Social / Nombre</th>
                           <th className="py-2.5 px-3">Cuenta Contable Destino</th>
                           <th className="py-2.5 px-3">Centro de Costo</th>
                           <th className="py-2.5 px-3 text-center">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-200">
                        {filteredRules.map((rule) => (
                           <tr key={rule.id} className="hover:bg-gray-50/80 transition-colors group">
                              <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{rule.counterparty_rut}</td>
                              <td className="py-2.5 px-3 font-medium text-gray-800">{rule.counterparty_name || '-'}</td>
                              <td className="py-2.5 px-3 font-medium text-gray-800">
                                 {rule.account ? (
                                    <div className="flex items-center gap-2">
                                       <span className="font-mono text-gray-900 font-bold">{rule.account.code}</span>
                                       <span>{rule.account.name}</span>
                                    </div>
                                 ) : (
                                    '-'
                                 )}
                              </td>
                              <td className="py-2.5 px-3 text-gray-500">
                                 {rule.cost_center ? (
                                    <Pill colorClass="bg-gray-100 text-gray-700 border-gray-200">{rule.cost_center}</Pill>
                                 ) : (
                                    <span className="text-gray-400 italic">No asignado</span>
                                 )}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                 <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                    <button
                                       onClick={() => handleDelete(rule)}
                                       className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition outline-none"
                                       title="Eliminar regla"
                                    >
                                       <TrashIcon className="w-4 h-4" />
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
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">RUT Proveedor / Cliente</label>
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
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Razón Social (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Servicios Eléctricos SpA"
                     className={ctrl}
                     value={formData.counterparty_name}
                     onChange={(e) => setFormData({ ...formData, counterparty_name: e.target.value })}
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Cuenta Contable Destino</label>
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
                  <label className="block text-xs font-semibold uppercase text-gray-600 mb-1">Centro de Costo (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Casa Matriz / Proyecto Alpha"
                     className={ctrl}
                     value={formData.cost_center}
                     onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                  />
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
                     disabled={submitting}
                     className="px-4 py-1.5 bg-gray-800 text-white text-xs font-medium rounded hover:bg-gray-900 transition disabled:opacity-50"
                  >
                     {submitting ? 'Guardando...' : 'Guardar Regla'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}

