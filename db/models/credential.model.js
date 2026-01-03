const { Model, DataTypes, Sequelize } = require('sequelize');
const CREDENTIAL_TABLE = 'credentials';
const CredentialSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  entity_id: { allowNull: true, type: DataTypes.INTEGER },
  user_id: { allowNull: true, type: DataTypes.INTEGER },
  type: { allowNull: false, type: DataTypes.ENUM('SII', 'BANK') },
  secret_encrypted: { allowNull: false, type: DataTypes.TEXT },
  created_by: { allowNull: false, type: DataTypes.INTEGER },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};
class Credential extends Model {
  static associate(models) {
    this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
    this.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
  }
  static config(sequelize) { return { sequelize, tableName: CREDENTIAL_TABLE, modelName: 'Credential', timestamps: false }; }
}
module.exports = { CREDENTIAL_TABLE, CredentialSchema, Credential };

