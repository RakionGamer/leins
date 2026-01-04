const express = require('express');
const boom = require('@hapi/boom');
const SuperAdminService = require('../services/super-admin.service');
const { uploadImage } = require('../middlewares/uploadImage');
const { logInfo } = require('../utils/logger');

// imports de validacion
const validatorHandler = require('../middlewares/validator.handler');
const {
   createSuperAdminSchema,
   updateSuperAdminSchema,
   getSuperAdminSchema,
   changePasswordSchema
} = require('../schemas/super-admin.schema');

const router = express.Router();
const service = new SuperAdminService();

// ==========================================
//  creacion de usuarios
// ==========================================

// crear un nuevo super admin
router.post('/',
   validatorHandler(createSuperAdminSchema, 'body'),
   async (req, res, next) => {
      try {
         const body = req.body;
         const created = await service.create(body);

         // log de auditoria: creacion de usuario
         logInfo('USER_CREATED', {
            rid: req.rid,
            newUserId: created.id,
            email: created.email,
            ip: req.ip
         });

         res.status(201).json({ data: created });
      } catch (error) {
         next(error);
      }
   }
);

// ==========================================
//  perfil y configuracion (usuario logueado)
// ==========================================

// obtener perfil del usuario actual (lectura)
router.get('/profile', async (req, res, next) => {
   try {
      const { sub: superAdminId } = req.user;
      const superAdmin = await service.findOne(superAdminId);

      if (!superAdmin) throw boom.notFound('super admin not found');

      res.status(200).json({ data: superAdmin });
   } catch (error) {
      next(error);
   }
});

// modifica contrasena
router.post('/change-password',
   validatorHandler(changePasswordSchema, 'body'),
   async (req, res, next) => {
      try {
         const { sub: superAdminId } = req.user;
         const { oldPassword, newPassword } = req.body;
         const result = await service.changePassword(superAdminId, oldPassword, newPassword);
         res.status(200).json(result);
      } catch (error) {
         next(error);
      }
   }
);

// actualizar datos de texto del perfil
router.post('/profile',
   validatorHandler(updateSuperAdminSchema, 'body'),
   async (req, res, next) => {
      try {
         const { sub: id } = req.user;
         const changes = req.body;

         const updated = await service.update(id, changes);

         // log de auditoria: modificacion de perfil
         logInfo('USER_PROFILE_UPDATED', {
            rid: req.rid,
            userId: id,
            changes: Object.keys(changes)
         });

         res.status(200).json({ message: 'perfil actualizado', data: updated });
      } catch (error) {
         next(error);
      }
   }
);

// subir o actualizar avatar
router.post('/avatar', uploadImage.single('avatar'), async (req, res, next) => {
   try {
      if (!req.file) throw boom.badRequest('no se ha subido ninguna imagen');

      const { sub: superAdminId } = req.user;
      const protocol = req.protocol;
      const host = req.get('host');

      const avatarUrl = `${protocol}://${host}/avatars/${req.file.filename}`;

      const updated = await service.update(superAdminId, { avatar_url: avatarUrl });

      // log de auditoria: cambio de imagen
      logInfo('USER_AVATAR_UPDATED', {
         rid: req.rid,
         userId: superAdminId,
         filename: req.file.filename
      });

      res.status(200).json({ message: 'avatar actualizado', data: { avatar_url: avatarUrl } });
   } catch (error) {
      next(error);
   }
});

// cambiar preferencia de tema
router.patch('/theme',
   async (req, res, next) => {
      try {
         const { sub: superAdminId } = req.user;
         const { theme } = req.body;

         if (!theme || !['light', 'dark'].includes(theme)) {
            throw boom.badRequest('invalid theme value.');
         }

         const updated = await service.updateTheme(superAdminId, theme);

         if (!updated) throw boom.notFound('super admin not found');

         res.status(200).json({ data: updated });
      } catch (error) {
         next(error);
      }
   }
);

// ==========================================
//  gestion general (busquedas)
// ==========================================

// obtener un super admin por id
router.get('/:id',
   validatorHandler(getSuperAdminSchema, 'params'),
   async (req, res, next) => {
      try {
         const { id } = req.params;
         const superAdmin = await service.findOne(id);

         if (!superAdmin) throw boom.notFound('super admin not found');

         res.status(200).json({ data: superAdmin });
      } catch (error) {
         next(error);
      }
   }
);

module.exports = router;