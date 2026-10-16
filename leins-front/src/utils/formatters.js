/**
 * Convierte un valor a número limpio de forma robusta e idéntica al backend.
 * Maneja separadores de miles y decimales comunes en Chile y hojas de cálculo.
 */
export function normalizeAmount(v) {
   if (typeof v === "number") return v;
   if (!v) return 0;

   let s = String(v).trim().replace(/\s+/g, '');
   s = s.replace(/[^\d\.\,\-]/g, ''); // deja dígitos, ., , y -
   const hasDot = s.includes('.');
   const hasComma = s.includes(',');
   if (hasDot && hasComma) {
      const lastDot = s.lastIndexOf('.');
      const lastComma = s.lastIndexOf(',');
      if (lastComma > lastDot) {
         s = s.replace(/\./g, '').replace(',', '.'); // 317.533,25 -> 317533.25
      } else {
         s = s.replace(/,/g, ''); // 317,533.25 -> 317533.25
      }
   } else if (hasComma && !hasDot) {
      const commaCount = (s.match(/,/g) || []).length;
      if (commaCount === 1 && /,\d{1,2}$/.test(s)) s = s.replace(',', '.'); // 1,23 -> 1.23
      else s = s.replace(/,/g, ''); // 15,000 -> 15000 o 59,763 -> 59763
   } else if (hasDot && !hasComma) {
      const dotCount = (s.match(/\./g) || []).length;
      if (dotCount > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, ''); // 50.273 -> 50273
   }
   const n = parseFloat(s);
   return Number.isFinite(n) ? n : 0;
}

/**
 * Formateador de moneda chilena (CLP) sin decimales
 */
export const fmtCLP = (n) =>
   new Intl.NumberFormat("es-CL", {
      style: "currency",
      currency: "CLP",
      maximumFractionDigits: 0,
   }).format(n || 0);

/**
 * Convierte color HEX a RGBA
 * @param {string} hex Ej: #ff0000
 * @param {number} alpha 0 a 1
 */
export function hexToRgba(hex, alpha = 1) {
   const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
   if (!m) return hex;
   const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
   return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Formatea fecha ISO a YYYY-MM-DD
 */
export const toYmd = (d) => d ? new Date(d).toISOString().slice(0, 10) : null;