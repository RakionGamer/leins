const express = require('express');
const entitiesController = require('../controllers/entities.controller');
const { isSuperAdmin } = require('../middlewares/auth.handler');

const router = express.Router();

// aplicamos el middleware extraido
router.use(isSuperAdmin);

// rutas mapeadas a sus controladores
router.get('/', entitiesController.listEntities);
router.post('/:id/sync-sii', entitiesController.syncSii);

module.exports = router;