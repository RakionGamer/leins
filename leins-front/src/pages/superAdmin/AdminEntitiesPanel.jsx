import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'components/Toaster';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import Tooltip from 'components/Tooltip';
import {
   getAdminEntityAssignments,
   listAssignableEntities,
   assignEntityToAdmin,
   updateAdminEntityAssignment,
   removeEntityFromAdmin
} from '../../services/userApi';

const DEFAULT_FLAGS = {
   canCreate: true,
   canUpdate: true,
   canDelete: false,
   isAdmin: false,
};

function entityName(row) {
   return row?.name || row?.legal_name || row?.entity?.name || row?.entity?.legal_name || `Entidad ${row?.entity_id || row?.id}`;
}

function entityRut(row) {
   return row?.rut || row?.tax_id || row?.entity?.rut || row?.entity?.tax_id || '';
}

const LOCKED_MESSAGE = 'No puedes asignar una entidad que no administras';

const PERMISSION_HELP = {
   canCreate: 'Puede crear cosas nuevas en esta entidad: cuentas bancarias, credenciales, clientes, subir cartolas y conciliar movimientos.',
   canUpdate: 'Puede editar lo ya existente en esta entidad: datos de la entidad, cuentas bancarias, credenciales y clientes.',
   canDelete: 'Puede eliminar cosas en esta entidad: la entidad misma, cuentas bancarias, credenciales, y deshacer conciliaciones.',
   isAdmin: 'Control total sobre la entidad (incluye crear, editar y eliminar). Ademas, puede asignar o quitar esta entidad a otros administradores.',
};

