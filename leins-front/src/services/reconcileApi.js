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

export async function fetchSuggestions(params = {}) {
   const { signal, page, pageSize, limit, offset, ...rest } = params || {};
   const qs = new URLSearchParams();

   const parsedLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Math.trunc(Number(limit)))
      : (Number.isFinite(Number(pageSize)) ? Math.max(1, Math.trunc(Number(pageSize))) : null);

   const parsedOffset = Number.isFinite(Number(offset))
      ? Math.max(0, Math.trunc(Number(offset)))
      : (Number.isFinite(Number(page)) && parsedLimit != null
         ? Math.max(0, (Math.max(1, Math.trunc(Number(page))) - 1) * parsedLimit)
         : null);

   if (parsedLimit != null) qs.set('limit', String(parsedLimit));
   if (parsedOffset != null) qs.set('offset', String(parsedOffset));

   Object.entries(rest).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
   });

   const res = await fetchWithAuth(`/banks/reconcile/suggestions?${qs.toString()}`, { signal });
   await ensureOk(res, 'No se pudieron obtener sugerencias de conciliacion');
   return (await parseJsonSafe(res)) || {};
}

export async function fetchSuggestionsFast(params = {}) {
   const { signal, page, pageSize, limit, offset, ...rest } = params || {};
   const qs = new URLSearchParams();

   const parsedLimit = Number.isFinite(Number(limit))
      ? Math.max(1, Math.trunc(Number(limit)))
      : (Number.isFinite(Number(pageSize)) ? Math.max(1, Math.trunc(Number(pageSize))) : null);

   const parsedOffset = Number.isFinite(Number(offset))
      ? Math.max(0, Math.trunc(Number(offset)))
      : (Number.isFinite(Number(page)) && parsedLimit != null
         ? Math.max(0, (Math.max(1, Math.trunc(Number(page))) - 1) * parsedLimit)
         : null);

   if (parsedLimit != null) qs.set('limit', String(parsedLimit));
   if (parsedOffset != null) qs.set('offset', String(parsedOffset));

   Object.entries(rest).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
   });

   const res = await fetchWithAuth(`/banks/reconcile/suggestions/fast?${qs.toString()}`, { signal });
   await ensureOk(res, 'No se pudieron obtener sugerencias de conciliacion');
   return (await parseJsonSafe(res)) || {};
}

export async function fetchAllSuggestions(params = {}) {
   const pageSize = params.pageSize ?? 200;
   const base = { ...params };
   let page = 1;
   let all = [];
   let total = 0;

   while (true) {
      const out = await fetchSuggestions({ ...base, page, pageSize });

      const rows = out?.rows ?? out?.data ?? [];
      const t = Number(out?.total ?? out?.pageInfo?.total ?? 0);

      if (!Number.isNaN(t) && t > 0) total = t;
      all.push(...rows);

      if (rows.length < pageSize || (total > 0 && all.length >= total)) break;
      page += 1;
   }

   return { rows: all, total };
}

export async function fetchSuggestionsCount(params) {
   const { signal, ...rest } = params || {};
   const qs = new URLSearchParams();

   Object.entries(rest).forEach(([k, v]) => {
      if (v != null && v !== '') qs.set(k, String(v));
   });

   const res = await fetchWithAuth(`/banks/reconcile/suggestions/count?${qs.toString()}`, { signal });
   await ensureOk(res, 'No se pudo obtener el conteo de sugerencias');
   return (await parseJsonSafe(res)) || {};
}

export async function reconcileOne({ entityId, bank_transaction_id, document_id, amount }) {
   const body = { entityId, bank_transaction_id, document_id };
   if (amount != null && amount !== '') body.amount = Number(amount);

   const res = await fetchWithAuth(`/banks/reconcile`, {
      method: 'POST',
      body: JSON.stringify(body)
   });
   await ensureOk(res, 'No se pudo conciliar el documento');
   return (await parseJsonSafe(res)) || {};
}

export async function searchBankReconcileCandidates({ entityId, bank_transaction_id, q = '', limit = 50, signal } = {}) {
   const qs = new URLSearchParams();
   qs.set('entityId', String(entityId));
   qs.set('bank_transaction_id', String(bank_transaction_id));
   qs.set('limit', String(limit));
   if (q) qs.set('q', q);

   const res = await fetchWithAuth(`/banks/reconcile/bank-candidates?${qs.toString()}`, { signal });
   await ensureOk(res, 'No se pudieron buscar movimientos para cruzar');
   return (await parseJsonSafe(res)) || {};
}

export async function reconcileBankTransaction({ entityId, bank_transaction_id, target_bank_transaction_id, amount }) {
   const body = { entityId, bank_transaction_id, target_bank_transaction_id };
   if (amount != null && amount !== '') body.amount = Number(amount);

   const res = await fetchWithAuth(`/banks/reconcile/bank`, {
      method: 'POST',
      body: JSON.stringify(body)
   });
   await ensureOk(res, 'No se pudo cruzar el movimiento bancario');
   return (await parseJsonSafe(res)) || {};
}

export async function reconcileBulk({ entityId, pairs, method = 'suggested' }) {
   const res = await fetchWithAuth(`/banks/reconcile/bulk`, {
      method: 'POST',
      body: JSON.stringify({ entityId, pairs, method })
   });
   await ensureOk(res, 'No se pudo conciliar de forma masiva');
   return (await parseJsonSafe(res)) || {};
}

export async function listReconciliations({ entityId, bank_transaction_id, document_id, limit = 50, offset = 0 }) {
   const qs = new URLSearchParams();
   qs.set('entityId', String(entityId));
   if (bank_transaction_id) qs.set('bank_transaction_id', String(bank_transaction_id));
   if (document_id) qs.set('document_id', String(document_id));
   qs.set('limit', String(limit));
   qs.set('offset', String(offset));

   const res = await fetchWithAuth(`/banks/reconcile/list?${qs.toString()}`);
   await ensureOk(res, 'No se pudieron listar conciliaciones');
   return (await parseJsonSafe(res)) || {};
}

export async function unreconcile({ id, entityId, kind }) {
   const qs = new URLSearchParams({ entityId: String(entityId) });
   if (kind) qs.set('kind', kind);

   const res = await fetchWithAuth(`/banks/reconcile/${id}?${qs.toString()}`, {
      method: 'DELETE'
   });
   await ensureOk(res, 'No se pudo deshacer la conciliacion');
   return (await parseJsonSafe(res)) || {};
}

export async function deleteBankTransaction({ id, entityId }) {
   const qs = new URLSearchParams({ entityId: String(entityId) });

   const res = await fetchWithAuth(`/banks/transactions/${id}?${qs.toString()}`, {
      method: 'DELETE'
   });
   await ensureOk(res, 'No se pudo eliminar el movimiento');
   return (await parseJsonSafe(res)) || {};
}

export async function autofindCandidates({ entityId, bank_transaction_id, amount, rut, limit = 5, signal }) {
   const qs = new URLSearchParams();
   qs.set('entityId', String(entityId));
   qs.set('bank_transaction_id', String(bank_transaction_id));
   qs.set('limit', String(limit));
   if (amount != null) qs.set('monto', String(amount));
   if (rut) qs.set('rut', rut);

   const res = await fetchWithAuth(`/banks/reconcile/autofind?${qs.toString()}`, { signal });
   await ensureOk(res, 'No se pudieron buscar candidatos automaticamente');
   return (await parseJsonSafe(res)) || {};
}
