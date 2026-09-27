"use strict";

const { Model, DataTypes } = require("sequelize");

const ACCOUNTING_ENTRY_ITEM_TABLE = "accounting_entry_items";

const AccountingEntryItemSchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
   entry_id: { allowNull: false, type: DataTypes.INTEGER },
   account_id: { allowNull: false, type: DataTypes.INTEGER },
   description: { allowNull: true, type: DataTypes.STRING(255) },
   debit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   credit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   counterparty_rut: { allowNull: true, type: DataTypes.STRING(16) },
   counterparty_name: { allowNull: true, type: DataTypes.STRING(255) },
   cost_center: { allowNull: true, type: DataTypes.STRING(100) },
};

class AccountingEntryItem extends Model {
   static associate(models) {
      this.belongsTo(models.AccountingEntry, { as: "entry", foreignKey: "entry_id" });
      this.belongsTo(models.AccountingAccount, { as: "account", foreignKey: "account_id" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ACCOUNTING_ENTRY_ITEM_TABLE,
         modelName: "AccountingEntryItem",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
      };
   }
}

module.exports = { ACCOUNTING_ENTRY_ITEM_TABLE, AccountingEntryItem, AccountingEntryItemSchema };
