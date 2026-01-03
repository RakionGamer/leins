// dependencias
require('dotenv').config(); // carga .env
const express = require('express');
const routerApi = require('./routes');
const cors = require('cors');
const { logErrors, ormErrorHandler, boomErrorHandler, errorHandler } = require('./middlewares/error.handler');
const { randomUUID } = require('crypto');
const helmet = require('helmet');

const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// seguridad/infra básica
app.disable('x-powered-by');
if (isProd) app.set('trust proxy', 1); // nginx/elb

// request id
app.use((req, res, next) => {
   req.rid = randomUUID();
   res.set('x-request-id', req.rid);
   next();
});

// body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // forms (activar si lo usas)

// 🔐 HELMET (headers de seguridad)
app.use(helmet({
   // API pura: sin CSP para evitar falsos positivos (lo puedes activar luego)
   contentSecurityPolicy: false,
   // Evita problemas con COEP/COEP si no los necesitas
   crossOriginEmbedderPolicy: false,
   // Política de referer estricta
   referrerPolicy: { policy: 'no-referrer' },
   // frameguard, nosniff, dnsPrefetch, etc. vienen activos por defecto
}));

// HSTS solo si estás en prod (y sirviendo por HTTPS)
if (isProd) {
   app.use(helmet.hsts({
      maxAge: 31536000,           // 1 año
      includeSubDomains: true,
      preload: true
   }));
}

// ❄️ No-cache para endpoints sensibles (evita cachear respuestas de auth)
app.use(/^\/api\/v1\/auth\/.*/, (req, res, next) => {
   res.set('Cache-Control', 'no-store');      // no guardar en caché
   res.set('Pragma', 'no-cache');
   next();
});

// ===== CORS estricto (ANTES de las rutas) =====
const parseCsv = (v = '') => v.split(',').map(s => s.trim()).filter(Boolean);
const originsProd = parseCsv(process.env.CORS_ORIGIN || '');
const originsDev = parseCsv(process.env.CORS_ORIGIN_DEV || '');
const allowedOrigins = new Set(isProd ? originsProd : [...originsProd, ...originsDev]);

const allowCredentials = String(process.env.CORS_CREDENTIALS || 'false').toLowerCase() === 'true';

const corsOptions = {
   origin(origin, cb) {
      if (!origin) return cb(null, true);           // no-CORS (curl/servicios)
      return allowedOrigins.has(origin) ? cb(null, true) : cb(null, false);
   },
   credentials: allowCredentials,
   methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
   // 👇 ¡OJO! Quitamos `allowedHeaders`
   exposedHeaders: ['x-request-id'],
   maxAge: 86400,
   optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// Express 5: usa regex, no '*'
app.options(/^\/api\/v1\/.*/, cors(corsOptions));
// (opcional) especifico para login
app.options('/api/v1/auth/login', cors(corsOptions));

// ==============================================

// (opcional) bloqueador duro 403 si el Origin no está permitido (descomenta si lo quieres)
// app.use((req, res, next) => {
//   const origin = req.headers.origin;
//   if (origin && !allowedOrigins.has(origin)) {
//     return res.status(403).json({ message: 'CORS: Origin not allowed', origin, rid: req.rid });
//   }
//   next();
// });

// routes
app.get('/', (req, res) => res.send('Hola mi server en express ' + port));
routerApi(app);

// 404 al final de las rutas (sin next())
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// error handlers (en este orden)
app.use(logErrors);
app.use(ormErrorHandler);
app.use(boomErrorHandler);
app.use(errorHandler);

// inicio
app.listen(port, () => {
   if (isProd) {
      console.log(`Server listening on ${port}`);
   } else {
      console.log('Mi port: ' + port);
      console.log('Zona horaria activa:', process.env.TZ);
      console.log('Fecha/hora actual:', new Date());
      console.log('CORS allowed origins:', Array.from(allowedOrigins));
   }
});

module.exports = app;