const joi = require("joi");

const id = joi.number().integer().positive();
const entityId = joi.number().integer().positive();

const createAccountSchema = joi.object({
   entityId: entityId.optional(),
   code: joi.string().max(30).required(),
   name: joi.string().max(255).required(),
   type: joi.string().valid("ACTIVO", "PASIVO", "PATRIMONIO", "INGRESOS", "COSTOS", "GASTOS").required(),
   nature: joi.string().valid("DEUDORA", "ACREEDORA").optional(),
   cost_center_requirement: joi.string().valid("NONE", "OPTIONAL", "REQUIRED").optional(),
});

const updateAccountSchema = joi.object({
   name: joi.string().max(255).optional(),
   type: joi.string().valid("ACTIVO", "PASIVO", "PATRIMONIO", "INGRESOS", "COSTOS", "GASTOS").optional(),
   nature: joi.string().valid("DEUDORA", "ACREEDORA").optional(),
   cost_center_requirement: joi.string().valid("NONE", "OPTIONAL", "REQUIRED").optional(),
});

const upsertRuleSchema = joi.object({
   entityId: entityId.optional(),
   counterparty_rut: joi.string().max(16).required(),
   counterparty_name: joi.string().max(255).allow(null, "").optional(),
   account_id: joi.number().integer().positive().required(),
   cost_center: joi.string().max(100).allow(null, "").optional(),
});

const upsertBulkRuleSchema = joi.object({
   account_id: joi.number().integer().positive().required(),
   cost_center: joi.string().max(100).allow(null, "").optional(),
   replace_account: joi.boolean().optional(),
   ruts: joi.array().items(joi.object({
      rut: joi.string().max(16).required(),
      name: joi.string().max(255).allow(null, "").optional()
   })).allow(null).optional()
});

const entryItemSchema = joi.object({
   account_id: joi.number().integer().positive().required(),
   description: joi.string().max(255).allow(null, "").optional(),
   debit: joi.number().min(0).optional(),
   credit: joi.number().min(0).optional(),
   counterparty_rut: joi.string().max(16).allow(null, "").optional(),
   counterparty_name: joi.string().max(255).allow(null, "").optional(),
   cost_center: joi.string().max(100).allow(null, "").optional(),
});

const createEntrySchema = joi.object({
   entityId: entityId.optional(),
   entry_date: joi.date().iso().required(),
   concept: joi.string().max(500).required(),
   source_type: joi.string().valid("MANUAL", "SII_PURCHASE", "SII_SALE", "BANK_MOVEMENT", "OTHER").optional(),
   items: joi.array().items(entryItemSchema).min(2).required(),
});

const generateSiiSchema = joi.object({
   entityId: entityId.optional(),
   month: joi.string().pattern(/^\d{4}-\d{2}$/).optional(),
   from: joi.date().iso().optional(),
   to: joi.date().iso().optional(),
   docIds: joi.array().items(joi.number().integer().positive()).optional(),
});

const getByIdSchema = joi.object({
   id: id.required(),
});

module.exports = {
   createAccountSchema,
   updateAccountSchema,
   upsertRuleSchema,
   upsertBulkRuleSchema,
   createEntrySchema,
   generateSiiSchema,
   getByIdSchema,
};
