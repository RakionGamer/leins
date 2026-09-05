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
   entityIdParamsSchema,
   listSiiSyncJobsQuerySchema,
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
const ensureEntityDeleteAccess = requireEntityAccess('delete');
const ensureEntityCreateAccess = requireEntityAccess('create');
const ensureEntityUpdateAccess = requireEntityAccess('update');

// siempre calculamos contexto de rol para que GET pueda distinguir superadmin vs usuario normal
router.use(setSuperAdminContext);

// rutas mapeadas a sus controladores
router.get('/', validatorHandler(listEntitiesQuerySchema, 'query'), entitiesController.listEntities);
router.post('/', isSuperAdmin, validatorHandler(createEntitySchema, 'body'), entitiesController.createEntity);

router.get(
   '/:entityId/credentials',
   validatorHandler(entityCredentialParamsSchema, 'params'),
   validatorHandler(listCredentialsQuerySchema, 'query'),
   ensureEntityUpdateAccess,
   credentialsController.listCredentials
);
router.post(
   '/:entityId/credentials',
   validatorHandler(entityCredentialParamsSchema, 'params'),
   validatorHandler(createCredentialSchema, 'body'),
   ensureEntityCreateAccess,
   credentialsController.createCredential
);
router.get(
   '/:entityId/credentials/:credentialId',
   validatorHandler(credentialParamsSchema, 'params'),
   ensureEntityUpdateAccess,
   credentialsController.getCredential
);
router.put(
   '/:entityId/credentials/:credentialId',
   validatorHandler(credentialParamsSchema, 'params'),
   validatorHandler(updateCredentialSchema, 'body'),
   ensureEntityUpdateAccess,
   credentialsController.updateCredential
);
router.delete(
   '/:entityId/credentials/:credentialId',
   validatorHandler(credentialParamsSchema, 'params'),
   ensureEntityDeleteAccess,
   credentialsController.deleteCredential
);
router.post(
   '/:entityId/credentials/:credentialId/reveal',
   validatorHandler(credentialParamsSchema, 'params'),
   ensureEntityUpdateAccess,
   credentialsController.revealCredential
);

router.get(
   '/:entityId/sync-sii/jobs',
   validatorHandler(entityIdParamsSchema, 'params'),
   validatorHandler(listSiiSyncJobsQuerySchema, 'query'),
   ensureEntityAccess,
   entitiesController.listSiiSyncJobs
);
router.post(
   '/:entityId/sync-sii',
   validatorHandler(entityIdParamsSchema, 'params'),
   ensureEntityCreateAccess,
   entitiesController.syncSii
);

router.put('/:id', isSuperAdmin, validatorHandler(updateEntityParamsSchema, 'params'), validatorHandler(updateEntitySchema, 'body'), entitiesController.updateEntity);
router.delete('/:id', isSuperAdmin, validatorHandler(deleteEntityParamsSchema, 'params'), entitiesController.deleteEntity);

module.exports = router;
