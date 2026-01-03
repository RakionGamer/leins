const express = require('express');
const boom = require('@hapi/boom');
const StateService = require('../services/state.service');

const router = express.Router();
const service = new StateService();

// Ruta para obtener todos los estados
router.get('/', async (req, res, next) => {
   try {
      const states = await service.find();
      res.status(200).json({
         data: states.items,
         total: states.total
      });
   } catch (error) {
      console.error('[GET /states] Error:', error);
      next(error);
   }
});

// Ruta para obtener un estado especifico por ID
router.get('/:id', async (req, res, next) => {
   try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
         throw boom.badRequest('The id must be a number');
      }
      const state = await service.findOne(id);
      res.status(200).json({ data: state });
   } catch (error) {
      next(error);
   }
});

module.exports = router;
