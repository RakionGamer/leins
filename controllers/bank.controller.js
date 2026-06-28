const boom = require('@hapi/boom');
const BankService = require('../services/bank.service');
const ReconcileService = require('../services/reconcile.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');

// instanciamos los servicios
const service = new BankService();
const reconcile = new ReconcileService();

const downloadMovementsTemplate = asyncHandler(async (_req, res) => {
   const amountColumnsMode = service.normalizeAmountColumnsMode(_req.query?.amountColumnsMode || _req.query?.mode);
   const filename = amountColumnsMode === 'split'
      ? 'plantilla_movimientos_bancarios_abonos_cargos.xlsx'
      : 'plantilla_movimientos_bancarios.xlsx';
   const buffer = service.buildMovementsTemplateBuffer({ amountColumnsMode });

   res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
   res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
   res.setHeader('Cache-Control', 'no-store');

   res.status(200).send(buffer);
});

// controlador para subir excel
const uploadExcel = asyncHandler(async (req, res) => {
   if (!req.file) throw boom.badRequest('file is required');

   const commit = String(req.body.commit || 'false').toLowerCase() === 'true';
   const entityId = Number(req.body?.entityId ?? 0) || null;
   const entityBankAccountId = Number(req.body?.accountId ?? 0) || null;
   const amountColumnsMode = service.normalizeAmountColumnsMode(
      req.body?.amountColumnsMode ||
      (String(req.body?.splitDebitCredit || req.body?.separateDebitCredit || '').toLowerCase() === 'true' ? 'split' : null)
   );

   try {
      const result = await service.importFromExcelBuffer(
         req.file.buffer,
         { commit, entityId, entityBankAccountId, expectMovements: true, amountColumnsMode }
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
      cuenta,
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
      cuenta: cuenta ?? null,
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

// controlador para listar cuentas bancarias de la entidad
const listBankAccounts = asyncHandler(async (req, res) => {
   const entityId = Number(req.query?.entityId || req.body?.entityId || req.entityId || 0);
   if (!Number.isInteger(entityId) || entityId <= 0) {
      throw boom.badRequest('entityId requerido');
   }

   const out = await service.listBankAccounts({ entityId });
   res.json(out);
});

// controlador para crear cuenta bancaria
const createBankAccount = asyncHandler(async (req, res) => {
   const { entityId, bankName, accountNumber, currency } = req.body || {};
   const parsedEntityId = Number(entityId || req.entityId || 0);

   if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      throw boom.badRequest('entityId requerido');
   }

   const out = await service.createBankAccount({
      entityId: parsedEntityId,
      bankName,
      accountNumber,
      currency
   });

   logInfo('BANK_ACCOUNT_CREATED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId: parsedEntityId,
      accountId: out?.row?.id
   });

   res.status(201).json(out);
});

// controlador para actualizar cuenta bancaria
const updateBankAccount = asyncHandler(async (req, res) => {
   const { entityId, bankName, accountNumber, currency } = req.body || {};
   const parsedEntityId = Number(entityId || req.entityId || 0);
   const accountId = Number(req.params.id);

   if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
      throw boom.badRequest('entityId requerido');
   }
   if (!Number.isInteger(accountId) || accountId <= 0) {
      throw boom.badRequest('id de cuenta invalido');
   }

   const out = await service.updateBankAccount({
      entityId: parsedEntityId,
      accountId,
      bankName,
      accountNumber,
      currency
   });

   logInfo('BANK_ACCOUNT_UPDATED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId: parsedEntityId,
      accountId
   });

   res.json(out);
});

// controlador para eliminar cuenta bancaria
const deleteBankAccount = asyncHandler(async (req, res) => {
   const entityId = Number(req.query?.entityId || req.body?.entityId || req.entityId || 0);
   const accountId = Number(req.params.id);

   if (!Number.isInteger(entityId) || entityId <= 0) {
      throw boom.badRequest('entityId requerido');
   }
   if (!Number.isInteger(accountId) || accountId <= 0) {
      throw boom.badRequest('id de cuenta invalido');
   }

   const out = await service.deleteBankAccount({ entityId, accountId });

   logInfo('BANK_ACCOUNT_DELETED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId,
      accountId
   });

   res.json(out);
});

