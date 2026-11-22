import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AbajoIcon, UsuarioIcon, SalirIcon } from './icons/SidebarIcons';

export default function UserMenu() {
   const { user, logout } = useAuth();
   const navigate = useNavigate();

   const handleLogout = async () => {
      await logout();
      navigate('/login');
   };

   // obtener iniciales
   const getInitials = () => {
      const n = user?.name || '';
      const l = user?.last_name || '';
      return (n.charAt(0) + l.charAt(0)).toUpperCase() || 'U';
   };

   return (
      <Menu as="div" className="relative">
         {/* boton del menu (avatar) */}
         <div>
            <Menu.Button className="flex items-center gap-2.5 rounded-full p-1 pr-2 hover:bg-[#EFF3FF] focus:outline-none transition-colors group">
               <span className="sr-only">Abrir menú de usuario</span>

               {/* avatar circular azul con iniciales en blanco */}
               <div className="h-9 w-9 rounded-full bg-[#1F6BFF] text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden shrink-0">
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

               {/* nombre y cargo real del usuario */}
               <div className="hidden md:flex flex-col text-left leading-tight">
                  <span className="font-bold text-xs text-[#0A1A3F] truncate max-w-[120px]">
                     {user?.name || user?.email?.split('@')[0] || 'Usuario'}
                  </span>
                  <span className="text-[11px] text-[#55607A] font-medium">
                     {user?.role_label || (user?.role === 'super_admin' ? 'Super Administrador' : user?.role === 'admin' ? 'Administrador' : user?.role || 'Usuario')}
                  </span>
               </div>

               <AbajoIcon className="w-3.5 h-3.5 text-[#55607A] shrink-0 transition-transform group-hover:translate-y-0.5" />
            </Menu.Button>
         </div>

         {/* dropdown animado */}
         <Transition
            as={Fragment}
            enter="transition ease-out duration-100"
            enterFrom="transform opacity-0 scale-95"
            enterTo="transform opacity-100 scale-100"
            leave="transition ease-in duration-75"
            leaveFrom="transform opacity-100 scale-100"
            leaveTo="transform opacity-0 scale-95"
         >
            <Menu.Items className="absolute right-0 z-50 mt-2 w-56 origin-top-right rounded-xl bg-white dark:bg-[#1e1e1e] py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none border border-gray-100 dark:border-gray-800">

               {/* cabecera del dropdown */}
               <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 mb-1">
                  <p className="text-xs text-gray-500 dark:text-gray-400">Conectado como</p>
                  <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user?.email}</p>
               </div>

               {/* opciones */}
               <div className="p-1 space-y-0.5">
                  <Menu.Item>
                     {({ active }) => (
                        <button
                           onClick={() => navigate('/profile')}
                           className={`${active ? 'bg-brand/5 text-brand-strong' : 'text-gray-700 dark:text-gray-300'
                              } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                        >
                           <UsuarioIcon className="mr-2 h-5 w-5 text-[#55607A]" aria-hidden="true" />
                           Mi Perfil
                        </button>
                     )}
                  </Menu.Item>

               </div>

               <div className="h-px bg-gray-100 dark:bg-gray-800 my-1 mx-2" />

               <div className="p-1">
                  <Menu.Item>
                     {({ active }) => (
                        <button
                           onClick={handleLogout}
                           className={`${active ? 'bg-red-50 text-red-600' : 'text-gray-700 dark:text-gray-300'
                              } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                        >
                           <SalirIcon className="mr-2 h-5 w-5 text-red-500" aria-hidden="true" />
                           Cerrar Sesión
                        </button>
                     )}
                  </Menu.Item>
               </div>
            </Menu.Items>
         </Transition>
      </Menu>
   );
}