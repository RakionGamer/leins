const { Model, DataTypes, Sequelize } = require('sequelize');
const REFRESH_TOKEN_SUPER_ADMIN_TABLE = 'refresh_tokens_super_admins';
const RefreshTokenSuperAdminSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  super_admin_id: { allowNull: false, type: DataTypes.INTEGER },
  token_hash: { allowNull: false, type: DataTypes.CHAR(64) },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  replaced_by_token_id: { allowNull: true, type: DataTypes.INTEGER },
  revoked_at: { allowNull: true, type: DataTypes.DATE },
  expires_at: { allowNull: false, type: DataTypes.DATE },
};
class RefreshTokenSuperAdmin extends Model {
  static associate(models) {
    this.belongsTo(models.SuperAdmin, { as: 'super_admin', foreignKey: 'super_admin_id' });
    this.belongsTo(RefreshTokenSuperAdmin, { as: 'replaced_by_token', foreignKey: 'replaced_by_token_id' });
  }
  static config(sequelize) { return { sequelize, tableName: REFRESH_TOKEN_SUPER_ADMIN_TABLE, modelName: 'RefreshTokenSuperAdmin', timestamps: false }; }
}
module.exports = { REFRESH_TOKEN_SUPER_ADMIN_TABLE, RefreshTokenSuperAdminSchema, RefreshTokenSuperAdmin };

