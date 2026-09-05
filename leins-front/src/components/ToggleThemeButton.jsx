import { useEffect, useState } from 'react';
import { SunIcon, MoonIcon } from '@heroicons/react/24/solid';
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
         className="
        group relative inline-flex h-10 w-10 items-center justify-center
        rounded-full shadow-sm backdrop-blur transition
        text-text-main
        ring-1 ring-border-subtle/40 hover:ring-border-strong/40
        bg-bg-content/40 hover:bg-bg-content/60
        focus:outline-none focus-visible:ring-2 focus-visible:ring-brand/60
        focus-visible:ring-offset-2 focus-visible:ring-offset-bg-shell
      "
      >
         {/* halo sutil */}
         <span className="absolute inset-0 rounded-full bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition" />

         {/* íconos apilados, con crossfade/scale */}
         <SunIcon
            className={`
          absolute h-5 w-5 transition
          ${isDark ? 'opacity-0 scale-75 rotate-6' : 'opacity-100 scale-100 rotate-0'}
        `}
         />
         <MoonIcon
            className={`
          absolute h-5 w-5 transition
          ${isDark ? 'opacity-100 scale-100 rotate-0' : 'opacity-0 scale-75 -rotate-6'}
        `}
         />
      </button>
      </Tooltip>
   );
}
