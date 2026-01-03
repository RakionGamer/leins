const { Model, DataTypes, Sequelize } = require('sequelize');
const ERROR_LOG_TABLE = 'error_log';
const ErrorLogSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.BIGINT },
  level: { allowNull: false, type: DataTypes.ENUM('info', 'warning', 'error', 'critical') },
  message: { allowNull: false, type: DataTypes.TEXT },
  context: { allowNull: true, type: DataTypes.JSON },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};
class ErrorLog extends Model {
  static associate() {}
  static config(sequelize) { return { sequelize, tableName: ERROR_LOG_TABLE, modelName: 'ErrorLog', timestamps: false }; }
}
module.exports = { ERROR_LOG_TABLE, ErrorLogSchema, ErrorLog };

