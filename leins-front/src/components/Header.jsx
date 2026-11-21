import { Bars3Icon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import ToggleThemeButton from './ToggleThemeButton';
import UserMenu from './UserMenu';
import SelectEntity from './SelectEntity';
import NotificationBell from './NotificationBell';

export default function Header({ toggleSidebar }) {
   return (
      <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between gap-x-4 bg-white border-b border-[#E2EAFD] px-4 sm:px-6 lg:px-8 transition-colors">
         {/* Lado izquierdo: Botón hamburguesa (móvil) + Selector de Entidad */}
         <div className="flex items-center gap-3 min-w-0">
            <button
               type="button"
               className="-m-2.5 p-2.5 text-[#55607A] hover:text-[#0A1A3F] md:hidden"
               onClick={toggleSidebar}
            >
               <span className="sr-only">Abrir menú lateral</span>
               <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>
            <SelectEntity className="flex" />
         </div>

         {/* Barra de búsqueda central (⌘ K) */}
         <div className="hidden lg:flex items-center flex-1 max-w-md mx-4">
            <div className="relative w-full">
               <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#55607A]">
                  <MagnifyingGlassIcon className="h-4 w-4" />
               </div>
               <input
                  type="text"
                  placeholder="Busca un folio, RUT o monto"
                  className="w-full pl-10 pr-12 py-2 text-xs font-medium text-[#0A1A3F] bg-white border border-[#E2EAFD] rounded-xl placeholder-[#55607A] focus:outline-none focus:border-[#1F6BFF] focus:ring-1 focus:ring-[#1F6BFF] transition-all shadow-sm"
               />
               <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-[#55607A] bg-[#EFF3FF] border border-[#DCE5FF] rounded">
                     ⌘ K
                  </kbd>
               </div>
            </div>
         </div>

         {/* Zona de acciones derecha: Luna/Sol + Campana + Menú Usuario */}
         <div className="flex items-center gap-x-3 sm:gap-x-4">
            <ToggleThemeButton />
            <NotificationBell />
            <UserMenu />
         </div>
      </header>
   );
}
