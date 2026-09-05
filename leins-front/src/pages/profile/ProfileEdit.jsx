import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { validateHumanName, validatePhoneCL } from '../../utils/validators';
import { toast } from 'components/Toaster';
import { updateProfile, uploadAvatar } from '../../services/userApi';
import SpinnerButton from 'components/SpinnerButton';
import { CameraIcon } from '@heroicons/react/24/solid';

export default function ProfileEdit() {
   const { user, setUser } = useAuth();
   const navigate = useNavigate();
   const fileInputRef = useRef(null); // referencia al input oculto

   const [form, setForm] = useState({ name: '', last_name: '', phone: '' });
   const [errors, setErrors] = useState({});
   const [saving, setSaving] = useState(false);
   const [uploadingImg, setUploadingImg] = useState(false);

   // cargar datos iniciales
   useEffect(() => {
      setForm({
         name: user?.name ?? '',
         last_name: user?.last_name ?? '',
         phone: user?.phone ?? '',
      });
   }, [user]);

   const getInitials = () => {
      const n = form.name || user?.name || '';
      const l = form.last_name || user?.last_name || '';
      return (n.charAt(0) + l.charAt(0)).toUpperCase() || 'U';
   };

   // --- manejo de imagen ---
   const handleAvatarClick = () => {
      fileInputRef.current.click(); // simula click en el input oculto
   };

   const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // validar tipo y tamano antes de subir
      if (!file.type.startsWith('image/')) {
         return toast.error('Solo se permiten imágenes');
      }
      if (file.size > 2 * 1024 * 1024) { // 2mb
         return toast.error('La imagen no debe pesar más de 2MB');
      }

      setUploadingImg(true);
      try {
         // subida inmediata
         const { avatar_url } = await uploadAvatar(file);

         // actualizamos el contexto global inmediatamente
         setUser({ ...user, avatar_url });
         toast.success('Foto actualizada');
      } catch (error) {
         toast.error(error.message);
      } finally {
         setUploadingImg(false);
         // limpiamos el input
         e.target.value = '';
      }
   };
   // ------------------------

   const validateField = (name, value) => {
      let msg = '';
      if (name === 'name' || name === 'last_name') msg = validateHumanName(value);
      if (name === 'phone' && value) msg = validatePhoneCL(value);
      setErrors((prev) => ({ ...prev, [name]: msg }));
      return msg;
   };

   const handleChange = (e) => {
      const { name, value } = e.target;
      setForm((prev) => ({ ...prev, [name]: value }));
      if (errors[name]) validateField(name, value);
   };

   const handleBlur = (e) => validateField(e.target.name, e.target.value);

   const onSubmit = async (e) => {
      e.preventDefault();
      const e1 = validateField('name', form.name);
      const e2 = validateField('last_name', form.last_name);
      const e3 = validateField('phone', form.phone);

      if (e1 || e2 || e3) return toast.error('Por favor corrige los errores');

      setSaving(true);
      try {
         // aqui llama a updateProfile que ahora usa post
         const updatedUser = await updateProfile(form);
         if (updatedUser) setUser?.(updatedUser);
         toast.success('Datos actualizados');
         navigate('/profile');
      } catch (err) {
         toast.error(err.message);
      } finally {
         setSaving(false);
      }
   };

   return (
      <div className="w-full px-6 py-8 animate-fade-in">
         <form onSubmit={onSubmit}>
            {/* header */}
            <div className="flex flex-row items-center gap-6 mb-10 border-b border-border-subtle/50 dark:border-white/5 pb-8">

               {/* avatar interactivo */}
               <div className="relative group shrink-0">
                  <input
                     type="file"
                     ref={fileInputRef}
                     onChange={handleFileChange}
                     className="hidden"
                     accept="image/png, image/jpeg, image/webp"
                  />

                  <button
                     type="button"
                     onClick={handleAvatarClick}
                     className="relative w-24 h-24 rounded-full bg-bg-base dark:bg-gray-800 border border-border-subtle dark:border-white/10 flex items-center justify-center text-xl font-medium text-black dark:text-white shadow-sm overflow-hidden transition-all group-hover:ring-4 ring-brand/20"
                     disabled={uploadingImg}
                  >
                     {uploadingImg ? (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                     ) : user?.avatar_url ? (
                        <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                     ) : (
                        getInitials()
                     )}

                     {/* overlay de camara */}
                     <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <CameraIcon className="w-8 h-8 text-white" />
                     </div>
                  </button>

                  <div className="absolute -bottom-1 -right-1 bg-brand text-white px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-white dark:border-gray-900 pointer-events-none">
                     Cambiar
                  </div>
               </div>

               {/* titulo */}
               <div className="flex-1 min-w-0">
                  <h1 className="text-3xl font-semibold text-heading dark:text-white tracking-tight">
                     Editar Perfil
                  </h1>
                  <p className="text-sm text-text-soft dark:text-gray-400 mt-1">
                     Actualiza tus datos personales
                  </p>
               </div>

               {/* botones */}
               <div className="flex items-center gap-3">
                  <button
                     type="button"
                     onClick={() => navigate('/profile')}
                     className="px-4 py-2 text-xs font-medium uppercase tracking-wide text-text-soft hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                  >
                     Cancelar
                  </button>

                  <SpinnerButton
                     type="submit"
                     loading={saving}
                     className="bg-brand text-white hover:bg-brand-strong hover:text-white transition-colors shadow-none rounded-xl px-6 py-2 font-medium text-xs uppercase tracking-wide"
                  >
                     Guardar
                  </SpinnerButton>
               </div>
            </div>

            {/* formulario grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-10 max-w-7xl">
               <MinimalInput
                  label="Nombre" name="name" value={form.name}
                  onChange={handleChange} onBlur={handleBlur} error={errors.name} autoFocus
               />
               <MinimalInput
                  label="Apellido" name="last_name" value={form.last_name}
                  onChange={handleChange} onBlur={handleBlur} error={errors.last_name}
               />

               {/* fix: agregamos || '' para evitar undefined */}
               <MinimalInput label="Usuario" value={user?.username || ''} disabled readOnly />

               <MinimalInput
                  label="Teléfono" name="phone" value={form.phone}
                  onChange={handleChange} onBlur={handleBlur} error={errors.phone} placeholder="+56 9..."
               />

               <div className="md:col-span-2">
                  {/* fix: agregamos || '' para evitar undefined */}
                  <MinimalInput label="Email" value={user?.email || ''} disabled readOnly />
               </div>
            </div>
         </form>
      </div>
   );
}

