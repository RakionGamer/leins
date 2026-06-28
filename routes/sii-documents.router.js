const express = require('express');
const router = express.Router();

const validatorHandler = require('../middlewares/validator.handler');
const {
   createManualIncomeSchema,
   updateDocumentSchema,
   getDocumentSchema
} = require('../schemas/sii-document.schema');

const controller = require('../controllers/sii-document.controller');
const {
   requireEntityAccess,
   requireSiiDocumentEntityAccess
} = require('../middlewares/entity-access.handler');

const ensureEntityAccess = requireEntityAccess();
const ensureDocumentEntityAccess = requireSiiDocumentEntityAccess();

// listado de documentos
router.get('/', ensureEntityAccess, controller.listDocuments);

// ventas pendientes agrupadas por dia
router.get('/sales/daily-groups', ensureEntityAccess, controller.dailySalesGroups);

// creacion manual
router.post('/manual',
   validatorHandler(createManualIncomeSchema, 'body'),
   ensureEntityAccess,
   controller.createManualDocument
);

// actualizacion
router.patch('/:id',
   validatorHandler(getDocumentSchema, 'params'),
   validatorHandler(updateDocumentSchema, 'body'),
   ensureDocumentEntityAccess,
   controller.updateDocument
);

// eliminacion
router.delete('/:id',
   validatorHandler(getDocumentSchema, 'params'),
   ensureDocumentEntityAccess,
   controller.deleteDocument
);

module.exports = router;
