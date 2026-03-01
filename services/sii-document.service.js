"use strict";

const { Op } = require('sequelize');
const Boom = require('@hapi/boom');
const { models } = require('../libs/sequelize');

class SiiDocumentsService {
   constructor() {
   }

   // metodo para registrar un ingreso manual
   async createManual(data) {
      const documentData = {
         ...data,
         source: 'MANUAL',
         state_id: data.state_id || 1
      };

      // creacion del registro en la base de datos
      const newDoc = await models.EntitySiiDocument.create(documentData);

      return newDoc;
   }

   // agregamos source a los parametros desestructurados
   async list({ entity_id, type, source, month, from, to, page = 1, limit = 50, sort = 'issue_date', order = 'desc' }) {
      // where base
      const where = {};
      if (entity_id) where.entity_id = Number(entity_id);
      
      // logica de filtrado por tipo de documento o sin tipo
      if (type) {
         if (type === 'null') {
            where.doc_type_code = null;
         } else {
            where.doc_type_code = Number(type);
         }
      }

      // nueva logica de filtrado por origen (sii o manual)
      if (source) {
         where.source = String(source).toUpperCase();
      }

      // helpers fecha (strings yyyy-mm-dd)
      const toYMD = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const parseYMD = (s) => {
         const [y, m, d] = String(s).split('-').map(Number);
         if (!y || !m || !d) return null;
         return { y, m, d };
      };

      // acumulamos condiciones en and para no pisar otras partes del where
      const setRange = (startStr, endExclStr) => {
         if (!where[Op.and]) where[Op.and] = [];
         if (startStr) where[Op.and].push({ issue_date: { [Op.gte]: startStr } });
         if (endExclStr) where[Op.and].push({ issue_date: { [Op.lt]: endExclStr } });
      };

      // prioridad: si viene month se ignoran from/to
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

      // columnas permitidas para orden
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

      // seleccionar columnas
      const attributes = [
         'id', 'entity_id', 'doc_type_code', 'counterparty_rut', 'counterparty_name', 'folio',
         'issue_date', 'due_date', 'total_amount', 'created_at', 'updated_at', 'source'
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
         source: r.source, 
         created_at: r.created_at,
         updated_at: r.updated_at,
      }));

      return { total: count, page: pageNum, pageSize, items };
   }
}

module.exports = SiiDocumentsService;