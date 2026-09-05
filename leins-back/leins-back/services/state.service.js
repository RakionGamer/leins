const boom = require('@hapi/boom');
const { models } = require('../libs/sequelize');

class StateService {
   constructor() { }

   // Busca todos los estados en la base de datos
   async find() {
      try {
         // findAndCountAll devuelve { count, rows }
         const { count, rows } = await models.State.findAndCountAll();
         return {
            total: count,   // numero total de registros
            items: rows     // registros encontrados
         };
      } catch (error) {
         console.error('Error in find():', error);
         throw boom.badImplementation('Failed to fetch states from the database');
      }
   }

   // Busca un estado especifico por su ID
   async findOne(id) {
      try {
         const state = await models.State.findByPk(id);
         if (!state) {
            throw boom.notFound('State not found');
         }
         return state;
      } catch (error) {
         console.error('Error in findOne():', error);
         // Si ya es un error Boom, lo relanza
         if (boom.isBoom(error)) throw error;
         throw boom.badImplementation('Failed to fetch the state');
      }
   }
}

module.exports = StateService;