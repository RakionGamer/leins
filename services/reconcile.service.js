"use strict";

const boom = require('@hapi/boom');
const { sequelize } = require("../libs/sequelize");
const { QueryTypes } = require("sequelize");

class ReconcileService {

   async suggestions({
      entityId,
      accountId = null,
      type = null,               // 'income' | 'expense' | null
      dateFrom = null,           // 'YYYY-MM-DD'
      dateTo = null,             // 'YYYY-MM-DD'
      amountTolerance = 1.0,
      daysWindow = 3,
      limit = 50,
      offset = 0,
      search = null,
   }) {

      if (!entityId) throw boom.badRequest("entityId is required");

      // mapeo ventas/compras
      // para egresos (expense) solo compras recibidas: 33/34 y flag de recibido
      const whereDocsByType =
         type === "expense"
            ? "AND d.doc_type_code IN (33,34) AND (d.received_date IS NOT NULL OR d.purchase_type IS NOT NULL)"
            : type === "income"
            ? "AND (d.doc_type_code NOT IN (33,34) OR d.doc_type_code IS NULL)"
            : "";

      const whereSearch = search
         ? `AND (
            bt.description LIKE :search
            OR CAST(d.folio AS CHAR) LIKE :search
            OR d.counterparty_rut LIKE :search
         )`
         : "";

      const params = {
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: Number(daysWindow),
         limit: Number(limit),
         offset: Number(offset),
         search: search ? `%${search}%` : null,
      };
      if (type) params.typeParam = type;

      // query paginada (tu misma sql)
      const sql = `
         WITH bt AS (
            SELECT
            t.id,
            t.entity_id,
            t.entity_bank_account_id,
            t.type,
            t.amount,
            t.issued_at,
            t.description,
            (t.amount - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
            FROM entity_bank_transactions t
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_bank_transaction_id = t.id
            WHERE t.entity_id = :entityId
            ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
            ${type ? "AND t.type = :typeParam" : ""}
            ${dateFrom ? "AND t.issued_at >= :dateFrom" : ""}
            ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
            GROUP BY t.id
            HAVING remaining_amount > 0
         ),
         docs AS (
            SELECT
            d.id,
            d.entity_id,
            d.doc_type_code,
            d.folio,
            d.issue_date,
            d.counterparty_rut,
            d.total_amount,
            (d.total_amount - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
            FROM entity_sii_documents d
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_sii_document_id = d.id
            WHERE d.entity_id = :entityId
            ${whereDocsByType}
            GROUP BY d.id
            HAVING remaining_amount > 0
         )
         SELECT
            bt.id                       AS bank_tx_id,
            bt.entity_bank_account_id,
            bt.type,
            bt.amount,
            bt.issued_at,
            bt.description,
            bt.remaining_amount         AS bank_remaining,
            d.id                        AS doc_id,
            d.doc_type_code,
            d.folio,
            d.issue_date,
            d.counterparty_rut,
            d.total_amount,
            d.remaining_amount          AS doc_remaining
         FROM bt
         JOIN docs d
            ON ABS(bt.amount - d.total_amount) <= :amountTolerance
         AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
                              AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
         ${whereSearch}
         ORDER BY bt.issued_at DESC, bt.id DESC
         LIMIT :limit OFFSET :offset
      `;

      // *** NUEVO *** query de conteo real (mismas CTEs, join y filtros, SIN limit/offset)
      const sqlCount = `
         WITH bt AS (
            SELECT
            t.id,
            t.entity_id,
            t.entity_bank_account_id,
            t.type,
            t.amount,
            t.issued_at,
            t.description,
            (t.amount - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
            FROM entity_bank_transactions t
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_bank_transaction_id = t.id
            WHERE t.entity_id = :entityId
            ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
            ${type ? "AND t.type = :typeParam" : ""}
            ${dateFrom ? "AND t.issued_at >= :dateFrom" : ""}
            ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
            GROUP BY t.id
            HAVING remaining_amount > 0
         ),
         docs AS (
            SELECT
            d.id,
            d.entity_id,
            d.doc_type_code,
            d.folio,
            d.issue_date,
            d.counterparty_rut,
            d.total_amount,
            (d.total_amount - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
            FROM entity_sii_documents d
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_sii_document_id = d.id
            WHERE d.entity_id = :entityId
            ${whereDocsByType}
            GROUP BY d.id
            HAVING remaining_amount > 0
         )
         SELECT COUNT(DISTINCT bt.id) AS total
         FROM bt
         JOIN docs d
            ON ABS(bt.amount - d.total_amount) <= :amountTolerance
         AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
                              AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
         ${whereSearch}
      `;

      // 1) total real
      const [{ total }] = await sequelize.query(sqlCount, {
         replacements: params,
         type: QueryTypes.SELECT,
      });

      // 2) filas paginadas
      const rows = await sequelize.query(sql, {
         replacements: params,
         type: QueryTypes.SELECT,
      });

      if (!Array.isArray(rows)) { throw boom.badImplementation("unexpected query result: expected an array of rows"); }

      // agrupar por bank_tx_id y calcular score/best (igual que ya tenias)
      const byTx = new Map();
      for (const r of rows) {

         const key = r.bank_tx_id;
         if (!byTx.has(key)) {
            byTx.set(key, {
               bank_tx: {
                  id: r.bank_tx_id,
                  entity_bank_account_id: r.entity_bank_account_id,
                  type: r.type,
                  amount: Number(r.amount),
                  issued_at: r.issued_at,
                  description: r.description,
                  remaining_amount: Number(r.bank_remaining),
               },
               candidates: [],
            });
         }
         // dentro del for (const r of rows) { ... }

         const daysDiff = Math.abs(
            Math.floor((new Date(r.issue_date).getTime() - new Date(r.issued_at).setHours(0, 0, 0, 0)) / 86400000)
         );

         // diferencia y formatos
         const diffRaw = Number(r.total_amount) - Number(r.amount);
         const diffAbs = Math.abs(diffRaw);
         const diffFmt = Number.isInteger(diffAbs) ? String(diffAbs) : diffAbs.toFixed(2);

         // scores
         const scoreAmount = diffAbs <= Number(amountTolerance) ? 1 : 0;
         const scoreDate = Math.max(0, 1 - (daysDiff / Math.max(1, Number(params.daysWindow))));

         // helpers de normalizacion
         const normRut = (s) => String(s || "").toUpperCase().replace(/[^0-9K]/g, "");
         const onlyDigits = (s) => String(s || "").replace(/\D/g, "");

         // normalizar descripcion:
         // - para rut: dejamos solo digitos y K (mismo criterio)
         // - para folio: dejamos solo digitos
         const descRutNorm = normRut(r.description);
         const descDigits = onlyDigits(r.description);

         // normalizar rut y folio origen
         const rutNorm = normRut(r.counterparty_rut);
         const folioStr = r.folio ? String(r.folio) : "";

         // match robusto
         const hasRut = rutNorm && descRutNorm.includes(rutNorm) ? 1 : 0;
         const hasFolio = folioStr ? (descDigits.includes(folioStr) ? 1 : 0) : 0;

         // score final (igual ponderacion que veniamos usando)
         const textSignal = Math.max(hasFolio, hasRut);
         const score = 0.6 * scoreAmount + 0.3 * scoreDate + 0.1 * textSignal;

         // razones legibles
         const reasonAmount = diffAbs === 0 ? "monto=exacto" : `monto≈±${diffFmt}`;

         const scoreRounded = Math.round((score + Number.EPSILON) * 1000) / 1000; // 3 decimales

         // push del candidato
         byTx.get(key).candidates.push({
            id: r.doc_id,
            doc_type_code: r.doc_type_code,
            folio: r.folio,
            issue_date: r.issue_date,
            total_amount: Number(r.total_amount),
            counterparty_rut: r.counterparty_rut,
            remaining_amount: Number(r.doc_remaining),
            score: scoreRounded,
            reasons: [reasonAmount, `fecha±${params.daysWindow}d`, hasRut ? "rut-en-glosa" : (hasFolio ? "folio-en-glosa" : undefined)].filter(Boolean),
            daysDiff
         });
      }

      // best por score (igual que ya tenias)
      // ordenar candidatos por score desc y fijar best = 0
      // ordenar candidatos por score desc y fijar best = 0
      const rowsOut = [];
      for (const v of byTx.values()) {
         v.candidates.sort((a, b) => b.score - a.score);
         const best = v.candidates.length ? 0 : null; // el top va en posicion 0
         rowsOut.push({ ...v, best });
      }

      return { total: Number(total || 0), rows: rowsOut };

   }

}

module.exports = ReconcileService;
