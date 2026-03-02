const express = require('express');
const router = express.Router();

const validatorHandler = require('../middlewares/validator.handler');
const {
   createManualIncomeSchema,
   updateDocumentSchema,
   getDocumentSchema
} = require('../schemas/sii-document.schema');

const controller = require('../controllers/sii-document.controller');

// listado de documentos
router.get('/', controller.listDocuments);

// creacion manual
router.post('/manual',
   validatorHandler(createManualIncomeSchema, 'body'),
   controller.createManualDocument
);

// actualizacion
router.patch('/:id',
   validatorHandler(getDocumentSchema, 'params'),
   validatorHandler(updateDocumentSchema, 'body'),
   controller.updateDocument
);

// eliminacion
router.delete('/:id',
   validatorHandler(getDocumentSchema, 'params'),
   controller.deleteDocument
);

module.exports = router;