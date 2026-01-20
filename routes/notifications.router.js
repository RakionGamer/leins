const express = require('express');
const { jwtValidate } = require('../middlewares/auth.handler');
const NotificationService = require('../services/notification.service');

const router = express.Router();
const service = new NotificationService();

// protegemos todas las rutas de notificaciones con tu token
router.use(jwtValidate);

// get /api/v1/notifications/unread
router.get('/unread', async (req, res, next) => {
   try {
      // jwtvalidate inyecta el userId en req
      const userId = req.userId;
      const notifications = await service.findUnread(userId);
      res.json(notifications);
   } catch (error) {
      next(error);
   }
});

// patch /api/v1/notifications/:id/read
router.patch('/:id/read', async (req, res, next) => {
   try {
      const userId = req.userId;
      const { id } = req.params;
      const updated = await service.markAsRead(id, userId);
      res.json(updated);
   } catch (error) {
      next(error);
   }
});

module.exports = router;