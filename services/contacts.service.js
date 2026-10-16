"use strict";

const { Op } = require("sequelize");
const boom = require("@hapi/boom");
const { models, sequelize } = require("../libs/sequelize");

function cleanRut(rut) {
   if (!rut) return "";
   return String(rut).replace(/[^0-9kK-]/g, "").toUpperCase().trim();
}

function formatRut(rut) {
   let value = String(rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
   if (value.length > 9) value = value.slice(0, 9);
   if (value.length <= 1) return value;
   const body = value.slice(0, -1);
   const dv = value.slice(-1);
   const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
   return `${formattedBody}-${dv}`;
}

class ContactsService {
   async list(entityId, query = {}) {
      const { search, type, source, limit = 50, offset = 0, all } = query;
      const where = { entity_id: entityId };

      if (type && type.trim()) {
         where.type = type.trim();
      }

      if (source && source.trim()) {
         where.source = source.trim();
      }

      if (search && search.trim()) {
         const term = search.trim();
         const cleaned = term.replace(/[.\s-]/g, "");
         where[Op.or] = [
            { name: { [Op.like]: `%${term}%` } },
            { rut: { [Op.like]: `%${term}%` } },
            { rut: { [Op.like]: `%${cleaned}%` } },
            { email: { [Op.like]: `%${term}%` } },
         ];
      }

      const isAll = String(all).toLowerCase() === "true" || all === true;
      const parsedLimit = isAll ? 2000 : Math.min(Number(limit) || 50, 500);
      const parsedOffset = isAll ? 0 : Math.max(Number(offset) || 0, 0);

      const { rows, count } = await models.EntityContact.findAndCountAll({
         where,
         order: [["name", "ASC"]],
         limit: parsedLimit,
         offset: parsedOffset,
      });

      return {
         contacts: rows,
         total: count,
         limit: parsedLimit,
         offset: parsedOffset,
      };
   }

   async getById(entityId, id) {
      const contact = await models.EntityContact.findOne({
         where: { id, entity_id: entityId },
      });
      if (!contact) {
         throw boom.notFound("Contacto no encontrado");
      }
      return contact;
   }

   async create(entityId, data) {
      const rutClean = cleanRut(data.rut);
      if (!rutClean) {
         throw boom.badRequest("El RUT del contacto es requerido");
      }

      // Verificar si ya existe en esta entidad
      const existing = await models.EntityContact.findOne({
         where: { entity_id: entityId, rut: rutClean },
      });

      if (existing) {
         // Si ya existe, actualizamos los datos manuales
         await existing.update({
            name: data.name ? data.name.trim() : existing.name,
            type: data.type || existing.type,
            email: data.email !== undefined ? data.email : existing.email,
            phone: data.phone !== undefined ? data.phone : existing.phone,
            address: data.address !== undefined ? data.address : existing.address,
            notes: data.notes !== undefined ? data.notes : existing.notes,
         });
         return existing;
      }

      const newContact = await models.EntityContact.create({
         entity_id: entityId,
         rut: rutClean,
         name: String(data.name || "").trim() || rutClean,
         type: data.type || "PROVEEDOR",
         email: data.email || null,
         phone: data.phone || null,
         address: data.address || null,
         source: "MANUAL",
         notes: data.notes || null,
      });

      return newContact;
   }

   async update(entityId, id, changes) {
      const contact = await this.getById(entityId, id);
      const payload = { ...changes };

      if (payload.rut) {
         payload.rut = cleanRut(payload.rut);
      }
      if (payload.name) {
         payload.name = payload.name.trim();
      }

      await contact.update(payload);
      return contact;
   }

   async delete(entityId, id) {
      const contact = await this.getById(entityId, id);
      await contact.destroy();
      return { id };
   }

   /**
    * Sincroniza y extrae contactos a partir de documentos tributarios (FACT),
    * boletas de honorarios (BH) y reglas contables registradas para la entidad.
    */
   async syncFromSii(entityId) {
      // 1. Obtener todos los documentos SII con contraparte
      const docs = await models.EntitySiiDocument.findAll({
         where: {
            entity_id: entityId,
            counterparty_rut: { [Op.not]: null },
         },
         attributes: [
            "counterparty_rut",
            "counterparty_name",
            "doc_type_code",
            "operation_type",
         ],
         raw: true,
      });

      // 2. Obtener reglas contables con contraparte
      const rules = await models.AccountingRule.findAll({
         where: {
            entity_id: entityId,
            counterparty_rut: { [Op.not]: null },
         },
         attributes: ["counterparty_rut", "counterparty_name"],
         raw: true,
      });

      const map = new Map();

      // Procesar documentos
      for (const doc of docs) {
         const rawRut = cleanRut(doc.counterparty_rut);
         if (!rawRut) continue;

         const isBH = [1001, 1002].includes(Number(doc.doc_type_code));
         const isIncome = String(doc.operation_type || "").toUpperCase() === "INCOME";

         let type = "PROVEEDOR";
         let source = "SII_FACT";

         if (isBH) {
            type = "PRESTADOR_SERVICIOS";
            source = "SII_BH";
         } else if (isIncome) {
            type = "CLIENTE";
            source = "SII_FACT";
         }

         const name = doc.counterparty_name ? String(doc.counterparty_name).trim() : null;
         const existing = map.get(rawRut);

         if (!existing) {
            map.set(rawRut, { rut: rawRut, name: name || rawRut, type, source });
         } else {
            // Mejorar nombre si antes no tenia o era mas corto
            if (name && (!existing.name || existing.name === rawRut || existing.name.length < name.length)) {
               existing.name = name;
            }
         }
      }

      // Procesar reglas
      for (const rule of rules) {
         const rawRut = cleanRut(rule.counterparty_rut);
         if (!rawRut) continue;
         const name = rule.counterparty_name ? String(rule.counterparty_name).trim() : null;
         const existing = map.get(rawRut);

         if (!existing) {
            map.set(rawRut, { rut: rawRut, name: name || rawRut, type: "PROVEEDOR", source: "MANUAL" });
         } else if (name && (!existing.name || existing.name === rawRut)) {
            existing.name = name;
         }
      }

      // 3. Upsert en entity_contacts
      let created = 0;
      let updated = 0;

      for (const item of map.values()) {
         const existingDb = await models.EntityContact.findOne({
            where: { entity_id: entityId, rut: item.rut },
         });

         if (!existingDb) {
            await models.EntityContact.create({
               entity_id: entityId,
               rut: item.rut,
               name: item.name,
               type: item.type,
               source: item.source,
            });
            created++;
         } else {
            // Actualizar si el nombre actual en BD estaba vacío o era solo el RUT
            if (item.name && item.name !== item.rut && (!existingDb.name || existingDb.name === existingDb.rut)) {
               await existingDb.update({ name: item.name });
               updated++;
            }
         }
      }

      return {
         scanned: map.size,
         created,
         updated,
         total: await models.EntityContact.count({ where: { entity_id: entityId } }),
      };
   }

   /**
    * Selector rápido para dropdowns y modales con apertura instantánea
    */
   async searchForSelect(entityId, q = "", limit = 50) {
      const term = String(q || "").trim();
      const where = { entity_id: entityId };

      if (term.length > 0) {
         const cleaned = term.replace(/[.\s-]/g, "");
         where[Op.or] = [
            { name: { [Op.like]: `%${term}%` } },
            { rut: { [Op.like]: `%${term}%` } },
            { rut: { [Op.like]: `%${cleaned}%` } },
         ];
      }

      const rows = await models.EntityContact.findAll({
         where,
         order: [["name", "ASC"]],
         limit: Math.min(Number(limit) || 50, 100),
         raw: true,
      });

      return rows.map((r) => ({
         id: r.id,
         rut: r.rut,
         formattedRut: formatRut(r.rut),
         name: r.name,
         type: r.type,
         source: r.source,
      }));
   }
}

module.exports = new ContactsService();
