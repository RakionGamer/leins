import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSuperAdmin } from '../../services/userApi';
import { toast } from 'components/Toaster';
import {
   AdministradoresIcon,
   IzquierdaIcon,
   UsuarioIcon,
   CandadoIcon,
   CheckIcon
} from 'components/icons/SidebarIcons';

export default function SuperAdminCreate() {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [form, setForm] = useState({
      name: '',
      last_name: '',
      username: '',
      email: '',
      password: ''
   });

   const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.username || !form.password || !form.email) {
         return toast.error('Completa los campos obligatorios (*)');
      }

      setLoading(true);
      try {
         await createSuperAdmin(form);
         toast.success('Super administrador creado correctamente');
         navigate('/super-admin');
      } catch (error) {
         toast.error(error.message || 'Error al crear super administrador');
      } finally {
         setLoading(false);
      }
   };

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
                        <AdministradoresIcon className="w-3.5 h-3.5" />
                        <span>Gestión de Super Administradores</span>
                     </div>
                     <h1 className="font-nunito font-black text-2xl sm:text-3xl text-[#0A1A3F] tracking-tight">
                        Nuevo Super Administrador
                     </h1>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => navigate('/super-admin')}
                     className="px-5 py-2.5 text-xs font-bold rounded-full border border-[#E2EAFD] text-[#55607A] hover:bg-[#F0F4FD] hover:text-[#0A1A3F] transition-all"
                  >
                     Cancelar
                  </button>
                  <button
                     type="submit"
                     disabled={loading}
                     className="px-6 py-2.5 text-xs font-bold rounded-full text-white bg-[#1F6BFF] hover:bg-[#1657D7] shadow-xs hover:shadow-md transition-all flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                     {loading ? (
                        <>
                           <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                           <span>Creando...</span>
                        </>
                     ) : (
                        <span>Crear Super Admin</span>
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
                           Información Personal
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

                  {/* Credenciales de Acceso */}
                  <div className="bg-white rounded-2xl border border-[#E2EAFD] p-6 shadow-xs">
                     <div className="flex items-center gap-2.5 pb-3 border-b border-[#E2EAFD] mb-5">
                        <div className="w-7 h-7 rounded-lg bg-[#EFF3FF] flex items-center justify-center text-[#1F6BFF]">
                           <CandadoIcon className="w-4 h-4" />
                        </div>
                        <h2 className="font-nunito font-black text-sm text-[#0A1A3F]">
                           Credenciales de Acceso
                        </h2>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                           <label className="block text-xs font-bold text-[#0A1A3F] mb-1.5" htmlFor="username">
                              Nombre de Usuario <span className="text-[#E5484D]">*</span>
                           </label>
                           <input
                              id="username"
                              name="username"
                              type="text"
                              value={form.username}
                              onChange={handleChange}
                              placeholder="usuario.sistema"
                              required
                              className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3.5 py-2.5 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-[#0A1A3F] mb-1.5" htmlFor="email">
                              Correo Electrónico <span className="text-[#E5484D]">*</span>
                           </label>
                           <input
                              id="email"
                              name="email"
                              type="email"
                              value={form.email}
                              onChange={handleChange}
                              placeholder="correo@ejemplo.com"
                              required
                              className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3.5 py-2.5 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all"
                           />
                        </div>
                        <div className="md:col-span-2">
                           <label className="block text-xs font-bold text-[#0A1A3F] mb-1.5" htmlFor="password">
                              Contraseña Inicial <span className="text-[#E5484D]">*</span>
                           </label>
                           <input
                              id="password"
                              name="password"
                              type="password"
                              value={form.password}
                              onChange={handleChange}
                              placeholder="••••••••••••"
                              required
                              className="w-full bg-[#F8FAFF] focus:bg-white border border-[#E2EAFD] focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] rounded-xl px-3.5 py-2.5 text-xs text-[#0A1A3F] placeholder:text-[#55607A]/50 outline-hidden transition-all font-mono"
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
                           Información de Seguridad
                        </h3>
                     </div>
                     <p className="text-xs text-[#55607A] leading-relaxed mb-4">
                        Al crear este super administrador, tendrá privilegios elevados y podrá gestionar configuraciones y usuarios dentro de la plataforma.
                     </p>
                     <div className="space-y-2.5 pt-3 border-t border-[#E2EAFD]">
                        <div className="flex items-start gap-2 text-xs text-[#55607A]">
                           <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] mt-1.5 shrink-0" />
                           <span>Usa una contraseña fuerte con letras, números y símbolos.</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-[#55607A]">
                           <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] mt-1.5 shrink-0" />
                           <span>Podrás asignar entidades administrables posteriormente desde la lista.</span>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-[#55607A]">
                           <span className="w-1.5 h-1.5 rounded-full bg-[#1F6BFF] mt-1.5 shrink-0" />
                           <span>El usuario podrá actualizar su información y clave tras el primer ingreso.</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
         </form>
      </div>
   );
}
