"use strict";

const contactsService = require("../services/contacts.service");

const listContacts = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const result = await contactsService.list(entityId, req.query);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const getContactById = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { id } = req.params;
      const contact = await contactsService.getById(entityId, id);
      res.json(contact);
   } catch (error) {
      next(error);
   }
};

const createContact = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const contact = await contactsService.create(entityId, req.body);
      res.status(201).json(contact);
   } catch (error) {
      next(error);
   }
};

const updateContact = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { id } = req.params;
      const contact = await contactsService.update(entityId, id, req.body);
      res.json(contact);
   } catch (error) {
      next(error);
   }
};

const deleteContact = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { id } = req.params;
      const result = await contactsService.delete(entityId, id);
      res.json(result);
   } catch (error) {
      next(error);
   }
};

const syncContactsFromSii = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const stats = await contactsService.syncFromSii(entityId);
      res.json(stats);
   } catch (error) {
      next(error);
   }
};

const searchForSelect = async (req, res, next) => {
   try {
      const entityId = req.entityId;
      const { q, limit } = req.query;
      const results = await contactsService.searchForSelect(entityId, q, limit);
      res.json(results);
   } catch (error) {
      next(error);
   }
};

module.exports = {
   listContacts,
   getContactById,
   createContact,
   updateContact,
   deleteContact,
   syncContactsFromSii,
   searchForSelect,
};
