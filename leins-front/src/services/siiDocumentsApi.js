import { fetchWithAuth } from '../utils/fetchWithAuth';

const parseJsonSafe = async (response) => response.json().catch(() => ({}));

const ensureOk = async (response, fallbackMessage) => {
   if (response.ok) return;
   const data = await parseJsonSafe(response);
   throw new Error(data.message || data.error || fallbackMessage);
};

export const listSiiDocuments = async ({
   entityId,
   operationType,
   from,
   to,
   month,
   type,
   q,
   folio,
   client,
   source,
   status,
   pendingOnly = false,
   page = 1,
   limit = 500,
   sort = 'issue_date',
   order = 'asc',
   signal,
} = {}) => {
   const qs = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      sort,
      order,
   });

   if (operationType) qs.set('operation_type', operationType);
   if (entityId) qs.set('entity_id', String(entityId));
   if (from) qs.set('from', from);
   if (to) qs.set('to', to);
   if (month) qs.set('month', month);
   if (type) qs.set('type', type);
   if (q) qs.set('q', q);
   if (folio) qs.set('folio', folio);
   if (client) qs.set('client', client);
   if (source) qs.set('source', source);
   if (pendingOnly) qs.set('pendingOnly', '1');
   if (status) qs.set('status', status);

   const response = await fetchWithAuth(`/sii-documents?${qs.toString()}`, { signal });
   await ensureOk(response, 'No se pudieron listar documentos');

   const data = await parseJsonSafe(response);
   const rows = Array.isArray(data?.data ?? data?.items ?? data?.rows)
      ? (data.data ?? data.items ?? data.rows)
      : [];

   return {
      rows,
      total: Number(data?.total ?? rows.length),
      totalPages: Number(data?.totalPages ?? 1),
   };
};

// funcion para descargar el listado filtrado como csv
export const exportSiiDocumentsCsv = async ({
   entityId,
   operationType,
   from,
   to,
   month,
   type,
   q,
   folio,
   client,
   source,
   status,
   pendingOnly = false,
   sort = 'issue_date',
   order = 'asc',
   signal,
} = {}) => {
   const qs = new URLSearchParams({ sort, order });

   if (operationType) qs.set('operation_type', operationType);
   if (entityId) qs.set('entity_id', String(entityId));
   if (from) qs.set('from', from);
   if (to) qs.set('to', to);
   if (month) qs.set('month', month);
   if (type) qs.set('type', type);
   if (q) qs.set('q', q);
   if (folio) qs.set('folio', folio);
   if (client) qs.set('client', client);
   if (source) qs.set('source', source);
   if (pendingOnly) qs.set('pendingOnly', '1');
   if (status) qs.set('status', status);

   const response = await fetchWithAuth(`/sii-documents/export?${qs.toString()}`, { signal });
   if (!response.ok) {
      const data = await parseJsonSafe(response);
      throw new Error(data.message || data.error || 'No se pudo exportar el listado');
   }

   const disposition = response.headers.get('Content-Disposition') || '';
   const match = disposition.match(/filename="?([^";]+)"?/);
   const filename = match ? match[1] : 'documentos.csv';
   const blob = await response.blob();

   return { blob, filename };
};

export const listDailySalesGroups = async ({ entityId, from, to, signal } = {}) => {
   const qs = new URLSearchParams();

   if (entityId) qs.set('entity_id', String(entityId));
   if (from) qs.set('from', from);
   if (to) qs.set('to', to);

   const response = await fetchWithAuth(`/sii-documents/sales/daily-groups?${qs.toString()}`, { signal });
   await ensureOk(response, 'No se pudieron agrupar ventas por dia');

   const data = await parseJsonSafe(response);

   return {
      rows: Array.isArray(data?.data) ? data.data : [],
      total: Number(data?.total || 0),
   };
};

// funcion para enviar el formulario de ingreso manual
export const createManualIncome = async (payload) => {
   const response = await fetchWithAuth('/sii-documents/manual', {
      method: 'POST',
      body: JSON.stringify(payload),
   });

   // intentamos parsear la respuesta
   const data = await parseJsonSafe(response);

   // si no es una respuesta ok, lanzamos el error del backend
   if (!response.ok) {
      throw new Error(data.message || 'Ocurrió un error al crear el registro manual.');
   }

   return data;
};

// funcion para actualizar un registro existente
export const updateManualIncome = async (id, payload) => {
   const response = await fetchWithAuth(`/sii-documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
   });

   const data = await parseJsonSafe(response);

   if (!response.ok) {
      throw new Error(data.message || 'Ocurrió un error al actualizar el registro.');
   }

   return data;
};

// funcion para eliminar
export const deleteManualIncome = async (id) => {
   const response = await fetchWithAuth(`/sii-documents/${id}`, {
      method: 'DELETE',
   });

   const data = await parseJsonSafe(response);

   if (!response.ok) {
      throw new Error(data.message || 'Ocurrió un error al eliminar el registro.');
   }

   return data;
};
