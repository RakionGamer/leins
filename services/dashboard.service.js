"use strict";

const boom = require('@hapi/boom');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../libs/sequelize');

function parsePeriod(month, scope = 'month') {
   if (!/^\d{4}-\d{2}$/.test(String(month || ''))) {
      throw boom.badRequest('parametro "month" invalido; esperado yyyy-mm');
   }

   const [year, monthNumber] = String(month).split('-').map(Number);
   if (!year || !monthNumber || monthNumber < 1 || monthNumber > 12) {
      throw boom.badRequest('parametro "month" invalido; esperado yyyy-mm');
   }

   const normalizedScope = scope === 'year' ? 'year' : 'month';
   if (normalizedScope === 'year') {
      return {
         scope: 'year',
         year,
         monthNumber: null,
         start: `${year}-01-01`,
         end: `${year + 1}-01-01`,
         period: String(year),
         sourceMonth: `${year}-${String(monthNumber).padStart(2, '0')}`,
      };
   }

   const start = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
   const nextYear = monthNumber === 12 ? year + 1 : year;
   const nextMonth = monthNumber === 12 ? 1 : monthNumber + 1;
   const end = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

   return {
      scope: 'month',
      year,
      monthNumber,
      start,
      end,
      period: `${year}-${String(monthNumber).padStart(2, '0')}`,
      sourceMonth: `${year}-${String(monthNumber).padStart(2, '0')}`,
   };
}

function toNumber(value) {
   const parsed = Number(value || 0);
   return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBucket(row = {}) {
   return {
      total: toNumber(row.total),
      net: toNumber(row.net),
      vat: toNumber(row.vat),
      exempt: toNumber(row.exempt),
      count: toNumber(row.count),
   };
}

function previousPeriod(period) {
   if (period.scope === 'year') {
      const year = period.year - 1;
      return {
         scope: 'year',
         year,
         monthNumber: null,
         start: `${year}-01-01`,
         end: `${year + 1}-01-01`,
         period: String(year),
      };
   }

   const previousMonth = period.monthNumber === 1 ? 12 : period.monthNumber - 1;
   const previousYear = period.monthNumber === 1 ? period.year - 1 : period.year;
   const nextYear = previousMonth === 12 ? previousYear + 1 : previousYear;
   const nextMonth = previousMonth === 12 ? 1 : previousMonth + 1;

   return {
      scope: 'month',
      year: previousYear,
      monthNumber: previousMonth,
      start: `${previousYear}-${String(previousMonth).padStart(2, '0')}-01`,
      end: `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`,
      period: `${previousYear}-${String(previousMonth).padStart(2, '0')}`,
   };
}

const MONTH_NAMES = [
   'enero',
   'febrero',
   'marzo',
   'abril',
   'mayo',
   'junio',
   'julio',
   'agosto',
   'septiembre',
   'octubre',
   'noviembre',
   'diciembre',
];

function periodDisplayLabel(period) {
   if (period.scope === 'year') return String(period.year);
   return `${MONTH_NAMES[period.monthNumber - 1]} ${period.year}`;
}

function compareValue(current, previous) {
   const currentValue = toNumber(current);
   const previousValue = toNumber(previous);
   const diff = currentValue - previousValue;
   let changePercent = null;
   let state = 'new';

   if (previousValue === 0 && currentValue === 0) {
      changePercent = 0;
      state = 'no_change';
   } else if (previousValue === 0) {
      state = 'new';
   } else {
      changePercent = (diff / Math.abs(previousValue)) * 100;
      state = diff === 0 ? 'no_change' : currentValue === 0 ? 'ended' : 'changed';
   }

   return {
      current: currentValue,
      previous: previousValue,
      diff,
      changePercent,
      state,
   };
}

function compareBucket(current, previous) {
   return {
      total: compareValue(current.total, previous.total),
      count: compareValue(current.count, previous.count),
      net: compareValue(current.net, previous.net),
      vat: compareValue(current.vat, previous.vat),
      exempt: compareValue(current.exempt, previous.exempt),
   };
}

function daysInMonth(year, monthNumber) {
   return new Date(year, monthNumber, 0).getDate();
}

function normalizeDateKey(value) {
   if (!value) return '';
   if (typeof value === 'string') return value.slice(0, 10);
   if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 10);
   }
   return String(value).slice(0, 10);
}

