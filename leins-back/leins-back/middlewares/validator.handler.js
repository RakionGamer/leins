const boom = require('@hapi/boom');

// traduccion global de los mensajes por defecto de Joi (estan en ingles).
// sirve como respaldo: si un schema define sus propios .messages({...}),
// esos tienen prioridad y no se ven afectados por este mapa.
// nota: {{#label}} ya viene entre comillas por defecto (Joi lo renderiza como "campo"),
// por eso las plantillas no le agregan comillas propias.
const SPANISH_MESSAGES = {
   'any.required': '{{#label}} es requerido',
   'any.only': '{{#label}} debe ser uno de: {{#valids}}',
   'any.invalid': '{{#label}} contiene un valor invalido',
   'string.empty': '{{#label}} no puede estar vacio',
   'string.min': '{{#label}} debe tener al menos {{#limit}} caracteres',
   'string.max': '{{#label}} no puede superar los {{#limit}} caracteres',
   'string.length': '{{#label}} debe tener exactamente {{#limit}} caracteres',
   'string.email': '{{#label}} debe ser un email valido',
   'string.alphanum': '{{#label}} solo puede contener caracteres alfanumericos',
   'string.pattern.base': '{{#label}} tiene un formato invalido',
   'string.uri': '{{#label}} debe ser una URL valida',
   'string.base': '{{#label}} debe ser de tipo texto',
   'number.base': '{{#label}} debe ser un numero',
   'number.integer': '{{#label}} debe ser un numero entero',
   'number.positive': '{{#label}} debe ser un numero positivo',
   'number.min': '{{#label}} debe ser mayor o igual a {{#limit}}',
   'number.max': '{{#label}} debe ser menor o igual a {{#limit}}',
   'boolean.base': '{{#label}} debe ser verdadero o falso',
   'object.base': '{{#label}} debe ser un objeto valido',
   'object.min': 'debes ingresar al menos {{#limit}} dato(s) para continuar',
   'object.missing': 'debes ingresar al menos uno de: {{#peers}}',
   'object.xor': 'debes ingresar solo uno de: {{#peers}}',
   'object.and': 'debes ingresar todos estos datos juntos: {{#peers}}',
   'array.base': '{{#label}} debe ser una lista',
   'array.min': '{{#label}} debe tener al menos {{#limit}} elemento(s)',
};

function validatorHandler(schema, property) {
   return (req, res, next) => {
      // property puede ser 'body', 'params', 'query'
      const data = req[property];

      // abortEarly: false hace que muestre TODOS los errores juntos, no solo el primero
      const { error } = schema.validate(data, {
         abortEarly: false,
         messages: SPANISH_MESSAGES,
      });

      if (error) {
         next(boom.badRequest(error));
      } else {
         next();
      }
   };
}

module.exports = validatorHandler;