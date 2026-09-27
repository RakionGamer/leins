import { fetchWithAuth } from '../utils/fetchWithAuth';

const parseJsonSafe = async (response) => response.json().catch(() => ({}));

// --- DATOS HARDCODEADOS PARA DEMO DE CLIENTE ---
export const DEMO_ACCOUNTS = [
   // 1.1 Activo Corriente
   { id: 1, code: "1.1.1", name: "Caja", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 2, code: "1.1.2", name: "Banco Cuenta Corriente 1", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 3, code: "1.1.3", name: "Banco Cuenta Corriente 2", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 4, code: "1.1.4", name: "Fondos por Rendir", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 5, code: "1.1.5", name: "Depósitos a Plazo (CP)", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 6, code: "1.1.6", name: "Clientes por Cobrar", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 7, code: "1.1.7", name: "Documentos por Cobrar", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 8, code: "1.1.8", name: "Anticipo a Proveedores", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 9, code: "1.1.9", name: "IVA Crédito Fiscal", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 10, code: "1.1.10", name: "IVA Crédito Activo Fijo", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 11, code: "1.1.11", name: "PPM por Recuperar", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 12, code: "1.1.12", name: "Inventario Mercaderías", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 13, code: "1.1.13", name: "Materias Primas", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 14, code: "1.1.14", name: "Productos en Proceso", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 15, code: "1.1.15", name: "Productos Terminados", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },

   // 1.2 Activo No Corriente
   { id: 16, code: "1.2.1", name: "Terrenos", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 17, code: "1.2.2", name: "Edificios", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 18, code: "1.2.3", name: "Maquinarias", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 19, code: "1.2.4", name: "Equipos Computacionales", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 20, code: "1.2.5", name: "Muebles y Útiles", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 21, code: "1.2.6", name: "Vehículos", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 22, code: "1.2.7", name: "Activos Intangibles", type: "ACTIVO", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 23, code: "1.2.8", name: "Depreciación Acumulada", type: "ACTIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },

   // 2 PASIVO
   { id: 24, code: "2.1", name: "Proveedores Nacionales", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 25, code: "2.2", name: "Proveedores Extranjeros", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 26, code: "2.3", name: "Honorarios por Pagar", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 27, code: "2.4", name: "Crédito Bancario CP", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 28, code: "2.5", name: "Línea de Crédito", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 29, code: "2.6", name: "IVA Débito Fiscal", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 30, code: "2.7", name: "IVA por Pagar", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 31, code: "2.8", name: "PPM por Pagar", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 32, code: "2.9", name: "Retenciones Honorarios", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 33, code: "2.10", name: "Sueldos por Pagar", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 34, code: "2.11", name: "Cotizaciones por Pagar", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 35, code: "2.12", name: "Crédito Bancario LP", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 36, code: "2.13", name: "Leasing LP", type: "PASIVO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },

   // 3 PATRIMONIO
   { id: 37, code: "3.1", name: "Capital Social", type: "PATRIMONIO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 38, code: "3.2", name: "Utilidades Retenidas", type: "PATRIMONIO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 39, code: "3.3", name: "Resultado del Ejercicio", type: "PATRIMONIO", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },

   // 4 INGRESOS
   { id: 40, code: "4.1", name: "Ingresos por Ventas Afectas", type: "INGRESOS", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 41, code: "4.2", name: "Ingresos por Servicios", type: "INGRESOS", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 42, code: "4.3", name: "Otros Ingresos Operacionales", type: "INGRESOS", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 43, code: "4.4", name: "Ingresos Financieros", type: "INGRESOS", nature: "ACREEDORA", cost_center_requirement: "NONE", is_system: true },

   // 5 COSTOS
   { id: 44, code: "5.1", name: "Costo de Ventas", type: "COSTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 45, code: "5.2", name: "Consumo Materia Prima", type: "COSTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 46, code: "5.3", name: "Mano de Obra Directa", type: "COSTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 47, code: "5.4", name: "Costos Indirectos de Fabricación", type: "COSTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 48, code: "5.5", name: "Variación de Inventario", type: "COSTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },

   // 6 GASTOS
   { id: 49, code: "5.2.1", name: "Gastos Administrativos", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 50, code: "6.1", name: "Arriendos", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 51, code: "6.2", name: "Servicios Básicos", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 52, code: "6.3", name: "Gastos Bancarios", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 53, code: "6.4", name: "Honorarios Profesionales", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 54, code: "6.5", name: "Remuneraciones", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 55, code: "6.6", name: "Gratificaciones", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 56, code: "6.7", name: "Bonificaciones", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 57, code: "6.8", name: "Gastos Patronales", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 58, code: "6.9", name: "Gastos Notariales", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 59, code: "6.10", name: "Gastos de Oficina", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 60, code: "6.11", name: "Software y Suscripciones", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 61, code: "6.12", name: "Seguros", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 62, code: "6.13", name: "Depreciación", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 63, code: "6.14", name: "Publicidad", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 64, code: "6.15", name: "Marketing Digital", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "OPTIONAL", is_system: true },
   { id: 65, code: "6.16", name: "Comisiones por Venta", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 66, code: "6.17", name: "Fletes y Distribución", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 67, code: "6.18", name: "Intereses Bancarios", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
   { id: 68, code: "6.19", name: "Multas e Intereses Tributarios", type: "GASTOS", nature: "DEUDORA", cost_center_requirement: "NONE", is_system: true },
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
      sii_document: { folio: "45210", document_type: "Factura Electrónica Afecta", net_amount: 150000, tax_amount: 28500, total_amount: 178500 },
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
      sii_document: { folio: "1205", document_type: "Factura Electrónica Afecta", net_amount: 2000000, tax_amount: 380000, total_amount: 2380000 },
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
   { 
      rut: "76.890.123-4", name: "TECHCORP CHILE SPA", account_type: "CLIENTE", total_debit: 2380000, total_credit: 1190000, balance: 1190000, status: "Parcial", document_count: 2,
      documents: [
         { id: 1, folio: "1205", document_type: "Factura Electrónica Afecta", issue_date: "2026-09-18", total: 2380000, paid: 1190000, balance: 1190000, status: "Parcial" }
      ]
   },
   { 
      rut: "77.456.789-1", name: "DISTRIBUIDORA ANDINA S.A.", account_type: "PROVEEDOR", total_debit: 0, total_credit: 3250000, balance: 3250000, status: "Pendiente", document_count: 1,
      documents: [
         { id: 2, folio: "8821", document_type: "Factura Electrónica Afecta", issue_date: "2026-09-25", total: 3250000, paid: 0, balance: 3250000, status: "Pendiente" }
      ]
   },
   { 
      rut: "96.792.430-K", name: "SODIMAC S.A.", account_type: "PROVEEDOR", total_debit: 178500, total_credit: 178500, balance: 0, status: "Pagado", document_count: 2,
      documents: [
         { id: 3, folio: "45210", document_type: "Factura Electrónica Afecta", issue_date: "2026-09-15", total: 178500, paid: 178500, balance: 0, status: "Pagado" }
      ]
   }
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
         return await parseJsonSafe(response);
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
         return await parseJsonSafe(response);
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
         return await parseJsonSafe(response);
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
      if (!response.ok) {
         const err = await parseJsonSafe(response);
         throw new Error(err.message || 'Error del servidor');
      }
      return parseJsonSafe(response);
   } catch (e) {
      throw e;
   }
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
         return await parseJsonSafe(response);
      }
   } catch (e) {}

   let filtered = DEMO_BALANCES;
   if (type === 'RECEIVABLE') filtered = filtered.filter(b => b.account_type === 'CLIENTE');
   if (type === 'PAYABLE') filtered = filtered.filter(b => b.account_type === 'PROVEEDOR');
   if (q) filtered = filtered.filter(b => b.rut.includes(q) || b.name.toLowerCase().includes(q.toLowerCase()));

   return filtered;
};
