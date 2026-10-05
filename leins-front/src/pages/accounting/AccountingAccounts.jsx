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
   CurrencyDollarIcon,
   HashtagIcon,
   BookmarkIcon,
} from '@heroicons/react/24/outline';

const ctrl = 'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';
const btnCtrl = 'h-11 flex items-center justify-center gap-2 px-4 rounded-2xl border border-border-subtle bg-bg-content text-text-main text-sm font-medium transition shadow-sm hover:bg-surface-2 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand';

function Pill({ children, colorClass = "bg-brand/10 text-brand ring-brand/20" }) {
   return <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ring-1 ${colorClass}`}>{children}</span>;
}

const TYPE_BADGES = {
   ACTIVO: 'bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-500/30',
   PASIVO: 'bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:ring-amber-500/30',
   PATRIMONIO: 'bg-purple-100 text-purple-700 ring-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:ring-purple-500/30',
   INGRESOS: 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:ring-blue-500/30',
   COSTOS: 'bg-orange-100 text-orange-700 ring-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:ring-orange-500/30',
   GASTOS: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30',
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
      <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-5">
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-brand/10 text-brand rounded-xl"><DocumentDuplicateIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Total Cuentas</div>
               <div className="text-xl font-bold text-heading">{counts.total}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl"><BanknotesIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Activos</div>
               <div className="text-xl font-bold text-heading">{counts.activo}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl"><ChartBarIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Pasivo / Patr.</div>
               <div className="text-xl font-bold text-heading">{counts.pasivo + counts.patrimonio}</div>
            </div>
         </div>
         <div className="rounded-2xl border border-border-subtle bg-surface-1 p-4 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl"><TagIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-text-soft uppercase tracking-wide">Ingresos</div>
               <div className="text-xl font-bold text-heading">{counts.ingresos}</div>
            </div>
         </div>
         <div className="col-span-2 xl:col-span-1 rounded-2xl border border-brand/30 bg-brand/5 p-4 shadow-sm flex items-center gap-4 ring-1 ring-brand/10">
            <div className="p-3 bg-brand text-white rounded-xl"><BookOpenIcon className="w-6 h-6" /></div>
            <div>
               <div className="text-xs font-semibold text-brand uppercase tracking-wide">Gastos y Costos</div>
               <div className="text-xl font-bold text-brand">{counts.gastos}</div>
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
      require_rut: false,
      require_reference: false,
      is_auxiliary: false,
      is_title: false,
      is_active: true,
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
      const initialType = 'GASTOS';
      const initialNature = 'DEUDORA';
      setFormData({
         code: getSuggestedCode(initialType, accounts),
         name: '',
         type: initialType,
         nature: initialNature,
         cost_center_requirement: 'NONE',
         require_rut: false,
         require_reference: false,
         is_auxiliary: false,
         is_title: false,
         is_active: true,
      });
      setModalOpen(true);
   };

   const getSuggestedCode = (type, currentAccounts) => {
      const accountsOfType = currentAccounts.filter(a => a.type === type);
      if (accountsOfType.length === 0) {
         if (type === 'ACTIVO') return '10.00.00';
         if (type === 'PASIVO') return '20.00.00';
         if (type === 'PATRIMONIO') return '30.00.00';
         if (type === 'INGRESOS') return '40.00.00';
         if (type === 'COSTOS') return '50.00.00';
         if (type === 'GASTOS') return '60.00.00';
         return '';
      }
      accountsOfType.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
      const lastCode = accountsOfType[accountsOfType.length - 1].code;
      const parts = lastCode.split('.');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
         // Si tiene ceros a la izquierda (ej: 00), mantenemos el padding si es necesario
         const isPadded = parts[parts.length - 1].length > 1 && parts[parts.length - 1].startsWith('0');
         let nextNum = lastNum + 10;
         
         // Si al sumar 10 nos pasamos a un número redondo como 100, no lo recortamos pero tampoco obligamos padding
         let nextStr = nextNum.toString();
         if (isPadded && nextStr.length < parts[parts.length - 1].length) {
             nextStr = nextStr.padStart(parts[parts.length - 1].length, '0');
         }
         
         parts[parts.length - 1] = nextStr;
         return parts.join('.');
      }
      return lastCode + '.10';
   };

   const openEditModal = (acc) => {
      setEditingAccount(acc);
      setFormData({
         code: acc.code,
         name: acc.name,
         type: acc.type,
         nature: acc.nature,
         cost_center_requirement: acc.cost_center_requirement || 'NONE',
         require_rut: !!acc.require_rut,
         require_reference: !!acc.require_reference,
         is_auxiliary: !!acc.is_auxiliary,
         is_title: !!acc.is_title,
         is_active: acc.is_active !== false,
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
               require_rut: formData.require_rut,
               require_reference: formData.require_reference,
               is_auxiliary: formData.is_auxiliary,
               is_title: formData.is_title,
               is_active: formData.is_active,
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
      <div className="space-y-6">
         {/* Top Header & Filter Card */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-5 border-b border-border-subtle">
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Plan de Cuentas Contables</h2>
                  <p className="text-sm text-text-soft mt-1">Estructura general de cuentas y clasificación para la contabilidad de la empresa.</p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <button
                     onClick={handleSeed}
                     disabled={loading}
                     className={btnCtrl}
                     title="Cargar plan de cuentas base estándar"
                  >
                     <SparklesIcon className="w-5 h-5 text-brand" />
                     <span className="hidden sm:inline">Cargar Plan Base</span>
                  </button>
                  <button onClick={openCreateModal} className={`${btnCtrl} text-brand border-brand/20 bg-brand/5`} title="Crear nueva cuenta contable">
                     <PlusIcon className="w-5 h-5 stroke-2" />
                     <span>Crear Cuenta</span>
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
                     onClick={handleClearFilters}
                     disabled={loading}
                     className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-text-soft hover:text-danger hover:bg-danger/10 rounded-xl transition-colors disabled:opacity-50"
                  >
                     <ArrowPathIcon className="w-4 h-4" /> Limpiar Filtros
                  </button>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-surface-1 p-4 rounded-2xl border border-border-subtle/50">
                  <div className="space-y-1.5 md:col-span-8 relative">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Buscar Cuenta</label>
                     <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-3 text-text-soft/70" />
                        <input
                           type="text"
                           placeholder="Buscar por código o nombre de cuenta..."
                           className={`${ctrl} pl-10`}
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                        />
                     </div>
                  </div>
                  <div className="space-y-1.5 md:col-span-4">
                     <label className="block text-xs font-semibold text-text-soft uppercase tracking-wider">Tipo de Cuenta</label>
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
         {err && <div className="p-4 bg-danger/10 text-danger rounded-2xl border border-danger/20 text-sm font-medium">Error: {err}</div>}

         {/* Content / Grouped Accounts */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden p-6 space-y-6">
            {loading ? (
               <div className="p-10 text-center text-brand font-medium animate-pulse flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin text-brand" /> Cargando plan de cuentas...
               </div>
            ) : accounts.length === 0 ? (
               <div className="p-10 text-center text-text-soft">
                  <BookOpenIcon className="w-12 h-12 mx-auto text-text-soft/40 mb-3" />
                  <p className="text-base font-semibold text-heading">No hay cuentas contables registradas</p>
                  <p className="text-xs text-text-soft mt-1 mb-5">Puedes cargar la plantilla estándar o crear una cuenta manualmente.</p>
                  <button onClick={handleSeed} className="px-5 py-2.5 bg-brand text-white font-semibold text-xs rounded-xl hover:bg-brand-hover shadow-sm transition">
                     Cargar Plan Base Ahora
                  </button>
               </div>
            ) : (
               Object.entries(groupedAccounts).map(([type, accList]) => {
                  if (accList.length === 0 && filterType && filterType !== type) return null;
                  return (
                     <div key={type} className="space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
                           <h3 className="text-base font-bold text-heading flex items-center gap-3">
                              <Pill colorClass={TYPE_BADGES[type]}>{type}</Pill>
                              <span className="text-xs text-text-soft font-normal">({accList.length} cuentas)</span>
                           </h3>
                        </div>

                        {accList.length === 0 ? (
                           <p className="text-xs text-text-soft/70 italic pl-1">Sin cuentas registradas en esta categoría.</p>
                        ) : (
                           <div className="overflow-x-auto rounded-2xl border border-border-subtle">
                              <table className="min-w-full text-sm text-left">
                                 <thead className="bg-surface-2 border-b border-border-subtle text-text-soft font-semibold">
                                    <tr>
                                       <th className="py-3 px-4">Código</th>
                                       <th className="py-3 px-4">Nombre Cuenta</th>
                                       <th className="py-3 px-4">Naturaleza</th>
                                       <th className="py-3 px-4">Atributos</th>
                                       <th className="py-3 px-4 text-center">Acciones</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border-subtle/50">
                                    {accList.map((acc) => (
                                       <tr key={acc.id} className="hover:bg-brand/5 transition-colors group">
                                          <td className="py-3 px-4 font-mono font-bold text-heading">{acc.code}</td>
                                          <td className="py-3 px-4 font-medium text-text-main">
                                             {acc.name}
                                             {acc.is_system && (
                                                <span className="ml-2 inline-flex px-2 py-0.5 bg-surface-2 rounded-md font-mono text-[10px] font-semibold text-text-soft border border-border-subtle/50">
                                                   SISTEMA
                                                </span>
                                             )}
                                          </td>
                                          <td className="py-3 px-4">
                                             <Pill
                                                colorClass={
                                                   acc.nature === 'DEUDORA'
                                                      ? 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30'
                                                      : 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:ring-slate-500/30'
                                                }
                                             >
                                                {acc.nature}
                                             </Pill>
                                          </td>
                                          <td className="py-3 px-4 text-text-soft text-xs">
                                             <div className="flex flex-wrap gap-1">
                                                {acc.is_title && <Pill colorClass="bg-blue-100 text-blue-700">TÍTULO</Pill>}
                                                {acc.require_rut && <Pill colorClass="bg-slate-100 text-slate-700">RUT</Pill>}
                                                {acc.require_reference && <Pill colorClass="bg-slate-100 text-slate-700">Ref</Pill>}
                                                {acc.is_auxiliary && <Pill colorClass="bg-slate-100 text-slate-700">Aux</Pill>}
                                                {acc.cost_center_requirement === 'REQUIRED' && <Pill colorClass="bg-brand/10 text-brand">CC Oblig.</Pill>}
                                                {acc.cost_center_requirement === 'OPTIONAL' && <Pill colorClass="bg-slate-100 text-slate-700">CC Opc.</Pill>}
                                                {!acc.is_title && !acc.require_rut && !acc.require_reference && !acc.is_auxiliary && acc.cost_center_requirement === 'NONE' && (
                                                   <span className="text-text-soft/60 italic">Básica</span>
                                                )}
                                             </div>
                                          </td>
                                          <td className="py-3 px-4 text-center">
                                             <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                                <button
                                                   onClick={() => openEditModal(acc)}
                                                   className="p-1.5 rounded-lg text-text-soft hover:text-brand hover:bg-brand/10 transition outline-none focus:ring-2 focus:ring-brand"
                                                   title="Editar cuenta"
                                                >
                                                   <PencilSquareIcon className="w-5 h-5" />
                                                </button>
                                                {!acc.is_system && (
                                                   <button
                                                      onClick={() => handleDelete(acc)}
                                                      className="p-1.5 rounded-lg text-text-soft hover:text-danger hover:bg-danger/10 transition outline-none focus:ring-2 focus:ring-danger"
                                                      title="Eliminar cuenta"
                                                   >
                                                      <TrashIcon className="w-5 h-5" />
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
               <div className="grid grid-cols-2 gap-4">
                  <div>
                     <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Tipo de Cuenta</label>
                     <select
                        className={selectCtrl}
                        value={formData.type}
                        onChange={(e) => {
                           const t = e.target.value;
                           const nat = ['ACTIVO', 'COSTOS', 'GASTOS'].includes(t) ? 'DEUDORA' : 'ACREEDORA';
                           setFormData({ 
                              ...formData, 
                              type: t, 
                              nature: nat,
                              code: editingAccount ? formData.code : getSuggestedCode(t, accounts)
                           });
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
                        className={`${selectCtrl} bg-surface-2 opacity-80`}
                        value={formData.nature}
                        disabled
                     >
                        <option value="DEUDORA">DEUDORA</option>
                        <option value="ACREEDORA">ACREEDORA</option>
                     </select>
                  </div>
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-1">Código Correlativo Sugerido</label>
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

               <div className="pt-2">
                  <label className="block text-xs font-semibold uppercase text-text-soft mb-2">Atributos de la Cuenta</label>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input
                           type="checkbox"
                           className="w-4 h-4 rounded text-brand focus:ring-brand border-border-subtle"
                           checked={formData.is_title}
                           onChange={(e) => setFormData({ ...formData, is_title: e.target.checked })}
                        />
                        <span className="text-text-main font-medium">Es Título Agrupador</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input
                           type="checkbox"
                           className="w-4 h-4 rounded text-brand focus:ring-brand border-border-subtle"
                           checked={formData.require_rut}
                           onChange={(e) => setFormData({ ...formData, require_rut: e.target.checked })}
                        />
                        <span className="text-text-main font-medium">Requiere RUT</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input
                           type="checkbox"
                           className="w-4 h-4 rounded text-brand focus:ring-brand border-border-subtle"
                           checked={formData.require_reference}
                           onChange={(e) => setFormData({ ...formData, require_reference: e.target.checked })}
                        />
                        <span className="text-text-main font-medium">Requiere Referencia</span>
                     </label>
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input
                           type="checkbox"
                           className="w-4 h-4 rounded text-brand focus:ring-brand border-border-subtle"
                           checked={formData.is_auxiliary}
                           onChange={(e) => setFormData({ ...formData, is_auxiliary: e.target.checked })}
                        />
                        <span className="text-text-main font-medium">Es Cuenta Auxiliar</span>
                     </label>
                  </div>
               </div>
               
               <div className="grid grid-cols-2 gap-4 pt-2">
                  <div></div>
                  <div className="flex items-end pb-2">
                     <label className="flex items-center gap-2 cursor-pointer">
                        <input
                           type="checkbox"
                           className="w-4 h-4 rounded text-danger focus:ring-danger border-border-subtle"
                           checked={!formData.is_active}
                           onChange={(e) => setFormData({ ...formData, is_active: !e.target.checked })}
                        />
                        <span className="text-danger font-medium">Cuenta Bloqueada (Inactiva)</span>
                     </label>
                  </div>
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
                     {submitting ? 'Guardando...' : 'Guardar Cuenta'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}


