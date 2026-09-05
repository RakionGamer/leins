import { fetchWithAuth } from '../utils/fetchWithAuth';

// obtener perfil del usuario actual
export async function getProfile() {
   const res = await fetchWithAuth('/super-admin/profile', {
      method: 'GET',
   });
   const payload = await res.json();
   return payload?.data ?? payload;
}

// actualizar datos del perfil (nombre, telefono, etc)
export async function updateProfile(data) {
   const response = await fetchWithAuth(`/super-admin/profile`, {
      method: 'PATCH',
      body: JSON.stringify(data)
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al actualizar perfil');
   return payload.data;
}

// cambiar tema de interfaz (light/dark)
export async function updateUserTheme({ theme }) {
   const res = await fetchWithAuth('/super-admin/theme', {
      method: 'PATCH',
      body: JSON.stringify({ theme }),
   });
   const payload = await res.json();
   return payload?.data ?? payload;
}

// cambiar contrasena estando logueado (privada)
export async function changePasswordInSession({ oldPassword, newPassword }) {
   const res = await fetchWithAuth('/super-admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
   });

   const data = await res.json();

   // si el backend responde con error lanzamos excepcion
   if (!res.ok) {
      throw new Error(data.message || 'No se pudo actualizar la contraseña');
   }
   return data;
}

// subir foto de perfil
export async function uploadAvatar(file) {
   const formData = new FormData();
   formData.append('avatar', file);

   // fetchWithAuth maneja el token y el content-type automaticamente para formdata
   const res = await fetchWithAuth('/super-admin/avatar', {
      method: 'POST',
      body: formData,
   });

   const payload = await res.json();
   if (!res.ok) throw new Error(payload.message || 'Error al subir imagen');

   return payload.data;
}

// --- 2FA ---

export async function generate2FA() {
   const res = await fetchWithAuth('/auth/2fa/generate', { method: 'POST' });
   const payload = await res.json();
   if (!res.ok) throw new Error(payload.message);
   return payload.data; // { qrCode, tempSecret }
}

export async function enable2FA(token, secret) {
   const res = await fetchWithAuth('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ token, secret }),
   });
   const payload = await res.json();
   if (!res.ok) throw new Error(payload.message);
   return payload.data;
}

export async function disable2FA() {
   const res = await fetchWithAuth('/auth/2fa/disable', { method: 'POST' });
   const payload = await res.json();
   if (!res.ok) throw new Error(payload.message);
   return payload;
}

export async function getSuperAdmins({ page = 1, limit = 10, search = '' }) {
   // Calculamos el offset basado en la página
   const offset = (page - 1) * limit;

   // Construimos la query string
   const params = new URLSearchParams({ limit, offset });
   if (search) params.append('search', search);

   const response = await fetchWithAuth(`/super-admin?${params.toString()}`);
   const data = await response.json();

   if (!response.ok) throw new Error(data.message || 'Error al cargar usuarios');
   return data; // { total, items }
}

export async function changeAdminState(id, stateId) {
   const response = await fetchWithAuth(`/super-admin/${id}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ state_id: stateId })
   });
   return response.json();
}

export async function deleteAdmin(id) {
   const response = await fetchWithAuth(`/super-admin/${id}`, {
      method: 'DELETE'
   });
   return response.json();
}

// Obtener un solo admin (para editar)
export async function getSuperAdminById(id) {
   const response = await fetchWithAuth(`/super-admin/${id}`);
   if (!response.ok) throw new Error('Error al cargar usuario');
   return response.json();
}

// Crear admin
export async function createSuperAdmin(data) {
   const response = await fetchWithAuth('/super-admin', {
      method: 'POST',
      body: JSON.stringify(data)
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al crear');
   return payload;
}

// Actualizar admin
export async function updateSuperAdmin(id, data) {
   const response = await fetchWithAuth(`/super-admin/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al actualizar');
   return payload;
}

export async function getAdminEntityAssignments(id) {
   const response = await fetchWithAuth(`/super-admin/${id}/entities`);
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al cargar entidades asignadas');
   return {
      rows: payload.rows ?? [],
      total: Number(payload.total ?? 0)
   };
}

export async function listAssignableEntities({ q = '', limit = 100, offset = 0, activeOnly = true, signal } = {}) {
   const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      activeOnly: activeOnly ? 'true' : 'false'
   });
   if (q && q.trim()) params.set('q', q.trim());

   const response = await fetchWithAuth(`/super-admin/entity-assignments/available?${params.toString()}`, {
      method: 'GET',
      signal
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al cargar entidades disponibles');

   return {
      rows: payload.rows ?? [],
      total: Number(payload.total ?? 0)
   };
}

export async function assignEntityToAdmin({ adminId, entityId, canCreate = true, canUpdate = true, canDelete = false, isAdmin = false }) {
   const response = await fetchWithAuth(`/super-admin/${adminId}/entities`, {
      method: 'POST',
      body: JSON.stringify({
         entity_id: Number(entityId),
         can_create: Boolean(canCreate),
         can_update: Boolean(canUpdate),
         can_delete: Boolean(canDelete),
         is_admin: Boolean(isAdmin),
      })
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al asignar entidad');
   return payload;
}

export async function updateAdminEntityAssignment({ adminId, entityId, canCreate = true, canUpdate = true, canDelete = false, isAdmin = false }) {
   const response = await fetchWithAuth(`/super-admin/${adminId}/entities/${entityId}`, {
      method: 'PUT',
      body: JSON.stringify({
         can_create: Boolean(canCreate),
         can_update: Boolean(canUpdate),
         can_delete: Boolean(canDelete),
         is_admin: Boolean(isAdmin),
      })
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al actualizar asignacion');
   return payload;
}

export async function removeEntityFromAdmin({ adminId, entityId }) {
   const response = await fetchWithAuth(`/super-admin/${adminId}/entities/${entityId}`, {
      method: 'DELETE'
   });
   const payload = await response.json();
   if (!response.ok) throw new Error(payload.message || 'Error al quitar entidad');
   return payload;
}
