"use strict";

const { sequelize } = require("../libs/sequelize");
const { parseCsvFile } = require("../libs/functions");
const { pickAndNormalize } = require("../utils/siiCsv");

class SiiLoaderService {
   constructor() {
      this.STATE_ID_DEFAULT = 1;
      this.KEY_COLS = ["entity_id", "doc_type_code", "counterparty_rut", "folio", "issue_date"];
      this.HONORARIOS_TYPES = {
         issued: 1001,
         received: 1002,
      };
   }

   // helper para formatear la clave unica
   _keyOf(r) {
      return `${r.entity_id}#${r.doc_type_code}#${r.counterparty_rut}#${r.folio}#${r.issue_date}`;
   }

   // funcion para armar el registro homogeneo para la bd
   _toRow(inter, raw, { entityId, year, month, docTypeCode, operationType = null }) {
      // parche especifico para boletas (41, 39) que a veces traen un espacio en el CSV
      const montoExentoBoleta = raw["Monto Exento"] || raw[" Monto Exento"] || 0;
      const amountExempt = (docTypeCode === 41 || docTypeCode === 39)
         ? Number(montoExentoBoleta)
         : (inter.amount_exempt || 0);

      // parche para RUT de boletas (RUT Receptor en vez de rut normal)
      const counterpartyRut = (docTypeCode === 41 || docTypeCode === 39)
         ? (raw["RUT Receptor"] ? String(raw["RUT Receptor"]).replace(/\./g, "").toUpperCase().trim() : null)
         : (
            inter.counterparty_rut
            || raw["Rut cliente"]
            || raw["RUT Cliente"]
            || raw["Rut Cliente"]
            || raw["RUT Receptor"]
            || raw["Rut Receptor"]
            || raw["RUT Proveedor"]
            || raw["Rut Proveedor"]
            || null
         );

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
         operation_type: operationType,

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

   _addSkipReason(map, reason, inc = 1) {
      map[reason] = (map[reason] || 0) + inc;
   }

   _normalizeHeader(value) {
      return String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/&[a-z]+;/gi, " ")
         .replace(/[^a-zA-Z0-9]+/g, " ")
         .trim()
         .toLowerCase();
   }

   _pickByHeader(row, patterns) {
      const entries = Object.entries(row || {});
      for (const pattern of patterns) {
         const found = entries.find(([key]) => this._normalizeHeader(key).includes(pattern));
         if (found && found[1] !== undefined && found[1] !== null && String(found[1]).trim() !== "") {
            return found[1];
         }
      }
      return null;
   }

   _normalizeRut(value) {
      if (!value) return null;
      const cleaned = String(value).replace(/\./g, "").replace(/\s+/g, "").toUpperCase();
      return cleaned || null;
   }

   _parseAnyDate(value) {
      if (!value) return null;
      const text = String(value).trim();

      if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

      let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
      if (match) {
         return `${match[3]}-${String(match[2]).padStart(2, "0")}-${String(match[1]).padStart(2, "0")}`;
      }

      match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
      if (match) {
         return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
      }

      return this._parseDate(text);
   }

   _buildHonorariosRow(raw, { entityId, year, month, direction }) {
      const isReceived = direction === "received";
      const docTypeCode = isReceived ? this.HONORARIOS_TYPES.received : this.HONORARIOS_TYPES.issued;

      const folio = String(this._pickByHeader(raw, [
         "n boleta",
         "nro boleta",
         "num boleta",
         "numero boleta",
         "folio",
         "boleta",
      ]) || "").replace(/[^\d]/g, "").trim();

      const issueDate = this._parseAnyDate(this._pickByHeader(raw, [
         "fecha emision",
         "fecha boleta",
         "fecha",
      ]));

      const rutPatterns = isReceived
         ? ["rut emisor", "rut prestador", "rut contribuyente", "rut"]
         : ["rut receptor", "rut destinatario", "rut cliente", "rut"];
      const namePatterns = isReceived
         ? ["nombre emisor", "nombre prestador", "razon social emisor", "nombre o razon social", "razon social", "emisor", "prestador", "nombre"]
         : ["nombre receptor", "nombre destinatario", "razon social receptor", "nombre o razon social", "razon social", "receptor", "destinatario", "nombre"];

      const counterpartyRut = this._normalizeRut(this._pickByHeader(raw, rutPatterns));
      const counterpartyName = this._pickByHeader(raw, namePatterns);

      const gross = this._parseNum(this._pickByHeader(raw, [
         "monto bruto",
         "honorario bruto",
         "bruto",
         "monto total",
         "total honorarios",
      ]));
      const withheld = this._parseNum(this._pickByHeader(raw, [
         "monto retenido",
         "retencion",
         "retenido",
         "impuesto",
      ]));
      const paid = this._parseNum(this._pickByHeader(raw, [
         "monto liquido",
         "liquido",
         "monto pagado",
         "pagado",
         "total pagado",
      ]));

      const totalAmount = paid || gross;

      return {
         entity_id: entityId,
         doc_type_code: docTypeCode,
         counterparty_rut: counterpartyRut,
         counterparty_name: counterpartyName ? String(counterpartyName).trim() : null,
         source: "SII",
         external_key: `BHE_${direction}_${folio}_${counterpartyRut || ""}_${issueDate || ""}`,
         folio,
         issue_date: issueDate,
         received_date: null,
         due_date: null,
         period_year: Number(year),
         period_month: Number(month),
         state_id: this.STATE_ID_DEFAULT,
         operation_type: isReceived ? "EXPENSE" : "INCOME",

         total_amount: totalAmount,
         amount_net: gross || totalAmount,
         amount_vat: 0,
         amount_exempt: 0,

         seq_no: null,
         purchase_type: null,
         acuse_date: null,

         amount_vat_non_recoverable: 0,
         vat_non_recoverable_code: null,
         amount_net_fixed_assets: 0,
         amount_vat_fixed_assets: 0,
         amount_vat_common_use: 0,
         amount_tax_no_credit: withheld || 0,
         amount_vat_not_withheld: 0,

         tobacco_puros: 0,
         tobacco_cigarrillos: 0,
         tobacco_elaborados: 0,

         nce_nde_reference: null,
         other_tax_code: null,
         other_tax_value: 0,
         other_tax_rate: 0,
      };
   }

