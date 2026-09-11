// models/entity-sii-document.model.js
"use strict";

const { Model, DataTypes } = require("sequelize");

const ENTITY_SII_DOCUMENT_TABLE = "entity_sii_documents";

const EntitySiiDocumentSchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },

   entity_id: { allowNull: false, type: DataTypes.INTEGER },
   doc_type_code: { allowNull: true, type: DataTypes.INTEGER },

   counterparty_rut: { allowNull: true, type: DataTypes.STRING(16) },
   counterparty_name: { allowNull: true, type: DataTypes.STRING(255) },

   source: { allowNull: true, type: DataTypes.STRING(32), defaultValue: "SII" },
   external_key: { allowNull: true, type: DataTypes.STRING(255) },
   folio: { type: DataTypes.INTEGER, allowNull: true },
   issue_date: { allowNull: false, type: DataTypes.DATEONLY },
   received_date: { allowNull: true, type: DataTypes.DATEONLY },
   due_date: { allowNull: true, type: DataTypes.DATEONLY },

   period_year: { allowNull: true, type: DataTypes.INTEGER },
   period_month: { allowNull: true, type: DataTypes.TINYINT },

   state_id: { allowNull: false, type: DataTypes.INTEGER },

   total_amount: { allowNull: false, type: DataTypes.DECIMAL(15, 2) },
   amount_net: { allowNull: true, type: DataTypes.DECIMAL(15, 2) },
   amount_vat: { allowNull: true, type: DataTypes.DECIMAL(15, 2) },

   // extras del CSV
   seq_no: { allowNull: true, type: DataTypes.INTEGER.UNSIGNED },
   purchase_type: { allowNull: true, type: DataTypes.STRING(30) },
   acuse_date: { allowNull: true, type: DataTypes.DATEONLY },

   // desglose de montos
   amount_exempt: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   amount_vat_non_recoverable: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   vat_non_recoverable_code: { allowNull: true, type: DataTypes.STRING(10) },
   amount_net_fixed_assets: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   amount_vat_fixed_assets: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   amount_vat_common_use: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   amount_tax_no_credit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   amount_vat_not_withheld: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },

   // tabacos
   tobacco_puros: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   tobacco_cigarrillos: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   tobacco_elaborados: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },

   // otros impuestos
   nce_nde_reference: { allowNull: true, type: DataTypes.STRING(50) },
   other_tax_code: { allowNull: true, type: DataTypes.STRING(10) },
   other_tax_value: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
   other_tax_rate: { allowNull: false, type: DataTypes.DECIMAL(8, 4), defaultValue: 0 },
   operation_type: {
      type: DataTypes.STRING(20),
      allowNull: true,
   },
};

class EntitySiiDocument extends Model {
   // define asociaciones solo si estás seguro de las FK/PK en tus otros modelos
   static associate(models) {

      this.belongsTo(models.Entity, { as: "entity", foreignKey: "entity_id" });
      this.belongsTo(models.State, { as: "state", foreignKey: "state_id" });

      this.belongsTo(models.SiiDocumentType, { as: "docType", foreignKey: "doc_type_code", targetKey: "code" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ENTITY_SII_DOCUMENT_TABLE,
         modelName: "EntitySiiDocument",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
         indexes: [
            {
               unique: true,
               name: "uq_e_doc",
               fields: ["entity_id", "doc_type_code", "counterparty_rut", "folio", "issue_date"],
            },
            { name: "idx_period", fields: ["entity_id", "period_year", "period_month"] },
            { name: "idx_counterparty", fields: ["counterparty_rut"] },
            { name: "idx_issue_date", fields: ["issue_date"] },
         ],
      };
   }
}

module.exports = { ENTITY_SII_DOCUMENT_TABLE, EntitySiiDocument, EntitySiiDocumentSchema };