function buildDailySeries({ year, monthNumber, rows }) {
   const byDate = Object.fromEntries(rows.map((row) => [normalizeDateKey(row.date), row]));
   const days = daysInMonth(year, monthNumber);

   return Array.from({ length: days }, (_, index) => {
      const day = index + 1;
      const date = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const row = byDate[date] || {};
      const sales = toNumber(row.sales);
      const purchases = toNumber(row.purchases);

      return {
         date,
         day,
         sales,
         purchases,
         result: sales - purchases,
      };
   });
}

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function normalizeMonthKey(value) {
   if (!value) return '';
   if (typeof value === 'string') return value.slice(0, 7);
   if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value.toISOString().slice(0, 7);
   }
   return String(value).slice(0, 7);
}

function buildMonthlySeries({ year, rows }) {
   const byMonth = Object.fromEntries(rows.map((row) => [normalizeMonthKey(row.date), row]));

   return Array.from({ length: 12 }, (_, index) => {
      const monthNumber = index + 1;
      const date = `${year}-${String(monthNumber).padStart(2, '0')}`;
      const row = byMonth[date] || {};
      const sales = toNumber(row.sales);
      const purchases = toNumber(row.purchases);

      return {
         date,
         day: MONTH_LABELS[index],
         label: MONTH_LABELS[index],
         sales,
         purchases,
         result: sales - purchases,
      };
   });
}

const SII_SYNC_TYPES = [
   { type: 'boletas', label: 'Boletas' },
   { type: 'sales-invoices', label: 'Facturas de venta' },
   { type: 'invoices', label: 'Compras' },
];

const DOC_TYPE_LABELS = {
   33: 'Factura electrónica',
   34: 'Factura exenta electrónica',
   39: 'Boleta electrónica',
   41: 'Boleta exenta electrónica',
   56: 'Nota de débito electrónica',
   61: 'Nota de crédito electrónica',
};

function docTypeLabel(code, name) {
   const numericCode = Number(code);
   if (name) return name;
   if (Number.isInteger(numericCode) && DOC_TYPE_LABELS[numericCode]) return DOC_TYPE_LABELS[numericCode];
   if (Number.isInteger(numericCode)) return `Documento tipo ${numericCode}`;
   return 'Sin tipo de documento';
}

function normalizeCompositionRows(rows, bucket, totalAmount) {
   return rows
      .filter((row) => row.bucket === bucket)
      .map((row) => {
         const total = toNumber(row.total);
         const code = row.doc_type_code === null || row.doc_type_code === undefined ? null : Number(row.doc_type_code);

         return {
            code,
            label: docTypeLabel(code, row.doc_type_name),
            count: toNumber(row.count),
            total,
            net: toNumber(row.net),
            vat: toNumber(row.vat),
            exempt: toNumber(row.exempt),
            share: totalAmount > 0 ? (total / totalAmount) * 100 : 0,
         };
      });
}

function normalizeSyncJob(row = null, type, label) {
   if (!row) {
      return {
         type,
         label,
         status: 'missing',
         jobId: null,
         startedAt: null,
         finishedAt: null,
         rowsProcessed: 0,
         rowsInserted: 0,
         rowsUpdated: 0,
         rowsSkipped: 0,
         errorMessage: null,
      };
   }

   return {
      type: row.sync_type,
      label,
      status: row.status,
      jobId: row.id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      rowsProcessed: toNumber(row.rows_processed),
      rowsInserted: toNumber(row.rows_inserted),
      rowsUpdated: toNumber(row.rows_updated),
      rowsSkipped: toNumber(row.rows_skipped),
      errorMessage: row.error_message || null,
   };
}

function formatPercent(value) {
   return `${Math.abs(Number(value || 0)).toFixed(1).replace('.', ',')}%`;
}

