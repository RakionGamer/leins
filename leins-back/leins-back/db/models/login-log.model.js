const { Model, DataTypes, Sequelize } = require('sequelize');
const LOGIN_LOG_TABLE = 'login_log';
const LoginLogSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.BIGINT },
  user_type: { allowNull: false, type: DataTypes.ENUM('super_admin', 'admin', 'user') },
  user_id: { allowNull: false, type: DataTypes.INTEGER },
  success: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  ip_address: { allowNull: true, type: DataTypes.STRING(45) },
  user_agent: { allowNull: true, type: DataTypes.STRING(512) },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};
class LoginLog extends Model {
  static associate() {}
  static config(sequelize) { return { sequelize, tableName: LOGIN_LOG_TABLE, modelName: 'LoginLog', timestamps: false }; }
}
module.exports = { LOGIN_LOG_TABLE, LoginLogSchema, LoginLog };

