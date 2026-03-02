// routes/bank.router.js
const express = require('express');
const boom = require('@hapi/boom');
const multer = require('multer');
const bankController = require('../controllers/bank.controller');

const router = express.Router();

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
router.post('/upload-excel', upload.single('file'), bankController.uploadExcel);
router.get('/transactions', bankController.listTransactions);

// rutas de conciliacion
router.get('/reconcile/autofind', bankController.autoFindReconcile);
router.get('/reconcile/suggestions', bankController.getSuggestions);
router.post('/reconcile', bankController.reconcileTransaction);
router.post('/reconcile/bulk', bankController.bulkReconcile);
router.delete('/reconcile/:id', bankController.unreconcileTransaction);
router.get('/reconcile/list', bankController.listReconciliations);

module.exports = router;