"use strict";

const AccountingService = require("../services/accounting.service");
const service = new AccountingService();

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

module.exports = {
   searchCounterparty,
   getAccounts,
   createAccount,
   updateAccount,
   deleteAccount,
   seedDefaultPlan,
   getRules,
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
};
