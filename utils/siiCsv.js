// utils/siiCsv.js
const normHeader = (s = "") =>
   s.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ").trim().toLowerCase()
      .replace(/:+$/, ""); // <-- quita ':' al final

// acepta "dd-mm-aaaa HH:MM[:SS]" o "dd/mm/aaaa HH:MM[:SS]"
// devuelve "yyyy-mm-dd HH:MM:SS" o null si invalida
const toMySQLDateTime = (s) => {
   if (!s) return null;
   const m = String(s).trim().match(
      /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
   );
   if (!m) return null;

   let [, dd, mm, yyyy, hh, mi, ss] = m;
   const day = +dd, month = +mm, year = +yyyy;
   const hour = +hh, minute = +mi, second = ss ? +ss : 0;

   // validaciones básicas
   if (month < 1 || month > 12) return null;
   const dim = new Date(year, month, 0).getDate(); // días del mes
   if (day < 1 || day > dim) return null;
   if (hour < 0 || hour > 23) return null;
   if (minute < 0 || minute > 59) return null;
   if (second < 0 || second > 59) return null;

   const pad2 = (n) => String(n).padStart(2, "0");
   return `${yyyy}-${pad2(month)}-${pad2(day)} ${pad2(hour)}:${pad2(minute)}:${pad2(second)}`;
};


const parseDateCL = (s) => {
   if (!s) return null;
   // acepta "dd-mm-aaaa", "dd/mm/aaaa" y variantes con hora, ej: "dd-mm-aaaa HH:MM:SS"
   const m = String(s).match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
   if (!m) return null;
   const [, dd, mm, yyyy] = m;
   return `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};

const parseAmount = (s) => {
   if (s == null || s === "") return 0;
   const n = Number(String(s).replace(/\./g, "").replace(",", "."));
   return Number.isFinite(n) ? n : 0;
};

const normalizeRut = (rut) => {
   if (!rut) return null;
   return String(rut).replace(/\./g, "").replace(/\s+/g, "").toUpperCase(); // conserva guion
};

// mapa encabezados CSV → campos intermedios
const H = new Map([
   ["nro", "seq_no"],
   ["tipo doc", "tipo_doc"],
   ["tipo compra", "purchase_type"],
   ["rut proveedor", "rut_proveedor"],
   ["rut cliente", "rut_cliente"],
   ["rut receptor", "rut_receptor"],
   ["razon social", "counterparty_name"],
   ["folio", "folio"],
   ["fecha docto", "issue_date"],
   ["fecha recepcion", "received_date"],
   ["fecha acuse", "acuse_date"],
   ["fecha acuse recibo", "acuse_date"],
   ["monto exento", "amount_exempt"],
   ["monto neto", "amount_net"],
   ["monto iva", "amount_vat"],
   ["monto iva recuperable", "amount_vat"],
   ["monto iva no recuperable", "amount_vat_non_recoverable"],
   ["codigo iva no rec.", "vat_non_recoverable_code"],
   ["monto total", "total_amount"],
   ["monto neto activo fijo", "amount_net_fixed_assets"],
   ["iva activo fijo", "amount_vat_fixed_assets"],
   ["iva uso comun", "amount_vat_common_use"],
   ["impto. sin derecho a credito", "amount_tax_no_credit"],
   ["iva no retenido", "amount_vat_not_withheld"],
   ["tabacos puros", "tobacco_puros"],
   ["tabacos cigarrillos", "tobacco_cigarrillos"],
   ["tabacos elaborados", "tobacco_elaborados"],
   ["nce o nde sobre fact. de compra", "nce_nde_reference"],
   ["codigo otro impuesto", "other_tax_code"],
   ["valor otro impuesto", "other_tax_value"],
   ["tasa otro impuesto", "other_tax_rate"],
]);

function pickAndNormalize(csvRow) {
   const out = {};
   for (const [k, v] of Object.entries(csvRow)) {
      const key = H.get(normHeader(k));
      if (!key) continue;
      out[key] = v;
   }

   // normalizaciones de fechas
   out.issue_date = parseDateCL(out.issue_date);
   out.received_date = toMySQLDateTime(out.received_date);
   out.acuse_date = parseDateCL(out.acuse_date);

   // montos
   const moneyFields = [
      "amount_exempt", "amount_net", "amount_vat", "amount_vat_non_recoverable", "total_amount",
      "amount_net_fixed_assets", "amount_vat_fixed_assets", "amount_vat_common_use",
      "amount_tax_no_credit", "amount_vat_not_withheld", "tobacco_puros", "tobacco_cigarrillos",
      "tobacco_elaborados", "other_tax_value", "other_tax_rate"
   ];
   for (const f of moneyFields) out[f] = parseAmount(out[f]);

   // RUT
   out.counterparty_rut = normalizeRut(
      csvRow["RUT Proveedor"]
      || csvRow["Rut Proveedor"]
      || csvRow["Rut cliente"]
      || csvRow["RUT Cliente"]
      || csvRow["RUT Receptor"]
      || csvRow["Rut Receptor"]
      || out.rut_proveedor
      || out.rut_cliente
      || out.rut_receptor
   );

   // seq_no
   if (out.seq_no != null && out.seq_no !== "") out.seq_no = Number(out.seq_no);

   return out;
}

module.exports = { pickAndNormalize };
