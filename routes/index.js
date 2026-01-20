// routes/index.js
const express = require('express');
const { jwtValidate } = require('./../middlewares/auth.handler');

const authRouter = require('./auth.router');
const statesRouter = require('./states.router');
const superAdminsRouter = require('./super-admin.router');
const siiDocumentsRouter = require('./sii-documents.router');
const BankRouter = require('./bank.router');
const EntitiesRouter = require('./entities.router');
const notificationsRouter = require('./notifications.router');

function routerApi(app) {
   const router = express.Router();
   app.use('/api/v1', router);

   router.use('/auth', authRouter);
   router.use('/state', jwtValidate, statesRouter);
   router.use('/super-admin', jwtValidate, superAdminsRouter);
   router.use('/sii-documents', jwtValidate, siiDocumentsRouter);
   router.use('/banks', jwtValidate, BankRouter);
   router.use('/entities', jwtValidate, EntitiesRouter);
   router.use('/notifications', jwtValidate, notificationsRouter);

}

module.exports = routerApi;