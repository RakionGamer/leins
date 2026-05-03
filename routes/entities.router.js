const express = require('express');
const entitiesController = require('../controllers/entities.controller');
const { isSuperAdmin, setSuperAdminContext } = require('../middlewares/auth.handler');
const validatorHandler = require('../middlewares/validator.handler');
const {
   listEntitiesQuerySchema,
   createEntitySchema,
   updateEntityParamsSchema,
   updateEntitySchema,
   deleteEntityParamsSchema,
} = require('../schemas/entities.schema');

const router = express.Router();

// siempre calculamos contexto de rol para que GET pueda distinguir superadmin vs usuario normal
router.use(setSuperAdminContext);

// rutas mapeadas a sus controladores
router.get('/', validatorHandler(listEntitiesQuerySchema, 'query'), entitiesController.listEntities);
router.post('/', isSuperAdmin, validatorHandler(createEntitySchema, 'body'), entitiesController.createEntity);
router.put('/:id', isSuperAdmin, validatorHandler(updateEntityParamsSchema, 'params'), validatorHandler(updateEntitySchema, 'body'), entitiesController.updateEntity);
router.delete('/:id', isSuperAdmin, validatorHandler(deleteEntityParamsSchema, 'params'), entitiesController.deleteEntity);
router.post('/:id/sync-sii', entitiesController.syncSii);

module.exports = router;
