"use strict";

const { Model, DataTypes } = require("sequelize");

const ACCOUNTING_COST_CENTER_TABLE = "accounting_cost_centers";

const AccountingCostCenterSchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   code: { allowNull: true, type: DataTypes.STRING(50) },
   name: { allowNull: false, type: DataTypes.STRING(100) },
   is_active: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: true },
};

class AccountingCostCenter extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: "entity", foreignKey: "entity_id" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ACCOUNTING_COST_CENTER_TABLE,
         modelName: "AccountingCostCenter",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
      };
   }
}

module.exports = {
   ACCOUNTING_COST_CENTER_TABLE,
   AccountingCostCenterSchema,
   AccountingCostCenter,
};
