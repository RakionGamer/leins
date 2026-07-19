"use strict";

const { Op, QueryTypes } = require('sequelize');
const Boom = require('@hapi/boom');
const { models, sequelize } = require('../libs/sequelize');

const ALLOWED_EXPENSE_DOC_TYPES = new Set([33, 39, 1002]);

function documentReconcileAmountSql(alias) {
   return `CASE
      WHEN ${alias}.doc_type_code IN (1001,1002)
       AND COALESCE(${alias}.amount_net,0) > COALESCE(${alias}.amount_tax_no_credit,0)
       AND COALESCE(${alias}.amount_tax_no_credit,0) > 0
         THEN COALESCE(${alias}.amount_net,0) - COALESCE(${alias}.amount_tax_no_credit,0)
      ELSE COALESCE(${alias}.total_amount,0)
   END`;
}

function assertExpenseDocType(payload = {}) {
   if (String(payload.operation_type || '').toUpperCase() !== 'EXPENSE') return;

   const raw = payload.doc_type_code;
   if (raw === null || raw === undefined || raw === '') return;

   const parsed = Number(raw);
   if (!Number.isInteger(parsed) || !ALLOWED_EXPENSE_DOC_TYPES.has(parsed)) {
      throw Boom.badRequest('para egresos solo se permite BOLETAS (39), FACTURA (33), BOLETA DE HONORARIOS RECIBIDA (1002) o RECIBO (null)');
   }
}

class SiiDocumentsService {
   constructor() {
   }

   // metodo para registrar un ingreso manual
   async createManual(data) {
      assertExpenseDocType(data);

      const documentData = {
         ...data,
         source: 'MANUAL',
         state_id: data.state_id || 1
      };

      const newDoc = await models.EntitySiiDocument.create(documentData);
      return newDoc;
   }

   // metodo para actualizar un documento existente
   async update(id, changes) {
      const doc = await models.EntitySiiDocument.findByPk(id);
      if (!doc) throw Boom.notFound('documento no encontrado');

      if (doc.source !== 'MANUAL') {
         throw Boom.unauthorized('no esta permitido modificar documentos oficiales del sii');
      }

      assertExpenseDocType(changes);

      await doc.update(changes);
      return doc;
   }

   // metodo para eliminar
   async delete(id) {
      const doc = await models.EntitySiiDocument.findByPk(id);
      if (!doc) throw Boom.notFound('documento no encontrado');

      if (doc.source !== 'MANUAL') {
         throw Boom.unauthorized('no esta permitido eliminar documentos oficiales del sii');
      }

      await doc.destroy();
      return { id };
   }

   // listado general
   async list({ entity_id, type, source, operation_type, month, from, to, page = 1, limit = 50, sort = 'issue_date', order = 'desc', pendingOnly = false }) {
      const where = {};
      const parsedEntityId = Number(entity_id);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw Boom.badRequest('entity_id es requerido');
      }
      where.entity_id = parsedEntityId;

      // logica de retrocompatibilidad: 
      // los datos antiguos en bd tienen operation_type nulo.
      if (operation_type) {
         const op = String(operation_type).toUpperCase();
         if (!where[Op.and]) where[Op.and] = [];

         if (op === 'INCOME') {
            where[Op.and].push({
               [Op.or]: [
                  { operation_type: 'INCOME' },
                  { operation_type: null, doc_type_code: [39, 41, 1001] }
               ]
            });
         } else if (op === 'EXPENSE') {
            where[Op.and].push({
               [Op.or]: [
                  { operation_type: 'EXPENSE' },
                  { operation_type: null, doc_type_code: { [Op.notIn]: [39, 41, 1001] } },
                  { operation_type: null, doc_type_code: null }
               ]
            });
         }
      }

      if (type) {
         if (type === 'null') {
            where.doc_type_code = null;
         } else {
            where.doc_type_code = Number(type);
         }
      }

