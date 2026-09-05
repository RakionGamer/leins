import { createContext, useContext, useEffect, useState } from 'react';
import {
   saveTokens,
   clearTokens as clearStored,
   getAccessToken,
   getRefreshToken,
   isTokenValid,
   setStoredUser,
   getStoredUser,
   decodeJwt,
   setAuthRole,
   getAuthRole,
} from '../utils/auth';
import { loginUser, loginClient, refreshTokens } from '../services/auth';
import { getProfile, updateUserTheme } from '../services/userApi';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
   const [user, setUser] = useState(() => getStoredUser());
   const [loading, setLoading] = useState(true);
   const [role, setRole] = useState(() => getAuthRole());

   // metodo manual para refrescar (usado por privateroute)
   const doRefresh = async () => {
      try {
         const expiredAccessToken = getAccessToken();
         const rt = getRefreshToken();
         if (!rt) throw new Error('no_refresh_token');

         const uid = user?.id || getStoredUser()?.id || getStoredUser()?.userId;
         const { accessToken, refreshToken } = await refreshTokens({
            userId: uid,
            refreshToken: rt,
            expiredAccessToken,
         });

         saveTokens({ accessToken, refreshToken });
         return true;
      } catch (e) {
         console.warn('[auth] refresh failed:', e?.code || e?.message || e);
         logout();
         return false;
      }
   };

   useEffect(() => {
      const token = getAccessToken();
      // si hay token valido, cargamos perfil (solo aplica a sesiones de super_admin;
      // las sesiones de cliente ya trajeron su "user" en la respuesta del login)
      const isClientSession = decodeJwt(token)?.role === 'user';

      if (token && isTokenValid()) {
         setRole(isClientSession ? 'user' : 'super_admin');
         setAuthRole(isClientSession ? 'user' : 'super_admin');
      }

      if (token && isTokenValid() && isClientSession) {
         setLoading(false);
      } else if (token && isTokenValid()) {
         getProfile()
            .then((u) => {
               setUser(u);
               setStoredUser(u);
            })
            .catch((err) => {
               console.error('error al obtener el perfil:', err);
               // si falla el perfil (ej. token invalido), intentamos un refresh rapido o logout
               // aqui podriamos llamar a doRefresh, pero por seguridad limpiamos si falla inicial
               clearStored();
            })
            .finally(() => setLoading(false));
      } else {
         // si no hay token o expiro, privateroute se encargara de intentar el refresh
         setLoading(false);
      }

      const onStorage = (e) => {
         if (e.key === 'logout') setUser(null);
      };
      window.addEventListener('storage', onStorage);
      return () => {
         window.removeEventListener('storage', onStorage);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   const login = async (credentials) => {
      // Llamamos a la API (que ahora retorna { ... } o { require2fa: true ... })
      const data = await loginUser(credentials);

      // CASO 1: Pide 2FA
      if (data.require2fa) {
         // NO guardamos tokens todavía.
         // Retornamos un objeto especial para que el componente Login sepa qué hacer.
         return {
            require2fa: true,
            userId: data.userId,
            message: data.message
         };
      }

      // CASO 2: Login directo (viene accessToken y data.data)
      // Ajusta esto según cómo venga tu JSON. En el backend pusimos: res.json({ data: { accessToken... } })
      // Ojo: Si tu backend devuelve { message: '...', data: { accessToken... } }
      const session = data.data || data;

      const { accessToken, refreshToken, user: u } = session;

      saveTokens({ accessToken, refreshToken });
      setUser(u);
      setStoredUser(u);
      setRole('super_admin');
      setAuthRole('super_admin');

      return { success: true };
   };

   // login para cuentas cliente (autogestion por entidad)
   const loginAsClient = async (credentials) => {
      const { accessToken, refreshToken, user: u } = await loginClient(credentials);

      saveTokens({ accessToken, refreshToken });
      setUser(u);
      setStoredUser(u);
      setRole('user');
      setAuthRole('user');

      return { success: true };
   };

   const logout = () => {
      clearStored();
      setUser(null);
      setRole(null);
      try { localStorage.setItem('logout', Date.now().toString()); } catch { }
      try { localStorage.removeItem('logout'); } catch { }
   };

   const updateTheme = async (newTheme) => {
      try {
         const updated = await updateUserTheme({ theme: newTheme });
         setUser(updated);
         setStoredUser(updated);
      } catch (err) {
         console.error('error al actualizar el tema:', err);
      }
   };

   return (
      <AuthContext.Provider value={{ user, setUser, login, loginAsClient, logout, updateTheme, loading, doRefresh, role, isClient: role === 'user' }}>
         {children}
      </AuthContext.Provider>
   );
}

export function useAuth() {
   const context = useContext(AuthContext);
   if (!context) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
   return context;
}