const { Model, DataTypes, Sequelize } = require('sequelize');

const SII_SYNC_JOB_TABLE = 'sii_sync_jobs';

const SiiSyncJobSchema = {
   id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   requested_by: { allowNull: true, type: DataTypes.INTEGER },
   sync_type: { allowNull: false, type: DataTypes.STRING(64) },
   period_year: { allowNull: false, type: DataTypes.INTEGER },
   period_month: { allowNull: true, type: DataTypes.TINYINT },
   status: { allowNull: false, type: DataTypes.ENUM('pending', 'running', 'success', 'failed'), defaultValue: 'pending' },
   started_at: { allowNull: true, type: DataTypes.DATE },
   finished_at: { allowNull: true, type: DataTypes.DATE },
   download_path: { allowNull: true, type: DataTypes.STRING(512) },
   rows_read: { allowNull: false, type: DataTypes.INTEGER, defaultValue: 0 },
   rows_processed: { allowNull: false, type: DataTypes.INTEGER, defaultValue: 0 },
   rows_inserted: { allowNull: false, type: DataTypes.INTEGER, defaultValue: 0 },
   rows_updated: { allowNull: false, type: DataTypes.INTEGER, defaultValue: 0 },
   rows_skipped: { allowNull: false, type: DataTypes.INTEGER, defaultValue: 0 },
   skip_reasons_json: { allowNull: true, type: DataTypes.JSON },
   error_message: { allowNull: true, type: DataTypes.TEXT },
   createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
   updatedAt: { allowNull: false, type: DataTypes.DATE, field: 'updated_at', defaultValue: Sequelize.NOW },
};

class SiiSyncJob extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
      this.belongsTo(models.SuperAdmin, { as: 'requester', foreignKey: 'requested_by' });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: SII_SYNC_JOB_TABLE,
         modelName: 'SiiSyncJob',
         timestamps: true,
         createdAt: 'created_at',
         updatedAt: 'updated_at',
      };
   }
}

module.exports = { SII_SYNC_JOB_TABLE, SiiSyncJobSchema, SiiSyncJob };
