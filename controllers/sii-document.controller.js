const boom = require('@hapi/boom');
const SiiDocumentsService = require('../services/sii-document.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');

const service = new SiiDocumentsService();

// controlador para listar documentos
const listDocuments = asyncHandler(async (req, res) => {
   const q = req.query || {};

   // validaciones basicas de formato
   const isYYYYMM = (s) => /^\d{4}-\d{2}$/.test(String(s));
   const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));

   // normalizar y validar month/from/to
   const month = q.month ? String(q.month) : undefined;
   const from = q.from ? String(q.from) : undefined;
   const to = q.to ? String(q.to) : undefined;

   if (month && !isYYYYMM(month)) throw boom.badRequest('parametro "month" invalido; esperado yyyy-mm');
   if (from && !isYYYYMMDD(from)) throw boom.badRequest('parametro "from" invalido; esperado yyyy-mm-dd');
   if (to && !isYYYYMMDD(to)) throw boom.badRequest('parametro "to" invalido; esperado yyyy-mm-dd');

   const page = q.page ? Number(q.page) : 1;
   const limit = q.limit ? Number(q.limit) : 50;
   const sort = q.sort ? String(q.sort) : 'issue_date';
   const order = q.order ? String(q.order) : 'desc';
   const typeCode = q.type !== undefined ? String(q.type) : undefined;

   // armar el payload para el servicio
   const payload = {
      entity_id: req.entityId ? Number(req.entityId) : (q.entity_id ? Number(q.entity_id) : undefined),
      type: typeCode,
      source: q.source ? String(q.source) : undefined,
      operation_type: q.operation_type ? String(q.operation_type).toUpperCase() : undefined,
      month,
      from: month ? undefined : from,
      to: month ? undefined : to,
      page,
      limit,
      sort,
      order,
   };

   const out = await service.list(payload);
   const totalPages = Math.max(1, Math.ceil(out.total / out.pageSize));

   // responder al cliente
   res.status(200).json({
      data: out.items,
      total: out.total,
      page: out.page,
      pageSize: out.pageSize,
      hasPrev: out.page > 1,
      hasNext: out.page < totalPages,
      totalPages,
   });
});

// controlador para crear ingreso o gasto manual
const createManualDocument = asyncHandler(async (req, res) => {
   const payload = req.body;
   const newDocument = await service.createManual(payload);

   // log de auditoria: documento manual creado
   logInfo('SII_DOCUMENT_MANUAL_CREATED', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId: payload.entity_id,
      documentType: payload.type,
      documentId: newDocument.id
   });

   res.status(201).json({
      message: 'registro manual creado con exito',
      data: newDocument
   });
});

// controlador para actualizar documento
const updateDocument = asyncHandler(async (req, res) => {
   const { id } = req.params;
   const payload = req.body;
   const updatedDocument = await service.update(id, payload);

   // log de auditoria: documento actualizado
   logInfo('SII_DOCUMENT_UPDATED', {
      rid: req.rid,
      userId: req.user?.sub,
      documentId: id,
      updatedFields: Object.keys(payload)
   });

   res.status(200).json({
      message: 'documento actualizado con exito',
      data: updatedDocument
   });
});

// controlador para eliminar documento
const deleteDocument = asyncHandler(async (req, res) => {
   const { id } = req.params;
   await service.delete(id);

   // log de auditoria: documento eliminado
   logInfo('SII_DOCUMENT_DELETED', {
      rid: req.rid,
      userId: req.user?.sub,
      documentId: id
   });

   res.status(200).json({
      message: 'documento eliminado con exito',
      data: { id }
   });
});

module.exports = {
   listDocuments,
   createManualDocument,
   updateDocument,
   deleteDocument
};
