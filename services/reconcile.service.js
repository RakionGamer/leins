"use strict";

const boom = require('@hapi/boom');
const { sequelize } = require("../libs/sequelize");
const { QueryTypes } = require("sequelize");

class ReconcileService {

   // nuevo metodo exclusivo y ultra rapido para contar sugerencias
   async countSuggestions({
      entityId,
      accountId = null,
      type = null,
      dateFrom = null,
      dateTo = null,
      amountTolerance = 1.0,
      daysWindow = 3,
      search = null,
   }) {
      if (!entityId) throw boom.badRequest("entityId is required");

      const whereDocsByType =
         type === "expense"
            ? "AND d.doc_type_code IN (33,34) AND (d.received_date IS NOT NULL OR d.purchase_type IS NOT NULL)"
            : type === "income"
               ? "AND (d.doc_type_code NOT IN (33,34) OR d.doc_type_code IS NULL)"
               : "";

      const params = {
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: Number(daysWindow),
         search: search ? `%${search}%` : null,
      };
      if (type) params.typeParam = type;

      // usamos exists para cortar la busqueda al primer match
      // esto evita el producto cartesiano que causaba la demora de 2 minutos
      const sqlCount = `
         WITH bt AS (
            SELECT
            t.id,
            t.amount,
            t.issued_at,
            t.description
            FROM entity_bank_transactions t
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_bank_transaction_id = t.id
            WHERE t.entity_id = :entityId
            ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
            ${type ? "AND t.type = :typeParam" : ""}
            ${dateFrom ? "AND t.issued_at >= :dateFrom" : ""}
            ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
            GROUP BY t.id
            HAVING (t.amount - IFNULL(SUM(btd.amount_applied),0)) > 0
         ),
         docs AS (
            SELECT
            d.id,
            d.total_amount,
            d.issue_date,
            d.folio,
            d.counterparty_rut
            FROM entity_sii_documents d
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_sii_document_id = d.id
            WHERE d.entity_id = :entityId
            ${whereDocsByType}
            GROUP BY d.id
            HAVING (d.total_amount - IFNULL(SUM(btd.amount_applied),0)) > 0
         )
         SELECT COUNT(*) AS total
         FROM bt
         WHERE EXISTS (
            SELECT 1 FROM docs d
            WHERE ABS(bt.amount - d.total_amount) <= :amountTolerance
              AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
                                   AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
              ${search ? `AND (bt.description LIKE :search OR CAST(d.folio AS CHAR) LIKE :search OR d.counterparty_rut LIKE :search)` : ""}
         )
      `;

      const [{ total }] = await sequelize.query(sqlCount, {
         replacements: params,
         type: QueryTypes.SELECT,
      });

      return Number(total || 0);
   }

