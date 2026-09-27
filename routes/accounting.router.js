"use strict";

const express = require("express");
const router = express.Router();
const validatorHandler = require("../middlewares/validator.handler");
const { requireEntityAccess } = require("../middlewares/entity-access.handler");

const {
   createAccountSchema,
   updateAccountSchema,
   upsertRuleSchema,
   createEntrySchema,
   generateSiiSchema,
   getByIdSchema,
} = require("../schemas/accounting.schema");

const controller = require("../controllers/accounting.controller");

const ensureEntityAccess = requireEntityAccess();

// --- Plan de cuentas ---
router.get("/accounts", ensureEntityAccess, controller.getAccounts);
router.post("/accounts", ensureEntityAccess, validatorHandler(createAccountSchema, "body"), controller.createAccount);
router.post("/accounts/seed", ensureEntityAccess, controller.seedDefaultPlan);
router.patch("/accounts/:id", ensureEntityAccess, validatorHandler(getByIdSchema, "params"), validatorHandler(updateAccountSchema, "body"), controller.updateAccount);
router.delete("/accounts/:id", ensureEntityAccess, validatorHandler(getByIdSchema, "params"), controller.deleteAccount);

// --- Reglas de proveedores / clientes ---
router.get("/rules", ensureEntityAccess, controller.getRules);
router.post("/rules", ensureEntityAccess, validatorHandler(upsertRuleSchema, "body"), controller.upsertRule);
router.delete("/rules/:id", ensureEntityAccess, validatorHandler(getByIdSchema, "params"), controller.deleteRule);

// --- Asientos contables ---
router.get("/entries", ensureEntityAccess, controller.getEntries);
router.get("/entries/:id", ensureEntityAccess, validatorHandler(getByIdSchema, "params"), controller.getEntryById);
router.post("/entries", ensureEntityAccess, validatorHandler(createEntrySchema, "body"), controller.createEntry);
router.post("/entries/:id/annul", ensureEntityAccess, validatorHandler(getByIdSchema, "params"), controller.annulEntry);
router.post("/entries/generate-sii", ensureEntityAccess, validatorHandler(generateSiiSchema, "body"), controller.generateSiiEntries);

// --- Saldos por RUT ---
router.get("/balances", ensureEntityAccess, controller.getBalances);

module.exports = router;
