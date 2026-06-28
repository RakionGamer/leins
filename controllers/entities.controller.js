const boom = require('@hapi/boom');
const EntitiesService = require('../services/entities.service');
const NotificationService = require('../services/notification.service');
const SiiSyncJobService = require('../services/sii-sync-job.service');
const dteScraper = require('../scripts/sii-dte-consult');
const boletaScraper = require('../scripts/sii-boletas-consult');
const salesInvoiceScraper = require('../scripts/sii-ventas-facturas-consult');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');

// instanciamos los servicios
const service = new EntitiesService();
const notifService = new NotificationService();
const siiSyncJobService = new SiiSyncJobService();

// controlador para listar entidades
const listEntities = asyncHandler(async (req, res) => {
   const parsed = {
      id: req.query.id ? Number(req.query.id) : null,
      q: (req.query.q ?? '').trim() || null,
      limit: Math.min(Math.max(parseInt(req.query.limit ?? '20', 10), 1), 200),
      offset: Math.max(parseInt(req.query.offset ?? '0', 10), 0),
      activeOnly: String(req.query.activeOnly).toLowerCase() === 'true',
      sort: String(req.query.sort || 'name').toLowerCase(),
      order: String(req.query.order || 'asc').toLowerCase(),
   };

   if (parsed.id != null && (!Number.isInteger(parsed.id) || parsed.id <= 0)) {
      throw boom.badRequest('id invalido');
   }

   // validacion super admin
   if (req.isSuperAdmin) {
      const actorId = Number(req.user?.id || req.user?.sub);
      const out = await service.listForSuperAdmin({ ...parsed, superAdminId: actorId });
      return res.json(out);
   }

   // validacion usuario normal
   const actorId = Number(req.user?.id || req.user?.sub);
   if (!Number.isInteger(actorId) || actorId <= 0) {
      throw boom.unauthorized('no autenticado');
   }

   const out = await service.listForUser({ ...parsed, userId: actorId });
   res.json(out);
});

const createEntity = asyncHandler(async (req, res) => {
   if (!req.isSuperAdmin) throw boom.forbidden('solo super admin');

   const { name, rut, legal_name, tax_id, state_id } = req.body || {};
   const row = await service.create({
      name: name ?? legal_name,
      rut: rut ?? tax_id,
      stateId: state_id,
      actorId: req.user?.sub || req.user?.id
   });

   logInfo('ENTITY_CREATED', {
      rid: req.rid,
      entityId: row.id,
      name: row.name,
      rut: row.rut,
      author: req.user?.sub || req.user?.id
   });

   res.status(201).json({ ok: true, row });
});

const updateEntity = asyncHandler(async (req, res) => {
   if (!req.isSuperAdmin) throw boom.forbidden('solo super admin');

   const { id } = req.params;
   const { name, rut, legal_name, tax_id, state_id } = req.body || {};

   const row = await service.update(id, {
      name: name ?? legal_name,
      rut: rut ?? tax_id,
      stateId: state_id
   });

   logInfo('ENTITY_UPDATED', {
      rid: req.rid,
      entityId: Number(id),
      author: req.user?.sub || req.user?.id,
      updatedFields: Object.keys(req.body || {})
   });

   res.status(200).json({ ok: true, row });
});

const deleteEntity = asyncHandler(async (req, res) => {
   if (!req.isSuperAdmin) throw boom.forbidden('solo super admin');

   const { id } = req.params;
   const out = await service.delete(id);

   logInfo(out.deleted ? 'ENTITY_DELETED' : 'ENTITY_DEACTIVATED', {
      rid: req.rid,
      entityId: Number(id),
      author: req.user?.sub || req.user?.id,
      deleted: Boolean(out.deleted),
      deactivated: Boolean(out.deactivated),
      blockedBy: out.blockedBy || []
   });

   res.status(200).json({ ok: true, ...out });
});

// controlador para sincronizacion sii en segundo plano
const syncSii = asyncHandler(async (req, res) => {
   const entityId = req.params.entityId || req.params.id || req.entityId;
   const { year, month, type, types, documentTypes } = req.body;
   const userId = req.superAdminId || req.user?.id;

   if (!year || !month || !type) {
      throw boom.badRequest('faltan parametros');
   }

   const { job, duplicated, staleJobId } = await siiSyncJobService.create({
      entityId,
      requestedBy: userId,
      syncType: type,
      year,
      month,
   });

   if (duplicated) {
      logInfo('SII_SYNC_DUPLICATED', {
         rid: req.rid,
         userId,
         entityId,
         jobId: job.id,
         year,
         month,
         type
      });

      return res.json({
         ok: true,
         duplicated: true,
         jobId: job.id,
         message: 'ya existe una sincronizacion en proceso para esta entidad, tipo y periodo.'
      });
   }

   // log de auditoria: inicio de sincronizacion sii
   logInfo('SII_SYNC_TRIGGERED', {
      rid: req.rid,
      userId,
      entityId,
      jobId: job.id,
      staleJobId,
      year,
      month,
      type
   });

   // 1. responder inmediatamente al cliente
   res.json({
      ok: true,
      jobId: job.id,
      staleJobId,
      message: 'proceso iniciado en segundo plano. te avisaremos cuando termine.'
   });

   // 2. ejecutar proceso en segundo plano
   (async () => {
      try {
         await siiSyncJobService.markRunning(job.id);
         console.log(`background sync: ${type} ${year}-${month} para entity ${entityId}`);

         const isFullYear = month === 'ALL';
         const targetMonth = isFullYear ? 'ALL' : month;
         let result;

         if (type === 'sales-invoices') {
            result = await salesInvoiceScraper.runManualSync(entityId, year, targetMonth, {
               types: types || documentTypes || null,
            });
         } else if (type === 'invoices') {
            result = await dteScraper.runManualSync(entityId, year, targetMonth);
         } else {
            result = await boletaScraper.runManualSync(entityId, year, targetMonth);
         }

         if (result && result.ok === false) {
            throw new Error(result.message || 'la sincronizacion SII no pudo completarse');
         }

         await siiSyncJobService.markSuccess(job.id, result);

         // verificamos antes de crear la notificacion
         if (notifService && typeof notifService.create === 'function') {
            await notifService.create({
               userId,
               type: 'success',
               title: 'sincronizacion sii finalizada',
               message: `la carga de ${type === 'sales-invoices' ? 'facturas de venta' : type === 'invoices' ? 'facturas' : 'boletas'} (${year}-${isFullYear ? 'completo' : month}) ha terminado exitosamente.`
            });
         } else {
            console.error('error: notifservice.create no esta disponible');
         }

      } catch (err) {
         console.error('error en background sync:', err);
         await siiSyncJobService.markFailed(job.id, err).catch((jobErr) => {
            console.error('error actualizando job sii:', jobErr);
         });

         if (notifService && typeof notifService.create === 'function') {
            await notifService.create({
               userId,
               type: 'error',
               title: 'error en sincronizacion sii',
               message: `ocurrio un fallo al cargar ${type}: ${err.message}`
            });
         }
      }
   })();
});

const listSiiSyncJobs = asyncHandler(async (req, res) => {
   const entityId = req.params.entityId || req.entityId;
   const out = await siiSyncJobService.list({
      entityId,
      status: req.query.status || null,
      syncType: req.query.type || null,
      limit: req.query.limit,
      offset: req.query.offset,
   });

   res.json(out);
});

module.exports = {
   listEntities,
   createEntity,
   updateEntity,
   deleteEntity,
   syncSii,
   listSiiSyncJobs
};
