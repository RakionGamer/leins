const express = require('express');
const boom = require('@hapi/boom');
const EntitiesService = require('../services/entities.service');

// IMPORTACIONES NUEVAS
const NotificationService = require('../services/notification.service');
const dteScraper = require('../scripts/sii-dte-consult');
const boletaScraper = require('../scripts/sii-boletas-consult');

const router = express.Router();
const service = new EntitiesService();


// Instanciamos
const notifService = new NotificationService();

// Middleware SuperAdmin
router.use((req, _res, next) => {
   req.isSuperAdmin = true;
   req.superAdminId = Number(req.userId);
   next();
});

router.get('/', async (req, res, next) => {
   try {
      const parsed = {
         q: (req.query.q ?? '').trim() || null,
         limit: Math.min(Math.max(parseInt(req.query.limit ?? '20', 10), 1), 100),
         offset: Math.max(parseInt(req.query.offset ?? '0', 10), 0),
         activeOnly: String(req.query.activeOnly).toLowerCase() === 'true'
      };

      if (req.isSuperAdmin) {
         const out = await service.listAll(parsed);
         return res.json(out);
      }

      if (!req.user?.id) return next(boom.unauthorized('no autenticado'));
      const out = await service.listForUser({ ...parsed, userId: Number(req.user.id) });
      res.json(out);
   } catch (err) {
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

// Endpoint Sincronización SII
router.post('/:id/sync-sii', async (req, res, next) => {
   try {
      const entityId = req.params.id;
      const { year, month, type } = req.body;
      const userId = req.superAdminId || req.user?.id;

      if (!year || !month || !type) throw boom.badRequest('faltan parametros');

      // 1. RESPONDER INMEDIATAMENTE
      res.json({
         ok: true,
         message: 'proceso iniciado en segundo plano. te avisaremos cuando termine.'
      });

      // 2. EJECUTAR EN SEGUNDO PLANO
      (async () => {
         try {
            console.log(`🔄 background sync: ${type} ${year}-${month} para entity ${entityId}`);
            
            const isFullYear = month === 'ALL';
            const targetMonth = isFullYear ? 'ALL' : month; 

            let result;
            if (type === 'invoices') {
               result = await dteScraper.runManualSync(entityId, year, targetMonth);
            } else {
               result = await boletaScraper.runManualSync(entityId, year, targetMonth);
            }

            // Verificamos antes de llamar
            if (notifService && typeof notifService.create === 'function') {
               await notifService.create({
                  userId,
                  type: 'success',
                  title: 'sincronizacion sii finalizada',
                  message: `la carga de ${type === 'invoices' ? 'facturas' : 'boletas'} (${year}-${isFullYear ? 'completo' : month}) ha terminado exitosamente.`
               });
            } else {
               console.error('❌ Error: notifService.create no está disponible');
            }

         } catch (err) {
            console.error('❌ error en background sync:', err);
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

   } catch (err) {
      next(err);
   }
});

module.exports = router;