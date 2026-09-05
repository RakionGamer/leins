import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'components/Toaster';
import Modal from 'components/Modal';
import { useEntity } from '../../context/EntityContext';
import { formatRutCL } from '../../utils/validators';
import EntityCredentialsPanel from './EntityCredentialsPanel';
import ClientUsersPanel from './ClientUsersPanel';
import { PlusIcon } from '@heroicons/react/24/outline';
import {
   listEntities,
   createEntity,
   updateEntity,
   changeEntityState,
   deleteEntity
} from '../../services/entitiesApi';

const DEFAULT_FORM = {
   name: '',
   rut: '',
   legalName: '',
};

const ACTIVE_STATE_ID = 1;
const INACTIVE_STATE_ID = 2;

function isEntityActive(row) {
   return Number(row?.state_id || 0) === ACTIVE_STATE_ID;
}

function entityStateLabel(row) {
   return isEntityActive(row) ? 'Activa' : 'Inactiva';
}

function useDebouncedValue(value, delay = 300) {
   const [debounced, setDebounced] = React.useState(value);

   React.useEffect(() => {
      const t = setTimeout(() => setDebounced(value), delay);
      return () => clearTimeout(t);
   }, [value, delay]);

   return debounced;
}

export default function EntitiesPage() {
   const queryClient = useQueryClient();
   const { entityId, setEntity } = useEntity();

   const [search, setSearch] = useState('');
   const [page, setPage] = useState(0);
   const [pageSize, setPageSize] = useState(25);
   const [sortBy, setSortBy] = useState('name');
   const [sortOrder, setSortOrder] = useState('asc');
   const [activeOnly, setActiveOnly] = useState(false);
   const [form, setForm] = useState(DEFAULT_FORM);
   const [editingId, setEditingId] = useState(null);
   const [entityModalOpen, setEntityModalOpen] = useState(false);
   const [saving, setSaving] = useState(false);
   const [changingStateId, setChangingStateId] = useState(null);
   const [deletingId, setDeletingId] = useState(null);
   const [credentialsEntity, setCredentialsEntity] = useState(null);
   const [clientsEntity, setClientsEntity] = useState(null);
   const debouncedSearch = useDebouncedValue(search, 300);

   const { data, isLoading, isFetching, error } = useQuery({
      queryKey: ['entities-admin', { q: debouncedSearch, page, pageSize, sortBy, sortOrder, activeOnly }],
      queryFn: ({ signal }) => listEntities({
         q: debouncedSearch,
         limit: pageSize,
         offset: page * pageSize,
         sort: sortBy,
         order: sortOrder,
         activeOnly,
         assignedAdminOnly: true,
         signal
      })
   });

   const rows = data?.rows || [];
   const total = Number(data?.total || rows.length || 0);
   const totalPages = Math.max(1, Math.ceil(total / pageSize));
   const selectedEntityId = Number(entityId || 0);

   const formTitle = useMemo(
      () => (editingId ? 'Editar entidad' : 'Nueva entidad'),
      [editingId]
   );

   const resetForm = () => {
      setForm(DEFAULT_FORM);
      setEditingId(null);
   };

   const openCreateModal = () => {
      resetForm();
      setEntityModalOpen(true);
   };

   const closeEntityModal = () => {
      if (saving) return;
      resetForm();
      setEntityModalOpen(false);
   };

   const refreshEntities = async () => {
      await queryClient.invalidateQueries({ queryKey: ['entities-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['entities'] });
   };

   const onSubmit = async (e) => {
      e.preventDefault();
      const name = String(form.name || '').trim();
      const rut = String(form.rut || '').trim();
      const legalName = String(form.legalName || '').trim();

      if (!name) return toast.error('Ingresa el nombre de la entidad');
      if (!rut) return toast.error('Ingresa el RUT de la entidad');

      try {
         setSaving(true);
         if (editingId) {
            await updateEntity({ id: editingId, name, rut, legalName });
            toast.success('Entidad actualizada');
         } else {
            await createEntity({ name, rut, legalName });
            toast.success('Entidad creada');
         }

         await refreshEntities();
         resetForm();
         setEntityModalOpen(false);
      } catch (err) {
         toast.error(err?.message || 'No se pudo guardar la entidad');
      } finally {
         setSaving(false);
      }
   };

   const startEdit = (row) => {
      setEditingId(Number(row.id));
      setForm({
         name: row.name || row.legal_name || '',
         rut: row.rut || '',
         legalName: row.legal_name || '',
      });
      setEntityModalOpen(true);
   };

   const clearSelectedEntity = () => {
      setEntity(null);
      try { localStorage.removeItem('entityId'); } catch {}
      const url = new URL(window.location.href);
      url.searchParams.delete('entityId');
      window.history.replaceState({}, '', url);
   };

   const selectEntity = (row) => {
      const nextId = Number(row.id);
      if (!nextId) return;

      const nextEntity = {
         id: nextId,
         name: row.name || row.legal_name || `Entidad ${nextId}`,
         rut: row.rut || '',
      };

      setEntity(nextEntity);
      try { localStorage.setItem('entityId', String(nextId)); } catch {}

      const url = new URL(window.location.href);
      url.searchParams.set('entityId', String(nextId));
      window.history.replaceState({}, '', url);

      toast.success(`Entidad activa: ${nextEntity.name}`);
   };

   const onToggleState = async (row) => {
      const isActive = isEntityActive(row);
      const nextStateId = isActive ? INACTIVE_STATE_ID : ACTIVE_STATE_ID;
      const action = isActive ? 'desactivar' : 'activar';
      const ok = window.confirm(`Quieres ${action} la entidad ${row.name || row.legal_name || row.id}?`);
      if (!ok) return;

      try {
         setChangingStateId(Number(row.id));
         await changeEntityState({ id: row.id, stateId: nextStateId });

         if (Number(row.id) === selectedEntityId && isActive) {
            clearSelectedEntity();
         }

         toast.success(isActive ? 'Entidad desactivada' : 'Entidad activada');

         await refreshEntities();
         if (Number(editingId) === Number(row.id)) resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo cambiar el estado de la entidad');
      } finally {
         setChangingStateId(null);
      }
   };

   const onDelete = async (row) => {
      const ok = window.confirm(
         `Vas a eliminar la entidad "${row.name || row.legal_name || row.id}". Esta accion no se puede deshacer. Continuar?`
      );
      if (!ok) return;

      try {
         setDeletingId(Number(row.id));
         const out = await deleteEntity({ id: row.id });

         if (out.deleted) {
            toast.success('Entidad eliminada');
            if (Number(row.id) === selectedEntityId) clearSelectedEntity();
         } else if (out.deactivated) {
            const detail = (out.blockedBy || [])
               .map((item) => `${item.label} (${item.count})`)
               .join(', ');
            toast.success(
               detail
                  ? `No se pudo eliminar, tiene datos asociados: ${detail}. Se desactivo en su lugar.`
                  : 'La entidad tenia datos asociados: se desactivo en lugar de eliminarse'
            );
            if (Number(row.id) === selectedEntityId) clearSelectedEntity();
         }

         await refreshEntities();
         if (Number(editingId) === Number(row.id)) resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo eliminar la entidad');
      } finally {
         setDeletingId(null);
      }
   };

   return (
      <div className="animate-fade-in space-y-5">
         <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
               <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-[var(--heading)]">Entidades</h1>
                  <p className="text-sm text-[var(--text-soft)] mt-1">
                     Crea, edita y administra las entidades del sistema.
                  </p>
               </div>
               <div className="flex flex-wrap items-center gap-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm">
                     <span className="text-[var(--text-soft)]">Total entidades</span>
                     <span className="font-semibold text-[var(--heading)]">{total}</span>
                     {isFetching && <span className="text-xs text-[var(--text-soft)]">(actualizando)</span>}
                  </div>
                  <button
                     type="button"
                     onClick={openCreateModal}
                     className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  >
                     <PlusIcon className="h-5 w-5" />
                     Nueva entidad
                  </button>
               </div>
            </div>
         </div>

         <div>
            <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-content)] p-4">
               <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <h2 className="text-lg font-semibold text-[var(--heading)]">Listado</h2>
                  <input
                     type="text"
                     value={search}
                     onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(0);
                     }}
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg px-3 py-2 text-sm sm:w-[320px]"
                     placeholder="Buscar por nombre o RUT..."
                     autoComplete="off"
                  />
               </div>

               <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="inline-flex items-center gap-2">
                     <label className="text-xs text-[var(--text-soft)]">Ordenar por</label>
                     <select
                        value={sortBy}
                        onChange={(e) => {
                           setSortBy(e.target.value);
                           setPage(0);
                        }}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg px-2 py-1.5 text-sm"
                     >
                        <option value="name">Nombre</option>
                        <option value="rut">RUT</option>
                        <option value="id">ID</option>
                     </select>
                  </div>
                  <div className="inline-flex items-center gap-2">
                     <label className="text-xs text-[var(--text-soft)]">Direccion</label>
                     <select
                        value={sortOrder}
                        onChange={(e) => {
                           setSortOrder(e.target.value);
                           setPage(0);
                        }}
                        className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg px-2 py-1.5 text-sm"
                     >
                        <option value="asc">Ascendente</option>
                        <option value="desc">Descendente</option>
                     </select>
                  </div>
                  <label className="inline-flex items-center gap-2 text-xs text-[var(--text-soft)]">
                     <input
                        type="checkbox"
                        checked={activeOnly}
                        onChange={(e) => {
                           setActiveOnly(e.target.checked);
                           setPage(0);
                        }}
                     />
                     Solo activas
                  </label>
               </div>

               {error && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                     {error?.message || 'No se pudieron cargar las entidades'}
                  </div>
               )}

               {isLoading ? (
                  <div className="mt-4 text-sm text-[var(--text-soft)]">Cargando entidades...</div>
               ) : (
                  <div className="mt-4 overflow-x-auto">
                     <table className="w-full min-w-[760px] text-sm">
                        <thead>
                           <tr className="border-b border-[var(--border-subtle)] text-[var(--text-soft)]">
                              <th className="text-left py-2 px-2">Nombre</th>
                              <th className="text-left py-2 px-2">RUT</th>
                              <th className="text-left py-2 px-2">Estado</th>
                              <th className="text-left py-2 px-2">Razon social</th>
                              <th className="text-left py-2 px-2">ID</th>
                              <th className="text-right py-2 px-2">Acciones</th>
                           </tr>
                        </thead>
                        <tbody>
                           {rows.length === 0 && (
                              <tr>
                                 <td colSpan={6} className="py-6 text-center text-[var(--text-soft)]">
                                    No hay entidades registradas.
                                 </td>
                              </tr>
                           )}
                           {rows.map((row) => {
                              const isSelected = Number(row.id) === selectedEntityId;
                              const isActive = isEntityActive(row);
                              const canDelete = row.permissions?.can_delete ?? true;
                              const canUpdate = row.permissions?.can_update ?? true;
                              return (
                                 <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                                    <td className="py-2 px-2 text-[var(--text-main)]">
                                       <div className="flex items-center gap-2">
                                          <span>{row.name || row.legal_name || '-'}</span>
                                          {isSelected && (
                                             <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                Seleccionada
                                             </span>
                                          )}
                                       </div>
                                    </td>
                                    <td className="py-2 px-2 text-[var(--text-main)]">{row.rut || '-'}</td>
                                    <td className="py-2 px-2">
                                       <span className={`text-xs px-2 py-1 rounded-full ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                          {entityStateLabel(row)}
                                       </span>
                                    </td>
                                    <td className="py-2 px-2 text-[var(--text-main)]">{row.legal_name || '-'}</td>
                                    <td className="py-2 px-2 text-[var(--text-soft)]">{row.id}</td>
                                    <td className="py-2 px-2">
                                       <div className="flex justify-end gap-2">
                                          <button
                                             type="button"
                                             onClick={() => selectEntity(row)}
                                             disabled={!isActive}
                                             className="px-3 py-1.5 rounded-md border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                             Seleccionar
                                          </button>
                                          {canUpdate && (
                                             <button
                                                type="button"
                                                onClick={() => startEdit(row)}
                                                className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--surface-1)]"
                                             >
                                                Editar
                                             </button>
                                          )}
                                          {canUpdate && (
                                             <button
                                                type="button"
                                                onClick={() => setCredentialsEntity(row)}
                                                className="px-3 py-1.5 rounded-md border border-sky-300 text-sky-700 hover:bg-sky-50"
                                             >
                                                Credenciales
                                             </button>
                                          )}
                                          <button
                                             type="button"
                                             onClick={() => setClientsEntity(row)}
                                             className="px-3 py-1.5 rounded-md border border-violet-300 text-violet-700 hover:bg-violet-50"
                                          >
                                             Clientes
                                          </button>
                                          {canUpdate && (
                                             <button
                                                type="button"
                                                onClick={() => onToggleState(row)}
                                                disabled={Number(changingStateId) === Number(row.id)}
                                                className={`px-3 py-1.5 rounded-md text-white ${Number(changingStateId) === Number(row.id) ? 'bg-gray-400' : isActive ? 'bg-[var(--danger)]' : 'bg-emerald-600'}`}
                                             >
                                                {Number(changingStateId) === Number(row.id)
                                                   ? 'Guardando...'
                                                   : isActive ? 'Desactivar' : 'Activar'}
                                             </button>
                                          )}
                                          {canDelete && (
                                             <button
                                                type="button"
                                                onClick={() => onDelete(row)}
                                                disabled={Number(deletingId) === Number(row.id)}
                                                className="px-3 py-1.5 rounded-md border border-[var(--danger)] text-[var(--danger)] hover:bg-[var(--danger)] hover:text-white disabled:opacity-50"
                                             >
                                                {Number(deletingId) === Number(row.id) ? 'Eliminando...' : 'Eliminar'}
                                             </button>
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                              );
                           })}
                        </tbody>
                     </table>
                  </div>
               )}

               {!isLoading && (
                  <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[var(--border-subtle)] pt-3">
                     <div className="text-sm text-[var(--text-soft)]">
                        Pagina {Math.min(page + 1, totalPages)} de {totalPages}
                     </div>
                     <div className="flex items-center gap-2">
                        <button
                           type="button"
                           disabled={page === 0}
                           onClick={() => setPage((p) => Math.max(0, p - 1))}
                           className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] disabled:opacity-50"
                        >
                           Anterior
                        </button>
                        <button
                           type="button"
                           disabled={(page + 1) >= totalPages}
                           onClick={() => setPage((p) => p + 1)}
                           className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] disabled:opacity-50"
                        >
                           Siguiente
                        </button>
                        <select
                           value={pageSize}
                           onChange={(e) => {
                              setPageSize(Number(e.target.value));
                              setPage(0);
                           }}
                           className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg px-2 py-1.5 text-sm"
                        >
                           <option value={25}>25</option>
                           <option value={50}>50</option>
                           <option value={100}>100</option>
                        </select>
                     </div>
                  </div>
               )}
            </section>
         </div>

         <Modal
            isOpen={entityModalOpen}
            onClose={closeEntityModal}
            title={formTitle}
            maxWidth="max-w-xl"
         >
            <form className="space-y-4" onSubmit={onSubmit}>
               <div className="flex flex-col gap-1.5">
                  <label htmlFor="entity-name" className="text-sm text-[var(--text-soft)]">Nombre</label>
                  <input
                     id="entity-name"
                     type="text"
                     value={form.name}
                     onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                     placeholder="Ej: Empresa SpA"
                     maxLength={120}
                     autoComplete="off"
                     autoFocus
                  />
               </div>

               <div className="flex flex-col gap-1.5">
                  <label htmlFor="entity-rut" className="text-sm text-[var(--text-soft)]">RUT</label>
                  <input
                     id="entity-rut"
                     type="text"
                     value={form.rut}
                     onChange={(e) => setForm((s) => ({ ...s, rut: formatRutCL(e.target.value) }))}
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                     placeholder="Ej: 76.123.456-7"
                     maxLength={12}
                     autoComplete="off"
                  />
               </div>

               <div className="flex flex-col gap-1.5">
                  <label htmlFor="entity-legal-name" className="text-sm text-[var(--text-soft)]">Razon social (opcional)</label>
                  <input
                     id="entity-legal-name"
                     type="text"
                     value={form.legalName}
                     onChange={(e) => setForm((s) => ({ ...s, legalName: e.target.value }))}
                     className="border border-[var(--border-subtle)] bg-[var(--surface-1)] rounded-lg p-2"
                     placeholder="Ej: Empresa Servicios Limitada"
                     maxLength={160}
                     autoComplete="off"
                  />
               </div>

               <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 pt-2">
                  <button
                     type="button"
                     onClick={closeEntityModal}
                     disabled={saving}
                     className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)] disabled:opacity-50"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={saving}
                     className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand)] hover:bg-brand-strong'}`}
                  >
                     {saving ? 'Guardando...' : (editingId ? 'Guardar cambios' : 'Crear entidad')}
                  </button>
               </div>
            </form>
         </Modal>

         <Modal
            isOpen={Boolean(credentialsEntity)}
            onClose={() => setCredentialsEntity(null)}
            title="Credenciales de entidad"
            maxWidth="max-w-6xl"
         >
            <EntityCredentialsPanel entity={credentialsEntity} />
         </Modal>

         <Modal
            isOpen={Boolean(clientsEntity)}
            onClose={() => setClientsEntity(null)}
            title="Clientes de la entidad"
            maxWidth="max-w-6xl"
         >
            <ClientUsersPanel entity={clientsEntity} />
         </Modal>
      </div>
   );
}
