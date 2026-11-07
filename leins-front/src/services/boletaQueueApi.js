// leins-front/src/services/boletaQueueApi.js
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
   if (Array.isArray(payload.errors) && typeof payload.errors[0]?.message === 'string') return payload.errors[0].message;
   return null;
}

async function ensureOk(res, fallbackMessage) {
   if (res.ok) return null;
   const payload = await parseJsonSafe(res);
   const message = extractErrorMessage(payload) || `${fallbackMessage} (${res.status})`;
   throw new Error(message);
}

/**
 * Encolar una nueva solicitud de boleta
 */
export async function enqueueBoleta(payload = {}) {
   const res = await fetchWithAuth('/boletas/queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
   });
   await ensureOk(res, 'No se pudo encolar la emision de la boleta');
   return (await parseJsonSafe(res)) || {};
}

/**
 * Encolar múltiples solicitudes de boleta en lote (masivo)
 */
export async function enqueueBatchBoletas({ entityId, transactions = [] }) {
   const res = await fetchWithAuth('/boletas/queue-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId, transactions }),
   });
   await ensureOk(res, 'No se pudieron encolar las boletas seleccionadas');
   return (await parseJsonSafe(res)) || {};
}

/**
 * Listar solicitudes de boletas con filtros y paginación
 */
export async function listBoletaRequests(params = {}) {
   const { entityId, status, page = 1, limit = 50, signal } = params;
   const qs = new URLSearchParams();

   if (entityId) qs.set('entityId', String(entityId));
   if (status && status !== 'all') qs.set('status', String(status));
   if (page) qs.set('page', String(page));
   if (limit) qs.set('limit', String(limit));

   const res = await fetchWithAuth(`/boletas?${qs.toString()}`, { signal });
   await ensureOk(res, 'No se pudieron obtener las solicitudes de boletas');
   return (await parseJsonSafe(res)) || { total: 0, rows: [] };
}

/**
 * Obtener mapa de solicitudes activas para un conjunto de transacciones bancarias
 */
export async function getActiveBoletaMap({ entityId, ids = [] }) {
   if (!entityId || !ids.length) return {};
   const qs = new URLSearchParams({
      entityId: String(entityId),
      ids: ids.join(','),
   });

   const res = await fetchWithAuth(`/boletas/active-map?${qs.toString()}`);
   await ensureOk(res, 'No se pudo consultar el estado de boletas de los movimientos');
   const data = (await parseJsonSafe(res)) || {};
   return data.map || {};
}

/**
 * Cancelar una solicitud pendiente de boleta
 */
export async function cancelBoletaRequest(id, entityId) {
   const res = await fetchWithAuth(`/boletas/${id}?entityId=${entityId}`, {
      method: 'DELETE',
   });
   await ensureOk(res, 'No se pudo cancelar la solicitud de boleta');
   return (await parseJsonSafe(res)) || {};
}

/**
 * Reintentar una solicitud de boleta fallida
 */
export async function retryBoletaRequest(id, entityId) {
   const res = await fetchWithAuth(`/boletas/${id}/retry?entityId=${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId }),
   });
   await ensureOk(res, 'No se pudo reintentar la emisión de la boleta');
   return (await parseJsonSafe(res)) || {};
}

/**
 * Reintentar todas las solicitudes de boletas fallidas
 */
export async function retryAllFailedBoletas(entityId) {
   const res = await fetchWithAuth(`/boletas/retry-all?entityId=${entityId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityId }),
   });
   await ensureOk(res, 'No se pudieron reintentar las boletas fallidas');
   return (await parseJsonSafe(res)) || {};
}
