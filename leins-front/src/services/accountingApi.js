import { fetchWithAuth } from '../utils/fetchWithAuth';

const parseJsonSafe = async (response) => response.json().catch(() => ({}));

/**
 * Ejecuta una petición a la API real. Si el servidor responde con error,
 * lanza un Error con el mensaje del backend (sin datos de ejemplo de respaldo).
 */
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

// --- Plan de cuentas ---
export const getAccounts = ({ entityId, type, q, signal } = {}) =>
   request(`/accounting/accounts?${buildQs({ entityId, type, q })}`, { signal }, 'Error al cargar el plan de cuentas');

export const createAccount = (payload) =>
   request('/accounting/accounts', { method: 'POST', body: JSON.stringify(payload) }, 'Error al crear la cuenta');

export const seedDefaultPlan = ({ entityId }) =>
   request(`/accounting/accounts/seed?${buildQs({ entityId })}`, { method: 'POST' }, 'Error al cargar el plan por defecto');

export const updateAccount = (id, payload) =>
   request(`/accounting/accounts/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, 'Error al actualizar la cuenta');

export const deleteAccount = (id, entityId) =>
   request(`/accounting/accounts/${id}?${buildQs({ entityId })}`, { method: 'DELETE' }, 'Error al eliminar la cuenta');

// --- Reglas de Proveedores / Clientes ---
export const getRules = ({ entityId, signal } = {}) =>
   request(`/accounting/rules?${buildQs({ entityId })}`, { signal }, 'Error al cargar las reglas');

export const upsertRule = (payload) =>
   request('/accounting/rules', { method: 'POST', body: JSON.stringify(payload) }, 'Error al guardar la regla');

export const upsertBulkRules = (payload) =>
   request('/accounting/rules/bulk', { method: 'POST', body: JSON.stringify(payload) }, 'Error del servidor al guardar masivamente');

export const deleteRule = (id, entityId) =>
   request(`/accounting/rules/${id}?${buildQs({ entityId })}`, { method: 'DELETE' }, 'Error al eliminar la regla');

// --- Asientos contables ---
export const getEntries = ({ entityId, month, from, to, source_type, status, q, page = 1, limit = 50, signal } = {}) =>
   request(
      `/accounting/entries?${buildQs({ page, limit, entityId, month, from, to, source_type, status, q })}`,
      { signal },
      'Error al cargar los asientos'
   );

export const getEntryById = (id, entityId) =>
   request(`/accounting/entries/${id}?${buildQs({ entityId })}`, {}, 'Error al cargar el asiento');

export const createEntry = (payload) =>
   request('/accounting/entries', { method: 'POST', body: JSON.stringify(payload) }, 'Error del servidor al registrar el asiento');

export const annulEntry = (id, entityId) =>
   request(`/accounting/entries/${id}/annul?${buildQs({ entityId })}`, { method: 'POST' }, 'Error al anular el asiento');

export const clearAnnulledEntries = (entityId) =>
   request(`/accounting/entries/annulled/clear?${buildQs({ entityId })}`, { method: 'DELETE' }, 'Error del servidor al limpiar');

export const deleteAllEntries = (entityId) =>
   request(`/accounting/entries/all?${buildQs({ entityId })}`, { method: 'DELETE' }, 'Error del servidor al borrar');

export const generateSiiEntries = (payload) =>
   request('/accounting/entries/generate-sii', { method: 'POST', body: JSON.stringify(payload) }, 'Error del servidor');

// --- Control de saldos por RUT ---
export const getBalances = ({ entityId, type, q, signal } = {}) =>
   request(`/accounting/balances?${buildQs({ entityId, type, q })}`, { signal }, 'Error al cargar los saldos');

export const searchCounterpartyName = async (rut) => {
   try {
      const response = await fetchWithAuth(`/accounting/rules/counterparty/${encodeURIComponent(rut)}`);
      if (response.ok) return await parseJsonSafe(response);
      return { name: null };
   } catch (e) {
      return { name: null };
   }
};

export const searchCounterparties = async ({ entityId, q, signal }) => {
   try {
      const response = await fetchWithAuth(`/accounting/rules/counterparties/search?${buildQs({ entityId, q })}`, { signal });
      if (response.ok) {
         const data = await parseJsonSafe(response);
         return Array.isArray(data) ? data : [];
      }
      return [];
   } catch (e) {
      return [];
   }
};
