const express = require('express');
const { jwtValidate } = require('../middlewares/auth.handler');

// importacion de rutas
const authRouter = require('./auth.router');
const statesRouter = require('./states.router');
const superAdminsRouter = require('./super-admin.router');
const siiDocumentsRouter = require('./sii-documents.router');
const bankRouter = require('./bank.router');
const entitiesRouter = require('./entities.router');
const notificationsRouter = require('./notifications.router');
const dashboardRouter = require('./dashboard.router');

function routerApi(app) {
   const router = express.Router();
   
   // prefijo global para la api
   app.use('/api/v1', router);

   // rutas publicas
   router.use('/auth', authRouter);

   // rutas protegidas con jwt
   router.use('/state', jwtValidate, statesRouter);
   router.use('/super-admin', jwtValidate, superAdminsRouter);
   router.use('/sii-documents', jwtValidate, siiDocumentsRouter);
   router.use('/banks', jwtValidate, bankRouter);
   router.use('/entities', jwtValidate, entitiesRouter);
   router.use('/notifications', jwtValidate, notificationsRouter);
   router.use('/dashboard', jwtValidate, dashboardRouter);
}

module.exports = routerApi;
