const boom = require('@hapi/boom');

function validatorHandler(schema, property) {
   return (req, res, next) => {
      if (!schema || typeof schema.validate !== 'function') {
         return next();
      }

      // property puede ser 'body', 'params', 'query'
      const data = req[property];

      // abortEarly: false hace que muestre TODOS los errores juntos, no solo el primero
      const { error } = schema.validate(data, { abortEarly: false });

      if (error) {
         next(boom.badRequest(error));
      } else {
         next();
      }
   };
}

module.exports = validatorHandler;