// controlador para revelar numero de cuenta (accion auditada)
const revealBankAccountNumber = asyncHandler(async (req, res) => {
   const entityId = Number(req.body?.entityId || req.query?.entityId || req.entityId || 0);
   const accountId = Number(req.params.id);

   if (!Number.isInteger(entityId) || entityId <= 0) {
      throw boom.badRequest('entityId requerido');
   }
   if (!Number.isInteger(accountId) || accountId <= 0) {
      throw boom.badRequest('id de cuenta invalido');
   }

   const out = await service.revealBankAccountNumber({ entityId, accountId });

   logInfo('BANK_ACCOUNT_NUMBER_REVEALED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId,
      accountId
   });

   res.json(out);
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
      limit,
      offset,
      page,
      pageSize,
      search
   } = req.query;

   const parsedPageSize = Number.isFinite(Number(pageSize))
      ? Math.min(Math.max(Number(pageSize), 1), 200)
      : null;

   const parsedLimit = Number.isFinite(Number(limit))
      ? Math.min(Math.max(Number(limit), 1), 200)
      : (parsedPageSize || 50);

   const parsedPage = Number.isFinite(Number(page))
      ? Math.max(Number(page), 1)
      : null;

   const parsedOffset = Number.isFinite(Number(offset))
      ? Math.max(Number(offset), 0)
      : (parsedPage ? (parsedPage - 1) * parsedLimit : 0);

   const out = await reconcile.suggestions({
      entityId: Number(entityId),
      accountId: accountId ? Number(accountId) : null,
      type: type || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      daysWindow: Number(daysWindow),
      limit: parsedLimit,
      offset: parsedOffset,
      search: search || null,
   });

   res.json(out);
});

// controlador para obtener sugerencias de conciliacion (endpoint rapido, sin conteo completo)
const getSuggestionsFast = asyncHandler(async (req, res) => {
   const {
      entityId,
      accountId,
      type,
      dateFrom,
      dateTo,
      daysWindow = '3',
      limit,
      offset,
      page,
      pageSize,
      search
   } = req.query;

   const parsedPageSize = Number.isFinite(Number(pageSize))
      ? Math.min(Math.max(Number(pageSize), 1), 200)
      : null;

   const parsedLimit = Number.isFinite(Number(limit))
      ? Math.min(Math.max(Number(limit), 1), 200)
      : (parsedPageSize || 50);

   const parsedPage = Number.isFinite(Number(page))
      ? Math.max(Number(page), 1)
      : null;

   const parsedOffset = Number.isFinite(Number(offset))
      ? Math.max(Number(offset), 0)
      : (parsedPage ? (parsedPage - 1) * parsedLimit : 0);

   const out = await reconcile.suggestions({
      entityId: Number(entityId),
      accountId: accountId ? Number(accountId) : null,
      type: type || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      daysWindow: Number(daysWindow),
      limit: parsedLimit,
      offset: parsedOffset,
      search: search || null,
      includeTotal: false,
      withHasMore: true,
   });

   res.json(out);
});

// controlador para contar sugerencias de conciliacion
const countSuggestions = asyncHandler(async (req, res) => {
   const {
      entityId,
      accountId,
      type,
      dateFrom,
      dateTo,
      daysWindow = '3',
      search,
      cap
   } = req.query;

   const parsed = {
      entityId: Number(entityId),
      accountId: accountId ? Number(accountId) : null,
      type: type || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      daysWindow: Number(daysWindow),
      search: search || null,
   };

   const parsedCap = Number.isFinite(Number(cap))
      ? Math.min(Math.max(Number(cap), 1), 500)
      : null;

   if (parsedCap != null) {
      const out = await reconcile.countSuggestionsCapped({
         ...parsed,
         cap: parsedCap
      });
      return res.json({
         ok: true,
         total: Number(out.total || 0),
         is_capped: Boolean(out.isCapped),
         cap: Number(out.cap || parsedCap)
      });
   }

   const total = await reconcile.countSuggestions(parsed);
   res.json({ ok: true, total: Number(total || 0), is_capped: false });
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
   downloadMovementsTemplate,
   uploadExcel,
   listBankAccounts,
   createBankAccount,
   updateBankAccount,
   deleteBankAccount,
   revealBankAccountNumber,
   listTransactions,
   autoFindReconcile,
   getSuggestions,
   getSuggestionsFast,
   countSuggestions,
   reconcileTransaction,
   bulkReconcile,
   unreconcileTransaction,
   listReconciliations
};
