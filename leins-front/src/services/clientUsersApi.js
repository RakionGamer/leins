// leins-front/src/services/clientUsersApi.js
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

// Listar clientes (con búsqueda, paginación y filtro opcional por entidad)
export async function listClientUsers({ entityId, search, page = 1, limit = 10, signal } = {}) {
   const params = new URLSearchParams();
   if (entityId) params.append('entityId', entityId);
   if (search && String(search).trim()) params.append('search', String(search).trim());
   if (page) params.append('page', page);
   if (limit) params.append('limit', limit);

   const qs = params.toString();
   const url = `/super-admin/clients${qs ? `?${qs}` : ''}`;

   const res = await fetchWithAuth(url, { method: 'GET', signal });
   await ensureOk(res, 'No se pudieron listar los clientes');
   const json = (await parseJsonSafe(res)) || {};

   return {
      ok: Boolean(json.ok ?? true),
      rows: json.rows ?? [],
      total: Number(json.total || 0),
      page: Number(json.page || page),
      limit: Number(json.limit || limit),
   };
}

// Obtener un cliente por id
export async function getClientUser({ userId, signal } = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');
   const res = await fetchWithAuth(`/super-admin/clients/${userId}`, { method: 'GET', signal });
   await ensureOk(res, 'No se pudo obtener el cliente');
   const json = (await parseJsonSafe(res)) || {};
   return json.client ?? json.row ?? null;
}

// Crear un nuevo cliente
export async function createClientUser({
   username,
   email,
   password,
   name,
   lastName,
   entityId,
   entityIds,
   permissions,
   preset,
   readOnly = false,
   signal
} = {}) {
   const res = await fetchWithAuth('/super-admin/clients', {
      method: 'POST',
      body: JSON.stringify({
         username,
         email,
         password,
         name,
         lastName,
         entityId,
         entityIds,
         permissions,
         preset,
         readOnly
      }),
      signal
   });

   await ensureOk(res, 'No se pudo crear el cliente');
   const json = (await parseJsonSafe(res)) || {};
   return { ok: Boolean(json.ok ?? true), row: json.row ?? null };
}

// Actualizar datos de un cliente
export async function updateClientUser({
   userId,
   username,
   email,
   name,
   lastName,
   password,
   entityIds,
   permissions,
   stateId,
   signal
} = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({
         username,
         email,
         name,
         lastName,
         password: password || undefined,
         entityIds,
         permissions,
         stateId
      }),
      signal
   });

   await ensureOk(res, 'No se pudo actualizar el cliente');
   const json = (await parseJsonSafe(res)) || {};
   return { ok: Boolean(json.ok ?? true), row: json.row ?? null };
}

// Cambiar estado de un cliente (1: activo, 2: suspendido)
export async function changeClientUserState({ userId, stateId, signal } = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ stateId }),
      signal
   });

   await ensureOk(res, 'No se pudo cambiar el estado del cliente');
   return (await parseJsonSafe(res)) || { ok: true };
}

// Eliminar un cliente
export async function deleteClientUser({ userId, signal } = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}`, {
      method: 'DELETE',
      signal
   });

   await ensureOk(res, 'No se pudo eliminar el cliente');
   return (await parseJsonSafe(res)) || { ok: true };
}

// Obtener permisos de un cliente
export async function getClientUserPermissions({ userId, entityId, signal } = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');
   const qs = entityId ? `?entityId=${entityId}` : '';

   const res = await fetchWithAuth(`/super-admin/clients/${userId}/permissions${qs}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudieron obtener los permisos del cliente');
   const json = (await parseJsonSafe(res)) || {};
   return {
      permissions: json.permissions ?? null,
      isCustomEntity: Boolean(json.isCustomEntity),
   };
}

// Actualizar permisos de un cliente
export async function updateClientUserPermissions({ userId, entityId, permissions, signal } = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ entityId, permissions }),
      signal
   });

   await ensureOk(res, 'No se pudieron actualizar los permisos del cliente');
   return (await parseJsonSafe(res)) || { ok: true };
}

// Obtener catálogo canónico de permisos
export async function getPermissionsCatalog({ signal } = {}) {
   const res = await fetchWithAuth('/super-admin/clients/permissions/catalog', {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudo obtener el catálogo de permisos');
   return (await parseJsonSafe(res)) || null;
}

// Compatibilidad legacy de permisos en entidad
export async function updateClientUserAccess({ userId, entityId, readOnly, signal } = {}) {
   if (!userId) throw new Error('Falta el ID del cliente');
   if (!entityId) throw new Error('Falta la entidad');

   const res = await fetchWithAuth(`/super-admin/clients/${userId}/entities/${entityId}`, {
      method: 'PATCH',
      body: JSON.stringify({ readOnly }),
      signal
   });

   await ensureOk(res, 'No se pudo actualizar el permiso del cliente');
   return (await parseJsonSafe(res)) || { ok: true };
}
