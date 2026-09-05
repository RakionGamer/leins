import { fetchWithAuth } from '../utils/fetchWithAuth';

// obtener notificaciones no leidas
export async function getUnreadNotifications() {
   // fetchwithauth ya agrega la base url y el token bearer
   const res = await fetchWithAuth('/notifications/unread', {
      method: 'GET'
   });

   if (!res.ok) {
      throw new Error('error al obtener notificaciones');
   }

   return await res.json();
}

// marcar notificacion como leida
export async function markNotificationAsRead(id) {
   const res = await fetchWithAuth(`/notifications/${id}/read`, {
      method: 'PATCH'
   });

   if (!res.ok) {
      throw new Error('error al marcar notificacion');
   }

   return await res.json();
}