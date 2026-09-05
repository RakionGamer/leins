import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'components/Toaster';
import { formatRutCL, validateRut } from '../../utils/validators';
import {
   listCredentials,
   createCredential,
   updateCredential,
   deleteCredential,
   revealCredential
} from '../../services/credentialsApi';

const DEFAULT_FORM = {
   type: 'SII',
   rut: '',
   clave: '',
   confirmClave: '',
   bank: 'santander-officebanking',
   username: '',
   dv: '',
   password: '',
   confirmPassword: '',
};

function normalizeType(value) {
   return String(value || 'SII').toUpperCase() === 'BANK' ? 'BANK' : 'SII';
}

function getEntityRut(entity) {
   return entity?.rut || entity?.tax_id || '';
}

function credentialLabel(row) {
   if (row?.type === 'SII') return row.rut || [row.rut_sin_dv, row.dv].filter(Boolean).join('-') || 'SII';
   return [row.bank, row.username].filter(Boolean).join(' / ') || 'Banco';
}

function revealedSecret(row, revealed) {
   const value = revealed[row.id];
   if (!value) return row.secret_preview || '********';
   return value;
}

export default function EntityCredentialsPanel({ entity }) {
   const queryClient = useQueryClient();
   const entityId = Number(entity?.id || 0);
   const canDelete = entity?.permissions?.can_delete ?? true;
   const canCreate = entity?.permissions?.can_create ?? true;
   const canUpdate = entity?.permissions?.can_update ?? true;

   const [form, setForm] = useState(() => ({
      ...DEFAULT_FORM,
      rut: formatRutCL(getEntityRut(entity))
   }));
   const [editingId, setEditingId] = useState(null);
   const [saving, setSaving] = useState(false);
   const [deletingId, setDeletingId] = useState(null);
   const [revealingId, setRevealingId] = useState(null);
   const [revealed, setRevealed] = useState({});

   const { data, isLoading, isFetching, error } = useQuery({
      queryKey: ['entityCredentials', entityId],
      queryFn: ({ signal }) => listCredentials({ entityId, signal }),
      enabled: !!entityId
   });

   const rows = data?.rows || [];
   const total = Number(data?.total || rows.length || 0);
   const formType = normalizeType(form.type);
   const isEditing = Boolean(editingId);

   const formTitle = useMemo(
      () => (isEditing ? 'Editar credencial' : 'Nueva credencial'),
      [isEditing]
   );

   useEffect(() => {
      resetForm();
      setRevealed({});
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [entityId]);

   const refresh = async () => {
      await queryClient.invalidateQueries({ queryKey: ['entityCredentials', entityId] });
   };

   function resetForm(nextType = 'SII') {
      setEditingId(null);
      setForm({
         ...DEFAULT_FORM,
         type: nextType,
         rut: formatRutCL(getEntityRut(entity)),
      });
   }

   function startEdit(row) {
      const type = normalizeType(row.type);
      setEditingId(Number(row.id));
      setForm({
         ...DEFAULT_FORM,
         type,
         rut: type === 'SII' ? formatRutCL(row.rut || getEntityRut(entity)) : '',
         bank: type === 'BANK' ? (row.bank || 'santander-officebanking') : DEFAULT_FORM.bank,
         username: type === 'BANK' ? (row.username || '') : '',
         dv: type === 'BANK' ? (row.dv || '') : '',
      });
   }

   function buildPayload() {
      if (formType === 'SII') {
         const rut = String(form.rut || getEntityRut(entity) || '').trim();
         const rutError = validateRut(rut);
         const clave = String(form.clave || '');
         const confirmClave = String(form.confirmClave || '');

         if (rutError) throw new Error(rutError);
         if (!isEditing && !clave.trim()) throw new Error('Ingresa la clave SII');
         if ((clave || confirmClave) && clave !== confirmClave) {
            throw new Error('Las claves SII no coinciden');
         }

         const payload = { type: 'SII', rut };
         if (clave.trim()) payload.clave = clave;
         return payload;
      }

      const bank = String(form.bank || '').trim();
      const username = String(form.username || '').trim();
      const dv = String(form.dv || '').trim().toUpperCase();
      const password = String(form.password || '');
      const confirmPassword = String(form.confirmPassword || '');

      if (!bank) throw new Error('Selecciona o ingresa el banco');
      if (!username) throw new Error('Ingresa el usuario o RUT de acceso');
      if (!isEditing && !password.trim()) throw new Error('Ingresa la clave bancaria');
      if ((password || confirmPassword) && password !== confirmPassword) {
         throw new Error('Las claves bancarias no coinciden');
      }

      const payload = { type: 'BANK', bank, username };
      if (dv) payload.dv = dv;
      if (password.trim()) payload.password = password;
      return payload;
   }

   const onSubmit = async (e) => {
      e.preventDefault();
      if (!entityId) return;

      try {
         const payload = buildPayload();
         setSaving(true);

         if (editingId) {
            await updateCredential({ entityId, id: editingId, payload });
            toast.success('Credencial actualizada');
         } else {
            await createCredential({ entityId, payload });
            toast.success('Credencial creada');
         }

         await refresh();
         resetForm(payload.type);
      } catch (err) {
         toast.error(err?.message || 'No se pudo guardar la credencial');
      } finally {
         setSaving(false);
      }
   };

   const onDelete = async (row) => {
      const ok = window.confirm(`Eliminar la credencial ${credentialLabel(row)}?`);
      if (!ok) return;

      try {
         setDeletingId(Number(row.id));
         await deleteCredential({ entityId, id: row.id });
         toast.success('Credencial eliminada');
         await refresh();
         if (Number(editingId) === Number(row.id)) resetForm();
      } catch (err) {
         toast.error(err?.message || 'No se pudo eliminar la credencial');
      } finally {
         setDeletingId(null);
      }
   };

   const onReveal = async (row) => {
      const ok = window.confirm(
         'Vas a revelar una clave de acceso externa. Esta accion quedara auditada. Deseas continuar?'
      );
      if (!ok) return;

      try {
         setRevealingId(Number(row.id));
         const out = await revealCredential({ entityId, id: row.id });
         const secret = out?.row?.secret || {};
         const value = row.type === 'SII' ? secret.clave : secret.password;
         if (!value) throw new Error('No fue posible revelar la clave');

         setRevealed((prev) => ({ ...prev, [row.id]: value }));
         toast.success('Clave revelada por 15 segundos');

         setTimeout(() => {
            setRevealed((prev) => {
               const next = { ...prev };
               delete next[row.id];
               return next;
            });
         }, 15000);
      } catch (err) {
         toast.error(err?.message || 'No se pudo revelar la credencial');
      } finally {
         setRevealingId(null);
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
               <span className="text-[var(--text-soft)]">Credenciales</span>
               <span className="font-semibold text-[var(--heading)]">{total}</span>
               {isFetching && <span className="text-xs text-[var(--text-soft)]">(actualizando)</span>}
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
            <section className="xl:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
               <h4 className="text-base font-semibold text-[var(--heading)]">{formTitle}</h4>
               <form className="mt-4 space-y-3" onSubmit={onSubmit}>
                  <div className="flex flex-col gap-1">
                     <label htmlFor="credential-type" className="text-sm text-[var(--text-soft)]">Tipo</label>
                     <select
                        id="credential-type"
                        value={form.type}
                        disabled={isEditing}
                        onChange={(e) => resetForm(e.target.value)}
                        className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2 disabled:opacity-70"
                     >
                        <option value="SII">SII</option>
                        <option value="BANK">Banco</option>
                     </select>
                  </div>

                  {formType === 'SII' ? (
                     <>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-rut" className="text-sm text-[var(--text-soft)]">RUT contribuyente</label>
                           <input
                              id="credential-rut"
                              type="text"
                              value={form.rut}
                              onChange={(e) => setForm((s) => ({ ...s, rut: formatRutCL(e.target.value) }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder="Ej: 76.123.456-7"
                              maxLength={12}
                              autoComplete="off"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-clave" className="text-sm text-[var(--text-soft)]">Clave SII</label>
                           <input
                              id="credential-clave"
                              type="password"
                              value={form.clave}
                              onChange={(e) => setForm((s) => ({ ...s, clave: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder={isEditing ? 'Deja vacio para mantener la clave actual' : 'Clave SII'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-confirm-clave" className="text-sm text-[var(--text-soft)]">Repetir clave SII</label>
                           <input
                              id="credential-confirm-clave"
                              type="password"
                              value={form.confirmClave}
                              onChange={(e) => setForm((s) => ({ ...s, confirmClave: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder={isEditing ? 'Solo si cambias la clave' : 'Repite la clave'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                     </>
                  ) : (
                     <>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-bank" className="text-sm text-[var(--text-soft)]">Banco</label>
                           <select
                              id="credential-bank"
                              value={form.bank}
                              onChange={(e) => setForm((s) => ({ ...s, bank: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                           >
                              <option value="santander-officebanking">Santander OfficeBanking</option>
                           </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px] gap-3">
                           <div className="flex flex-col gap-1">
                              <label htmlFor="credential-username" className="text-sm text-[var(--text-soft)]">Usuario / RUT</label>
                              <input
                                 id="credential-username"
                                 type="text"
                                 value={form.username}
                                 onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                                 className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                                 placeholder="Ej: 12345678"
                                 maxLength={120}
                                 autoComplete="off"
                              />
                           </div>
                           <div className="flex flex-col gap-1">
                              <label htmlFor="credential-dv" className="text-sm text-[var(--text-soft)]">DV</label>
                              <input
                                 id="credential-dv"
                                 type="text"
                                 value={form.dv}
                                 onChange={(e) => setForm((s) => ({ ...s, dv: e.target.value.toUpperCase().slice(0, 1) }))}
                                 className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                                 placeholder="K"
                                 maxLength={1}
                                 autoComplete="off"
                              />
                           </div>
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-password" className="text-sm text-[var(--text-soft)]">Clave bancaria</label>
                           <input
                              id="credential-password"
                              type="password"
                              value={form.password}
                              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder={isEditing ? 'Deja vacio para mantener la clave actual' : 'Clave bancaria'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-confirm-password" className="text-sm text-[var(--text-soft)]">Repetir clave bancaria</label>
                           <input
                              id="credential-confirm-password"
                              type="password"
                              value={form.confirmPassword}
                              onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                              className="border border-[var(--border-subtle)] bg-[var(--bg-content)] rounded-lg p-2"
                              placeholder={isEditing ? 'Solo si cambias la clave' : 'Repite la clave'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                     </>
                  )}

                  {(isEditing ? canUpdate : canCreate) ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                     <button
                        type="submit"
                        disabled={saving}
                        className={`px-4 py-2 rounded-lg text-white ${saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-[var(--brand)]'}`}
                     >
                        {saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Crear credencial')}
                     </button>
                     {isEditing && (
                        <button
                           type="button"
                           onClick={() => resetForm(form.type)}
                           className="px-4 py-2 rounded-lg border border-[var(--border-subtle)] text-[var(--text-main)]"
                        >
                           Cancelar
                        </button>
                     )}
                  </div>
                  ) : (
                     <div className="pt-1 text-sm text-[var(--text-soft)]">
                        No tienes permiso para {isEditing ? 'editar' : 'crear'} credenciales en esta entidad.
                     </div>
                  )}
               </form>
            </section>

            <section className="xl:col-span-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
               <h4 className="text-base font-semibold text-[var(--heading)]">Credenciales existentes</h4>

               {error && (
                  <div className="mt-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm p-3">
                     {error?.message || 'No se pudieron cargar las credenciales'}
                  </div>
               )}

               {isLoading ? (
                  <div className="mt-4 text-sm text-[var(--text-soft)]">Cargando credenciales...</div>
               ) : (
                  <div className="mt-4 overflow-x-auto">
                     <table className="w-full min-w-[640px] text-sm">
                        <thead>
                           <tr className="border-b border-[var(--border-subtle)] text-[var(--text-soft)]">
                              <th className="text-left py-2 px-2">Tipo</th>
                              <th className="text-left py-2 px-2">Identificador</th>
                              <th className="text-left py-2 px-2">Estado</th>
                              <th className="text-left py-2 px-2">Clave</th>
                              <th className="text-right py-2 px-2">Acciones</th>
                           </tr>
                        </thead>
                        <tbody>
                           {rows.length === 0 && (
                              <tr>
                                 <td colSpan={5} className="py-6 text-center text-[var(--text-soft)]">
                                    Aun no hay credenciales registradas para esta entidad.
                                 </td>
                              </tr>
                           )}
                           {rows.map((row) => (
                              <tr key={row.id} className="border-b border-[var(--border-subtle)] last:border-b-0">
                                 <td className="py-2 px-2 text-[var(--text-main)]">{row.type}</td>
                                 <td className="py-2 px-2 text-[var(--text-main)]">{credentialLabel(row)}</td>
                                 <td className="py-2 px-2">
                                    <span className={`text-xs px-2 py-1 rounded-full ${row.has_secret ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                       {row.has_secret ? 'Configurada' : 'Sin clave'}
                                    </span>
                                 </td>
                                 <td className="py-2 px-2 font-mono text-[var(--text-main)]">{revealedSecret(row, revealed)}</td>
                                 <td className="py-2 px-2">
                                    <div className="flex justify-end gap-2">
                                       <button
                                          type="button"
                                          onClick={() => onReveal(row)}
                                          disabled={Number(revealingId) === Number(row.id)}
                                          className="px-3 py-1.5 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                                       >
                                          {Number(revealingId) === Number(row.id) ? 'Ver...' : 'Ver'}
                                       </button>
                                       {canUpdate && (
                                          <button
                                             type="button"
                                             onClick={() => startEdit(row)}
                                             className="px-3 py-1.5 rounded-md border border-[var(--border-subtle)] text-[var(--text-main)] hover:bg-[var(--bg-content)]"
                                          >
                                             Editar
                                          </button>
                                       )}
                                       {canDelete && (
                                          <button
                                             type="button"
                                             onClick={() => onDelete(row)}
                                             disabled={Number(deletingId) === Number(row.id)}
                                             className={`px-3 py-1.5 rounded-md text-white ${Number(deletingId) === Number(row.id) ? 'bg-gray-400' : 'bg-[var(--danger)]'}`}
                                          >
                                             {Number(deletingId) === Number(row.id) ? 'Eliminando...' : 'Eliminar'}
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
