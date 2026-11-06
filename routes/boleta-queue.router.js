// routes/boleta-queue.router.js
'use strict';

const express = require('express');
const multer = require('multer');
const controller = require('../controllers/boleta-queue.controller');
const { jwtValidate } = require('../middlewares/auth.handler');
const { requireEntityAccess } = require('../middlewares/entity-access.handler');

const router = express.Router();
const ensureEntityAccess = requireEntityAccess();
const ensureEntityCreateAccess = requireEntityAccess('create');

const upload = multer({
   storage: multer.memoryStorage(),
   limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// 1. Rutas del Worker de Harry (autentican con X-Agent-Token)
router.get('/next', controller.getNextJob);
router.get('/api_boletas_next.php', controller.getNextJob);
router.get('/consultar', controller.consultPendingJobs);
router.get('/pendientes', controller.consultPendingJobs);

router.post('/upload', upload.single('archivo'), controller.uploadPdf);
router.post('/api_boletas_upload.php', upload.single('archivo'), controller.uploadPdf);

router.post('/error', controller.reportError);
router.post('/api_boletas_error.php', controller.reportError);

// 2. Rutas internas de Leins (autenticadas con JWT y entidad)
router.post('/queue', jwtValidate, ensureEntityCreateAccess, controller.createRequest);
router.get('/', jwtValidate, ensureEntityAccess, controller.listRequests);
router.get('/active-map', jwtValidate, ensureEntityAccess, controller.getActiveMap);
router.delete('/:id', jwtValidate, ensureEntityAccess, controller.cancelRequest);
router.get('/:id/download', jwtValidate, ensureEntityAccess, controller.downloadPdf);

module.exports = router;
