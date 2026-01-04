// dependencias y carga de entorno
require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { randomUUID } = require('crypto');

// importacion de modulos locales
const routerApi = require('./routes');
const { logErrors, ormErrorHandler, boomErrorHandler, errorHandler } = require('./middlewares/error.handler');

// inicializacion de la app
const app = express();
const port = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

// configuracion basica y proxy
app.disable('x-powered-by');
if (isProd) {
   // confiar en el proxy (nginx/elb)
   app.set('trust proxy', 1);
}

// 1. middlewares de seguridad (helmet)
app.use(helmet({
   // sin csp para evitar falsos positivos
   contentSecurityPolicy: false,
   // evita problemas de cross-origin
   crossOriginEmbedderPolicy: false,
   // politica de referer estricta
   referrerPolicy: { policy: 'no-referrer' },
   // permite cargar recursos de otros origenes (necesario para las imagenes)
   crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// hsts solo en produccion
if (isProd) {
   app.use(helmet.hsts({
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
   }));
}

// 2. configuracion de cors
const parseCsv = (v = '') => v.split(',').map(s => s.trim()).filter(Boolean);
const originsProd = parseCsv(process.env.CORS_ORIGIN || '');
const originsDev = parseCsv(process.env.CORS_ORIGIN_DEV || '');
const allowedOrigins = new Set(isProd ? originsProd : [...originsProd, ...originsDev]);
const allowCredentials = String(process.env.CORS_CREDENTIALS || 'false').toLowerCase() === 'true';

const corsOptions = {
   origin(origin, cb) {
      // permitir solicitudes sin origen (curl/postman)
      if (!origin) return cb(null, true);
      return allowedOrigins.has(origin) ? cb(null, true) : cb(null, false);
   },
   credentials: allowCredentials,
   methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
   exposedHeaders: ['x-request-id'],
   maxAge: 86400,
   optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
// habilitar pre-flight para todas las rutas
app.options(/^\/api\/v1\/.*/, cors(corsOptions));

// 3. identificador de solicitud
app.use((req, res, next) => {
   req.rid = randomUUID();
   res.set('x-request-id', req.rid);
   next();
});

// 4. parsers de cuerpo (json y urlencoded)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. archivos estaticos (imagenes de avatar)
app.use('/avatars', express.static(path.join(__dirname, 'public/avatars')));

// 6. control de cache para autenticacion
app.use(/^\/api\/v1\/auth\/.*/, (req, res, next) => {
   res.set('Cache-Control', 'no-store');
   res.set('Pragma', 'no-cache');
   next();
});

// 7. definicion de rutas
app.get('/', (req, res) => res.send('Hola mi server en express ' + port));
routerApi(app);

// 8. manejo de 404 no encontrado
app.use((req, res) => res.status(404).json({ message: 'Not found' }));

// 9. manejadores de errores (orden importante)
app.use(logErrors);
app.use(ormErrorHandler);
app.use(boomErrorHandler);
app.use(errorHandler);

// iniciar servidor
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