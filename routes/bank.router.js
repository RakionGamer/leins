// routes/banks.router.js
const express = require('express');
const boom = require('@hapi/boom');
const multer = require('multer');
const BankService = require('../services/bank.service');
const ReconcileService = require('../services/reconcile.service');

const router = express.Router();
const service = new BankService();
const reconcile = new ReconcileService();

// upload en memoria (solo .xlsx / .xls)
const upload = multer({
   storage: multer.memoryStorage(),
   fileFilter: (_req, file, cb) => {
      const okMime = [
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/vnd.ms-excel',
         'application/octet-stream' // algunos clientes mandan esto
      ];
      const ext = (file.originalname || '').toLowerCase();
      const okExt = ext.endsWith('.xlsx') || ext.endsWith('.xls');
      if (okExt && okMime.includes(file.mimetype)) return cb(null, true);
      if (okExt && file.mimetype === 'application/octet-stream') return cb(null, true); // tolerante
      return cb(boom.badRequest('solo se permiten archivos excel (.xlsx / .xls)'));
   },
   limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

router.post('/upload-excel', upload.single('file'), async (req, res, next) => {
   try {
      // validar que se haya subido un archivo
      if (!req.file) throw boom.badRequest('file is required');

      // determinar si se deben guardar los cambios
      const commit = String(req.body.commit || 'false').toLowerCase() === 'true';

      // lee IDs (query o body)
      const entityId = Number(req.body?.entityId ?? 0) || null;
      const entityBankAccountId = Number(req.body?.accountId ?? 0) || null;

      // procesar el archivo excel
      const result = await service.importFromExcelBuffer(
         req.file.buffer,
         { commit, entityId, entityBankAccountId }
      );

      // opcional: enriquecer respuesta
      res.json({
         ...result,
         filename: req.file.originalname,
         filesize: req.file.size
      });

   } catch (err) {
      // errores comunes de multer
      if (err?.code === 'LIMIT_FILE_SIZE') {
         return next(boom.entityTooLarge('archivo demasiado grande (máx 10MB)'));
      }
      if (err?.code === 'LIMIT_UNEXPECTED_FILE') {
         return next(boom.badRequest('campo de archivo inesperado'));
      }
      // pasar error al manejador general
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

// GET /transactions: lista movimientos con filtros y paginación
router.get('/transactions', async (req, res, next) => {

   const {
      entityId,
      accountId,
      tipo = 'Todos',          // 'Todos' | 'Abonos' | 'Cargos'
      fechaIni,
      fechaFin,
      monto,                   // número exacto (opcional)
      descripcion,             // substring en description
      nro,                     // prefijo de número de operación/documento (ej: 0270747809)
      rut,                     // rut dentro de la glosa (ej: 77.650.783-0)
      soloPendientes,
      limit = '100',
      offset = '0',
      // orden estable por defecto
      sort = 'issued_at:desc,id:desc' // permite múltiples: campo:dir[,campo2:dir2]
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

// GET /reconcile/autofind
router.get('/reconcile/autofind', async (req, res, next) => {
   try {
      const q = req.query || {};

      const entityId = Number(q.entityId);
      const bank_transaction_id = Number(q.bank_transaction_id);
      const limit = Number.isFinite(Number(q.limit)) ? Math.min(Math.max(Number(q.limit), 1), 50) : 10;

      // filtro opcional
      const rut = (q.rut || null) ? String(q.rut).trim() : null;

      if (!Number.isInteger(entityId) || entityId <= 0) {
         return next(boom.badRequest('entityId is required and must be a positive integer'));
      }
      if (!Number.isInteger(bank_transaction_id) || bank_transaction_id <= 0) {
         return next(boom.badRequest('bank_transaction_id is required and must be a positive integer'));
      }

      const out = await service.autoFindDocument({
         entityId,
         bank_transaction_id,
         rut,
         limit,
      });

      return res.status(200).json(out);
      
   } catch (err) {
      return next(err?.isBoom ? err : boom.badImplementation(err?.message ?? 'Unexpected error'));
   }
});

// GET /reconcile/suggestions
router.get('/reconcile/suggestions', async (req, res, next) => {
   try {
      const {
         entityId,
         accountId,
         type,              // 'income' | 'expense'
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
   } catch (err) {
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

// POST /reconcile: aplica conciliacion entre un movimiento y un documento
router.post('/reconcile', async (req, res, next) => {
   try {
      const { entityId, bank_transaction_id, document_id, amount } = req.body || {};
      // validaciones rapidas
      if (!entityId) return next(boom.badRequest("entityId requerido"));
      if (!bank_transaction_id) return next(boom.badRequest("bank_transaction_id requerido"));
      if (!document_id) return next(boom.badRequest("document_id requerido"));
      if (amount != null && !(Number(amount) > 0)) return next(boom.badRequest("amount debe ser numero positivo"));

      const out = await service.reconcile({
         entityId: Number(entityId),
         bank_transaction_id: Number(bank_transaction_id),
         document_id: Number(document_id),
         amount: amount != null ? Number(amount) : null,
      });

      res.json(out);
   } catch (err) {
      // mapeo a boom si es posible
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

// POST /reconcile/bulk: aplica conciliacion entre varios movimientos y documentos
router.post('/reconcile/bulk', async (req, res, next) => {
   try {
      const { entityId, pairs = [], method } = req.body || {};
      if (!entityId || !Array.isArray(pairs) || pairs.length === 0) {
         return next(boom.badRequest("entityId and non-empty pairs[] are required"));
      }
      const out = await service.reconcileBulk({
         entityId: Number(entityId),
         pairs,
         method: method || 'bulk',
      });
      res.json(out);
   } catch (err) {
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

// DELETE /reconcile/:id elimina una conciliacion
router.delete('/reconcile/:id', async (req, res, next) => {
   try {
      const id = Number(req.params.id);
      const { entityId } = req.query; // o en body si prefieres
      if (!entityId || !id) return next(boom.badRequest("entityId and id are required"));

      const out = await service.unreconcile({ id, entityId: Number(entityId) });
      res.json(out);
   } catch (err) {
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

// GET /reconcile/list lista las conciliaciones
router.get('/reconcile/list', async (req, res, next) => {
   try {
      const { entityId, bank_transaction_id, document_id, limit = '50', offset = '0' } = req.query || {};
      if (!entityId) throw boom.badRequest("entityId is required");

      const out = await service.listReconciliations({
         entityId: Number(entityId),
         bank_transaction_id: bank_transaction_id ? Number(bank_transaction_id) : null,
         document_id: document_id ? Number(document_id) : null,
         limit: Math.min(Math.max(Number(limit) || 50, 1), 200),
         offset: Math.max(Number(offset) || 0, 0),
      });
      res.json(out);
   } catch (err) {
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

module.exports = router;