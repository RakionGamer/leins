/**
 * Convierte un valor a número limpio.
 * Maneja strings con símbolos de moneda, puntos de miles y comas decimales.
 */
export function normalizeAmount(v) {
   if (typeof v === "number") return v;
   if (!v) return 0;

   const s = String(v)
      .trim()
      .replace(/[^\d,.-]/g, "") // quita símbolos tipo $ y espacios
      .replace(/\./g, "")       // quita puntos de miles
      .replace(",", ".");       // cambia coma decimal a punto
   const n = Number(s);
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