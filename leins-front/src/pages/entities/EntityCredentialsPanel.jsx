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
   if (!value) return row.secret_preview || '••••••••';
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
      const ok = window.confirm(`¿Eliminar la credencial ${credentialLabel(row)}?`);
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
         'Vas a revelar una clave de acceso externa. Esta acción quedará auditada. ¿Deseas continuar?'
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
               <span className="text-[#55607A] font-medium">Credenciales registradas:</span>
               <span className="font-bold text-[#0A1A3F]">{total}</span>
               {isFetching && <span className="text-[10px] text-[#8E9BB5]">(actualizando)</span>}
            </div>
         </div>

         <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
            {/* Formulario */}
            <section className="xl:col-span-2 rounded-2xl border border-[#E2EAFD] bg-white p-5 shadow-xs">
               <h4 className="text-sm font-bold text-[#0A1A3F]">{formTitle}</h4>
               <p className="text-xs text-[#55607A] mt-0.5">Configura el acceso para automatizaciones y consultas.</p>

               <form className="mt-4 space-y-3.5" onSubmit={onSubmit}>
                  <div className="flex flex-col gap-1">
                     <label htmlFor="credential-type" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                        Tipo de servicio
                     </label>
                     <select
                        id="credential-type"
                        value={form.type}
                        disabled={isEditing}
                        onChange={(e) => resetForm(e.target.value)}
                        className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] disabled:opacity-60 cursor-pointer"
                     >
                        <option value="SII">SII (Servicio de Impuestos Internos)</option>
                        <option value="BANK">Banco (Cartola bancaria)</option>
                     </select>
                  </div>

                  {formType === 'SII' ? (
                     <>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-rut" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              RUT contribuyente
                           </label>
                           <input
                              id="credential-rut"
                              type="text"
                              value={form.rut}
                              onChange={(e) => setForm((s) => ({ ...s, rut: formatRutCL(e.target.value) }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder="Ej: 76.123.456-7"
                              maxLength={12}
                              autoComplete="off"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-clave" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Clave SII
                           </label>
                           <input
                              id="credential-clave"
                              type="password"
                              value={form.clave}
                              onChange={(e) => setForm((s) => ({ ...s, clave: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder={isEditing ? 'Deja vacío para mantener la actual' : 'Clave de acceso SII'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-confirm-clave" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Repetir clave SII
                           </label>
                           <input
                              id="credential-confirm-clave"
                              type="password"
                              value={form.confirmClave}
                              onChange={(e) => setForm((s) => ({ ...s, confirmClave: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder={isEditing ? 'Solo si cambias la clave' : 'Repite la clave'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                     </>
                  ) : (
                     <>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-bank" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Banco
                           </label>
                           <select
                              id="credential-bank"
                              value={form.bank}
                              onChange={(e) => setForm((s) => ({ ...s, bank: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF] cursor-pointer"
                           >
                              <option value="santander-officebanking">Santander OfficeBanking</option>
                           </select>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_80px] gap-3">
                           <div className="flex flex-col gap-1">
                              <label htmlFor="credential-username" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                                 Usuario / RUT
                              </label>
                              <input
                                 id="credential-username"
                                 type="text"
                                 value={form.username}
                                 onChange={(e) => setForm((s) => ({ ...s, username: e.target.value }))}
                                 className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                 placeholder="Ej: 12345678"
                                 maxLength={120}
                                 autoComplete="off"
                              />
                           </div>
                           <div className="flex flex-col gap-1">
                              <label htmlFor="credential-dv" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                                 DV
                              </label>
                              <input
                                 id="credential-dv"
                                 type="text"
                                 value={form.dv}
                                 onChange={(e) => setForm((s) => ({ ...s, dv: e.target.value.toUpperCase().slice(0, 1) }))}
                                 className="w-full h-10 px-3.5 text-xs font-medium text-center rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                                 placeholder="K"
                                 maxLength={1}
                                 autoComplete="off"
                              />
                           </div>
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-password" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Clave bancaria
                           </label>
                           <input
                              id="credential-password"
                              type="password"
                              value={form.password}
                              onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder={isEditing ? 'Deja vacío para mantener la actual' : 'Clave bancaria'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
                        <div className="flex flex-col gap-1">
                           <label htmlFor="credential-confirm-password" className="text-[11px] font-bold text-[#55607A] uppercase tracking-wider">
                              Repetir clave bancaria
                           </label>
                           <input
                              id="credential-confirm-password"
                              type="password"
                              value={form.confirmPassword}
                              onChange={(e) => setForm((s) => ({ ...s, confirmPassword: e.target.value }))}
                              className="w-full h-10 px-3.5 text-xs font-medium rounded-xl border border-[#E2EAFD] bg-[#F8FAFF] text-[#0A1A3F] placeholder-[#8E9BB5] focus:outline-none focus:ring-1 focus:ring-[#1F6BFF]"
                              placeholder={isEditing ? 'Solo si cambias la clave' : 'Repite la clave'}
                              maxLength={255}
                              autoComplete="new-password"
                           />
                        </div>
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
                           {saving ? 'Guardando...' : (isEditing ? 'Guardar cambios' : 'Crear credencial')}
                        </button>
                        {isEditing && (
                           <button
                              type="button"
                              onClick={() => resetForm(form.type)}
                              className="px-4 py-2 rounded-full border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#55607A] text-xs font-bold cursor-pointer"
                           >
                              Cancelar
                           </button>
                        )}
                     </div>
                  ) : (
                     <div className="pt-2 text-xs text-[#8E9BB5]">
                        No tienes permiso para {isEditing ? 'editar' : 'crear'} credenciales en esta entidad.
                     </div>
                  )}
               </form>
            </section>

            {/* Listado de credenciales */}
            <section className="xl:col-span-3 rounded-2xl border border-[#E2EAFD] bg-white p-5 shadow-xs">
               <h4 className="text-sm font-bold text-[#0A1A3F]">Credenciales existentes</h4>
               <p className="text-xs text-[#55607A] mt-0.5">Listado de claves asociadas y su estado de sincronización.</p>

               {error && (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs p-3">
                     {error?.message || 'No se pudieron cargar las credenciales'}
                  </div>
               )}

               {isLoading ? (
                  <div className="mt-6 text-xs text-[#8E9BB5] text-center py-8">Cargando credenciales...</div>
               ) : (
                  <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2EAFD]">
                     <table className="w-full min-w-[540px] text-xs">
                        <thead>
                           <tr className="bg-[#F0F4FD] text-[#55607A] text-[11px] font-bold uppercase tracking-wider border-b border-[#E2EAFD]">
                              <th className="text-left py-2.5 px-3">Tipo</th>
                              <th className="text-left py-2.5 px-3">Identificador</th>
                              <th className="text-left py-2.5 px-3">Estado</th>
                              <th className="text-left py-2.5 px-3">Clave</th>
                              <th className="text-right py-2.5 px-3">Acciones</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F0F4FD]">
                           {rows.length === 0 ? (
                              <tr>
                                 <td colSpan={5} className="py-8 text-center text-[#8E9BB5]">
                                    Aún no hay credenciales registradas para esta entidad.
                                 </td>
                              </tr>
                           ) : (
                              rows.map((row) => (
                                 <tr key={row.id} className="hover:bg-[#F9FBFF] transition">
                                    <td className="py-2.5 px-3 font-bold text-[#0A1A3F]">{row.type}</td>
                                    <td className="py-2.5 px-3 text-[#55607A] font-medium">{credentialLabel(row)}</td>
                                    <td className="py-2.5 px-3">
                                       <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                          row.has_secret ? 'bg-[#E8F8F0] text-[#0D9488]' : 'bg-amber-100 text-amber-700'
                                       }`}>
                                          <span className={`w-1.5 h-1.5 rounded-full ${row.has_secret ? 'bg-[#10B981]' : 'bg-amber-500'}`} />
                                          {row.has_secret ? 'Configurada' : 'Sin clave'}
                                       </span>
                                    </td>
                                    <td className="py-2.5 px-3 font-mono text-[#55607A] text-xs">{revealedSecret(row, revealed)}</td>
                                    <td className="py-2.5 px-3 text-right">
                                       <div className="flex justify-end gap-1.5">
                                          <button
                                             type="button"
                                             onClick={() => onReveal(row)}
                                             disabled={Number(revealingId) === Number(row.id)}
                                             className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100 text-xs font-semibold disabled:opacity-50 cursor-pointer"
                                          >
                                             {Number(revealingId) === Number(row.id) ? 'Ver...' : 'Ver'}
                                          </button>
                                          {canUpdate && (
                                             <button
                                                type="button"
                                                onClick={() => startEdit(row)}
                                                className="px-2.5 py-1 rounded-lg border border-[#E2EAFD] bg-white hover:bg-[#F5F8FF] text-[#0A1A3F] text-xs font-semibold cursor-pointer"
                                             >
                                                Editar
                                             </button>
                                          )}
                                          {canDelete && (
                                             <button
                                                type="button"
                                                onClick={() => onDelete(row)}
                                                disabled={Number(deletingId) === Number(row.id)}
                                                className={`px-2.5 py-1 rounded-lg text-white text-xs font-semibold cursor-pointer ${
                                                   Number(deletingId) === Number(row.id) ? 'bg-gray-400' : 'bg-rose-600 hover:bg-rose-700'
                                                }`}
                                             >
                                                {Number(deletingId) === Number(row.id) ? '...' : 'Eliminar'}
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
