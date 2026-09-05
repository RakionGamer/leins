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

export async function listClientUsers({ entityId, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para listar clientes');

   const res = await fetchWithAuth(`/super-admin/clients?entityId=${entityId}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudieron listar los clientes');
   const json = (await parseJsonSafe(res)) || {};
   return { ok: Boolean(json.ok ?? true), rows: json.rows ?? [] };
}

export async function createClientUser({ entityId, username, email, password, name, lastName, readOnly = true, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para crear el cliente');

   const res = await fetchWithAuth('/super-admin/clients', {
      method: 'POST',
      body: JSON.stringify({ entityId, username, email, password, name, lastName, readOnly }),
      signal
   });

   await ensureOk(res, 'No se pudo crear el cliente');
   const json = (await parseJsonSafe(res)) || {};
   return { ok: Boolean(json.ok ?? true), row: json.row ?? null };
}

export async function updateClientUserAccess({ userId, entityId, readOnly, signal } = {}) {
   if (!userId) throw new Error('Falta el id del cliente');
   if (!entityId) throw new Error('Falta la entidad');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}/entities/${entityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ readOnly }),
      signal
   });

   await ensureOk(res, 'No se pudo actualizar el permiso del cliente');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function updateClientUser({ userId, entityId, username, name, lastName, signal } = {}) {
   if (!userId) throw new Error('Falta el id del cliente');
   if (!entityId) throw new Error('Falta la entidad');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ entityId, username, name, lastName }),
      signal
   });

   await ensureOk(res, 'No se pudo actualizar el cliente');
   const json = (await parseJsonSafe(res)) || {};
   return { ok: Boolean(json.ok ?? true), row: json.row ?? null };
}
