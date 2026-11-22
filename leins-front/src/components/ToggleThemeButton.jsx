import { useEffect, useState } from 'react';
import { SolIcon, LunaIcon } from './icons/SidebarIcons';
import { useTheme } from '../hooks/useTheme';
import Tooltip from './Tooltip';

export default function ToggleThemeButton() {
   const { setTheme } = useTheme();
   const [isDark, setIsDark] = useState(false);

   // lee estado inicial (respeta lo que haya en localStorage / clase .dark)
   useEffect(() => {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;
      if (saved === 'dark') setIsDark(true);
      else if (saved === 'light') setIsDark(false);
      else {
         const on = document.documentElement.classList.contains('dark');
         setIsDark(on);
      }
   }, []);

   const toggle = () => {
      const next = !isDark;
      setIsDark(next);
      setTheme(next ? 'dark' : 'light'); // tu hook aplica la clase .dark
      try { localStorage.setItem('theme', next ? 'dark' : 'light'); } catch { }
   };

   return (
      <Tooltip content={isDark ? 'Tema oscuro' : 'Tema claro'} position="bottom">
         <button
            type="button"
            onClick={toggle}
            aria-label={`Cambiar a tema ${isDark ? 'claro' : 'oscuro'}`}
            className="p-2 text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#EFF3FF] rounded-full transition-colors focus:outline-none"
         >
            {isDark ? (
               <SolIcon className="h-5 w-5 transition-transform" />
            ) : (
               <LunaIcon className="h-5 w-5 transition-transform" />
            )}
         </button>
      </Tooltip>
   );
}
