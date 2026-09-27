import { fetchWithAuth } from '../utils/fetchWithAuth';

const parseJsonSafe = async (response) => response.json().catch(() => ({}));

// --- DATOS HARDCODEADOS PARA DEMO DE CLIENTE ---
export const DEMO_ACCOUNTS = [
   { id: 1, code: "1.1.1", name: "Caja", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 2, code: "1.1.2", name: "Banco Santander Cta Cte", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 3, code: "1.1.6", name: "Clientes por Cobrar", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 4, code: "1.1.9", name: "IVA Crédito Fiscal", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 5, code: "2.1", name: "Proveedores Nacionales", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 6, code: "2.6", name: "IVA Débito Fiscal", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 7, code: "3.1", name: "Capital Social", type: "PATRIMONIO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 8, code: "4.1", name: "Ingresos por Ventas Afectas", type: "INGRESOS", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 9, code: "5.2.1", name: "Gastos Administrativos", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 10, code: "6.1", name: "Arriendos", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 11, code: "6.2", name: "Servicios Básicos", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 12, code: "6.4", name: "Honorarios Profesionales", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 13, code: "6.11", name: "Software y Suscripciones", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
];

export const DEMO_ENTRIES = [
   {
      id: 101,
      entry_number: 101,
      entry_date: "2026-09-15",
      concept: "Compra SODIMAC S.A. - Factura N° 45210",
      source_type: "SII_PURCHASE",
      status: "POSTED",
      total_debit: 178500,
      total_credit: 178500,
      items: [
         { id: 1001, account: { code: "5.2.1", name: "Gastos Administrativos" }, description: "Neto Compra Sodimac", debit: 150000, credit: 0, counterparty_rut: "96.792.430-K", cost_center: "Casa Matriz" },
         { id: 1002, account: { code: "1.1.9", name: "IVA Crédito Fiscal" }, description: "IVA Crédito Fac 45210", debit: 28500, credit: 0, counterparty_rut: "96.792.430-K" },
         { id: 1003, account: { code: "2.1", name: "Proveedores Nacionales" }, description: "Deuda Proveedor Sodimac", debit: 0, credit: 178500, counterparty_rut: "96.792.430-K" }
      ]
   },
   {
      id: 102,
      entry_number: 102,
      entry_date: "2026-09-18",
      concept: "Venta Servicios TI a TECHCORP CHILE SPA - Factura N° 1205",
      source_type: "SII_SALE",
      status: "POSTED",
      total_debit: 2380000,
      total_credit: 2380000,
      items: [
         { id: 1004, account: { code: "1.1.6", name: "Clientes por Cobrar" }, description: "Cobro Cliente TechCorp", debit: 2380000, credit: 0, counterparty_rut: "76.890.123-4" },
         { id: 1005, account: { code: "4.1", name: "Ingresos por Ventas Afectas" }, description: "Servicios TI Septiembre", debit: 0, credit: 2000000, counterparty_rut: "76.890.123-4" },
         { id: 1006, account: { code: "2.6", name: "IVA Débito Fiscal" }, description: "IVA Débito Fac 1205", debit: 0, credit: 380000, counterparty_rut: "76.890.123-4" }
      ]
   },
   {
      id: 103,
      entry_number: 103,
      entry_date: "2026-09-20",
      concept: "Pago Arriendo Oficina Central Septiembre",
      source_type: "BANK_MOVEMENT",
      status: "POSTED",
      total_debit: 850000,
      total_credit: 850000,
      items: [
         { id: 1007, account: { code: "6.1", name: "Arriendos" }, description: "Canon Arriendo Oficina", debit: 850000, credit: 0, cost_center: "Administración" },
         { id: 1008, account: { code: "1.1.2", name: "Banco Santander Cta Cte" }, description: "Transferencia TEF #88412", debit: 0, credit: 850000 }
      ]
   },
   {
      id: 104,
      entry_number: 104,
      entry_date: "2026-09-22",
      concept: "Pago Proveedor SODIMAC S.A. (Cancelación Fac 45210)",
      source_type: "BANK_MOVEMENT",
      status: "POSTED",
      total_debit: 178500,
      total_credit: 178500,
      items: [
         { id: 1009, account: { code: "2.1", name: "Proveedores Nacionales" }, description: "Pago Factura 45210", debit: 178500, credit: 0, counterparty_rut: "96.792.430-K" },
         { id: 1010, account: { code: "1.1.2", name: "Banco Santander Cta Cte" }, description: "Egreso Banco TEF", debit: 0, credit: 178500, counterparty_rut: "96.792.430-K" }
      ]
   },
   {
      id: 105,
      entry_number: 105,
      entry_date: "2026-09-25",
      concept: "Abono Cliente TECHCORP CHILE SPA (Fac 1205 50%)",
      source_type: "BANK_MOVEMENT",
      status: "POSTED",
      total_debit: 1190000,
      total_credit: 1190000,
      items: [
         { id: 1011, account: { code: "1.1.2", name: "Banco Santander Cta Cte" }, description: "Ingreso Cartola TEF #99120", debit: 1190000, credit: 0, counterparty_rut: "76.890.123-4" },
         { id: 1012, account: { code: "1.1.6", name: "Clientes por Cobrar" }, description: "Abono Parcial Fac 1205", debit: 0, credit: 1190000, counterparty_rut: "76.890.123-4" }
      ]
   }
];

export const DEMO_RULES = [
   { id: 1, counterparty_rut: "96.792.430-K", counterparty_name: "SODIMAC S.A.", account: { code: "5.2.1", name: "Gastos Administrativos" }, cost_center: "Casa Matriz" },
   { id: 2, counterparty_rut: "96.800.000-1", counterparty_name: "ENEL DISTRIBUCION CHILE S.A.", account: { code: "6.2", name: "Servicios Básicos" }, cost_center: "Sucursal Santiago" },
   { id: 3, counterparty_rut: "93.837.000-K", counterparty_name: "ENTEL CHILE S.A.", account: { code: "6.11", name: "Software y Suscripciones" }, cost_center: "Tecnología" }
];

export const DEMO_BALANCES = [
   { rut: "76.890.123-4", name: "TECHCORP CHILE SPA", account_type: "CLIENTE", total_debit: 2380000, total_credit: 1190000, balance: 1190000, status: "Parcial", document_count: 2 },
   { rut: "77.456.789-1", name: "DISTRIBUIDORA ANDINA S.A.", account_type: "PROVEEDOR", total_debit: 0, total_credit: 3250000, balance: 3250000, status: "Pendiente", document_count: 1 },
   { rut: "96.792.430-K", name: "SODIMAC S.A.", account_type: "PROVEEDOR", total_debit: 178500, total_credit: 178500, balance: 0, status: "Pagado", document_count: 2 }
];

// --- Plan de cuentas ---
export const getAccounts = async ({ entityId, type, q, signal } = {}) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));
      if (type) qs.set('type', type);
      if (q) qs.set('q', q);

      const response = await fetchWithAuth(`/accounting/accounts?${qs.toString()}`, { signal });
      if (response.ok) {
         const data = await parseJsonSafe(response);
         if (Array.isArray(data) && data.length > 0) return data;
      }
   } catch (e) {
      console.warn("📌 Usando datos Demo para Plan de Cuentas");
   }
   return DEMO_ACCOUNTS.filter(a => (!type || a.type === type) && (!q || a.name.toLowerCase().includes(q.toLowerCase()) || a.code.includes(q)));
};

