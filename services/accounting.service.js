"use strict";

const boom = require("@hapi/boom");
const { models, sequelize } = require("../libs/sequelize");
const { Op } = require("sequelize");

const DEFAULT_ACCOUNTS_SEED = [
   // 1.1 Activo Corriente
   { code: "1.1.1", name: "Caja", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.2", name: "Banco Cuenta Corriente 1", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.3", name: "Banco Cuenta Corriente 2", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.4", name: "Fondos por Rendir", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.5", name: "Depósitos a Plazo (CP)", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.6", name: "Clientes por Cobrar", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.7", name: "Documentos por Cobrar", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.8", name: "Anticipo a Proveedores", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.9", name: "IVA Crédito Fiscal", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.10", name: "IVA Crédito Activo Fijo", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.11", name: "PPM por Recuperar", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.12", name: "Inventario Mercaderías", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.13", name: "Materias Primas", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.14", name: "Productos en Proceso", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.1.15", name: "Productos Terminados", type: "ACTIVO", nature: "DEUDORA", is_system: true },

   // 1.2 Activo No Corriente
   { code: "1.2.1", name: "Terrenos", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.2", name: "Edificios", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.3", name: "Maquinarias", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.4", name: "Equipos Computacionales", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.5", name: "Muebles y Útiles", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.6", name: "Vehículos", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.7", name: "Activos Intangibles", type: "ACTIVO", nature: "DEUDORA", is_system: true },
   { code: "1.2.8", name: "Depreciación Acumulada", type: "ACTIVO", nature: "ACREEDORA", is_system: true },

   // 2 PASIVO
   { code: "2.1", name: "Proveedores Nacionales", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.2", name: "Proveedores Extranjeros", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.3", name: "Honorarios por Pagar", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.4", name: "Crédito Bancario CP", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.5", name: "Línea de Crédito", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.6", name: "IVA Débito Fiscal", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.7", name: "IVA por Pagar", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.8", name: "PPM por Pagar", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.9", name: "Ret Impto 2da Categoria", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.10", name: "Sueldos por Pagar", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.11", name: "Cotizaciones por Pagar", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.12", name: "Crédito Bancario LP", type: "PASIVO", nature: "ACREEDORA", is_system: true },
   { code: "2.13", name: "Leasing LP", type: "PASIVO", nature: "ACREEDORA", is_system: true },

   // 3 PATRIMONIO
   { code: "3.1", name: "Capital Social", type: "PATRIMONIO", nature: "ACREEDORA", is_system: true },
   { code: "3.2", name: "Utilidades Retenidas", type: "PATRIMONIO", nature: "ACREEDORA", is_system: true },
   { code: "3.3", name: "Resultado del Ejercicio", type: "PATRIMONIO", nature: "ACREEDORA", is_system: true },

   // 4 INGRESOS
   { code: "4.1", name: "Ingresos por Ventas Afectas", type: "INGRESOS", nature: "ACREEDORA", is_system: true },
   { code: "4.2", name: "Ingresos por Servicios", type: "INGRESOS", nature: "ACREEDORA", is_system: true },
   { code: "4.3", name: "Otros Ingresos Operacionales", type: "INGRESOS", nature: "ACREEDORA", is_system: true },
   { code: "4.4", name: "Ingresos Financieros", type: "INGRESOS", nature: "ACREEDORA", is_system: true },
   { code: "4.5", name: "Ingresos Fuera de la Explotación", type: "INGRESOS", nature: "ACREEDORA", is_system: true },

   // 5 COSTOS
   { code: "5.1", name: "Costo de Ventas", type: "COSTOS", nature: "DEUDORA", is_system: true },
   { code: "5.2", name: "Consumo Materia Prima", type: "COSTOS", nature: "DEUDORA", is_system: true },
   { code: "5.3", name: "Mano de Obra Directa", type: "COSTOS", nature: "DEUDORA", is_system: true },
   { code: "5.4", name: "Costos Indirectos de Fabricación", type: "COSTOS", nature: "DEUDORA", is_system: true },
   { code: "5.5", name: "Variación de Inventario", type: "COSTOS", nature: "DEUDORA", is_system: true },

   // 6 GASTOS
   { code: "5.2.1", name: "Gastos Administrativos", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.1", name: "Arriendos", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.2", name: "Servicios Básicos", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.3", name: "Gastos Bancarios", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.4", name: "Honorarios Profesionales", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.5", name: "Remuneraciones", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.6", name: "Gratificaciones", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.7", name: "Bonificaciones", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.8", name: "Gastos Patronales", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.9", name: "Gastos Notariales", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.10", name: "Gastos de Oficina", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.11", name: "Software y Suscripciones", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.12", name: "Seguros", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.13", name: "Depreciación", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.14", name: "Publicidad", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.15", name: "Marketing Digital", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.16", name: "Comisiones por Venta", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.17", name: "Fletes y Distribución", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.18", name: "Intereses Bancarios", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.19", name: "Multas e Intereses Tributarios", type: "GASTOS", nature: "DEUDORA", is_system: true },
   { code: "6.20", name: "Egresos Fuera de la Explotación", type: "GASTOS", nature: "DEUDORA", is_system: true },
];

class AccountingService {
   // Asegura y puebla el plan de cuentas por defecto si está vacío
   async ensureDefaultPlan(entityId) {
      const count = await models.AccountingAccount.count({ where: { entity_id: entityId } });
      if (count > 0) {
         // Auto-corregir el nombre de la cuenta 2.9 para empresas existentes
         await models.AccountingAccount.update(
            { name: "Ret Impto 2da Categoria" },
            { where: { entity_id: entityId, code: "2.9" } }
         );
         return { created: 0 };
      }

      const records = DEFAULT_ACCOUNTS_SEED.map((acc) => ({
         ...acc,
         entity_id: entityId,
      }));

      await models.AccountingAccount.bulkCreate(records, { ignoreDuplicates: true });
      return { created: records.length };
   }

   // Listar cuentas contables de la entidad
   async listAccounts(entityId, { type, q } = {}) {
      await this.ensureDefaultPlan(entityId);

      const where = { entity_id: entityId, is_active: true };
      if (type) where.type = type;
      if (q) {
         where[Op.or] = [
            { code: { [Op.like]: `%${q}%` } },
            { name: { [Op.like]: `%${q}%` } },
         ];
      }

      return models.AccountingAccount.findAll({
         where,
         order: [["code", "ASC"]],
      });
   }

   // Crear cuenta contable
   async createAccount(entityId, payload) {
      const existing = await models.AccountingAccount.findOne({
         where: { entity_id: entityId, code: payload.code.trim() },
      });
      if (existing) {
         throw boom.conflict(`Ya existe una cuenta con el código ${payload.code}`);
      }

      return models.AccountingAccount.create({
         entity_id: entityId,
         code: payload.code.trim(),
         name: payload.name.trim(),
         type: payload.type,
         nature: payload.nature || (["ACTIVO", "COSTOS", "GASTOS"].includes(payload.type) ? "DEUDORA" : "ACREEDORA"),
         cost_center_requirement: payload.cost_center_requirement || "NONE",
         is_system: false,
         require_rut: Boolean(payload.require_rut),
         require_reference: Boolean(payload.require_reference),
         is_auxiliary: Boolean(payload.is_auxiliary),
         cash_flow_classification: payload.cash_flow_classification || "NONE",
      });
   }

   // Actualizar cuenta contable
   async updateAccount(entityId, id, payload) {
      const account = await models.AccountingAccount.findOne({
         where: { id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no encontrada");

      if (payload.name) account.name = payload.name.trim();
      if (payload.type) account.type = payload.type;
      if (payload.nature) account.nature = payload.nature;
      if (payload.cost_center_requirement) account.cost_center_requirement = payload.cost_center_requirement;
      if (payload.require_rut !== undefined) account.require_rut = Boolean(payload.require_rut);
      if (payload.require_reference !== undefined) account.require_reference = Boolean(payload.require_reference);
      if (payload.is_auxiliary !== undefined) account.is_auxiliary = Boolean(payload.is_auxiliary);
      if (payload.cash_flow_classification !== undefined) account.cash_flow_classification = payload.cash_flow_classification;

      await account.save();
      return account;
   }

   // Eliminar cuenta contable
   async deleteAccount(entityId, id) {
      const account = await models.AccountingAccount.findOne({
         where: { id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no encontrada");
      if (account.is_system) throw boom.badRequest("No se pueden eliminar cuentas del sistema");

      const inUseCount = await models.AccountingEntryItem.count({ where: { account_id: id } });
      if (inUseCount > 0) {
         throw boom.badRequest("No se puede eliminar la cuenta porque tiene asientos contables asociados");
      }

      await account.destroy();
      return { id };
   }

   // --- Reglas de Asignación por Proveedor/Cliente ---
   async listRules(entityId) {
      const rules = await models.AccountingRule.findAll({
         where: { entity_id: entityId },
         include: [{ model: models.AccountingAccount, as: "account" }],
         order: [["counterparty_rut", "ASC"]],
      });

      // Autocompletar la razón social desde los documentos si está vacía
      const rulesToEnhance = rules.filter(r => !r.counterparty_name && r.counterparty_rut);
      if (rulesToEnhance.length > 0) {
         const ruts = [...new Set(rulesToEnhance.map(r => r.counterparty_rut))];
         const docs = await models.EntitySiiDocument.findAll({
            where: { 
               entity_id: entityId, 
               counterparty_rut: { [Op.in]: ruts },
               counterparty_name: { [Op.not]: null, [Op.ne]: '' }
            },
            attributes: ['counterparty_rut', 'counterparty_name'],
            group: ['counterparty_rut', 'counterparty_name'],
            raw: true
         });
         
         const nameMap = {};
         for (const doc of docs) {
            if (!nameMap[doc.counterparty_rut]) {
               nameMap[doc.counterparty_rut] = doc.counterparty_name;
            }
         }

         for (const rule of rules) {
            if (!rule.counterparty_name && nameMap[rule.counterparty_rut]) {
               rule.setDataValue('counterparty_name', nameMap[rule.counterparty_rut]);
               rule.counterparty_name = nameMap[rule.counterparty_rut];
               
               // Opcional: guardarlo en BD para la próxima vez
               rule.save().catch(() => {});
            }
         }
      }

      return rules;
   }

   async upsertRule(entityId, { counterparty_rut, counterparty_name, account_id, cost_center }) {
      const rutClean = String(counterparty_rut).trim().toUpperCase();
      const account = await models.AccountingAccount.findOne({
         where: { id: account_id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no existe para la entidad");

      const [rule, created] = await models.AccountingRule.findOrCreate({
         where: { entity_id: entityId, counterparty_rut: rutClean },
         defaults: {
            entity_id: entityId,
            counterparty_rut: rutClean,
            counterparty_name: counterparty_name?.trim() || null,
            account_id,
            cost_center: cost_center?.trim() || null,
         },
      });

      if (!created) {
         rule.account_id = account_id;
         if (counterparty_name) rule.counterparty_name = counterparty_name.trim();
         rule.cost_center = cost_center?.trim() || null;
         await rule.save();
      }

      return models.AccountingRule.findByPk(rule.id, {
         include: [{ model: models.AccountingAccount, as: "account" }],
      });
   }

   async deleteRule(entityId, id) {
      const rule = await models.AccountingRule.findOne({
         where: { id, entity_id: entityId },
      });
      if (!rule) throw boom.notFound("Regla no encontrada");
      await rule.destroy();
      return { id };
   }

   async upsertBulkRules(entityId, { account_id, cost_center, ruts }) {
      const account = await models.AccountingAccount.findOne({
         where: { id: account_id, entity_id: entityId },
      });
      if (!account) throw boom.notFound("Cuenta contable no existe para la entidad");

      if (!Array.isArray(ruts)) throw boom.badRequest("ruts debe ser un array");

      const t = await sequelize.transaction();
      try {
         for (const item of ruts) {
            const rutClean = String(item.rut || item.counterparty_rut).trim().toUpperCase();
            if (!rutClean || rutClean === 'UNDEFINED') continue;
            const name = item.name || item.counterparty_name || null;

            const [rule, created] = await models.AccountingRule.findOrCreate({
               where: { entity_id: entityId, counterparty_rut: rutClean },
               defaults: {
                  entity_id: entityId,
                  counterparty_rut: rutClean,
                  counterparty_name: name?.trim() || null,
                  account_id,
                  cost_center: cost_center?.trim() || null,
               },
               transaction: t
            });

            if (!created) {
               rule.account_id = account_id;
               if (name) rule.counterparty_name = name.trim();
               rule.cost_center = cost_center?.trim() || null;
               await rule.save({ transaction: t });
            }
         }
         await t.commit();
      } catch (err) {
         await t.rollback();
         throw err;
      }

      return { success: true, count: ruts.length };
   }

   // --- Asientos Contables ---
   async createEntry(entityId, payload) {
      const { entry_date, concept, items = [], source_type = "MANUAL", source_id = null } = payload;

      if (!items || items.length < 2) {
         throw boom.badRequest("Un asiento contable debe tener al menos 2 movimientos (Debe y Haber)");
      }

      let totalDebit = 0;
      let totalCredit = 0;

      for (const it of items) {
         const d = Math.round((Number(it.debit) || 0) * 100) / 100;
         const c = Math.round((Number(it.credit) || 0) * 100) / 100;
         totalDebit += d;
         totalCredit += c;
      }

      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;

      if (Math.abs(totalDebit - totalCredit) > 0.05) {
         throw boom.badRequest(
            `El asiento no está cuadrado. Total Debe ($${totalDebit}) ≠ Total Haber ($${totalCredit})`
         );
      }

      const t = await sequelize.transaction();
      try {
         // Obtener el siguiente número de asiento correlativo para la entidad
         const maxEntry = await models.AccountingEntry.max("entry_number", {
            where: { entity_id: entityId },
            transaction: t,
         });
         const entryNumber = (maxEntry || 0) + 1;

         const entry = await models.AccountingEntry.create(
            {
               entity_id: entityId,
               entry_number: entryNumber,
               entry_date,
               concept: concept.trim(),
               source_type,
               source_id,
               status: "POSTED",
               total_debit: totalDebit,
               total_credit: totalCredit,
            },
            { transaction: t }
         );

         const itemRecords = items.map((it) => ({
            entry_id: entry.id,
            account_id: it.account_id,
            description: it.description?.trim() || null,
            debit: Math.round((Number(it.debit) || 0) * 100) / 100,
            credit: Math.round((Number(it.credit) || 0) * 100) / 100,
            counterparty_rut: it.counterparty_rut?.trim().toUpperCase() || null,
            counterparty_name: it.counterparty_name?.trim() || null,
            cost_center: it.cost_center?.trim() || null,
         }));

         await models.AccountingEntryItem.bulkCreate(itemRecords, { transaction: t });
         await t.commit();

         return this.getEntryById(entityId, entry.id);
      } catch (err) {
         await t.rollback();
         throw err;
      }
   }

   async listEntries(entityId, { month, from, to, source_type, status, q, page = 1, limit = 50 }) {
      const where = { entity_id: entityId };

      if (status) where.status = status;
      
      if (source_type === 'SII_HONORARY') {
         where.source_type = 'SII_PURCHASE';
         where.concept = { [Op.like]: '%Boleta de Honorarios%' };
      } else if (source_type === 'SII_PURCHASE') {
         where.source_type = 'SII_PURCHASE';
         where.concept = { [Op.notLike]: '%Boleta de Honorarios%' };
      } else if (source_type) {
         where.source_type = source_type;
      }

      if (month && /^\d{4}-\d{2}$/.test(month)) {
         const [y, m] = month.split("-").map(Number);
         const startDate = `${month}-01`;
         const lastDay = new Date(y, m, 0).getDate();
         const endDate = `${month}-${String(lastDay).padStart(2, "0")}`;
         where.entry_date = { [Op.between]: [startDate, endDate] };
      } else if (from || to) {
         where.entry_date = {};
         if (from) where.entry_date[Op.gte] = from;
         if (to) where.entry_date[Op.lte] = to;
      }

      if (q) {
         where[Op.or] = [
            { concept: { [Op.like]: `%${q}%` } },
            { entry_number: { [Op.like]: `%${q}%` } },
         ];
      }

      const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

      const { count, rows } = await models.AccountingEntry.findAndCountAll({
         where,
         include: [
            {
               model: models.AccountingEntryItem,
               as: "items",
               include: [{ model: models.AccountingAccount, as: "account", attributes: ["code", "name", "type"] }],
            },
         ],
         order: [
            ["entry_date", "DESC"],
            ["entry_number", "DESC"],
         ],
         limit: Number(limit),
         offset,
         distinct: true,
      });

      return {
         total: count,
         totalPages: Math.max(1, Math.ceil(count / Number(limit))),
         page: Number(page),
         limit: Number(limit),
         rows,
      };
   }

   async getEntryById(entityId, id) {
      const entry = await models.AccountingEntry.findOne({
         where: { id, entity_id: entityId },
         include: [
            {
               model: models.AccountingEntryItem,
               as: "items",
               include: [{ model: models.AccountingAccount, as: "account" }],
            },
         ],
      });
      if (!entry) throw boom.notFound("Asiento contable no encontrado");
      return entry;
   }

   async annulEntry(entityId, id) {
      const entry = await models.AccountingEntry.findOne({
         where: { id, entity_id: entityId },
      });
      if (!entry) throw boom.notFound("Asiento contable no encontrado");

      entry.status = "ANNULLED";
      await entry.save();
      return entry;
   }

   async clearAnnulledEntries(entityId) {
      // 1. Encontrar todos los asientos anulados
      const entries = await models.AccountingEntry.findAll({
         where: { entity_id: entityId, status: "ANNULLED" }
      });
      
      const ids = entries.map(e => e.id);
      if (ids.length === 0) return { deletedCount: 0 };

      // 2. Borrar primero los items (cascade puede estar configurado, pero mejor manual)
      await models.AccountingEntryItem.destroy({
         where: { entry_id: { [Op.in]: ids } }
      });

      // 3. Borrar los asientos
      const deletedCount = await models.AccountingEntry.destroy({
         where: { id: { [Op.in]: ids } }
      });

      return { deletedCount };
   }

   async deleteAllEntries(entityId) {
      // 1. Encontrar todos los asientos
      const entries = await models.AccountingEntry.findAll({
         where: { entity_id: entityId }
      });
      
      const ids = entries.map(e => e.id);
      if (ids.length === 0) return { deletedCount: 0 };

      // 2. Borrar items
      await models.AccountingEntryItem.destroy({
         where: { entry_id: { [Op.in]: ids } }
      });

      // 3. Borrar asientos
      const deletedCount = await models.AccountingEntry.destroy({
         where: { id: { [Op.in]: ids } }
      });

      return { deletedCount };
   }

   // --- Generación Automática de Asientos desde SII (Compras y Ventas) ---
   async generateSiiEntries(entityId, { month, from, to, docIds }) {
      await this.ensureDefaultPlan(entityId);

      // Cargar mapa de cuentas clave
      const allAccounts = await models.AccountingAccount.findAll({ where: { entity_id: entityId } });
      const accountByCode = new Map(allAccounts.map((a) => [a.code, a]));

      const ivaCredito = accountByCode.get("1.1.9") || allAccounts.find((a) => a.name.includes("Crédito Fiscal"));
      const ivaDebito = accountByCode.get("2.6") || allAccounts.find((a) => a.name.includes("Débito Fiscal"));
      const proveedores = accountByCode.get("2.1") || allAccounts.find((a) => a.name.includes("Proveedores"));
      const clientes = accountByCode.get("1.1.6") || allAccounts.find((a) => a.name.includes("Clientes"));
      const ventas = accountByCode.get("4.1") || allAccounts.find((a) => a.name.includes("Ventas"));
      const gastosDefault = accountByCode.get("5.2.1") || accountByCode.get("6.1") || allAccounts.find((a) => a.type === "GASTOS");

      if (!ivaCredito || !ivaDebito || !proveedores || !clientes || !ventas || !gastosDefault) {
         throw boom.badRequest("No se encontraron todas las cuentas base para la generación automática.");
      }

      // Cargar reglas por proveedor/cliente
      const rules = await models.AccountingRule.findAll({ where: { entity_id: entityId } });
      const ruleMap = new Map(rules.map((r) => [r.counterparty_rut, r]));

      // Cargar documentos SII
      const whereDoc = { entity_id: entityId };
      if (docIds && Array.isArray(docIds) && docIds.length > 0) {
         whereDoc.id = { [Op.in]: docIds };
      } else if (month && /^\d{4}-\d{2}$/.test(month)) {
         const [y, m] = month.split("-").map(Number);
         whereDoc.period_year = y;
         whereDoc.period_month = m;
      } else if (from || to) {
         whereDoc.issue_date = {};
         if (from) whereDoc.issue_date[Op.gte] = from;
         if (to) whereDoc.issue_date[Op.lte] = to;
      }

      const docs = await models.EntitySiiDocument.findAll({ where: whereDoc });

      let createdCount = 0;
      let skippedCount = 0;

      const getDocOpType = (d) => {
         const op = d.operationType || d.operation_type;
         if (op) return String(op).toUpperCase();
         // Lógica de retrocompatibilidad
         if ([39, 41, 1001].includes(d.doc_type_code)) return "INCOME";
         if (d.doc_type_code === 1002) return "EXPENSE";
         if ([33, 34, 61].includes(d.doc_type_code)) {
            if (d.received_date || d.purchase_type) return "EXPENSE";
            return "INCOME";
         }
         return "EXPENSE";
      };

      for (const doc of docs) {
         const opType = getDocOpType(doc);
         const sourceType = opType === "INCOME" ? "SII_SALE" : "SII_PURCHASE";

         // Verificar si ya existe un asiento activo para este documento
         const existing = await models.AccountingEntry.findOne({
            where: { entity_id: entityId, source_type: sourceType, source_id: doc.id, status: "POSTED" },
         });
         if (existing) {
            skippedCount++;
            continue;
         }

         const rut = (doc.counterparty_rut || "").toUpperCase();
         const name = doc.counterparty_name || "";
         let total = Number(doc.total_amount || 0);
         let vat = Number(doc.amount_vat || 0);
         let net = Number(doc.amount_net || 0);
         const exempt = Number(doc.amount_exempt || 0);

         // Si es Afecta (Factura 33 o Boleta 39) y el SII no desglosó el IVA en la base
         if ([33, 39].includes(doc.doc_type_code) && vat === 0 && total > 0) {
            const brutoAfecto = total - exempt;
            if (brutoAfecto > 0) {
               net = Math.round(brutoAfecto / 1.19);
               vat = brutoAfecto - net;
            }
         }

         if (net === 0) net = total - vat;

         const isCreditNote = doc.doc_type_code === 61;
         let conceptPrefix = "";
         if (opType === "EXPENSE") {
            conceptPrefix = isCreditNote ? "NC Proveedor" : "Compra";
         } else {
            conceptPrefix = isCreditNote ? "NC Cliente" : "Venta";
         }

         if (opType === "EXPENSE") {
            if (doc.doc_type_code === 1002) {
               const honorariosGasto = accountByCode.get("6.4") || allAccounts.find((a) => a.name.includes("Honorarios Profesionales")) || gastosDefault;
               const retencion = accountByCode.get("2.9") || allAccounts.find((a) => a.name.includes("Ret Impto 2da Categoria")) || allAccounts.find((a) => a.name.includes("Ret 2da Categoria")) || allAccounts.find((a) => a.name.includes("Retenciones Honorarios"));
               const honorariosPorPagar = accountByCode.get("2.3") || allAccounts.find((a) => a.name.includes("Honorarios por Pagar"));
               
               if (!retencion || !honorariosPorPagar) {
                  throw boom.badRequest("No se encontraron las cuentas para Honorarios (Retención o por Pagar).");
               }

               const rule = ruleMap.get(rut);
               const costCenter = rule ? rule.cost_center : null;

               const concept = `Boleta de Honorarios Folio ${doc.folio || "-"} - ${name || rut}`;
               const items = [];

               const bruto = Number(doc.amount_net || doc.total_amount || 0);
               const retencionMonto = Number(doc.amount_tax_no_credit || 0);
               const liquido = bruto - retencionMonto;

               const glosaBHE = `BH Nro ${doc.folio || "-"} ${name || rut}`.trim();

               items.push({
                  account_id: honorariosGasto.id,
                  description: glosaBHE,
                  debit: bruto,
                  credit: 0,
                  counterparty_rut: rut,
                  counterparty_name: name,
                  cost_center: costCenter,
               });
               items.push({
                  account_id: retencion.id,
                  description: glosaBHE,
                  debit: 0,
                  credit: retencionMonto,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });
               items.push({
                  account_id: honorariosPorPagar.id,
                  description: glosaBHE,
                  debit: 0,
                  credit: liquido,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });

               await this.createEntry(entityId, {
                  entry_date: doc.issue_date,
                  concept,
                  source_type: sourceType,
                  source_id: doc.id,
                  items,
               });
               createdCount++;
               continue;
            }

            // COMPRA
            const rule = ruleMap.get(rut);
            const expenseAccountId = rule ? rule.account_id : gastosDefault.id;
            const costCenter = rule ? rule.cost_center : null;

            const concept = `${conceptPrefix} Folio ${doc.folio || "-"} - ${name || rut}`;
            const items = [];

            const glosaCompra = `Factura ${name || rut} Folio ${doc.folio || "-"}`.trim();

            // Debe: Gasto/Activo (Neto o Total si exenta)
            items.push({
               account_id: expenseAccountId,
               description: glosaCompra,
               debit: vat > 0 ? net : total,
               credit: 0,
               counterparty_rut: rut,
               counterparty_name: name,
               cost_center: costCenter,
            });

            // Debe: IVA Crédito Fiscal (si aplica)
            if (vat > 0) {
               items.push({
                  account_id: ivaCredito.id,
                  description: glosaCompra,
                  debit: vat,
                  credit: 0,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });
            }

            // Haber: Proveedores Nacionales (Total)
            items.push({
               account_id: proveedores.id,
               description: glosaCompra,
               debit: 0,
               credit: total,
               counterparty_rut: rut,
               counterparty_name: name,
            });

            if (isCreditNote) {
               items.forEach(i => { const t = i.debit; i.debit = i.credit; i.credit = t; });
            }

            await this.createEntry(entityId, {
               entry_date: doc.issue_date,
               concept,
               source_type: sourceType,
               source_id: doc.id,
               items,
            });
            createdCount++;
         } else {
            // VENTA
            const concept = `${conceptPrefix} Folio ${doc.folio || "-"} - ${name || rut || "Cliente"}`;
            const items = [];

            const glosaVenta = `Factura ${name || rut} Folio ${doc.folio || "-"}`.trim();

            // Debe: Clientes por Cobrar (Total)
            items.push({
               account_id: clientes.id,
               description: glosaVenta,
               debit: total,
               credit: 0,
               counterparty_rut: rut,
               counterparty_name: name,
            });

            // Haber: Ingresos por Ventas (Neto o Total si exenta)
            items.push({
               account_id: ventas.id,
               description: glosaVenta,
               debit: 0,
               credit: vat > 0 ? net : total,
               counterparty_rut: rut,
               counterparty_name: name,
            });

            // Haber: IVA Débito Fiscal (si aplica)
            if (vat > 0) {
               items.push({
                  account_id: ivaDebito.id,
                  description: glosaVenta,
                  debit: 0,
                  credit: vat,
                  counterparty_rut: rut,
                  counterparty_name: name,
               });
            }

            if (isCreditNote) {
               items.forEach(i => { const t = i.debit; i.debit = i.credit; i.credit = t; });
            }

            await this.createEntry(entityId, {
               entry_date: doc.issue_date,
               concept,
               source_type: sourceType,
               source_id: doc.id,
               items,
            });
            createdCount++;
         }
      }
      
      // Retro-Sincronización: Generar asientos para conciliaciones bancarias pasadas
      const historicalRecons = await models.BankTransactionDocument.findAll({
         include: [
            { model: models.EntityBankTransaction, as: 'tx', where: { entity_id: entityId } },
            { model: models.EntitySiiDocument, as: 'doc', where: { entity_id: entityId } }
         ]
      });

      const bankAcc = allAccounts.find(a => a.code === '1.1.2' || a.name.includes('Banco'));

      for (const recon of historicalRecons) {
         const bankTx = recon.tx;
         const doc = recon.doc;
         if (!bankTx || !doc) continue;

         const existingEntry = await models.AccountingEntry.findOne({
            where: { entity_id: entityId, source_type: 'BANK_MOVEMENT', source_id: bankTx.id, status: 'POSTED' }
         });
         
         if (!existingEntry && bankAcc) {
            const rut = (doc.counterparty_rut || '').toUpperCase();
            // Prioridad: nombre del documento SII > nombre del banco (si está en descripción) > vacío
            const name = doc.counterparty_name || bankTx.description || '';
            const toApply = Number(recon.amount_applied || bankTx.amount);

            const opType = getDocOpType(doc);

            if (opType === 'EXPENSE') {
               const honorariosPorPagar = accountByCode.get("2.3") || allAccounts.find((a) => a.name.includes("Honorarios por Pagar"));
               const isBHE = doc.doc_type_code === 1002;
               const payableAccount = (isBHE && honorariosPorPagar) ? honorariosPorPagar : proveedores;

               if (payableAccount) {
                  // Documento de Compra u Honorario
                  if (bankTx.type === 'expense') {
                     // Pago normal
                     const glosaPago = isBHE ? `Pago BH Nro ${doc.folio || '-'} ${name || rut}` : `Pago proveedor ${name || rut} Folio ${doc.folio || '-'}`;
                     await this.createEntry(entityId, {
                        entry_date: bankTx.issued_at || doc.issue_date,
                        concept: glosaPago,
                        source_type: 'BANK_MOVEMENT',
                        source_id: bankTx.id,
                        items: [
                           { account_id: payableAccount.id, description: glosaPago, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                           { account_id: bankAcc.id, description: glosaPago, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                        ]
                     });
                     createdCount++;
                  } else if (bankTx.type === 'income') {
                     // Reembolso de una compra/honorario
                     const glosaReembolso = isBHE ? `Reverso Pago BH Nro ${doc.folio || '-'} ${name || rut}` : `Reembolso Compra Folio ${doc.folio || '-'} - ${name || rut}`;
                     await this.createEntry(entityId, {
                        entry_date: bankTx.issued_at || doc.issue_date,
                        concept: glosaReembolso,
                        source_type: 'BANK_MOVEMENT',
                        source_id: bankTx.id,
                        items: [
                           { account_id: bankAcc.id, description: glosaReembolso, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                           { account_id: payableAccount.id, description: glosaReembolso, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                        ]
                     });
                     createdCount++;
                  }
               }
            } else if (opType === 'INCOME' && clientes) {
               // Documento de Venta
               if (bankTx.type === 'income') {
                  // Cobro normal
                  const glosaCobro = `Cobro de Cliente ${name || rut || 'Cliente'} Folio ${doc.folio || '-'}`.trim();
                  await this.createEntry(entityId, {
                     entry_date: bankTx.issued_at || doc.issue_date,
                     concept: glosaCobro,
                     source_type: 'BANK_MOVEMENT',
                     source_id: bankTx.id,
                     items: [
                        { account_id: bankAcc.id, description: glosaCobro, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                        { account_id: clientes.id, description: glosaCobro, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                     ]
                  });
                  createdCount++;
               } else if (bankTx.type === 'expense') {
                  // Devolución a un cliente
                  const glosaDev = `Devolución a Cliente Folio ${doc.folio || '-'} - ${name || rut}`.trim();
                  await this.createEntry(entityId, {
                     entry_date: bankTx.issued_at || doc.issue_date,
                     concept: glosaDev,
                     source_type: 'BANK_MOVEMENT',
                     source_id: bankTx.id,
                     items: [
                        { account_id: clientes.id, description: glosaDev, debit: toApply, credit: 0, counterparty_rut: rut, counterparty_name: name },
                        { account_id: bankAcc.id, description: glosaDev, debit: 0, credit: toApply, counterparty_rut: rut, counterparty_name: name }
                     ]
                  });
                  createdCount++;
               }
            }
         }
      }

      return { createdCount, skippedCount, totalDocs: docs.length + historicalRecons.length };
   }

   // --- Control de Saldos por RUT (Clientes y Proveedores) ---
   async getRUTBalances(entityId, { type = "ALL", q } = {}) {
      await this.ensureDefaultPlan(entityId);

      const accounts = await models.AccountingAccount.findAll({ where: { entity_id: entityId } });
      const accountByCode = new Map(accounts.map((a) => [a.code, a]));

      const clientesAcc = accountByCode.get("1.1.6") || accounts.find((a) => a.name.toLowerCase() === "clientes por cobrar");
      const proveedoresAcc = accountByCode.get("2.1") || accounts.find((a) => a.name.toLowerCase() === "proveedores nacionales");

      const targetAccountIds = [];
      if ((type === "ALL" || type === "RECEIVABLE") && clientesAcc) targetAccountIds.push(clientesAcc.id);
      if ((type === "ALL" || type === "PAYABLE") && proveedoresAcc) targetAccountIds.push(proveedoresAcc.id);

      if (!targetAccountIds.length) return [];

      const items = await models.AccountingEntryItem.findAll({
         where: { account_id: { [Op.in]: targetAccountIds } },
         include: [
            {
               model: models.AccountingEntry,
               as: "entry",
               where: { entity_id: entityId, status: "POSTED" },
            },
            {
               model: models.AccountingAccount,
               as: "account",
            },
         ],
      });

      // Agrupar por RUT
      const map = new Map();

      for (const item of items) {
         const rut = item.counterparty_rut || "SIN_RUT";
         if (q && !rut.toLowerCase().includes(q.toLowerCase()) && !(item.counterparty_name || "").toLowerCase().includes(q.toLowerCase())) {
            continue;
         }

         if (!map.has(rut)) {
            map.set(rut, {
               rut,
               name: item.counterparty_name || "",
               account_type: item.account_id === clientesAcc?.id ? "CLIENTE" : "PROVEEDOR",
               total_debit: 0,
               total_credit: 0,
               balance: 0,
               document_count: 0,
               entries: [],
            });
         } else if (!map.get(rut).name && item.counterparty_name) {
            // Si ya existe en el mapa sin nombre, completarlo con el primero disponible
            map.get(rut).name = item.counterparty_name;
         }

         const rec = map.get(rut);
         rec.total_debit += Number(item.debit || 0);
         rec.total_credit += Number(item.credit || 0);
         rec.document_count += 1;
         rec.entries.push({
            id: item.id,
            date: item.entry?.entry_date,
            concept: item.entry?.concept || item.description,
            debit: Number(item.debit || 0),
            credit: Number(item.credit || 0)
         });
      }

      // Enriquecer nombres faltantes desde la tabla de documentos SII
      const rutsWithoutName = Array.from(map.entries())
         .filter(([, v]) => !v.name && v.rut !== "SIN_RUT")
         .map(([rut]) => rut);

      if (rutsWithoutName.length > 0) {
         const siiDocs = await models.EntitySiiDocument.findAll({
            where: {
               entity_id: entityId,
               counterparty_rut: { [Op.in]: rutsWithoutName },
               counterparty_name: { [Op.ne]: null },
            },
            attributes: ["counterparty_rut", "counterparty_name"],
            group: ["counterparty_rut", "counterparty_name"],
            limit: 200,
         });

         for (const doc of siiDocs) {
            const entry = map.get((doc.counterparty_rut || "").toUpperCase());
            if (entry && !entry.name && doc.counterparty_name) {
               entry.name = doc.counterparty_name;
            }
         }
      }

      const results = Array.from(map.values()).map((r) => {
         // Para Clientes (Deudora): Saldo = Debe - Haber (Pendiente por cobrar)
         // Para Proveedores (Acreedora): Saldo = Haber - Debe (Pendiente por pagar)
         if (r.account_type === "CLIENTE") {
            r.balance = r.total_debit - r.total_credit;
         } else {
            r.balance = r.total_credit - r.total_debit;
         }
         r.name = r.name || "Sin nombre";
         r.status = r.balance <= 0 ? "Pagado" : (r.balance < (r.account_type === "CLIENTE" ? r.total_debit : r.total_credit) ? "Parcial" : "Pendiente");
         return r;
      });

      // Aplicar filtro q también por nombre (ahora que tenemos nombres completos)
      const filtered = q
         ? results.filter(r =>
              r.rut.toLowerCase().includes(q.toLowerCase()) ||
              r.name.toLowerCase().includes(q.toLowerCase())
           )
         : results;

      return filtered.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance));
   }
}

module.exports = AccountingService;
