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

function readRow(payload) {
   if (!payload || typeof payload !== 'object') return null;
   if (payload.row && typeof payload.row === 'object') return payload.row;
   if (payload.data && !Array.isArray(payload.data) && typeof payload.data === 'object') return payload.data;
   return null;
}

export async function listCredentials({ entityId, type, limit = 50, offset = 0, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para listar credenciales');

   const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
   });
   if (type) params.set('type', String(type).toUpperCase());

   const res = await fetchWithAuth(`/entities/${entityId}/credentials?${params.toString()}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudieron listar las credenciales');
   const json = (await parseJsonSafe(res)) || {};

   return {
      ok: Boolean(json.ok ?? true),
      total: Number(json.total ?? 0),
      rows: json.rows ?? []
   };
}

export async function createCredential({ entityId, payload, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para crear la credencial');

   const res = await fetchWithAuth(`/entities/${entityId}/credentials`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
   });

   await ensureOk(res, 'No se pudo crear la credencial');
   const json = (await parseJsonSafe(res)) || {};
   return {
      ok: Boolean(json.ok ?? true),
      row: readRow(json)
   };
}

export async function updateCredential({ entityId, id, payload, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para actualizar la credencial');
   if (!id) throw new Error('Falta el id de la credencial');

   const res = await fetchWithAuth(`/entities/${entityId}/credentials/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      signal
   });

   await ensureOk(res, 'No se pudo actualizar la credencial');
   const json = (await parseJsonSafe(res)) || {};
   return {
      ok: Boolean(json.ok ?? true),
      row: readRow(json)
   };
}

export async function deleteCredential({ entityId, id, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para eliminar la credencial');
   if (!id) throw new Error('Falta el id de la credencial');

   const res = await fetchWithAuth(`/entities/${entityId}/credentials/${id}`, {
      method: 'DELETE',
      signal
   });

   await ensureOk(res, 'No se pudo eliminar la credencial');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function revealCredential({ entityId, id, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para revelar la credencial');
   if (!id) throw new Error('Falta el id de la credencial');

   const res = await fetchWithAuth(`/entities/${entityId}/credentials/${id}/reveal`, {
      method: 'POST',
      signal
   });

   await ensureOk(res, 'No se pudo revelar la credencial');
   return (await parseJsonSafe(res)) || { ok: true };
}
