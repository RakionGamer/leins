import { useState, useEffect, useCallback } from 'react';
import { useEntityRequired } from '../../hooks/useEntityRequired';
import EntityRequiredNotice from '../../components/EntityRequiredNotice';
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
   XMarkIcon,
   CheckCircleIcon,
   ArrowPathIcon,
} from '@heroicons/react/24/outline';

const ctrl =
   'w-full h-11 px-3 text-sm rounded-2xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

export default function AccountingRules() {
   const { entityId, ready } = useEntityRequired();

   const [rules, setRules] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [msg, setMsg] = useState(null);

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
         setMsg('Regla de asignación guardada correctamente');
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
         setMsg('Regla eliminada');
         loadRules();
      } catch (e) {
         setErr(e.message || 'Error al eliminar regla');
         setLoading(false);
      }
   };

   if (!ready) return <EntityRequiredNotice />;

   return (
      <div className="space-y-6">
         {/* Encabezado */}
         <div className="bg-bg-content rounded-3xl p-5 border border-border-subtle shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
               <div className="p-3 bg-brand/10 text-brand rounded-2xl">
                  <UserGroupIcon className="w-7 h-7" />
               </div>
               <div>
                  <h2 className="text-2xl font-bold text-heading tracking-tight">Asociación por Proveedor y Cliente</h2>
                  <p className="text-sm text-text-soft mt-0.5">
                     Define qué cuenta contable y centro de costo se asigna automáticamente a cada RUT al importar facturas.
                  </p>
               </div>
            </div>

            <button
               onClick={() => {
                  setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
                  setModalOpen(true);
               }}
               className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-2xl shadow transition"
            >
               <PlusIcon className="w-4 h-4" /> Nueva Regla
            </button>
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

         {/* Tabla de Reglas */}
         <div className="bg-bg-content rounded-3xl border border-border-subtle shadow-sm overflow-hidden">
            {loading ? (
               <div className="p-10 text-center text-brand font-medium animate-pulse flex items-center justify-center gap-2">
                  <ArrowPathIcon className="w-5 h-5 animate-spin" /> Cargando reglas de asociación...
               </div>
            ) : rules.length === 0 ? (
               <div className="p-12 text-center text-text-soft">
                  <UserGroupIcon className="w-12 h-12 mx-auto text-text-soft/50 mb-3" />
                  <p className="text-base font-semibold">No hay reglas de asignación configuradas</p>
                  <p className="text-sm mt-1">Por defecto las compras se imputan a "Gastos Administrativos". Crea reglas para categorizarlas automáticamente.</p>
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left">
                     <thead className="bg-surface-2 border-b border-border-subtle text-text-soft text-xs uppercase font-semibold">
                        <tr>
                           <th className="p-4">RUT Proveedor / Cliente</th>
                           <th className="p-4">Razón Social / Nombre</th>
                           <th className="p-4">Cuenta Contable Destino</th>
                           <th className="p-4">Centro de Costo</th>
                           <th className="p-4 text-right">Acciones</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-border-subtle/50">
                        {rules.map((rule) => (
                           <tr key={rule.id} className="hover:bg-brand/5 transition">
                              <td className="p-4 font-mono font-bold text-brand">{rule.counterparty_rut}</td>
                              <td className="p-4 font-medium text-heading">{rule.counterparty_name || '-'}</td>
                              <td className="p-4 font-medium text-heading">
                                 {rule.account ? `${rule.account.code} - ${rule.account.name}` : '-'}
                              </td>
                              <td className="p-4 text-text-soft">{rule.cost_center || 'No asignado'}</td>
                              <td className="p-4 text-right">
                                 <button
                                    onClick={() => handleDelete(rule)}
                                    className="p-1 text-text-soft hover:text-danger transition"
                                    title="Eliminar regla"
                                 >
                                    <TrashIcon className="w-4 h-4" />
                                 </button>
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            )}
         </div>

         {/* Modal Crear Regla */}
         {modalOpen && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="bg-bg-content rounded-3xl p-6 border border-border-subtle shadow-xl w-full max-w-md space-y-5 animate-in fade-in zoom-in-95">
                  <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                     <h3 className="text-xl font-bold text-heading">Nueva Regla de Asignación</h3>
                     <button onClick={() => setModalOpen(false)} className="text-text-soft hover:text-heading">
                        <XMarkIcon className="w-6 h-6" />
                     </button>
                  </div>

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
                           className="px-4 py-2.5 text-sm font-semibold text-text-soft hover:bg-surface-2 rounded-2xl transition"
                        >
                           Cancelar
                        </button>
                        <button
                           type="submit"
                           disabled={submitting}
                           className="px-5 py-2.5 text-sm font-semibold text-white bg-brand hover:bg-brand/90 rounded-2xl shadow transition disabled:opacity-50"
                        >
                           {submitting ? 'Guardando...' : 'Guardar Regla'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
}
