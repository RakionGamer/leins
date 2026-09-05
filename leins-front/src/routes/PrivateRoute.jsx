// src/routes/PrivateRoute.jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getAccessToken, getRefreshToken, isTokenValid, getAuthRole } from '../utils/auth';
import SplashScreen from '../components/SplashScreen';

export default function PrivateRoute({ children }) {
   const { loading, doRefresh } = useAuth();
   const [checking, setChecking] = useState(true);
   const [allowed, setAllowed] = useState(false);
   const location = useLocation();

   useEffect(() => {
      let mounted = true;
      const check = async () => {
         if (loading) return;
         const hasAccess = !!getAccessToken();
         const hasRefresh = !!getRefreshToken();

         if (hasAccess && isTokenValid()) {
            if (mounted) { setAllowed(true); setChecking(false); }
            return;
         }
         if (hasRefresh) {
            const ok = await doRefresh('guard');
            if (mounted) { setAllowed(!!ok); setChecking(false); }
            return;
         }
         if (mounted) { setAllowed(false); setChecking(false); }
      };
      check();
      return () => { mounted = false; };
   }, [loading, doRefresh]);

   if (loading || checking) return <SplashScreen />;

   const loginPath = getAuthRole() === 'user' ? '/portal/login' : '/login';

   return allowed ? children : <Navigate to={loginPath} replace state={{ from: location }} />;
}