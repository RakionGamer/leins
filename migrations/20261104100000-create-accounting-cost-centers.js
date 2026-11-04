'use strict';

const { ACCOUNTING_COST_CENTER_TABLE } = require('../db/models/accounting-cost-center.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(ACCOUNTING_COST_CENTER_TABLE, {
         id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
         },
         entity_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
         },
         code: {
            allowNull: true,
            type: Sequelize.STRING(50),
         },
         name: {
            allowNull: false,
            type: Sequelize.STRING(100),
         },
         is_active: {
            allowNull: false,
            type: Sequelize.BOOLEAN,
            defaultValue: true,
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
         },
         updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
         },
      });

      await queryInterface.addIndex(ACCOUNTING_COST_CENTER_TABLE, ['entity_id', 'name'], {
         name: 'idx_cost_center_entity_name',
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable(ACCOUNTING_COST_CENTER_TABLE);
   },
};
