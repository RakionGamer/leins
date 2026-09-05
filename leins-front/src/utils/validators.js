/**
 * Validador de RUT Chileno (Algoritmo Módulo 11)
 * Acepta formatos: 12.345.678-9, 12345678-9, 123456789
 */
export const validateRut = (rut) => {
   if (!rut) return "El RUT es obligatorio";

   // Limpiar puntos y guiones
   const cleanRut = rut.replace(/[^0-9kK]/g, "");

   if (cleanRut.length < 8) return "RUT inválido (muy corto)";

   const body = cleanRut.slice(0, -1);
   const dv = cleanRut.slice(-1).toUpperCase();

   // Calcular dígito verificador esperado
   let sum = 0;
   let multiplier = 2;

   for (let i = body.length - 1; i >= 0; i--) {
      sum += parseInt(body[i]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
   }

   const expectedDv = 11 - (sum % 11);
   let computedDv = expectedDv === 11 ? "0" : expectedDv === 10 ? "K" : expectedDv.toString();

   return dv === computedDv ? "" : "RUT inválido (dígito incorrecto)";
};

// Formatea a RUT chileno visible: 12.345.678-5
export function formatRutCL(value) {
   if (!value) return '';

   const clean = String(value)
      .replace(/[^0-9kK]/g, '')
      .toUpperCase()
      .slice(0, 9);

   if (clean.length <= 1) return clean;

   const body = clean.slice(0, -1);
   const dv = clean.slice(-1);
   const bodyWithDots = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
   return `${bodyWithDots}-${dv}`;
}

/**
 * Validador de Teléfono Móvil Chileno
 * Acepta: +56912345678, 912345678, 56912345678
 */
export const validatePhoneCL = (phone) => {
   if (!phone) return ""; // Opcional, si es obligatorio validar fuera

   // Elimina espacios y +
   const cleanPhone = phone.replace(/[\s+]/g, "");

   // Regex estricta: debe terminar en 9 y 8 dígitos más (total 9 dígitos móviles)
   // Opcionalmente puede tener el prefijo 56
   const regex = /^(56)?9[2-9]\d{7}$/;

   if (!regex.test(cleanPhone)) {
      return "Formato inválido. Ej: 987654321";
   }
   return "";
};

/**
 * Validador de Nombre Humano
 * Solo letras, espacios y acentos básicos. Mínimo 2 letras.
 */
export const validateHumanName = (name) => {
   if (!name || !name.trim()) return "Campo obligatorio";
   // Permite letras, espacios, acentos (áéíóú), ñ. No números ni símbolos raros.
   const regex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]{2,50}$/;
   return regex.test(name) ? "" : "Solo letras y espacios permitidos";
};

// Validador Genérico de Email
export const validateEmail = (email) => {
   const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
   return regex.test(email) ? "" : "Email inválido";
};

// Calcula dígito verificador chileno (mod 11)
export function rutDV(bodyDigits) {
   let sum = 0, f = 2;
   for (let i = bodyDigits.length - 1; i >= 0; i--) {
      sum += Number(bodyDigits[i]) * f;
      f = f === 7 ? 2 : f + 1;
   }
   const r = 11 - (sum % 11);
   if (r === 11) return '0';
   if (r === 10) return 'K';
   return String(r);
}

// Normaliza a formato sin puntos y con guion (NNNNNNNN-D)
export function normalizeRut(body, dv) {
   const cleanBody = String(Number(body)); // Quita ceros a la izquierda
   return `${cleanBody}-${String(dv).toUpperCase()}`;
}

// Extrae RUT desde texto (busca patrones y valida DV)
export function extractRutFromText(text) {
   if (!text) return null;
   const s = String(text).toUpperCase();

   // caso 1: con guion
   const m1 = s.match(/\b(\d{1,2}(?:\.\d{3}){1,2}|\d{7,8})-([\dK])\b/);
   if (m1) {
      const body = m1[1].replace(/\./g, '');
      const dv = m1[2];
      return normalizeRut(body, dv);
   }

   // caso 2: solo dígitos con DV al final (8 a 10 dígitos)
   const m2 = s.match(/\b(\d{8,10})\b/);
   if (m2) {
      const token = m2[1];
      if (token.length >= 8) {
         const body = token.slice(0, -1);
         const dv = token.slice(-1);
         if (rutDV(body) === dv) {
            return normalizeRut(body, dv);
         }
      }
   }

   // caso 3: buscar cualquier token largo y validar DV
   const allNums = s.match(/\d{7,10}/g) || [];
   for (const tok of allNums) {
      if (tok.length >= 8) {
         const body = tok.slice(0, -1);
         const dv = tok.slice(-1);
         if (rutDV(body) === dv) {
            return normalizeRut(body, dv);
         }
      }
   }

   return null;
}

// Intenta obtener un RUT desde una fila de datos (objeto)
export function getRutFromRow(row) {
   return (
      extractRutFromText(row?.documento) ||
      extractRutFromText(row?.glosa) ||
      extractRutFromText(row?.descripcion) ||
      null
   );
}
