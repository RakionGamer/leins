const { Model, DataTypes } = require('sequelize');

const BANK_TRANSACTION_MATCH_TABLE = 'bank_transaction_matches';

const BankTransactionMatchSchema = {
   id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
   source_bank_transaction_id: { allowNull: false, type: DataTypes.INTEGER },
   target_bank_transaction_id: { allowNull: false, type: DataTypes.INTEGER },
   amount_applied: { allowNull: false, type: DataTypes.DECIMAL(15, 2) },
   method: { allowNull: false, type: DataTypes.STRING(32), defaultValue: 'manual' },
   created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: DataTypes.NOW },
};

class BankTransactionMatch extends Model {
   static associate(models) {
      this.belongsTo(models.EntityBankTransaction, { as: 'sourceTx', foreignKey: 'source_bank_transaction_id' });
      this.belongsTo(models.EntityBankTransaction, { as: 'targetTx', foreignKey: 'target_bank_transaction_id' });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: BANK_TRANSACTION_MATCH_TABLE,
         modelName: 'BankTransactionMatch',
         timestamps: false,
      };
   }
}

module.exports = { BANK_TRANSACTION_MATCH_TABLE, BankTransactionMatchSchema, BankTransactionMatch };