function addComparisonAlerts(alerts, comparison) {
   const label = comparison?.label || 'el periodo anterior';
   const salesChange = Number(comparison?.sales?.total?.changePercent || 0);
   const purchasesChange = Number(comparison?.purchases?.total?.changePercent || 0);
   const resultChange = Number(comparison?.result?.total?.changePercent || 0);
   const vatChange = Number(comparison?.vat?.balance?.changePercent || 0);
   const vatCurrent = Number(comparison?.vat?.balance?.current || 0);

   if (salesChange <= -20) {
      alerts.push({
         type: 'sales_drop',
         severity: 'warning',
         title: 'Ventas bajo el periodo anterior',
         message: `Las ventas bajaron ${formatPercent(salesChange)} respecto a ${label}.`,
      });
   }

   if (purchasesChange >= 30) {
      alerts.push({
         type: 'purchases_growth',
         severity: 'warning',
         title: 'Compras sobre el periodo anterior',
         message: `Las compras subieron ${formatPercent(purchasesChange)} respecto a ${label}.`,
      });
   }

   if (resultChange <= -25) {
      alerts.push({
         type: 'result_drop',
         severity: 'warning',
         title: 'Resultado menor al periodo anterior',
         message: `El resultado bajo ${formatPercent(resultChange)} respecto a ${label}.`,
      });
   }

   if (vatCurrent > 0 && vatChange >= 25) {
      alerts.push({
         type: 'vat_growth',
         severity: 'info',
         title: 'IVA por pagar en aumento',
         message: `El IVA por pagar subio ${formatPercent(vatChange)} respecto a ${label}.`,
      });
   }
}

function addCompositionAlerts(alerts, composition) {
   const salesItems = Array.isArray(composition?.sales) ? composition.sales : [];
   const purchasesItems = Array.isArray(composition?.purchases) ? composition.purchases : [];
   const salesCreditNotes = salesItems.find((item) => Number(item.code) === 61);
   const purchasesCreditNotes = purchasesItems.find((item) => Number(item.code) === 61);
   const topSales = salesItems[0];
   const topPurchases = purchasesItems[0];

   if (salesCreditNotes && Number(salesCreditNotes.share || 0) >= 15) {
      alerts.push({
         type: 'sales_credit_notes_weight',
         severity: 'warning',
         title: 'Notas de credito relevantes',
         message: `Las notas de credito representan ${formatPercent(salesCreditNotes.share)} de las ventas del periodo.`,
      });
   }

   if (purchasesCreditNotes && Number(purchasesCreditNotes.share || 0) >= 15) {
      alerts.push({
         type: 'purchase_credit_notes_weight',
         severity: 'warning',
         title: 'Notas de credito en compras',
         message: `Las notas de credito representan ${formatPercent(purchasesCreditNotes.share)} de las compras del periodo.`,
      });
   }

   if (topSales && Number(topSales.share || 0) >= 85 && salesItems.length > 1) {
      alerts.push({
         type: 'sales_type_concentration',
         severity: 'info',
         title: 'Ventas concentradas por tipo',
         message: `${topSales.label} concentra ${formatPercent(topSales.share)} de las ventas del periodo.`,
      });
   }

   if (topPurchases && Number(topPurchases.share || 0) >= 85 && purchasesItems.length > 1) {
      alerts.push({
         type: 'purchase_type_concentration',
         severity: 'info',
         title: 'Compras concentradas por tipo',
         message: `${topPurchases.label} concentra ${formatPercent(topPurchases.share)} de las compras del periodo.`,
      });
   }
}

function buildAlerts({ sales, purchases, vatBalance, sync, comparison, composition }) {
   const alerts = [];

   if (!sales.count && !purchases.count) {
      alerts.push({
         type: 'no_movements',
         severity: 'warning',
         title: 'Sin movimientos del periodo',
         message: 'No se encontraron ventas ni compras para el periodo seleccionado.',
      });
   }

   if (purchases.total > sales.total && purchases.total > 0) {
      alerts.push({
         type: 'purchases_over_sales',
         severity: 'warning',
         title: 'Compras mayores que ventas',
         message: 'Las compras del periodo superan las ventas registradas.',
      });
   }

   if (vatBalance > 0) {
      alerts.push({
         type: 'vat_payable',
         severity: 'info',
         title: 'IVA por pagar estimado',
         message: 'El IVA debito supera al IVA credito en el periodo seleccionado.',
      });
   }

   addComparisonAlerts(alerts, comparison);
   addCompositionAlerts(alerts, composition);

   for (const item of sync) {
      if (item.status === 'failed') {
         alerts.push({
            type: `sync_failed_${item.type}`,
            severity: 'danger',
            title: `Ultima sincronizacion fallida: ${item.label}`,
            message: item.errorMessage || 'Revisa el detalle de sincronizaciones para este proceso.',
         });
      }

      if (item.status === 'missing') {
         alerts.push({
            type: `sync_missing_${item.type}`,
            severity: 'warning',
            title: `Sin sincronizacion SII: ${item.label}`,
            message: 'No hay sincronizaciones registradas para este tipo en el periodo seleccionado.',
         });
      }
   }

   return alerts;
}

