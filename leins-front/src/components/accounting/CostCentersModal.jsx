import { useState } from 'react';
import Modal from '../Modal';
import { toast } from '../Toaster';
import {
   PlusIcon,
   TrashIcon,
   TagIcon,
   SparklesIcon,
   CheckCircleIcon,
   NoSymbolIcon,
} from '@heroicons/react/24/outline';
import {
   createCostCenter,
   updateCostCenter,
   deleteCostCenter,
} from '../../services/accountingApi';

const ctrl = 'w-full h-10 px-3 text-sm rounded-xl border border-border-subtle bg-bg-content text-text-main placeholder-text-soft/70 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent transition shadow-sm';

export default function CostCentersModal({
   isOpen,
   onClose,
   entityId,
   costCenters = [],
   onCostCentersChange,
}) {
   const [name, setName] = useState('');
   const [code, setCode] = useState('');
   const [submitting, setSubmitting] = useState(false);
   const [deletingId, setDeletingId] = useState(null);

   const handleCreate = async (e) => {
      e?.preventDefault();
      const cleanName = name.trim();
      if (!cleanName) {
         toast.error('El nombre del centro de costo es requerido');
         return;
      }

      setSubmitting(true);
      try {
         const created = await createCostCenter({
            entityId,
            name: cleanName,
            code: code.trim() || null,
         });

         const createdItem = created?.id ? created : { id: Date.now(), name: cleanName, code: code.trim() || null, is_active: true };

         if (onCostCentersChange) {
            onCostCentersChange((prev) => {
               const filtered = prev.filter(c => (c.name || c).toUpperCase() !== cleanName.toUpperCase());
               return [...filtered, createdItem].sort((a, b) => (a.name || a).localeCompare(b.name || b));
            });
         }

         setName('');
         setCode('');
         toast.success(`Centro de costo "${cleanName}" creado correctamente`);
      } catch (err) {
         toast.error(err.message || 'Error al crear centro de costo');
      } finally {
         setSubmitting(false);
      }
   };

   const handleToggleActive = async (cc) => {
      if (!cc.id || String(cc.id).startsWith('legacy-')) {
         toast.info('Este centro de costo proviene de registros históricos');
         return;
      }
      try {
         const newActive = !cc.is_active;
         await updateCostCenter(cc.id, { is_active: newActive }, { entityId });
         if (onCostCentersChange) {
            onCostCentersChange((prev) =>
               prev.map((item) => (item.id === cc.id ? { ...item, is_active: newActive } : item))
            );
         }
         toast.success(`Centro de costo ${newActive ? 'activado' : 'desactivado'}`);
      } catch (err) {
         toast.error(err.message || 'Error al actualizar estado');
      }
   };

   const handleDelete = async (cc) => {
      if (!cc.id || String(cc.id).startsWith('legacy-')) {
         toast.error('No se puede eliminar un registro histórico automático');
         return;
      }
      if (!window.confirm(`¿Seguro que deseas eliminar el centro de costo "${cc.name}"?`)) return;

      setDeletingId(cc.id);
      try {
         await deleteCostCenter(cc.id, entityId);
         if (onCostCentersChange) {
            onCostCentersChange((prev) => prev.filter((item) => item.id !== cc.id));
         }
         toast.success('Centro de costo eliminado correctamente');
      } catch (err) {
         toast.error(err.message || 'No se pudo eliminar el centro de costo');
      } finally {
         setDeletingId(null);
      }
   };

   return (
      <Modal isOpen={isOpen} onClose={onClose} title="Gestor de Centros de Costo" maxWidth="max-w-xl">
         <div className="space-y-4">
            <p className="text-xs text-text-soft">
               Crea y administra los Centros de Costo de esta sociedad para organizar tus egresos, costos operacionales y reglas automáticas de proveedores.
            </p>

            {/* Quick Create Card */}
            <form onSubmit={handleCreate} className="p-3.5 bg-surface-2/70 border border-border-subtle rounded-2xl space-y-3">
               <span className="text-xs font-semibold uppercase tracking-wider text-text-soft block">
                  Nuevo Centro de Costo
               </span>
               <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div className="sm:col-span-4">
                     <input
                        type="text"
                        placeholder="Código (ej: CC-01)"
                        className={ctrl}
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                        disabled={submitting}
                     />
                  </div>
                  <div className="sm:col-span-8">
                     <input
                        type="text"
                        placeholder="Nombre (ej: Administración, Faena Norte)"
                        className={ctrl}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        disabled={submitting}
                     />
                  </div>
               </div>
               <div className="flex justify-end">
                  <button
                     type="submit"
                     disabled={!name.trim() || submitting}
                     className="px-4 py-2 bg-brand text-white text-xs font-semibold rounded-xl hover:bg-brand-hover shadow-sm transition disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                  >
                     <PlusIcon className="w-4 h-4 stroke-2" />
                     <span>{submitting ? 'Guardando...' : 'Agregar Centro de Costo'}</span>
                  </button>
               </div>
            </form>

            {/* List of existing Cost Centers */}
            <div>
               <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-soft">
                     Centros de Costo Creados ({costCenters.length})
                  </span>
               </div>

               {costCenters.length === 0 ? (
                  <div className="p-6 text-center border border-dashed border-border-subtle rounded-2xl bg-surface-1">
                     <TagIcon className="w-8 h-8 text-text-soft/40 mx-auto mb-2" />
                     <p className="text-sm font-medium text-text-main">Aún no hay centros de costo registrados</p>
                     <p className="text-xs text-text-soft mt-1">
                        Utiliza el formulario superior para crear el primero (ej: "Administración" o "Operaciones").
                     </p>
                  </div>
               ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-1">
                     {costCenters.map((cc) => {
                        const displayName = cc.name || cc;
                        const displayCode = cc.code || null;
                        const isActive = cc.is_active !== false;

                        return (
                           <div
                              key={cc.id || displayName}
                              className={`flex items-center justify-between p-3 rounded-xl border transition ${
                                 isActive
                                    ? 'border-border-subtle bg-surface-1 hover:bg-surface-2'
                                    : 'border-border-subtle/40 bg-surface-2/40 opacity-60'
                              }`}
                           >
                              <div className="flex items-center gap-2.5 min-w-0">
                                 {displayCode && (
                                    <span className="px-2 py-0.5 rounded-md font-mono text-[11px] font-bold bg-brand/10 text-brand border border-brand/20 shrink-0">
                                       {displayCode}
                                    </span>
                                 )}
                                 <span className="text-sm font-medium text-text-main truncate">
                                    {displayName}
                                 </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                 <button
                                    type="button"
                                    onClick={() => handleToggleActive(cc)}
                                    className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                       isActive
                                          ? 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
                                          : 'bg-slate-500/10 text-slate-500 hover:bg-slate-500/20'
                                    }`}
                                    title={isActive ? 'Desactivar centro de costo' : 'Activar centro de costo'}
                                 >
                                    {isActive ? 'Activo' : 'Inactivo'}
                                 </button>

                                 {cc.id && !String(cc.id).startsWith('legacy-') && (
                                    <button
                                       type="button"
                                       onClick={() => handleDelete(cc)}
                                       disabled={deletingId === cc.id}
                                       className="p-1.5 rounded-lg text-text-soft hover:text-danger hover:bg-danger/10 transition cursor-pointer disabled:opacity-50"
                                       title="Eliminar centro de costo"
                                    >
                                       <TrashIcon className="w-4 h-4" />
                                    </button>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border-subtle">
               <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-semibold text-text-soft hover:text-text-main hover:bg-surface-2 rounded-xl transition cursor-pointer"
               >
                  Cerrar
               </button>
            </div>
         </div>
      </Modal>
   );
}
