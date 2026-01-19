"use strict";

const { sequelize } = require("../libs/sequelize");
const { parseCsvFile } = require("../libs/functions");

const STATE_ID_DEFAULT = 1; // Ajusta según tu sistema

// Helper para limpiar RUTs (12.345.678-9 -> 12345678-9)
const cleanRut = (r) => r ? String(r).replace(/\./g, "").toUpperCase().trim() : null;

// Helper para parsear números (SII usa formato local a veces, pero en CSV suele ser entero directo)
const parseNum = (v) => {
   if (!v) return 0;
   if (typeof v === "number") return v;
   // Quitamos puntos de miles si vienen y cambiamos coma decimal
   const n = parseFloat(v.toString().replace(/\./g, "").replace(",", "."));
   return isNaN(n) ? 0 : n;
};

// Helper para fechas DD/MM/YYYY -> YYYY-MM-DD
const parseDate = (d) => {
   if (!d) return null;
   const p = d.split("/");
   if (p.length !== 3) return null;
   return `${p[2]}-${p[1]}-${p[0]}`;
};

/**
 * Mapea la fila del CSV de Boletas (Venta) a la estructura de tu BD entity_sii_documents
 */
function toRow(raw, { entityId, year, month }) {
   // Columnas esperadas en CSV Ventas (Boletas):
   // Tipo Doc;RUT Receptor;Fecha Docto;Fecha Venc.;Indicador Servicio;Folio;Monto Neto;Monto IVA; Monto Exento;Monto Total

   // FIX CRÍTICO: " Monto Exento" a veces trae espacio al inicio en el CSV del SII
   const montoExento = raw["Monto Exento"] || raw[" Monto Exento"] || 0;

   const folio = String(raw["Folio"] || "").trim();
   const rutReceptor = cleanRut(raw["RUT Receptor"]);
   const fechaDocto = parseDate(raw["Fecha Docto"]);

   return {
      entity_id: entityId,
      doc_type_code: 41, // 41 = Boleta Electrónica
      counterparty_rut: rutReceptor, // En ventas, el receptor es el cliente
      counterparty_name: null,       // Boletas no traen Razón Social del cliente

      source: "SII",
      // Clave única externa para evitar duplicados lógicos
      external_key: `${folio}_${rutReceptor || "0"}_${fechaDocto || "0000-00-00"}`,

      folio: folio,
      issue_date: fechaDocto,
      received_date: null,
      due_date: parseDate(raw["Fecha Venc."]) || null,

      period_year: Number(year),
      period_month: Number(month),
      state_id: STATE_ID_DEFAULT,

      total_amount: parseNum(raw["Monto Total"]),
      amount_net: parseNum(raw["Monto Neto"]),
      amount_vat: parseNum(raw["Monto IVA"]),
      amount_exempt: parseNum(montoExento),

      // Campos que no aplican a boletas o no vienen
      seq_no: null,
      purchase_type: null,
      acuse_date: null
   };
}

/**
 * Construye la query INSERT ... ON DUPLICATE KEY UPDATE dinámicamente
 */
function buildBulkInsert(rows) {
   if (!rows.length) return { sql: "", values: [] };

   const cols = Object.keys(rows[0]);
   const values = [];
   const placeholders = [];

   for (const r of rows) {
      // Aplanamos los valores
      for (const col of cols) values.push(r[col]);
      placeholders.push(`(${cols.map(() => "?").join(",")})`);
   }

   const rowsSql = placeholders.join(",\n");

   // Definimos qué columnas actualizar si ya existe la clave (UPSERT)
   // Actualizamos montos y fechas por si hubo corrección
   const updateCols = [
      "total_amount", "amount_net", "amount_vat", "amount_exempt",
      "issue_date", "period_year", "period_month", "updated_at"
   ];

   const updateSql = updateCols.map(c => {
      if (c === "updated_at") return "updated_at = NOW()";
      return `${c} = VALUES(${c})`;
   }).join(", ");

   // Asegúrate que tu tabla se llame 'entity_sii_documents' y tenga las columnas generadas en toRow
   const sql = `
      INSERT INTO entity_sii_documents (${cols.join(",")}, created_at, updated_at)
      VALUES 
      ${rows.map(() => `(${cols.map(() => "?").join(",")}, NOW(), NOW())`).join(",\n")}
      ON DUPLICATE KEY UPDATE ${updateSql}
   `;

   // NOTA: Ajuste sutil para inyectar created_at/updated_at que no van en values plano
   // Reconstruimos para ser 100% seguros con tu estilo 34.js:

   const colsSql = cols.map(c => `\`${c}\``).join(",");

   // Values flattening corregido para incluir NOW() directo en SQL si se prefiere,
   // pero para seguir tu patrón exacto de 34.js, usaremos un truco más simple:

   const finalSql = `
      INSERT INTO entity_sii_documents (${colsSql}, created_at, updated_at)
      VALUES ${rows.map(() => `(${cols.map(() => "?").join(",")}, NOW(), NOW())`).join(",")}
      ON DUPLICATE KEY UPDATE ${updateSql}
   `;

   return { sql: finalSql, values };
}

/**
 * Función Principal Exportada
 */
exports.loadCsvSiiBoletas41 = async (filePath, { entityId, year, month }, { chunkSize = 500 } = {}) => {
   // 1. Parsear CSV con tu librería (asume delimitador ;)
   const raw = await parseCsvFile(filePath, { delimiter: ";" });

   if (!raw || !raw.length) return { inserted: 0, updated: 0, skipped: 0 };

   const records = [];
   let skipped = 0;

   // 2. Transformar a objetos de BD
   for (const r of raw) {
      // Filtrar solo Tipo 41 (Boletas)
      // A veces viene como número 41 o string "41"
      if (String(r["Tipo Doc"]).trim() !== "41") {
         skipped++;
         continue;
      }

      const rowData = toRow(r, { entityId, year, month });

      // Validar clave mínima
      if (!rowData.folio || !rowData.issue_date) {
         skipped++;
         continue;
      }

      records.push(rowData);
   }

   if (!records.length) return { inserted: 0, updated: 0, skipped };

   // 3. Insertar en lotes (Chunking) dentro de una transacción
   let processedCount = 0;

   await sequelize.transaction(async (t) => {
      for (let i = 0; i < records.length; i += chunkSize) {
         const chunk = records.slice(i, i + chunkSize);

         const { sql, values } = buildBulkInsert(chunk);

         // Ejecutar query
         await sequelize.query(sql, {
            replacements: values,
            transaction: t
         });

         processedCount += chunk.length;
      }
   });

   // Retornamos totals (Asumimos todo como "inserted/processed" ya que upsert es difícil de diferenciar en count simple)
   return {
      totals: {
         inserted: processedCount,
         updated: 0, // MySQL devuelve count mezclado en upsert
         skipped
      }
   };
};