      if (source) {
         where.source = String(source).toUpperCase();
      }

      const toYMD = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const parseYMD = (s) => {
         const [y, m, d] = String(s).split('-').map(Number);
         if (!y || !m || !d) return null;
         return { y, m, d };
      };

      const setRange = (startStr, endExclStr) => {
         if (!where[Op.and]) where[Op.and] = [];
         if (startStr) where[Op.and].push({ issue_date: { [Op.gte]: startStr } });
         if (endExclStr) where[Op.and].push({ issue_date: { [Op.lt]: endExclStr } });
      };

      if (month) {
         const mm = parseYMD(`${month}-01`);
         if (!mm) throw Boom.badRequest('parametro "month" invalido; esperado yyyy-mm');
         const start = toYMD(mm.y, mm.m, 1);
         const endExcl = (mm.m === 12) ? toYMD(mm.y + 1, 1, 1) : toYMD(mm.y, mm.m + 1, 1);
         setRange(start, endExcl);
      } else if (from || to) {
         const f = from ? parseYMD(from) : null;
         const t = to ? parseYMD(to) : null;
         if (from && !f) throw Boom.badRequest('parametro "from" invalido; esperado yyyy-mm-dd');
         if (to && !t) throw Boom.badRequest('parametro "to" invalido; esperado yyyy-mm-dd');

         const plusOne = (y, m, d) => {
            const tmp = new Date(Date.UTC(y, m - 1, d));
            tmp.setUTCDate(tmp.getUTCDate() + 1);
            return toYMD(tmp.getUTCFullYear(), tmp.getUTCMonth() + 1, tmp.getUTCDate());
         };

         const startStr = f ? toYMD(f.y, f.m, f.d) : null;
         let endExclStr = null;
         if (t) endExclStr = plusOne(t.y, t.m, t.d);
         else if (f) endExclStr = plusOne(f.y, f.m, f.d);

         if (startStr && endExclStr && startStr >= endExclStr) {
            throw Boom.badRequest('rango de fechas invalido: "from" debe ser menor o igual que "to"');
         }
         setRange(startStr, endExclStr);
      }

      const sortMap = {
         issue_date: 'issue_date',
         folio: 'folio',
         total_amount: 'total_amount',
         created_at: 'created_at',
         updated_at: 'updated_at',
      };
      const sortCol = sortMap[sort] || 'issue_date';
      const dir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

      const pageNum = Math.max(1, Number(page) || 1);
      const pageSize = Math.max(1, Math.min(200, Number(limit) || 50));
      const offset = (pageNum - 1) * pageSize;
      const baseAlias = models.EntitySiiDocument.name || 'EntitySiiDocument';
      const baseQuoted = `\`${baseAlias}\``;
      const appliedSumSQL =
         `(SELECT COALESCE(SUM(btd.amount_applied),0)
         FROM bank_transaction_documents btd
         WHERE btd.entity_sii_document_id = ${baseQuoted}.id)`;
      const reconcileAmountSQL = documentReconcileAmountSql(baseQuoted);
      const remainingSQL = `((${reconcileAmountSQL}) - ${appliedSumSQL})`;

      if (pendingOnly) {
         if (!where[Op.and]) where[Op.and] = [];
         where[Op.and].push(
            sequelize.where(sequelize.literal(remainingSQL), { [Op.gt]: 0 })
         );
      }

      const attributes = [
         'id', 'entity_id', 'doc_type_code', 'counterparty_rut', 'counterparty_name', 'folio',
         'issue_date', 'due_date', 'total_amount', 'amount_net', 'amount_vat', 'amount_exempt',
         'amount_tax_no_credit', 'created_at', 'updated_at', 'source', 'operation_type',
         [sequelize.literal(remainingSQL), 'remaining_amount'],
      ];

