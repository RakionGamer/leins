const { Model, DataTypes, Sequelize } = require('sequelize');
const ENTITY_CASH_FLOW_PROJECTION_TABLE = 'entity_cash_flow_projections';
const EntityCashFlowProjectionSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  entity_id: { allowNull: false, type: DataTypes.INTEGER },
  projected_date: { allowNull: false, type: DataTypes.DATEONLY },
  description: { allowNull: true, type: DataTypes.STRING(255) },
  amount: { allowNull: false, type: DataTypes.DECIMAL(15, 2) },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
};
class EntityCashFlowProjection extends Model {
  static associate(models) { this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' }); }
  static config(sequelize) { return { sequelize, tableName: ENTITY_CASH_FLOW_PROJECTION_TABLE, modelName: 'EntityCashFlowProjection', timestamps: false }; }
}
module.exports = { ENTITY_CASH_FLOW_PROJECTION_TABLE, EntityCashFlowProjectionSchema, EntityCashFlowProjection };

