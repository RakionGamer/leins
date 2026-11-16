// leins-front/src/constants/permissions.js

export const PERMISSION_MODULES = {
   bank_movements: {
      key: 'bank_movements',
      label: 'Movimientos bancarios',
      description: 'Gestión y operación sobre cartolas y movimientos',
      permissions: [
         { key: 'view', label: 'Ver movimientos bancarios', default: true },
         { key: 'boletear', label: 'Boletear movimientos', default: false, badge: 'Crítico' },
         { key: 'bank_sync', label: 'Sincronización bancaria automática', default: false, badge: 'Emisso' },
         { key: 'upload_cartola', label: 'Cargar cartolas Excel', default: true },
         { key: 'reconcile', label: 'Conciliación bancaria', default: true },
         { key: 'unreconcile', label: 'Desconciliar movimientos', default: false },
         { key: 'delete_movement', label: 'Eliminar movimientos', default: false, badge: 'Peligro' },
         { key: 'assign_account', label: 'Asignar cuenta contable directa', default: false },
      ]
   },
   bank_accounts: {
      key: 'bank_accounts',
      label: 'Cuentas bancarias',
      description: 'Configuración de cuentas corrientes de la empresa',
      permissions: [
         { key: 'view', label: 'Ver cuentas y saldos', default: true },
         { key: 'manage', label: 'Crear / editar cuentas bancarias', default: false },
         { key: 'connect_bank', label: 'Conectar banco automático (Emisso Connect)', default: false, badge: 'Emisso' },
      ]
   },
   income_sales: {
      key: 'income_sales',
      label: 'Ventas (Boletas y Facturas)',
      description: 'Emisión y control de documentos de ventas',
      permissions: [
         { key: 'view', label: 'Ver ventas y documentos', default: true },
         { key: 'emit_boleta', label: 'Emitir boleta electrónica manual', default: false },
         { key: 'sii_sync', label: 'Sincronización SII ventas', default: false, badge: 'SII' },
         { key: 'download', label: 'Descargar PDF / XML', default: true },
         { key: 'manage', label: 'Anular / editar ventas', default: false },
      ]
   },
   income_receivables: {
      key: 'income_receivables',
      label: 'Cuentas por cobrar',
      description: 'Seguimiento de cobranzas y cobros pendientes',
      permissions: [
         { key: 'view', label: 'Ver cuentas por cobrar', default: true },
         { key: 'manage', label: 'Registrar cobranza y pagos', default: false },
      ]
   },
   expenses_purchases: {
      key: 'expenses_purchases',
      label: 'Compras',
      description: 'Facturas de proveedores y egresos comerciales',
      permissions: [
         { key: 'view', label: 'Ver compras y facturas', default: true },
         { key: 'sii_sync', label: 'Sincronización SII compras', default: false, badge: 'SII' },
         { key: 'assign_accounting', label: 'Asignar cuentas y centros de costo', default: false },
      ]
   },
   expenses_honorarium: {
      key: 'expenses_honorarium',
      label: 'Boletas de honorarios',
      description: 'Honorarios recibidos de prestadores de servicios',
      permissions: [
         { key: 'view', label: 'Ver boletas de honorarios', default: true },
         { key: 'sii_sync', label: 'Sincronización SII honorarios', default: false, badge: 'SII' },
         { key: 'assign_accounting', label: 'Asignar cuentas contables', default: false },
      ]
   },
   expenses_payables: {
      key: 'expenses_payables',
      label: 'Cuentas por pagar',
      description: 'Control de compromisos y pagos a proveedores',
      permissions: [
         { key: 'view', label: 'Ver cuentas por pagar', default: true },
         { key: 'manage', label: 'Registrar pagos a proveedores', default: false },
      ]
   },
   accounting: {
      key: 'accounting',
      label: 'Contabilidad',
      description: 'Libros contables, asientos y reportes financieros',
      permissions: [
         { key: 'entries_view', label: 'Ver asientos contables', default: false },
         { key: 'entries_manage', label: 'Crear / editar asientos contables', default: false },
         { key: 'entries_export', label: 'Exportar asientos contables', default: false },
         { key: 'accounts_view', label: 'Ver plan de cuentas', default: false },
         { key: 'accounts_manage', label: 'Crear / editar cuentas contables', default: false },
         { key: 'rules_view', label: 'Ver reglas de proveedores', default: false },
         { key: 'rules_manage', label: 'Crear / editar reglas contables', default: false },
         { key: 'reports_view', label: 'Ver reportes (Saldos, EERR, Flujo)', default: false },
         { key: 'reports_export', label: 'Exportar balances y reportes', default: false },
      ]
   },
   entities: {
      key: 'entities',
      label: 'Empresas / Entidades',
      description: 'Información y configuración general de la empresa',
      permissions: [
         { key: 'view', label: 'Ver datos de la empresa', default: true },
         { key: 'manage', label: 'Editar información de la empresa', default: false },
      ]
   }
};

export function getDefaultPermissions() {
   const perms = {};
   for (const [modKey, modVal] of Object.entries(PERMISSION_MODULES)) {
      perms[modKey] = {};
      for (const p of modVal.permissions) {
         perms[modKey][p.key] = Boolean(p.default);
      }
   }
   return perms;
}

export function getPresetPermissions(presetName = 'OPERATIVE_STANDARD') {
   const perms = {};
   const name = String(presetName || '').toUpperCase();

   for (const [modKey, modVal] of Object.entries(PERMISSION_MODULES)) {
      perms[modKey] = {};
      for (const p of modVal.permissions) {
         if (name === 'FULL_ACCESS') {
            perms[modKey][p.key] = true;
         } else if (name === 'READ_ONLY') {
            perms[modKey][p.key] = p.key === 'view' || p.key.endsWith('_view') || p.key === 'download';
         } else if (name === 'CLEAR_ALL') {
            perms[modKey][p.key] = false;
         } else {
            // OPERATIVE_STANDARD
            if (modKey === 'accounting') {
               perms[modKey][p.key] = false;
            } else if (['boletear', 'bank_sync', 'unreconcile', 'delete_movement', 'manage', 'connect_bank', 'sii_sync', 'assign_accounting', 'assign_account'].includes(p.key)) {
               perms[modKey][p.key] = false;
            } else {
               perms[modKey][p.key] = Boolean(p.default);
            }
         }
      }
   }
   return perms;
}

export const PERMISSION_PRESETS = [
   { key: 'READ_ONLY', label: 'Solo Lectura', desc: 'Visualización y descargas únicamente' },
   { key: 'OPERATIVE_STANDARD', label: 'Operativo Estándar', desc: 'Lectura + carga de cartolas y conciliación manual (sin boletear ni sync)' },
   { key: 'FULL_ACCESS', label: 'Acceso Total', desc: 'Habilita todas las funciones del cliente' },
   { key: 'CLEAR_ALL', label: 'Desmarcar Todo', desc: 'Desactiva todos los permisos' },
];
