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
            ${op} IN ('EXPENSE', 'COMPRA', 'COMPRAS', 'expense', 'compra', 'compras')
            OR (${op} IS NULL AND ${code} = 1002)
            OR (${op} IS NULL AND ${code} IN (33,34) AND (${received} IS NOT NULL OR ${purchaseType} IS NOT NULL))
            OR (${op} IS NULL AND ${code} IS NULL)
         )
         AND (${code} IS NULL OR ${code} NOT IN (56,61))`;
      }

      if (type === "income") {
         return `AND (
            ${op} IN ('INCOME', 'VENTA', 'VENTAS', 'income', 'venta', 'ventas')
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
         ${op} IN ('EXPENSE', 'COMPRA', 'COMPRAS', 'expense', 'compra', 'compras')
         OR (${op} IS NULL AND ${code} = 1002)
         OR (${op} IS NULL AND ${code} IN (33,34) AND (${received} IS NOT NULL OR ${purchaseType} IS NOT NULL))
         OR (${op} IS NULL AND ${code} IS NULL)
      )`;

      const isIncomeDoc = `(
         ${op} IN ('INCOME', 'VENTA', 'VENTAS', 'income', 'venta', 'ventas')
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

   #creditNotesSumSql(alias = "d") {
      return `COALESCE((
         SELECT SUM(cn.total_amount)
         FROM entity_sii_documents cn
         WHERE cn.entity_id = ${alias}.entity_id
           AND cn.doc_type_code = 61
           AND cn.counterparty_rut = ${alias}.counterparty_rut
           AND cn.nce_nde_reference = CAST(${alias}.folio AS CHAR)
      ), 0)`;
   }

   // tope de tiempo para las consultas de emparejamiento (bt x docs): si una entidad
   // acumula mucho historial sin conciliar, la busqueda puede degenerar en un escaneo
   // carisimo; el hint MAX_EXECUTION_TIME esta incrustado directamente en cada SQL
   // (debe ir en el SELECT externo, no en los de los CTE) para que falle rapido con un
   // mensaje claro en vez de quedar corriendo por horas
   static SUGGESTIONS_MAX_EXECUTION_TIME_MS = 20000;

   // si el usuario no filtra por fecha, el cruce de pendientes puede terminar
   // comparando todo el historial sin conciliar de la entidad; acotamos por defecto
   // a los ultimos N meses (el usuario puede pedir un rango mas antiguo a proposito
   // pasando dateFrom explicitamente, eso no se toca)
   static SUGGESTIONS_DEFAULT_WINDOW_MONTHS = 12;

   #resolveDefaultDateFrom(dateFrom) {
      if (dateFrom) return dateFrom;
      const d = new Date();
      d.setMonth(d.getMonth() - ReconcileService.SUGGESTIONS_DEFAULT_WINDOW_MONTHS);
      return d.toISOString().slice(0, 10);
   }

   async #runQuery(sql, options) {
      try {
         return await sequelize.query(sql, options);
      } catch (err) {
         const isTimeout = err?.original?.errno === 3024 || err?.original?.code === 'ER_QUERY_TIMEOUT';
         if (isTimeout) {
            throw boom.serverUnavailable('la busqueda de conciliacion demoro demasiado; prueba acotar el rango de fechas o filtrar por cuenta bancaria');
         }
         throw err;
      }
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

   #buildCandidateGroups({ tx, docs, amountTolerance, daysWindow, maxGroups = 3, stopOnFirst = false }) {
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

      for (const docsOfDate of groupedByDate.values()) {
         pushGroup("same_day_total", docsOfDate);
         if (stopOnFirst && groups.length >= 1) return groups.slice(0, 1);
      }
      for (const docsOfRut of groupedByRut.values()) {
         pushGroup("same_counterparty_window", docsOfRut);
         if (stopOnFirst && groups.length >= 1) return groups.slice(0, 1);
      }
      for (const docsOfName of groupedByName.values()) {
         pushGroup("same_name_window", docsOfName);
         if (stopOnFirst && groups.length >= 1) return groups.slice(0, 1);
      }

      const dfsDocs = usable.slice(0, 28).sort((a, b) => b._amountCents - a._amountCents);
      const suffix = new Array(dfsDocs.length + 1).fill(0);
      for (let i = dfsDocs.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1] + dfsDocs[i]._amountCents;

      const dfs = (start, sum, selected) => {
         if (groups.length >= maxGroups * 4 || (stopOnFirst && groups.length >= 1)) return;
         if (selected.length >= 2 && Math.abs(sum - targetCents) <= toleranceCents) {
            pushGroup("subset_sum", selected);
            return;
         }
         if (selected.length >= 10 || sum > targetCents + toleranceCents) return;
         if (sum + suffix[start] < targetCents - toleranceCents) return;

         for (let i = start; i < dfsDocs.length; i++) {
            const next = dfsDocs[i];
            dfs(i + 1, sum + next._amountCents, [...selected, next]);
            if (groups.length >= maxGroups * 4 || (stopOnFirst && groups.length >= 1)) return;
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

   // conteo exacto de sugerencias verificadas (alineado con el motor del panel)
   async countSuggestions({
      entityId,
      accountId = null,
      type = null,
      dateFrom = null,
      dateTo = null,
      amountTolerance = 1.0,
      daysWindow = 45,
      search = null,
   }) {
      if (!entityId) throw boom.badRequest("entityId is required");

      const out = await this.suggestions({
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: Number(daysWindow),
         search,
         type,
         limit: 2000,
         offset: 0,
         includeTotal: false,
         withHasMore: false,
         countOnly: true,
      });

      return Number(out?.total || 0);
   }

   // conteo capado para badges: evita contar miles de filas cuando solo necesitamos "50+"
   async countSuggestionsCapped({
      entityId,
      accountId = null,
      type = null,
      dateFrom = null,
      dateTo = null,
      amountTolerance = 1.0,
      daysWindow = 45,
      search = null,
      cap = 50,
   }) {
      if (!entityId) throw boom.badRequest("entityId is required");

      const parsedCap = Math.min(Math.max(Number(cap) || 50, 1), 500);

      // Reutilizamos el mismo motor del panel (incluyendo validacion real de candidatos
      // y grupos) para que el badge nunca cuente falsos positivos del pre-filtro SQL.
      const out = await this.suggestions({
         entityId,
         accountId,
         dateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: Number(daysWindow),
         search,
         type,
         limit: parsedCap,
         offset: 0,
         includeTotal: false,
         withHasMore: true,
         countOnly: true,
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
      daysWindow = 45,
      limit = 50,
      offset = 0,
      search = null,
      includeTotal = true,
      withHasMore = false,
      // countOnly: para el badge/conteo capado, verifica coincidencia real (1-a-1 o primer grupo)
      // sin calcular scores/historial completo de cada documento
      countOnly = false,
      maxCandidates = null,
   }) {

      if (!entityId) throw boom.badRequest("entityId is required");
      const parsedDaysWindow = Math.max(1, Number(daysWindow) || 45);
      const resolvedMaxCandidates = (countOnly && maxCandidates) ? Math.max(1, Number(maxCandidates)) : null;

      // mapeo ventas/compras
      // para egresos (expense) solo compras recibidas: 33/34 y flag de recibido
      const whereDocsByType = this.#whereDocsByType(type, "d");
      const docMatchesBankType = this.#docMatchesBankType("d", "bt");
      const doc2MatchesBankType = this.#docMatchesBankType("d2", "bt");
      const docReconcileAmount = this.#documentReconcileAmountSql("d");
      const docCreditNotesSum = this.#creditNotesSumSql("d");

      const whereSearch = search
         ? `AND (
            bt.description LIKE :search
            OR CAST(d.folio AS CHAR) LIKE :search
            OR d.counterparty_rut LIKE :search
         )`
         : "";

      const maxLimit = countOnly ? 2000 : 200;
      const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), maxLimit);
      const parsedOffset = Math.max(Number(offset) || 0, 0);
      const neededVerifiedCount = parsedOffset + parsedLimit + (withHasMore ? 1 : 0);
      const resolvedDateFrom = this.#resolveDefaultDateFrom(dateFrom);

      const baseParams = {
         entityId,
         accountId,
         dateFrom: resolvedDateFrom,
         dateTo,
         amountTolerance: Number(amountTolerance),
         daysWindow: parsedDaysWindow,
         search: search ? `%${search}%` : null,
      };
      if (type) baseParams.typeParam = type;
      if (resolvedMaxCandidates) baseParams.maxCandidates = resolvedMaxCandidates;

      const btCte = `
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
            AND t.issued_at >= :dateFrom
            ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
            GROUP BY t.id
            HAVING remaining_amount > 0
            ${resolvedMaxCandidates ? "ORDER BY t.issued_at DESC LIMIT :maxCandidates" : ""}
         )
      `;

      // Pre-filtro SQL grueso: evita traer movimientos sin ningun documento posible,
      // y exige >= 2 documentos en la rama de grupos para reducir falsos positivos.
      const sqlPageMovements = `
         ${btCte},
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
            (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0) - ${docCreditNotesSum}) AS remaining_amount
            FROM entity_sii_documents d
            LEFT JOIN bank_transaction_documents btd
            ON btd.entity_sii_document_id = d.id
            WHERE d.entity_id = :entityId
            ${whereDocsByType}
            AND d.issue_date >= DATE_SUB((SELECT MIN(bt2.issued_at) FROM bt bt2), INTERVAL ${parsedDaysWindow} DAY)
            AND d.issue_date <= DATE_ADD((SELECT MAX(bt2.issued_at) FROM bt bt2), INTERVAL ${parsedDaysWindow} DAY)
            GROUP BY d.id
            HAVING remaining_amount > 0
         )
         SELECT /*+ MAX_EXECUTION_TIME(${ReconcileService.SUGGESTIONS_MAX_EXECUTION_TIME_MS}) */
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
                  d.remaining_amount <= bt.remaining_amount + :amountTolerance
                  AND (
                     SELECT CASE
                        WHEN COUNT(*) >= 2 THEN COALESCE(SUM(d2.remaining_amount), 0)
                        ELSE NULL
                     END
                     FROM docs d2
                     WHERE ${doc2MatchesBankType}
                       AND (
                          (d.counterparty_rut IS NOT NULL AND d2.counterparty_rut = d.counterparty_rut)
                          OR (
                             d.counterparty_rut IS NULL
                             AND d2.issue_date = d.issue_date
                             AND (bt.type = 'income' OR (d.counterparty_name IS NOT NULL AND d2.counterparty_name = d.counterparty_name))
                          )
                       )
                       AND d2.remaining_amount <= bt.remaining_amount + :amountTolerance
                       AND d2.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                             AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                  ) >= bt.remaining_amount - :amountTolerance
               )
            )
            AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                 AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
            ${whereSearch}
         )
         ORDER BY bt.issued_at DESC, bt.id DESC
         LIMIT :coarseLimit OFFSET :coarseOffset
      `;

      const getChunkDateRange = (chunkRows) => {
         const times = chunkRows
            .map((mv) => new Date(mv.issued_at).getTime())
            .filter((ts) => Number.isFinite(ts));
         if (!times.length) {
            return {
               chunkDateFrom: baseParams.dateFrom,
               chunkDateTo: baseParams.dateTo || null,
            };
         }
         const minDate = new Date(Math.min(...times));
         const maxDate = new Date(Math.max(...times));
         minDate.setUTCDate(minDate.getUTCDate() - 1);
         maxDate.setUTCDate(maxDate.getUTCDate() + 1);
         return {
            chunkDateFrom: minDate.toISOString().slice(0, 10),
            chunkDateTo: maxDate.toISOString().slice(0, 10),
         };
      };

      const toBankTx = (mv) => ({
         id: mv.bank_tx_id,
         entity_bank_account_id: mv.entity_bank_account_id,
         type: mv.type,
         amount: Number(mv.amount),
         issued_at: mv.issued_at,
         description: mv.description,
         remaining_amount: Number(mv.bank_remaining),
      });

      const verifyChunkLight = async (chunkRows, maxToCollect) => {
         const txIdsCsv = chunkRows
            .map((r) => Number(r.bank_tx_id))
            .filter((id) => Number.isInteger(id) && id > 0)
            .join(",");
         if (!txIdsCsv) return [];

         const { chunkDateFrom, chunkDateTo } = getChunkDateRange(chunkRows);
         const chunkParams = { ...baseParams, chunkDateFrom, chunkDateTo };

         const sqlSinglesLight = `
            WITH bt AS (
               SELECT
               t.id,
               t.entity_id,
               t.type,
               t.amount,
               t.issued_at,
               t.description,
               (t.amount - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
               FROM entity_bank_transactions t
               LEFT JOIN bank_transaction_documents btd
               ON btd.entity_bank_transaction_id = t.id
               WHERE t.entity_id = :entityId
               AND t.id IN (${txIdsCsv})
               ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
               ${type ? "AND t.type = :typeParam" : ""}
               AND t.issued_at >= :dateFrom
               ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
               GROUP BY t.id
               HAVING remaining_amount > 0
            ),
            docs AS (
               SELECT
               d.id,
               d.doc_type_code,
               d.folio,
               d.issue_date,
               d.counterparty_rut,
               d.operation_type,
               d.received_date,
               d.purchase_type,
               (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0) - ${docCreditNotesSum}) AS remaining_amount
               FROM entity_sii_documents d
               LEFT JOIN bank_transaction_documents btd
               ON btd.entity_sii_document_id = d.id
               WHERE d.entity_id = :entityId
               ${whereDocsByType}
               AND d.issue_date >= DATE_SUB(:chunkDateFrom, INTERVAL ${parsedDaysWindow} DAY)
               AND d.issue_date <= DATE_ADD(:chunkDateTo, INTERVAL ${parsedDaysWindow} DAY)
               GROUP BY d.id
               HAVING remaining_amount > 0
            )
            SELECT /*+ MAX_EXECUTION_TIME(${ReconcileService.SUGGESTIONS_MAX_EXECUTION_TIME_MS}) */
               DISTINCT bt.id AS bank_tx_id
            FROM bt
            JOIN docs d
               ON ${docMatchesBankType}
            AND ABS(bt.remaining_amount - d.remaining_amount) <= :amountTolerance
            AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                 AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
            WHERE bt.id IN (${txIdsCsv})
            ${whereSearch}
         `;

         const singleRows = await this.#runQuery(sqlSinglesLight, {
            replacements: chunkParams,
            type: QueryTypes.SELECT,
         });
         const singleMatchedIds = new Set(
            (Array.isArray(singleRows) ? singleRows : []).map((r) => r.bank_tx_id)
         );

         const groupMatchedIds = new Set();
         const unmatchedRows = chunkRows.filter((mv) => !singleMatchedIds.has(mv.bank_tx_id));

         if (unmatchedRows.length > 0 && singleMatchedIds.size < maxToCollect) {
            const unmatchedIdsCsv = unmatchedRows
               .map((r) => Number(r.bank_tx_id))
               .filter((id) => Number.isInteger(id) && id > 0)
               .join(",");

            if (unmatchedIdsCsv) {
               const { chunkDateFrom: gFrom, chunkDateTo: gTo } = getChunkDateRange(unmatchedRows);
               const sqlGroupsLight = `
                  WITH bt AS (
                     SELECT
                     t.id,
                     t.entity_id,
                     t.type,
                     t.amount,
                     t.issued_at,
                     t.description,
                     (t.amount - IFNULL(SUM(btd.amount_applied),0)) AS remaining_amount
                     FROM entity_bank_transactions t
                     LEFT JOIN bank_transaction_documents btd
                     ON btd.entity_bank_transaction_id = t.id
                     WHERE t.entity_id = :entityId
                     AND t.id IN (${unmatchedIdsCsv})
                     ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
                     ${type ? "AND t.type = :typeParam" : ""}
                     AND t.issued_at >= :dateFrom
                     ${dateTo ? "AND t.issued_at <  DATE_ADD(:dateTo, INTERVAL 1 DAY)" : ""}
                     GROUP BY t.id
                     HAVING remaining_amount > 0
                  ),
                  docs AS (
                     SELECT
                     d.id,
                     d.doc_type_code,
                     d.folio,
                     d.issue_date,
                     d.counterparty_rut,
                     d.counterparty_name,
                     d.operation_type,
                     d.received_date,
                     d.purchase_type,
                     d.total_amount,
                     (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0) - ${docCreditNotesSum}) AS remaining_amount
                     FROM entity_sii_documents d
                     LEFT JOIN bank_transaction_documents btd
                     ON btd.entity_sii_document_id = d.id
                     WHERE d.entity_id = :entityId
                     ${whereDocsByType}
                     AND d.issue_date >= DATE_SUB(:chunkDateFrom, INTERVAL ${parsedDaysWindow} DAY)
                     AND d.issue_date <= DATE_ADD(:chunkDateTo, INTERVAL ${parsedDaysWindow} DAY)
                     GROUP BY d.id
                     HAVING remaining_amount > 0
                  )
                  SELECT /*+ MAX_EXECUTION_TIME(${ReconcileService.SUGGESTIONS_MAX_EXECUTION_TIME_MS}) */
                     bt.id                       AS bank_tx_id,
                     d.id                        AS doc_id,
                     d.doc_type_code,
                     d.folio,
                     d.issue_date,
                     d.counterparty_rut,
                     d.counterparty_name,
                     d.total_amount,
                     d.remaining_amount          AS doc_remaining
                  FROM bt
                  JOIN docs d
                     ON ${docMatchesBankType}
                  AND d.remaining_amount <= bt.remaining_amount + :amountTolerance
                  AND d.issue_date BETWEEN DATE(DATE_SUB(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                                       AND DATE(DATE_ADD(bt.issued_at, INTERVAL ${parsedDaysWindow} DAY))
                  WHERE bt.id IN (${unmatchedIdsCsv})
                  ${whereSearch}
                  ORDER BY bt.id DESC, d.issue_date ASC, d.remaining_amount DESC
               `;

               const groupRows = await this.#runQuery(sqlGroupsLight, {
                  replacements: { ...baseParams, chunkDateFrom: gFrom, chunkDateTo: gTo },
                  type: QueryTypes.SELECT,
               });

               const docsByTx = new Map();
               for (const r of (Array.isArray(groupRows) ? groupRows : [])) {
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
                     historical_count: 0,
                  });
               }

               let totalVerifiedSoFar = singleMatchedIds.size;
               for (const mv of unmatchedRows) {
                  if (totalVerifiedSoFar >= maxToCollect) break;
                  const docs = docsByTx.get(mv.bank_tx_id) || [];
                  if (docs.length < 2) continue;
                  const tx = toBankTx(mv);
                  const groups = this.#buildCandidateGroups({
                     tx,
                     docs,
                     amountTolerance,
                     daysWindow: parsedDaysWindow,
                     maxGroups: 1,
                     stopOnFirst: true,
                  });
                  if (groups.length > 0) {
                     groupMatchedIds.add(mv.bank_tx_id);
                     totalVerifiedSoFar += 1;
                  }
               }
            }
         }

         const out = [];
         for (const mv of chunkRows) {
            if (singleMatchedIds.has(mv.bank_tx_id) || groupMatchedIds.has(mv.bank_tx_id)) {
               out.push({
                  bank_tx: toBankTx(mv),
                  candidates: [],
                  candidate_groups: [],
                  best: null,
                  best_group: null,
               });
            }
         }
         return out;
      };

      const evaluateChunkFull = async (chunkRows) => {
         const txIdsCsv = chunkRows
            .map((r) => Number(r.bank_tx_id))
            .filter((id) => Number.isInteger(id) && id > 0)
            .join(",");
         if (!txIdsCsv) return [];

         const { chunkDateFrom, chunkDateTo } = getChunkDateRange(chunkRows);
         const chunkParams = {
            ...baseParams,
            pageDateFrom: chunkDateFrom,
            pageDateTo: chunkDateTo,
         };

         const byTx = new Map();
         for (const mv of chunkRows) {
            byTx.set(mv.bank_tx_id, {
               bank_tx: toBankTx(mv),
               candidates: [],
            });
         }

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
               AND t.id IN (${txIdsCsv})
               ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
               ${type ? "AND t.type = :typeParam" : ""}
               AND t.issued_at >= :dateFrom
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
               (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0) - ${docCreditNotesSum}) AS remaining_amount
               FROM entity_sii_documents d
               LEFT JOIN bank_transaction_documents btd
               ON btd.entity_sii_document_id = d.id
               WHERE d.entity_id = :entityId
               ${whereDocsByType}
               AND d.issue_date >= DATE_SUB(:pageDateFrom, INTERVAL ${parsedDaysWindow} DAY)
               AND d.issue_date <= DATE_ADD(:pageDateTo, INTERVAL ${parsedDaysWindow} DAY)
               GROUP BY d.id
               HAVING remaining_amount > 0
            )
            SELECT /*+ MAX_EXECUTION_TIME(${ReconcileService.SUGGESTIONS_MAX_EXECUTION_TIME_MS}) */
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

         const candidateRows = await this.#runQuery(sqlCandidates, {
            replacements: chunkParams,
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

            const diffRaw = Number(r.doc_remaining) - Number(r.bank_remaining);
            const diffAbs = Math.abs(diffRaw);
            const diffFmt = Number.isInteger(diffAbs) ? String(diffAbs) : diffAbs.toFixed(2);

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
               daysWindow: parsedDaysWindow,
            });

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
                  `fecha+/-${parsedDaysWindow}d`,
                  scoreMeta.hasRut ? "rut-emisor-en-glosa" : undefined,
                  scoreMeta.hasName ? "nombre-en-glosa" : undefined,
                  scoreMeta.hasFolio ? "folio-en-glosa" : undefined,
                  scoreMeta.hasHistory ? "historial-contraparte" : undefined,
               ].filter(Boolean),
               signals: scoreMeta.signals,
               daysDiff
            });
         }

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
               AND t.id IN (${txIdsCsv})
               ${accountId ? "AND t.entity_bank_account_id = :accountId" : ""}
               ${type ? "AND t.type = :typeParam" : ""}
               AND t.issued_at >= :dateFrom
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
               (${docReconcileAmount} - IFNULL(SUM(btd.amount_applied),0) - ${docCreditNotesSum}) AS remaining_amount
               FROM entity_sii_documents d
               LEFT JOIN bank_transaction_documents btd
               ON btd.entity_sii_document_id = d.id
               WHERE d.entity_id = :entityId
               ${whereDocsByType}
               AND d.issue_date >= DATE_SUB(:pageDateFrom, INTERVAL ${parsedDaysWindow} DAY)
               AND d.issue_date <= DATE_ADD(:pageDateTo, INTERVAL ${parsedDaysWindow} DAY)
               GROUP BY d.id
               HAVING remaining_amount > 0
            )
            SELECT /*+ MAX_EXECUTION_TIME(${ReconcileService.SUGGESTIONS_MAX_EXECUTION_TIME_MS}) */
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

         const groupRows = await this.#runQuery(sqlGroupCandidates, {
            replacements: chunkParams,
            type: QueryTypes.SELECT,
         });

         const docsByTx = new Map();
         for (const r of (Array.isArray(groupRows) ? groupRows : [])) {
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

         const out = [];
         for (const mv of chunkRows) {
            const v = byTx.get(mv.bank_tx_id);
            if (!v) continue;

            v.candidate_groups = this.#buildCandidateGroups({
               tx: v.bank_tx,
               docs: docsByTx.get(mv.bank_tx_id) || [],
               amountTolerance,
               daysWindow: parsedDaysWindow,
               maxGroups: 3,
            });

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
            out.push({ ...v, candidates: top3, candidate_groups: candidateGroups, best, best_group: bestGroup });
         }
         return out;
      };

      const coarseBatchSize = 250;
      const verifyChunkSize = 100;
      const maxCoarseScan = 2000;
      let coarseOffset = 0;
      let scannedCoarse = 0;
      let exhaustedCoarse = false;
      const verifiedAll = [];

      while (verifiedAll.length < neededVerifiedCount && scannedCoarse < maxCoarseScan) {
         const coarseBatch = await this.#runQuery(sqlPageMovements, {
            replacements: {
               ...baseParams,
               coarseLimit: coarseBatchSize,
               coarseOffset,
            },
            type: QueryTypes.SELECT,
         });

         if (!Array.isArray(coarseBatch)) {
            throw boom.badImplementation("unexpected query result: expected an array of rows");
         }

         scannedCoarse += coarseBatch.length;
         coarseOffset += coarseBatch.length;
         if (coarseBatch.length < coarseBatchSize) {
            exhaustedCoarse = true;
         }
         if (coarseBatch.length === 0) break;

         for (let i = 0; i < coarseBatch.length; i += verifyChunkSize) {
            const chunkRows = coarseBatch.slice(i, i + verifyChunkSize);
            const remainingNeeded = neededVerifiedCount - verifiedAll.length;
            if (remainingNeeded <= 0) break;

            const needDetailsForChunk = !countOnly && (verifiedAll.length + chunkRows.length > parsedOffset);
            const chunkVerified = needDetailsForChunk
               ? await evaluateChunkFull(chunkRows)
               : await verifyChunkLight(chunkRows, remainingNeeded);

            for (const item of chunkVerified) {
               verifiedAll.push(item);
            }

            if (verifiedAll.length >= neededVerifiedCount) break;
         }

         if (exhaustedCoarse) break;
      }

      const rowsOut = verifiedAll.slice(parsedOffset, parsedOffset + parsedLimit);
      const hasMore = withHasMore && (verifiedAll.length > parsedOffset + parsedLimit);

      if (!includeTotal) {
         const estimatedTotal = parsedOffset + rowsOut.length + (hasMore ? 1 : 0);
         return {
            total: estimatedTotal,
            rows: rowsOut,
            has_more: hasMore,
            is_estimated: true,
         };
      }

      if (exhaustedCoarse) {
         return { total: verifiedAll.length, rows: rowsOut };
      }

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
