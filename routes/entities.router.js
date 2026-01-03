const express = require('express');
const boom = require('@hapi/boom');
const EntitiesService = require('../services/entities.service');

const router = express.Router();
const service = new EntitiesService();

// este router corre DESPUÉS de jwtValidate (ya montado en index.js)
router.use((req, _res, next) => {
   req.isSuperAdmin = true;                  // con tu flujo actual
   req.superAdminId = Number(req.userId);    // viene del JWT (payload.sub)
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

      // (futuro) usuarios no superadmin:
      if (!req.user?.id) return next(boom.unauthorized('no autenticado'));
      const out = await service.listForUser({ ...parsed, userId: Number(req.user.id) });
      res.json(out);
   } catch (err) {
      next(err.isBoom ? err : boom.badImplementation(err.message));
   }
});

module.exports = router;
