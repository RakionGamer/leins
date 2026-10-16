"use strict";

const { Model, DataTypes } = require("sequelize");

const ENTITY_CONTACT_TABLE = "entity_contacts";

const ContactTypes = {
   CLIENTE: "CLIENTE",
   PROVEEDOR: "PROVEEDOR",
   PRESTADOR_SERVICIOS: "PRESTADOR_SERVICIOS",
   TRABAJADOR: "TRABAJADOR",
   OTRO: "OTRO",
};

const ContactSources = {
   SII_FACT: "SII_FACT",
   SII_BH: "SII_BH",
   MANUAL: "MANUAL",
};

const EntityContactSchema = {
   id: { allowNull: false, primaryKey: true, autoIncrement: true, type: DataTypes.INTEGER },
   entity_id: {
      allowNull: false,
      type: DataTypes.INTEGER,
      references: {
         model: "entities",
         key: "id",
      },
      onUpdate: "CASCADE",
      onDelete: "CASCADE",
   },
   rut: { allowNull: false, type: DataTypes.STRING(20) },
   name: { allowNull: false, type: DataTypes.STRING(255) },
   type: {
      allowNull: false,
      type: DataTypes.STRING(50),
      defaultValue: ContactTypes.PROVEEDOR,
   },
   email: { allowNull: true, type: DataTypes.STRING(255) },
   phone: { allowNull: true, type: DataTypes.STRING(50) },
   address: { allowNull: true, type: DataTypes.STRING(255) },
   source: {
      allowNull: false,
      type: DataTypes.STRING(50),
      defaultValue: ContactSources.MANUAL,
   },
   notes: { allowNull: true, type: DataTypes.TEXT },
   created_at: {
      allowNull: false,
      type: DataTypes.DATE,
      field: "created_at",
      defaultValue: DataTypes.NOW,
   },
   updated_at: {
      allowNull: false,
      type: DataTypes.DATE,
      field: "updated_at",
      defaultValue: DataTypes.NOW,
   },
};

class EntityContact extends Model {
   static associate(models) {
      this.belongsTo(models.Entity, { as: "entity", foreignKey: "entity_id" });
   }

   static config(sequelize) {
      return {
         sequelize,
         tableName: ENTITY_CONTACT_TABLE,
         modelName: "EntityContact",
         underscored: true,
         timestamps: true,
         createdAt: "created_at",
         updatedAt: "updated_at",
         indexes: [
            {
               unique: true,
               name: "uq_entity_contact_rut",
               fields: ["entity_id", "rut"],
            },
            {
               name: "idx_entity_contact_type",
               fields: ["entity_id", "type"],
            },
            {
               name: "idx_entity_contact_name",
               fields: ["entity_id", "name"],
            },
         ],
      };
   }
}

module.exports = {
   ENTITY_CONTACT_TABLE,
   EntityContact,
   EntityContactSchema,
   ContactTypes,
   ContactSources,
};
