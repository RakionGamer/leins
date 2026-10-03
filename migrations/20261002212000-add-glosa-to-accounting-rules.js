"use strict";

const { ACCOUNTING_RULE_TABLE } = require("../db/models/accounting-rule.model");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.addColumn(ACCOUNTING_RULE_TABLE, "glosa", {
         type: Sequelize.STRING(255),
         allowNull: true,
      });
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.removeColumn(ACCOUNTING_RULE_TABLE, "glosa");
   },
};
