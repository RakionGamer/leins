const express = require('express');
const statesController = require('../controllers/states.controller');

const router = express.Router();

// rutas de estados
router.get('/', statesController.listStates);
router.get('/:id', statesController.getStateById);

module.exports = router;