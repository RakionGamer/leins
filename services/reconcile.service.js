"use strict";

const boom = require('@hapi/boom');
const { sequelize } = require("../libs/sequelize");
const { QueryTypes } = require("sequelize");

class ReconcileService {
   #whereDocsByType(type, alias = "d") {
      const op = `${alias}.operation_type`;
      const code = `${alias}.doc_type_code`;
      const received = `${alias}.received_date`;
      const purchaseType = `${alias}.purchase_type`;

      if (type === "expense") {
         return `AND (
            ${op} = 'EXPENSE'
            OR (${op} IS NULL AND ${code} = 1002)
            OR (${op} IS NULL AND ${code} IN (33,34) AND (${received} IS NOT NULL OR ${purchaseType} IS NOT NULL))
            OR (${op} IS NULL AND ${code} IS NULL)
         )
         AND (${code} IS NULL OR ${code} NOT IN (56,61))`;
      }

      if (type === "income") {
         return `AND (
            ${op} = 'INCOME'
            OR (${op} IS NULL AND ${code} IN (39,41,1001))
            OR (${op} IS NULL AND ${code} IN (33,34) AND ${received} IS NULL AND ${purchaseType} IS NULL)
         )
         AND (${code} IS NULL OR ${code} NOT IN (56,61))`;
      }

