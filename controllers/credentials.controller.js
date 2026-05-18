const CredentialsService = require('../services/credentials.service');
const asyncHandler = require('../utils/helpers/asyncHandler');
const { logInfo } = require('../utils/logger');

const service = new CredentialsService();

function getActorId(req) {
   return Number(req.user?.sub || req.user?.id || req.userId);
}

const listCredentials = asyncHandler(async (req, res) => {
   const out = await service.list({
      entityId: req.entityId || req.params.entityId,
      type: req.query.type || null,
      limit: Math.min(Math.max(Number(req.query.limit) || 50, 1), 200),
      offset: Math.max(Number(req.query.offset) || 0, 0),
   });

   res.json(out);
});

const getCredential = asyncHandler(async (req, res) => {
   const row = await service.findOne({
      entityId: req.entityId || req.params.entityId,
      credentialId: req.params.credentialId,
   });

   res.json({ ok: true, row });
});

const createCredential = asyncHandler(async (req, res) => {
   const row = await service.create({
      entityId: req.entityId || req.params.entityId,
      actorId: getActorId(req),
      payload: req.body || {},
   });

   logInfo('ENTITY_CREDENTIAL_CREATED', {
      rid: req.rid,
      userId: getActorId(req),
      entityId: Number(req.entityId || req.params.entityId),
      credentialId: row.id,
      type: row.type
   });

   res.status(201).json({ ok: true, row });
});

const updateCredential = asyncHandler(async (req, res) => {
   const row = await service.update({
      entityId: req.entityId || req.params.entityId,
      credentialId: req.params.credentialId,
      payload: req.body || {},
   });

   logInfo('ENTITY_CREDENTIAL_UPDATED', {
      rid: req.rid,
      userId: getActorId(req),
      entityId: Number(req.entityId || req.params.entityId),
      credentialId: row.id,
      type: row.type
   });

   res.json({ ok: true, row });
});

const deleteCredential = asyncHandler(async (req, res) => {
   const out = await service.delete({
      entityId: req.entityId || req.params.entityId,
      credentialId: req.params.credentialId,
   });

   logInfo('ENTITY_CREDENTIAL_DELETED', {
      rid: req.rid,
      userId: getActorId(req),
      entityId: Number(req.entityId || req.params.entityId),
      credentialId: Number(req.params.credentialId)
   });

   res.json(out);
});

const revealCredential = asyncHandler(async (req, res) => {
   const out = await service.reveal({
      entityId: req.entityId || req.params.entityId,
      credentialId: req.params.credentialId,
   });

   logInfo('ENTITY_CREDENTIAL_REVEALED', {
      rid: req.rid,
      userId: getActorId(req),
      entityId: Number(req.entityId || req.params.entityId),
      credentialId: Number(req.params.credentialId),
      type: out.row?.type
   });

   res.json(out);
});

module.exports = {
   listCredentials,
   getCredential,
   createCredential,
   updateCredential,
   deleteCredential,
   revealCredential,
};
