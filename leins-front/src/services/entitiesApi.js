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

function entityHasAssignedAdmin(row) {
   if (!row || typeof row !== 'object') return true;

   const countFields = [
      row.admin_count,
      row.admins_count,
      row.assigned_admins_count,
      row.assignment_count,
      row.assignments_count,
   ];
   const numericCount = countFields.find((value) => value !== undefined && value !== null && value !== '');
   if (numericCount !== undefined) return Number(numericCount) > 0;

   if (typeof row.has_admin === 'boolean') return row.has_admin;
   if (typeof row.hasAssignedAdmin === 'boolean') return row.hasAssignedAdmin;
   if (typeof row.has_assigned_admin === 'boolean') return row.has_assigned_admin;

   if (Array.isArray(row.admins)) return row.admins.length > 0;
   if (Array.isArray(row.assigned_admins)) return row.assigned_admins.length > 0;
   if (Array.isArray(row.assignments)) return row.assignments.length > 0;
   if (Array.isArray(row.entity_assignments)) return row.entity_assignments.length > 0;

   if (row.admin_id !== undefined && row.admin_id !== null) return Boolean(Number(row.admin_id));
   if (row.assigned_admin_id !== undefined && row.assigned_admin_id !== null) return Boolean(Number(row.assigned_admin_id));
   if (row.admin !== undefined && row.admin !== null) return Boolean(row.admin);
   if (row.assigned_admin !== undefined && row.assigned_admin !== null) return Boolean(row.assigned_admin);

   return true;
}

