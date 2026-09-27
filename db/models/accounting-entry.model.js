"use strict";

const { Model, DataTypes } = require("sequelize");

const ACCOUNTING_ENTRY_TABLE = "accounting_entries";

const AccountingEntrySchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   entry_number: { allowNull: true, type: DataTypes.INTEGER },
   entry_date: { allowNull: false, type: DataTypes.DATEONLY },
   concept: { allowNull: false, type: DataTypes.STRING(500) },
   source_type: {
      allowNull: false,
      type: DataTypes.ENUM("MANUAL", "SII_PURCHASE", "SII_SALE", "BANK_MOVEMENT", "OTHER"),
      defaultValue: "MANUAL",
   },
   source_id: { allowNull: true, type: DataTypes.INTEGER },
   status: {
      allowNull: false,
      type: DataTypes.ENUM("POSTED", "ANNULLED"),
      defaultValue: "POSTED",
   },
   total_debit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   total_credit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
};

class AccountingEntry extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: "entity", foreignKey: "entity_id" });
      this.hasMany(models.AccountingEntryItem, { as: "items", foreignKey: "entry_id" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ACCOUNTING_ENTRY_TABLE,
         modelName: "AccountingEntry",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
      };
   }
}

module.exports = { ACCOUNTING_ENTRY_TABLE, AccountingEntry, AccountingEntrySchema };
