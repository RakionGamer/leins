const boom = require('@hapi/boom');
const { Op } = require('sequelize');
const { models } = require('../libs/sequelize');
const { config } = require('../config/config');

const VALID_SYNC_TYPES = new Set(['boletas', 'invoices', 'sales-invoices']);
const VALID_STATUSES = new Set(['pending', 'running', 'success', 'failed']);

function parsePeriodMonth(month) {
   if (String(month).toUpperCase() === 'ALL') return null;
   const parsed = Number(month);
   if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
      throw boom.badRequest('mes de sincronizacion invalido');
   }
   return parsed;
}

function mergeSkipReasons(target, source = {}) {
   for (const [key, value] of Object.entries(source || {})) {
      target[key] = (target[key] || 0) + Number(value || 0);
   }
}

function normalizeStats(result = {}) {
   const report = result.stats || result || {};
   const details = Array.isArray(report.details) ? report.details : [];
   const totals = {
      read: 0,
      processed: 0,
      inserted: 0,
      updated: 0,
      skipped: 0,
      skipReasons: {},
   };

   for (const detail of details) {
      const t = detail?.totals || {};
      const processed = Number(t.processed || 0);
      const skipped = Number(t.skipped || 0);

      totals.processed += processed;
      totals.inserted += Number(t.inserted || 0);
      totals.updated += Number(t.updated || 0);
      totals.skipped += skipped;
      totals.read += Number(t.read ?? (processed + skipped));
      mergeSkipReasons(totals.skipReasons, t.skipReasons);
   }

   if (!details.length) {
      const processed = Number(report.processed || report.count || 0);
      totals.processed = processed;
      totals.inserted = Number(report.inserted || processed || 0);
      totals.updated = Number(report.updated || 0);
      totals.skipped = Number(report.skipped || 0);
      totals.read = Number(report.read ?? (totals.processed + totals.skipped));
      mergeSkipReasons(totals.skipReasons, report.skipReasons);
   }

   return totals;
}

function getStaleLimitDate() {
   const minutes = Number(config.siiSyncStaleMinutes || 120);
   const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 120;
   return new Date(Date.now() - safeMinutes * 60 * 1000);
}

function getJobActivityDate(job) {
   return job.started_at || job.created_at || job.createdAt || null;
}

function isStaleJob(job) {
   const activityDate = getJobActivityDate(job);
   if (!activityDate) return false;
   return new Date(activityDate).getTime() < getStaleLimitDate().getTime();
}

class SiiSyncJobService {
   async create({ entityId, requestedBy, syncType, year, month }) {
      if (!VALID_SYNC_TYPES.has(syncType)) {
         throw boom.badRequest('tipo de sincronizacion SII invalido');
      }

      const periodYear = Number(year);
      if (!Number.isInteger(periodYear) || periodYear < 2000) {
         throw boom.badRequest('anio de sincronizacion invalido');
      }

      const parsedEntityId = Number(entityId);
      const periodMonth = parsePeriodMonth(month);

      const existing = await models.SiiSyncJob.findOne({
         where: {
            entity_id: parsedEntityId,
            sync_type: syncType,
            period_year: periodYear,
            period_month: periodMonth,
            status: { [Op.in]: ['pending', 'running'] },
         },
         order: [['created_at', 'DESC'], ['id', 'DESC']],
      });

      if (existing) {
         if (!isStaleJob(existing)) {
            return { job: existing, duplicated: true };
         }

         await existing.update({
            status: 'failed',
            finished_at: new Date(),
            error_message: 'Proceso marcado como fallido por exceder el tiempo maximo de ejecucion.',
         });
      }

      const row = await models.SiiSyncJob.create({
         entity_id: parsedEntityId,
         requested_by: requestedBy ? Number(requestedBy) : null,
         sync_type: syncType,
         period_year: periodYear,
         period_month: periodMonth,
         status: 'pending',
      });

      return { job: row, duplicated: false, staleJobId: existing?.id || null };
   }

   async markRunning(jobId) {
      const job = await this._get(jobId);
      await job.update({
         status: 'running',
         started_at: new Date(),
         error_message: null,
      });
      return job;
   }

   async markSuccess(jobId, result) {
      const job = await this._get(jobId);
      const totals = normalizeStats(result);
      await job.update({
         status: 'success',
         finished_at: new Date(),
         rows_read: totals.read,
         rows_processed: totals.processed,
         rows_inserted: totals.inserted,
         rows_updated: totals.updated,
         rows_skipped: totals.skipped,
         skip_reasons_json: Object.keys(totals.skipReasons).length ? totals.skipReasons : null,
         error_message: null,
      });
      return job;
   }

   async markFailed(jobId, err) {
      const job = await this._get(jobId);
      await job.update({
         status: 'failed',
         finished_at: new Date(),
         error_message: String(err?.message || err || 'error desconocido').slice(0, 4000),
      });
      return job;
   }

   async list({ entityId, status = null, syncType = null, limit = 20, offset = 0 }) {
      const where = { entity_id: Number(entityId) };

      if (status) {
         if (!VALID_STATUSES.has(status)) throw boom.badRequest('estado de job invalido');
         where.status = status;
      }

      if (syncType) {
         if (!VALID_SYNC_TYPES.has(syncType)) throw boom.badRequest('tipo de sincronizacion SII invalido');
         where.sync_type = syncType;
      }

      const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
      const pageOffset = Math.max(Number(offset) || 0, 0);

      const { rows, count } = await models.SiiSyncJob.findAndCountAll({
         where,
         include: [{
            model: models.SuperAdmin,
            as: 'requester',
            attributes: ['id', 'username', 'email', 'name', 'last_name'],
            required: false,
         }],
         order: [['created_at', 'DESC'], ['id', 'DESC']],
         limit: pageSize,
         offset: pageOffset,
      });

      return {
         total: count,
         limit: pageSize,
         offset: pageOffset,
         items: rows.map((row) => row.toJSON()),
      };
   }

   async _get(jobId) {
      const job = await models.SiiSyncJob.findByPk(jobId);
      if (!job) throw boom.notFound('job de sincronizacion no encontrado');
      return job;
   }
}

module.exports = SiiSyncJobService;
