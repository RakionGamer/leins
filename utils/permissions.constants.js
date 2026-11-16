'use strict';

const PERMISSION_MODULES = {
   bank_movements: {
      key: 'bank_movements',
      label: 'Movimientos bancarios',
      description: 'Gestión y operación sobre cartolas y transacciones bancarias',
      permissions: {
         view: { key: 'view', label: 'Ver movimientos bancarios', default: true },
         upload_cartola: { key: 'upload_cartola', label: 'Cargar cartolas Excel', default: true },
         bank_sync: { key: 'bank_sync', label: 'Sincronización bancaria automática (Emisso)', default: false },
         boletear: { key: 'boletear', label: 'Boletear movimientos bancarios', default: false },
         reconcile: { key: 'reconcile', label: 'Conciliación bancaria', default: true },
         unreconcile: { key: 'unreconcile', label: 'Desconciliar movimientos', default: false },
         delete_movement: { key: 'delete_movement', label: 'Eliminar movimientos', default: false },
         assign_account: { key: 'assign_account', label: 'Asignar cuenta contable directa', default: false },
      }
   },
   bank_accounts: {
      key: 'bank_accounts',
      label: 'Cuentas bancarias',
      description: 'Cuentas corrientes y enlaces bancarios de la empresa',
      permissions: {
         view: { key: 'view', label: 'Ver cuentas y saldos', default: true },
         manage: { key: 'manage', label: 'Crear / editar cuentas bancarias', default: false },
         connect_bank: { key: 'connect_bank', label: 'Conectar banco automático (Emisso Connect)', default: false },
      }
   },
   income_sales: {
      key: 'income_sales',
      label: 'Ventas (Boletas y Facturas)',
      description: 'Documentos tributarios de venta emitidos y boletas',
      permissions: {
         view: { key: 'view', label: 'Ver ventas y documentos', default: true },
         emit_boleta: { key: 'emit_boleta', label: 'Emitir boleta electrónica manual', default: false },
         sii_sync: { key: 'sii_sync', label: 'Sincronización SII ventas', default: false },
         download: { key: 'download', label: 'Descargar PDF / XML', default: true },
         manage: { key: 'manage', label: 'Anular / editar ventas', default: false },
      }
   },
   income_receivables: {
      key: 'income_receivables',
      label: 'Cuentas por cobrar',
      description: 'Control de pagos pendientes y cobranzas',
      permissions: {
         view: { key: 'view', label: 'Ver cuentas por cobrar', default: true },
         manage: { key: 'manage', label: 'Registrar cobranza y pagos', default: false },
      }
   },
   expenses_purchases: {
      key: 'expenses_purchases',
      label: 'Compras',
      description: 'Facturas de compra recibidas de proveedores',
      permissions: {
         view: { key: 'view', label: 'Ver compras y facturas', default: true },
         sii_sync: { key: 'sii_sync', label: 'Sincronización SII compras', default: false },
         assign_accounting: { key: 'assign_accounting', label: 'Asignar cuentas y centros de costo', default: false },
      }
   },
   expenses_honorarium: {
      key: 'expenses_honorarium',
      label: 'Boletas de honorarios',
      description: 'Boletas de honorarios de prestadores de servicios',
      permissions: {
         view: { key: 'view', label: 'Ver boletas de honorarios', default: true },
         sii_sync: { key: 'sii_sync', label: 'Sincronización SII honorarios', default: false },
         assign_accounting: { key: 'assign_accounting', label: 'Asignar cuentas contables', default: false },
      }
   },
   expenses_payables: {
      key: 'expenses_payables',
      label: 'Cuentas por pagar',
      description: 'Control de deudas y compromisos con proveedores',
      permissions: {
         view: { key: 'view', label: 'Ver cuentas por pagar', default: true },
         manage: { key: 'manage', label: 'Registrar pagos a proveedores', default: false },
      }
   },
   accounting: {
      key: 'accounting',
      label: 'Contabilidad',
      description: 'Libros contables, asientos, plan de cuentas y reportes',
      permissions: {
         entries_view: { key: 'entries_view', label: 'Ver asientos contables', default: false },
         entries_manage: { key: 'entries_manage', label: 'Crear / editar asientos contables', default: false },
         entries_export: { key: 'entries_export', label: 'Exportar asientos contables', default: false },
         accounts_view: { key: 'accounts_view', label: 'Ver plan de cuentas', default: false },
         accounts_manage: { key: 'accounts_manage', label: 'Crear / editar cuentas contables', default: false },
         rules_view: { key: 'rules_view', label: 'Ver reglas de proveedores', default: false },
         rules_manage: { key: 'rules_manage', label: 'Crear / editar reglas contables', default: false },
         reports_view: { key: 'reports_view', label: 'Ver reportes (Saldos, EERR, Flujo)', default: false },
         reports_export: { key: 'reports_export', label: 'Exportar balances y reportes', default: false },
      }
   },
   entities: {
      key: 'entities',
      label: 'Empresas / Entidades',
      description: 'Datos de la empresa y configuración de entidades',
      permissions: {
         view: { key: 'view', label: 'Ver datos de la empresa', default: true },
         manage: { key: 'manage', label: 'Editar información de la empresa', default: false },
      }
   }
};

function getDefaultPermissions() {
   const perms = {};
   for (const [modKey, modVal] of Object.entries(PERMISSION_MODULES)) {
      perms[modKey] = {};
      for (const [permKey, permVal] of Object.entries(modVal.permissions)) {
         perms[modKey][permKey] = Boolean(permVal.default);
      }
   }
   return perms;
}

function getPresetPermissions(presetName = 'OPERATIVE_STANDARD') {
   const perms = {};
   const name = String(presetName || '').toUpperCase();

   for (const [modKey, modVal] of Object.entries(PERMISSION_MODULES)) {
      perms[modKey] = {};
      for (const [permKey, permVal] of Object.entries(modVal.permissions)) {
         if (name === 'FULL_ACCESS') {
            perms[modKey][permKey] = true;
         } else if (name === 'READ_ONLY') {
            perms[modKey][permKey] = permKey === 'view' || permKey.endsWith('_view') || permKey === 'download';
         } else if (name === 'CLEAR_ALL') {
            perms[modKey][permKey] = false;
         } else {
            // OPERATIVE_STANDARD (default)
            if (modKey === 'accounting') {
               perms[modKey][permKey] = false;
            } else if (['boletear', 'bank_sync', 'unreconcile', 'delete_movement', 'manage', 'connect_bank', 'sii_sync', 'assign_accounting', 'assign_account'].includes(permKey)) {
               perms[modKey][permKey] = false;
            } else {
               perms[modKey][permKey] = Boolean(permVal.default);
            }
         }
      }
   }
   return perms;
}

function sanitizePermissions(raw = {}) {
   const base = getDefaultPermissions();
   if (!raw || typeof raw !== 'object') return base;

   const clean = {};
   for (const [modKey, modVal] of Object.entries(PERMISSION_MODULES)) {
      clean[modKey] = {};
      const incomingMod = raw[modKey] || {};
      for (const [permKey] of Object.entries(modVal.permissions)) {
         if (typeof incomingMod[permKey] === 'boolean') {
            clean[modKey][permKey] = incomingMod[permKey];
         } else {
            clean[modKey][permKey] = Boolean(base[modKey]?.[permKey]);
         }
      }
   }
   return clean;
}

module.exports = {
   PERMISSION_MODULES,
   getDefaultPermissions,
   getPresetPermissions,
   sanitizePermissions,
};
