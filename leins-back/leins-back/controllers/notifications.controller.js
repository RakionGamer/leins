const NotificationService = require('../services/notification.service');
const asyncHandler = require('../utils/helpers/asyncHandler');

const service = new NotificationService();

// controlador para obtener notificaciones no leidas
const getUnreadNotifications = asyncHandler(async (req, res) => {
   const userId = req.userId;
   const notifications = await service.findUnread(userId);

   res.json(notifications);
});

// controlador para marcar una notificacion como leida
const markNotificationAsRead = asyncHandler(async (req, res) => {
   const userId = req.userId;
   const { id } = req.params;
   const updated = await service.markAsRead(id, userId);

   res.json(updated);
});

module.exports = {
   getUnreadNotifications,
   markNotificationAsRead
};