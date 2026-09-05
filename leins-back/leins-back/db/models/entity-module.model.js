const { Model, DataTypes, Sequelize } = require('sequelize');
const ENTITY_MODULE_TABLE = 'entity_modules';
const EntityModuleSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  entity_id: { allowNull: false, type: DataTypes.INTEGER },
  module_code: { allowNull: false, type: DataTypes.STRING(64) },
  enabledAt: { allowNull: false, type: DataTypes.DATE, field: 'enabled_at', defaultValue: Sequelize.NOW },
};
class EntityModule extends Model {
  static associate(models) { this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' }); }
  static config(sequelize) { return { sequelize, tableName: ENTITY_MODULE_TABLE, modelName: 'EntityModule', timestamps: false }; }
}
module.exports = { ENTITY_MODULE_TABLE, EntityModuleSchema, EntityModule };

