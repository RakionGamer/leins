import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PrimaryButton from 'components/PrimaryButton';
import ChangePasswordTab from './ChangePasswordTab';
import { UserIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function Profile() {
   const { user } = useAuth();
   const navigate = useNavigate();
   const [activeTab, setActiveTab] = useState('info');

   const getInitials = () => {
      const name = user?.name || '';
      const last = user?.last_name || '';
      return (name.charAt(0) + last.charAt(0)).toUpperCase() || 'U';
   };

   const tabs = [
      { id: 'info', label: 'Mis Datos', icon: UserIcon },
      { id: 'security', label: 'Seguridad', icon: LockClosedIcon },
   ];

   return (
      // CAMBIO 1: 'w-full' en lugar de 'max-w-3xl' para usar todo el ancho
      <div className="w-full px-6 py-8 animate-fade-in">

         {/* HEADER (Ahora se expande con la pantalla) */}
         <div className="flex flex-row items-center gap-6 mb-10 border-b border-border-subtle/50 dark:border-white/5 pb-8">

            {/* Avatar: Reemplaza tu bloque actual por este */}
            <div className="relative group shrink-0">
               <div className="w-20 h-20 rounded-full bg-bg-base dark:bg-gray-800 border border-border-subtle dark:border-white/10 flex items-center justify-center text-xl font-medium text-black dark:text-white shadow-sm transition-colors overflow-hidden">

                  {/* LÓGICA DE IMAGEN VS INICIALES */}
                  {user?.avatar_url ? (
                     <img
                        src={user.avatar_url}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                     />
                  ) : (
                     getInitials()
                  )}

               </div>

               {/* Badge de Rol (se mantiene igual) */}
               <div className="absolute -bottom-1 -right-1 bg-heading dark:bg-white text-white dark:text-black px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border border-white dark:border-gray-900">
                  {user?.role || 'Admin'}
               </div>
            </div>

            {/* Info Principal */}
            <div className="flex-1 min-w-0">
               <h1 className="text-3xl font-semibold text-heading dark:text-white tracking-tight truncate">
                  {user?.name} {user?.last_name}
               </h1>
               <div className="flex flex-wrap items-center gap-3 text-sm mt-1">
                  <p className="text-text-soft dark:text-gray-400 font-mono">@{user?.username}</p>
                  <span className="hidden sm:inline text-border-subtle dark:text-gray-600">|</span>
                  <p className="text-text-soft/60 dark:text-gray-500">{user?.email}</p>
               </div>
            </div>

            {/* Botón Editar */}
            {activeTab === 'info' && (
               <PrimaryButton
                  onClick={() => navigate('/profile/edit')}
                  className="bg-brand text-white hover:bg-brand-strong hover:text-white transition-colors shadow-none rounded-xl px-6 py-2 font-medium text-xs uppercase tracking-wide"
               >
                  Editar Perfil
               </PrimaryButton>
            )}
         </div>

         {/* NAVEGACIÓN (Tabs) */}
         <div className="flex items-center gap-8 border-b border-border-subtle dark:border-white/10 mb-10">
            {tabs.map((tab) => {
               const Icon = tab.icon;
               const isActive = activeTab === tab.id;
               return (
                  <button
                     key={tab.id}
                     onClick={() => setActiveTab(tab.id)}
                     className={`pb-3 flex items-center gap-2 text-sm font-medium transition-all relative outline-none
                        ${isActive
                           ? 'text-heading dark:text-white'
                           : 'text-text-soft dark:text-gray-500 hover:text-heading dark:hover:text-gray-300'
                        }`}
                  >
                     <Icon className={`w-4 h-4 ${isActive ? 'stroke-2' : 'stroke-1'}`} />
                     {tab.label}
                     {isActive && (
                        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-heading dark:bg-white rounded-full" />
                     )}
                  </button>
               );
            })}
         </div>

         {/* CONTENIDO */}
         <div className="animate-slide-up">

            {/* TAB: DATOS (Grid Responsivo de 4 Columnas) */}
            {activeTab === 'info' && (
               // CAMBIO 2: lg:grid-cols-4 para llenar la pantalla ancha sin huecos
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-12 gap-y-10">
                  <MinimalField label="Nombre" value={user?.name} />
                  <MinimalField label="Apellido" value={user?.last_name} />
                  <MinimalField label="Usuario" value={user?.username} />
                  <MinimalField label="Teléfono" value={user?.phone || '—'} />

                  <MinimalField label="Email" value={user?.email} className="md:col-span-2" />

                  <div className="md:col-span-2 pt-1">
                     <span className="text-[9px] uppercase tracking-widest text-text-soft/60 dark:text-gray-500 font-bold mb-1.5 block">
                        Estado de Cuenta
                     </span>
                     <div className="flex items-center gap-2 text-success dark:text-green-400 text-sm font-medium border-l-2 border-success pl-3">
                        Cuenta activa y verificada
                     </div>
                  </div>
               </div>
            )}

            {/* TAB: SEGURIDAD (Layout Lateral para pantallas grandes) */}
            {activeTab === 'security' && (
               // CAMBIO 3: Layout Flex Row en pantallas grandes (lg:flex-row)
               <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 items-start max-w-6xl">

                  {/* Panel Izquierdo: Consejos */}
                  <div className="lg:w-1/3 shrink-0">
                     <div className="p-6 bg-brand/5 dark:bg-brand/10 rounded-2xl border border-brand/10 dark:border-brand/20">
                        <div className="w-10 h-10 bg-white dark:bg-black/30 rounded-full flex items-center justify-center text-brand-strong dark:text-brand-tint shadow-sm mb-4">
                           <LockClosedIcon className="w-5 h-5" />
                        </div>
                        <h4 className="text-sm font-bold text-heading dark:text-white mb-2">
                           Protege tu cuenta
                        </h4>
                        <p className="text-xs text-text-soft dark:text-gray-400 leading-relaxed mb-4">
                           Una contraseña segura ayuda a prevenir accesos no autorizados. Te recomendamos cambiarla cada 3 meses.
                        </p>
                        <ul className="text-[10px] text-text-soft/80 dark:text-gray-500 space-y-1.5 list-disc pl-3">
                           <li>Mínimo 6 caracteres</li>
                           <li>Usa mayúsculas y números</li>
                           <li>No uses datos personales</li>
                        </ul>
                     </div>
                  </div>

                  {/* Panel Derecho: Formulario (Ocupa el resto) */}
                  <div className="flex-1 w-full max-w-2xl">
                     <ChangePasswordTab />
                  </div>

               </div>
            )}

         </div>
      </div>
   );
}

// Sub-componente (Igual que antes)
function MinimalField({ label, value, className = '' }) {
   return (
      <div className={`group ${className}`}>
         <label className="block text-[9px] uppercase tracking-widest text-text-soft/60 dark:text-gray-500 font-bold mb-1 transition-colors group-hover:text-black dark:group-hover:text-white">
            {label}
         </label>
         <div className="text-sm text-heading dark:text-gray-200 font-normal border-b border-border-subtle/40 dark:border-white/10 pb-1 w-full transition-colors group-hover:border-border-subtle dark:group-hover:border-white/20">
            {value}
         </div>
      </div>
   );
}