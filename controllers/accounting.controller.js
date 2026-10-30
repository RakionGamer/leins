"use strict";

const boom = require("@hapi/boom");
const { models } = require("../libs/sequelize");
const AccountingService = require("../services/accounting.service");
const service = new AccountingService();

async function assertAccountAdminPermission(req) {
   const actorId = Number(req.userId || req.user?.sub || req.user?.id);
   if (!Number.isInteger(actorId) || actorId <= 0) {
      throw boom.unauthorized("Usuario no autenticado");
   }

   // 1. SuperAdmin
   const superAdmin = await models.SuperAdmin.findByPk(actorId, { attributes: ['id', 'state_id'], raw: true });
   if (superAdmin && Number(superAdmin.state_id) === 1) return true;

   // 2. Scoped Admin
   const scopedAdmin = await models.Admin.findOne({ where: { super_admin_id: actorId }, attributes: ['id'], raw: true });
   if (scopedAdmin) return true;

   // 3. User with write access (not read_only)
   if (req.entityId) {
      const userEntity = await models.UserEntity.findOne({
         where: { user_id: actorId, entity_id: req.entityId },
         attributes: ['read_only'],
         raw: true
      });
      if (userEntity && userEntity.read_only === false) return true;
   }

   throw boom.forbidden("Solo los usuarios administradores pueden modificar o eliminar cuentas contables");
}

const getAccounts = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const accounts = await service.listAccounts(entityId, req.query);
      res.json(accounts);
   } catch (error) {
      next(error);
   }
};

const createAccount = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const account = await service.createAccount(entityId, req.body);
      res.status(201).json(account);
   } catch (error) {
      next(error);
   }
};

const updateAccount = async (req, res, next) => {
   try {
      await assertAccountAdminPermission(req);
      const entityId = req.entityId;
      const { id } = req.params;
      const account = await service.updateAccount(entityId, id, req.body);
      res.json(account);
   } catch (error) {
      next(error);
   }
};

const deleteAccount = async (req, res, next) => {
   try {
      await assertAccountAdminPermission(req);
      const entityId = req.entityId;
      const { id } = req.params;
      const result = await service.deleteAccount(entityId, id);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const seedDefaultPlan = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.ensureDefaultPlan(entityId);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getRules = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const rules = await service.listRules(entityId);
      res.json(rules);
   } catch (error) {
      next(error);
   }
};

const classifyDocument = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.classifyDocument(entityId, req.body);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const upsertRule = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const rule = await service.upsertRule(entityId, req.body);
      res.status(201).json(rule);
   } catch (error) {
      next(error);
   }
};

const upsertBulkRules = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.upsertBulkRules(entityId, req.body);
      res.status(201).json(result);
   } catch (error) {
      next(error);
   }
};

const deleteRule = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { id } = req.params;
      const result = await service.deleteRule(entityId, id);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getEntries = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const entries = await service.listEntries(entityId, req.query);
      res.json(entries);
   } catch (error) {
      next(error);
   }
};

const getEntryById = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { id } = req.params;
      const entry = await service.getEntryById(entityId, id);
      res.json(entry);
   } catch (error) {
      next(error);
   }
};

const createEntry = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const entry = await service.createEntry(entityId, req.body);
      res.status(201).json(entry);
   } catch (error) {
      next(error);
   }
};

const annulEntry = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { id } = req.params;
      const entry = await service.annulEntry(entityId, id);
      res.json(entry);
   } catch (error) {
      next(error);
   }
};

const generateSiiEntries = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.generateSiiEntries(entityId, req.body);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getBalances = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const balances = await service.getRUTBalances(entityId, req.query);
      res.json(balances);
   } catch (error) {
      next(error);
   }
};

const clearAnnulledEntries = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.clearAnnulledEntries(entityId);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const deleteAllEntries = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.deleteAllEntries(entityId);
      res.json(result);
   } catch (error) {
      next(error);
   }
};


const searchCounterparty = async (req, res, next) => {
   try {
      const { rut } = req.params;
      const result = await service.searchCounterparty(rut);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const searchCounterparties = async (req, res, next) => {
   try {
      const result = await service.searchCounterparties(req.entityId, req.query.q);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getIncomeStatement = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.getIncomeStatement(entityId, req.query);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getIncomeStatementDrilldown = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.getIncomeStatementDrilldown(entityId, req.query);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getCashFlow = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.getCashFlow(entityId, req.query);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getCashFlowDrilldown = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await service.getCashFlowDrilldown(entityId, req.query);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

module.exports = {
   searchCounterparty,
   searchCounterparties,
   getAccounts,
   createAccount,
   updateAccount,
   deleteAccount,
   seedDefaultPlan,
   getRules,
   classifyDocument,
   upsertRule,
   upsertBulkRules,
   deleteRule,
   getEntries,
   getEntryById,
   createEntry,
   annulEntry,
   clearAnnulledEntries,
   deleteAllEntries,
   generateSiiEntries,
   getBalances,
   getIncomeStatement,
   getIncomeStatementDrilldown,
   getCashFlow,
   getCashFlowDrilldown,
};
