// db/models/entity-bank-sync-usage.model.js
'use strict';

const { Model, DataTypes, Sequelize } = require('sequelize');

const ENTITY_BANK_SYNC_USAGE_TABLE = 'entity_bank_sync_usage';

const EntityBankSyncUsageSchema = {
   id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: DataTypes.INTEGER,
   },
   entity_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
   },
   period: {
      allowNull: false,
      type: DataTypes.CHAR(7),
   },
   manual_sync_count: {
      allowNull: false,
      type: DataTypes.INTEGER,
      defaultValue: 0,
   },
   last_manual_sync_at: {
      allowNull: true,
      type: DataTypes.DATE,
   },
   last_sync_account_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
   },
   createdAt: {
      allowNull: false,
      type: DataTypes.DATE,
      field: 'created_at',
      defaultValue: Sequelize.NOW,
   },
   updatedAt: {
      allowNull: true,
      type: DataTypes.DATE,
      field: 'updated_at',
   },
};

class EntityBankSyncUsage extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ENTITY_BANK_SYNC_USAGE_TABLE,
         modelName: 'EntityBankSyncUsage',
         timestamps: true,
         createdAt: 'created_at',
         updatedAt: 'updated_at',
      };
   }
}

module.exports = {
   ENTITY_BANK_SYNC_USAGE_TABLE,
   EntityBankSyncUsageSchema,
   EntityBankSyncUsage,
};
