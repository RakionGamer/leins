"use strict";

const { Model, DataTypes } = require("sequelize");

const ACCOUNTING_RULE_TABLE = "accounting_counterparty_rules";

const AccountingRuleSchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   counterparty_rut: { allowNull: false, type: DataTypes.STRING(16) },
   counterparty_name: { allowNull: true, type: DataTypes.STRING(255) },
   account_id: { allowNull: false, type: DataTypes.INTEGER },
   cost_center: { allowNull: true, type: DataTypes.STRING(100) },
};

class AccountingRule extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: "entity", foreignKey: "entity_id" });
      this.belongsTo(models.AccountingAccount, { as: "account", foreignKey: "account_id" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ACCOUNTING_RULE_TABLE,
         modelName: "AccountingRule",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
      };
   }
}

module.exports = { ACCOUNTING_RULE_TABLE, AccountingRule, AccountingRuleSchema };
