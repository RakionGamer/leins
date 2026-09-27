import { useState, useEffect, useMemo, useCallback } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
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
   MagnifyingGlassIcon,
   ArrowPathIcon,
   SparklesIcon,
   PencilSquareIcon,
   TrashIcon,
   XMarkIcon,
   CheckCircleIcon,
} from '@heroicons/react/24/outline';

const ctrl =
   'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

const TYPE_BADGES = {
   ACTIVO: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300',
   PASIVO: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300',
   PATRIMONIO: 'bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-500/20 dark:text-purple-300',
   INGRESOS: 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300',
   COSTOS: 'bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/20 dark:text-orange-300',
   GASTOS: 'bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/20 dark:text-rose-300',
};

export default function AccountingAccounts() {
   const { entityId, ready } = useEntityRequired();

   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [msg, setMsg] = useState(null);

   const [search, setSearch] = useState('');
   const [filterType, setFilterType] = useState('');

   // Modal de creación / edición
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
         setMsg(res.created ? `Se crearon ${res.created} cuentas base correctamente.` : 'El plan de cuentas base ya está inicializado.');
         await loadAccounts();
      } catch (e) {
         setErr(e.message || 'No se pudo poblar el plan de cuentas');
      } finally {
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
            setMsg('Cuenta actualizada correctamente');
         } else {
            await createAccount({
               entityId,
               ...formData,
            });
            setMsg('Cuenta creada correctamente');
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
         setMsg('Cuenta eliminada');
         loadAccounts();
      } catch (e) {
         setErr(e.message || 'Error al eliminar cuenta');
         setLoading(false);
      }
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
      return groups;
   }, [accounts]);

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Encabezado */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-border-subtle">
               <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand/10 text-brand rounded-2xl">
                     <BookOpenIcon className="w-7 h-7" />
                  </div>
                  <div>
                     <h2 className="text-2xl font-bold text-heading tracking-tight">Plan de Cuentas Contables</h2>
                     <p className="text-sm text-text-soft mt-0.5">Estructura general de cuentas para la entidad.</p>
                  </div>
               </div>

               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={handleSeed}
                     disabled={loading}
                     className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-brand bg-brand/10 hover:bg-brand hover:text-white rounded-2xl transition disabled:opacity-50"
                  >
                     <SparklesIcon className="w-4 h-4" /> Cargar Plan Base
                  </button>
                  <button
                     onClick={openCreateModal}
                     className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-2xl shadow transition"
                  >
                     <PlusIcon className="w-4 h-4" /> Crear Cuenta
                  </button>
               </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-5">
               <div className="md:col-span-8 relative">
                  <MagnifyingGlassIcon className="w-5 h-5 absolute left-3.5 top-3 text-text-soft" />
                  <input
                     type="text"
                     placeholder="Buscar por código o nombre..."
                     className={`${ctrl} pl-10`}
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
               <div className="md:col-span-4">
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

         {/* Contenido / Listado agrupado */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden p-6 space-y-6">
            {loading ? (
               <div className="p-10 text-center text-brand font-medium animate-pulse flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" /> Cargando plan de cuentas...
               </div>
            ) : accounts.length === 0 ? (
               <div className="p-12 text-center text-text-soft">
                  <BookOpenIcon className="w-12 h-12 mx-auto text-text-soft/50 mb-3" />
                  <p className="text-base font-semibold">No hay cuentas contables registradas</p>
                  <p className="text-sm mt-1 mb-4">Puedes cargar la plantilla estándar o crear una cuenta manualmente.</p>
                  <button onClick={handleSeed} className="px-5 py-2.5 bg-brand text-white text-sm font-semibold rounded-2xl shadow">
                     Cargar Plan Base Ahora
                  </button>
               </div>
            ) : (
               Object.entries(groupedAccounts).map(([type, accList]) => {
                  if (accList.length === 0 && filterType && filterType !== type) return null;
                  return (
                     <div key={type} className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                           <h3 className="text-lg font-bold text-heading flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ring-1 ${TYPE_BADGES[type]}`}>{type}</span>
                              <span className="text-sm text-text-soft font-normal">({accList.length} cuentas)</span>
                           </h3>
                        </div>

                        {accList.length === 0 ? (
                           <p className="text-sm text-text-soft italic pl-2">Sin cuentas registradas en esta categoría.</p>
                        ) : (
                           <div className="overflow-x-auto">
                              <table className="min-w-full text-sm text-left">
                                 <thead className="bg-surface-2 text-text-soft text-xs uppercase font-semibold">
                                    <tr>
                                       <th className="py-2.5 px-4 rounded-l-xl">Código</th>
                                       <th className="py-2.5 px-4">Nombre Cuenta</th>
                                       <th className="py-2.5 px-4">Naturaleza</th>
                                       <th className="py-2.5 px-4">Centro de Costo</th>
                                       <th className="py-2.5 px-4 text-right rounded-r-xl">Acciones</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border-subtle/50">
                                    {accList.map((acc) => (
                                       <tr key={acc.id} className="hover:bg-brand/5 transition">
                                          <td className="py-3 px-4 font-mono font-bold text-brand">{acc.code}</td>
                                          <td className="py-3 px-4 font-medium text-heading">
                                             {acc.name}
                                             {acc.is_system && (
                                                <span className="ml-2 text-[10px] bg-surface-2 text-text-soft px-1.5 py-0.5 rounded font-bold">
                                                   SISTEMA
                                                </span>
                                             )}
                                          </td>
                                          <td className="py-3 px-4">
                                             <span
                                                className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                                   acc.nature === 'DEUDORA' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
                                                }`}
                                             >
                                                {acc.nature}
                                             </span>
                                          </td>
                                          <td className="py-3 px-4 text-text-soft text-xs">
                                             {acc.cost_center_requirement === 'REQUIRED'
                                                ? 'Obligatorio'
                                                : acc.cost_center_requirement === 'OPTIONAL'
                                                ? 'Opcional'
                                                : 'No requiere'}
                                          </td>
                                          <td className="py-3 px-4 text-right space-x-2">
                                             <button
                                                onClick={() => openEditModal(acc)}
                                                className="p-1 text-text-soft hover:text-brand transition"
                                                title="Editar cuenta"
                                             >
                                                <PencilSquareIcon className="w-4 h-4" />
                                             </button>
                                             {!acc.is_system && (
                                                <button
                                                   onClick={() => handleDelete(acc)}
                                                   className="p-1 text-text-soft hover:text-danger transition"
                                                   title="Eliminar cuenta"
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
                        )}
                     </div>
                  );
               })
            )}
         </div>

         {/* Modal Crear / Editar */}
         {modalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-bg-content rounded-3xl p-6 border border-border-subtle shadow-xl w-full max-w-lg space-y-5 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                     <h3 className="text-xl font-bold text-heading">
                        {editingAccount ? 'Editar Cuenta Contable' : 'Crear Nueva Cuenta Contable'}
                     </h3>
                     <button onClick={() => setModalOpen(false)} className="text-text-soft hover:text-heading">
                        <XMarkIcon className="w-6 h-6" />
                     </button>
                  </div>

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

                     <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
                        <button
                           type="button"
                           onClick={() => setModalOpen(false)}
                           className="px-4 py-2.5 text-sm font-semibold text-text-soft hover:bg-surface-2 rounded-2xl transition"
                        >
                           Cancelar
                        </button>
                        <button
                           type="submit"
                           disabled={submitting}
                           className="px-5 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-2xl shadow transition disabled:opacity-50"
                        >
                           {submitting ? 'Guardando...' : 'Guardar Cuenta'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
}
