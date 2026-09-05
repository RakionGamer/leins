const { Model, DataTypes, Sequelize } = require('sequelize');
const ADMIN_ENTITY_TABLE = 'admin_entities';
const AdminEntitySchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  admin_id: { allowNull: false, type: DataTypes.INTEGER },
  entity_id: { allowNull: false, type: DataTypes.INTEGER },
  can_create: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  can_update: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  can_delete: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  is_admin: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};
class AdminEntity extends Model {
  static associate(models) {
    this.belongsTo(models.Admin, { as: 'admin', foreignKey: 'admin_id' });
    this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
  }
  static config(sequelize) { return { sequelize, tableName: ADMIN_ENTITY_TABLE, modelName: 'AdminEntity', timestamps: false }; }
}
module.exports = { ADMIN_ENTITY_TABLE, AdminEntitySchema, AdminEntity };