async function aggregateDocumentBuckets({ entityId, period }) {
   const rows = await sequelize.query(
      `
      SELECT
         CASE
            WHEN operation_type = 'INCOME' OR (operation_type IS NULL AND doc_type_code IN (39, 41)) THEN 'INCOME'
            WHEN operation_type = 'EXPENSE' OR (
               operation_type IS NULL
               AND (
                  doc_type_code IS NULL
                  OR doc_type_code NOT IN (39, 41)
               )
            ) THEN 'EXPENSE'
            ELSE 'OTHER'
         END AS bucket,
         COUNT(*) AS count,
         COALESCE(SUM(total_amount), 0) AS total,
         COALESCE(SUM(amount_net), 0) AS net,
         COALESCE(SUM(amount_vat), 0) AS vat,
         COALESCE(SUM(amount_exempt), 0) AS exempt
      FROM entity_sii_documents
      WHERE entity_id = :entityId
        AND issue_date >= :startDate
        AND issue_date < :endDate
      GROUP BY bucket
      `,
      {
         type: QueryTypes.SELECT,
         replacements: {
            entityId,
            startDate: period.start,
            endDate: period.end,
         },
      }
   );

   const byBucket = Object.fromEntries(rows.map((row) => [row.bucket, row]));
   const sales = normalizeBucket(byBucket.INCOME);
   const purchases = normalizeBucket(byBucket.EXPENSE);

   return {
      sales,
      purchases,
      resultTotal: sales.total - purchases.total,
      vatBalance: sales.vat - purchases.vat,
   };
}

async function documentTypeComposition({ entityId, period, salesTotal, purchasesTotal }) {
   const rows = await sequelize.query(
      `
      SELECT
         CASE
            WHEN d.operation_type = 'INCOME' OR (d.operation_type IS NULL AND d.doc_type_code IN (39, 41)) THEN 'INCOME'
            WHEN d.operation_type = 'EXPENSE' OR (
               d.operation_type IS NULL
               AND (
                  d.doc_type_code IS NULL
                  OR d.doc_type_code NOT IN (39, 41)
               )
            ) THEN 'EXPENSE'
            ELSE 'OTHER'
         END AS bucket,
         d.doc_type_code,
         dt.name AS doc_type_name,
         COUNT(*) AS count,
         COALESCE(SUM(d.total_amount), 0) AS total,
         COALESCE(SUM(d.amount_net), 0) AS net,
         COALESCE(SUM(d.amount_vat), 0) AS vat,
         COALESCE(SUM(d.amount_exempt), 0) AS exempt
      FROM entity_sii_documents d
      LEFT JOIN sii_document_types dt ON dt.code = d.doc_type_code
      WHERE d.entity_id = :entityId
        AND d.issue_date >= :startDate
        AND d.issue_date < :endDate
      GROUP BY bucket, d.doc_type_code, dt.name
      ORDER BY bucket ASC, total DESC, count DESC
      `,
      {
         type: QueryTypes.SELECT,
         replacements: {
            entityId,
            startDate: period.start,
            endDate: period.end,
         },
      }
   );

   return {
      sales: normalizeCompositionRows(rows, 'INCOME', salesTotal),
      purchases: normalizeCompositionRows(rows, 'EXPENSE', purchasesTotal),
   };
}

class DashboardService {
   async monthlySummary({ entityId, month, scope = 'month' }) {
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId es requerido');
      }

      const period = parsePeriod(month, scope);

