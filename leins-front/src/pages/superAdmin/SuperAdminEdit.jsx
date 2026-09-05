import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { getSuperAdminById, updateSuperAdmin } from '../../services/userApi';
import { toast } from 'components/Toaster';
import SpinnerButton from 'components/SpinnerButton';
import {
   PencilSquareIcon,
   ArrowLeftIcon,
   IdentificationIcon,
   EnvelopeIcon,
   UserCircleIcon
} from '@heroicons/react/24/outline';

export default function SuperAdminEdit() {
   const { id } = useParams();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [loading, setLoading] = useState(false);
   const [fetching, setFetching] = useState(true);

   const [form, setForm] = useState({
      name: '', last_name: '', username: '', email: ''
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
         // 👇 CAMBIO CLAVE AQUÍ:
         // Usamos desestructuración para sacar 'username' y dejar el resto en 'dataToSend'
         const { username, ...dataToSend } = form;

         // Enviamos a la API solo los datos que realmente se pueden editar (name, last_name, email)
         await updateSuperAdmin(id, dataToSend);

         await queryClient.invalidateQueries({ queryKey: ['superAdmins'] });
         toast.success('Datos actualizados correctamente');
      } catch (error) {
         toast.error(error.message);
      } finally {
         setLoading(false);
      }
   };

   if (fetching) return (
      <div className="min-h-[50vh] flex items-center justify-center">
         <div className="animate-pulse text-xs font-bold uppercase tracking-widest text-text-soft">Cargando datos...</div>
      </div>
   );

   return (
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
                        <PencilSquareIcon className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">Modo Edición</span>
                     </div>
                     <h1 className="text-3xl font-semibold text-heading dark:text-white tracking-tight">Editar super administrador</h1>
                  </div>
               </div>

               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => navigate('/super-admin')}
                     className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-soft hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                  >
                     Descartar
                  </button>
                  <SpinnerButton
                     type="submit"
                     loading={loading}
                     className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-brand-strong transition-all"
                  >
                     Guardar Cambios
                  </SpinnerButton>
               </div>
            </div>

            {/* --- CONTENIDO --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-12">

               {/* Sección Datos Personales */}
               <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-soft mb-6 border-b border-border-subtle/30 pb-2 flex items-center gap-2">
                     <IdentificationIcon className="w-4 h-4" /> Datos Personales
                  </h3>
                  <div className="space-y-8">
                     <MinimalInput label="Nombre" name="name" value={form.name} onChange={handleChange} />
                     <MinimalInput label="Apellido" name="last_name" value={form.last_name} onChange={handleChange} />
                  </div>
               </div>

               {/* Sección Cuenta */}
               <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-text-soft mb-6 border-b border-border-subtle/30 pb-2 flex items-center gap-2">
                     <UserCircleIcon className="w-4 h-4" /> Datos de Cuenta
                  </h3>
                  <div className="space-y-8">
                     {/* Usuario bloqueado visualmente y NO se envía al backend */}
                     <MinimalInput label="Nombre de Usuario" name="username" value={form.username} onChange={handleChange} disabled />
                     <MinimalInput label="Correo Electrónico" name="email" type="email" value={form.email} onChange={handleChange} icon={<EnvelopeIcon className="w-4 h-4" />} />
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
            <label htmlFor={name} className={`block text-[9px] uppercase tracking-widest font-bold transition-colors ${disabled ? 'text-text-soft/40' : 'text-text-soft group-focus-within:text-brand'}`}>
               {label} {required && <span className="text-danger">*</span>}
            </label>
         </div>
         <div className="relative">
            <input
               id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder} disabled={disabled}
               className={`block w-full bg-transparent border-0 border-b text-sm font-normal pb-2 px-0 transition-all duration-300 placeholder:text-text-soft/20 dark:placeholder:text-gray-700 focus:ring-0 ${disabled ? 'border-dashed border-border-subtle/50 text-text-soft/50 cursor-not-allowed select-none' : 'border-border-subtle/40 dark:border-white/10 text-heading dark:text-white focus:border-brand'}`}
            />
            {icon && <div className="absolute right-0 bottom-2 text-text-soft/40 group-focus-within:text-brand transition-colors">{icon}</div>}
         </div>
      </div>
   );
}
