import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'components/Toaster';
import {
   listClientUsers,
   createClientUser,
   updateClientUser,
   updateClientUserAccess
} from '../../services/clientUsersApi';

const DEFAULT_FORM = {
   username: '',
   email: '',
   password: '',
   name: '',
   lastName: '',
   readOnly: true,
};

function getEntityRut(entity) {
   return entity?.rut || entity?.tax_id || '';
}

export default function ClientUsersPanel({ entity }) {
   const queryClient = useQueryClient();
   const entityId = Number(entity?.id || 0);
   const canCreate = entity?.permissions?.can_create ?? true;
   const canUpdate = entity?.permissions?.can_update ?? true;

   const [form, setForm] = useState(DEFAULT_FORM);
   const [editingId, setEditingId] = useState(null);
   const [saving, setSaving] = useState(false);
   const [updatingId, setUpdatingId] = useState(null);

   const { data, isLoading, isFetching, error } = useQuery({
      queryKey: ['clientUsers', entityId],
      queryFn: ({ signal }) => listClientUsers({ entityId, signal }),
      enabled: !!entityId
   });

   const rows = data?.rows || [];
   const isEditing = Boolean(editingId);

   const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: ['clientUsers', entityId] });
   };

   const resetForm = () => {
      setEditingId(null);
      setForm(DEFAULT_FORM);
   };

   const startEdit = (row) => {
      setEditingId(Number(row.id));
      setForm({
         ...DEFAULT_FORM,
         username: row.username || '',
         email: row.email || '',
         name: row.name || '',
         lastName: row.last_name || '',
         password: '',
      });
   };

   const onSubmit = async (e) => {
      e.preventDefault();
      if (!entityId) return;

      const username = String(form.username || '').trim();
      const name = String(form.name || '').trim();
      const lastName = String(form.lastName || '').trim();

      if (!username) return toast.error('Ingresa el username del cliente');

      try {
         setSaving(true);

         if (isEditing) {
            const pass = String(form.password || '').trim();
            if (pass && pass.length < 6) return toast.error('La nueva clave debe tener al menos 6 caracteres');
            await updateClientUser({ userId: editingId, entityId, username, name, lastName, password: pass || undefined });
            toast.success('Cliente actualizado correctamente');
         } else {
            const email = String(form.email || '').trim();
            const password = String(form.password || '');
            if (!email) return toast.error('Ingresa el email del cliente');
            if (password.length < 6) return toast.error('La clave debe tener al menos 6 caracteres');

            await createClientUser({ entityId, username, email, password, name, lastName, readOnly: form.readOnly });
            toast.success('Cliente creado correctamente');
         }

         await refresh();
         resetForm();
      } catch (err) {
         toast.error(err?.message || (isEditing ? 'No se pudo actualizar el cliente' : 'No se pudo crear el cliente'));
      } finally {
         setSaving(false);
      }
   };

   const onToggleReadOnly = async (row) => {
      const nextReadOnly = !row.read_only;
      const action = nextReadOnly ? 'quitar' : 'otorgar';
      const ok = window.confirm(
         `¿Vas a ${action} el permiso de deshacer conciliaciones a "${row.username}" en esta entidad? ¿Continuar?`
      );
      if (!ok) return;

      try {
         setUpdatingId(Number(row.id));
         await updateClientUserAccess({ userId: row.id, entityId, readOnly: nextReadOnly });
         toast.success('Permiso actualizado');
         await refresh();
      } catch (err) {
         toast.error(err?.message || 'No se pudo actualizar el permiso');
      } finally {
         setUpdatingId(null);
      }
   };

   return (
      <div className="space-y-5">
         {/* Top Info Bar */}
         <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-[#F8FAFF] border border-[#E2EAFD]">
            <div>
               <p className="text-xs font-bold text-[#8E9BB5] uppercase tracking-wider">Entidad</p>
               <h3 className="text-base font-bold text-[#0A1A3F] mt-0.5">
                  {entity?.name || entity?.legal_name || `Entidad ${entityId}`}
               </h3>
               <p className="text-xs font-mono text-[#55607A]">{getEntityRut(entity) || 'Sin RUT registrado'}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-[#E2EAFD] bg-white px-3.5 py-2 text-xs shadow-2xs">
               <span className="text-[#55607A] font-medium">Clientes asociados:</span>
               <span className="font-bold text-[#0A1A3F]">{rows.length}</span>
               {isFetching && <span className="text-[10px] text-[#8E9BB5]">(actualizando)</span>}
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Formulario */}
            <section className="xl:col-span-2 rounded-2xl border border-[#E2EAFD] bg-white p-5 shadow-xs">
               <h4 className="text-sm font-bold text-[#0A1A3F]">
                  {isEditing ? 'Editar cliente' : 'Nuevo usuario cliente'}
               </h4>
               <p className="mt-1 text-xs text-[#55607A]">
                  {isEditing
                     ? 'Actualiza los datos del cliente o asigna una nueva contraseña.'
                     : 'Crea una cuenta para que el cliente ingrese al portal y autogestione esta entidad.'}
               </p>

               <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
                  <div className="flex flex-col gap-1">
                     <label htmlFor="client-username" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                        Username / Usuario *
                     </label>
                     <input
                        id="client-username"
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                        className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                        placeholder="Ej: cliente.empresa"
                        maxLength={60}
                        autoComplete="off"
                     />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1">
                        <label htmlFor="client-name" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                           Nombre
                        </label>
                        <input
                           id="client-name"
                           type="text"
                           value={form.name}
                           onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                           className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                           placeholder="Ej: Juan"
                           maxLength={255}
                           autoComplete="off"
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label htmlFor="client-last-name" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                           Apellido
                        </label>
                        <input
                           id="client-last-name"
                           type="text"
                           value={form.lastName}
                           onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
                           className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                           placeholder="Ej: Pérez"
                           maxLength={255}
                           autoComplete="off"
                        />
                     </div>
                  </div>

                  {isEditing ? (
                     <div className="flex flex-col gap-1">
                        <label htmlFor="client-password" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                           Nueva Clave <span className="text-[10px] text-[#8E9BB5] font-normal">(Opcional)</span>
                        </label>
                        <input
                           id="client-password"
                           type="password"
                           value={form.password}
                           onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                           className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                           placeholder="Dejar vacía para mantener la actual"
                           minLength={6}
                           autoComplete="new-password"
                        />
                        <span className="text-[10px] text-[#8E9BB5]">
                           Mínimo 6 caracteres. Si no deseas cambiarla, déjala en blanco.
                        </span>
                     </div>
                  ) : (
                     <>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="client-email" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Email de acceso *
                           </label>
                           <input
                              id="client-email"
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder="cliente@empresa.cl"
                              maxLength={255}
                              autoComplete="off"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="client-password" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Clave inicial *
                           </label>
                           <input
                              id="client-password"
                              type="password"
                              value={form.password}
                              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder="Mínimo 6 caracteres"
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#55607A] cursor-pointer pt-1">
                           <input
                              type="checkbox"
                              checked={form.readOnly}
                              onChange={(e) => setForm((s) => ({ ...s, readOnly: e.target.checked }))}
                              className="rounded border-[#E2EAFD] text-[#1F6BFF] focus:ring-[#1F6BFF]"
                           />
                           <span>Solo lectura (no podrá deshacer conciliaciones)</span>
                        </label>
                     </>
                  )}

                  {(isEditing ? canUpdate : canCreate) ? (
                     <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2EAFD]">
                        <button
                           type="submit"
                           disabled={saving}
                           className={`px-5 py-2.5 rounded-full text-white text-xs font-bold transition shadow-xs cursor-pointer ${
                              saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#1F6BFF] hover:bg-[#1657D7]'
                           }`}
                        >
                           {saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Crear cliente')}
                        </button>
                        {isEditing && (
                           <button
                              type="button"
                              onClick={resetForm}
                              className="px-4 py-2 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#55607A] text-xs font-bold cursor-pointer"
                           >
                              Cancelar
                           </button>
                        )}
                     </div>
                  ) : (
                     <div className="pt-2 text-xs text-[#8E9BB5]">
                        No tienes permiso para {isEditing ? 'editar' : 'crear'} clientes en esta entidad.
                     </div>
                  )}
               </form>
            </section>

            {/* Listado de clientes */}
            <section className="xl:col-span-3 rounded-2xl border border-[#E2EAFD] bg-white p-5 shadow-xs">
               <h4 className="text-sm font-bold text-[#0A1A3F]">Clientes existentes</h4>
               <p className="text-xs text-[#55607A] mt-0.5">Cuentas creadas para esta entidad y sus permisos de operación.</p>

               {error && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs p-3">
                     {error?.message || 'No se pudieron cargar los clientes'}
                  </div>
               )}

               {isLoading ? (
                  <div className="mt-6 text-xs text-[#8E9BB5] text-center py-8">Cargando clientes...</div>
               ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2EAFD]">
                     <table className="w-full min-w-[580px] text-xs">
                        <thead>
                           <tr className="bg-[#F0F4FD] text-[#55607A] text-[11px] font-bold uppercase tracking-wider border-b border-[#E2EAFD]">
                              <th className="text-left py-2.5 px-3">Usuario</th>
                              <th className="text-left py-2.5 px-3">Nombre</th>
                              <th className="text-left py-2.5 px-3">Email</th>
                              <th className="text-left py-2.5 px-3">Deshacer conc.</th>
                              <th className="text-right py-2.5 px-3">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F4FD]">
                           {rows.length === 0 ? (
                              <tr>
                                 <td colSpan={5} className="py-8 text-center text-[#8E9BB5]">
                                    Aún no hay clientes creados para esta entidad.
                                 </td>
                              </tr>
                           ) : (
                              rows.map((row) => (
                                 <tr key={row.id} className="hover:bg-[#F9FBFF] transition">
                                    <td className="py-2.5 px-3 font-bold text-[#0A1A3F]">{row.username}</td>
                                    <td className="py-2.5 px-3 text-[#55607A] font-medium">
                                       {[row.name, row.last_name].filter(Boolean).join(' ') || '-'}
                                    </td>
                                    <td className="py-2.5 px-3 text-[#55607A] font-mono">{row.email}</td>
                                    <td className="py-2.5 px-3">
                                       <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                          !row.read_only ? 'bg-[#E8F8F0] text-[#0D9488]' : 'bg-gray-100 text-gray-600'
                                       }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${!row.read_only ? 'bg-[#10B981]' : 'bg-gray-400'}`} />
                                          {!row.read_only ? 'Sí' : 'No'}
                                       </span>
                                    </td>
                                    <td className="py-2.5 px-3 text-right">
                                       <div className="flex justify-end gap-1.5">
                                          {canUpdate && (
                                             <button
                                                type="button"
                                                onClick={() => startEdit(row)}
                                                className="px-2.5 py-1 rounded-lg border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-semibold cursor-pointer"
                                             >
                                                Editar
                                             </button>
                                          )}
                                          {canUpdate && (
                                             <button
                                                type="button"
                                                onClick={() => onToggleReadOnly(row)}
                                                disabled={Number(updatingId) === Number(row.id)}
                                                className={`px-2.5 py-1 rounded-lg text-white text-xs font-semibold cursor-pointer ${
                                                   Number(updatingId) === Number(row.id)
                                                      ? 'bg-gray-400'
                                                      : row.read_only
                                                         ? 'bg-[#10B981] hover:bg-[#059669]'
                                                         : 'bg-rose-600 hover:bg-rose-700'
                                                }`}
                                             >
                                                {Number(updatingId) === Number(row.id)
                                                   ? '...'
                                                   : row.read_only ? 'Permitir' : 'Bloquear'}
                                             </button>
                                          )}
                                       </div>
                                    </td>
                                 </tr>
                              ))
                           )}
                        </tbody>
                     </table>
                  </div>
               )}
            </section>
         </div>
      </div>
   );
}