      const aggregate = await aggregateDocumentBuckets({ entityId: parsedEntityId, period });
      const previous = previousPeriod(period);
      const previousAggregate = await aggregateDocumentBuckets({ entityId: parsedEntityId, period: previous });
      const { sales, purchases, resultTotal, vatBalance } = aggregate;
      const composition = await documentTypeComposition({
         entityId: parsedEntityId,
         period,
         salesTotal: sales.total,
         purchasesTotal: purchases.total,
      });
      const syncPeriodCondition = period.scope === 'year'
         ? 'AND period_month IS NULL'
         : 'AND period_month = :periodMonth';
      const syncRows = await sequelize.query(
         `
         SELECT j.*
         FROM sii_sync_jobs j
         INNER JOIN (
            SELECT sync_type, MAX(id) AS id
            FROM sii_sync_jobs
            WHERE entity_id = :entityId
              AND period_year = :periodYear
              ${syncPeriodCondition}
              AND sync_type IN ('boletas', 'sales-invoices', 'invoices')
            GROUP BY sync_type
         ) latest ON latest.id = j.id
         ORDER BY j.created_at DESC, j.id DESC
         `,
         {
            type: QueryTypes.SELECT,
            replacements: {
               entityId: parsedEntityId,
               periodYear: period.year,
               periodMonth: period.monthNumber,
            },
         }
      );
      const dateSelect = period.scope === 'year'
         ? "DATE_FORMAT(issue_date, '%Y-%m') AS date"
         : 'issue_date AS date';
      const groupByDate = period.scope === 'year'
         ? "DATE_FORMAT(issue_date, '%Y-%m')"
         : 'issue_date';
      const dailyRows = await sequelize.query(
         `
         SELECT
            ${dateSelect},
            COALESCE(SUM(
               CASE
                  WHEN operation_type = 'INCOME' OR (operation_type IS NULL AND doc_type_code IN (39, 41))
                  THEN total_amount
                  ELSE 0
               END
            ), 0) AS sales,
            COALESCE(SUM(
               CASE
                  WHEN operation_type = 'EXPENSE' OR (
                     operation_type IS NULL
                     AND (
                        doc_type_code IS NULL
                        OR doc_type_code NOT IN (39, 41)
                     )
                  )
                  THEN total_amount
                  ELSE 0
               END
            ), 0) AS purchases
         FROM entity_sii_documents
         WHERE entity_id = :entityId
           AND issue_date >= :startDate
           AND issue_date < :endDate
         GROUP BY ${groupByDate}
         ORDER BY ${groupByDate} ASC
         `,
         {
            type: QueryTypes.SELECT,
            replacements: {
               entityId: parsedEntityId,
               startDate: period.start,
               endDate: period.end,
            },
         }
      );
      const syncByType = Object.fromEntries(syncRows.map((row) => [row.sync_type, row]));
      const sync = SII_SYNC_TYPES.map((item) => normalizeSyncJob(syncByType[item.type], item.type, item.label));
      const comparison = {
         period: previous.period,
         label: periodDisplayLabel(previous),
         sales: compareBucket(sales, previousAggregate.sales),
         purchases: compareBucket(purchases, previousAggregate.purchases),
         result: {
            total: compareValue(resultTotal, previousAggregate.resultTotal),
         },
         vat: {
            balance: compareValue(vatBalance, previousAggregate.vatBalance),
            debit: compareValue(sales.vat, previousAggregate.sales.vat),
            credit: compareValue(purchases.vat, previousAggregate.purchases.vat),
         },
      };
      const alerts = buildAlerts({ sales, purchases, vatBalance, sync, comparison, composition });

      return {
         period: period.period,
         scope: period.scope,
         granularity: period.scope === 'year' ? 'month' : 'day',
         sourceMonth: period.sourceMonth,
         entityId: parsedEntityId,
         sales,
         purchases,
         result: {
            total: resultTotal,
         },
         vat: {
            debit: sales.vat,
            credit: purchases.vat,
            balance: vatBalance,
         },
         comparison,
         composition,
         daily: period.scope === 'year'
            ? buildMonthlySeries({
               year: period.year,
               rows: dailyRows,
            })
            : buildDailySeries({
               year: period.year,
               monthNumber: period.monthNumber,
               rows: dailyRows,
            }),
         sync,
         alerts,
      };
   }
}

module.exports = DashboardService;
