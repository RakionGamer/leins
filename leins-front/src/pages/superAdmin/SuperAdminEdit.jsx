import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getSuperAdminById, updateSuperAdmin } from '../../services/userApi';
import { toast } from 'components/Toaster';
import {
   EditarIcon,
   IzquierdaIcon,
   UsuarioIcon,
   CandadoIcon,
   CheckIcon
} from 'components/icons/SidebarIcons';

export default function SuperAdminEdit() {
   const { id } = useParams();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [loading, setLoading] = useState(false);
   const [fetching, setFetching] = useState(true);

   const [form, setForm] = useState({
      name: '',
      last_name: '',
      username: '',
      email: ''
   });

   useEffect(() => {
      getSuperAdminById(id)
         .then((data) => {
            setForm({
               name: data.name || '',
               last_name: data.last_name || '',
               username: data.username || '',
               email: data.email || ''
            });
         })
         .catch(() => {
            toast.error('No se pudo cargar el usuario');
            navigate('/super-admin');
         })
         .finally(() => setFetching(false));
   }, [id, navigate]);

   const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

   const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
         // Excluimos username de dataToSend (no editable)
         const { username, ...dataToSend } = form;

         await updateSuperAdmin(id, dataToSend);
         await queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
         toast.success('Datos actualizados correctamente');
      } catch (error) {
         toast.error(error.message || 'Error al actualizar super administrador');
      } finally {
         setLoading(false);
      }
   };

   if (fetching) {
      return (
         <div className="min-h-[50vh] flex flex-col items-center justify-center gap-3">
            <span className="w-8 h-8 border-3 border-[#1F6BFF]/30 border-t-[#1F6BFF] rounded-full animate-spin" />
            <span className="text-xs font-bold uppercase tracking-wider text-[#55607A]">
               Cargando datos del administrador...
            </span>
         </div>
      );
   }

   return (
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-8 animate-fade-in pb-24">
         <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E2EAFD] mb-8">
               <div className="flex items-center gap-4">
                  <button
                     type="button"
                     onClick={() => navigate('/super-admin')}
                     className="w-10 h-10 rounded-full bg-[#F0F4FD] hover:bg-[#E2EAFD] text-[#0A1A3F] flex items-center justify-center transition-colors shadow-xs"
                     title="Volver"
                  >
                     <IzquierdaIcon className="w-4 h-4" />
                  </button>
                  <div>
                     <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EFF3FF] text-[#1F6BFF] border border-[#DCE5FF] text-[10px] font-black uppercase tracking-wider mb-1">
                        <EditarIcon className="w-3.5 h-3.5" />
                        <span>Edición de Super Administrador</span>
                     </div>
                     <h1 className="font-nunito font-black text-2xl sm:text-3xl text-[#0A1A3F] tracking-tight">
                        Editar Super Administrador
                     </h1>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => navigate('/super-admin')}
                     className="px-5 py-2.5 text-xs font-bold rounded-full border border-[#E2EAFD] text-[#55607A] hover:bg-[#F0F4FD] hover:text-[#0A1A3F] transition-all"
                  >
                     Descartar
                  </button>
                  <button
                     type="submit"
                     disabled={loading}
                     className="px-6 py-2.5 text-xs font-bold rounded-full text-white bg-[#1F6BFF] hover:bg-[#1657D7] shadow-xs hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                     {loading ? (
                        <>
                           <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           <span>Guardando...</span>
                        </>
                     ) : (
                        <span>Guardar Cambios</span>
                     )}
                  </button>
               </div>
            </div>

            {/* Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
               {/* Left form column (8 cols) */}
               <div className="lg:col-span-8 space-y-6">
                  {/* Datos Personales */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs">
                     <div className="flex items-center gap-2.5 pb-3 border-b border-[#E2EAFD] mb-5">
                        <div className="w-7 h-7 rounded-lg bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                           <UsuarioIcon className="w-4 h-4" />
                        </div>
                        <h2 className="font-nunito font-black text-sm text-[#0A1A3F]">
                           Datos Personales
                        </h2>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-[#0A1A3F] mb-1.5" htmlFor="name">
                              Nombre
                           </label>
                           <input
                              id="name"
                              name="name"
                              type="text"
                              value={form.name}
                              onChange={handleChange}
                              placeholder="Ej. Carlos"
                              className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3.5 py-2.5 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[#0A1A3F] mb-1.5" htmlFor="last_name">
                              Apellido
                           </label>
                           <input
                              id="last_name"
                              name="last_name"
                              type="text"
                              value={form.last_name}
                              onChange={handleChange}
                              placeholder="Ej. Díaz"
                              className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3.5 py-2.5 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all"
                           />
                        </div>
                     </div>
                  </div>

                  {/* Datos de Cuenta */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs">
                     <div className="flex items-center gap-2.5 pb-3 border-b border-[#E2EAFD] mb-5">
                        <div className="w-7 h-7 rounded-lg bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                           <CandadoIcon className="w-4 h-4" />
                        </div>
                        <h2 className="font-nunito font-black text-sm text-[#0A1A3F]">
                           Datos de Cuenta
                        </h2>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-[#55607A] mb-1.5" htmlFor="username">
                              Nombre de Usuario <span className="text-[10px] text-[#55607A] font-normal">(No modificable)</span>
                           </label>
                           <input
                              id="username"
                              name="username"
                              type="text"
                              value={form.username}
                              disabled
                              className="w-full bg-[#F0F4FD] border border-[#E2EAFD] rounded-xl px-3.5 py-2.5 text-xs text-[#55607A] cursor-not-allowed select-none outline-hidden"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[#0A1A3F] mb-1.5" htmlFor="email">
                              Correo Electrónico
                           </label>
                           <input
                              id="email"
                              name="email"
                              type="email"
                              value={form.email}
                              onChange={handleChange}
                              placeholder="correo@ejemplo.com"
                              className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3.5 py-2.5 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all"
                           />
                        </div>
                     </div>
                  </div>
               </div>

               {/* Right sidebar info column (4 cols) */}
               <div className="lg:col-span-4">
                  <div className="bg-[#F8FAFF] rounded-2xl border border-[#E2EAFD] p-6 sticky top-6 shadow-xs">
                     <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-md bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                           <CheckIcon className="w-3.5 h-3.5" />
                        </div>
                        <h3 className="font-nunito font-black text-sm text-[#0A1A3F]">
                           Información de Edición
                        </h3>
                     </div>
                     <p className="text-xs text-[#55607A] leading-relaxed mb-4">
                        Los cambios de nombre y correo surten efecto inmediato para este usuario administrador.
                     </p>
                     <div className="space-y-2.5 pt-3 border-t border-[#E2EAFD]">
                        <div className="flex items-start gap-2 text-xs text-[#55607A]">
                           <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] mt-1.5 shrink-0" />
                           <span>El nombre de usuario no puede ser modificado por seguridad e integridad de auditoría.</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-[#55607A]">
                           <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] mt-1.5 shrink-0" />
                           <span>Para cambiar contraseñas, el usuario puede restablecerla o usar la opción de reseteo.</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </form>
      </div>
   );
}
