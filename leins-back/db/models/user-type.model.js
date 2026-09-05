const { Model, DataTypes } = require('sequelize');
const USER_TYPE_TABLE = 'user_types';
const UserTypeSchema = {
  id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
  code: { allowNull: false, type: DataTypes.STRING(64), unique: true },
  name: { allowNull: false, type: DataTypes.STRING(128) },
};
class UserType extends Model {
  static associate(models) { this.hasMany(models.User, { as: 'users', foreignKey: 'user_type_id' }); }
  static config(sequelize) { return { sequelize, tableName: USER_TYPE_TABLE, modelName: 'UserType', timestamps: false }; }
}
module.exports = { USER_TYPE_TABLE, UserTypeSchema, UserType };

