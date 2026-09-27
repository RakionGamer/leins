"use strict";

module.exports = {
   async up(queryInterface, Sequelize) {
      const { DataTypes } = Sequelize;

      // 1. accounting_accounts
      await queryInterface.createTable("accounting_accounts", {
         id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
         entity_id: { allowNull: false, type: DataTypes.INTEGER },
         code: { allowNull: false, type: DataTypes.STRING(30) },
         name: { allowNull: false, type: DataTypes.STRING(255) },
         type: {
            allowNull: false,
            type: DataTypes.ENUM("ACTIVO", "PASIVO", "PATRIMONIO", "INGRESOS", "COSTOS", "GASTOS"),
         },
         nature: {
            allowNull: false,
            type: DataTypes.ENUM("DEUDORA", "ACREEDORA"),
         },
         cost_center_requirement: {
            allowNull: false,
            type: DataTypes.ENUM("NONE", "OPTIONAL", "REQUIRED"),
            defaultValue: "NONE",
         },
         is_active: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: true },
         is_system: { allowNull: false, type: DataTypes.BOOLEAN, defaultValue: false },
         created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
         updated_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
      });

      await queryInterface.addIndex("accounting_accounts", ["entity_id", "code"], {
         unique: true,
         name: "uq_entity_account_code",
      });

      // 2. accounting_counterparty_rules
      await queryInterface.createTable("accounting_counterparty_rules", {
         id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
         entity_id: { allowNull: false, type: DataTypes.INTEGER },
         counterparty_rut: { allowNull: false, type: DataTypes.STRING(16) },
         counterparty_name: { allowNull: true, type: DataTypes.STRING(255) },
         account_id: { allowNull: false, type: DataTypes.INTEGER },
         cost_center: { allowNull: true, type: DataTypes.STRING(100) },
         created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
         updated_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
      });

      await queryInterface.addIndex("accounting_counterparty_rules", ["entity_id", "counterparty_rut"], {
         unique: true,
         name: "uq_entity_counterparty_rule",
      });

      // 3. accounting_entries
      await queryInterface.createTable("accounting_entries", {
         id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
         entity_id: { allowNull: false, type: DataTypes.INTEGER },
         entry_number: { allowNull: true, type: DataTypes.INTEGER },
         entry_date: { allowNull: false, type: DataTypes.DATEONLY },
         concept: { allowNull: false, type: DataTypes.STRING(500) },
         source_type: {
            allowNull: false,
            type: DataTypes.ENUM("MANUAL", "SII_PURCHASE", "SII_SALE", "BANK_MOVEMENT", "OTHER"),
            defaultValue: "MANUAL",
         },
         source_id: { allowNull: true, type: DataTypes.INTEGER },
         status: {
            allowNull: false,
            type: DataTypes.ENUM("POSTED", "ANNULLED"),
            defaultValue: "POSTED",
         },
         total_debit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
         total_credit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
         created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
         updated_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
      });

      await queryInterface.addIndex("accounting_entries", ["entity_id", "entry_date"], {
         name: "idx_entry_entity_date",
      });
      await queryInterface.addIndex("accounting_entries", ["entity_id", "source_type", "source_id"], {
         name: "idx_entry_source",
      });

      // 4. accounting_entry_items
      await queryInterface.createTable("accounting_entry_items", {
         id: { allowNull: false, autoIncrement: true, primaryKey: true, type: DataTypes.INTEGER },
         entry_id: { allowNull: false, type: DataTypes.INTEGER },
         account_id: { allowNull: false, type: DataTypes.INTEGER },
         description: { allowNull: true, type: DataTypes.STRING(255) },
         debit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
         credit: { allowNull: false, type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
         counterparty_rut: { allowNull: true, type: DataTypes.STRING(16) },
         counterparty_name: { allowNull: true, type: DataTypes.STRING(255) },
         cost_center: { allowNull: true, type: DataTypes.STRING(100) },
         created_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP") },
         updated_at: { allowNull: false, type: DataTypes.DATE, defaultValue: Sequelize.literal("CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP") },
      });

      await queryInterface.addIndex("accounting_entry_items", ["entry_id"], {
         name: "idx_item_entry",
      });
      await queryInterface.addIndex("accounting_entry_items", ["account_id"], {
         name: "idx_item_account",
      });
      await queryInterface.addIndex("accounting_entry_items", ["counterparty_rut"], {
         name: "idx_item_rut",
      });
   },

   async down(queryInterface) {
      await queryInterface.dropTable("accounting_entry_items");
      await queryInterface.dropTable("accounting_entries");
      await queryInterface.dropTable("accounting_counterparty_rules");
      await queryInterface.dropTable("accounting_accounts");
   },
};
