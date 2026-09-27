import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
import Modal from '../../components/Modal';
import { toast } from '../../components/Toaster';
import {
   getAccounts,
   createAccount,
   updateAccount,
   deleteAccount,
   seedDefaultPlan,
} from '../../services/accountingApi';
import {
   BookOpenIcon,
   PlusIcon,
   SparklesIcon,
   PencilSquareIcon,
   TrashIcon,
   ArrowPathIcon,
   FunnelIcon,
   MagnifyingGlassIcon,
   DocumentDuplicateIcon,
   BanknotesIcon,
   ChartBarIcon,
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

const TYPE_BADGES = {
   ACTIVO: 'bg-emerald-50 text-emerald-700 border-emerald-200',
   PASIVO: 'bg-amber-50 text-amber-700 border-amber-200',
   PATRIMONIO: 'bg-purple-50 text-purple-700 border-purple-200',
   INGRESOS: 'bg-blue-50 text-blue-700 border-blue-200',
   COSTOS: 'bg-orange-50 text-orange-700 border-orange-200',
   GASTOS: 'bg-gray-100 text-gray-700 border-gray-200',
};

function AccountsSummary({ accounts }) {
   const counts = useMemo(() => {
      const res = { total: accounts.length, activo: 0, pasivo: 0, patrimonio: 0, ingresos: 0, gastos: 0 };
      for (const a of accounts) {
         if (a.type === 'ACTIVO') res.activo++;
         else if (a.type === 'PASIVO') res.pasivo++;
         else if (a.type === 'PATRIMONIO') res.patrimonio++;
         else if (a.type === 'INGRESOS') res.ingresos++;
         else res.gastos++;
      }
      return res;
   }, [accounts]);

   return (
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-600 rounded-md">
               <DocumentDuplicateIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total Cuentas</div>
               <div className="text-lg font-bold text-gray-900">{counts.total}</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-emerald-50 text-emerald-700 rounded-md">
               <BanknotesIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Activos</div>
               <div className="text-lg font-bold text-gray-900">{counts.activo}</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700 rounded-md">
               <ChartBarIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Pasivo / Patr.</div>
               <div className="text-lg font-bold text-gray-900">{counts.pasivo + counts.patrimonio}</div>
            </div>
         </div>
         <div className="rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-700 rounded-md">
               <TagIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Ingresos</div>
               <div className="text-lg font-bold text-gray-900">{counts.ingresos}</div>
            </div>
         </div>
         <div className="col-span-2 xl:col-span-1 rounded-lg border border-gray-200 bg-white p-3.5 shadow-2xs flex items-center gap-3">
            <div className="p-2.5 bg-gray-100 text-gray-700 rounded-md">
               <BookOpenIcon className="w-5 h-5" />
            </div>
            <div>
               <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Gastos y Costos</div>
               <div className="text-lg font-bold text-gray-900">{counts.gastos}</div>
            </div>
         </div>
      </div>
   );
}

export default function AccountingAccounts() {
   const { entityId, ready } = useEntityRequired();

   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);

   const [search, setSearch] = useState('');
   const [filterType, setFilterType] = useState('');

   const [modalOpen, setModalOpen] = useState(false);
   const [editingAccount, setEditingAccount] = useState(null);

   const [formData, setFormData] = useState({
      code: '',
      name: '',
      type: 'GASTOS',
      nature: 'DEUDORA',
      cost_center_requirement: 'NONE',
   });
   const [submitting, setSubmitting] = useState(false);

   const loadAccounts = useCallback(async () => {
      if (!entityId) return;
      setLoading(true);
      setErr(null);
      try {
         const data = await getAccounts({ entityId, type: filterType, q: search });
         setAccounts(Array.isArray(data) ? data : []);
      } catch (e) {
         setErr(e.message || 'Error al cargar plan de cuentas');
      } finally {
         setLoading(false);
      }
   }, [entityId, filterType, search]);

   useEffect(() => {
      if (ready && entityId) {
         loadAccounts();
      }
   }, [ready, entityId, loadAccounts]);

   const handleSeed = async () => {
      setLoading(true);
      setErr(null);
      try {
         const res = await seedDefaultPlan({ entityId });
         toast.success(res.created ? `Se crearon ${res.created} cuentas base correctamente.` : 'El plan de cuentas base ya está listo.');
         await loadAccounts();
      } catch (e) {
         setErr(e.message || 'No se pudo poblar el plan de cuentas');
         setLoading(false);
      }
   };

   const openCreateModal = () => {
      setEditingAccount(null);
      setFormData({
         code: '',
         name: '',
         type: 'GASTOS',
         nature: 'DEUDORA',
         cost_center_requirement: 'NONE',
      });
      setModalOpen(true);
   };

   const openEditModal = (acc) => {
      setEditingAccount(acc);
      setFormData({
         code: acc.code,
         name: acc.name,
         type: acc.type,
         nature: acc.nature,
         cost_center_requirement: acc.cost_center_requirement || 'NONE',
      });
      setModalOpen(true);
   };

   const handleSubmit = async (e) => {
      e.preventDefault();
      setSubmitting(true);
      setErr(null);
      try {
         if (editingAccount) {
            await updateAccount(editingAccount.id, {
               name: formData.name,
               type: formData.type,
               nature: formData.nature,
               cost_center_requirement: formData.cost_center_requirement,
            });
            toast.success('Cuenta actualizada correctamente');
         } else {
            await createAccount({
               entityId,
               ...formData,
            });
            toast.success('Cuenta creada correctamente');
         }
         setModalOpen(false);
         loadAccounts();
      } catch (e) {
         setErr(e.message || 'Error al guardar la cuenta');
      } finally {
         setSubmitting(false);
      }
   };

   const handleDelete = async (acc) => {
      if (!window.confirm(`¿Seguro que deseas eliminar la cuenta ${acc.code} - ${acc.name}?`)) return;
      setLoading(true);
      setErr(null);
      try {
         await deleteAccount(acc.id, entityId);
         toast.success('Cuenta eliminada correctamente');
         loadAccounts();
      } catch (e) {
         setErr(e.message || 'Error al eliminar cuenta');
         setLoading(false);
      }
   };

   const handleClearFilters = () => {
      setSearch('');
      setFilterType('');
   };

   const groupedAccounts = useMemo(() => {
      const groups = {
         ACTIVO: [],
         PASIVO: [],
         PATRIMONIO: [],
         INGRESOS: [],
         COSTOS: [],
         GASTOS: [],
      };
      accounts.forEach((acc) => {
         if (groups[acc.type]) groups[acc.type].push(acc);
         else groups.GASTOS.push(acc);
      });
      Object.values(groups).forEach(list => list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
      return groups;
   }, [accounts]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-4">
         {/* Top Header Card */}
         <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-2xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 pb-4 border-b border-gray-200">
               <div>
                  <h2 className="text-xl font-bold text-gray-900 tracking-tight">Plan de Cuentas Contables</h2>
                  <p className="text-xs text-gray-500 mt-1">Estructura general de cuentas y clasificación para la contabilidad de la empresa.</p>
               </div>
               <div className="flex flex-wrap items-center gap-2">
                  <button
                     onClick={handleSeed}
                     disabled={loading}
                     className={btnCtrl}
                     title="Cargar plan de cuentas base estándar"
                  >
                     <SparklesIcon className="w-4 h-4 text-gray-500" />
                     <span className="hidden sm:inline">Cargar Plan Base</span>
                  </button>
                  <button onClick={openCreateModal} className="h-9 flex items-center justify-center gap-2 px-3 rounded border border-gray-800 bg-gray-800 text-white text-sm font-medium shadow-2xs hover:bg-gray-900 transition-colors cursor-pointer">
                     <PlusIcon className="w-4 h-4 stroke-2" />
                     <span>Crear Cuenta</span>
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
                  <div className="space-y-1 md:col-span-8 relative">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Buscar Cuenta</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
                        <input
                           type="text"
                           placeholder="Buscar por código o nombre de cuenta..."
                           className={`${ctrl} pl-9`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1 md:col-span-4">
                     <label className="block text-[11px] font-semibold text-gray-600 uppercase tracking-wider">Tipo de Cuenta</label>
                     <select className={selectCtrl} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                        <option value="">Todos los tipos</option>
                        <option value="ACTIVO">1 ACTIVO</option>
                        <option value="PASIVO">2 PASIVO</option>
                        <option value="PATRIMONIO">3 PATRIMONIO</option>
                        <option value="INGRESOS">4 INGRESOS</option>
                        <option value="COSTOS">5 COSTOS</option>
                        <option value="GASTOS">6 GASTOS</option>
                     </select>
                  </div>
               </div>
            </div>
         </div>

         {/* Summary Cards */}
         <AccountsSummary accounts={accounts} />

         {/* Error Notice */}
         {err && <div className="p-3 bg-red-50 text-red-700 rounded-lg border border-red-200 text-xs font-medium">Error: {err}</div>}

         {/* Content / Grouped Accounts */}
         <div className="bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden p-5 space-y-6">
            {loading ? (
               <div className="p-8 text-center text-gray-500 font-medium text-sm flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-4 h-4 animate-spin text-gray-400" /> Cargando plan de cuentas...
               </div>
            ) : accounts.length === 0 ? (
               <div className="p-10 text-center text-gray-500">
                  <BookOpenIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                  <p className="text-sm font-semibold text-gray-800">No hay cuentas contables registradas</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">Puedes cargar la plantilla estándar o crear una cuenta manualmente.</p>
                  <button onClick={handleSeed} className="h-9 px-4 rounded border border-gray-800 bg-gray-800 text-white text-xs font-medium mx-auto hover:bg-gray-900 transition-colors">
                     Cargar Plan Base Ahora
                  </button>
               </div>
            ) : (
               Object.entries(groupedAccounts).map(([type, accList]) => {
                  if (accList.length === 0 && filterType && filterType !== type) return null;
                  return (
                     <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between pb-1.5 border-b border-gray-200">
                           <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <Pill colorClass={TYPE_BADGES[type]}>{type}</Pill>
                              <span className="text-xs text-gray-500 font-normal">({accList.length} cuentas)</span>
                           </h3>
                        </div>

                        {accList.length === 0 ? (
                           <p className="text-xs text-gray-400 italic pl-1">Sin cuentas registradas en esta categoría.</p>
                        ) : (
                           <div className="overflow-x-auto rounded border border-gray-200">
                              <table className="min-w-full text-xs text-left">
                                 <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold uppercase tracking-wider">
                                    <tr>
                                       <th className="py-2.5 px-3">Código</th>
                                       <th className="py-2.5 px-3">Nombre Cuenta</th>
                                       <th className="py-2.5 px-3">Naturaleza</th>
                                       <th className="py-2.5 px-3">Centro de Costo</th>
                                       <th className="py-2.5 px-3 text-center">Acciones</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-200">
                                    {accList.map((acc) => (
                                       <tr key={acc.id} className="hover:bg-gray-50/80 transition-colors group">
                                          <td className="py-2.5 px-3 font-mono font-bold text-gray-900">{acc.code}</td>
                                          <td className="py-2.5 px-3 font-medium text-gray-800">
                                             {acc.name}
                                             {acc.is_system && (
                                                <span className="ml-2 inline-flex px-1.5 py-0.5 bg-gray-100 rounded font-mono text-[10px] font-semibold text-gray-500 border border-gray-200">
                                                   SISTEMA
                                                </span>
                                             )}
                                          </td>
                                          <td className="py-2.5 px-3">
                                             <Pill
                                                colorClass={
                                                   acc.nature === 'DEUDORA'
                                                      ? 'bg-slate-100 text-slate-700 border-slate-200'
                                                      : 'bg-slate-100 text-slate-700 border-slate-200'
                                                }
                                             >
                                                {acc.nature}
                                             </Pill>
                                          </td>
                                          <td className="py-2.5 px-3 text-gray-500 text-xs">
                                             {acc.cost_center_requirement === 'REQUIRED'
                                                ? 'Obligatorio'
                                                : acc.cost_center_requirement === 'OPTIONAL'
                                                ? 'Opcional'
                                                : 'No requiere'}
                                          </td>
                                          <td className="py-2.5 px-3 text-center">
                                             <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                <button
                                                   onClick={() => openEditModal(acc)}
                                                   className="p-1 rounded text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition"
                                                   title="Editar cuenta"
                                                >
                                                   <PencilSquareIcon className="w-4 h-4" />
                                                </button>
                                                {!acc.is_system && (
                                                   <button
                                                      onClick={() => handleDelete(acc)}
                                                      className="p-1 rounded text-gray-500 hover:text-red-600 hover:bg-red-50 transition"
                                                      title="Eliminar cuenta"
                                                   >
                                                      <TrashIcon className="w-4 h-4" />
                                                   </button>
                                                )}
                                             </div>
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        )}
                     </div>
                  );
               })
            )}
         </div>

         {/* Create / Edit Modal */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editingAccount ? 'Editar Cuenta Contable' : 'Crear Nueva Cuenta Contable'} maxWidth="max-w-lg">
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Código de Cuenta</label>
                  <input
                     type="text"
                     disabled={!!editingAccount}
                     required
                     placeholder="Ej: 5.2.1 o 6.1.5"
                     className={ctrl}
                     value={formData.code}
                     onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Nombre de la Cuenta</label>
                  <input
                     type="text"
                     required
                     placeholder="Ej: Gastos de Operación"
                     className={ctrl}
                     value={formData.name}
                     onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
               </div>

               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Tipo</label>
                     <select
                        className={selectCtrl}
                        value={formData.type}
                        onChange={(e) => {
                           const t = e.target.value;
                           const nat = ['ACTIVO', 'COSTOS', 'GASTOS'].includes(t) ? 'DEUDORA' : 'ACREEDORA';
                           setFormData({ ...formData, type: t, nature: nat });
                        }}
                     >
                        <option value="ACTIVO">ACTIVO</option>
                        <option value="PASIVO">PASIVO</option>
                        <option value="PATRIMONIO">PATRIMONIO</option>
                        <option value="INGRESOS">INGRESOS</option>
                        <option value="COSTOS">COSTOS</option>
                        <option value="GASTOS">GASTOS</option>
                     </select>
                  </div>

                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Naturaleza</label>
                     <select
                        className={selectCtrl}
                        value={formData.nature}
                        onChange={(e) => setFormData({ ...formData, nature: e.target.value })}
                     >
                        <option value="DEUDORA">DEUDORA</option>
                        <option value="ACREEDORA">ACREEDORA</option>
                     </select>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Centro de Costo</label>
                  <select
                     className={selectCtrl}
                     value={formData.cost_center_requirement}
                     onChange={(e) => setFormData({ ...formData, cost_center_requirement: e.target.value })}
                  >
                     <option value="NONE">No requiere</option>
                     <option value="OPTIONAL">Opcional</option>
                     <option value="REQUIRED">Obligatorio</option>
                  </select>
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
                     {submitting ? 'Guardando...' : 'Guardar Cuenta'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}

