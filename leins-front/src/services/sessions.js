import { fetchWithAuth } from '../utils/fetchWithAuth';

export async function listSessions({ status = 'active', limit = 10, offset = 0 } = {}) {
   const qs = new URLSearchParams({ status, limit, offset });
   const res = await fetchWithAuth(`/auth/sessions?${qs.toString()}`, { method: 'GET' });
   if (!res.ok) throw new Error(`Error al listar sesiones (${res.status})`);
   const json = await res.json();
   return json?.data ?? json;
}

export async function deleteSession(id) {
   const res = await fetchWithAuth(`/auth/sessions/${id}`, { method: 'DELETE' });
   if (!res.ok) throw new Error(`No se pudo cerrar la sesión (${res.status})`);
   return true;
}

export async function logoutAll() {
   const res = await fetchWithAuth(`/auth/logout-all`, { method: 'POST' });
   if (!res.ok) throw new Error(`No se pudo cerrar todas las sesiones (${res.status})`);
   return true;
}