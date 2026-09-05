const express = require('express');
const { jwtValidate } = require('../middlewares/auth.handler');
const notificationsController = require('../controllers/notifications.controller');

const router = express.Router();

// protegemos todas las rutas
router.use(jwtValidate);

// rutas mapeadas a sus controladores
router.get('/unread', notificationsController.getUnreadNotifications);
router.patch('/:id/read', notificationsController.markNotificationAsRead);

module.exports = router;