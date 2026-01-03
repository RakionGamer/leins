// routes/super-admins.router.js
const express = require('express');
const boom = require('@hapi/boom');
const SuperAdminService = require('../services/super-admin.service');

const router = express.Router();
const service = new SuperAdminService();

// Registra un super admin
router.post('/', async (req, res, next) => {
   try {
      const {
         username,
         email,
         password,
         state_id,
         name,
         last_name,
         phone,
         avatar_url,
         theme,
         verified,
         two_factor_enabled
      } = req.body;

      // validaciones mínimas en el router
      if (!username || !email || !password) {
         throw boom.badRequest('username, email y password son obligatorios');
      }

      const created = await service.create({
         username,
         email,
         password,
         state_id,
         name,
         last_name,
         phone,
         avatar_url,
         theme,
         verified,
         two_factor_enabled
      });

      res.status(201).json({ data: created });
   } catch (error) {
      next(error);
   }
});

// Perfil del super admin logueado
router.get('/profile', async (req, res, next) => {
   try {
      const { sub: superAdminId } = req.user; // viene del JWT
      const superAdmin = await service.findOne(superAdminId);
      if (!superAdmin) throw boom.notFound('Super admin not found');
      res.status(200).json({ data: superAdmin });
   } catch (error) {
      next(error);
   }
});

// Obtener un super admin por ID
router.get('/:id', async (req, res, next) => {
   try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) throw boom.badRequest('The id must be a number');
      const superAdmin = await service.findOne(id);
      if (!superAdmin) throw boom.notFound('Super admin not found');
      res.status(200).json({ data: superAdmin });
   } catch (error) {
      next(error);
   }
});

// Cambiar tema del super admin logueado
router.patch('/theme', async (req, res, next) => {
   try {
      const { sub: superAdminId } = req.user;
      const { theme } = req.body;

      if (!theme || !['light', 'dark'].includes(theme)) {
         throw boom.badRequest('Invalid theme value. Must be "light" or "dark".');
      }

      const updated = await service.updateTheme(superAdminId, theme);
      if (!updated) throw boom.notFound('Super admin not found');

      res.status(200).json({ data: updated });

   } catch (error) {
      next(error);
   }
});

module.exports = router;