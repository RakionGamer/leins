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
            await updateClientUser({ userId: editingId, entityId, username, name, lastName });
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
         `Vas a ${action} el permiso de deshacer conciliaciones a "${row.username}" en esta entidad. Continuar?`
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
      <div className="space-y-4">
         <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
               <p className="text-sm text-[var(--text-soft)]">Entidad</p>
               <h3 className="text-lg font-semibold text-[var(--heading)]">
                  {entity?.name || entity?.legal_name || `Entidad ${entityId}`}
               </h3>
               <p className="mt-1 text-sm text-[var(--text-soft)]">{getEntityRut(entity) || 'Sin RUT registrado'}</p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3 py-2 text-sm">
               <span className="text-[var(--text-soft)]">Clientes</span>
               <span className="font-semibold text-[var(--heading)]">{rows.length}</span>
               {isFetching && <span className="text-xs text-[var(--text-soft)]">(actualizando)</span>}
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <section className="xl:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
               <h4 className="text-base font-semibold text-[var(--heading)]">
                  {isEditing ? 'Editar cliente' : 'Nuevo cliente'}
               </h4>
               <p className="mt-1 text-xs text-[var(--text-soft)]">
                  {isEditing
                     ? 'Solo puedes cambiar username, nombre y apellido. El email y la clave no se editan aqui.'
                     : 'Crea una cuenta para que el cliente ingrese al portal (login separado) y autogestione esta entidad.'}
               </p>
               <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                  <div className="flex flex-col gap-1">
                     <label htmlFor="client-username" className="text-sm text-[var(--text-soft)]">Username</label>
                     <input
                        id="client-username"
                        type="text"
                        value={form.username}
                        onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                        className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                        placeholder="Ej: cliente.empresa"
                        maxLength={60}
                        autoComplete="off"
                     />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                     <div className="flex flex-col gap-1">
                        <label htmlFor="client-name" className="text-sm text-[var(--text-soft)]">Nombre</label>
                        <input
                           id="client-name"
                           type="text"
                           value={form.name}
                           onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                           className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                           placeholder="Ej: Juan"
                           maxLength={255}
                           autoComplete="off"
                        />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label htmlFor="client-last-name" className="text-sm text-[var(--text-soft)]">Apellido</label>
                        <input
                           id="client-last-name"
                           type="text"
                           value={form.lastName}
                           onChange={(e) => setForm((s) => ({ ...s, lastName: e.target.value }))}
                           className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                           placeholder="Ej: Perez"
                           maxLength={255}
                           autoComplete="off"
                        />
                     </div>
                  </div>

                  {!isEditing && (
                     <>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="client-email" className="text-sm text-[var(--text-soft)]">Email</label>
                           <input
                              id="client-email"
                              type="email"
                              value={form.email}
                              onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder="cliente@empresa.cl"
                              maxLength={255}
                              autoComplete="off"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="client-password" className="text-sm text-[var(--text-soft)]">Clave</label>
                           <input
                              id="client-password"
                              type="password"
                              value={form.password}
                              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder="Minimo 6 caracteres"
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                        <label className="inline-flex items-center gap-2 text-sm text-[var(--text-main)]">
                           <input
                              type="checkbox"
                              checked={form.readOnly}
                              onChange={(e) => setForm((s) => ({ ...s, readOnly: e.target.checked }))}
                           />
                           Solo lectura (no podra deshacer conciliaciones)
                        </label>
                     </>
                  )}

                  {(isEditing ? canUpdate : canCreate) ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                     <button
                        type="submit"
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand)]'}`}
                     >
                        {saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Crear cliente')}
                     </button>
                     {isEditing && (
                        <button
                           type="button"
                           onClick={resetForm}
                           className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)]"
                        >
                           Cancelar
                        </button>
                     )}
                  </div>
                  ) : (
                     <div className="pt-1 text-sm text-[var(--text-soft)]">
                        No tienes permiso para {isEditing ? 'editar' : 'crear'} clientes en esta entidad.
                     </div>
                  )}
               </form>
            </section>

            <section className="xl:col-span-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
               <h4 className="text-base font-semibold text-[var(--heading)]">Clientes existentes</h4>

               {error && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                     {error?.message || 'No se pudieron cargar los clientes'}
                  </div>
               )}

               {isLoading ? (
                  <div className="mt-4 text-sm text-[var(--text-soft)]">Cargando clientes...</div>
               ) : (
                  <div className="mt-4 overflow-x-auto">
                     <table className="w-full min-w-[680px] text-sm">
                        <thead>
                           <tr className="border-b border-[var(--border-subtle)] text-[var(--text-soft)]">
                              <th className="text-left py-2 px-2">Username</th>
                              <th className="text-left py-2 px-2">Nombre</th>
                              <th className="text-left py-2 px-2">Email</th>
                              <th className="text-left py-2 px-2">Puede deshacer conciliaciones</th>
                              <th className="text-right py-2 px-2">Acciones</th>
                           </tr>
                        </thead>
                        <tbody>
                           {rows.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="py-6 text-center text-[var(--text-soft)]">
                                    Aun no hay clientes creados para esta entidad.
                                 </td>
                              </tr>
                           )}
                           {rows.map((row) => (
                              <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                                 <td className="py-2 px-2 text-[var(--text-main)]">{row.username}</td>
                                 <td className="py-2 px-2 text-[var(--text-main)]">
                                    {[row.name, row.last_name].filter(Boolean).join(' ') || '-'}
                                 </td>
                                 <td className="py-2 px-2 text-[var(--text-main)]">{row.email}</td>
                                 <td className="py-2 px-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${!row.read_only ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                                       {!row.read_only ? 'Si' : 'No'}
                                    </span>
                                 </td>
                                 <td className="py-2 px-2">
                                    <div className="flex justify-end gap-2">
                                       {canUpdate && (
                                          <button
                                             type="button"
                                             onClick={() => startEdit(row)}
                                             className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-content)]"
                                          >
                                             Editar
                                          </button>
                                       )}
                                       {canUpdate && (
                                          <button
                                             type="button"
                                             onClick={() => onToggleReadOnly(row)}
                                             disabled={Number(updatingId) === Number(row.id)}
                                             className={`px-3 py-1.5 rounded-md text-white ${Number(updatingId) === Number(row.id) ? 'bg-gray-400' : row.read_only ? 'bg-emerald-600' : 'bg-[var(--danger)]'}`}
                                          >
                                             {Number(updatingId) === Number(row.id)
                                                ? 'Guardando...'
                                                : row.read_only ? 'Habilitar' : 'Quitar permiso'}
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
            </section>
         </div>
      </div>
   );
}