export async function listEntities({ q = '', limit = 20, offset = 0, sort = 'name', order = 'asc', activeOnly = false, assignedAdminOnly = false, signal } = {}) {
   const params = new URLSearchParams();
   params.set('limit', String(limit));
   params.set('offset', String(offset));
   if (q && q.trim()) params.set('q', q.trim());
   if (sort) params.set('sort', String(sort));
   if (order) params.set('order', String(order));
   if (activeOnly) params.set('activeOnly', 'true');

   const res = await fetchWithAuth(`/entities?${params.toString()}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudieron listar entidades');
   const json = (await parseJsonSafe(res)) || {};

   const rawRows = json.rows ?? json.data ?? [];
   const rows = assignedAdminOnly ? rawRows.filter(entityHasAssignedAdmin) : rawRows;

   return {
      ok: Boolean(json.ok ?? true),
      total: Number(rows.length !== rawRows.length ? rows.length : (json.total ?? json.pageInfo?.total ?? rows.length)),
      rows
   };
}

export async function getEntityById({ id, signal }) {
   const res = await fetchWithAuth(`/entities?id=${id}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudo obtener la entidad');
   const json = (await parseJsonSafe(res)) || {};

   const rows = json.rows ?? json.data ?? [];
   return rows.find(r => Number(r.id) === Number(id)) || null;
}

function toEntityPayload({ name, rut, legalName, stateId } = {}) {
   const payload = {};
   const addText = (key, value) => {
      if (typeof value !== 'string') return;
      const trimmed = value.trim();
      if (trimmed) payload[key] = trimmed;
   };

   addText('name', name);
   addText('rut', rut);
   addText('legal_name', legalName);
   if (stateId !== undefined && stateId !== null) payload.state_id = Number(stateId);
   return payload;
}

function readEntityRow(payload) {
   if (!payload || typeof payload !== 'object') return null;
   if (payload.row && typeof payload.row === 'object') return payload.row;
   if (payload.data && !Array.isArray(payload.data) && typeof payload.data === 'object') return payload.data;
   if (Array.isArray(payload.rows) && payload.rows[0]) return payload.rows[0];
   if (Array.isArray(payload.data) && payload.data[0]) return payload.data[0];
   return null;
}

async function mutateEntityById({ id, method, body, signal, fallbackMessage }) {
   const tries = [`/entities/${id}`, `/entities?id=${id}`];
   let lastStatus = null;
   let lastPayload = null;

   for (const path of tries) {
      const res = await fetchWithAuth(path, {
         method,
         body: body ? JSON.stringify(body) : undefined,
         signal
      });

      if (res.ok) {
         return (await parseJsonSafe(res)) || { ok: true };
      }

      const payload = await parseJsonSafe(res);
      lastStatus = res.status;
      lastPayload = payload;

      // Algunos backends exponen update/delete por query en vez de path (o viceversa)
      if (res.status === 404 || res.status === 405) continue;

      const message = extractErrorMessage(payload) || `${fallbackMessage} (${res.status})`;
      throw new Error(message);
   }

   const message = extractErrorMessage(lastPayload) || `${fallbackMessage} (${lastStatus || 'sin estado'})`;
   throw new Error(message);
}

export async function createEntity({ name, rut, legalName, signal } = {}) {
   const payload = toEntityPayload({ name, rut, legalName });
   if (!payload.name) throw new Error('Ingresa el nombre de la entidad');
   if (!payload.rut) throw new Error('Ingresa el RUT de la entidad');

   const res = await fetchWithAuth('/entities', {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
   });

   await ensureOk(res, 'No se pudo crear la entidad');
   const json = (await parseJsonSafe(res)) || {};
   return {
      ok: Boolean(json.ok ?? true),
      row: readEntityRow(json)
   };
}

export async function updateEntity({ id, name, rut, legalName, stateId, signal } = {}) {
   if (!id) throw new Error('Falta el id de la entidad a actualizar');

   const payload = toEntityPayload({ name, rut, legalName, stateId });
   const isStateOnly = Object.keys(payload).length === 1 && payload.state_id !== undefined;

   if (!isStateOnly) {
      if (!payload.name) throw new Error('Ingresa el nombre de la entidad');
      if (!payload.rut) throw new Error('Ingresa el RUT de la entidad');
   }

   const json = await mutateEntityById({
      id,
      method: 'PUT',
      body: payload,
      signal,
      fallbackMessage: 'No se pudo actualizar la entidad'
   });

   return {
      ok: Boolean(json?.ok ?? true),
      row: readEntityRow(json)
   };
}

export async function changeEntityState({ id, stateId, signal } = {}) {
   if (!id) throw new Error('Falta el id de la entidad');
   if (!stateId) throw new Error('Falta el estado de la entidad');

   return updateEntity({ id, stateId, signal });
}

export async function deleteEntity({ id, signal } = {}) {
   if (!id) throw new Error('Falta el id de la entidad a eliminar');

   const json = await mutateEntityById({
      id,
      method: 'DELETE',
      signal,
      fallbackMessage: 'No se pudo eliminar la entidad'
   });

   return {
      ok: Boolean(json?.ok ?? true),
      row: readEntityRow(json),
      id: Number(json?.id ?? id),
      deleted: Boolean(json?.deleted),
      deactivated: Boolean(json?.deactivated),
      blockedBy: Array.isArray(json?.blockedBy) ? json.blockedBy : [],
      message: typeof json?.message === 'string' ? json.message : ''
   };
}

export async function startSiiSync({ entityId, year, month, type, documentTypes = null, directions = null, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para sincronizar');
   if (!year) throw new Error('Selecciona el año');
   if (!month) throw new Error('Selecciona el mes');
   if (!type) throw new Error('Selecciona el tipo de sincronizacion');

   const payload = {
      year: Number(year),
      month: month === 'ALL' ? 'ALL' : Number(month),
      type,
   };

   if (Array.isArray(documentTypes) && documentTypes.length) {
      payload.documentTypes = documentTypes.map((value) => Number(value)).filter(Number.isFinite);
   }

   if (directions) {
      payload.directions = directions;
   }

   const res = await fetchWithAuth(`/entities/${entityId}/sync-sii`, {
      method: 'POST',
      body: JSON.stringify(payload),
      signal
   });

   await ensureOk(res, 'No se pudo iniciar la sincronizacion SII');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function listSiiSyncJobs({ entityId, status = '', type = '', limit = 10, offset = 0, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para consultar sincronizaciones');

   const params = new URLSearchParams();
   params.set('limit', String(limit));
   params.set('offset', String(offset));
   if (status) params.set('status', status);
   if (type) params.set('type', type);

   const res = await fetchWithAuth(`/entities/${entityId}/sync-sii/jobs?${params.toString()}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudo listar el historial de sincronizaciones');
   const json = (await parseJsonSafe(res)) || {};

   return {
      total: Number(json.total ?? 0),
      limit: Number(json.limit ?? limit),
      offset: Number(json.offset ?? offset),
      items: Array.isArray(json.items) ? json.items : [],
   };
}

// Helper para construir params (se mantiene igual, es logica pura)
export function buildSearchParams({ filters, extra = {}, entityId }) {
   const params = new URLSearchParams({
      limit: String(extra.limit ?? 50),
      offset: String(extra.offset ?? 0),
      sort: 'issued_at:desc,id:desc',
      ...extra
   });
   if (entityId) params.set('entityId', String(entityId));
   if (filters?.tipo && filters.tipo !== 'Todos') params.set('tipo', filters.tipo);
   if (filters?.fechaIni) params.set('fechaIni', filters.fechaIni);
   if (filters?.fechaFin) params.set('fechaFin', filters.fechaFin);
   if (filters?.montoFiltro) params.set('monto', filters.montoFiltro);
   if (filters?.descripcion) params.set('descripcion', filters.descripcion);
   if (filters?.ctaCorriente) params.set('accountId', filters.ctaCorriente);
   if (filters?.nroDocumento) params.set('nro', filters.nroDocumento);
   if (filters?.cuenta) params.set('cuenta', filters.cuenta);
   return params;
}

export async function listTransactions({ entityId, filters, limit = 50, offset = 0, soloPendientes = false, signal }) {
   const params = buildSearchParams({ filters, extra: { limit, offset }, entityId });
   if (soloPendientes) params.set('soloPendientes', '1');

   const res = await fetchWithAuth(`/banks/transactions?${params.toString()}`, { signal });
   await ensureOk(res, 'No se pudieron listar las transacciones bancarias');
   const json = (await parseJsonSafe(res)) || {};

   return {
      rows: json?.rows ?? [],
      total: Number(json?.total ?? 0)
   };
}

export async function countTransactionsByType({ entityId, filters, tipo, soloPendientes = false, signal }) {
   const params = buildSearchParams({
      filters: { ...filters, tipo },
      extra: { limit: 1, offset: 0 },
      entityId
   });
   if (soloPendientes) params.set('soloPendientes', '1');

   const res = await fetchWithAuth(`/banks/transactions?${params.toString()}`, { signal });
   await ensureOk(res, 'No se pudo contar transacciones bancarias');
   const json = (await parseJsonSafe(res)) || {};
   return Number(json?.total ?? 0);
}

export async function countTotals({ entityId, filters, soloPendientes = false, signal }) {
   const [abonos, cargos] = await Promise.all([
      countTransactionsByType({ entityId, filters, tipo: 'Abonos', soloPendientes, signal }),
      countTransactionsByType({ entityId, filters, tipo: 'Cargos', soloPendientes, signal })
   ]);
   return { abonos, cargos };
}

export async function listBankAccounts({ entityId, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para listar cuentas bancarias');

   const params = new URLSearchParams({ entityId: String(entityId) });
   const res = await fetchWithAuth(`/banks/accounts?${params.toString()}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudieron listar las cuentas bancarias');
   const json = (await parseJsonSafe(res)) || {};

   return {
      rows: json.rows ?? [],
      total: Number(json.total ?? 0)
   };
}

export async function createBankAccount({ entityId, bankName, accountNumber, currency = 'CLP', initialBalance, initialBalanceDate, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para crear la cuenta bancaria');

   const res = await fetchWithAuth('/banks/accounts', {
      method: 'POST',
      body: JSON.stringify({
         entityId: Number(entityId),
         bankName,
         accountNumber,
         currency,
         initialBalance,
         initialBalanceDate
      }),
      signal
   });

   await ensureOk(res, 'No se pudo crear la cuenta bancaria');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function updateBankAccount({ entityId, id, bankName, accountNumber, currency = 'CLP', initialBalance, initialBalanceDate, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para actualizar la cuenta bancaria');
   if (!id) throw new Error('Falta el id de cuenta bancaria a actualizar');

   const res = await fetchWithAuth(`/banks/accounts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
         entityId: Number(entityId),
         bankName,
         accountNumber,
         currency,
         initialBalance,
         initialBalanceDate
      }),
      signal
   });

   await ensureOk(res, 'No se pudo actualizar la cuenta bancaria');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function deleteBankAccount({ entityId, id, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para eliminar la cuenta bancaria');
   if (!id) throw new Error('Falta el id de cuenta bancaria a eliminar');

   const params = new URLSearchParams({ entityId: String(entityId) });
   const res = await fetchWithAuth(`/banks/accounts/${id}?${params.toString()}`, {
      method: 'DELETE',
      signal
   });

   await ensureOk(res, 'No se pudo eliminar la cuenta bancaria');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function revealBankAccountNumber({ entityId, id, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para revelar la cuenta bancaria');
   if (!id) throw new Error('Falta el id de cuenta bancaria a revelar');

   const res = await fetchWithAuth(`/banks/accounts/${id}/reveal`, {
      method: 'POST',
      body: JSON.stringify({ entityId: Number(entityId) }),
      signal
   });

   await ensureOk(res, 'No se pudo revelar el numero de cuenta');
   return (await parseJsonSafe(res)) || { ok: true };
}

export async function uploadBankExcel({ entityId, accountId, file, splitDebitCredit = false, signal }) {
   if (!file) throw new Error('Debes adjuntar un archivo');
   if (!entityId) throw new Error('Falta la entidad para la carga');
   if (!accountId) throw new Error('Selecciona una cuenta corriente antes de subir');

   const fd = new FormData();
   fd.append('entityId', String(entityId));
   fd.append('accountId', String(accountId));
   fd.append('file', file);
   fd.append('commit', 'true');
   if (splitDebitCredit) {
      fd.append('splitDebitCredit', 'true');
      fd.append('separateDebitCredit', 'true');
      fd.append('amountColumnsMode', 'split');
   }

   const res = await fetchWithAuth(`/banks/upload-excel`, {
      method: 'POST',
      body: fd,
      signal
   });

   await ensureOk(res, 'No se pudo subir el archivo');
   const payload = await parseJsonSafe(res);
   return payload ?? { ok: true };
}

function getFilenameFromDisposition(contentDisposition, fallback = 'plantilla_movimientos_bancarios.xlsx') {
   if (!contentDisposition) return fallback;

   const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
   if (utf8Match?.[1]) {
      try {
         return decodeURIComponent(utf8Match[1]);
      } catch {
         return utf8Match[1];
      }
   }

   const plainMatch = contentDisposition.match(/filename="?([^";]+)"?/i);
   if (plainMatch?.[1]) return plainMatch[1];

   return fallback;
}

export async function downloadBankMovementsTemplate({ entityId, signal } = {}) {
   if (!entityId) throw new Error('Falta la entidad para descargar la plantilla');

   const params = new URLSearchParams({ entityId: String(entityId) });
   const res = await fetchWithAuth(`/banks/upload-template?${params.toString()}`, {
      method: 'GET',
      signal
   });

   await ensureOk(res, 'No se pudo descargar la plantilla');

   const blob = await res.blob();
   const filename = getFilenameFromDisposition(
      res.headers.get('content-disposition'),
      'plantilla_movimientos_bancarios.xlsx'
   );

   return { blob, filename };
}
