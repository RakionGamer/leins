'use strict';

const { REFRESH_TOKEN_USER_TABLE } = require('../db/models/refresh-token-user.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(REFRESH_TOKEN_USER_TABLE, {
         id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
         },
         user_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: { model: 'users', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
         },
         token_hash: {
            allowNull: false,
            type: Sequelize.CHAR(64),
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
         },
         replaced_by_token_id: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         revoked_at: {
            allowNull: true,
            type: Sequelize.DATE,
         },
         expires_at: {
            allowNull: false,
            type: Sequelize.DATE,
         },
         ip: {
            allowNull: true,
            type: Sequelize.STRING(45),
         },
         user_agent: {
            allowNull: true,
            type: Sequelize.STRING(255),
         },
         last_used_at: {
            allowNull: true,
            type: Sequelize.DATE,
         },
      });

      await queryInterface.addIndex(REFRESH_TOKEN_USER_TABLE, ['user_id', 'revoked_at'], {
         name: 'rtu_user_revoked_idx',
      });
      await queryInterface.addIndex(REFRESH_TOKEN_USER_TABLE, ['user_id', 'created_at'], {
         name: 'rtu_user_created_idx',
      });
      await queryInterface.addIndex(REFRESH_TOKEN_USER_TABLE, ['expires_at'], {
         name: 'rtu_expires_idx',
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable(REFRESH_TOKEN_USER_TABLE);
   },
};
