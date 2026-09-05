const { Model, DataTypes, Sequelize } = require('sequelize');
const SII_DOCUMENT_TYPE_TABLE = 'sii_document_types';

const SiiDocumentTypeSchema = {
   code: { allowNull: false, primaryKey: true, type: DataTypes.INTEGER },
   slug: { allowNull: false, unique: true, type: DataTypes.STRING(64) },
   name: { allowNull: false, type: DataTypes.STRING(128) },
   createdAt: { allowNull: false, type: DataTypes.DATE, field: 'created_at', defaultValue: Sequelize.NOW },
};

class SiiDocumentType extends Model {
   static associate(models) {
      this.hasMany(models.EntitySiiDocument, { as: 'documents', foreignKey: 'doc_type_code', sourceKey: 'code' });
   }
   static config(sequelize) {
      return { sequelize, tableName: SII_DOCUMENT_TYPE_TABLE, modelName: 'SiiDocumentType', timestamps: false };
   }
}

module.exports = { SII_DOCUMENT_TYPE_TABLE, SiiDocumentTypeSchema, SiiDocumentType };