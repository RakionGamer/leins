const joi = require('joi');

// funcion validadora de rut chileno (modulo 11)
const validateRut = (value, helpers) => {
   if (!value) return value;

   const cleanRut = value.replace(/[^0-9kK]/g, '').toUpperCase();
   if (cleanRut.length < 2) return helpers.message('el rut de la contraparte no es valido');

   const dv = cleanRut.slice(-1);
   let body = parseInt(cleanRut.slice(0, -1), 10);

   let sum = 0;
   let multiplier = 2;
   while (body > 0) {
      sum += (body % 10) * multiplier;
      body = Math.floor(body / 10);
      multiplier = multiplier < 7 ? multiplier + 1 : 2;
   }

   const expectedDv = 11 - (sum % 11);
   const calculatedDv = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : String(expectedDv);

   if (dv !== calculatedDv) {
      return helpers.message('el rut de la contraparte no es valido');
   }

   return value;
};

// tipos base
const entity_id = joi.number().integer().positive();
const total_amount = joi.number().precision(2).positive();
const issue_date = joi.date().iso();
const counterparty_rut = joi.string().max(16).allow(null, '').custom(validateRut, 'validacion matematica de rut');
const counterparty_name = joi.string().max(255).allow(null, '');
const state_id = joi.number().integer().positive();
const folio = joi.string().max(50).allow(null, '');
const operation_type = joi.string().valid('INCOME', 'EXPENSE');

const expenseDocType = joi.alternatives().try(
   joi.valid(null),
   joi.number().integer().valid(33, 39, 1002)
).messages({
   'alternatives.match': 'para egresos solo se permite BOLETAS (39), FACTURA (33), BOLETA DE HONORARIOS RECIBIDA (1002) o RECIBO (null)',
   'any.only': 'para egresos solo se permite BOLETAS (39), FACTURA (33), BOLETA DE HONORARIOS RECIBIDA (1002) o RECIBO (null)'
});

// esquema para leer parametros de la url
const getDocumentSchema = joi.object({
   id: joi.number().integer().positive().required()
});

// esquema creacion
const createManualIncomeSchema = joi.object({
   entity_id: entity_id.required(),
   operation_type: operation_type.required(),
   total_amount: total_amount.required(),
   issue_date: issue_date.required(),

   // regla condicional: requerido para ingresos, restringido para egresos
   doc_type_code: joi.when('operation_type', {
      is: 'INCOME',
      then: joi.number().integer().positive().required().messages({
         'any.required': 'el tipo de documento es obligatorio para los ingresos'
      }),
      otherwise: expenseDocType.optional()
   }),

   counterparty_rut: counterparty_rut.optional(),
   counterparty_name: counterparty_name.optional(),
   state_id: state_id.optional(),
   folio: folio.optional()
});

// esquema actualizacion
const updateDocumentSchema = joi.object({
   operation_type: operation_type.required(),
   total_amount: total_amount.optional(),
   issue_date: issue_date.optional(),

   // misma regla condicional al editar
   doc_type_code: joi.when('operation_type', {
      is: 'INCOME',
      then: joi.number().integer().positive().required().messages({
         'any.required': 'el tipo de documento es obligatorio para los ingresos'
      }),
      otherwise: expenseDocType.optional()
   }),

   counterparty_rut: counterparty_rut.optional(),
   counterparty_name: counterparty_name.optional(),
   folio: folio.optional()
});

module.exports = {
   createManualIncomeSchema,
   updateDocumentSchema,
   getDocumentSchema
};