   async _persistRecords({ records, entityId, byType, read, skipped, skipReasons }, { chunkSize = 500 } = {}) {
      if (!records.length) {
         return { totals: { read, processed: 0, inserted: 0, updated: 0, skipped, skipReasons }, byType };
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

      return { totals: { read, processed: records.length, inserted, updated, skipped, skipReasons }, byType };
   }

   /**
    * Funcion principal para cargar cualquier CSV del SII
    */
   async loadCsv(filePath, { entityId, year, month, onlyTypes = null, operationType = null, defaultDocType = null }, { chunkSize = 500 } = {}) {
      const raw = await parseCsvFile(filePath, { delimiter: ";" });
      if (!raw.length) return { totals: { read: 0, processed: 0, inserted: 0, updated: 0, skipped: 0, skipReasons: {} }, byType: {} };

      const byType = {};
      const records = [];
      let skipped = 0;
      const skipReasons = {};

      const allowedTypes = Array.isArray(onlyTypes)
         ? onlyTypes.map((type) => Number(type)).filter(Number.isFinite)
         : null;
      const forcedDocType = defaultDocType !== null && defaultDocType !== undefined
         ? Number(defaultDocType)
         : null;

      for (const r of raw) {
         let tipo = Number.isFinite(forcedDocType)
            ? forcedDocType
            : Number(String(r["Tipo Doc"] || r["TipoDoc"] || "").trim());

         if (!Number.isFinite(tipo)) {
            skipped++;
            this._addSkipReason(skipReasons, "tipo_doc_invalido");
            continue;
         }
         if (Array.isArray(allowedTypes) && allowedTypes.length && !allowedTypes.includes(tipo)) {
            skipped++;
            this._addSkipReason(skipReasons, "tipo_doc_filtrado");
            continue;
         }

         const inter = pickAndNormalize(r);
         const row = this._toRow(inter, r, { entityId, year, month, docTypeCode: tipo, operationType });

         if (!row.issue_date || !row.folio || !row.counterparty_rut) {
            skipped++;
            if (!row.issue_date) this._addSkipReason(skipReasons, "sin_fecha_documento");
            if (!row.folio) this._addSkipReason(skipReasons, "sin_folio");
            if (!row.counterparty_rut) this._addSkipReason(skipReasons, "sin_rut_contraparte");
            continue;
         }

         // inyectamos timestamps
         row.created_at = new Date();
         row.updated_at = new Date();

         records.push(row);
         this._addCounter(byType, String(tipo), "processed", 1);
      }

      return this._persistRecords({
         records,
         entityId,
         byType,
         read: raw.length,
         skipped,
         skipReasons,
      }, { chunkSize });
   }

   async loadHonorariosRows(rows, { entityId, year, month, direction }, { chunkSize = 500 } = {}) {
      const rawRows = Array.isArray(rows) ? rows : [];
      const byType = {};
      const records = [];
      let skipped = 0;
      const skipReasons = {};

      if (!["issued", "received"].includes(direction)) {
         throw new Error(`direccion de boletas de honorarios invalida: ${direction}`);
      }

      for (const raw of rawRows) {
         const row = this._buildHonorariosRow(raw, { entityId, year, month, direction });

         if (!row.issue_date || !row.folio || !row.counterparty_rut || !row.total_amount) {
            skipped++;
            if (!row.issue_date) this._addSkipReason(skipReasons, "sin_fecha_documento");
            if (!row.folio) this._addSkipReason(skipReasons, "sin_folio");
            if (!row.counterparty_rut) this._addSkipReason(skipReasons, "sin_rut_contraparte");
            if (!row.total_amount) this._addSkipReason(skipReasons, "sin_monto");
            continue;
         }

         row.created_at = new Date();
         row.updated_at = new Date();

         records.push(row);
         this._addCounter(byType, String(row.doc_type_code), "processed", 1);
      }

      return this._persistRecords({
         records,
         entityId,
         byType,
         read: rawRows.length,
         skipped,
         skipReasons,
      }, { chunkSize });
   }
}

module.exports = SiiLoaderService;
