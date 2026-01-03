const { Model, DataTypes, Sequelize } = require('sequelize');
const ENTITY_TABLE = 'entities';
const EntitySchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  legal_name: { allowNull: false, type: DataTypes.STRING(255), unique: true },
  tax_id: { allowNull: false, type: DataTypes.STRING(20), unique: true },
  state_id: { allowNull: false, type: DataTypes.INTEGER },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
};
class Entity extends Model {
  static associate(models) {
    this.belongsTo(models.State, { as: 'state', foreignKey: 'state_id' });
    this.hasMany(models.EntityBankAccount, { as: 'bank_accounts', foreignKey: 'entity_id' });
    this.hasMany(models.EntitySiiDocument, { as: 'sii_documents', foreignKey: 'entity_id' });
    this.hasMany(models.EntityBankTransaction, { as: 'bank_transactions', foreignKey: 'entity_id' });
    this.hasMany(models.EntityCashFlowProjection, { as: 'cash_flow_projections', foreignKey: 'entity_id' });
    this.hasMany(models.Credential, { as: 'credentials', foreignKey: 'entity_id' });
    this.hasMany(models.EntityModule, { as: 'entity_modules', foreignKey: 'entity_id' });
    this.belongsToMany(models.Admin, { as: 'admins', through: models.AdminEntity, foreignKey: 'entity_id', otherKey: 'admin_id' });
    this.belongsToMany(models.User, { as: 'users', through: models.UserEntity, foreignKey: 'entity_id', otherKey: 'user_id' });
  }
  static config(sequelize) { return { sequelize, tableName: ENTITY_TABLE, modelName: 'Entity', timestamps: false }; }
}
module.exports = { ENTITY_TABLE, EntitySchema, Entity };

