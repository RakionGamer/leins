const { Model, DataTypes, Sequelize } = require('sequelize');
const USER_TABLE = 'users';
const UserSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  user_type_id: { allowNull: true, type: DataTypes.INTEGER },
  username: { allowNull: false, type: DataTypes.STRING(60), unique: true },
  email: { allowNull: false, type: DataTypes.STRING(255), unique: true },
  password_hash: { allowNull: false, type: DataTypes.STRING(255) },
  state_id: { allowNull: false, type: DataTypes.INTEGER },
  createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
  updatedAt: { allowNull: true, type: DataTypes.DATE, field: 'updated_at' },
  deletedAt: { allowNull: true, type: DataTypes.DATE, field: 'deleted_at' },
};
class User extends Model {
  static associate(models) {
    this.belongsTo(models.State, { as: 'state', foreignKey: 'state_id' });
    this.belongsTo(models.UserType, { as: 'type', foreignKey: 'user_type_id' });
    this.belongsToMany(models.Entity, { as: 'entities', through: models.UserEntity, foreignKey: 'user_id', otherKey: 'entity_id' });
    this.hasMany(models.Credential, { as: 'credentials', foreignKey: 'user_id' });
  }
  static config(sequelize) { return { sequelize, tableName: USER_TABLE, modelName: 'User', timestamps: false }; }
}
module.exports = { USER_TABLE, UserSchema, User };

