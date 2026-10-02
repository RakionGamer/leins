"use strict";

const { Model, DataTypes } = require("sequelize");

const ACCOUNTING_ACCOUNT_TABLE = "accounting_accounts";

const AccountingAccountSchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   code: { allowNull: false, type: DataTypes.STRING(30) },
   name: { allowNull: false, type: DataTypes.STRING(255) },
   type: {
      allowNull: false,
      type: DataTypes.ENUM("ACTIVO", "PASIVO", "PATRIMONIO", "INGRESOS", "COSTOS", "GASTOS"),
   },
   nature: {
      allowNull: false,
      type: DataTypes.ENUM("DEUDORA", "ACREEDORA"),
   },
   cost_center_requirement: {
      allowNull: false,
      type: DataTypes.ENUM("NONE", "OPTIONAL", "REQUIRED"),
      defaultValue: "NONE",
   },
   is_active: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: true },
   is_system: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
   require_rut: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
   require_reference: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
   is_auxiliary: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
   cash_flow_classification: {
      allowNull: false,
      type: DataTypes.ENUM("OPERACIONAL", "INVERSION", "FINANCIAMIENTO", "NONE"),
      defaultValue: "NONE",
   },
   is_title: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
};

class AccountingAccount extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: "entity", foreignKey: "entity_id" });
      this.hasMany(models.AccountingRule, { as: "rules", foreignKey: "account_id" });
      this.hasMany(models.AccountingEntryItem, { as: "entryItems", foreignKey: "account_id" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ACCOUNTING_ACCOUNT_TABLE,
         modelName: "AccountingAccount",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
      };
   }
}

module.exports = { ACCOUNTING_ACCOUNT_TABLE, AccountingAccount, AccountingAccountSchema };