      return `AND (${code} IS NULL OR ${code} NOT IN (56,61))`;
   }

   #docMatchesBankType(docAlias = "d", bankAlias = "bt") {
      const op = `${docAlias}.operation_type`;
      const code = `${docAlias}.doc_type_code`;
      const received = `${docAlias}.received_date`;
      const purchaseType = `${docAlias}.purchase_type`;
      const bankType = `${bankAlias}.type`;

      const isExpenseDoc = `(
         ${op} = 'EXPENSE'
         OR (${op} IS NULL AND ${code} = 1002)
         OR (${op} IS NULL AND ${code} IN (33,34) AND (${received} IS NOT NULL OR ${purchaseType} IS NOT NULL))
         OR (${op} IS NULL AND ${code} IS NULL)
      )`;

      const isIncomeDoc = `(
         ${op} = 'INCOME'
         OR (${op} IS NULL AND ${code} IN (39,41,1001))
         OR (${op} IS NULL AND ${code} IN (33,34) AND ${received} IS NULL AND ${purchaseType} IS NULL)
      )`;

      return `(
         (${bankType} = 'income' AND ${isIncomeDoc})
         OR (${bankType} = 'expense' AND ${isExpenseDoc})
      )`;
   }

   #documentReconcileAmountSql(alias = "d") {
      return `CASE
         WHEN ${alias}.doc_type_code IN (1001,1002)
          AND COALESCE(${alias}.amount_net,0) > COALESCE(${alias}.amount_tax_no_credit,0)
          AND COALESCE(${alias}.amount_tax_no_credit,0) > 0
            THEN COALESCE(${alias}.amount_net,0) - COALESCE(${alias}.amount_tax_no_credit,0)
         ELSE COALESCE(${alias}.total_amount,0)
      END`;
   }

   #normalizeRut(value) {
      return String(value || "").toUpperCase().replace(/[^0-9K]/g, "");
   }

   #rutParts(value) {
      const clean = this.#normalizeRut(value);
      if (clean.length < 2) return null;

      const body = clean.slice(0, -1).replace(/^0+/, "");
      const dv = clean.slice(-1);
      const normalizedBody = body || "0";

      return {
         body: normalizedBody,
         full: `${normalizedBody}${dv}`,
      };
   }

   #rutKeysFromText(value) {
      const keys = new Set();
      const text = String(value || "").toUpperCase();
      const compact = this.#normalizeRut(text);
      const tokens = text.match(/[0-9][0-9.\-\s]{5,14}[0-9K]/g) || [];

      if (compact) tokens.push(compact);

      for (const token of tokens) {
         const clean = this.#normalizeRut(token);
         if (clean.length < 2) continue;

         keys.add(clean);
         const parts = this.#rutParts(clean);
         if (parts) {
            keys.add(parts.full);
            keys.add(parts.body);
         }
      }

      return keys;
   }

   #rutMatch(text, rut) {
      const parts = this.#rutParts(rut);
      if (!parts) return { full: false, body: false };

      const keys = this.#rutKeysFromText(text);
      return {
         full: keys.has(parts.full),
         body: keys.has(parts.body),
      };
   }

   #onlyDigits(value) {
      return String(value || "").replace(/\D/g, "");
   }

   #normalizeText(value) {
      return String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .toUpperCase()
         .replace(/[^A-Z0-9 ]/g, " ")
         .replace(/\s+/g, " ")
         .trim();
   }

   #meaningfulWords(value) {
      const stopWords = new Set([
         "TRANSF", "TRANSFERENCIA", "TRANSFER", "A", "DE", "DEL", "LA", "LAS", "LOS",
         "EL", "Y", "LTDA", "LIMITADA", "SPA", "SA", "S", "A", "EIRL", "SOCIEDAD",
         "COMERCIAL", "SERVICIOS", "PAGO", "ABONO", "TEF", "CTA", "CTE"
      ]);

      return this.#normalizeText(value)
         .split(" ")
         .map((word) => word.trim())
         .filter((word) => word.length >= 3 && !/^\d+$/.test(word) && !stopWords.has(word));
   }

   #extractTransferNameHint(description) {
      const normalized = this.#normalizeText(description);
      const match = normalized.match(/\bTRANSF(?:ERENCIA)?(?:\s+A)?\s+(.*)$/);
      if (!match) return normalized;

      return match[1]
         .replace(/^[0-9K ]+/, "")
         .replace(/\b(TRANSF|TRANSFERENCIA|TEF)\b/g, " ")
         .replace(/\s+/g, " ")
         .trim();
   }

   #nameMatch(description, counterpartyName) {
      const hintWords = this.#meaningfulWords(this.#extractTransferNameHint(description));
      const nameWords = this.#meaningfulWords(counterpartyName);
      if (!hintWords.length || !nameWords.length) return { score: 0, matchedWords: [] };

      const nameSet = new Set(nameWords);
      const matchedWords = hintWords.filter((word) => (
         nameSet.has(word)
         || nameWords.some((nameWord) => nameWord.startsWith(word) || word.startsWith(nameWord))
      ));

      const score = Math.min(1, matchedWords.length / Math.min(Math.max(nameWords.length, 1), 3));
      return { score, matchedWords: Array.from(new Set(matchedWords)).slice(0, 4) };
   }

   #amountCents(value) {
      return Math.round(Number(value || 0) * 100);
   }

   #confidence(score) {
      if (score >= 0.88) return "high";
      if (score >= 0.72) return "medium";
      return "low";
   }

   #scoreDocumentForTx(doc, tx, { amountTolerance, daysWindow }) {
      const docAmount = Number(doc.remaining_amount ?? doc.total_amount ?? 0);
      const txAmount = Number(tx.bank_remaining ?? tx.remaining_amount ?? tx.amount ?? 0);
      const diffAbs = Math.abs(docAmount - txAmount);
      const daysDiff = Math.abs(
         Math.floor((new Date(doc.issue_date).getTime() - new Date(tx.issued_at).setHours(0, 0, 0, 0)) / 86400000)
      );

      const descDigits = this.#onlyDigits(tx.description);
      const folioStr = doc.folio ? String(doc.folio) : "";
      const rutMatch = this.#rutMatch(tx.description, doc.counterparty_rut);
      const hasRut = rutMatch.full ? 1 : (rutMatch.body ? 0.75 : 0);
      const nameMatch = this.#nameMatch(tx.description, doc.counterparty_name);
      const hasFolio = folioStr ? (descDigits.includes(folioStr) ? 1 : 0) : 0;
      const historySignal = Number(doc.historical_count || doc.history_count || 0) > 0 ? 1 : 0;
      const textSignal = Math.max(hasFolio, hasRut, nameMatch.score);
      const scoreAmount = diffAbs <= Number(amountTolerance) ? 1 : Math.max(0, 1 - (diffAbs / Math.max(txAmount, 1)));
      const scoreDate = Math.max(0, 1 - (daysDiff / Math.max(1, Number(daysWindow))));
      const rawScore = (0.5 * scoreAmount) + (0.24 * scoreDate) + (0.2 * textSignal) + (0.06 * historySignal);
      const score = Math.round((Math.min(1, rawScore) + Number.EPSILON) * 1000) / 1000;

      return {
         score,
         confidence: this.#confidence(score),
         daysDiff,
         diffAbs,
         hasRut: hasRut > 0,
         hasRutFull: rutMatch.full,
         hasRutBody: rutMatch.body,
         hasFolio,
         hasName: nameMatch.score > 0,
         matchedNameWords: nameMatch.matchedWords,
         hasHistory: historySignal > 0,
         signals: {
            amount: scoreAmount,
            date: scoreDate,
            rut: hasRut,
            name: nameMatch.score,
            folio: hasFolio,
            history: historySignal,
         },
      };
   }

   #makeGroup({ tx, docs, amountTolerance, daysWindow, strategy }) {
      const total = docs.reduce((sum, doc) => sum + Number(doc.remaining_amount || 0), 0);
      const target = Number(tx.bank_remaining ?? tx.remaining_amount ?? tx.amount ?? 0);
      const diffAbs = Math.abs(total - target);
      if (diffAbs > Number(amountTolerance)) return null;

      const scoredDocs = docs.map((doc) => ({
         ...doc,
         _scoreMeta: this.#scoreDocumentForTx(doc, tx, { amountTolerance, daysWindow })
      }));

      const avgScore = scoredDocs.reduce((sum, doc) => sum + Number(doc._scoreMeta.score || 0), 0) / Math.max(scoredDocs.length, 1);
      const hasRut = scoredDocs.some((doc) => doc._scoreMeta.hasRut);
      const hasName = scoredDocs.some((doc) => doc._scoreMeta.hasName);
      const hasFolio = scoredDocs.some((doc) => doc._scoreMeta.hasFolio);
      const hasHistory = scoredDocs.some((doc) => doc._scoreMeta.hasHistory);
      const sameRut = new Set(scoredDocs.map((doc) => this.#rutParts(doc.counterparty_rut)?.full).filter(Boolean)).size === 1;
      const sameName = new Set(scoredDocs.map((doc) => this.#normalizeText(doc.counterparty_name)).filter(Boolean)).size === 1;
      const sameDate = new Set(scoredDocs.map((doc) => String(doc.issue_date || ""))).size === 1;
      const safeMixedDailyIncome = sameDate && tx.type === "income";
      if (!sameRut && !sameName && !safeMixedDailyIncome) return null;

      const diffFmt = Number.isInteger(diffAbs) ? String(diffAbs) : diffAbs.toFixed(2);
      const scoreBonus = (sameRut ? 0.04 : 0) + (sameName ? 0.03 : 0) + (sameDate ? 0.04 : 0) + (scoredDocs.length > 1 ? 0.04 : 0);
      const score = Math.round((Math.min(1, avgScore + scoreBonus) + Number.EPSILON) * 1000) / 1000;

      return {
         strategy,
         documents_count: scoredDocs.length,
         total_amount: Math.round((total + Number.EPSILON) * 100) / 100,
         diff_amount: Math.round((total - target + Number.EPSILON) * 100) / 100,
         score,
         confidence: this.#confidence(score),
         reasons: [
            diffAbs === 0 ? "suma=exacta" : `suma~+/-${diffFmt}`,
            `fecha+/-${daysWindow}d`,
            sameRut ? "mismo-rut" : undefined,
            sameName ? "misma-contraparte" : undefined,
            sameDate ? "mismo-dia" : undefined,
            hasRut ? "rut-emisor-en-glosa" : (hasFolio ? "folio-en-glosa" : undefined),
            hasName ? "nombre-en-glosa" : undefined,
            hasHistory ? "historial-contraparte" : undefined,
         ].filter(Boolean),
         signals: {
            same_rut: sameRut,
            same_name: sameName,
            same_date: sameDate,
            rut_in_description: hasRut,
            name_in_description: hasName,
            historical_counterparty: hasHistory,
         },
         documents: scoredDocs
            .sort((a, b) =>
               String(a.issue_date || "").localeCompare(String(b.issue_date || ""))
               || Number(a.folio || 0) - Number(b.folio || 0)
               || Number(a.id || 0) - Number(b.id || 0)
            )
            .map((doc) => ({
               id: doc.id,
               doc_type_code: doc.doc_type_code,
               folio: doc.folio,
               issue_date: doc.issue_date,
               counterparty_rut: doc.counterparty_rut,
               counterparty_name: doc.counterparty_name,
               total_amount: Number(doc.total_amount),
               remaining_amount: Number(doc.remaining_amount),
               amount: Number(doc.remaining_amount),
               confidence: doc._scoreMeta.confidence,
               score: doc._scoreMeta.score,
            })),
      };
   }

   #buildCandidateGroups({ tx, docs, amountTolerance, daysWindow, maxGroups = 3 }) {
      const targetCents = this.#amountCents(tx.bank_remaining ?? tx.remaining_amount ?? tx.amount);
      const toleranceCents = Math.max(0, this.#amountCents(amountTolerance));
      if (targetCents <= 0 || !Array.isArray(docs) || docs.length < 2) return [];

      const usable = docs
         .map((doc) => ({
            ...doc,
            _amountCents: this.#amountCents(doc.remaining_amount ?? doc.total_amount),
            _scoreMeta: this.#scoreDocumentForTx(doc, tx, { amountTolerance, daysWindow }),
         }))
         .filter((doc) => doc._amountCents > 0 && doc._amountCents <= targetCents + toleranceCents)
         .sort((a, b) =>
            b._scoreMeta.score - a._scoreMeta.score
            || a._scoreMeta.daysDiff - b._scoreMeta.daysDiff
            || b._amountCents - a._amountCents
         )
         .slice(0, 36);

      const groups = [];
      const seen = new Set();
      const pushGroup = (strategy, selected) => {
         const ids = selected.map((doc) => Number(doc.id)).sort((a, b) => a - b);
         if (ids.length < 2) return;
         const key = ids.join("-");
         if (seen.has(key)) return;
         const group = this.#makeGroup({ tx, docs: selected, amountTolerance, daysWindow, strategy });
         if (!group) return;
         seen.add(key);
         groups.push(group);
      };

      const groupedByDate = new Map();
      const groupedByRut = new Map();
      const groupedByName = new Map();
      for (const doc of usable) {
         const dateKey = String(doc.issue_date || "");
         const rutKey = this.#rutParts(doc.counterparty_rut)?.full;
         const nameKey = this.#normalizeText(doc.counterparty_name);
         if (dateKey) groupedByDate.set(dateKey, [...(groupedByDate.get(dateKey) || []), doc]);
         if (rutKey) groupedByRut.set(rutKey, [...(groupedByRut.get(rutKey) || []), doc]);
         if (nameKey) groupedByName.set(nameKey, [...(groupedByName.get(nameKey) || []), doc]);
      }

      for (const docsOfDate of groupedByDate.values()) pushGroup("same_day_total", docsOfDate);
      for (const docsOfRut of groupedByRut.values()) pushGroup("same_counterparty_window", docsOfRut);
      for (const docsOfName of groupedByName.values()) pushGroup("same_name_window", docsOfName);

      const dfsDocs = usable.slice(0, 28).sort((a, b) => b._amountCents - a._amountCents);
      const suffix = new Array(dfsDocs.length + 1).fill(0);
      for (let i = dfsDocs.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + dfsDocs[i]._amountCents;

      const dfs = (start, sum, selected) => {
         if (groups.length >= maxGroups * 4) return;
         if (selected.length >= 2 && Math.abs(sum - targetCents) <= toleranceCents) {
            pushGroup("subset_sum", selected);
            return;
         }
         if (selected.length >= 10 || sum > targetCents + toleranceCents) return;
         if (sum + suffix[start] < targetCents - toleranceCents) return;

         for (let i = start; i < dfsDocs.length; i++) {
            const next = dfsDocs[i];
            dfs(i + 1, sum + next._amountCents, [...selected, next]);
            if (groups.length >= maxGroups * 4) return;
         }
      };
      dfs(0, 0, []);

      return groups
         .sort((a, b) =>
            b.score - a.score
            || Math.abs(a.diff_amount) - Math.abs(b.diff_amount)
            || a.documents_count - b.documents_count
         )
         .slice(0, maxGroups);
   }

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

      const whereDocsByType = this.#whereDocsByType(type, "d");
      const docMatchesBankType = this.#docMatchesBankType("d", "bt");
      const doc2MatchesBankType = this.#docMatchesBankType("d2", "bt");
      const docReconcileAmount = this.#documentReconcileAmountSql("d");

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
            d.total_amount,
            d.issue_date,
            d.folio,
            d.counterparty_rut,
            d.operation_type,
            d.received_date,
            d.purchase_type,
            (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
            FROM entity_sii_documents d
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_sii_document_id = d.id
            WHERE d.entity_id = :entityId
            ${whereDocsByType}
            GROUP BY d.id
            HAVING remaining_amount > 0
         )
         SELECT COUNT(*) AS total
         FROM bt
         WHERE EXISTS (
            SELECT 1 FROM docs d
            WHERE ${docMatchesBankType}
              AND (
              ABS(bt.remaining_amount - d.remaining_amount) <= :amountTolerance
              OR (
                 SELECT COALESCE(SUM(d2.remaining_amount),0)
                 FROM docs d2
                 WHERE ${doc2MatchesBankType}
                   AND d2.remaining_amount <= bt.remaining_amount + :amountTolerance
                   AND d2.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
                                         AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${Number(daysWindow)} DAY))
              ) >= bt.remaining_amount - :amountTolerance
            )
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

      // Reutilizamos el mismo motor rapido del panel para evitar que el badge
      // dependa de un SQL paralelo que pueda desalinearse con las sugerencias reales.
      const out = await this.suggestions({
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: Number(daysWindow),
         search,
         type,
         limit: parsedCap + 1,
         offset: 0,
         includeTotal: false,
         withHasMore: true,
      });

      const probeTotal = Math.max(
         Array.isArray(out?.rows) ? out.rows.length : 0,
         Number(out?.total || 0)
      );
      return {
         total: Math.min(probeTotal, parsedCap),
         isCapped: probeTotal > parsedCap || Boolean(out?.has_more),
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
      const whereDocsByType = this.#whereDocsByType(type, "d");
      const docMatchesBankType = this.#docMatchesBankType("d", "bt");
      const doc2MatchesBankType = this.#docMatchesBankType("d2", "bt");
      const docReconcileAmount = this.#documentReconcileAmountSql("d");

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
            d.operation_type,
            d.received_date,
            d.purchase_type,
            d.total_amount,
            (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
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
            WHERE ${docMatchesBankType}
            AND (
               ABS(bt.remaining_amount - d.remaining_amount) <= :amountTolerance
               OR (
                  SELECT COALESCE(SUM(d2.remaining_amount),0)
                  FROM docs d2
                  WHERE ${doc2MatchesBankType}
                    AND d2.remaining_amount <= bt.remaining_amount + :amountTolerance
                    AND d2.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                          AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
               ) >= bt.remaining_amount - :amountTolerance
            )
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
                  d.counterparty_name,
                  d.operation_type,
                  d.received_date,
                  d.purchase_type,
                  d.total_amount,
                  (
                     SELECT COUNT(*)
                     FROM bank_transaction_documents hbtd
                     JOIN entity_bank_transactions hbt
                        ON hbt.id = hbtd.entity_bank_transaction_id
                       AND hbt.entity_id = :entityId
                     JOIN entity_sii_documents hd
                        ON hd.id = hbtd.entity_sii_document_id
                       AND hd.entity_id = :entityId
                     WHERE d.counterparty_rut IS NOT NULL
                       AND hd.counterparty_rut = d.counterparty_rut
                       AND hd.id <> d.id
                  ) AS historical_count,
                  (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
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
                  d.counterparty_name,
                  d.total_amount,
                  d.historical_count,
                  d.remaining_amount          AS doc_remaining
               FROM bt
               JOIN docs d
                  ON ${docMatchesBankType}
               AND ABS(bt.remaining_amount - d.remaining_amount) <= :amountTolerance
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
               const diffRaw = Number(r.doc_remaining) - Number(r.bank_remaining);
               const diffAbs = Math.abs(diffRaw);
               const diffFmt = Number.isInteger(diffAbs) ? String(diffAbs) : diffAbs.toFixed(2);

               // razones legibles
               const reasonAmount = diffAbs === 0 ? "monto=exacto" : `monto~+/-${diffFmt}`;
               const docForScore = {
                  id: r.doc_id,
                  doc_type_code: r.doc_type_code,
                  folio: r.folio,
                  issue_date: r.issue_date,
                  counterparty_rut: r.counterparty_rut,
                  counterparty_name: r.counterparty_name,
                  total_amount: Number(r.total_amount),
                  remaining_amount: Number(r.doc_remaining),
                  historical_count: Number(r.historical_count || 0),
               };
               const scoreMeta = this.#scoreDocumentForTx(docForScore, txBucket.bank_tx, {
                  amountTolerance,
                  daysWindow: params.daysWindow,
               });

               // push del candidato
               txBucket.candidates.push({
                  id: r.doc_id,
                  doc_type_code: r.doc_type_code,
                  folio: r.folio,
                  issue_date: r.issue_date,
                  total_amount: Number(r.total_amount),
                  counterparty_rut: r.counterparty_rut,
                  counterparty_name: r.counterparty_name,
                  remaining_amount: Number(r.doc_remaining),
                  score: scoreMeta.score,
                  confidence: scoreMeta.confidence,
                  reasons: [
                     reasonAmount,
                     `fecha+/-${params.daysWindow}d`,
                     scoreMeta.hasRut ? "rut-emisor-en-glosa" : undefined,
                     scoreMeta.hasName ? "nombre-en-glosa" : undefined,
                     scoreMeta.hasFolio ? "folio-en-glosa" : undefined,
                     scoreMeta.hasHistory ? "historial-contraparte" : undefined,
                  ].filter(Boolean),
                  signals: scoreMeta.signals,
                  daysDiff
               });
            }
         }
      }

      // 2b) sugerencias de grupos: varios documentos contra el mismo movimiento.
      if (pagedMovementRows.length > 0) {
         const txIdsCsv = pagedMovementRows
            .map((r) => Number(r.bank_tx_id))
            .filter((id) => Number.isInteger(id) && id > 0)
            .join(",");

         if (txIdsCsv) {
            const sqlGroupCandidates = `
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
                  d.counterparty_name,
                  d.operation_type,
                  d.received_date,
                  d.purchase_type,
                  d.total_amount,
                  (
                     SELECT COUNT(*)
                     FROM bank_transaction_documents hbtd
                     JOIN entity_bank_transactions hbt
                        ON hbt.id = hbtd.entity_bank_transaction_id
                       AND hbt.entity_id = :entityId
                     JOIN entity_sii_documents hd
                        ON hd.id = hbtd.entity_sii_document_id
                       AND hd.entity_id = :entityId
                     WHERE d.counterparty_rut IS NOT NULL
                       AND hd.counterparty_rut = d.counterparty_rut
                       AND hd.id <> d.id
                  ) AS historical_count,
                  (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
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
                  bt.amount,
                  bt.issued_at,
                  bt.description,
                  bt.remaining_amount         AS bank_remaining,
                  d.id                        AS doc_id,
                  d.doc_type_code,
                  d.folio,
                  d.issue_date,
                  d.counterparty_rut,
                  d.counterparty_name,
                  d.total_amount,
                  d.historical_count,
                  d.remaining_amount          AS doc_remaining
               FROM bt
               JOIN docs d
                  ON ${docMatchesBankType}
               AND d.remaining_amount <= bt.remaining_amount + :amountTolerance
               AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                    AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
               WHERE bt.id IN (${txIdsCsv})
               ${whereSearch}
               ORDER BY bt.id DESC, d.issue_date ASC, d.remaining_amount DESC
            `;

            const groupRows = await sequelize.query(sqlGroupCandidates, {
               replacements: params,
               type: QueryTypes.SELECT,
            });

            const docsByTx = new Map();
            for (const r of groupRows) {
               if (!byTx.has(r.bank_tx_id)) continue;
               if (!docsByTx.has(r.bank_tx_id)) docsByTx.set(r.bank_tx_id, []);
               docsByTx.get(r.bank_tx_id).push({
                  id: r.doc_id,
                  doc_type_code: r.doc_type_code,
                  folio: r.folio,
                  issue_date: r.issue_date,
                  counterparty_rut: r.counterparty_rut,
                  counterparty_name: r.counterparty_name,
                  total_amount: Number(r.total_amount),
                  remaining_amount: Number(r.doc_remaining),
                  historical_count: Number(r.historical_count || 0),
               });
            }

            for (const mv of pagedMovementRows) {
               const txBucket = byTx.get(mv.bank_tx_id);
               if (!txBucket) continue;
               txBucket.candidate_groups = this.#buildCandidateGroups({
                  tx: txBucket.bank_tx,
                  docs: docsByTx.get(mv.bank_tx_id) || [],
                  amountTolerance,
                  daysWindow: parsedDaysWindow,
                  maxGroups: 3,
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
         const candidateGroups = v.candidate_groups || [];
         if (top3.length === 0 && candidateGroups.length === 0) continue;
         const bestGroup = candidateGroups.length ? 0 : null;
         rowsOut.push({ ...v, candidates: top3, candidate_groups: candidateGroups, best, best_group: bestGroup });
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
