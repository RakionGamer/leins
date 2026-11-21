import React, { useEffect, useRef } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';
import ToggleThemeButton from './ToggleThemeButton';
import UserMenu from './UserMenu';
import SelectEntity from './SelectEntity';
import NotificationBell from './NotificationBell';

export default function Header({ toggleSidebar }) {
   const searchInputRef = useRef(null);

   useEffect(() => {
      const handleKeyDown = (e) => {
         if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            searchInputRef.current?.focus();
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);

   return (
      <header className="sticky top-0 z-20 flex h-16 flex-shrink-0 items-center justify-between gap-x-3 sm:gap-x-4 bg-white border-b border-[#E2EAFD] px-4 sm:px-6 lg:px-8 transition-colors">
         {/* Lado izquierdo: Botón hamburguesa (móvil) + Selector de Entidad + Buscador */}
         <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <button
               type="button"
               className="-m-2 p-2 text-[#55607A] hover:text-[#0A1A3F] md:hidden shrink-0"
               onClick={toggleSidebar}
            >
               <span className="sr-only">Abrir menú lateral</span>
               <Bars3Icon className="h-6 w-6" aria-hidden="true" />
            </button>

            {/* Selector de Entidad (Píldora cápsula Hielo con ícono en círculo blanco) */}
            <SelectEntity className="shrink-0" />

            {/* Buscador idéntico al diseño de referencia (Píldora cápsula #F5F8FE con borde #DCE6FF, lupa con punto azul #1F6BFF y badge ⌘ K) */}
            <div className="hidden md:flex items-center flex-1 max-w-[420px]">
               <div
                  onClick={() => searchInputRef.current?.focus()}
                  className="relative flex items-center w-full h-11 bg-[#F5F8FE] border border-[#DCE6FF] rounded-full pl-5 pr-5 transition-all focus-within:border-[#1F6BFF] focus-within:ring-1 focus-within:ring-[#1F6BFF] cursor-text"
               >
                  <div className="flex items-center pointer-events-none shrink-0">
                     <svg className="w-4 h-4 text-[#8D97AE]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="10.5" cy="10.5" r="7" />
                        <line x1="21" y1="21" x2="15.5" y2="15.5" />
                        <circle cx="10.5" cy="10.5" r="1.75" fill="#1F6BFF" stroke="none" />
                     </svg>
                  </div>
                  <input
                     ref={searchInputRef}
                     type="text"
                     placeholder="Busca un folio, RUT o monto"
                     className="w-full bg-transparent pl-3 pr-2 py-1 text-[13px] font-normal text-[#0A1A3F] placeholder-[#8D97AE] focus:outline-none font-sans"
                  />
                  <div className="flex items-center pointer-events-none shrink-0">
                     <kbd className="h-[21px] px-1.5 flex items-center justify-center gap-1 bg-white border border-[#DCE6FF] rounded-[6px] text-[11px] font-medium text-[#55607A] leading-none select-none">
                        <span>⌘</span>
                        <span>K</span>
                     </kbd>
                  </div>
               </div>
            </div>
         </div>

         {/* Zona de acciones derecha: Luna/Sol + Campana + Menú Usuario */}
         <div className="flex items-center gap-x-2 sm:gap-x-3 shrink-0">
            <ToggleThemeButton />
            <NotificationBell />
            <UserMenu />
         </div>
      </header>
   );
}
