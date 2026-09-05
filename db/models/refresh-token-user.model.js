const { Model, DataTypes, Sequelize } = require('sequelize');
const REFRESH_TOKEN_USER_TABLE = 'refresh_tokens_users';
const RefreshTokenUserSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  user_id: { allowNull: false, type: DataTypes.INTEGER },
  token_hash: { allowNull: false, type: DataTypes.CHAR(64) },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  replaced_by_token_id: { allowNull: true, type: DataTypes.INTEGER },
  revoked_at: { allowNull: true, type: DataTypes.DATE },
  expires_at: { allowNull: false, type: DataTypes.DATE },
  ip: { allowNull: true, type: DataTypes.STRING(45) },
  user_agent: { allowNull: true, type: DataTypes.STRING(255) },
  last_used_at: { allowNull: true, type: DataTypes.DATE },
};
class RefreshTokenUser extends Model {
  static associate(models) {
    this.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
    this.belongsTo(RefreshTokenUser, { as: 'replaced_by_token', foreignKey: 'replaced_by_token_id' });
  }
  static config(sequelize) { return { sequelize, tableName: REFRESH_TOKEN_USER_TABLE, modelName: 'RefreshTokenUser', timestamps: false }; }
}
module.exports = { REFRESH_TOKEN_USER_TABLE, RefreshTokenUserSchema, RefreshTokenUser };
