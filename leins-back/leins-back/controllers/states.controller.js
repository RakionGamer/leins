const boom = require('@hapi/boom');
const StateService = require('../services/state.service');
const asyncHandler = require('../utils/helpers/asyncHandler');

const service = new StateService();

// controlador para obtener todos los estados
const listStates = asyncHandler(async (req, res) => {
   const states = await service.find();

   res.status(200).json({
      data: states.items,
      total: states.total
   });
});

// controlador para obtener un estado especifico por id
const getStateById = asyncHandler(async (req, res) => {
   const id = Number(req.params.id);

   if (Number.isNaN(id)) {
      throw boom.badRequest('the id must be a number');
   }

   const state = await service.findOne(id);
   res.status(200).json({ data: state });
});

module.exports = {
   listStates,
   getStateById
};