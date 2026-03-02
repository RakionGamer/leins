const boom = require('@hapi/boom');
const BankService = require('../services/bank.service');
const ReconcileService = require('../services/reconcile.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');

// instanciamos los servicios
const service = new BankService();
const reconcile = new ReconcileService();

// controlador para subir excel
const uploadExcel = asyncHandler(async (req, res) => {
   if (!req.file) throw boom.badRequest('file is required');

   const commit = String(req.body.commit || 'false').toLowerCase() === 'true';
   const entityId = Number(req.body?.entityId ?? 0) || null;
   const entityBankAccountId = Number(req.body?.accountId ?? 0) || null;

   try {
      const result = await service.importFromExcelBuffer(
         req.file.buffer,
         { commit, entityId, entityBankAccountId }
      );

      // log de auditoria: subida de cartola bancaria
      if (commit) {
         logInfo('BANK_EXCEL_UPLOADED', {
            rid: req.rid,
            userId: req.user?.sub,
            entityId,
            accountId: entityBankAccountId,
            filename: req.file.originalname
         });
      }

      res.json({
         ...result,
         filename: req.file.originalname,
         filesize: req.file.size
      });
   } catch (err) {
      if (err?.code === 'LIMIT_FILE_SIZE') throw boom.entityTooLarge('archivo demasiado grande (max 10mb)');
      if (err?.code === 'LIMIT_UNEXPECTED_FILE') throw boom.badRequest('campo de archivo inesperado');
      throw err;
   }
});

// controlador para listar movimientos bancarios
const listTransactions = asyncHandler(async (req, res) => {
   const {
      entityId,
      accountId,
      tipo = 'Todos',
      fechaIni,
      fechaFin,
      monto,
      descripcion,
      nro,
      rut,
      soloPendientes,
      limit = '100',
      offset = '0',
      sort = 'issued_at:desc,id:desc'
   } = req.query;

   const parsed = {
      entityId: entityId ? Number(entityId) : null,
      accountId: accountId ? Number(accountId) : null,
      tipo,
      fechaIni: fechaIni || null,
      fechaFin: fechaFin || null,
      monto: monto ?? null,
      descripcion: descripcion ?? null,
      nro: nro ?? null,
      rut: rut ?? null,
      soloPendientes: String(soloPendientes || '').toLowerCase() === '1' || String(soloPendientes || '').toLowerCase() === 'true',
      limit: Math.min(Math.max(Number(limit) || 100, 1), 500),
      offset: Math.max(Number(offset) || 0, 0),
      sort: String(sort)
   };

   const result = await service.listTransactions(parsed);
   res.json(result);
});

// controlador para auto busqueda de conciliacion
const autoFindReconcile = asyncHandler(async (req, res) => {
   const q = req.query || {};

   const entityId = Number(q.entityId);
   const bank_transaction_id = Number(q.bank_transaction_id);
   const limit = Number.isFinite(Number(q.limit)) ? Math.min(Math.max(Number(q.limit), 1), 50) : 10;
   const rut = (q.rut || null) ? String(q.rut).trim() : null;

   if (!Number.isInteger(entityId) || entityId <= 0) {
      throw boom.badRequest('entityid is required and must be a positive integer');
   }
   if (!Number.isInteger(bank_transaction_id) || bank_transaction_id <= 0) {
      throw boom.badRequest('bank_transaction_id is required and must be a positive integer');
   }

   const out = await service.autoFindDocument({
      entityId,
      bank_transaction_id,
      rut,
      limit,
   });

   res.status(200).json(out);
});

// controlador para obtener sugerencias de conciliacion
const getSuggestions = asyncHandler(async (req, res) => {
   const {
      entityId,
      accountId,
      type,
      dateFrom,
      dateTo,
      daysWindow = '3',
      limit = '50',
      offset = '0',
      search
   } = req.query;

   const out = await reconcile.suggestions({
      entityId: Number(entityId),
      accountId: accountId ? Number(accountId) : null,
      type: type || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      daysWindow: Number(daysWindow),
      limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
      offset: Math.max(Number(offset) || 0, 0),
      search: search || null,
   });

   res.json(out);
});

// controlador para conciliar de forma manual un documento
const reconcileTransaction = asyncHandler(async (req, res) => {
   const { entityId, bank_transaction_id, document_id, amount } = req.body || {};

   if (!entityId) throw boom.badRequest("entityid requerido");
   if (!bank_transaction_id) throw boom.badRequest("bank_transaction_id requerido");
   if (!document_id) throw boom.badRequest("document_id requerido");
   if (amount != null && !(Number(amount) > 0)) throw boom.badRequest("amount debe ser numero positivo");

   const out = await service.reconcile({
      entityId: Number(entityId),
      bank_transaction_id: Number(bank_transaction_id),
      document_id: Number(document_id),
      amount: amount != null ? Number(amount) : null,
   });

   // log de auditoria: conciliacion manual
   logInfo('BANK_TRANSACTION_RECONCILED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId,
      bank_transaction_id,
      document_id
   });

   res.json(out);
});

// controlador para conciliar de forma masiva
const bulkReconcile = asyncHandler(async (req, res) => {
   const { entityId, pairs = [], method } = req.body || {};

   if (!entityId || !Array.isArray(pairs) || pairs.length === 0) {
      throw boom.badRequest("entityid and non-empty pairs[] are required");
   }

   const out = await service.reconcileBulk({
      entityId: Number(entityId),
      pairs,
      method: method || 'bulk',
   });

   // log de auditoria: conciliacion masiva
   logInfo('BANK_BULK_RECONCILED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId,
      totalPairs: pairs.length
   });

   res.json(out);
});

// controlador para deshacer una conciliacion
const unreconcileTransaction = asyncHandler(async (req, res) => {
   const id = Number(req.params.id);
   const { entityId } = req.query;

   if (!entityId || !id) throw boom.badRequest("entityid and id are required");

   const out = await service.unreconcile({ id, entityId: Number(entityId) });

   // log de auditoria: desconciliacion
   logInfo('BANK_TRANSACTION_UNRECONCILED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId,
      reconcileId: id
   });

   res.json(out);
});

// controlador para listar las conciliaciones realizadas
const listReconciliations = asyncHandler(async (req, res) => {
   const { entityId, bank_transaction_id, document_id, limit = '50', offset = '0' } = req.query || {};

   if (!entityId) throw boom.badRequest("entityid is required");

   const out = await service.listReconciliations({
      entityId: Number(entityId),
      bank_transaction_id: bank_transaction_id ? Number(bank_transaction_id) : null,
      document_id: document_id ? Number(document_id) : null,
      limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
      offset: Math.max(Number(offset) || 0, 0),
   });

   res.json(out);
});

module.exports = {
   uploadExcel,
   listTransactions,
   autoFindReconcile,
   getSuggestions,
   reconcileTransaction,
   bulkReconcile,
   unreconcileTransaction,
   listReconciliations
};