export const createAccount = async (payload) => {
   try {
      const response = await fetchWithAuth('/accounting/accounts', {
         method: 'POST',
         body: JSON.stringify(payload),
      });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   const newAcc = { id: Date.now(), ...payload, is_system: false };
   DEMO_ACCOUNTS.push(newAcc);
   return newAcc;
};

export const seedDefaultPlan = async ({ entityId }) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));

      const response = await fetchWithAuth(`/accounting/accounts/seed?${qs.toString()}`, { method: 'POST' });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   return { created: DEMO_ACCOUNTS.length };
};

export const updateAccount = async (id, payload) => {
   try {
      const response = await fetchWithAuth(`/accounting/accounts/${id}`, {
         method: 'PATCH',
         body: JSON.stringify(payload),
      });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   const target = DEMO_ACCOUNTS.find(a => a.id === Number(id));
   if (target) Object.assign(target, payload);
   return target || payload;
};

export const deleteAccount = async (id, entityId) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));

      const response = await fetchWithAuth(`/accounting/accounts/${id}?${qs.toString()}`, { method: 'DELETE' });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   const idx = DEMO_ACCOUNTS.findIndex(a => a.id === Number(id));
   if (idx !== -1) DEMO_ACCOUNTS.splice(idx, 1);
   return { id };
};

// --- Reglas de Proveedores / Clientes ---
export const getRules = async ({ entityId, signal } = {}) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));

      const response = await fetchWithAuth(`/accounting/rules?${qs.toString()}`, { signal });
      if (response.ok) {
         const data = await parseJsonSafe(response);
         if (Array.isArray(data) && data.length > 0) return data;
      }
   } catch (e) {}
   return DEMO_RULES;
};

