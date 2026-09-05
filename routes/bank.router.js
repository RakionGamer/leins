// routes/bank.router.js
const express = require('express');
const boom = require('@hapi/boom');
const multer = require('multer');
const bankController = require('../controllers/bank.controller');
const { requireEntityAccess } = require('../middlewares/entity-access.handler');

const router = express.Router();
const ensureEntityAccess = requireEntityAccess();
const ensureEntityDeleteAccess = requireEntityAccess('delete');
const ensureEntityCreateAccess = requireEntityAccess('create');
const ensureEntityUpdateAccess = requireEntityAccess('update');

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
router.get('/accounts', ensureEntityAccess, bankController.listBankAccounts);
router.post('/accounts', ensureEntityCreateAccess, bankController.createBankAccount);
router.put('/accounts/:id', ensureEntityUpdateAccess, bankController.updateBankAccount);
router.delete('/accounts/:id', ensureEntityDeleteAccess, bankController.deleteBankAccount);
router.post('/accounts/:id/reveal', ensureEntityUpdateAccess, bankController.revealBankAccountNumber);

router.get('/upload-template', ensureEntityAccess, bankController.downloadMovementsTemplate);
router.post('/upload-excel', upload.single('file'), ensureEntityCreateAccess, bankController.uploadExcel);
router.get('/transactions', ensureEntityAccess, bankController.listTransactions);
router.delete('/transactions/:id', ensureEntityDeleteAccess, bankController.deleteTransaction);

// rutas de conciliacion
router.get('/reconcile/autofind', ensureEntityAccess, bankController.autoFindReconcile);
router.get('/reconcile/suggestions', ensureEntityAccess, bankController.getSuggestions);
router.get('/reconcile/suggestions/fast', ensureEntityAccess, bankController.getSuggestionsFast);
router.get('/reconcile/suggestions/count', ensureEntityAccess, bankController.countSuggestions);
router.get('/reconcile/bank-candidates', ensureEntityAccess, bankController.searchBankReconcileCandidates);
router.post('/reconcile', ensureEntityCreateAccess, bankController.reconcileTransaction);
router.post('/reconcile/bank', ensureEntityCreateAccess, bankController.reconcileBankTransaction);
router.post('/reconcile/bulk', ensureEntityCreateAccess, bankController.bulkReconcile);
router.delete('/reconcile/:id', ensureEntityDeleteAccess, bankController.unreconcileTransaction);
router.get('/reconcile/list', ensureEntityAccess, bankController.listReconciliations);

module.exports = router;
