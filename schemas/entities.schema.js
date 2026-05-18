const Joi = require('joi');

function normalizeRut(value) {
   return String(value || '').replace(/[^0-9kK]/g, '').toUpperCase();
}

function isValidRut(cleanRut) {
   if (!/^\d+[0-9K]$/.test(cleanRut || '')) return false;

   const body = cleanRut.slice(0, -1);
   const dv = cleanRut.slice(-1);

   let sum = 0;
   let multiplier = 2;

   for (let i = body.length - 1; i >= 0; i--) {
      sum += Number(body[i]) * multiplier;
      multiplier = multiplier < 7 ? multiplier + 1 : 2;
   }

   const expected = 11 - (sum % 11);
   const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);

   return dv === expectedDv;
}

function formatRut(cleanRut) {
   const dv = cleanRut.slice(-1);
   const body = cleanRut.slice(0, -1);
   const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return `${bodyWithDots}-${dv}`;
}

function validateRut(value, helpers) {
   if (value === undefined || value === null || String(value).trim() === '') {
      return value;
   }

   const cleanRut = normalizeRut(value);
   if (cleanRut.length < 2 || !isValidRut(cleanRut)) {
      return helpers.message('rut de entidad invalido');
   }

   return formatRut(cleanRut);
}

const id = Joi.number().integer().positive();
const name = Joi.string().trim().min(2).max(255).empty('').messages({
   'string.min': 'el nombre de la entidad debe tener al menos 2 caracteres',
   'string.max': 'el nombre de la entidad no puede superar 255 caracteres',
});
const rut = Joi.string().trim().min(3).max(20).empty('').custom(validateRut, 'validacion matematica de rut chileno').messages({
   'string.min': 'el RUT de la entidad es demasiado corto',
   'string.max': 'el RUT de la entidad no puede superar 20 caracteres',
});
const stateId = Joi.number().integer().positive();
const sort = Joi.string().valid('id', 'name', 'rut');
const order = Joi.string().valid('asc', 'desc', 'ASC', 'DESC');

const listEntitiesQuerySchema = Joi.object({
   id: id.optional(),
   q: Joi.string().allow('', null).optional(),
   limit: Joi.number().integer().min(1).max(200).optional(),
   offset: Joi.number().integer().min(0).optional(),
   activeOnly: Joi.boolean().optional(),
   sort: sort.optional(),
   order: order.optional(),
});

const createEntitySchema = Joi.object({
   name: name.optional(),
   legal_name: name.optional(),
   rut: rut.optional(),
   tax_id: rut.optional(),
   state_id: stateId.optional(),
}).or('name', 'legal_name').or('rut', 'tax_id').messages({
   'object.missing': 'ingresa el nombre y el RUT de la entidad',
});

const updateEntityParamsSchema = Joi.object({
   id: id.required(),
});

const updateEntitySchema = Joi.object({
   name: name.optional(),
   legal_name: name.optional(),
   rut: rut.optional(),
   tax_id: rut.optional(),
   state_id: stateId.optional(),
}).min(1).messages({
   'object.min': 'ingresa al menos un dato para actualizar la entidad',
});

const deleteEntityParamsSchema = Joi.object({
   id: id.required(),
});

module.exports = {
   listEntitiesQuerySchema,
   createEntitySchema,
   updateEntityParamsSchema,
   updateEntitySchema,
   deleteEntityParamsSchema,
};
