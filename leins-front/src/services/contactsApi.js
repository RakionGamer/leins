import { fetchWithAuth } from '../utils/fetchWithAuth';

const parseJsonSafe = async (response) => response.json().catch(() => ({}));

const request = async (url, options = {}, fallbackMessage = 'Error del servidor') => {
   const response = await fetchWithAuth(url, options);
   if (!response.ok) {
      const err = await parseJsonSafe(response);
      throw new Error(err.message || `${fallbackMessage} (${response.status})`);
   }
   return parseJsonSafe(response);
};

const buildQs = (params = {}) => {
   const qs = new URLSearchParams();
   Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
   });
   return qs.toString();
};

export const getContacts = ({ entityId, search, type, source, limit, offset, all, signal } = {}) =>
   request(
      `/contacts?${buildQs({ entityId, search, type, source, limit, offset, all })}`,
      { signal },
      'Error al cargar los contactos'
   );

export const getContactsForSelect = ({ entityId, q, limit = 100, signal } = {}) =>
   request(
      `/contacts/select?${buildQs({ entityId, q, limit })}`,
      { signal },
      'Error al buscar contactos'
   );

export const createContact = ({ entityId, ...payload }) =>
   request(
      `/contacts?${buildQs({ entityId })}`,
      { method: 'POST', body: JSON.stringify(payload) },
      'Error al crear el contacto'
   );

export const updateContact = (id, { entityId, ...payload }) =>
   request(
      `/contacts/${id}?${buildQs({ entityId })}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
      'Error al actualizar el contacto'
   );

export const deleteContact = (id, entityId) =>
   request(
      `/contacts/${id}?${buildQs({ entityId })}`,
      { method: 'DELETE' },
      'Error al eliminar el contacto'
   );

export const syncContactsFromSii = ({ entityId }) =>
   request(
      `/contacts/sync?${buildQs({ entityId })}`,
      { method: 'POST' },
      'Error al sincronizar contactos desde el SII'
   );
