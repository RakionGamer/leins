const { Model, DataTypes, Sequelize } = require('sequelize');
const ACTIVITY_LOG_TABLE = 'activity_log';
const ActivityLogSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.BIGINT },
  actor_type: { allowNull: false, type: DataTypes.ENUM('super_admin', 'admin', 'user') },
  actor_id: { allowNull: false, type: DataTypes.INTEGER },
  entity_id: { allowNull: true, type: DataTypes.INTEGER },
  action: { allowNull: false, type: DataTypes.STRING(120) },
  details: { allowNull: true, type: DataTypes.JSON },
  ip_address: { allowNull: true, type: DataTypes.STRING(45) },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};
class ActivityLog extends Model {
  static associate(models) { this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' }); }
  static config(sequelize) { return { sequelize, tableName: ACTIVITY_LOG_TABLE, modelName: 'ActivityLog', timestamps: false }; }
}
module.exports = { ACTIVITY_LOG_TABLE, ActivityLogSchema, ActivityLog };

