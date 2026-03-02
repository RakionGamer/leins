const express = require('express');
const { uploadImage } = require('../middlewares/uploadImage');
const validatorHandler = require('../middlewares/validator.handler');
const superAdminController = require('../controllers/super-admin.controller');

const {
   createSuperAdminSchema,
   updateSuperAdminSchema,
   getSuperAdminSchema,
   deleteSuperAdminSchema,
   changePasswordSchema,
   changeStateSchema
} = require('../schemas/super-admin.schema');

const router = express.Router();

// ==========================================
//  creacion de usuarios
// ==========================================

// crear un nuevo super admin
router.post('/',
   validatorHandler(createSuperAdminSchema, 'body'),
   superAdminController.createSuperAdmin
);

// ==========================================
//  perfil y configuracion (usuario logueado)
// ==========================================

// obtener perfil del usuario actual (lectura)
router.get('/profile', superAdminController.getProfile);

// modifica contrasena
router.post('/change-password',
   validatorHandler(changePasswordSchema, 'body'),
   superAdminController.changePassword
);

// actualizar datos de texto del perfil
router.patch('/profile',
   validatorHandler(updateSuperAdminSchema, 'body'),
   superAdminController.updateProfile
);

// subir o actualizar avatar
router.post('/avatar',
   uploadImage.single('avatar'),
   superAdminController.uploadAvatar
);

// cambiar preferencia de tema
router.patch('/theme', superAdminController.changeTheme);

// ==========================================
//  gestion general (busquedas y edicion)
// ==========================================

// listar super admins (con paginacion y busqueda)
router.get('/', superAdminController.listSuperAdmins);

// obtener un super admin por id
router.get('/:id',
   validatorHandler(getSuperAdminSchema, 'params'),
   superAdminController.getSuperAdminById
);

// actualizar un super admin completo
router.patch('/:id',
   validatorHandler(getSuperAdminSchema, 'params'),
   validatorHandler(updateSuperAdminSchema, 'body'),
   superAdminController.updateSuperAdmin
);

// activar o desactivar usuario
router.patch('/:id/state',
   validatorHandler(getSuperAdminSchema, 'params'),
   validatorHandler(changeStateSchema, 'body'),
   superAdminController.changeSuperAdminState
);

// elimina un administrador
router.delete('/:id',
   validatorHandler(deleteSuperAdminSchema, 'params'),
   superAdminController.deleteSuperAdmin
);

module.exports = router;