      const { rows, count } = await models.EntitySiiDocument.findAndCountAll({
         where,
         attributes,
         include: [
            { model: models.Entity, as: 'entity', attributes: ['legal_name', 'tax_id'] },
            { model: models.SiiDocumentType, as: 'docType', attributes: ['code', 'slug', 'name'] },
         ],
         order: [[sortCol, dir], ['id', dir]],
         limit: pageSize,
         offset,
         distinct: true,
      });

      const items = rows.map((r) => ({
         id: r.id,
         entity_id: r.entity_id,
         legal_name: r.entity?.legal_name || null,
         tax_id: r.entity?.tax_id || null,
         doc_type_code: r.doc_type_code,
         doc_type_slug: r.docType?.slug ?? null,
         doc_type_name: r.docType?.name ?? null,
         counterparty_rut: r.counterparty_rut ?? null,
         counterparty_name: r.counterparty_name ?? null,
         folio: r.folio,
         issue_date: r.issue_date,
         due_date: r.due_date,
         total_amount: r.total_amount,
         amount_net: r.amount_net,
         amount_vat: r.amount_vat,
         amount_exempt: r.amount_exempt,
         amount_tax_no_credit: r.amount_tax_no_credit,
         remaining_amount: Number(r.get?.('remaining_amount') ?? r.total_amount ?? 0),
         source: r.source,
         operation_type: r.operation_type,
         created_at: r.created_at,
         updated_at: r.updated_at,
      }));

      return { total: count, page: pageNum, pageSize, items };
   }

   async dailySalesGroups({ entity_id, from, to }) {
      const parsedEntityId = Number(entity_id);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw Boom.badRequest('entity_id es requerido');
      }

      if (!from || !to) {
         throw Boom.badRequest('from y to son requeridos');
      }

      const reconcileAmountSQL = documentReconcileAmountSql("d");
      const rows = await sequelize.query(
         `
      SELECT
         d.id,
         d.doc_type_code,
         d.folio,
         d.issue_date,
         d.counterparty_rut,
         d.counterparty_name,
         d.total_amount,
         (
            (${reconcileAmountSQL}) -
            COALESCE((
               SELECT SUM(btd.amount_applied)
               FROM bank_transaction_documents btd
               WHERE btd.entity_sii_document_id = d.id
            ), 0)
         ) AS remaining_amount
      FROM entity_sii_documents d
      WHERE d.entity_id = :entityId
        AND d.doc_type_code IN (33, 34, 39, 41, 1001)
        AND d.issue_date >= :from
        AND d.issue_date < DATE_ADD(:to, INTERVAL 1 DAY)
        AND (
           d.operation_type = 'INCOME'
           OR (
              d.operation_type IS NULL
              AND d.doc_type_code IN (39, 41, 1001)
           )
        )
      HAVING remaining_amount > 0
      ORDER BY d.issue_date ASC, d.doc_type_code ASC, d.folio ASC
      `,
         {
            type: QueryTypes.SELECT,
            replacements: {
               entityId: parsedEntityId,
               from,
               to,
            },
         }
      );

      const grouped = new Map();

      for (const row of rows) {
         const date = String(row.issue_date).slice(0, 10);
         const pending = Number(row.remaining_amount || 0);
         if (!(pending > 0)) continue;

         const current = grouped.get(date) || {
            key: date,
            date,
            documents_count: 0,
            total_amount: 0,
            docs: [],
         };

         current.documents_count += 1;
         current.total_amount += pending;
         current.docs.push({
            id: Number(row.id),
            doc_type_code: Number(row.doc_type_code),
            folio: row.folio,
            issue_date: row.issue_date,
            counterparty_rut: row.counterparty_rut,
            counterparty_name: row.counterparty_name,
            total_amount: Number(row.total_amount || 0),
            remaining_amount: pending,
         });

         grouped.set(date, current);
      }

      return Array.from(grouped.values()).map((group) => ({
         ...group,
         total_amount: Math.round(group.total_amount),
      }));
   }
}

module.exports = SiiDocumentsService;
