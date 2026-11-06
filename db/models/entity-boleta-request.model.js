// models/entity-boleta-request.model.js
'use strict';

const { Model, DataTypes, Sequelize } = require('sequelize');

const ENTITY_BOLETA_REQUEST_TABLE = 'entity_boleta_requests';

const EntityBoletaRequestSchema = {
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
   bank_transaction_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
   },
   amount: {
      allowNull: false,
      type: DataTypes.DECIMAL(15, 2),
   },
   net_amount: {
      allowNull: true,
      type: DataTypes.DECIMAL(15, 2),
   },
   vat_amount: {
      allowNull: true,
      type: DataTypes.DECIMAL(15, 2),
   },
   description: {
      allowNull: true,
      type: DataTypes.STRING(500),
   },
   customer_rut: {
      allowNull: true,
      type: DataTypes.STRING(20),
   },
   customer_name: {
      allowNull: true,
      type: DataTypes.STRING(255),
   },
   is_exempt: {
      allowNull: false,
      type: DataTypes.BOOLEAN,
      defaultValue: true,
   },
   doc_type_code: {
      allowNull: false,
      type: DataTypes.INTEGER,
      defaultValue: 41, // 41 = Boleta Exenta, 39 = Boleta Afecta
   },
   status: {
      allowNull: false,
      type: DataTypes.STRING(30),
      defaultValue: 'pending', // 'pending', 'processing', 'completed', 'failed', 'posiblemente_emitida', 'cancelled'
   },
   folio: {
      allowNull: true,
      type: DataTypes.INTEGER,
   },
   pdf_path: {
      allowNull: true,
      type: DataTypes.STRING(255),
   },
   pdf_filename: {
      allowNull: true,
      type: DataTypes.STRING(255),
   },
   sii_document_id: {
      allowNull: true,
      type: DataTypes.INTEGER,
   },
   error_message: {
      allowNull: true,
      type: DataTypes.TEXT,
   },
   created_by: {
      allowNull: true,
      type: DataTypes.INTEGER,
   },
   completed_at: {
      allowNull: true,
      type: DataTypes.DATE,
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

class EntityBoletaRequest extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: 'entity', foreignKey: 'entity_id' });
      if (models.EntityBankTransaction) {
         this.belongsTo(models.EntityBankTransaction, { as: 'bankTransaction', foreignKey: 'bank_transaction_id' });
      }
      if (models.EntitySiiDocument) {
         this.belongsTo(models.EntitySiiDocument, { as: 'siiDocument', foreignKey: 'sii_document_id' });
      }
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ENTITY_BOLETA_REQUEST_TABLE,
         modelName: 'EntityBoletaRequest',
         timestamps: true,
         underscored: true,
      };
   }
}

module.exports = {
   ENTITY_BOLETA_REQUEST_TABLE,
   EntityBoletaRequestSchema,
   EntityBoletaRequest,
};
