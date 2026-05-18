const express = require('express');
const entitiesController = require('../controllers/entities.controller');
const credentialsController = require('../controllers/credentials.controller');
const { isSuperAdmin, setSuperAdminContext } = require('../middlewares/auth.handler');
const { requireEntityAccess } = require('../middlewares/entity-access.handler');
const validatorHandler = require('../middlewares/validator.handler');
const {
   listEntitiesQuerySchema,
   createEntitySchema,
   updateEntityParamsSchema,
   updateEntitySchema,
   deleteEntityParamsSchema,
} = require('../schemas/entities.schema');
const {
   entityCredentialParamsSchema,
   credentialParamsSchema,
   listCredentialsQuerySchema,
   createCredentialSchema,
   updateCredentialSchema,
} = require('../schemas/credentials.schema');

const router = express.Router();
const ensureEntityAccess = requireEntityAccess();

// siempre calculamos contexto de rol para que GET pueda distinguir superadmin vs usuario normal
router.use(setSuperAdminContext);

// rutas mapeadas a sus controladores
router.get('/', validatorHandler(listEntitiesQuerySchema, 'query'), entitiesController.listEntities);
router.post('/', isSuperAdmin, validatorHandler(createEntitySchema, 'body'), entitiesController.createEntity);

router.get(
   '/:entityId/credentials',
   validatorHandler(entityCredentialParamsSchema, 'params'),
   validatorHandler(listCredentialsQuerySchema, 'query'),
   ensureEntityAccess,
   credentialsController.listCredentials
);
router.post(
   '/:entityId/credentials',
   validatorHandler(entityCredentialParamsSchema, 'params'),
   validatorHandler(createCredentialSchema, 'body'),
   ensureEntityAccess,
   credentialsController.createCredential
);
router.get(
   '/:entityId/credentials/:credentialId',
   validatorHandler(credentialParamsSchema, 'params'),
   ensureEntityAccess,
   credentialsController.getCredential
);
router.put(
   '/:entityId/credentials/:credentialId',
   validatorHandler(credentialParamsSchema, 'params'),
   validatorHandler(updateCredentialSchema, 'body'),
   ensureEntityAccess,
   credentialsController.updateCredential
);
router.delete(
   '/:entityId/credentials/:credentialId',
   validatorHandler(credentialParamsSchema, 'params'),
   ensureEntityAccess,
   credentialsController.deleteCredential
);
router.post(
   '/:entityId/credentials/:credentialId/reveal',
   validatorHandler(credentialParamsSchema, 'params'),
   ensureEntityAccess,
   credentialsController.revealCredential
);

router.put('/:id', isSuperAdmin, validatorHandler(updateEntityParamsSchema, 'params'), validatorHandler(updateEntitySchema, 'body'), entitiesController.updateEntity);
router.delete('/:id', isSuperAdmin, validatorHandler(deleteEntityParamsSchema, 'params'), entitiesController.deleteEntity);
router.post('/:entityId/sync-sii', ensureEntityAccess, entitiesController.syncSii);

module.exports = router;
