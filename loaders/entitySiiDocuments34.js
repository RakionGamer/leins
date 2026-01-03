// loaders/entitySiiDocuments34.js
"use strict";
const { sequelize } = require("../libs/sequelize");
const { parseCsvFile } = require("../libs/functions");
const { pickAndNormalize } = require("../utils/siiCsv");

const STATE_ID_DEFAULT = 1;

function toRow(inter, { entityId, year, month }) {
   // en doc 34 suele ser exento: si amount_net viene vacío, lo dejamos 0
   return {
      entity_id: entityId,
      doc_type_code: 34,
      counterparty_rut: inter.counterparty_rut,
      counterparty_name: inter.counterparty_name || null,
      source: "SII",
      external_key: `${(inter.folio || "").trim()}_${inter.counterparty_rut || ""}_${inter.issue_date || ""}`,
      folio: (inter.folio || "").trim(),
      issue_date: inter.issue_date,       // NOT NULL
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

function buildBulkInsert(rows) {
   const cols = Object.keys(rows[0]);
   const placeholdersRow = `(${cols.map(() => "?").join(",")})`;
   const values = [];
   const rowsSql = rows.map(r => {
      cols.forEach(c => values.push(r[c]));
      return placeholdersRow;
   }).join(",");

   const updateCols = cols.filter(c => !["entity_id", "doc_type_code", "counterparty_rut", "folio", "issue_date"].includes(c));
   const updateSql = updateCols.map(c => `\`${c}\`=VALUES(\`${c}\`)`).join(",");

   const sql = `
   INSERT INTO entity_sii_documents (${cols.map(c => `\`${c}\``).join(",")})
   VALUES ${rowsSql}
   ON DUPLICATE KEY UPDATE ${updateSql}
  `;
   return { sql, values };
}

async function loadCsvEntitySiiDocuments34(filePath, { entityId, year, month }, { chunkSize = 500 } = {}) {
   const raw = await parseCsvFile(filePath, { delimiter: ";" });
   if (!raw.length) return { inserted: 0, updated: 0, skipped: 0 };

   const records = [];
   let skipped = 0;

   for (const r of raw) {
      if (String(r["Tipo Doc"]).trim() !== "34") { skipped++; continue; }
      const inter = pickAndNormalize(r);

      // validaciones mínimas de clave
      if (!inter.issue_date || !inter.folio || !inter.counterparty_rut) { skipped++; continue; }

      records.push(toRow(inter, { entityId, year, month }));
   }

   if (!records.length) return { inserted: 0, updated: 0, skipped };

   let affected = 0;
   await sequelize.transaction(async (t) => {
      for (let i = 0; i < records.length; i += chunkSize) {
         const chunk = records.slice(i, i + chunkSize);
         const { sql, values } = buildBulkInsert(chunk);
         const [result] = await sequelize.query(sql, { replacements: values, transaction: t });
         // en MySQL, affectedRows = insertados*2 cuando hay updates; no es trivial distinguir, lo dejamos como total afectado:
         affected += (result?.affectedRows || result) ?? 0;
      }
   });

   return { affected, skipped, rows: records.length };
}

module.exports = { loadCsvEntitySiiDocuments34 };