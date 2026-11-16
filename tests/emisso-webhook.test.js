const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const { models, sequelize } = require(path.join(repoRoot, 'libs/sequelize'));
const BankService = require(path.join(repoRoot, 'services/bank.service'));
const EmissoService = require(path.join(repoRoot, 'services/emisso.service'));
const app = require(path.join(repoRoot, 'app'));

function makeWhsec(label) {
   const keyBuf = crypto.createHash('sha256').update(label, 'utf8').digest();
   return {
      keyBuf,
      secret: `whsec_${keyBuf.toString('base64')}`,
   };
}

function signWebhook({ keyBuf, id, timestamp, rawBody }) {
   const digest = crypto
      .createHmac('sha256', keyBuf)
      .update(`${id}.${timestamp}.${rawBody}`, 'utf8')
      .digest('base64');
   return `v1,${digest}`;
}

test('Emisso webhook routing, signature verification, and sync behavior', async (t) => {
   const origFindAll = models.EntityBankAccount.findAll;
   const origFindOne = models.EntityBankAccount.findOne;
   const origSyncFromEmisso = BankService.prototype.syncFromEmisso;
   const origConsumeQuota = BankService.prototype.consumeManualSyncQuota;
   const origPersist = BankService.prototype.persistEmissoMovements;
   const origSyncBankConnection = EmissoService.prototype.syncBankConnection;
   const origGetAllMovements = EmissoService.prototype.getAllMovements;
   const origFetch = global.fetch;
   const origSecretEnv = process.env.EMISSO_WEBHOOK_SECRET;

   const syncCalls = [];
   const dbFindAllCalls = [];

   const server = http.createServer(app);
   await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
   const { port } = server.address();
   const baseUrl = `http://127.0.0.1:${port}/api/v1`;

   t.after(async () => {
      if (origSecretEnv === undefined) delete process.env.EMISSO_WEBHOOK_SECRET;
      else process.env.EMISSO_WEBHOOK_SECRET = origSecretEnv;

      global.fetch = origFetch;
      models.EntityBankAccount.findAll = origFindAll;
      models.EntityBankAccount.findOne = origFindOne;
      BankService.prototype.syncFromEmisso = origSyncFromEmisso;
      BankService.prototype.consumeManualSyncQuota = origConsumeQuota;
      BankService.prototype.persistEmissoMovements = origPersist;
      EmissoService.prototype.syncBankConnection = origSyncBankConnection;
      EmissoService.prototype.getAllMovements = origGetAllMovements;

      await new Promise((resolve) => server.close(resolve));
      await sequelize.close().catch(() => {});
   });

   await t.test('keeps all other /api/v1/banks endpoints protected by JWT', async () => {
      const protectedEndpoints = [
         ['GET', '/banks/accounts'],
         ['POST', '/banks/accounts'],
         ['POST', '/banks/accounts/1/sync-emisso'],
         ['GET', '/banks/transactions'],
         ['GET', '/banks/reconcile/list'],
         ['GET', '/banks/webhook-emisso'],
      ];
      for (const [method, endpoint] of protectedEndpoints) {
         const res = await origFetch(`${baseUrl}${endpoint}`, {
            method,
            headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
            body: method === 'POST' ? '{}' : undefined,
         });
         assert.equal(res.status, 401, `${method} ${endpoint} should reject unauthenticated requests`);
         const body = await res.json();
         assert.equal(body.code, 'AUTH_HEADER_MISSING');
      }
   });

   await t.test('fails closed with 503 when EMISSO_WEBHOOK_SECRET is missing', async () => {
      delete process.env.EMISSO_WEBHOOK_SECRET;
      const res = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ type: 'webhook.test' }),
      });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, 'EMISSO_WEBHOOK_SECRET_MISSING');
   });

   const primary = makeWhsec('primary-secret');
   const rotated = makeWhsec('rotated-secret');
   const wrong = makeWhsec('wrong-secret');

   await t.test('enforces Standard Webhooks headers, replay window, and HMAC signature on rawBody', async () => {
      process.env.EMISSO_WEBHOOK_SECRET = `${primary.secret},${rotated.secret}`;

      // Missing headers -> 401
      const resMissing = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ type: 'webhook.test' }),
      });
      assert.equal(resMissing.status, 401);
      assert.equal((await resMissing.json()).code, 'EMISSO_WEBHOOK_HEADERS_MISSING');

      // Non-numeric timestamp -> 401
      const resBadTs = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'webhook-id': 'whev_bad_ts',
            'webhook-timestamp': 'abc',
            'webhook-signature': 'v1,invalid',
         },
         body: '{}',
      });
      assert.equal(resBadTs.status, 401);
      assert.equal((await resBadTs.json()).code, 'EMISSO_WEBHOOK_TIMESTAMP_INVALID');

      // Expired timestamp (>300s) -> 401
      const oldTs = String(Math.floor(Date.now() / 1000) - 360);
      const expiredBody = JSON.stringify({ type: 'webhook.test' });
      const resExpired = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'webhook-id': 'whev_expired',
            'webhook-timestamp': oldTs,
            'webhook-signature': signWebhook({ keyBuf: primary.keyBuf, id: 'whev_expired', timestamp: oldTs, rawBody: expiredBody }),
         },
         body: expiredBody,
      });
      assert.equal(resExpired.status, 401);
      assert.equal((await resExpired.json()).code, 'EMISSO_WEBHOOK_TIMESTAMP_EXPIRED');

      // Invalid signature -> 401
      const ts = String(Math.floor(Date.now() / 1000));
      const badSigBody = JSON.stringify({ type: 'webhook.test' });
      const resBadSig = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'webhook-id': 'whev_bad_sig',
            'webhook-timestamp': ts,
            'webhook-signature': signWebhook({ keyBuf: wrong.keyBuf, id: 'whev_bad_sig', timestamp: ts, rawBody: badSigBody }),
         },
         body: badSigBody,
      });
      assert.equal(resBadSig.status, 401);
      assert.equal((await resBadSig.json()).code, 'EMISSO_WEBHOOK_SIGNATURE_INVALID');

      // Valid webhook.test with non-ASCII chars, non-compact formatting, and dual signature header (rotation)
      const validRaw = JSON.stringify(
         {
            data: { endpoint_id: 'whk_1', message: 'Evento de prueba — Comercial Aurorá SpA', test: true },
            timestamp: '2026-11-09T01:00:00.000Z',
            type: 'webhook.test',
         },
         null,
         2
      );
      const validSig = signWebhook({ keyBuf: rotated.keyBuf, id: 'whev_test_rot', timestamp: ts, rawBody: validRaw });
      const resValid = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'webhook-id': 'whev_test_rot',
            'webhook-timestamp': ts,
            'webhook-signature': `v1,staleSignature== ${validSig}`,
         },
         body: validRaw,
      });
      assert.equal(resValid.status, 200);
      const jsonValid = await resValid.json();
      assert.equal(jsonValid.ok, true);
      assert.equal(jsonValid.status, 'test_received');
   });

   async function postSigned(id, bodyObj) {
      const ts = String(Math.floor(Date.now() / 1000));
      const rawBody = JSON.stringify(bodyObj);
      const sig = signWebhook({ keyBuf: primary.keyBuf, id, timestamp: ts, rawBody });
      const res = await origFetch(`${baseUrl}/banks/webhook-emisso`, {
         method: 'POST',
         headers: {
            'Content-Type': 'application/json',
            'webhook-id': id,
            'webhook-timestamp': ts,
            'webhook-signature': sig,
         },
         body: rawBody,
      });
      return { status: res.status, json: await res.json() };
   }

   await t.test('routes Emisso sync events cleanly without loop or manual quota charge', async () => {
      process.env.EMISSO_WEBHOOK_SECRET = primary.secret;
      BankService.prototype.syncFromEmisso = async function (args) {
         syncCalls.push(args);
         return { ok: true, saved: 1, updated: 0, skipped: 0 };
      };
      models.EntityBankAccount.findAll = async (opts) => {
         dbFindAllCalls.push(opts?.where);
         if (opts?.where?.emisso_connection_id === 'conn_bch_123') {
            return [
               { id: 10, entity_id: 5, emisso_connection_id: 'conn_bch_123' },
               { id: 11, entity_id: 5, emisso_connection_id: 'conn_bch_123' },
            ];
         }
         return [];
      };

      const failOut = await postSigned('whev_sync_failed', {
         type: 'sync.failed',
         data: {
            job_id: 'sjb_fail',
            connection: { id: 'conn_bch_123', connector: 'bch_empresas' },
            last_error: 'upstream_error',
            periodo: '2026-11',
         },
      });
      assert.equal(failOut.status, 200);
      assert.equal(failOut.json.status, 'acknowledged_sync_failed');
      assert.equal(syncCalls.length, 0);

      const csOut = await postSigned('whev_connect_session', {
         type: 'connect_session.consumed',
         data: { session: { id: 'cs_1' }, connection: { id: 'conn_bch_123', connector: 'bch_empresas' } },
      });
      assert.equal(csOut.status, 200);
      assert.equal(csOut.json.status, 'ignored_event_type');

      const siiOut = await postSigned('whev_sii_sync', {
         type: 'sync.succeeded',
         data: { job_id: 'sjb_sii', connection: { id: 'conn_sii', connector: 'sii' }, alcances: ['rcv'], periodo: '2026-11' },
      });
      assert.equal(siiOut.status, 200);
      assert.equal(siiOut.json.status, 'ignored_non_bank_connector');
      assert.equal(dbFindAllCalls.length, 0);

      const saldosOut = await postSigned('whev_saldos_only', {
         type: 'sync.succeeded',
         data: { connection: { id: 'conn_bch_123', connector: 'bch_empresas' }, alcances: ['saldos'], periodo: '2026-11' },
      });
      assert.equal(saldosOut.status, 200);
      assert.equal(saldosOut.json.status, 'ignored_no_movimientos_scope');

      const okOut = await postSigned('whev_bch_sync_ok', {
         type: 'sync.succeeded',
         timestamp: '2026-11-09T04:00:00.000Z',
         data: {
            job_id: 'sjb_ok_1',
            connection: { id: 'conn_bch_123', connector: 'bch_empresas', label: 'Empresa SpA' },
            alcances: ['saldos', 'movimientos'],
            periodo: '2026-10',
            status: 'succeeded',
            records_synced: 25,
            trigger: 'scheduled',
         },
      });
      assert.equal(okOut.status, 200);
      assert.equal(okOut.json.status, 'queued');
      assert.equal(okOut.json.accountsQueued, 2);

      await new Promise((r) => setTimeout(r, 30));
      assert.equal(syncCalls.length, 2);
      assert.deepEqual(syncCalls, [
         { entityId: 5, bankAccountId: 10, periods: ['2026-10'], trackManualQuota: false, skipPortalSync: true },
         { entityId: 5, bankAccountId: 11, periods: ['2026-10'], trackManualQuota: false, skipPortalSync: true },
      ]);

      // Replay with same webhook-id must deduplicate cleanly
      const dupOut = await postSigned('whev_bch_sync_ok', {
         type: 'sync.succeeded',
         data: { connection: { id: 'conn_bch_123', connector: 'bch_empresas' }, alcances: ['movimientos'], periodo: '2026-10' },
      });
      assert.equal(dupOut.status, 200);
      assert.equal(dupOut.json.status, 'duplicate_ignored');
      assert.equal(syncCalls.length, 2);

      const unknownOut = await postSigned('whev_unmatched_conn', {
         type: 'sync.succeeded',
         data: { connection: { id: 'conn_other', connector: 'santander_empresas' }, alcances: ['movimientos'], periodo: '2026-11' },
      });
      assert.equal(unknownOut.status, 200);
      assert.equal(unknownOut.json.status, 'no_matching_account');
   });

   await t.test('BankService.syncFromEmisso honors skipPortalSync', async () => {
      BankService.prototype.syncFromEmisso = origSyncFromEmisso;
      let portalCalls = 0;
      let quotaCalls = 0;
      let movementQueries = 0;

      const fakeAccount = {
         id: 77,
         entity_id: 9,
         emisso_connection_id: 'conn_unit',
         emisso_system: 'bch_empresas',
         account_number: '123456',
         update: async () => fakeAccount,
      };
      models.EntityBankAccount.findOne = async () => fakeAccount;
      BankService.prototype.consumeManualSyncQuota = async () => {
         quotaCalls++;
         return { used: 1, limit: 100, remaining: 99, period: '2026-11' };
      };
      EmissoService.prototype.syncBankConnection = async () => {
         portalCalls++;
         return { estado: 'encolado' };
      };
      EmissoService.prototype.getAllMovements = async () => {
         movementQueries++;
         return [];
      };
      BankService.prototype.persistEmissoMovements = async () => ({ saved: 0, updated: 0, skipped: 0 });

      const svc = new BankService();
      await svc.syncFromEmisso({
         entityId: 9,
         bankAccountId: 77,
         periods: ['2026-11'],
         trackManualQuota: false,
         skipPortalSync: true,
      });
      assert.equal(portalCalls, 0);
      assert.equal(quotaCalls, 0);
      assert.equal(movementQueries, 1);

      await svc.syncFromEmisso({
         entityId: 9,
         bankAccountId: 77,
         periods: ['2026-11'],
         trackManualQuota: true,
      });
      assert.equal(portalCalls, 1);
      assert.equal(quotaCalls, 1);
      assert.equal(movementQueries, 2);
   });

   await t.test('EmissoService control-plane webhook helpers call exact Emisso API paths', async () => {
      const fetchCalls = [];
      global.fetch = async (url, init) => {
         fetchCalls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null });
         return {
            ok: true,
            status: 200,
            text: async () => JSON.stringify({ data: { ok: true } }),
         };
      };

      const emisso = new EmissoService('connect_sk_test', 'https://connect.emisso.ai/api/v1');
      await emisso.createWebhook({ url: 'https://api.leinsadvisor.cl/api/v1/banks/webhook-emisso' });
      await emisso.listWebhooks();
      await emisso.listWebhookDeliveries('whk_1', 25);
      await emisso.resendWebhookDelivery('whk_1', 'whd_9');
      await emisso.getSyncJob('sjb_1');

      assert.deepEqual(fetchCalls, [
         {
            url: 'https://connect.emisso.ai/api/v1/webhooks',
            method: 'POST',
            body: {
               url: 'https://api.leinsadvisor.cl/api/v1/banks/webhook-emisso',
               event_types: ['sync.succeeded', 'sync.failed'],
            },
         },
         { url: 'https://connect.emisso.ai/api/v1/webhooks', method: 'GET', body: null },
         { url: 'https://connect.emisso.ai/api/v1/webhooks/whk_1/deliveries?limit=25', method: 'GET', body: null },
         { url: 'https://connect.emisso.ai/api/v1/webhooks/whk_1/deliveries/whd_9/resend', method: 'POST', body: {} },
         { url: 'https://connect.emisso.ai/api/v1/syncs/sjb_1', method: 'GET', body: null },
      ]);
   });
});
