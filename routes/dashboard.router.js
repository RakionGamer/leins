const express = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { requireEntityAccess } = require('../middlewares/entity-access.handler');

const router = express.Router();
const ensureEntityAccess = requireEntityAccess();

router.get('/summary', ensureEntityAccess, dashboardController.getSummary);

module.exports = router;
