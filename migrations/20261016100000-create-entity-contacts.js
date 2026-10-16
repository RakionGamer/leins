"use strict";

const { ENTITY_CONTACT_TABLE } = require("../db/models/entity-contact.model");

/** @type {import('sequelize-cli').Migration} */
module.exports = {
   async up(queryInterface, Sequelize) {
      await queryInterface.createTable(ENTITY_CONTACT_TABLE, {
         id: {
            allowNull: false,
            primaryKey: true,
            autoIncrement: true,
            type: Sequelize.INTEGER,
         },
         entity_id: {
            allowNull: false,
            type: Sequelize.INTEGER,
            references: {
               model: "entities",
               key: "id",
            },
            onUpdate: "CASCADE",
            onDelete: "CASCADE",
         },
         rut: {
            allowNull: false,
            type: Sequelize.STRING(20),
         },
         name: {
            allowNull: false,
            type: Sequelize.STRING(255),
         },
         type: {
            allowNull: false,
            type: Sequelize.STRING(50),
            defaultValue: "PROVEEDOR",
         },
         email: {
            allowNull: true,
            type: Sequelize.STRING(255),
         },
         phone: {
            allowNull: true,
            type: Sequelize.STRING(50),
         },
         address: {
            allowNull: true,
            type: Sequelize.STRING(255),
         },
         source: {
            allowNull: false,
            type: Sequelize.STRING(50),
            defaultValue: "MANUAL",
         },
         notes: {
            allowNull: true,
            type: Sequelize.TEXT,
         },
         created_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
         },
         updated_at: {
            allowNull: false,
            type: Sequelize.DATE,
            defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"),
         },
      });

      await queryInterface.addIndex(ENTITY_CONTACT_TABLE, ["entity_id", "rut"], {
         unique: true,
         name: "uq_entity_contact_rut",
      });

      await queryInterface.addIndex(ENTITY_CONTACT_TABLE, ["entity_id", "type"], {
         name: "idx_entity_contact_type",
      });

      await queryInterface.addIndex(ENTITY_CONTACT_TABLE, ["entity_id", "name"], {
         name: "idx_entity_contact_name",
      });

      // Backfill inicial automatico desde entity_sii_documents
      try {
         await queryInterface.sequelize.query(`
            INSERT IGNORE INTO ${ENTITY_CONTACT_TABLE} (entity_id, rut, name, type, source, created_at, updated_at)
            SELECT 
               d.entity_id,
               TRIM(d.counterparty_rut) AS rut,
               MAX(COALESCE(NULLIF(TRIM(d.counterparty_name), ''), TRIM(d.counterparty_rut))) AS name,
               CASE 
                  WHEN d.doc_type_code IN (1001, 1002) THEN 'PRESTADOR_SERVICIOS'
                  WHEN UPPER(COALESCE(d.operation_type, '')) = 'INCOME' THEN 'CLIENTE'
                  ELSE 'PROVEEDOR'
               END AS type,
               CASE 
                  WHEN d.doc_type_code IN (1001, 1002) THEN 'SII_BH'
                  ELSE 'SII_FACT'
               END AS source,
               NOW(),
               NOW()
            FROM entity_sii_documents d
            WHERE d.counterparty_rut IS NOT NULL AND TRIM(d.counterparty_rut) != ''
            GROUP BY d.entity_id, TRIM(d.counterparty_rut), type, source
         `);

         // Backfill desde accounting_counterparty_rules si hay alguno que no este aun
         await queryInterface.sequelize.query(`
            INSERT IGNORE INTO ${ENTITY_CONTACT_TABLE} (entity_id, rut, name, type, source, created_at, updated_at)
            SELECT 
               r.entity_id,
               TRIM(r.counterparty_rut) AS rut,
               MAX(COALESCE(NULLIF(TRIM(r.counterparty_name), ''), TRIM(r.counterparty_rut))) AS name,
               'PROVEEDOR' AS type,
               'MANUAL' AS source,
               NOW(),
               NOW()
            FROM accounting_counterparty_rules r
            WHERE r.counterparty_rut IS NOT NULL AND TRIM(r.counterparty_rut) != ''
            GROUP BY r.entity_id, TRIM(r.counterparty_rut)
         `);
      } catch (err) {
         console.warn("Aviso en backfill inicial de contactos (no bloqueante):", err.message);
      }
   },

   async down(queryInterface) {
      await queryInterface.dropTable(ENTITY_CONTACT_TABLE);
   },
};
