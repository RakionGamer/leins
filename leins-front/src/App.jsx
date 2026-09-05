import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';

// contextos y hooks
import { useAuth } from './context/AuthContext';
import { EntityProvider } from './context/EntityContext';
import { PeriodProvider } from './context/PeriodContext';
import useRouteTheme from './hooks/useRouteTheme';

// configuracion y rutas
import { routesConfig } from './app/routes.config';
import PrivateRoute from './routes/PrivateRoute';

// componentes
import ErrorBoundary from './components/ErrorBoundary';
import SplashScreen from './components/SplashScreen';
import Toaster from './components/Toaster';

function RouteThemeGate() {
   useRouteTheme();
   return null;
}

// renderiza el layout con un outlet dentro
function LayoutOutlet({ element }) {
   return element || <Outlet />;
}

function App() {
   // ahora la carga depende exclusivamente de la autenticacion real.
   // si el token se valida en 100ms, la app entra en 100ms.
   const { loading } = useAuth();

   return (
      <Router
         future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true
         }}
      >
         <RouteThemeGate />
         <Toaster />

         {loading ? (
            <SplashScreen minMs={0} autoHide={false} label="verificando sesion..." />
         ) : (
            <ErrorBoundary>
               <Suspense fallback={<SplashScreen minMs={0} autoHide={false} label="cargando modulo..." />}>
                  <Routes>
                     {/* rutas publicas (restaurado a tu logica original) */}
                     {routesConfig.filter(r => r.public).map(r => (
                        <Route key={r.path} path={r.path} element={r.element} />
                     ))}

                     {/* rutas privadas */}
                     {routesConfig.filter(r => r.private).map(r => (
                        <Route
                           key={r.path}
                           path={r.path}
                           element={
                              <PrivateRoute>
                                 <EntityProvider>
                                    <PeriodProvider>
                                       <Suspense fallback={<SplashScreen minMs={0} autoHide={false} label="cargando modulo..." />}>
                                          <LayoutOutlet element={r.layout} />
                                       </Suspense>
                                    </PeriodProvider>
                                 </EntityProvider>
                              </PrivateRoute>
                           }
                        >
                           {r.children?.map((c, idx) => (
                              <Route
                                 key={`${r.path}__${c.path || 'index'}__${idx}`}
                                 index={!!c.index}
                                 path={c.path}
                                 element={c.element}
                              />
                           ))}
                        </Route>
                     ))}

                     {/* fallback global */}
                     <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
               </Suspense>
            </ErrorBoundary>
         )}
      </Router>
   );
}

export default App;
