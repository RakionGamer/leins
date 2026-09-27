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
   PlusIcon,
   TrashIcon,
   ArrowPathIcon,
} from '@heroicons/react/24/outline';

const ctrl = 'w-full h-9 px-3 text-sm rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--heading)] placeholder-[var(--text-soft)] focus:outline-none focus:border-[var(--brand)] transition-colors shadow-sm';
const selectCtrl = ctrl + ' appearance-none cursor-pointer';

export default function AccountingRules() {
   const { entityId, ready } = useEntityRequired();

   const [rules, setRules] = useState([]);
   const [accounts, setAccounts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [err, setErr] = useState(null);
   const [search, setSearch] = useState('');

   const [mostrarFiltros, setMostrarFiltros] = useState(true);

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
      <div className="animate-fade-in">
         {/* PANEL: Filtros */}
         <div
            className={[
               "relative bg-[var(--bg-content)] shadow-sm transition-all duration-300 ease-out origin-top",
               mostrarFiltros ? "z-[80] opacity-100 max-h-[1000px] py-3 px-4 space-y-3 scale-100 overflow-visible mb-4" : "z-0 opacity-0 max-h-0 p-0 pointer-events-none scale-[.98] overflow-hidden",
            ].join(" ")}
         >
            <h2 className="text-xl font-semibold text-[var(--heading)]">
               Reglas de Asignación por RUT
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
               <div className="flex flex-col gap-1 md:col-span-4">
                  <label className="text-[12px] text-[var(--text-soft)]">Buscar por RUT o Nombre</label>
                  <input
                     type="text"
                     placeholder="Buscar por RUT de proveedor/cliente o cuenta asignada..."
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2 text-[var(--heading)] placeholder-[var(--text-soft)] focus:outline-none focus:border-[var(--brand)]"
                     value={search}
                     onChange={(e) => setSearch(e.target.value)}
                  />
               </div>
            </div>
         </div>

         {/* Toolbar y Tabs */}
         <div className="bg-[var(--bg-content)] py-2 px-4 shadow-sm mb-4">
            <div className="flex items-center justify-between gap-3">
               <div className="flex flex-wrap items-center gap-2" role="tablist">
                  <button className="px-3 py-2 rounded-lg flex items-center gap-2 bg-[var(--surface-2)] text-[var(--heading)]">
                     <span>Reglas de Asignación</span>
                  </button>
               </div>
               <div className="flex items-center gap-2">
                  <button
                     onClick={() => {
                        setFormData({ counterparty_rut: '', counterparty_name: '', account_id: '', cost_center: '' });
                        setModalOpen(true);
                     }}
                     className="flex items-center gap-2 px-3 md:px-6 py-2.5 bg-[var(--brand)] text-white font-medium rounded-xl shadow-lg shadow-brand/20 hover:opacity-90 hover:-translate-y-0.5 transition-all"
                  >
                     <PlusIcon className="w-4 h-4 stroke-2" />
                     <span className="hidden xl:block">Nueva Regla</span>
                  </button>
                  <button type="button" onClick={() => setMostrarFiltros(v => !v)} className="p-2 rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--surface-1)]" title="Mostrar/Ocultar filtros">
                     🔍
                  </button>
               </div>
            </div>
         </div>

         {err && <div className="p-4 bg-[var(--danger)]/10 text-[var(--danger)] rounded-lg mb-4 text-sm font-medium">Error: {err}</div>}

         {/* Rules Table */}
         <div className={`bg-[var(--bg-content)] overflow-auto shadow-sm transition-all animate-fade-in ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
            <table className="min-w-full text-sm">
               <thead className="sticky top-0 bg-[var(--surface-2)] text-[var(--heading)]">
                  <tr className="text-left">
                     <th className="px-3 py-2">RUT Proveedor / Cliente</th>
                     <th className="px-3 py-2">Razón Social / Nombre</th>
                     <th className="px-3 py-2">Cuenta Contable Destino</th>
                     <th className="px-3 py-2">Centro de Costo</th>
                     <th className="px-3 py-2 text-center">Acciones</th>
                  </tr>
               </thead>
               <tbody>
                  {filteredRules.length === 0 && (
                     <tr>
                        <td className="px-3 py-8 text-center text-[var(--text-soft)]" colSpan={5}>
                           Sin resultados. Ajusta filtros o crea una nueva regla.
                        </td>
                     </tr>
                  )}
                  {filteredRules.map((rule) => (
                     <tr key={rule.id} className="border-b border-[var(--border-subtle)] hover:bg-[var(--surface-1)] transition-colors group">
                        <td className="px-3 py-2 font-mono font-bold text-[var(--heading)]">{rule.counterparty_rut}</td>
                        <td className="px-3 py-2 font-medium text-[var(--text-main)]">{rule.counterparty_name || '-'}</td>
                        <td className="px-3 py-2 font-medium text-[var(--text-main)]">
                           {rule.account ? (
                              <div className="flex items-center gap-2">
                                 <span className="font-mono text-[var(--heading)] font-bold">{rule.account.code}</span>
                                 <span>{rule.account.name}</span>
                              </div>
                           ) : (
                              '-'
                           )}
                        </td>
                        <td className="px-3 py-2 text-[var(--text-soft)]">
                           {rule.cost_center ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-[var(--surface-2)] text-[var(--text-main)] border-[var(--border-subtle)]">
                                 {rule.cost_center}
                              </span>
                           ) : (
                              <span className="italic">No asignado</span>
                           )}
                        </td>
                        <td className="px-3 py-2 text-center">
                           <div className="flex items-center justify-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                              <button
                                 onClick={() => handleDelete(rule)}
                                 className="p-1 rounded text-[var(--text-soft)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition outline-none"
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

         {/* Create Rule Modal */}
         <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Nueva Regla de Asignación por RUT" maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="space-y-4">
               <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-soft)] mb-1">RUT Proveedor / Cliente</label>
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
                  <label className="block text-xs font-semibold uppercase text-[var(--text-soft)] mb-1">Razón Social (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Servicios Eléctricos SpA"
                     className={ctrl}
                     value={formData.counterparty_name}
                     onChange={(e) => setFormData({ ...formData, counterparty_name: e.target.value })}
                  />
               </div>

               <div>
                  <label className="block text-xs font-semibold uppercase text-[var(--text-soft)] mb-1">Cuenta Contable Destino</label>
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
                  <label className="block text-xs font-semibold uppercase text-[var(--text-soft)] mb-1">Centro de Costo (Opcional)</label>
                  <input
                     type="text"
                     placeholder="Ej: Casa Matriz / Proyecto Alpha"
                     className={ctrl}
                     value={formData.cost_center}
                     onChange={(e) => setFormData({ ...formData, cost_center: e.target.value })}
                  />
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
                     disabled={submitting}
                     className="px-6 py-2 bg-[var(--brand)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50"
                  >
                     {submitting ? 'Guardando...' : 'Guardar Regla'}
                  </button>
               </div>
            </form>
         </Modal>
      </div>
   );
}
