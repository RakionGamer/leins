const { Model, DataTypes, Sequelize } = require('sequelize');
const ENTITY_BANK_ACCOUNT_TABLE = 'entity_bank_accounts';
const EntityBankAccountSchema = {
   id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   bank_name: { allowNull: false, type: DataTypes.STRING(120) },
   account_number: { allowNull: false, type: DataTypes.STRING(64) },
   currency: { allowNull: false, type: DataTypes.CHAR(3) },
   initial_balance: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   initial_balance_date: { allowNull: true, type: DataTypes.DATEONLY },
   createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
   updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
};
class EntityBankAccount extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
      this.hasMany(models.EntityBankTransaction, { as: 'transactions', foreignKey: 'entity_bank_account_id' });
   }
   static config(sequelize) { return { sequelize, tableName: ENTITY_BANK_ACCOUNT_TABLE, modelName: 'EntityBankAccount', timestamps: false }; }
}
module.exports = { ENTITY_BANK_ACCOUNT_TABLE, EntityBankAccountSchema, EntityBankAccount };