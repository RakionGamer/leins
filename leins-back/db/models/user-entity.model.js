const { Model, DataTypes, Sequelize } = require('sequelize');
const USER_ENTITY_TABLE = 'user_entities';
const UserEntitySchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  user_id: { allowNull: false, type: DataTypes.INTEGER },
  entity_id: { allowNull: false, type: DataTypes.INTEGER },
  read_only: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: true },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};
class UserEntity extends Model {
  static associate(models) {
    this.belongsTo(models.User, { as: 'user', foreignKey: 'user_id' });
    this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
  }
  static config(sequelize) { return { sequelize, tableName: USER_ENTITY_TABLE, modelName: 'UserEntity', timestamps: false }; }
}
module.exports = { USER_ENTITY_TABLE, UserEntitySchema, UserEntity };

