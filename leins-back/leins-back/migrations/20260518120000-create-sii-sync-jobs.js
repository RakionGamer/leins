'use strict';

const { SII_SYNC_JOB_TABLE } = require('../db/models/sii-sync-job.model');

module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(SII_SYNC_JOB_TABLE, {
         id: {
            allowNull: false,
            autoIncrement: true,
            primaryKey: true,
            type: Sequelize.INTEGER,
         },
         entity_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: { model: 'entities', key: 'id' },
            onUpdate: 'CASCADE',
            onDelete: 'RESTRICT',
         },
         requested_by: {
            allowNull: true,
            type: Sequelize.INTEGER,
         },
         sync_type: {
            allowNull: false,
            type: Sequelize.STRING(64),
         },
         period_year: {
            allowNull: false,
            type: Sequelize.INTEGER,
         },
         period_month: {
            allowNull: true,
            type: Sequelize.TINYINT,
         },
         status: {
            allowNull: false,
            type: Sequelize.ENUM('pending', 'running', 'success', 'failed'),
            defaultValue: 'pending',
         },
         started_at: {
            allowNull: true,
            type: Sequelize.DATE,
         },
         finished_at: {
            allowNull: true,
            type: Sequelize.DATE,
         },
         download_path: {
            allowNull: true,
            type: Sequelize.STRING(512),
         },
         rows_read: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 0,
         },
         rows_processed: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 0,
         },
         rows_inserted: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 0,
         },
         rows_updated: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 0,
         },
         rows_skipped: {
            allowNull: false,
            type: Sequelize.INTEGER,
            defaultValue: 0,
         },
         skip_reasons_json: {
            allowNull: true,
            type: Sequelize.JSON,
         },
         error_message: {
            allowNull: true,
            type: Sequelize.TEXT,
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
         },
         updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.NOW,
         },
      });

      await queryInterface.addIndex(SII_SYNC_JOB_TABLE, ['entity_id', 'created_at'], {
         name: 'idx_sii_sync_jobs_entity_created',
      });
      await queryInterface.addIndex(SII_SYNC_JOB_TABLE, ['entity_id', 'status'], {
         name: 'idx_sii_sync_jobs_entity_status',
      });
      await queryInterface.addIndex(SII_SYNC_JOB_TABLE, ['sync_type', 'period_year', 'period_month'], {
         name: 'idx_sii_sync_jobs_type_period',
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable(SII_SYNC_JOB_TABLE);
      await queryInterface.sequelize.query('DROP TYPE IF EXISTS enum_sii_sync_jobs_status').catch(() => {});
   },
};
