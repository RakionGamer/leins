const boom = require('@hapi/boom');
const EntitiesService = require('../services/entities.service');
const NotificationService = require('../services/notification.service');
const dteScraper = require('../scripts/sii-dte-consult');
const boletaScraper = require('../scripts/sii-boletas-consult');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');

// instanciamos los servicios
const service = new EntitiesService();
const notifService = new NotificationService();

// controlador para listar entidades
const listEntities = asyncHandler(async (req, res) => {
   const parsed = {
      q: (req.query.q ?? '').trim() || null,
      limit: Math.min(Math.max(parseInt(req.query.limit ?? '20', 10), 1), 100),
      offset: Math.max(parseInt(req.query.offset ?? '0', 10), 0),
      activeOnly: String(req.query.activeOnly).toLowerCase() === 'true'
   };

   // validacion super admin
   if (req.isSuperAdmin) {
      const out = await service.listAll(parsed);
      return res.json(out);
   }

   // validacion usuario normal
   if (!req.user?.id) {
      throw boom.unauthorized('no autenticado');
   }

   const out = await service.listForUser({ ...parsed, userId: Number(req.user.id) });
   res.json(out);
});

// controlador para sincronizacion sii en segundo plano
const syncSii = asyncHandler(async (req, res) => {
   const entityId = req.params.id;
   const { year, month, type } = req.body;
   const userId = req.superAdminId || req.user?.id;

   if (!year || !month || !type) {
      throw boom.badRequest('faltan parametros');
   }

   // log de auditoria: inicio de sincronizacion sii
   logInfo('SII_SYNC_TRIGGERED', {
      rid: req.rid,
      userId,
      entityId,
      year,
      month,
      type
   });

   // 1. responder inmediatamente al cliente
   res.json({
      ok: true,
      message: 'proceso iniciado en segundo plano. te avisaremos cuando termine.'
   });

   // 2. ejecutar proceso en segundo plano
   (async () => {
      try {
         console.log(`background sync: ${type} ${year}-${month} para entity ${entityId}`);

         const isFullYear = month === 'ALL';
         const targetMonth = isFullYear ? 'ALL' : month;

         if (type === 'invoices') {
            await dteScraper.runManualSync(entityId, year, targetMonth);
         } else {
            await boletaScraper.runManualSync(entityId, year, targetMonth);
         }

         // verificamos antes de crear la notificacion
         if (notifService && typeof notifService.create === 'function') {
            await notifService.create({
               userId,
               type: 'success',
               title: 'sincronizacion sii finalizada',
               message: `la carga de ${type === 'invoices' ? 'facturas' : 'boletas'} (${year}-${isFullYear ? 'completo' : month}) ha terminado exitosamente.`
            });
         } else {
            console.error('error: notifservice.create no esta disponible');
         }

      } catch (err) {
         console.error('error en background sync:', err);

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

module.exports = {
   listEntities,
   syncSii
};