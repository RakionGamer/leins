"use strict";

const Joi = require("joi");

const rutPattern = /^[0-9]+-[0-9kK]{1}$|^[0-9]{1,2}(\.[0-9]{3}){2}-[0-9kK]{1}$/;

const id = Joi.number().integer().positive();
const entityId = Joi.number().integer().positive();
const rut = Joi.string().trim().min(3).max(20);
const name = Joi.string().trim().min(2).max(255);
const type = Joi.string().valid("CLIENTE", "PROVEEDOR", "PRESTADOR_SERVICIOS", "TRABAJADOR", "OTRO");
const email = Joi.string().email().allow("", null);
const phone = Joi.string().max(50).allow("", null);
const address = Joi.string().max(255).allow("", null);
const notes = Joi.string().allow("", null);
const source = Joi.string().valid("SII_FACT", "SII_BH", "MANUAL");

const createContactSchema = Joi.object({
   rut: rut.required(),
   name: name.required(),
   type: type.default("PROVEEDOR"),
   email: email.optional(),
   phone: phone.optional(),
   address: address.optional(),
   notes: notes.optional(),
});

const updateContactSchema = Joi.object({
   name: name.optional(),
   type: type.optional(),
   email: email.optional(),
   phone: phone.optional(),
   address: address.optional(),
   notes: notes.optional(),
});

const getContactByIdSchema = Joi.object({
   id: id.required(),
});

const queryContactSchema = Joi.object({
   entityId: entityId.optional(),
   search: Joi.string().trim().allow("").optional(),
   type: Joi.string().trim().allow("").optional(),
   source: Joi.string().trim().allow("").optional(),
   limit: Joi.number().integer().min(1).max(500).optional(),
   offset: Joi.number().integer().min(0).optional(),
   all: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false", "1", "0")).optional(),
});

module.exports = {
   createContactSchema,
   updateContactSchema,
   getContactByIdSchema,
   queryContactSchema,
};
