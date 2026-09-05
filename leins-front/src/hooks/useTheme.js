import { useLayoutEffect } from 'react';
import { updateUserTheme } from '../services/userApi';
import { useAuth } from '../context/AuthContext';

// scope: 'system' (seguir navegador) | 'user' (seguir preferencia user.theme)
export function useTheme(scope = 'user') {
   const { user } = useAuth();

   // Usamos useLayoutEffect para evitar parpadeos visuales al cambiar de ruta o estado
   // Nota: En Next.js o SSR esto daría advertencia, pero en CRA (React puro) es seguro y mejor para UI.
   useLayoutEffect(() => {
      // ... (Misma lógica que tenías dentro de tu useEffect) ...
      const getSystemDark = () =>
         typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-color-scheme: dark)').matches;

      const stored = typeof window !== 'undefined' ? localStorage.getItem('theme') : null;

      // Prioridad: 1. Configuración explícita del sistema, 2. Preferencia de usuario (DB), 3. LocalStorage
      const mode = scope === 'system' ? 'system' : (user?.theme || stored || 'system');

      const apply = () => {
         const isDark = mode === 'system' ? getSystemDark() : mode === 'dark';
         // toggle(clase, force) -> force true añade, false quita
         document.documentElement.classList.toggle('dark', !!isDark);
      };

      apply();

      // Listener para cambios en el sistema operativo
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => {
         if (mode === 'system') apply(); // Solo reaccionar si estamos en modo sistema
      };

      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);

   }, [scope, user?.theme]); // Dependencias
   // opcional: cambiar tema manualmente
   const setTheme = (newTheme) => {
      const getSystemDark = () =>
         typeof window !== 'undefined' &&
         window.matchMedia &&
         window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = newTheme === 'system' ? getSystemDark() : newTheme === 'dark';
      document.documentElement.classList.toggle('dark', !!isDark);
      try { localStorage.setItem('theme', newTheme); } catch { }
      // intenta persistir en backend sin bloquear UI (si existe ese endpoint)
      updateUserTheme?.({ theme: newTheme }).catch(() => { });
   };

   return { setTheme };
}