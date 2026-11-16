// middlewares/emisso-webhook.handler.js
const crypto = require('crypto');
const { config } = require('../config/config');
const { logWarn } = require('../utils/logger');

function parseWebhookSecrets(rawSecret) {
   return String(rawSecret || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((secret) => {
         const base64Part = secret.startsWith('whsec_')
            ? secret.slice('whsec_'.length)
            : secret;
         const key = Buffer.from(base64Part, 'base64');
         return key.length > 0 ? key : null;
      })
      .filter(Boolean);
}

function createEmissoWebhookVerifier(options = {}) {
   const toleranceSeconds = Number.isFinite(Number(options.toleranceSeconds))
      ? Number(options.toleranceSeconds)
      : (config.emissoWebhookToleranceSeconds || 300);

   return function verifyEmissoWebhook(req, res, next) {
      const configuredSecret = Object.prototype.hasOwnProperty.call(options, 'secret')
         ? options.secret
         : (process.env.EMISSO_WEBHOOK_SECRET ?? config.emissoWebhookSecret);

      const keys = parseWebhookSecrets(configuredSecret);
      if (!keys.length) {
         logWarn('EMISSO_WEBHOOK_SECRET_MISSING', {
            rid: req.rid || '-',
            message: 'EMISSO_WEBHOOK_SECRET no configurado en variables de entorno',
         });
         return res.status(503).json({
            statusCode: 503,
            error: 'Service Unavailable',
            message: 'emisso webhook secret is not configured',
            code: 'EMISSO_WEBHOOK_SECRET_MISSING',
         });
      }

      const webhookId = String(req.get('webhook-id') || '').trim();
      const tsHeader = String(req.get('webhook-timestamp') || '').trim();
      const sigHeader = String(req.get('webhook-signature') || '').trim();

      if (!webhookId || !tsHeader || !sigHeader) {
         return res.status(401).json({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'missing webhook verification headers',
            code: 'EMISSO_WEBHOOK_HEADERS_MISSING',
         });
      }

      if (!/^[1-9]\d*$/.test(tsHeader)) {
         return res.status(401).json({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'invalid webhook timestamp',
            code: 'EMISSO_WEBHOOK_TIMESTAMP_INVALID',
         });
      }

      const timestamp = Number(tsHeader);
      const nowSeconds = typeof options.nowFn === 'function'
         ? Number(options.nowFn())
         : Math.floor(Date.now() / 1000);

      if (!Number.isFinite(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
         logWarn('EMISSO_WEBHOOK_TIMESTAMP_EXPIRED', {
            rid: req.rid || '-',
            webhookId,
            timestamp,
            nowSeconds,
         });
         return res.status(401).json({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'webhook timestamp outside tolerance window',
            code: 'EMISSO_WEBHOOK_TIMESTAMP_EXPIRED',
         });
      }

      if (!Buffer.isBuffer(req.rawBody) && typeof req.rawBody !== 'string') {
         return res.status(400).json({
            statusCode: 400,
            error: 'Bad Request',
            message: 'raw request body required for webhook verification',
            code: 'EMISSO_WEBHOOK_RAW_BODY_MISSING',
         });
      }

      const rawBuf = Buffer.isBuffer(req.rawBody)
         ? req.rawBody
         : Buffer.from(req.rawBody, 'utf8');
      const prefixBuf = Buffer.from(`${webhookId}.${tsHeader}.`, 'utf8');
      const candidates = sigHeader.split(/\s+/).filter(Boolean);

      let matched = false;
      for (const key of keys) {
         const digest = crypto
            .createHmac('sha256', key)
            .update(prefixBuf)
            .update(rawBuf)
            .digest('base64');
         const expectedBuf = Buffer.from(`v1,${digest}`, 'utf8');

         for (const candidate of candidates) {
            if (!candidate.startsWith('v1,')) continue;
            const candidateBuf = Buffer.from(candidate, 'utf8');
            if (
               candidateBuf.length === expectedBuf.length &&
               crypto.timingSafeEqual(candidateBuf, expectedBuf)
            ) {
               matched = true;
               break;
            }
         }
         if (matched) break;
      }

      if (!matched) {
         logWarn('EMISSO_WEBHOOK_INVALID_SIGNATURE', {
            rid: req.rid || '-',
            webhookId,
         });
         return res.status(401).json({
            statusCode: 401,
            error: 'Unauthorized',
            message: 'invalid webhook signature',
            code: 'EMISSO_WEBHOOK_SIGNATURE_INVALID',
         });
      }

      req.emissoWebhook = {
         id: webhookId,
         timestamp,
      };
      return next();
   };
}

const verifyEmissoWebhook = createEmissoWebhookVerifier();

module.exports = {
   parseWebhookSecrets,
   createEmissoWebhookVerifier,
   verifyEmissoWebhook,
};
