import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { getUnreadNotifications, markNotificationAsRead } from '../services/notificationApi';

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
            className="relative p-2 text-text-soft hover:text-text-main hover:bg-surface-2 rounded-full transition-colors focus:outline-none"
         >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>

            {unread.length > 0 && (
               <span className="absolute top-1 right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-[9px] font-bold text-white justify-center items-center">
                     {unread.length > 9 ? '9+' : unread.length}
                  </span>
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