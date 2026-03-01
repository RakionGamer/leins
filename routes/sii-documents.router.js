const express = require('express');
const boom = require('@hapi/boom');
const { Op } = require('sequelize');
const SiiDocumentsService = require('../services/sii-document.service');
const { models } = require('../libs/sequelize');

const validatorHandler = require('../middlewares/validator.handler');
const { createManualIncomeSchema } = require('../schemas/sii-document.schema');

const router = express.Router();
const service = new SiiDocumentsService();

router.get('/', async (req, res, next) => {
   try {
      const q = req.query || {};

      // validaciones basicas de formato
      const isYYYYMM = (s) => /^\d{4}-\d{2}$/.test(String(s));
      const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));

      // normalizar y validar month/from/to
      const month = q.month ? String(q.month) : undefined;
      const from = q.from ? String(q.from) : undefined;
      const to = q.to ? String(q.to) : undefined;

      if (month && !isYYYYMM(month)) throw boom.badRequest('parametro "month" invalido; esperado YYYY-MM');
      if (from && !isYYYYMMDD(from)) throw boom.badRequest('parametro "from" invalido; esperado YYYY-MM-DD');
      if (to && !isYYYYMMDD(to)) throw boom.badRequest('parametro "to" invalido; esperado YYYY-MM-DD');

      // mapear type: acepta codigo (33), slug/nombre (factura_exenta) o la palabra 'null'
      let typeCode;
      if (q.type != null && q.type !== '') {
         const typeRaw = String(q.type).trim();
         
         // agregamos la excepcion para el string 'null' que manda el front
         if (typeRaw === 'null') {
            typeCode = 'null';
         } else if (/^\d+$/.test(typeRaw)) {
            typeCode = Number(typeRaw);
         } else {
            // buscar por slug (lowercase) o por nombre
            const docType = await models.SiiDocumentType.findOne({
               where: {
                  [Op.or]: [
                     { slug: typeRaw.toLowerCase() },
                     { name: typeRaw },
                  ],
               },
               attributes: ['code', 'slug', 'name'],
            });
            if (!docType) throw boom.badRequest('parametro "type" invalido; use codigo sii o slug conocido');
            typeCode = docType.code;
         }
      }

      // paginacion y orden
      const page = q.page ? Number(q.page) : 1;
      const limit = q.limit ? Number(q.limit) : 50; // el service recorta a max 200
      const sort = q.sort ? String(q.sort) : 'issue_date'; // permitido: issue_date, folio, total_amount, created_at, updated_at
      const order = q.order ? String(q.order) : 'desc';    // asc | desc

     const payload = {
         entity_id: q.entity_id ? Number(q.entity_id) : undefined,
         type: typeCode,
         source: q.source ? String(q.source) : undefined,
         month,
         from: month ? undefined : from,
         to: month ? undefined : to,
         page,
         limit,
         sort,
         order,
      };

      const out = await service.list(payload);

      // link headers (rfc 5988) para navegacion de paginas
      const totalPages = Math.max(1, Math.ceil(out.total / out.pageSize));
      const makeUrl = (p) => {
         const u = new URL(`${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`);
         const params = new URLSearchParams(req.query);
         params.set('page', String(p));
         params.set('limit', String(out.pageSize));
         u.search = params.toString();
         return u.toString();
      };
      const links = [];
      links.push(`<${makeUrl(1)}>; rel="first"`);
      links.push(`<${makeUrl(totalPages)}>; rel="last"`);
      if (out.page > 1) links.push(`<${makeUrl(out.page - 1)}>; rel="prev"`);
      if (out.page < totalPages) links.push(`<${makeUrl(out.page + 1)}>; rel="next"`);
      res.set('Link', links.join(', '));

      // respuesta
      res.status(200).json({
         data: out.items,
         total: out.total,
         page: out.page,
         pageSize: out.pageSize,
         hasPrev: out.page > 1,
         hasNext: out.page < totalPages,
         totalPages,
      });
   } catch (err) {
      next(err);
   }
});

router.post('/manual',
   validatorHandler(createManualIncomeSchema, 'body'),
   async (req, res, next) => {
      try {
         const payload = req.body;

         const newDocument = await service.createManual(payload);

         res.status(201).json({
            message: 'ingreso manual registrado con exito',
            data: newDocument
         });
      } catch (err) {
         next(err);
      }
   }
);

module.exports = router;