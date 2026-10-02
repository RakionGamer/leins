"use strict";

const { ACCOUNTING_ACCOUNT_TABLE } = require("../db/models/accounting-account.model");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.addColumn(ACCOUNTING_ACCOUNT_TABLE, "is_title", {
         type: Sequelize.BOOLEAN,
         allowNull: false,
         defaultValue: false,
      });
   },

   async down(queryInterface, Sequelize) {
      await queryInterface.removeColumn(ACCOUNTING_ACCOUNT_TABLE, "is_title");
   },
};
