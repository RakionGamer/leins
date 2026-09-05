const boom = require('@hapi/boom');
const { models } = require('../libs/sequelize'); // Usamos la instancia centralizada

class NotificationService {
   constructor() {}

   async create({ userId, type, title, message }) {
      try {
         // Verificación de seguridad por si el modelo no cargó
         if (!models.Notification) {
            console.error('ERROR CRÍTICO: El modelo Notification no está cargado en sequelize.models');
            return null;
         }

         const newNotif = await models.Notification.create({ userId, type, title, message });
         return newNotif;
      } catch (error) {
         console.error('[NotificationService] Create Error:', error);
         // No lanzamos error boom aquí para no romper el proceso background, solo logueamos
         return null;
      }
   }

   async findUnread(userId) {
      if (!models.Notification) return [];
      return await models.Notification.findAll({
         where: { userId, isRead: false },
         order: [['created_at', 'DESC']]
      });
   }

   async markAsRead(id, userId) {
      if (!models.Notification) return null;
      const notif = await models.Notification.findOne({ where: { id, userId } });
      if (notif) {
         notif.isRead = true;
         await notif.save();
      }
      return notif;
   }
}

module.exports = NotificationService;