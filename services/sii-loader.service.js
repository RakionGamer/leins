"use strict";

const { sequelize } = require("../libs/sequelize");
const { parseCsvFile } = require("../libs/functions");
const { pickAndNormalize } = require("../utils/siiCsv");

class SiiLoaderService {
   constructor() {
      this.STATE_ID_DEFAULT = 1;
      this.KEY_COLS = ["entity_id", "doc_type_code", "counterparty_rut", "folio", "issue_date"];
   }

   // helper para formatear la clave unica
   _keyOf(r) {
      return `${r.entity_id}#${r.doc_type_code}#${r.counterparty_rut}#${r.folio}#${r.issue_date}`;
   }

   // funcion para armar el registro homogeneo para la bd
   _toRow(inter, raw, { entityId, year, month, docTypeCode }) {
      // parche especifico para boletas (41, 39) que a veces traen un espacio en el CSV
      const montoExentoBoleta = raw["Monto Exento"] || raw[" Monto Exento"] || 0;
      const amountExempt = (docTypeCode === 41 || docTypeCode === 39)
         ? Number(montoExentoBoleta)
         : (inter.amount_exempt || 0);

      // parche para RUT de boletas (RUT Receptor en vez de rut normal)
      const counterpartyRut = (docTypeCode === 41 || docTypeCode === 39)
         ? (raw["RUT Receptor"] ? String(raw["RUT Receptor"]).replace(/\./g, "").toUpperCase().trim() : null)
         : inter.counterparty_rut;

      const folio = (inter.folio || raw["Folio"] || "").toString().trim();
      const issueDate = inter.issue_date || this._parseDate(raw["Fecha Docto"]);

      return {
         entity_id: entityId,
         doc_type_code: docTypeCode,
         counterparty_rut: counterpartyRut,
         counterparty_name: inter.counterparty_name || null,
         source: "SII",
         external_key: `${folio}_${counterpartyRut || ""}_${issueDate || ""}`,
         folio,
         issue_date: issueDate,
         received_date: inter.received_date || null,
         due_date: inter.due_date || this._parseDate(raw["Fecha Venc."]) || null,
         period_year: Number(year),
         period_month: Number(month),
         state_id: this.STATE_ID_DEFAULT,

         total_amount: inter.total_amount || this._parseNum(raw["Monto Total"]),
         amount_net: inter.amount_net || this._parseNum(raw["Monto Neto"]),
         amount_vat: inter.amount_vat || this._parseNum(raw["Monto IVA"]),
         amount_exempt: amountExempt,

         seq_no: inter.seq_no ?? null,
         purchase_type: inter.purchase_type || null,
         acuse_date: inter.acuse_date || null,

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

   // helper interno para parsear fechas DD/MM/YYYY si utils falla
   _parseDate(d) {
      if (!d) return null;
      const p = String(d).split("/");
      if (p.length !== 3) return null;
      return `${p[2]}-${p[1]}-${p[0]}`;
   }

   // helper interno para parsear numeros sucios
   _parseNum(v) {
      if (!v) return 0;
      if (typeof v === "number") return v;
      const n = parseFloat(v.toString().replace(/\./g, "").replace(",", "."));
      return isNaN(n) ? 0 : n;
   }

   _buildInsertSQL(rows, { upsert = false }) {
      const cols = Object.keys(rows[0]);
      const placeholdersRow = `(${cols.map(() => "?").join(",")})`;
      const values = [];
      const rowsSql = rows.map((r) => {
         cols.forEach((c) => values.push(r[c]));
         return placeholdersRow;
      }).join(",");

      let sql = `INSERT INTO entity_sii_documents (${cols.map((c) => `\`${c}\``).join(",")}) VALUES ${rowsSql}`;

      if (upsert) {
         const updateCols = cols.filter((c) => !this.KEY_COLS.includes(c) && c !== 'created_at');
         const updateSql = updateCols.map((c) => {
            if (c === 'updated_at') return `\`${c}\`=NOW()`;
            return `\`${c}\`=VALUES(\`${c}\`)`;
         }).join(",");
         sql += ` ON DUPLICATE KEY UPDATE ${updateSql}`;
      }

      return { sql, values };
   }

   async _fetchExistingKeys({ entityId, chunk }) {
      const keys = chunk.map(r => this._keyOf(r));
      const ph = keys.map(() => "?").join(",");
      const q = `
         SELECT CONCAT_WS('#', entity_id, doc_type_code, counterparty_rut, folio, issue_date) AS k
         FROM entity_sii_documents
         WHERE entity_id = ? AND CONCAT_WS('#', entity_id, doc_type_code, counterparty_rut, folio, issue_date) IN (${ph})
      `;
      const replacements = [entityId, ...keys];
      const [rows] = await sequelize.query(q, { replacements });
      return new Set(rows.map(r => r.k));
   }

   _addCounter(map, tipo, field, inc = 1) {
      if (!map[tipo]) map[tipo] = { processed: 0, inserted: 0, updated: 0, skipped: 0 };
      map[tipo][field] += inc;
   }

   /**
    * Funcion principal para cargar cualquier CSV del SII
    */
   async loadCsv(filePath, { entityId, year, month, onlyTypes = null }, { chunkSize = 500 } = {}) {
      const raw = await parseCsvFile(filePath, { delimiter: ";" });
      if (!raw.length) return { totals: { processed: 0, inserted: 0, updated: 0, skipped: 0 }, byType: {} };

      const byType = {};
      const records = [];
      let skipped = 0;

      for (const r of raw) {
         const tipo = Number(String(r["Tipo Doc"] || r["TipoDoc"] || "").trim());
         if (!Number.isFinite(tipo)) { skipped++; continue; }
         if (Array.isArray(onlyTypes) && onlyTypes.length && !onlyTypes.includes(tipo)) { skipped++; continue; }

         const inter = pickAndNormalize(r);
         const row = this._toRow(inter, r, { entityId, year, month, docTypeCode: tipo });

         if (!row.issue_date || !row.folio || !row.counterparty_rut) { skipped++; continue; }

         // inyectamos timestamps
         row.created_at = new Date();
         row.updated_at = new Date();

         records.push(row);
         this._addCounter(byType, String(tipo), "processed", 1);
      }

      if (!records.length) {
         return { totals: { processed: 0, inserted: 0, updated: 0, skipped }, byType };
      }

      let inserted = 0, updated = 0;
      await sequelize.transaction(async (t) => {
         for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            const existing = await this._fetchExistingKeys({ entityId, chunk });

            const newRows = chunk.filter(r => !existing.has(this._keyOf(r)));
            const updRows = chunk.filter(r => existing.has(this._keyOf(r)));

            if (newRows.length) {
               const { sql, values } = this._buildInsertSQL(newRows, { upsert: false });
               await sequelize.query(sql, { replacements: values, transaction: t });
               inserted += newRows.length;
               for (const r of newRows) this._addCounter(byType, String(r.doc_type_code), "inserted", 1);
            }

            if (updRows.length) {
               const { sql, values } = this._buildInsertSQL(updRows, { upsert: true });
               await sequelize.query(sql, { replacements: values, transaction: t });
               updated += updRows.length;
               for (const r of updRows) this._addCounter(byType, String(r.doc_type_code), "updated", 1);
            }
         }
      });

      return { totals: { processed: records.length, inserted, updated, skipped }, byType };
   }
}

module.exports = SiiLoaderService;