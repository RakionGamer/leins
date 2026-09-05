const boom = require('@hapi/boom');
const SiiDocumentsService = require('../services/sii-document.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');
const { toCsv } = require('../utils/toCsv');

const service = new SiiDocumentsService();

// construye el payload de filtros/orden/paginacion compartido entre listado y exportacion csv
function buildListPayload(req) {
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

   return {
      entity_id: req.entityId ? Number(req.entityId) : (q.entity_id ? Number(q.entity_id) : undefined),
      type: typeCode,
      q: q.q ? String(q.q) : (q.search ? String(q.search) : undefined),
      folio: q.folio ? String(q.folio) : undefined,
      client: q.client ? String(q.client) : undefined,
      source: q.source ? String(q.source) : undefined,
      operation_type: q.operation_type ? String(q.operation_type).toUpperCase() : undefined,
      month,
      from: month ? undefined : from,
      to: month ? undefined : to,
      page,
      limit,
      sort,
      order,
      pendingOnly: ['1', 'true', 'yes'].includes(String(q.pendingOnly || '').toLowerCase()),
      status: q.status ? String(q.status).toLowerCase() : undefined,
   };
}

// controlador para listar documentos
const listDocuments = asyncHandler(async (req, res) => {
   const payload = buildListPayload(req);
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

const CSV_COLUMNS = [
   { header: 'Fecha Emision', value: (r) => (r.issue_date ? String(r.issue_date).slice(0, 10) : '') },
   { header: 'Folio', value: (r) => r.folio ?? '' },
   { header: 'Tipo Documento', value: (r) => r.doc_type_name || r.doc_type_code || '' },
   { header: 'RUT Contraparte', value: (r) => r.counterparty_rut ?? '' },
   { header: 'Razon Social', value: (r) => r.counterparty_name ?? '' },
   { header: 'Fecha Vencimiento', value: (r) => (r.due_date ? String(r.due_date).slice(0, 10) : '') },
   { header: 'Monto Neto', value: (r) => r.amount_net ?? 0 },
   { header: 'Monto IVA', value: (r) => r.amount_vat ?? 0 },
   { header: 'Monto Exento', value: (r) => r.amount_exempt ?? 0 },
   { header: 'Monto Total', value: (r) => r.total_amount ?? 0 },
   { header: 'Saldo Pendiente', value: (r) => r.remaining_amount ?? 0 },
   { header: 'Origen', value: (r) => r.source ?? '' },
];

// controlador para exportar el listado filtrado a csv
const exportDocumentsCsv = asyncHandler(async (req, res) => {
   const payload = buildListPayload(req);
   const items = await service.exportAll(payload);
   const csv = toCsv(items, CSV_COLUMNS);

   logInfo('SII_DOCUMENTS_EXPORTED_CSV', {
      rid: req.rid,
      userId: req.user?.sub,
      entityId: payload.entity_id,
      operationType: payload.operation_type,
      rows: items.length,
   });

   const filename = `documentos_${payload.operation_type ? payload.operation_type.toLowerCase() + '_' : ''}${new Date().toISOString().slice(0, 10)}.csv`;
   res.status(200)
      .set('Content-Type', 'text/csv; charset=utf-8')
      .set('Content-Disposition', `attachment; filename="${filename}"`)
      .send(csv);
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

const dailySalesGroups = asyncHandler(async (req, res) => {
   const q = req.query || {};
   const isYYYYMMDD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s));

   const from = q.from ? String(q.from) : null;
   const to = q.to ? String(q.to) : null;

   if (!from || !to) throw boom.badRequest('from y to son requeridos');
   if (!isYYYYMMDD(from)) throw boom.badRequest('parametro "from" invalido; esperado yyyy-mm-dd');
   if (!isYYYYMMDD(to)) throw boom.badRequest('parametro "to" invalido; esperado yyyy-mm-dd');
   if (from > to) throw boom.badRequest('rango de fechas invalido: "from" debe ser menor o igual que "to"');

   const out = await service.dailySalesGroups({
      entity_id: req.entityId || q.entity_id || q.entityId,
      from,
      to,
   });

   res.status(200).json({
      data: out,
      total: out.length,
   });
});

module.exports = {
   listDocuments,
   exportDocumentsCsv,
   dailySalesGroups,
   createManualDocument,
   updateDocument,
   deleteDocument
};
