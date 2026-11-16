// routes/bank.router.js
const express = require('express');
const boom = require('@hapi/boom');
const multer = require('multer');
const bankController = require('../controllers/bank.controller');
const { jwtValidate } = require('../middlewares/auth.handler');
const { requireEntityAccess } = require('../middlewares/entity-access.handler');
const { verifyEmissoWebhook } = require('../middlewares/emisso-webhook.handler');
const { requireEntityPermission } = require('../middlewares/permission.handler');

const router = express.Router();
const ensureEntityAccess = requireEntityAccess();
const ensureEntityDeleteAccess = requireEntityAccess('delete');
const ensureEntityCreateAccess = requireEntityAccess('create');
const ensureEntityUpdateAccess = requireEntityAccess('update');

// 1. Webhook publico de Emisso Connect (autenticado por firma HMAC Standard Webhooks, sin JWT)
router.post('/webhook-emisso', verifyEmissoWebhook, bankController.handleEmissoWebhook);

// 2. Todas las rutas bancarias internas requieren sesion JWT de Leins
router.use(jwtValidate);

// configuracion de multer para la carga en memoria
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
   limits: { fileSize: 10 * 1024 * 1024 } // limite de 10mb
});

// rutas de bancos y carga de archivos
router.get('/accounts', ensureEntityAccess, requireEntityPermission('bank_accounts', 'view'), bankController.listBankAccounts);
router.post('/accounts', ensureEntityCreateAccess, requireEntityPermission('bank_accounts', 'manage'), bankController.createBankAccount);
router.put('/accounts/:id', ensureEntityUpdateAccess, requireEntityPermission('bank_accounts', 'manage'), bankController.updateBankAccount);
router.delete('/accounts/:id', ensureEntityDeleteAccess, requireEntityPermission('bank_accounts', 'manage'), bankController.deleteBankAccount);
router.post('/accounts/:id/reveal', ensureEntityUpdateAccess, requireEntityPermission('bank_accounts', 'view'), bankController.revealBankAccountNumber);

// integracion emisso connect
router.get('/accounts/emisso-connections', ensureEntityAccess, requireEntityPermission('bank_accounts', 'view'), bankController.listEmissoConnections);
router.post('/accounts/discover-emisso', ensureEntityCreateAccess, requireEntityPermission('bank_accounts', 'connect_bank'), bankController.discoverAndLinkEmissoAccounts);
router.post('/accounts/:id/sync-emisso', ensureEntityUpdateAccess, requireEntityPermission('bank_movements', 'bank_sync'), bankController.syncEmissoAccount);
router.post('/accounts/connect-link', ensureEntityCreateAccess, requireEntityPermission('bank_accounts', 'connect_bank'), bankController.createEmissoConnectLink);

router.get('/upload-template', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.downloadMovementsTemplate);
router.post('/upload-excel', upload.single('file'), ensureEntityCreateAccess, requireEntityPermission('bank_movements', 'upload_cartola'), bankController.uploadExcel);
router.get('/transactions', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.listTransactions);
router.delete('/transactions/:id', ensureEntityDeleteAccess, requireEntityPermission('bank_movements', 'delete_movement'), bankController.deleteTransaction);

// rutas de conciliacion
router.get('/reconcile/autofind', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.autoFindReconcile);
router.get('/reconcile/suggestions', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.getSuggestions);
router.get('/reconcile/suggestions/fast', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.getSuggestionsFast);
router.get('/reconcile/suggestions/count', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.countSuggestions);
router.get('/reconcile/bank-candidates', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.searchBankReconcileCandidates);
router.get('/reconcile/document-candidates', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.searchDocumentReconcileCandidates);
router.post('/reconcile', ensureEntityCreateAccess, requireEntityPermission('bank_movements', 'reconcile'), bankController.reconcileTransaction);
router.post('/reconcile/expense', ensureEntityCreateAccess, requireEntityPermission('bank_movements', 'reconcile'), bankController.reconcileDirectExpense);
router.post('/reconcile/bank', ensureEntityCreateAccess, requireEntityPermission('bank_movements', 'reconcile'), bankController.reconcileBankTransaction);
router.post('/reconcile/bulk', ensureEntityCreateAccess, requireEntityPermission('bank_movements', 'reconcile'), bankController.bulkReconcile);
router.delete('/reconcile/:id', ensureEntityDeleteAccess, requireEntityPermission('bank_movements', 'unreconcile'), bankController.unreconcileTransaction);
router.get('/reconcile/list', ensureEntityAccess, requireEntityPermission('bank_movements', 'view'), bankController.listReconciliations);

module.exports = router;