   // conteo capado para badges: evita contar miles de filas cuando solo necesitamos "50+"
   async countSuggestionsCapped({
      entityId,
      accountId = null,
      type = null,
      dateFrom = null,
      dateTo = null,
      amountTolerance = 1.0,
      daysWindow = 3,
      search = null,
      cap = 50,
   }) {
      if (!entityId) throw boom.badRequest("entityId is required");

      const parsedCap = Math.min(Math.max(Number(cap) || 50, 1), 500);
      const probeLimit = parsedCap + 1;

      const whereDocsByType =
         type === "expense"
            ? "AND d.doc_type_code IN (33,34) AND (d.received_date IS NOT NULL OR d.purchase_type IS NOT NULL)"
            : type === "income"
               ? "AND (d.doc_type_code NOT IN (33,34) OR d.doc_type_code IS NULL)"
               : "";

      const params = {
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: Number(daysWindow),
         search: search ? `%${search}%` : null,
         probeLimit,
      };
      if (type) params.typeParam = type;

      const sqlCountCapped = `
         WITH bt AS (
            SELECT
            t.id,
            t.amount,
            t.issued_at,
            t.description
            FROM entity_bank_transactions t
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_bank_transaction_id = t.id
            WHERE t.entity_id = :entityId
            ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
            ${type ? "AND t.type = :typeParam" : ""}
            ${dateFrom ? "AND t.issued_at >= :dateFrom" : ""}
            ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
            GROUP BY t.id
            HAVING (t.amount - IFNULL(SUM(btd.amount_applied),0)) > 0
         ),
         docs AS (
            SELECT
            d.id,
            d.total_amount,
            d.issue_date,
            d.folio,
            d.counterparty_rut
            FROM entity_sii_documents d
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_sii_document_id = d.id
            WHERE d.entity_id = :entityId
            ${whereDocsByType}
            GROUP BY d.id
            HAVING (d.total_amount - IFNULL(SUM(btd.amount_applied),0)) > 0
         )
         SELECT COUNT(*) AS total
         FROM (
            SELECT 1
            FROM bt
            WHERE EXISTS (
               SELECT 1 FROM docs d
               WHERE ABS(bt.amount - d.total_amount) <= :amountTolerance
                 AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
                                      AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
                 ${search ? `AND (bt.description LIKE :search OR CAST(d.folio AS CHAR) LIKE :search OR d.counterparty_rut LIKE :search)` : ""}
            )
            LIMIT :probeLimit
         ) x
      `;

      const [{ total }] = await sequelize.query(sqlCountCapped, {
         replacements: params,
         type: QueryTypes.SELECT,
      });

      const probeTotal = Number(total || 0);
      return {
         total: Math.min(probeTotal, parsedCap),
         isCapped: probeTotal > parsedCap,
         cap: parsedCap,
      };
   }

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
      includeTotal = true,
      withHasMore = false,
   }) {

      if (!entityId) throw boom.badRequest("entityId is required");
      const parsedDaysWindow = Math.max(1, Number(daysWindow) || 3);

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

      const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
      const parsedOffset = Math.max(Number(offset) || 0, 0);
      const queryLimit = withHasMore ? parsedLimit + 1 : parsedLimit;

      const params = {
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: parsedDaysWindow,
         limit: queryLimit,
         offset: parsedOffset,
         search: search ? `%${search}%` : null,
      };
      if (type) params.typeParam = type;

      // 1) paginacion por movimiento (no por candidato)
      const sqlPageMovements = `
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
            bt.remaining_amount         AS bank_remaining
         FROM bt
         WHERE EXISTS (
            SELECT 1
            FROM docs d
            WHERE ABS(bt.amount - d.total_amount) <= :amountTolerance
            AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                 AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
            ${whereSearch}
         )
         ORDER BY bt.issued_at DESC, bt.id DESC
         LIMIT :limit OFFSET :offset
      `;

      const pagedMovementRowsRaw = await sequelize.query(sqlPageMovements, {
         replacements: params,
         type: QueryTypes.SELECT,
      });

      if (!Array.isArray(pagedMovementRowsRaw)) {
         throw boom.badImplementation("unexpected query result: expected an array of rows");
      }

      const hasMore = withHasMore && pagedMovementRowsRaw.length > parsedLimit;
      const pagedMovementRows = hasMore ? pagedMovementRowsRaw.slice(0, parsedLimit) : pagedMovementRowsRaw;

      // prearmamos salida por movimiento para mantener orden de pagina
      const byTx = new Map();
      for (const mv of pagedMovementRows) {
         byTx.set(mv.bank_tx_id, {
            bank_tx: {
               id: mv.bank_tx_id,
               entity_bank_account_id: mv.entity_bank_account_id,
               type: mv.type,
               amount: Number(mv.amount),
               issued_at: mv.issued_at,
               description: mv.description,
               remaining_amount: Number(mv.bank_remaining),
            },
            candidates: [],
         });
      }

      // 2) para esos movimientos de la pagina, traemos candidatos y dejamos top 3 por score
      if (pagedMovementRows.length > 0) {
         const txIdsCsv = pagedMovementRows
            .map((r) => Number(r.bank_tx_id))
            .filter((id) => Number.isInteger(id) && id > 0)
            .join(",");

         if (txIdsCsv) {
            const sqlCandidates = `
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
               AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                    AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
               WHERE bt.id IN (${txIdsCsv})
               ${whereSearch}
               ORDER BY bt.issued_at DESC, bt.id DESC
            `;

            const candidateRows = await sequelize.query(sqlCandidates, {
               replacements: params,
               type: QueryTypes.SELECT,
            });

            if (!Array.isArray(candidateRows)) {
               throw boom.badImplementation("unexpected query result: expected an array of rows");
            }

            for (const r of candidateRows) {
               const txBucket = byTx.get(r.bank_tx_id);
               if (!txBucket) continue;

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
               // - para rut: dejamos solo digitos y k (mismo criterio)
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
               const reasonAmount = diffAbs === 0 ? "monto=exacto" : `monto~+/-${diffFmt}`;

               const scoreRounded = Math.round((score + Number.EPSILON) * 1000) / 1000; // 3 decimales

               // push del candidato
               txBucket.candidates.push({
                  id: r.doc_id,
                  doc_type_code: r.doc_type_code,
                  folio: r.folio,
                  issue_date: r.issue_date,
                  total_amount: Number(r.total_amount),
                  counterparty_rut: r.counterparty_rut,
                  remaining_amount: Number(r.doc_remaining),
                  score: scoreRounded,
                  reasons: [reasonAmount, `fecha+/-${params.daysWindow}d`, hasRut ? "rut-en-glosa" : (hasFolio ? "folio-en-glosa" : undefined)].filter(Boolean),
                  daysDiff
               });
            }
         }
      }

      // 3) ordenar candidatos por score y dejar top 3 por movimiento
      const rowsOut = [];
      for (const mv of pagedMovementRows) {
         const v = byTx.get(mv.bank_tx_id);
         if (!v) continue;

         v.candidates.sort((a, b) =>
            (b.score - a.score)
            || (a.daysDiff - b.daysDiff)
            || (b.remaining_amount - a.remaining_amount)
         );

         const top3 = v.candidates.slice(0, 3);
         const best = top3.length ? 0 : null;
         rowsOut.push({ ...v, candidates: top3, best });
      }
      if (!includeTotal) {
         const estimatedTotal = parsedOffset + pagedMovementRows.length + (hasMore ? 1 : 0);
         return {
            total: estimatedTotal,
            rows: rowsOut,
            has_more: hasMore,
            is_estimated: true,
         };
      }

      // obtenemos el total real usando conteo completo (modo legado)
      const total = await this.countSuggestions({
         entityId,
         accountId,
         type,
         dateFrom,
         dateTo,
         amountTolerance,
         daysWindow: parsedDaysWindow,
         search
      });

      return { total: Number(total || 0), rows: rowsOut };

   }

}

module.exports = ReconcileService;


