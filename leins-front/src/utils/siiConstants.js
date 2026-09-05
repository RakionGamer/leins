export const SII_DOCUMENT_TYPES = {
   33: {
      code: 33,
      slug: 'factura-afecta',
      abbr: 'FAC-EL',
      name: 'Factura Afecta',
      label: '33 - Factura Afecta',
      family: 'FACTURA',
      color: '#ef4444'
   },
   34: {
      code: 34,
      slug: 'factura-exenta-electronica',
      abbr: 'FEE',
      name: 'Factura Exenta',
      label: '34 - Factura Exenta',
      family: 'FACTURA',
      color: '#F54927'
   },
   39: {
      code: 39,
      slug: 'boleta-electronica',
      abbr: 'BTE',
      name: 'Boleta Electronica',
      label: '39 - Boleta Electronica',
      family: 'BOLETA',
      color: '#8b5cf6'
   },
   41: {
      code: 41,
      slug: 'boleta-exenta-electronica',
      abbr: 'BTE-EX',
      name: 'Boleta Exenta',
      label: '41 - Boleta Exenta',
      family: 'BOLETA',
      color: '#6366f1'
   },
   46: {
      code: 46,
      slug: 'factura-compra-electronica',
      abbr: 'FCE',
      name: 'Factura de Compra Electronica',
      label: '46 - Factura de Compra Electronica',
      family: 'FACTURA',
      color: '#0ea5e9'
   },
   52: {
      code: 52,
      slug: 'guia-despacho-electronica',
      abbr: 'GDE',
      name: 'Guia de Despacho Electronica',
      label: '52 - Guia de Despacho Electronica',
      family: 'GUIA',
      color: '#f59e0b'
   },
   56: {
      code: 56,
      slug: 'nota-debito-electronica',
      abbr: 'NDE',
      name: 'Nota de Debito Electronica',
      label: '56 - Nota de Debito Electronica',
      family: 'NOTA',
      color: '#d97706'
   },
   61: {
      code: 61,
      slug: 'nota-credito-electronica',
      abbr: 'NCE',
      name: 'Nota de Credito Electronica',
      label: '61 - Nota de Credito Electronica',
      family: 'NOTA',
      color: '#10b981'
   },
   71: {
      code: 71,
      slug: 'boleta-honorarios-electronica',
      abbr: 'BHE',
      name: 'Boleta de Honorarios Electronica',
      label: '71 - Boleta de Honorarios Electronica',
      family: 'HONORARIO',
      color: '#22c55e'
   },
   1001: {
      code: 1001,
      slug: 'boleta-honorarios-emitida',
      abbr: 'BHE-E',
      name: 'Boleta de Honorarios Emitida',
      label: '1001 - Boleta de Honorarios Emitida',
      family: 'HONORARIO',
      color: '#059669'
   },
   1002: {
      code: 1002,
      slug: 'boleta-honorarios-recibida',
      abbr: 'BHE-R',
      name: 'Boleta de Honorarios Recibida',
      label: '1002 - Boleta de Honorarios Recibida',
      family: 'HONORARIO',
      color: '#2563eb'
   }
};

export const DOC_TAGS = Object.fromEntries(
   Object.entries(SII_DOCUMENT_TYPES).map(([code, type]) => [
      code,
      { abbr: type.abbr, color: type.color, label: type.label, name: type.name, family: type.family }
   ])
);

export const SII_DOCUMENT_FILTERS = {
   expense: [
      { value: '1002', label: SII_DOCUMENT_TYPES[1002].label },
      { value: 'null', label: 'Recibo' },
      { value: '33', label: SII_DOCUMENT_TYPES[33].label },
      { value: '34', label: SII_DOCUMENT_TYPES[34].label },
   ],
   income: [
      { value: '33', label: SII_DOCUMENT_TYPES[33].label },
      { value: '34', label: SII_DOCUMENT_TYPES[34].label },
      { value: '41', label: SII_DOCUMENT_TYPES[41].label },
      { value: '39', label: SII_DOCUMENT_TYPES[39].label },
      { value: 'null', label: 'Sin Tipo' }
   ],
   manualExpense: [
      { value: '1002', label: SII_DOCUMENT_TYPES[1002].label },
      { value: '39', label: 'BOLETAS' },
      { value: '33', label: 'FACTURA' },
      { value: 'null', label: 'RECIBO' }
   ],
   manualIncome: [
      { value: '41', label: SII_DOCUMENT_TYPES[41].label },
      { value: '39', label: SII_DOCUMENT_TYPES[39].label }
   ]
};

export function getSiiDocumentType(code) {
   if (code === null || code === undefined || code === '' || String(code) === 'null') {
      return { code: null, slug: 'recibo', abbr: 'REC', name: 'Recibo', label: 'Recibo', family: 'RECIBO', color: '#64748b' };
   }

   const type = SII_DOCUMENT_TYPES[Number(code)];
   if (type) return type;

   return {
      code: Number.isFinite(Number(code)) ? Number(code) : code,
      slug: 'desconocido',
      abbr: String(code),
      name: `Documento ${code}`,
      label: `${code} - Documento SII`,
      family: 'OTRO',
      color: '#64748b'
   };
}

export function getSiiDocumentTypeLabel(code) {
   return getSiiDocumentType(code).label;
}

export function getSiiDocumentTypeShortLabel(code) {
   const type = getSiiDocumentType(code);
   return type.code ? `${type.abbr} ${type.code}` : type.abbr;
}

export function docTag(code) {
   const type = getSiiDocumentType(code);
   return { abbr: type.abbr, color: type.color, label: type.label, name: type.name, family: type.family };
}
