import { fetchWithAuth } from '../utils/fetchWithAuth';

async function parseJsonSafe(res) {
   try {
      return await res.json();
   } catch {
      return null;
   }
}

function extractErrorMessage(payload) {
   if (!payload || typeof payload !== 'object') return null;
   if (typeof payload.message === 'string' && payload.message.trim()) return payload.message;
   if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
   return null;
}

export async function getDashboardSummary({ entityId, month, scope = 'month', signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para cargar el dashboard');
   if (!month) throw new Error('Falta el periodo para cargar el dashboard');

   const params = new URLSearchParams({
      entityId: String(entityId),
      month,
      scope,
   });

   const res = await fetchWithAuth(`/dashboard/summary?${params.toString()}`, {
      method: 'GET',
      signal,
   });
   const payload = await parseJsonSafe(res);

   if (!res.ok) {
      throw new Error(extractErrorMessage(payload) || `No se pudo cargar el dashboard (${res.status})`);
   }

   return payload || {};
}
