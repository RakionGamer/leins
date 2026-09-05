const { Model, DataTypes, Sequelize } = require('sequelize');
const ADMIN_TABLE = 'admins';
const AdminSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  super_admin_id: { allowNull: false, type: DataTypes.INTEGER },
  username: { allowNull: false, type: DataTypes.STRING(60), unique: true },
  email: { allowNull: false, type: DataTypes.STRING(255), unique: true },
  password_hash: { allowNull: false, type: DataTypes.STRING(255) },
  state_id: { allowNull: false, type: DataTypes.INTEGER },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
  deletedAt: { allowNull: true, type: DataTypes.DATE, field: 'deleted_at' },
};
class Admin extends Model {
  static associate(models) {
    this.belongsTo(models.State, { as: 'state', foreignKey: 'state_id' });
    this.belongsTo(models.SuperAdmin, { as: 'super_admin', foreignKey: 'super_admin_id' });
    this.belongsToMany(models.Entity, { as: 'entities', through: models.AdminEntity, foreignKey: 'admin_id', otherKey: 'entity_id' });
  }
  static config(sequelize) { return { sequelize, tableName: ADMIN_TABLE, modelName: 'Admin', timestamps: false }; }
}
module.exports = { ADMIN_TABLE, AdminSchema, Admin };

