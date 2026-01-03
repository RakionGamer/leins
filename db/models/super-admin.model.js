const { Model, DataTypes, Sequelize } = require('sequelize');
const SUPER_ADMIN_TABLE = 'super_admins';
const SuperAdminSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  username: { allowNull: false, type: DataTypes.STRING(60), unique: true },
  email: { allowNull: false, type: DataTypes.STRING(255), unique: true },
  verified: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  password_hash: { allowNull: false, type: DataTypes.STRING(255) },
  avatar_url: { allowNull: true, type: DataTypes.STRING(255) },
  name: { allowNull: true, type: DataTypes.STRING(255) },
  last_name: { allowNull: true, type: DataTypes.STRING(255) },
  two_factor_enabled: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
  last_login: { allowNull: true, type: DataTypes.DATE },
  phone: { allowNull: true, type: DataTypes.STRING(255) },
  theme: { allowNull: true, type: DataTypes.STRING(255) },
  state_id: { allowNull: false, type: DataTypes.INTEGER },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
  deletedAt: { allowNull: true, type: DataTypes.DATE, field: 'deleted_at' },
};
class SuperAdmin extends Model {
  static associate(models) {
    this.belongsTo(models.State, { as: 'state', foreignKey: 'state_id' });
    this.hasMany(models.Admin, { as: 'admins', foreignKey: 'super_admin_id' });
    this.hasMany(models.RefreshTokenSuperAdmin, { as: 'refresh_tokens', foreignKey: 'super_admin_id' });
  }
  static config(sequelize) { return { sequelize, tableName: SUPER_ADMIN_TABLE, modelName: 'SuperAdmin', timestamps: false }; }
}
module.exports = { SUPER_ADMIN_TABLE, SuperAdminSchema, SuperAdmin };

