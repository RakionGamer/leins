import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSuperAdmin } from '../../services/userApi';
import { toast } from 'components/Toaster';
import SpinnerButton from 'components/SpinnerButton';
import {
   UserPlusIcon,
   ArrowLeftIcon,
   UserIcon,
   EnvelopeIcon,
   LockClosedIcon,
   IdentificationIcon
} from '@heroicons/react/24/outline';

export default function SuperAdminCreate() {
   const navigate = useNavigate();
   const [loading, setLoading] = useState(false);
   const [form, setForm] = useState({
      name: '', last_name: '', username: '', email: '', password: ''
   });

   const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

   const handleSubmit = async (e) => {
      e.preventDefault();
      if (!form.username || !form.password || !form.email) return toast.error('Completa los campos obligatorios');

      setLoading(true);
      try {
         await createSuperAdmin(form);
         toast.success('Super administrador creado correctamente');
         navigate('/super-admin');
      } catch (error) {
         toast.error(error.message);
      } finally {
         setLoading(false);
      }
   };

   return (
      // 👇 CAMBIO AQUÍ: Quitamos 'max-w-5xl mx-auto'
      <div className="w-full px-6 py-8 animate-fade-in pb-20">

         <form onSubmit={handleSubmit}>
            {/* --- HEADER --- */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 border-b border-border-subtle/50 dark:border-white/5 pb-8">
               <div className="flex items-center gap-5">
                  <button
                     type="button"
                     onClick={() => navigate('/super-admin')}
                     className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-text-soft transition-colors"
                  >
                     <ArrowLeftIcon className="w-6 h-6" />
                  </button>
                  <div>
                     <div className="flex items-center gap-2 text-brand mb-1">
                        <UserPlusIcon className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">Gestion de super administradores</span>
                     </div>
                     <h1 className="text-3xl font-semibold text-heading dark:text-white tracking-tight">Nuevo super administrador</h1>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => navigate('/super-admin')}
                     className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-soft hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                  >
                     Cancelar
                  </button>
                  <SpinnerButton
                     type="submit"
                     loading={loading}
                     className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-brand-strong transition-all"
                  >
                     Crear super administrador
                  </SpinnerButton>
               </div>
            </div>

            {/* --- FORMULARIO (GRID) --- */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

               {/* Columna Principal (Datos) - Ocupa 8 columnas */}
               <div className="lg:col-span-8 space-y-12">
                  <section>
                     <h3 className="text-sm font-bold uppercase tracking-widest text-text-soft mb-6 border-b border-border-subtle/30 pb-2 flex items-center gap-2">
                        <IdentificationIcon className="w-4 h-4" /> Información Personal
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        <MinimalInput label="Nombre" name="name" value={form.name} onChange={handleChange} placeholder="Ej. Carlos" />
                        <MinimalInput label="Apellido" name="last_name" value={form.last_name} onChange={handleChange} placeholder="Ej. Díaz" />
                     </div>
                  </section>

                  <section>
                     <h3 className="text-sm font-bold uppercase tracking-widest text-text-soft mb-6 border-b border-border-subtle/30 pb-2 flex items-center gap-2">
                        <UserIcon className="w-4 h-4" /> Credenciales
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                        <MinimalInput label="Nombre de Usuario" name="username" value={form.username} onChange={handleChange} placeholder="usuario.sistema" required />
                        <MinimalInput label="Correo Electrónico" name="email" type="email" value={form.email} onChange={handleChange} placeholder="correo@ejemplo.com" icon={<EnvelopeIcon className="w-4 h-4" />} required />
                        <div className="md:col-span-2">
                           <MinimalInput label="Contraseña Inicial" name="password" type="password" value={form.password} onChange={handleChange} placeholder="••••••••••••" icon={<LockClosedIcon className="w-4 h-4" />} required />
                        </div>
                     </div>
                  </section>
               </div>

               {/* Columna Lateral (Info) - Ocupa 4 columnas */}
               <div className="lg:col-span-4">
                  <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-6 border border-border-subtle/50 sticky top-6">
                     <h4 className="font-bold text-heading dark:text-white mb-2">Importante</h4>
                     <p className="text-sm text-text-soft leading-relaxed mb-4">
                        Al crear un super administrador, este tendra acceso inmediato al panel de control.
                     </p>
                     <ul className="text-xs text-text-soft space-y-2 list-disc list-inside">
                        <li>La contraseña debe ser segura.</li>
                        <li>El usuario podrá cambiar sus datos luego.</li>
                        <li>Recomendamos activar 2FA posteriormente.</li>
                     </ul>
                  </div>
               </div>
            </div>
         </form>
      </div>
   );
}

function MinimalInput({ label, name, value, onChange, type = "text", placeholder, icon, required, disabled }) {
   return (
      <div className="group relative">
         <div className="flex justify-between items-end mb-1">
            <label htmlFor={name} className="block text-[9px] uppercase tracking-widest font-bold text-text-soft group-focus-within:text-brand transition-colors">
               {label} {required && <span className="text-danger">*</span>}
            </label>
         </div>
         <div className="relative">
            <input
               id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
               className={`block w-full bg-transparent border-0 border-b text-sm font-normal pb-2 px-0 transition-all duration-300 placeholder:text-text-soft/20 dark:placeholder:text-gray-700 focus:ring-0 ${disabled ? 'border-dashed border-border-subtle text-text-soft/50 cursor-not-allowed' : 'border-border-subtle/40 dark:border-white/10 text-heading dark:text-white focus:border-brand'}`}
            />
            {icon && <div className="absolute right-0 bottom-2 text-text-soft/40 group-focus-within:text-brand transition-colors">{icon}</div>}
         </div>
      </div>
   );
}