export const upsertRule = async (payload) => {
   try {
      const response = await fetchWithAuth('/accounting/rules', {
         method: 'POST',
         body: JSON.stringify(payload),
      });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   const accountObj = DEMO_ACCOUNTS.find(a => a.id === Number(payload.account_id)) || { code: "5.2.1", name: "Gastos Administrativos" };
   const newRule = { id: Date.now(), ...payload, account: accountObj };
   DEMO_RULES.push(newRule);
   return newRule;
};

export const deleteRule = async (id, entityId) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));

      const response = await fetchWithAuth(`/accounting/rules/${id}?${qs.toString()}`, { method: 'DELETE' });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   const idx = DEMO_RULES.findIndex(r => r.id === Number(id));
   if (idx !== -1) DEMO_RULES.splice(idx, 1);
   return { id };
};

// --- Asientos contables ---
export const getEntries = async ({ entityId, month, from, to, source_type, status, q, page = 1, limit = 50, signal } = {}) => {
   try {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (entityId) qs.set('entityId', String(entityId));
      if (month) qs.set('month', month);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      if (source_type) qs.set('source_type', source_type);
      if (status) qs.set('status', status);
      if (q) qs.set('q', q);

      const response = await fetchWithAuth(`/accounting/entries?${qs.toString()}`, { signal });
      if (response.ok) {
         const data = await parseJsonSafe(response);
         if (data.rows && data.rows.length > 0) return data;
      }
   } catch (e) {}

   let filtered = DEMO_ENTRIES;
   if (source_type) filtered = filtered.filter(e => e.source_type === source_type);
   if (status) filtered = filtered.filter(e => e.status === status);
   if (q) filtered = filtered.filter(e => e.concept.toLowerCase().includes(q.toLowerCase()) || String(e.entry_number).includes(q));

   return {
      total: filtered.length,
      totalPages: 1,
      page: 1,
      limit: 50,
      rows: filtered
   };
};

export const getEntryById = async (id, entityId) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));

      const response = await fetchWithAuth(`/accounting/entries/${id}?${qs.toString()}`);
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   return DEMO_ENTRIES.find(e => e.id === Number(id)) || DEMO_ENTRIES[0];
};

export const createEntry = async (payload) => {
   try {
      const response = await fetchWithAuth('/accounting/entries', {
         method: 'POST',
         body: JSON.stringify(payload),
      });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}

   const entryNum = DEMO_ENTRIES.length + 101;
   let totalD = 0;
   let totalC = 0;
   const mappedItems = payload.items.map((it, idx) => {
      const acc = DEMO_ACCOUNTS.find(a => a.id === Number(it.account_id)) || { code: "5.2.1", name: "Gastos General" };
      totalD += Number(it.debit) || 0;
      totalC += Number(it.credit) || 0;
      return { id: Date.now() + idx, account: acc, ...it };
   });

   const newEntry = {
      id: Date.now(),
      entry_number: entryNum,
      entry_date: payload.entry_date,
      concept: payload.concept,
      source_type: payload.source_type || "MANUAL",
      status: "POSTED",
      total_debit: totalD,
      total_credit: totalC,
      items: mappedItems,
   };
   DEMO_ENTRIES.unshift(newEntry);
   return newEntry;
};

export const annulEntry = async (id, entityId) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));

      const response = await fetchWithAuth(`/accounting/entries/${id}/annul?${qs.toString()}`, { method: 'POST' });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}

   const entry = DEMO_ENTRIES.find(e => e.id === Number(id));
   if (entry) entry.status = "ANNULLED";
   return entry;
};

export const generateSiiEntries = async (payload) => {
   try {
      const response = await fetchWithAuth('/accounting/entries/generate-sii', {
         method: 'POST',
         body: JSON.stringify(payload),
      });
      if (response.ok) return parseJsonSafe(response);
   } catch (e) {}
   return { createdCount: 4, skippedCount: 1, totalDocs: 5 };
};

// --- Control de saldos por RUT ---
export const getBalances = async ({ entityId, type, q, signal } = {}) => {
   try {
      const qs = new URLSearchParams();
      if (entityId) qs.set('entityId', String(entityId));
      if (type) qs.set('type', type);
      if (q) qs.set('q', q);

      const response = await fetchWithAuth(`/accounting/balances?${qs.toString()}`, { signal });
      if (response.ok) {
         const data = await parseJsonSafe(response);
         if (Array.isArray(data) && data.length > 0) return data;
      }
   } catch (e) {}

   let filtered = DEMO_BALANCES;
   if (type === 'RECEIVABLE') filtered = filtered.filter(b => b.account_type === 'CLIENTE');
   if (type === 'PAYABLE') filtered = filtered.filter(b => b.account_type === 'PROVEEDOR');
   if (q) filtered = filtered.filter(b => b.rut.includes(q) || b.name.toLowerCase().includes(q.toLowerCase()));

   return filtered;
};
