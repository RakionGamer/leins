// utils/toCsv.js
// serializa un arreglo de objetos a texto csv (rfc 4180), usando las columnas indicadas

function escapeCsvField(value) {
   if (value === null || value === undefined) return '';
   const s = String(value);
   if (/[",\n\r;]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
   }
   return s;
}

function toCsv(rows, columns) {
   const header = columns.map((c) => escapeCsvField(c.header)).join(',');
   const lines = rows.map((row) =>
      columns.map((c) => escapeCsvField(c.value(row))).join(',')
   );
   return ['﻿' + header, ...lines].join('\r\n');
}

module.exports = { toCsv };
