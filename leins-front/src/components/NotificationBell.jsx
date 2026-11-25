import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUnreadNotifications, markNotificationAsRead } from '../services/notificationApi';
import { CampanaIcon } from './icons/SidebarIcons';

export default function NotificationBell() {
   const { auth } = useAuth();
   const [unread, setUnread] = useState([]);
   const [isOpen, setIsOpen] = useState(false);
   const panelRef = useRef(null);

   useEffect(() => {
      let isSubscribed = true;
      let timeoutId = null;

      const token = auth?.accessToken || localStorage.getItem('accessToken');
      if (!token) return;

      const pollNotifs = async () => {
         if (!isSubscribed) return;

         try {
            const data = await getUnreadNotifications();
            if (Array.isArray(data) && isSubscribed) {
               setUnread(data);
            }
         } catch (error) {
            console.error('[NotificationBell] Error polling:', error);
         }

         // validacion critica: si la sesion ya no existe (porque fetchWithAuth llamo a logout),
         // cortamos la recursion inmediatamente para no hacer spam.
         const currentToken = localStorage.getItem('accessToken');
         if (!currentToken) {
            console.warn('[NotificationBell] Sesión cerrada, deteniendo campana.');
            return;
         }

         // programamos el siguiente ciclo solo cuando el actual termino de procesarse
         if (isSubscribed) {
            timeoutId = setTimeout(pollNotifs, 15000);
         }
      };

      // iniciar el primer ciclo
      pollNotifs();

      // cleanup al desmontar
      return () => {
         isSubscribed = false;
         if (timeoutId) clearTimeout(timeoutId);
      };
   }, [auth]);

   const handleMarkAsRead = async (id) => {
      try {
         setUnread(prev => prev.filter(n => n.id !== id));
         await markNotificationAsRead(id);
      } catch (error) {
         console.error(error);
      }
   };

   useEffect(() => {
      const clickOut = (e) => {
         if (panelRef.current && !panelRef.current.contains(e.target)) {
            setIsOpen(false);
         }
      };
      document.addEventListener('mousedown', clickOut);
      return () => document.removeEventListener('mousedown', clickOut);
   }, []);

   return (
      <div className="relative" ref={panelRef}>
         <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="relative p-2 text-[#55607A] hover:text-[#0A1A3F] hover:bg-[#EFF3FF] dark:text-[#8DA2CC] dark:hover:text-white dark:hover:bg-[#132652] rounded-full transition-colors focus:outline-none"
            aria-label="Notificaciones"
         >
            <CampanaIcon className="w-5 h-5 text-[#55607A] dark:text-[#8DA2CC]" />

            {unread.length > 0 && (
               <span className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1F6BFF] text-[9px] font-bold text-white shadow-sm">
                  {unread.length > 9 ? '9+' : unread.length}
               </span>
            )}
         </button>

         {isOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-bg-content border border-border-subtle rounded-xl shadow-xl z-50 overflow-hidden ring-1 ring-black ring-opacity-5">
               <div className="p-3 border-b border-border-subtle bg-surface-1 font-semibold text-sm text-heading">
                  notificaciones
               </div>
               <div className="max-h-80 overflow-y-auto custom-scrollbar">
                  {unread.length === 0 ? (
                     <div className="p-6 text-center text-sm text-text-soft">
                        no tienes notificaciones nuevas.
                     </div>
                  ) : (
                     unread.map(n => (
                        <div key={n.id} className="p-3 border-b border-border-subtle hover:bg-surface-1 transition-colors flex gap-3 items-start">
                           <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${n.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                           <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-heading truncate">{n.title}</h4>
                              <p className="text-xs text-text-soft mt-0.5 break-words leading-relaxed">{n.message}</p>
                              <div className="mt-2 flex justify-end">
                                 <button
                                    onClick={() => handleMarkAsRead(n.id)}
                                    className="text-[10px] font-medium text-brand hover:text-brand-strong transition-colors"
                                 >
                                    marcar leida
                                 </button>
                              </div>
                           </div>
                        </div>
                     ))
                  )}
               </div>
            </div>
         )}
      </div>
   );
}