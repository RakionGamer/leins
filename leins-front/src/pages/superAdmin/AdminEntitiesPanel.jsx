import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'components/Toaster';
import Tooltip from 'components/Tooltip';
import {
   EntidadesIcon,
   CandadoIcon,
   BuscarIcon,
   EliminarIcon
} from 'components/icons/SidebarIcons';
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
   canCreate: 'Puede crear elementos en esta entidad: cuentas bancarias, credenciales, clientes, cartolas y conciliaciones.',
   canUpdate: 'Puede editar datos existentes: entidad, cuentas bancarias, credenciales y clientes.',
   canDelete: 'Puede eliminar elementos: entidad, cuentas bancarias, credenciales y deshacer conciliaciones.',
   isAdmin: 'Control total de la entidad. Permite asignar o quitar esta entidad a otros administradores.',
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
         toast.success('Entidad asignada correctamente');
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
      const ok = window.confirm(`¿Quitar acceso a ${entityName(row)}?`);
      if (!ok) return;

      try {
         setRemovingId(Number(row.entity_id));
         await removeEntityFromAdmin({ adminId, entityId: row.entity_id });
         toast.success('Entidad desvinculada');
         await refresh();
      } catch (err) {
         toast.error(err?.message || 'No se pudo quitar la entidad');
      } finally {
         setRemovingId(null);
      }
   };

   return (
      <div className="space-y-6">
         {/* Admin Profile Summary Card */}
         <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-[#F8FAFF] border border-[#E2EAFD]">
            <div className="flex items-center gap-3.5">
               <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#1F6BFF] to-[#4B88FF] text-white flex items-center justify-center font-nunito font-black text-base shadow-xs">
                  {(admin?.username || 'A').slice(0, 2).toUpperCase()}
               </div>
               <div>
                  <div className="flex items-center gap-2">
                     <span className="text-[10px] font-black uppercase tracking-wider text-[#1F6BFF] bg-[#EFF3FF] px-2 py-0.5 rounded-md border border-[#DCE5FF]">
                        Super Administrador
                     </span>
                  </div>
                  <h4 className="font-nunito font-black text-base text-[#0A1A3F] leading-tight mt-0.5">
                     {admin?.username || `Admin ${adminId}`}
                  </h4>
                  <p className="text-xs text-[#55607A]">{admin?.email || 'Sin correo registrado'}</p>
               </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#DCE5FF] bg-[#EFF3FF] px-3.5 py-1.5 text-xs">
               <span className="text-[#55607A] font-semibold">Entidades Asignadas</span>
               <span className="font-black text-[#1F6BFF] bg-white px-2 py-0.5 rounded-full border border-[#DCE5FF]">
                  {assignedRows.length}
               </span>
            </div>
         </div>

         {/* Form: Asignar Entidad */}
         <section className="rounded-2xl border border-[#E2EAFD] bg-white p-5 shadow-xs">
            <div className="flex items-center gap-2.5 mb-3.5">
               <div className="w-7 h-7 rounded-xl bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                  <EntidadesIcon className="w-4 h-4" />
               </div>
               <h4 className="font-nunito font-black text-sm text-[#0A1A3F]">Asignar Nueva Entidad</h4>
            </div>

            <form className="space-y-4" onSubmit={onAssign}>
               <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-4 flex flex-col gap-1.5">
                     <label className="text-[11px] font-bold uppercase tracking-wider text-[#55607A]" htmlFor="entity-assignment-search">
                        Buscar Entidad
                     </label>
                     <div className="relative">
                        <BuscarIcon className="w-4 h-4 text-[#55607A] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                           id="entity-assignment-search"
                           type="text"
                           value={search}
                           onChange={(e) => setSearch(e.target.value)}
                           className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl pl-9 pr-3 py-2 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all"
                           placeholder="Filtrar por nombre o RUT..."
                           autoComplete="off"
                        />
                     </div>
                  </div>

                  <div className="sm:col-span-5 flex flex-col gap-1.5">
                     <label className="text-[11px] font-bold uppercase tracking-wider text-[#55607A]" htmlFor="entity-assignment-select">
                        Seleccionar Entidad
                     </label>
                     <select
                        id="entity-assignment-select"
                        value={selectedEntityId}
                        onChange={(e) => setSelectedEntityId(e.target.value)}
                        className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3 py-2 text-xs text-[#0A1A3F] outline-hidden transition-all"
                     >
                        <option value="">Selecciona una entidad ({assignableEntities.length} disponibles)...</option>
                        {assignableEntities.map((row) => (
                           <option key={row.id} value={row.id}>
                              {entityName(row)} {entityRut(row) ? `(${entityRut(row)})` : ''}
                           </option>
                        ))}
                     </select>
                  </div>

                  <div className="sm:col-span-3 flex items-end">
                     <button
                        type="submit"
                        disabled={saving || !selectedEntityId}
                        className={`w-full py-2.5 px-4 rounded-full text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 ${
                           saving || !selectedEntityId
                              ? 'bg-[#E2EAFD] text-[#55607A] cursor-not-allowed opacity-70'
                              : 'bg-[#1F6BFF] hover:bg-[#1657D7] text-white hover:shadow-md'
                        }`}
                     >
                        {saving ? 'Asignando...' : 'Asignar Entidad'}
                     </button>
                  </div>
               </div>

               {/* Permisos de asignación */}
               <div className="p-3 bg-[#F8FAFF] rounded-xl border border-[#E2EAFD] flex flex-wrap items-center gap-4">
                  <span className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">Permisos iniciales:</span>
                  {[
                     { key: 'canCreate', label: 'Crear', help: PERMISSION_HELP.canCreate },
                     { key: 'canUpdate', label: 'Editar', help: PERMISSION_HELP.canUpdate },
                     { key: 'canDelete', label: 'Eliminar', help: PERMISSION_HELP.canDelete },
                     { key: 'isAdmin', label: 'Administrador de entidad', help: PERMISSION_HELP.isAdmin },
                  ].map(({ key, label, help }) => (
                     <Tooltip key={key} content={help}>
                        <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#0A1A3F] hover:text-[#1F6BFF] transition-colors">
                           <input
                              type="checkbox"
                              checked={flags[key]}
                              onChange={(e) => setFlags((s) => ({ ...s, [key]: e.target.checked }))}
                              className="w-4 h-4 rounded text-[#1F6BFF] accent-[#1F6BFF] border-[#E2EAFD] focus:ring-0 cursor-pointer"
                           />
                           <span>{label}</span>
                        </label>
                     </Tooltip>
                  ))}
               </div>
            </form>
         </section>

         {/* Tabla de Entidades Asignadas */}
         <section className="rounded-2xl border border-[#E2EAFD] bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2EAFD] flex items-center justify-between bg-white">
               <h4 className="font-nunito font-black text-sm text-[#0A1A3F]">Entidades Asignadas</h4>
               <span className="text-xs text-[#55607A]">{assignedRows.length} vinculadas</span>
            </div>

            {assignmentsQuery.error && (
               <div className="m-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] text-[#B91C1C] text-xs p-3 font-semibold">
                  {assignmentsQuery.error?.message || 'No se pudieron cargar las asignaciones'}
               </div>
            )}

            {assignmentsQuery.isLoading ? (
               <div className="py-12 text-center text-xs text-[#55607A] font-semibold animate-pulse">
                  Cargando asignaciones...
               </div>
            ) : (
               <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-xs">
                     <thead>
                        <tr className="bg-[#F0F4FD] text-[#55607A] text-[11px] font-bold uppercase tracking-wider">
                           <th className="text-left py-3 px-4">Entidad</th>
                           <th className="text-left py-3 px-4">RUT</th>
                           <th className="text-center py-3 px-3">
                              <Tooltip content={PERMISSION_HELP.canCreate}>
                                 <span className="cursor-help border-b border-dotted border-[#55607A]">Crear</span>
                              </Tooltip>
                           </th>
                           <th className="text-center py-3 px-3">
                              <Tooltip content={PERMISSION_HELP.canUpdate}>
                                 <span className="cursor-help border-b border-dotted border-[#55607A]">Editar</span>
                              </Tooltip>
                           </th>
                           <th className="text-center py-3 px-3">
                              <Tooltip content={PERMISSION_HELP.canDelete}>
                                 <span className="cursor-help border-b border-dotted border-[#55607A]">Eliminar</span>
                              </Tooltip>
                           </th>
                           <th className="text-center py-3 px-3">
                              <Tooltip content={PERMISSION_HELP.isAdmin}>
                                 <span className="cursor-help border-b border-dotted border-[#55607A]">Admin Entidad</span>
                              </Tooltip>
                           </th>
                           <th className="text-right py-3 px-4">Acción</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-[#E2EAFD]/70">
                        {assignedRows.length === 0 && (
                           <tr>
                              <td colSpan={7} className="py-10 text-center text-xs text-[#55607A]">
                                 Este super administrador no tiene entidades asignadas aún.
                              </td>
                           </tr>
                        )}
                        {assignedRows.map((row) => {
                           const canManage = row.can_manage !== false;
                           return (
                              <tr key={row.entity_id} className={`hover:bg-[#F9FBFF] transition-colors ${canManage ? '' : 'bg-gray-50/60'}`}>
                                 <td className="py-3 px-4">
                                    <div className="flex items-center gap-2">
                                       <span className="font-bold text-[#0A1A3F]">{entityName(row)}</span>
                                       {!canManage && (
                                          <Tooltip content={LOCKED_MESSAGE}>
                                             <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2 py-0.5 text-[10px] font-bold text-[#B45309] border border-[#FDE68A]" aria-label={LOCKED_MESSAGE}>
                                                <CandadoIcon className="h-3 w-3" /> Bloqueada
                                             </span>
                                          </Tooltip>
                                       )}
                                    </div>
                                 </td>
                                 <td className="py-3 px-4 text-[#55607A] font-medium">{entityRut(row) || '-'}</td>
                                 {[
                                    ['canCreate', row.can_create],
                                    ['canUpdate', row.can_update],
                                    ['canDelete', row.can_delete],
                                    ['isAdmin', row.is_admin],
                                 ].map(([key, checked]) => (
                                    <td key={key} className="py-3 px-3 text-center">
                                       <Tooltip content={canManage ? null : LOCKED_MESSAGE}>
                                          <span className="inline-flex items-center justify-center">
                                             <input
                                                type="checkbox"
                                                checked={Boolean(checked)}
                                                disabled={!canManage}
                                                onChange={() => toggleFlag(row, key)}
                                                aria-label={key}
                                                className={`w-4 h-4 rounded text-[#1F6BFF] accent-[#1F6BFF] border-[#E2EAFD] ${
                                                   !canManage ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'
                                                }`}
                                             />
                                          </span>
                                       </Tooltip>
                                    </td>
                                 ))}
                                 <td className="py-3 px-4 text-right">
                                    {canManage ? (
                                       <button
                                          type="button"
                                          onClick={() => onRemove(row)}
                                          disabled={Number(removingId) === Number(row.entity_id)}
                                          className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full text-[#E5484D] hover:bg-[#FDF0F0] border border-[#E5484D]/30 transition-colors ${
                                             Number(removingId) === Number(row.entity_id) ? 'opacity-50 cursor-not-allowed' : ''
                                          }`}
                                       >
                                          <EliminarIcon className="w-3.5 h-3.5" />
                                          {Number(removingId) === Number(row.entity_id) ? 'Quitando...' : 'Quitar'}
                                       </button>
                                    ) : (
                                       <Tooltip content={LOCKED_MESSAGE}>
                                          <span className="inline-flex items-center gap-1 rounded-full border border-[#E2EAFD] bg-[#F8FAFF] px-2.5 py-1 text-[11px] font-bold text-[#55607A]">
                                             <CandadoIcon className="w-3 h-3 text-[#55607A]" /> Bloqueada
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
            <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E] font-medium">
               {entitiesQuery.error?.message || 'No se pudieron cargar entidades disponibles'}
            </div>
         )}
      </div>
   );
}
