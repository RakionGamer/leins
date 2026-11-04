"use strict";

const { ACCOUNTING_ACCOUNT_TABLE } = require("../db/models/accounting-account.model");
const { DataTypes } = require("sequelize");

module.exports = {
   async up(queryInterface) {
      const tableDesc = await queryInterface.describeTable(ACCOUNTING_ACCOUNT_TABLE).catch(() => ({}));
      if (!tableDesc.default_cost_center) {
         await queryInterface.addColumn(ACCOUNTING_ACCOUNT_TABLE, "default_cost_center", {
            type: DataTypes.STRING(100),
            allowNull: true,
         });
      }
   },

   async down(queryInterface) {
      const tableDesc = await queryInterface.describeTable(ACCOUNTING_ACCOUNT_TABLE).catch(() => ({}));
      if (tableDesc.default_cost_center) {
         await queryInterface.removeColumn(ACCOUNTING_ACCOUNT_TABLE, "default_cost_center");
      }
   },
};
