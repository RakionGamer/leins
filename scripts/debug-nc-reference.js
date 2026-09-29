#!/usr/bin/env node
"use strict";

/**
 * debug-nc-reference.js
 * Muestra el campo nce_nde_reference de las Notas de Crédito (tipo 61)
 * para una entidad determinada, y también muestra si existen facturas
 * que coincidan con ese folio de referencia.
 *
 * Uso: node scripts/debug-nc-reference.js [entityId]
 * Ejemplo: node scripts/debug-nc-reference.js 19
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const { sequelize } = require('../libs/sequelize');
const { QueryTypes } = require('sequelize');

const entityId = Number(process.argv[2] || 19);

async function main() {
   try {
      await sequelize.authenticate();
      console.log(`\n🔍 Consultando NCs (tipo 61) para entity_id = ${entityId}\n`);

      // 1) Mostrar las NCs con su nce_nde_reference
      const ncs = await sequelize.query(`
         SELECT
            id,
            folio,
            issue_date,
            counterparty_rut,
            counterparty_name,
            total_amount,
            nce_nde_reference
         FROM entity_sii_documents
         WHERE entity_id = :entityId
           AND doc_type_code = 61
         ORDER BY issue_date DESC
         LIMIT 20
      `, { replacements: { entityId }, type: QueryTypes.SELECT });

      if (!ncs.length) {
         console.log('❌ No se encontraron NCs para esta entidad.');
      } else {
         console.log('📋 Notas de Crédito encontradas:');
         console.table(ncs.map(r => ({
            id: r.id,
            folio: r.folio,
            fecha: r.issue_date,
            rut_cliente: r.counterparty_rut,
            total: r.total_amount,
            nce_nde_reference: r.nce_nde_reference ?? 'NULL ❌',
         })));
      }

      // 2) Para cada NC con referencia, buscar si existe la factura correspondiente
      const ncsConRef = ncs.filter(r => r.nce_nde_reference);
      if (ncsConRef.length === 0) {
         console.log('\n⚠️  Ninguna NC tiene nce_nde_reference definido. El campo llegó NULL desde el CSV.\n');
      } else {
         console.log('\n🔗 Verificando si existen facturas para cada referencia:\n');
         for (const nc of ncsConRef) {
            const facturas = await sequelize.query(`
               SELECT id, folio, doc_type_code, counterparty_rut, total_amount
               FROM entity_sii_documents
               WHERE entity_id = :entityId
                 AND doc_type_code IN (33, 34)
                 AND CAST(folio AS UNSIGNED) = CAST(:ref AS UNSIGNED)
                 AND counterparty_rut = :rut
               LIMIT 5
            `, {
               replacements: {
                  entityId,
                  ref: nc.nce_nde_reference,
                  rut: nc.counterparty_rut,
               },
               type: QueryTypes.SELECT,
            });

            if (facturas.length) {
               console.log(`✅ NC folio ${nc.folio} → referencia ${nc.nce_nde_reference} → Factura encontrada: folio ${facturas[0].folio} (id ${facturas[0].id})`);
            } else {
               console.log(`❌ NC folio ${nc.folio} → referencia ${nc.nce_nde_reference} → Sin factura coincidente (rut: ${nc.counterparty_rut})`);
            }
         }
      }

      console.log('\n✅ Diagnóstico completo.\n');
   } catch (err) {
      console.error('Error:', err.message);
   } finally {
      await sequelize.close();
      process.exit(0);
   }
}

main();
