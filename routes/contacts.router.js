"use strict";

const express = require("express");
const router = express.Router();
const validatorHandler = require("../middlewares/validator.handler");
const { requireEntityAccess } = require("../middlewares/entity-access.handler");

const {
   createContactSchema,
   updateContactSchema,
   getContactByIdSchema,
   queryContactSchema,
} = require("../schemas/contact.schema");

const controller = require("../controllers/contact.controller");

const ensureEntityAccess = requireEntityAccess();

router.get("/", ensureEntityAccess, validatorHandler(queryContactSchema, "query"), controller.listContacts);
router.get("/select", ensureEntityAccess, controller.searchForSelect);
router.post("/sync", ensureEntityAccess, controller.syncContactsFromSii);
router.get("/:id", ensureEntityAccess, validatorHandler(getContactByIdSchema, "params"), controller.getContactById);
router.post("/", ensureEntityAccess, validatorHandler(createContactSchema, "body"), controller.createContact);
router.patch("/:id", ensureEntityAccess, validatorHandler(getContactByIdSchema, "params"), validatorHandler(updateContactSchema, "body"), controller.updateContact);
router.delete("/:id", ensureEntityAccess, validatorHandler(getContactByIdSchema, "params"), controller.deleteContact);

module.exports = router;
