const express = require('express');
const rateLimit = require('express-rate-limit');

const { jwtValidate } = require('../middlewares/auth.handler');
const validatorHandler = require('../middlewares/validator.handler');
const { loginSchema, recoverySchema, resetPasswordSchema } = require('../schemas/auth.schema');

// importamos el nuevo controlador
const authController = require('../controllers/auth.controller');

const router = express.Router();

// --- configuracion de limitadores (rate limiters) ---
const loginLimiter = rateLimit({
   windowMs: 15 * 60 * 1000,
   max: 20,
   standardHeaders: true,
   legacyHeaders: false
});

const refreshLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 60,
   standardHeaders: true,
   legacyHeaders: false
});

const sessionsGetLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 60,
   standardHeaders: true,
   legacyHeaders: false
});

const sessionsWriteLimiter = rateLimit({
   windowMs: 60 * 1000,
   max: 30,
   standardHeaders: true,
   legacyHeaders: false
});

// ==========================================
//  rutas publicas: autenticacion basica
// ==========================================

router.post('/login',
   loginLimiter,
   validatorHandler(loginSchema, 'body'),
   authController.login
);

router.post('/client/login',
   loginLimiter,
   validatorHandler(loginSchema, 'body'),
   authController.clientLogin
);

router.post('/refresh',
   refreshLimiter,
   authController.refresh
);

// ==========================================
//  rutas publicas: recuperacion de cuenta
// ==========================================

router.post('/recovery',
   validatorHandler(recoverySchema, 'body'),
   authController.recovery
);

router.post('/reset-password',
   validatorHandler(resetPasswordSchema, 'body'),
   authController.resetPassword
);

// ==========================================
//  rutas de gestion de sesiones (logout)
// ==========================================

router.post('/logout',
   sessionsWriteLimiter,
   authController.logout
);

// --- endpoints protegidos (requieren token jwt) ---

router.get('/sessions',
   jwtValidate,
   sessionsGetLimiter,
   authController.listSessions
);

router.delete('/sessions/:id',
   jwtValidate,
   sessionsWriteLimiter,
   authController.revokeSessionById
);

router.post('/sessions/revoke-others',
   jwtValidate,
   sessionsWriteLimiter,
   authController.revokeOthers
);

router.post('/logout-all',
   jwtValidate,
   sessionsWriteLimiter,
   authController.logoutAll
);

// ==========================================
//  rutas de 2fa (doble factor)
// ==========================================

router.post('/2fa/generate',
   jwtValidate,
   authController.generate2FA
);

router.post('/2fa/enable',
   jwtValidate,
   authController.enable2FA
);

router.post('/2fa/disable',
   jwtValidate,
   authController.disable2FA
);

router.post('/2fa/verify-login',
   authController.verify2FALogin
);

module.exports = router;