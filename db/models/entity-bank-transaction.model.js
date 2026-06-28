const { Model, DataTypes, Sequelize } = require('sequelize');
const ENTITY_BANK_TRANSACTION_TABLE = 'entity_bank_transactions';
const EntityBankTransactionSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  entity_id: { allowNull: false, type: DataTypes.INTEGER },
  entity_bank_account_id: { allowNull: false, type: DataTypes.INTEGER },
  type: { allowNull: false, type: DataTypes.ENUM('income', 'expense') },
  amount: { allowNull: false, type: DataTypes.DECIMAL(15, 2) },
  description: { allowNull: true, type: DataTypes.STRING(500) },
  issued_at: { allowNull: false, type: DataTypes.DATE },
  sii_document_id: { allowNull: true, type: DataTypes.INTEGER },
  balance: { type: DataTypes.DECIMAL(18,2), allowNull: true },
  document_ref: { type: DataTypes.STRING(100), allowNull: true },
  branch: { type: DataTypes.STRING(120), allowNull: true },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
};
class EntityBankTransaction extends Model {
  static associate(models) {
    this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
    this.belongsTo(models.EntityBankAccount, { as: 'bank_account', foreignKey: 'entity_bank_account_id' });
    this.belongsTo(models.EntitySiiDocument, { as: 'sii_document', foreignKey: 'sii_document_id' });
    this.belongsToMany(models.EntitySiiDocument, { as: 'documents', through: models.BankTransactionDocument, foreignKey: 'entity_bank_transaction_id', otherKey: 'entity_sii_document_id' });
  }
  static config(sequelize) { return { sequelize, tableName: ENTITY_BANK_TRANSACTION_TABLE, modelName: 'EntityBankTransaction', timestamps: false }; }
}
module.exports = { ENTITY_BANK_TRANSACTION_TABLE, EntityBankTransactionSchema, EntityBankTransaction };
