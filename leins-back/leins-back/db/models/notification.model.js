const { Model, DataTypes } = require('sequelize');

const NOTIFICATION_TABLE = 'notifications';

class Notification extends Model {
   static config(sequelize) {
      return {
         sequelize,
         tableName: NOTIFICATION_TABLE,
         modelName: 'Notification',
         timestamps: true
      };
   }
}

const NotificationSchema = {
   id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
   userId: { field: 'user_id', allowNull: false, type: DataTypes.INTEGER },
   type: { allowNull: false, type: DataTypes.STRING },
   title: { allowNull: false, type: DataTypes.STRING },
   message: { allowNull: false, type: DataTypes.TEXT },
   isRead: { field: 'is_read', allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
   createdAt: { field: 'created_at', allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
   updatedAt: { field: 'updated_at', allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW }
};

module.exports = { Notification, NotificationSchema, NOTIFICATION_TABLE };