// minimal input
function MinimalInput({ label, name, value, onChange, onBlur, error, disabled, readOnly, placeholder, ...props }) {
   return (
      <div className="group relative">
         <label
            htmlFor={name}
            className={`
               block text-[9px] uppercase tracking-widest font-bold mb-1 transition-colors
               ${error
                  ? 'text-danger'
                  : disabled
                     ? 'text-text-soft/40 dark:text-gray-600'
                     : 'text-black dark:text-gray-500 group-focus-within:text-brand dark:group-focus-within:text-brand-tint'}
            `}
         >
            {label}
         </label>

         <input
            id={name}
            name={name}
            value={value}
            onChange={onChange}
            onBlur={onBlur}
            disabled={disabled}
            readOnly={readOnly}
            placeholder={placeholder}
            className={`
               block w-full 
               bg-transparent 
               border-0 border-b 
               text-sm font-normal 
               pb-1 px-0
               transition-all duration-300
               placeholder:text-text-soft/20 dark:placeholder:text-gray-700
               focus:ring-0
               
               ${disabled || readOnly
                  ? 'border-dashed border-border-subtle/30 text-text-soft/60 dark:text-gray-600 cursor-not-allowed'
                  : error
                     ? 'border-danger text-danger focus:border-danger'
                     : 'border-border-subtle/40 dark:border-white/10 text-black dark:text-white focus:border-brand dark:focus:border-brand-tint'
               }
            `}
            {...props}
         />

         {error && (
            <span className="absolute -bottom-5 left-0 text-[10px] text-danger font-medium animate-fade-in">
               {error}
            </span>
         )}
      </div>
   );
}