// src/layouts/DashboardLayout.jsx
import { Suspense, useEffect, useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from 'components/Sidebar';
import Header from 'components/Header';
import SplashScreen from 'components/SplashScreen';
import { useAuth } from '../context/AuthContext';

export default function DashboardLayout() {
   const navigate = useNavigate();
   const { logout } = useAuth();
   const [sidebarOpen, setSidebarOpen] = useState(false);

   // leer estado inicial de localstorage (si no existe, default true)
   const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
      try {
         const stored = localStorage.getItem('sidebar_collapsed');
         return stored === null ? true : JSON.parse(stored);
      } catch {
         return true;
      }
   });

   // guardar cada vez que cambie
   useEffect(() => {
      try {
         localStorage.setItem('sidebar_collapsed', JSON.stringify(sidebarCollapsed));
      } catch (e) {
         console.warn('no se pudo persistir el estado del sidebar');
      }
   }, [sidebarCollapsed]);

   useEffect(() => {
      if (sidebarOpen) {
         const { overflow } = document.body.style;
         document.body.style.overflow = 'hidden';
         return () => { document.body.style.overflow = overflow; };
      }
   }, [sidebarOpen]);

   // cerrar sidebar con tecla escape
   useEffect(() => {
      if (!sidebarOpen) return;
      const onKey = (e) => { if (e.key === 'Escape') setSidebarOpen(false); };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
   }, [sidebarOpen]);

   const handleLogout = async () => {
      try {
         await logout();
      } finally {
         navigate('/login', { replace: true });
      }
   };

   return (
      <div
         className="h-[100dvh] w-full flex overflow-hidden relative text-[var(--text-main)] bg-[#F5F8FF]"
         style={{ '--sb-collapsed': sidebarCollapsed ? '70px' : '240px' }}
      >
         {/* sidebar fijo */}
         <div className={`fixed z-30 inset-y-0 left-0 transition-transform duration-300 will-change-transform motion-reduce:transition-none
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
            <Sidebar
               collapsed={sidebarCollapsed}
               setCollapsed={setSidebarCollapsed}
               onClose={() => setSidebarOpen(false)}
               onLogout={handleLogout}
            />
         </div>

         {/* backdrop movil */}
         {sidebarOpen && (
            <button
               type="button"
               aria-label="Cerrar menú"
               onClick={() => setSidebarOpen(false)}
               className="fixed inset-0 bg-black/30 backdrop-blur-[1px] md:hidden z-20"
               aria-hidden="false"
            />
         )}

         {/* contenido */}
         <div
            className="flex-1 flex min-w-0 md:pl-[var(--sb-collapsed)] transition-[padding] duration-300 min-h-0 flex-col"
            aria-hidden={sidebarOpen}
         >
            <Header
               toggleSidebar={() => setSidebarOpen((s) => !s)}
               sidebarOpen={sidebarOpen}
            />

            {/* aseguramos que esta etiqueta controle el scroll vertical */}
            <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-[#F5F8FF]">
               <div className="w-full max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                  <Suspense fallback={<SplashScreen fullScreen={false} label="Cargando módulo..." />}>
                     <Outlet />
                  </Suspense>
               </div>
            </main>
         </div>
      </div>
   );
}