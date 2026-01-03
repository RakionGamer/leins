// scripts/loaders/entitySiiDocumentsAny.js
"use strict";
const { sequelize } = require("../libs/sequelize");
const { parseCsvFile } = require("../libs/functions");
const { pickAndNormalize } = require("../utils/siiCsv");

const STATE_ID_DEFAULT = 1; // <--- ajusta a tu catálogo

const KEY_COLS = ["entity_id", "doc_type_code", "counterparty_rut", "folio", "issue_date"];
const keyOf = (r) => `${r.entity_id}#${r.doc_type_code}#${r.counterparty_rut}#${r.folio}#${r.issue_date}`;

function toRow(inter, { entityId, year, month, docTypeCode }) {
   const folio = (inter.folio || "").trim();
   return {
      entity_id: entityId,
      doc_type_code: docTypeCode,
      counterparty_rut: inter.counterparty_rut,
      counterparty_name: inter.counterparty_name || null,
      source: "SII",
      external_key: `${folio}_${inter.counterparty_rut || ""}_${inter.issue_date || ""}`,
      folio,
      issue_date: inter.issue_date,          // YYYY-MM-DD
      received_date: inter.received_date || null,
      due_date: null,
      period_year: Number(year),
      period_month: Number(month),
      state_id: STATE_ID_DEFAULT,

      total_amount: inter.total_amount || 0,
      amount_net: inter.amount_net || 0,
      amount_vat: inter.amount_vat || 0,

      seq_no: inter.seq_no ?? null,
      purchase_type: inter.purchase_type || null,
      acuse_date: inter.acuse_date || null,

      amount_exempt: inter.amount_exempt || 0,
      amount_vat_non_recoverable: inter.amount_vat_non_recoverable || 0,
      vat_non_recoverable_code: inter.vat_non_recoverable_code || null,
      amount_net_fixed_assets: inter.amount_net_fixed_assets || 0,
      amount_vat_fixed_assets: inter.amount_vat_fixed_assets || 0,
      amount_vat_common_use: inter.amount_vat_common_use || 0,
      amount_tax_no_credit: inter.amount_tax_no_credit || 0,
      amount_vat_not_withheld: inter.amount_vat_not_withheld || 0,

      tobacco_puros: inter.tobacco_puros || 0,
      tobacco_cigarrillos: inter.tobacco_cigarrillos || 0,
      tobacco_elaborados: inter.tobacco_elaborados || 0,

      nce_nde_reference: inter.nce_nde_reference || null,
      other_tax_code: inter.other_tax_code || null,
      other_tax_value: inter.other_tax_value || 0,
      other_tax_rate: inter.other_tax_rate || 0,
   };
}

function buildInsertSQL(rows, { upsert = false }) {
   const cols = Object.keys(rows[0]);
   const placeholdersRow = `(${cols.map(() => "?").join(",")})`;
   const values = [];
   const rowsSql = rows.map((r) => {
      cols.forEach((c) => values.push(r[c]));
      return placeholdersRow;
   }).join(",");

   let sql = `
   INSERT INTO entity_sii_documents (${cols.map((c) => `\`${c}\``).join(",")})
   VALUES ${rowsSql}
  `;

   if (upsert) {
      const updateCols = cols.filter((c) => !KEY_COLS.includes(c));
      const updateSql = updateCols.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(",");
      sql += ` ON DUPLICATE KEY UPDATE ${updateSql}`;
   }

   return { sql, values };
}

// Obtiene claves ya existentes para las filas del chunk (mismo entity/periodo).
async function fetchExistingKeysForChunk({ entityId, year, month, chunk }) {
   const keys = chunk.map(keyOf);
   const ph = keys.map(() => "?").join(",");
   const q = `
   SELECT CONCAT_WS('#', entity_id, doc_type_code, counterparty_rut, folio, issue_date) AS k
   FROM entity_sii_documents
   WHERE entity_id = ?
      AND CONCAT_WS('#', entity_id, doc_type_code, counterparty_rut, folio, issue_date) IN (${ph})
   `;
   const replacements = [entityId, ...keys];
   const [rows] = await sequelize.query(q, { replacements });
   return new Set(rows.map(r => r.k));
}

function addCounter(map, tipo, field, inc = 1) {
   if (!map[tipo]) map[tipo] = { processed: 0, inserted: 0, updated: 0, skipped: 0 };
   map[tipo][field] += inc;
}

async function loadCsvEntitySiiDocumentsAny(
   filePath,
   { entityId, year, month, onlyTypes = null },
   { chunkSize = 500 } = {}
) {
   const raw = await parseCsvFile(filePath, { delimiter: ";" });
   if (!raw.length) return { totals: { processed: 0, inserted: 0, updated: 0, skipped: 0 }, byType: {} };

   const byType = {};
   const records = [];
   let skipped = 0;

   // 1) Normaliza CSV y arma registros (con tipo)
   for (const r of raw) {
      const tipo = Number(String(r["Tipo Doc"] || r["TipoDoc"] || "").trim());
      if (!Number.isFinite(tipo)) { skipped++; continue; }
      if (Array.isArray(onlyTypes) && onlyTypes.length && !onlyTypes.includes(tipo)) { continue; }

      const inter = pickAndNormalize(r);
      if (!inter.issue_date || !inter.folio || !inter.counterparty_rut) { skipped++; continue; }

      const row = toRow(inter, { entityId, year, month, docTypeCode: tipo });
      records.push(row);
      addCounter(byType, String(tipo), "processed", 1);
   }

   if (!records.length) {
      return { totals: { processed: 0, inserted: 0, updated: 0, skipped }, byType };
   }

   // 2) Inserta/actualiza en chunks, separando "nuevos" vs "existentes"
   let inserted = 0, updated = 0;
   await sequelize.transaction(async (t) => {

      for (let i = 0; i < records.length; i += chunkSize) {

         const chunk = records.slice(i, i + chunkSize);

         const existing = await fetchExistingKeysForChunk({ entityId, year, month, chunk });

         const newRows = chunk.filter(r => !existing.has(keyOf(r)));
         const updRows = chunk.filter(r => existing.has(keyOf(r)));

         if (newRows.length) {
            const { sql, values } = buildInsertSQL(newRows, { upsert: false });
            await sequelize.query(sql, { replacements: values, transaction: t });
            inserted += newRows.length;
            // por tipo
            for (const r of newRows) addCounter(byType, String(r.doc_type_code), "inserted", 1);
         }

         if (updRows.length) {
            const { sql, values } = buildInsertSQL(updRows, { upsert: true });
            await sequelize.query(sql, { replacements: values, transaction: t });
            updated += updRows.length;
            // por tipo
            for (const r of updRows) addCounter(byType, String(r.doc_type_code), "updated", 1);
         }

      }

   });

   const totals = {
      processed: records.length,
      inserted,
      updated,
      skipped,
   };

   return { totals, byType };
}

module.exports = { loadCsvEntitySiiDocumentsAny };