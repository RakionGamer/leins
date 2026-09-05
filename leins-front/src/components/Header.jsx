import { Bars3Icon } from '@heroicons/react/24/outline';
import ToggleThemeButton from './ToggleThemeButton';
import UserMenu from './UserMenu';
import SelectEntity from './SelectEntity';
// importamos el componente que tiene la logica de polling
import NotificationBell from './NotificationBell';

export default function Header({ toggleSidebar }) {
   return (
      <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center gap-x-4 bg-bg-content/80 backdrop-blur border-b border-border-subtle px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8 transition-colors">

         {/* boton hamburguesa (movil) */}
         <button
            type="button"
            className="-m-2.5 p-2.5 text-text-soft hover:text-text-main md:hidden"
            onClick={toggleSidebar}
         >
            <span className="sr-only">abrir sidebar</span>
            <Bars3Icon className="h-6 w-6" aria-hidden="true" />
         </button>

         {/* separador vertical movil */}
         <div className="h-6 w-px bg-border-subtle md:hidden" aria-hidden="true" />

         <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">

            {/* espacio flexible */}
            <div className="flex flex-1 items-center gap-3">
               <h2 className="text-lg font-semibold text-heading dark:text-white hidden sm:block">
                  {/* titulo dinamico si fuera necesario */}
               </h2>
               <SelectEntity className="flex" />
            </div>

            {/* zona de acciones derecha */}
            <div className="flex items-center gap-x-4 lg:gap-x-6">

               {/* separador */}
               <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-border-subtle" aria-hidden="true" />

               {/* menu de usuario */}
               <UserMenu />

               {/* AQUI ESTA EL CAMBIO: usamos el componente inteligente en vez del boton fijo */}
               <NotificationBell />

               {/* boton tema */}
               <ToggleThemeButton />

            </div>
         </div>
      </header>
   );
}
