const { Model, DataTypes } = require('sequelize');
const BANK_TRANSACTION_DOCUMENT_TABLE = 'bank_transaction_documents';
const BankTransactionDocumentSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  entity_bank_transaction_id: { allowNull: false, type: DataTypes.INTEGER },
  entity_sii_document_id: { allowNull: false, type: DataTypes.INTEGER },
  amount_applied: { allowNull: false, type: DataTypes.DECIMAL(15, 2) },
};
class BankTransactionDocument extends Model {
  static associate(models) {
    this.belongsTo(models.EntityBankTransaction, { as: 'tx', foreignKey: 'entity_bank_transaction_id' });
    this.belongsTo(models.EntitySiiDocument, { as: 'doc', foreignKey: 'entity_sii_document_id' });
  }
  static config(sequelize) { return { sequelize, tableName: BANK_TRANSACTION_DOCUMENT_TABLE, modelName: 'BankTransactionDocument', timestamps: false }; }
}
module.exports = { BANK_TRANSACTION_DOCUMENT_TABLE, BankTransactionDocumentSchema, BankTransactionDocument };

