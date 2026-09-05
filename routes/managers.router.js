const express = require('express');
const boom = require('@hapi/boom');
const ManagerService = require('../services/manager.service');

const router = express.Router();
const service = new ManagerService();

// Ruta para obtener el perfil del manager logueado
router.get('/profile', async (req, res, next) => {
   try {
      const { sub: managerId } = req.user; // `sub` normalmente es el ID del usuario

      const manager = await service.findOne(managerId);
      if (!manager) {
         throw boom.notFound('Manager not found');
      }

      res.status(200).json({ data: manager });
   } catch (error) {
      next(error);
   }
});

// Ruta para obtener un estado especifico por ID
router.get('/:id', async (req, res, next) => {
   try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) {
         throw boom.badRequest('The id must be a number');
      }
      const state = await service.findOne(id);
      res.status(200).json({ data: state });
   } catch (error) {
      next(error);
   }
});

// cambiar tema del manager
router.patch('/theme', async (req, res, next) => {
   try {
      const { sub: managerId } = req.user; // ID del manager logueado
      const { theme } = req.body;

      if (!theme || !['light', 'dark'].includes(theme)) {
         throw boom.badRequest('Invalid theme value. Must be "light" or "dark".');
      }

      const updatedManager = await service.updateTheme(managerId, theme);
      if (!updatedManager) {
         throw boom.notFound('Manager not found');
      }

      res.status(200).json({ data: updatedManager });
   } catch (error) {
      next(error);
   }
});

module.exports = router;