export default function AdminEntitiesPanel({ admin }) {
   const queryClient = useQueryClient();
   const adminId = Number(admin?.id || 0);

   const [search, setSearch] = useState('');
   const [selectedEntityId, setSelectedEntityId] = useState('');
   const [flags, setFlags] = useState(DEFAULT_FLAGS);
   const [saving, setSaving] = useState(false);
   const [removingId, setRemovingId] = useState(null);

   const assignmentsQuery = useQuery({
      queryKey: ['adminEntityAssignments', adminId],
      queryFn: () => getAdminEntityAssignments(adminId),
      enabled: !!adminId
   });

   const entitiesQuery = useQuery({
      queryKey: ['entities-for-assignment', { q: search }],
      queryFn: ({ signal }) => listAssignableEntities({
         q: search,
         limit: 100,
         offset: 0,
         activeOnly: true,
         signal
      }),
      enabled: !!adminId
   });

   const assignedRows = useMemo(
      () => assignmentsQuery.data?.rows || [],
      [assignmentsQuery.data?.rows]
   );
   const visibleEntities = entitiesQuery.data?.rows || [];
   const assignedEntityIds = useMemo(
      () => new Set(assignedRows.map((row) => Number(row.entity_id))),
      [assignedRows]
   );
   const assignableEntities = visibleEntities.filter((row) => !assignedEntityIds.has(Number(row.id)));

   const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: ['adminEntityAssignments', adminId] });
      await queryClient.invalidateQueries({ queryKey: ['entities-admin'] });
      await queryClient.invalidateQueries({ queryKey: ['entities'] });
   };

   const onAssign = async (e) => {
      e.preventDefault();
      const entityId = Number(selectedEntityId);
      if (!entityId) return toast.error('Selecciona una entidad');

      try {
         setSaving(true);
         await assignEntityToAdmin({
            adminId,
            entityId,
            ...flags
         });
         toast.success('Entidad asignada');
         setSelectedEntityId('');
         setFlags(DEFAULT_FLAGS);
         await refresh();
      } catch (err) {
         toast.error(err?.message || 'No se pudo asignar la entidad');
      } finally {
         setSaving(false);
      }
   };

   const toggleFlag = async (row, key) => {
      try {
         const next = {
            canCreate: Boolean(row.can_create),
            canUpdate: Boolean(row.can_update),
            canDelete: Boolean(row.can_delete),
            isAdmin: Boolean(row.is_admin),
            [key]: !Boolean({
               canCreate: row.can_create,
               canUpdate: row.can_update,
               canDelete: row.can_delete,
               isAdmin: row.is_admin,
            }[key])
         };

         await updateAdminEntityAssignment({
            adminId,
            entityId: row.entity_id,
            ...next
         });
         await refresh();
      } catch (err) {
         toast.error(err?.message || 'No se pudo actualizar el permiso');
      }
   };

   const onRemove = async (row) => {
      const ok = window.confirm(`Quitar acceso a ${entityName(row)}?`);
      if (!ok) return;

      try {
         setRemovingId(Number(row.entity_id));
         await removeEntityFromAdmin({ adminId, entityId: row.entity_id });
         toast.success('Entidad quitada');
         await refresh();
      } catch (err) {
         toast.error(err?.message || 'No se pudo quitar la entidad');
      } finally {
         setRemovingId(null);
      }
   };

   return (
      <div className="space-y-5">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <p className="text-sm text-text-soft">Super administrador</p>
               <h3 className="text-lg font-semibold text-heading dark:text-white">
                  {admin?.username || `Admin ${adminId}`}
               </h3>
               <p className="mt-1 text-sm text-text-soft">{admin?.email}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-1 px-3 py-2 text-sm">
               <span className="text-text-soft">Asignadas</span>
               <span className="font-semibold text-heading dark:text-white">{assignedRows.length}</span>
            </div>
         </div>

         <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
            <h4 className="text-base font-semibold text-heading dark:text-white">Asignar entidad</h4>
            <form className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3" onSubmit={onAssign}>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                     <label className="text-sm text-text-soft" htmlFor="entity-assignment-search">Buscar</label>
                     <input
                        id="entity-assignment-search"
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="border border-border-subtle bg-bg-content rounded-lg p-2"
                        placeholder="Nombre o RUT"
                        autoComplete="off"
                     />
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-sm text-text-soft" htmlFor="entity-assignment-select">Entidad</label>
                     <select
                        id="entity-assignment-select"
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                        className="border border-border-subtle bg-bg-content rounded-lg p-2"
                     >
                        <option value="">Selecciona...</option>
                        {assignableEntities.map((row) => (
                           <option key={row.id} value={row.id}>
                              {entityName(row)} {entityRut(row) ? `- ${entityRut(row)}` : ''}
                           </option>
                        ))}
                     </select>
                  </div>
               </div>

               <div className="flex items-end">
                  <button
                     type="submit"
                     disabled={saving}
                     className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand hover:bg-brand-strong'}`}
                  >
                     {saving ? 'Asignando...' : 'Asignar'}
                  </button>
               </div>

               <div className="lg:col-span-2 flex flex-wrap gap-4 pt-1 text-sm text-text-soft">
                  <Tooltip content={PERMISSION_HELP.canCreate}>
                     <label className="inline-flex items-center gap-2 cursor-help">
                        <input type="checkbox" checked={flags.canCreate} onChange={(e) => setFlags((s) => ({ ...s, canCreate: e.target.checked }))} />
                        Crear
                     </label>
                  </Tooltip>
                  <Tooltip content={PERMISSION_HELP.canUpdate}>
                     <label className="inline-flex items-center gap-2 cursor-help">
                        <input type="checkbox" checked={flags.canUpdate} onChange={(e) => setFlags((s) => ({ ...s, canUpdate: e.target.checked }))} />
                        Editar
                     </label>
                  </Tooltip>
                  <Tooltip content={PERMISSION_HELP.canDelete}>
                     <label className="inline-flex items-center gap-2 cursor-help">
                        <input type="checkbox" checked={flags.canDelete} onChange={(e) => setFlags((s) => ({ ...s, canDelete: e.target.checked }))} />
                        Eliminar
                     </label>
                  </Tooltip>
                  <Tooltip content={PERMISSION_HELP.isAdmin}>
                     <label className="inline-flex items-center gap-2 cursor-help">
                        <input type="checkbox" checked={flags.isAdmin} onChange={(e) => setFlags((s) => ({ ...s, isAdmin: e.target.checked }))} />
                        Administrador de entidad
                     </label>
                  </Tooltip>
               </div>
            </form>
         </section>

         <section className="rounded-xl border border-border-subtle bg-surface-1 p-4">
            <h4 className="text-base font-semibold text-heading dark:text-white">Entidades asignadas</h4>

            {assignmentsQuery.error && (
               <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                  {assignmentsQuery.error?.message || 'No se pudieron cargar las asignaciones'}
               </div>
            )}

            {assignmentsQuery.isLoading ? (
               <div className="mt-4 text-sm text-text-soft">Cargando asignaciones...</div>
            ) : (
               <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                     <thead>
                        <tr className="border-b border-border-subtle text-text-soft">
                           <th className="text-left py-2 px-2">Entidad</th>
                           <th className="text-left py-2 px-2">RUT</th>
                           <th className="text-center py-2 px-2">
                              <Tooltip content={PERMISSION_HELP.canCreate}>
                                 <span className="cursor-help border-b border-dotted border-text-soft">Crear</span>
                              </Tooltip>
                           </th>
                           <th className="text-center py-2 px-2">
                              <Tooltip content={PERMISSION_HELP.canUpdate}>
                                 <span className="cursor-help border-b border-dotted border-text-soft">Editar</span>
                              </Tooltip>
                           </th>
                           <th className="text-center py-2 px-2">
                              <Tooltip content={PERMISSION_HELP.canDelete}>
                                 <span className="cursor-help border-b border-dotted border-text-soft">Eliminar</span>
                              </Tooltip>
                           </th>
                           <th className="text-center py-2 px-2">
                              <Tooltip content={PERMISSION_HELP.isAdmin}>
                                 <span className="cursor-help border-b border-dotted border-text-soft">Admin entidad</span>
                              </Tooltip>
                           </th>
                           <th className="text-right py-2 px-2">Acciones</th>
                        </tr>
                     </thead>
                     <tbody>
                        {assignedRows.length === 0 && (
                           <tr>
                              <td colSpan={7} className="py-6 text-center text-text-soft">
                                 Este super administrador no tiene entidades asignadas.
                              </td>
                           </tr>
                        )}
                        {assignedRows.map((row) => {
                           const canManage = row.can_manage !== false;
                           return (
                           <tr key={row.entity_id} className={`border-b border-border-subtle last:border-b-0 ${canManage ? '' : 'bg-gray-50/70 dark:bg-white/5'}`}>
                              <td className="py-2 px-2 text-heading dark:text-white">
                                 <div className="flex items-center gap-2">
                                    <span>{entityName(row)}</span>
                                    {!canManage && (
                                       <Tooltip content={LOCKED_MESSAGE}>
                                          <span className="inline-flex items-center rounded-full bg-amber-100 p-1 text-amber-700 ring-1 ring-amber-200" aria-label={LOCKED_MESSAGE}>
                                             <LockClosedIcon className="h-3.5 w-3.5" />
                                          </span>
                                       </Tooltip>
                                    )}
                                 </div>
                              </td>
                              <td className="py-2 px-2 text-text-soft">{entityRut(row) || '-'}</td>
                              {[
                                 ['canCreate', row.can_create],
                                 ['canUpdate', row.can_update],
                                 ['canDelete', row.can_delete],
                                 ['isAdmin', row.is_admin],
                              ].map(([key, checked]) => (
                                 <td key={key} className="py-2 px-2 text-center">
                                    <Tooltip content={canManage ? null : LOCKED_MESSAGE}>
                                       <span className="inline-flex">
                                          <input
                                             type="checkbox"
                                             checked={Boolean(checked)}
                                             disabled={!canManage}
                                             onChange={() => toggleFlag(row, key)}
                                             aria-label={key}
                                             className={!canManage ? 'cursor-not-allowed opacity-50' : ''}
                                          />
                                       </span>
                                    </Tooltip>
                                 </td>
                              ))}
                              <td className="py-2 px-2 text-right">
                                 {canManage ? (
                                    <button
                                       type="button"
                                       onClick={() => onRemove(row)}
                                       disabled={Number(removingId) === Number(row.entity_id)}
                                       className={`px-3 py-1.5 rounded-md text-white ${Number(removingId) === Number(row.entity_id) ? 'bg-gray-400' : 'bg-danger'}`}
                                    >
                                       {Number(removingId) === Number(row.entity_id) ? 'Quitando...' : 'Quitar'}
                                    </button>
                                 ) : (
                                    <Tooltip content={LOCKED_MESSAGE}>
                                       <span className="inline-flex items-center rounded-md border border-border-subtle bg-bg-content px-2.5 py-1.5 text-xs font-medium text-text-soft">
                                          Bloqueada
                                       </span>
                                    </Tooltip>
                                 )}
                              </td>
                           </tr>
                           );
                        })}
                     </tbody>
                  </table>
               </div>
            )}
         </section>

         {entitiesQuery.error && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
               {entitiesQuery.error?.message || 'No se pudieron cargar entidades disponibles'}
            </div>
         )}
      </div>
   );
}
