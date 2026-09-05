// services/bank.service.js
const xlsx = require('xlsx');
const boom = require('@hapi/boom');
const crypto = require('crypto');
const { models, sequelize } = require('../libs/sequelize');
const { QueryTypes, Transaction, Op } = require("sequelize");
const { config } = require('../config/config');

class BankService {
   static #normalizeRut(value) {
      return String(value || "").toUpperCase().replace(/[^0-9K]/g, "");
   }

   static #rutParts(value) {
      const clean = BankService.#normalizeRut(value);
      if (clean.length < 2) return null;

      const body = clean.slice(0, -1).replace(/^0+/, "");
      const dv = clean.slice(-1);
      const normalizedBody = body || "0";

      return {
         body: normalizedBody,
         full: `${normalizedBody}${dv}`,
      };
   }

   static #documentReconcileAmountSql(alias) {
      return `CASE
         WHEN ${alias}.doc_type_code IN (1001,1002)
          AND COALESCE(${alias}.amount_net,0) > COALESCE(${alias}.amount_tax_no_credit,0)
          AND COALESCE(${alias}.amount_tax_no_credit,0) > 0
            THEN COALESCE(${alias}.amount_net,0) - COALESCE(${alias}.amount_tax_no_credit,0)
         ELSE COALESCE(${alias}.total_amount,0)
      END`;
   }

   static #bankDocumentAppliedSumSql(alias) {
      return `(SELECT COALESCE(SUM(btd.amount_applied),0)
        FROM bank_transaction_documents btd
       WHERE btd.entity_bank_transaction_id = ${alias}.id)`;
   }

   static #bankPeerAppliedSumSql(alias) {
      return `(SELECT COALESCE(SUM(btm.amount_applied),0)
        FROM bank_transaction_matches btm
       WHERE btm.source_bank_transaction_id = ${alias}.id
          OR btm.target_bank_transaction_id = ${alias}.id)`;
   }

   static #bankAppliedSumSql(alias) {
      return `(${BankService.#bankDocumentAppliedSumSql(alias)} + ${BankService.#bankPeerAppliedSumSql(alias)})`;
   }

   static #bankRemainingSql(alias) {
      return `(${alias}.amount - ${BankService.#bankAppliedSumSql(alias)})`;
   }

   static #bankAccountInitialBalanceSql(alias) {
      return `(SELECT ba.initial_balance FROM entity_bank_accounts ba WHERE ba.id = ${alias}.entity_bank_account_id)`;
   }

   static #bankAccountInitialBalanceDateSql(alias) {
      return `(SELECT ba.initial_balance_date FROM entity_bank_accounts ba WHERE ba.id = ${alias}.entity_bank_account_id)`;
   }

   // saldo corriente de la cuenta: saldo inicial + acumulado de abonos/cargos hasta este movimiento,
   // en el mismo orden en que quedaron guardados (fecha y, en caso de empate, id de carga)
   static #bankRunningBalanceSql(alias) {
      const initialBalance = BankService.#bankAccountInitialBalanceSql(alias);
      const initialBalanceDate = BankService.#bankAccountInitialBalanceDateSql(alias);

      return `(
         CASE
            WHEN ${initialBalanceDate} IS NOT NULL AND ${alias}.issued_at < ${initialBalanceDate} THEN NULL
            ELSE ${initialBalance} + COALESCE((
               SELECT SUM(CASE WHEN t2.type = 'income' THEN t2.amount ELSE -t2.amount END)
               FROM entity_bank_transactions t2
               WHERE t2.entity_bank_account_id = ${alias}.entity_bank_account_id
                 AND (${initialBalanceDate} IS NULL OR t2.issued_at >= ${initialBalanceDate})
                 AND (
                    t2.issued_at < ${alias}.issued_at
                    OR (t2.issued_at = ${alias}.issued_at AND t2.id <= ${alias}.id)
                 )
            ), 0)
         END
      )`;
   }

   normalizeAmountColumnsMode(value) {
      const mode = String(value || '').trim().toLowerCase();
      if (['split', 'separate', 'abonos_cargos', 'abonos-cargos', 'separate_debit_credit'].includes(mode)) return 'split';
      return 'standard';
   }

   buildMovementsTemplateBuffer({ amountColumnsMode = 'standard' } = {}) {
      const mode = this.normalizeAmountColumnsMode(amountColumnsMode);
      const isSplit = mode === 'split';
      const header = isSplit
         ? ['Fecha', 'Descripcion', 'Abonos', 'Cargos', 'Saldo', 'No Documento', 'Sucursal']
         : ['Fecha', 'Descripcion', 'Monto', 'Saldo', 'No Documento', 'Sucursal'];

      const sampleRows = isSplit
         ? [
            ['01/03/2026', 'Abono cliente factura 1024', 250000, null, 1230000, '001024', 'Web'],
            ['02/03/2026', 'Transferencia a proveedor ACME', null, 125000, 1105000, '0001234567', 'Casa Matriz'],
         ]
         : [
            ['01/03/2026', 'Transferencia a proveedor ACME', -125000, 980000, '0001234567', 'Casa Matriz'],
            ['02/03/2026', 'Abono cliente factura 1024', 250000, 1230000, '001024', 'Web'],
         ];

      const wsMovements = xlsx.utils.aoa_to_sheet([header, ...sampleRows]);
      wsMovements['!cols'] = (isSplit ? [
         { wch: 14 },
         { wch: 44 },
         { wch: 14 },
         { wch: 14 },
         { wch: 14 },
         { wch: 16 },
         { wch: 20 },
      ] : [
         { wch: 14 },
         { wch: 44 },
         { wch: 14 },
         { wch: 14 },
         { wch: 16 },
         { wch: 20 },
      ]);

      const wsGuide = xlsx.utils.aoa_to_sheet([
         ['Campo', 'Obligatorio', 'Formato', 'Descripcion'],
         ['Fecha', 'Si', 'DD/MM/YYYY o DD-MM-YYYY', 'Fecha del movimiento bancario'],
         ['Descripcion', 'Si', 'Texto', 'Descripcion del movimiento'],
         ...(isSplit
            ? [
               ['Abonos', 'Si', 'Numero positivo', 'Monto de entrada. Debe venir vacio si la fila es cargo'],
               ['Cargos', 'Si', 'Numero positivo', 'Monto de salida. Debe venir vacio si la fila es abono'],
            ]
            : [
               ['Monto', 'Si', 'Numero con signo', 'Usa negativo para cargo y positivo para abono'],
            ]),
         ['Saldo', 'No', 'Numero', 'Saldo disponible despues del movimiento'],
         ['No Documento', 'No', 'Texto', 'Referencia interna del banco'],
         ['Sucursal', 'No', 'Texto', 'Sucursal o canal del movimiento'],
         ['Regla', '-', '-', 'No agregues filas de resumen como saldo inicial/final'],
      ]);
      wsGuide['!cols'] = [
         { wch: 18 },
         { wch: 12 },
         { wch: 30 },
         { wch: 54 },
      ];

      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, wsMovements, 'Movimientos');
      xlsx.utils.book_append_sheet(wb, wsGuide, 'Guia');

      return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
   }

   // importa bancos o movimientos desde buffer de Excel
   async importFromExcelBuffer(buffer, { commit = false, entityId, entityBankAccountId, expectMovements = false, amountColumnsMode = 'standard' } = {}) {
      const wb = this.#readWorkbook(buffer);
      const { sheetName, rows, _mode, headerRowIdx } = this.#sheetToRows(wb, { amountColumnsMode });
      const movementModes = new Set(['template_movs', 'template_movs_split']);

      // fila base para _rowNumber (opcional)
      const startRowExcel = (headerRowIdx >= 0 ? headerRowIdx + 2 : 2);

      if (movementModes.has(_mode)) {
         // seleccionar mapeador según modo
         const mapper = {
            template_movs: (r) => this.#mapTemplateRow(r),
            template_movs_split: (r) => this.#mapSplitTemplateRow(r),
         }[_mode];

         const mapped = rows.map((r, i) => ({ ...mapper(r), _rowNumber: startRowExcel + i }));
         const { valid, invalid } = this.#splitValidMovements(mapped);

         let saved = 0, skipped = [];
         if (commit) {
            if (!entityId || !entityBankAccountId) throw boom.badRequest('faltan entityId o entityBankAccountId para persistir');
            const parsedEntityId = Number(entityId);
            const parsedEntityBankAccountId = Number(entityBankAccountId);

            if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
               throw boom.badRequest('entityId invalido para persistir movimientos');
            }
            if (!Number.isInteger(parsedEntityBankAccountId) || parsedEntityBankAccountId <= 0) {
               throw boom.badRequest('accountId invalido para persistir movimientos');
            }

            await this.#assertBankAccountOwnership({
               entityId: parsedEntityId,
               entityBankAccountId: parsedEntityBankAccountId
            });

            const res = await this.#persistValidMovements(valid, {
               entityId: parsedEntityId,
               entityBankAccountId: parsedEntityBankAccountId,
               collectSkipped: true
            });
            saved = res.saved; skipped = res.skipped || [];
         }

         return {
            ok: true,
            mode: 'movements',
            bank_mode: _mode,                // <- indica banco detectado
            sheet: sheetName,
            total_rows: rows.length,
            valid_rows: valid.length,
            invalid_rows: invalid.length,
            committed: commit,
            saved_rows: saved,
            skipped_rows: commit ? (valid.length - saved) : 0,
            skipped_details: skipped.slice(0, 50),
            preview_valid: valid.slice(0, 5),
            preview_invalid: invalid.slice(0, 5),
            columns_detected: Object.keys(rows[0] || {})
         };
      }

      throw boom.badRequest(
         'formato de movimientos no reconocido. usa columnas: fecha, descripcion, monto, saldo, no documento, sucursal; o fecha, descripcion, abonos, cargos, saldo, no documento, sucursal'
      );
   }

   async #assertBankAccountOwnership({ entityId, entityBankAccountId }) {
      const account = await models.EntityBankAccount.findOne({
         attributes: ['id', 'entity_id'],
         where: {
            id: entityBankAccountId,
            entity_id: entityId
         }
      });

      if (!account) {
         throw boom.badRequest('la cuenta bancaria no pertenece a la entidad indicada');
      }
   }


   // funciones privadas
   #readWorkbook(buffer) {
      try {
         const wb = xlsx.read(buffer, { type: 'buffer' });
         if (!wb.SheetNames?.length) throw boom.badRequest('The Excel file contains no sheets.');
         return wb;
      } catch (e) {
         throw boom.badRequest('Invalid or corrupted Excel file.');
      }
   }

   // persiste movimientos bancarios válidos
   async #persistValidMovements(valid, { entityId, entityBankAccountId, collectSkipped = false } = {}) {
      if (!valid.length) return { saved: 0, skipped: [] };

      let saved = 0;
      const skipped = [];
      const localBatchCounts = {};

      await sequelize.transaction(async (t) => {
         for (const m of valid) {
            const type = (m.amount ?? 0) < 0 ? 'expense' : 'income';
            const amountAbs = Math.abs(Number(m.amount ?? 0));
            const issuedAt = new Date(`${m.movementDate}T00:00:00.000Z`);
            const description = m.detail || null;
            const balance = (m.balance != null) ? Number(m.balance) : null; // <- normaliza saldo
            const documentRef = m.documentRef || null;
            const branch = m.branch || null;

            const baseWhere = {
               entity_id: entityId,
               entity_bank_account_id: entityBankAccountId,
               issued_at: issuedAt,
               type,
               amount: amountAbs,
               description,
            };

            const batchKey = `${issuedAt.getTime()}_${type}_${amountAbs}_${description}`;
            localBatchCounts[batchKey] = (localBatchCounts[batchKey] || 0) + 1;
            const currentOccurrence = localBatchCounts[batchKey];

            const existingRows = await models.EntityBankTransaction.findAll({
               where: baseWhere,
               order: [['id', 'ASC']],
               transaction: t
            });

            const dbCount = existingRows.length;
            let exists = null;
            let enrichedExisting = false;

            if (dbCount >= currentOccurrence) {
               exists = existingRows[currentOccurrence - 1];
               if (exists && (documentRef || branch || balance != null)) {
                  const updates = {};
                  if (documentRef && !exists.document_ref) updates.document_ref = documentRef;
                  if (branch && !exists.branch) updates.branch = branch;
                  if (balance != null && exists.balance == null) updates.balance = balance;
                  if (Object.keys(updates).length) {
                     await exists.update(updates, { transaction: t });
                     enrichedExisting = true;
                  }
               }
            }

            const oppositeType = type === 'income' ? 'expense' : 'income';
            let oppositeExists = null;

            if (!exists) {
               const existingOppositeRows = await models.EntityBankTransaction.findAll({
                  where: { ...baseWhere, type: oppositeType },
                  order: [['id', 'ASC']],
                  transaction: t
               });
               if (existingOppositeRows.length >= currentOccurrence) {
                  oppositeExists = existingOppositeRows[currentOccurrence - 1];
               }
            }

            if (oppositeExists) {
               if (collectSkipped) {
                  skipped.push({
                     rowNumber: m._rowNumber,
                     date: m.movementDate,
                     type,
                     amount: amountAbs,
                     balance,
                     description,
                     documentRef,
                     branch,
                     conflictExistingType: oppositeType,
                     conflictExistingId: oppositeExists.id,
                     skippedReason: 'posible duplicado con tipo opuesto'
                  });
               }
               continue;
            }

            if (exists) {
               if (collectSkipped) {
                  skipped.push({
                     rowNumber: m._rowNumber,
                     date: m.movementDate,
                     type,
                     amount: amountAbs,
                     balance,              // <- muestra saldo en el detalle
                     description,
                     documentRef,
                     branch,
                     enrichedExisting
                  });
               }
               continue;
            }

            await models.EntityBankTransaction.create({
               entity_id: entityId,
               entity_bank_account_id: entityBankAccountId,
               type,
               amount: amountAbs,
               description,
               issued_at: issuedAt,
               balance,                // <- guarda saldo
               document_ref: documentRef,
               branch,
               sii_document_id: null,
            }, { transaction: t });

            saved++;
         }
      });

      return { saved, skipped };
   }

   // analiza fechas en formato DD/MM/YYYY o DD-MM-YYYY
   static #parseDDMMYYYY(input) {
      if (input instanceof Date && !isNaN(input)) {
         return input.toISOString().slice(0, 10);
      }
      const s = String(input || '').trim();
      const monthNames = {
         ene: '01',
         enero: '01',
         feb: '02',
         febrero: '02',
         mar: '03',
         marzo: '03',
         abr: '04',
         abril: '04',
         may: '05',
         mayo: '05',
         jun: '06',
         junio: '06',
         jul: '07',
         julio: '07',
         ago: '08',
         agosto: '08',
         sep: '09',
         sept: '09',
         septiembre: '09',
         oct: '10',
         octubre: '10',
         nov: '11',
         noviembre: '11',
         dic: '12',
         diciembre: '12',
      };

      const m = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/.exec(s);
      if (m) {
         const [_, dd, mm, yyyy] = m;
         const dateText = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
         const d = new Date(dateText);
         return isNaN(d) ? null : d.toISOString().slice(0, 10);
      }

      const shortNumeric = /^(\d{1,2})[\/\-](\d{1,2})$/.exec(s);
      if (shortNumeric) {
         const [_, dd, mm] = shortNumeric;
         const yyyy = new Date().getFullYear();
         const dateText = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
         const d = new Date(dateText);
         return isNaN(d) ? null : d.toISOString().slice(0, 10);
      }

      const monthText = /^(\d{1,2})[\/\-\s]([^0-9\/\-\s]+)(?:[\/\-\s](\d{2,4}))?$/.exec(s);
      if (monthText) {
         const [, dd, rawMonth, rawYear] = monthText;
         const monthKey = BankService.#normKey(rawMonth).replace(/\./g, '');
         const mm = monthNames[monthKey];
         const yyyy = rawYear
            ? (String(rawYear).length === 2 ? `20${rawYear}` : String(rawYear))
            : String(new Date().getFullYear());
         if (mm) {
            const dateText = `${yyyy}-${mm}-${String(dd).padStart(2, '0')}`;
            const d = new Date(dateText);
            return isNaN(d) ? null : d.toISOString().slice(0, 10);
         }
      }

      const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
      if (iso) {
         const [_, yyyy, mm, dd] = iso;
         const d = new Date(`${yyyy}-${mm}-${dd}`);
         return isNaN(d) ? null : d.toISOString().slice(0, 10);
      }

      return null;
   }

   // analiza montos numéricos en formatos comunes
   static #parseAmount(str) {
      if (str == null) return null;
      let s = String(str).trim().replace(/\s+/g, '');
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
         else s = s.replace(/,/g, ''); // 15,000 -> 15000
      } else if (hasDot && !hasComma) {
         const dotCount = (s.match(/\./g) || []).length;
         if (dotCount > 1 || /\.\d{3}$/.test(s)) s = s.replace(/\./g, ''); // 50.273 -> 50273
      }
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : null;
   }

   // separa válidos e inválidos según reglas de negocio para movimientos
   #splitValidMovements(items) {
      const valid = [];
      const invalid = [];
      const isSummary = (txt = '') => /saldo\s+(inicial|final)/i.test(txt);

      for (const it of items) {
         if (it.detail && isSummary(it.detail)) continue; // descarta filas de resumen

         const reasons = [];
         if (it._amountError) reasons.push(it._amountError);
         if (!it.movementDate) reasons.push('fecha inválida o ausente');
         if (!it.detail) reasons.push('descripcion requerida');
         if (!Number.isFinite(Number(it.amount))) reasons.push('monto inválido');
         if (Number(it.amount) === 0) reasons.push('monto no puede ser 0');

         if (reasons.length) invalid.push({ ...it, _errors: reasons });
         else valid.push(it);
      }
      return { valid, invalid };
   }

   // Helper para hacer lookup tolerante (ya tienes versión similar)
   static #pickFromRow(rowObj, ...cands) {
      const normMap = {};
      for (const k of Object.keys(rowObj)) normMap[BankService.#normKey(k)] = k;
      for (const c of cands) {
         const nk = BankService.#normKey(c);
         if (nk in normMap) return rowObj[normMap[nk]];
      }
      return null;
   }

   static #hasCellValue(value) {
      return value != null && String(value).trim() !== '';
   }

   static #normalizeDocumentRef(value) {
      const text = String(value || '').trim();
      if (!text) return null;
      if (/^0+$/.test(text.replace(/\D/g, ''))) return null;
      return text;
   }

   // === Plantilla LEINS: formato estandar para cualquier banco ===
   #mapTemplateRow(r) {
      const rawDate = BankService.#pickFromRow(r, 'Fecha');
      const rawDesc = BankService.#pickFromRow(r, 'Descripcion', 'Descripción');
      const rawMonto = BankService.#pickFromRow(r, 'Monto', 'Importe');
      const rawSaldo = BankService.#pickFromRow(r, 'Saldo');
      const rawDoc = BankService.#pickFromRow(r, 'No Documento', 'N Documento', 'Nro Documento', 'Numero Documento', 'Documento');
      const rawSuc = BankService.#pickFromRow(r, 'Sucursal');

      let amount = BankService.#parseAmount(rawMonto);
      let amountError = null;

      if (!BankService.#hasCellValue(rawMonto)) {
         amountError = 'monto requerido';
      } else if (!Number.isFinite(amount)) {
         amountError = 'monto invalido en columna monto';
      }

      const kind = Number.isFinite(amount) ? (amount < 0 ? 'C' : 'A') : null;

      return {
         movementDate: BankService.#parseDDMMYYYY(rawDate),
         detail: rawDesc ? String(rawDesc).trim() : null,
         amount,
         balance: BankService.#parseAmount(rawSaldo),
         documentRef: BankService.#normalizeDocumentRef(rawDoc),
         branch: rawSuc ? String(rawSuc).trim() : null,
         kind,
         _amountError: amountError,
         _raw: r,
      };
   }

   #mapSplitTemplateRow(r) {
      const rawDate = BankService.#pickFromRow(r, 'Fecha');
      const rawDesc = BankService.#pickFromRow(r, 'Descripcion', 'DescripciÃ³n');
      const rawAbonos = BankService.#pickFromRow(r, 'Abonos', 'Abono', 'Haber', 'Depositos', 'Deposito');
      const rawCargos = BankService.#pickFromRow(r, 'Cargos', 'Cargo', 'Debe', 'Retiros', 'Retiro');
      const rawSaldo = BankService.#pickFromRow(r, 'Saldo');
      const rawDoc = BankService.#pickFromRow(r, 'No Documento', 'N Documento', 'Nro Documento', 'Numero Documento', 'Documento');
      const rawSuc = BankService.#pickFromRow(r, 'Sucursal');

      const hasAbono = BankService.#hasCellValue(rawAbonos);
      const hasCargo = BankService.#hasCellValue(rawCargos);
      const abono = hasAbono ? BankService.#parseAmount(rawAbonos) : null;
      const cargo = hasCargo ? BankService.#parseAmount(rawCargos) : null;
      const amountErrors = [];

      if (!hasAbono && !hasCargo) {
         amountErrors.push('monto requerido en abonos o cargos');
      }
      if (hasAbono && !Number.isFinite(abono)) {
         amountErrors.push('monto invalido en columna abonos');
      }
      if (hasCargo && !Number.isFinite(cargo)) {
         amountErrors.push('monto invalido en columna cargos');
      }

      const abonoAbs = Number.isFinite(abono) ? Math.abs(abono) : 0;
      const cargoAbs = Number.isFinite(cargo) ? Math.abs(cargo) : 0;
      if (abonoAbs > 0 && cargoAbs > 0) {
         amountErrors.push('usa solo abonos o cargos por fila');
      }

      let amount = null;
      if (!amountErrors.length) {
         if (abonoAbs > 0) amount = abonoAbs;
         if (cargoAbs > 0) amount = -cargoAbs;
      }

      const kind = Number.isFinite(amount) ? (amount < 0 ? 'C' : 'A') : null;

      return {
         movementDate: BankService.#parseDDMMYYYY(rawDate),
         detail: rawDesc ? String(rawDesc).trim() : null,
         amount,
         balance: BankService.#parseAmount(rawSaldo),
         documentRef: BankService.#normalizeDocumentRef(rawDoc),
         branch: rawSuc ? String(rawSuc).trim() : null,
         kind,
         _amountError: amountErrors.length ? amountErrors.join('; ') : null,
         _raw: r,
      };
   }

   static #normKey(s) {
      return String(s || '')
         .normalize('NFD')                 // separa acentos
         .replace(/[\u0300-\u036f]/g, '') // quita acentos
         .toLowerCase()
         .replace(/\s+/g, ' ')            // colapsa espacios
         .replace(/[^a-z0-9°/ ]/g, '')    // conserva letras/numeros, º/ y espacio
         .trim();
   }

   // ayudante: convertir header row (array de strings) a un set normalizado
   static #normHeaderRow(arr = []) {
      return new Set(arr.map(k => BankService.#normKey(k)));
   }

   static #detectTemplate(headerSet) {
      const hasFecha = headerSet.has('fecha');
      const hasDesc = headerSet.has('descripcion') || Array.from(headerSet).some(k => k.startsWith('descripcion'));
      const hasMonto = headerSet.has('monto') || headerSet.has('importe');
      const ok = hasFecha && hasDesc && hasMonto;
      return { matched: ok, mode: 'template_movs', needsArray: true };
   }

   static #detectSplitTemplate(headerSet) {
      const hasFecha = headerSet.has('fecha');
      const hasDesc = headerSet.has('descripcion') || Array.from(headerSet).some(k => k.startsWith('descripcion'));
      const hasAbonos = headerSet.has('abonos') || headerSet.has('abono') || headerSet.has('haber') || headerSet.has('depositos') || headerSet.has('deposito');
      const hasCargos = headerSet.has('cargos') || headerSet.has('cargo') || headerSet.has('debe') || headerSet.has('retiros') || headerSet.has('retiro');
      const ok = hasFecha && hasDesc && hasAbonos && hasCargos;
      return { matched: ok, mode: 'template_movs_split', needsArray: true };
   }

   // Registro de detectores en orden de prioridad
   static #BANK_DETECTORS = [
      BankService.#detectSplitTemplate,
      BankService.#detectTemplate,
   ];

   // extrae filas de la primera hoja del workbook
   #sheetToRows(wb, { amountColumnsMode = 'standard' } = {}) {
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const mode = this.normalizeAmountColumnsMode(amountColumnsMode);
      const detectors = mode === 'split'
         ? [BankService.#detectSplitTemplate, BankService.#detectTemplate]
         : BankService.#BANK_DETECTORS;

      // Leer como matriz para inspeccionar headers reales
      const rows2D = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: false });
      if (!rows2D.length) throw boom.badRequest('el excel no contiene hojas');

      // Encuentra la fila que luce como encabezado (más robusto: busca palabras clave)
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows2D.length, 30); i++) {
         const row = rows2D[i] || [];
         const set = BankService.#normHeaderRow(row);
         // prueba cada detector
         for (const det of detectors) {
            const res = det(set);
            if (res.matched) {
               headerRowIdx = i;
               // construye objetos usando esa fila como header
               const header = rows2D[headerRowIdx];
               const dataRows = rows2D.slice(headerRowIdx + 1);
               const rows = dataRows
                  .filter(r => Array.isArray(r) && r.some(v => v !== null && String(v).trim() !== ''))
                  .map(r => {
                     const obj = {};
                     for (let j = 0; j < header.length; j++) obj[header[j]] = r[j] ?? null;
                     return obj;
                  });
               return { sheetName, rows, _mode: res.mode, headerRowIdx };
            }
         }
      }

      // fallback: modo genérico (tu flujo "banks" anterior)
      const rows = xlsx.utils.sheet_to_json(ws, {
         defval: null, blankrows: false, raw: false, dateNF: 'yyyy-mm-dd',
      });
      return { sheetName, rows, _mode: 'object', headerRowIdx: -1 };
   }

   static #buildAccountCryptoKey() {
      const raw = String(config.mysqlAesKey || '').trim();
      if (!raw) throw boom.badImplementation('clave de cifrado no configurada');
      return crypto.createHash('sha256').update(raw).digest();
   }

   static #encryptAccountNumber(plain) {
      const key = BankService.#buildAccountCryptoKey();
      const cipher = crypto.createCipheriv('aes-256-ecb', key, null);
      cipher.setAutoPadding(true);
      return Buffer.concat([
         cipher.update(String(plain), 'utf8'),
         cipher.final()
      ]).toString('base64');
   }

   static #decryptAccountNumberFromStorage(stored) {
      const raw = String(stored || '').trim();
      if (!raw) return '';
      if (!raw.startsWith('v1:')) return raw;

      const parts = raw.split(':');
      if (parts.length < 3 || !parts[1]) return '';

      try {
         const key = BankService.#buildAccountCryptoKey();
         const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
         decipher.setAutoPadding(true);
         return Buffer.concat([
            decipher.update(Buffer.from(parts[1], 'base64')),
            decipher.final()
         ]).toString('utf8').trim();
      } catch {
         return '';
      }
   }

   static #extractLast4FromStorage(stored) {
      const raw = String(stored || '').trim();
      if (!raw) return '';
      if (!raw.startsWith('v1:')) return raw.slice(-4);
      const parts = raw.split(':');
      return parts[2] || '';
   }

   static #maskAccountNumber(plain) {
      const s = String(plain || '').trim();
      if (!s) return '';
      const hiddenLen = Math.max(0, s.length - 4);
      return `${'*'.repeat(hiddenLen)}${s.slice(-4)}`;
   }

   static #formatAccountNumberForStorage(plain) {
      const clean = String(plain || '').trim();
      if (!clean) throw boom.badRequest('accountNumber es requerido');
      if (clean.length < 4) throw boom.badRequest('accountNumber debe tener al menos 4 caracteres');
      if (clean.length > 31) throw boom.badRequest('accountNumber excede largo maximo (31)');

      const encrypted = BankService.#encryptAccountNumber(clean);
      const packed = `v1:${encrypted}:${clean.slice(-4)}`;
      if (packed.length > 64) {
         throw boom.badRequest('accountNumber demasiado largo para almacenamiento seguro');
      }
      return packed;
   }

   static #normalizeCurrency(input) {
      const raw = String(input || 'CLP').trim().toUpperCase();
      const mapped = raw === 'DOLAR' ? 'USD' : raw;
      if (!['CLP', 'USD'].includes(mapped)) {
         throw boom.badRequest('currency permitido: CLP o DOLAR');
      }
      return mapped;
   }

   static #normalizeBankAccountPayload({ bankName, accountNumber, currency, requireAccountNumber = true } = {}) {
      const bankNameNorm = String(bankName || '').trim();
      const accountNumberNorm = String(accountNumber || '').trim();
      const currencyNorm = BankService.#normalizeCurrency(currency);

      if (!bankNameNorm) throw boom.badRequest('bankName es requerido');
      if (bankNameNorm.length > 120) throw boom.badRequest('bankName excede largo maximo (120)');

      if (requireAccountNumber && !accountNumberNorm) throw boom.badRequest('accountNumber es requerido');

      return {
         bank_name: bankNameNorm,
         account_number_plain: accountNumberNorm || null,
         currency: currencyNorm
      };
   }

   static #mapBankAccountRow(account) {
      const accountPlain = BankService.#decryptAccountNumberFromStorage(account.account_number);
      const last4 = accountPlain
         ? accountPlain.slice(-4)
         : BankService.#extractLast4FromStorage(account.account_number);
      const masked = accountPlain
         ? BankService.#maskAccountNumber(accountPlain)
         : (last4 ? `****${last4}` : '');
      const currencyLabel = account.currency === 'USD' ? 'DOLAR' : account.currency;

      return {
         id: account.id,
         entity_id: account.entity_id,
         bank_name: account.bank_name,
         account_number: masked,
         account_last4: last4 || null,
         currency: account.currency,
         currency_label: currencyLabel,
         label: [account.bank_name, masked, currencyLabel].filter(Boolean).join(' - '),
         initial_balance: account.initial_balance != null ? Number(account.initial_balance) : 0,
         initial_balance_date: account.initial_balance_date || null,
         created_at: account.createdAt || null,
         updated_at: account.updatedAt || null,
      };
   }

   // valida y normaliza saldo inicial + fecha de referencia para el calculo de saldo corriente
   static #normalizeInitialBalancePayload({ initialBalance, initialBalanceDate }) {
      const result = {};

      if (initialBalance !== undefined) {
         const parsed = initialBalance === null || initialBalance === '' ? 0 : Number(initialBalance);
         if (!Number.isFinite(parsed)) throw boom.badRequest('initialBalance debe ser un numero');
         result.initial_balance = parsed;
      }

      if (initialBalanceDate !== undefined) {
         if (initialBalanceDate === null || initialBalanceDate === '') {
            result.initial_balance_date = null;
         } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(initialBalanceDate))) {
            throw boom.badRequest('initialBalanceDate invalida; esperado yyyy-mm-dd');
         } else {
            result.initial_balance_date = initialBalanceDate;
         }
      }

      return result;
   }

   async listBankAccounts({ entityId } = {}) {
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId invalido');
      }

      const rows = await models.EntityBankAccount.findAll({
         where: { entity_id: parsedEntityId },
         attributes: ['id', 'entity_id', 'bank_name', 'account_number', 'currency', 'initial_balance', 'initial_balance_date', 'createdAt', 'updatedAt'],
         order: [['bank_name', 'ASC'], ['id', 'ASC']]
      });

      const mapped = rows.map((r) => BankService.#mapBankAccountRow(r));
      return {
         ok: true,
         total: mapped.length,
         rows: mapped
      };
   }

   async createBankAccount({ entityId, bankName, accountNumber, currency, initialBalance, initialBalanceDate } = {}) {
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId invalido');
      }

      const payload = BankService.#normalizeBankAccountPayload({
         bankName,
         accountNumber,
         currency,
         requireAccountNumber: true
      });
      const accountNumberStored = BankService.#formatAccountNumberForStorage(payload.account_number_plain);
      const initialBalancePayload = BankService.#normalizeInitialBalancePayload({ initialBalance, initialBalanceDate });

      const duplicate = await models.EntityBankAccount.findOne({
         attributes: ['id'],
         where: {
            entity_id: parsedEntityId,
            bank_name: payload.bank_name,
            account_number: accountNumberStored,
            currency: payload.currency
         }
      });
      if (duplicate) {
         throw boom.conflict('ya existe una cuenta bancaria con ese banco, numero y moneda');
      }

      const created = await models.EntityBankAccount.create({
         entity_id: parsedEntityId,
         bank_name: payload.bank_name,
         account_number: accountNumberStored,
         currency: payload.currency,
         ...initialBalancePayload
      });

      return {
         ok: true,
         row: BankService.#mapBankAccountRow(created)
      };
   }

   async updateBankAccount({ entityId, accountId, bankName, accountNumber, currency, initialBalance, initialBalanceDate } = {}) {
      const parsedEntityId = Number(entityId);
      const parsedAccountId = Number(accountId);

      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId invalido');
      }
      if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
         throw boom.badRequest('accountId invalido');
      }

      const payload = BankService.#normalizeBankAccountPayload({
         bankName,
         accountNumber,
         currency,
         requireAccountNumber: false
      });
      const initialBalancePayload = BankService.#normalizeInitialBalancePayload({ initialBalance, initialBalanceDate });

      const account = await models.EntityBankAccount.findOne({
         where: {
            id: parsedAccountId,
            entity_id: parsedEntityId
         }
      });
      if (!account) throw boom.notFound('cuenta bancaria no encontrada para la entidad');

      const currentPlain = BankService.#decryptAccountNumberFromStorage(account.account_number);
      const resolvedPlain = payload.account_number_plain || currentPlain;
      if (!resolvedPlain) throw boom.badRequest('no se pudo resolver accountNumber actual');
      const accountNumberStored = BankService.#formatAccountNumberForStorage(resolvedPlain);

      const duplicate = await models.EntityBankAccount.findOne({
         attributes: ['id'],
         where: {
            id: { [Op.ne]: parsedAccountId },
            entity_id: parsedEntityId,
            bank_name: payload.bank_name,
            account_number: accountNumberStored,
            currency: payload.currency
         }
      });
      if (duplicate) {
         throw boom.conflict('ya existe otra cuenta bancaria con ese banco, numero y moneda');
      }

      await account.update({
         bank_name: payload.bank_name,
         account_number: accountNumberStored,
         currency: payload.currency,
         ...initialBalancePayload
      });

      return {
         ok: true,
         row: BankService.#mapBankAccountRow(account)
      };
   }

   async deleteBankAccount({ entityId, accountId } = {}) {
      const parsedEntityId = Number(entityId);
      const parsedAccountId = Number(accountId);

      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId invalido');
      }
      if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
         throw boom.badRequest('accountId invalido');
      }

      const account = await models.EntityBankAccount.findOne({
         where: {
            id: parsedAccountId,
            entity_id: parsedEntityId
         }
      });
      if (!account) throw boom.notFound('cuenta bancaria no encontrada para la entidad');

      const txCount = await models.EntityBankTransaction.count({
         where: {
            entity_id: parsedEntityId,
            entity_bank_account_id: parsedAccountId
         }
      });
      if (txCount > 0) {
         throw boom.conflict('no se puede eliminar la cuenta porque tiene movimientos asociados');
      }

      await account.destroy();

      return {
         ok: true,
         removed: parsedAccountId
      };
   }

   // elimina un movimiento bancario individual (solo si no esta conciliado)
   async deleteTransaction({ entityId, id } = {}) {
      const parsedEntityId = Number(entityId);
      const parsedId = Number(id);

      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId invalido');
      }
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
         throw boom.badRequest('id de movimiento invalido');
      }

      const tx = await models.EntityBankTransaction.findOne({
         where: { id: parsedId, entity_id: parsedEntityId }
      });
      if (!tx) throw boom.notFound('movimiento bancario no encontrado para la entidad');

      const [docLinkCount, matchLinkCount] = await Promise.all([
         models.BankTransactionDocument.count({ where: { entity_bank_transaction_id: parsedId } }),
         models.BankTransactionMatch.count({
            where: {
               [Op.or]: [
                  { source_bank_transaction_id: parsedId },
                  { target_bank_transaction_id: parsedId }
               ]
            }
         })
      ]);

      if (docLinkCount > 0 || matchLinkCount > 0) {
         throw boom.conflict('el movimiento esta conciliado, debes deshacer la conciliacion antes de eliminarlo');
      }

      await tx.destroy();

      return { ok: true, removed: parsedId };
   }

   async revealBankAccountNumber({ entityId, accountId } = {}) {
      const parsedEntityId = Number(entityId);
      const parsedAccountId = Number(accountId);

      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw boom.badRequest('entityId invalido');
      }
      if (!Number.isInteger(parsedAccountId) || parsedAccountId <= 0) {
         throw boom.badRequest('accountId invalido');
      }

      const account = await models.EntityBankAccount.findOne({
         attributes: ['id', 'entity_id', 'bank_name', 'account_number', 'currency', 'createdAt', 'updatedAt'],
         where: {
            id: parsedAccountId,
            entity_id: parsedEntityId
         }
      });
      if (!account) throw boom.notFound('cuenta bancaria no encontrada para la entidad');

      const full = BankService.#decryptAccountNumberFromStorage(account.account_number);
      if (!full) throw boom.badImplementation('no fue posible desencriptar el numero de cuenta');

      return {
         ok: true,
         row: {
            ...BankService.#mapBankAccountRow(account),
            account_number_full: full
         }
      };
   }

   // lista movimientos bancarios con filtros para el frontend
   async listTransactions({
      entityId,
      accountId,
      tipo = 'Todos',
      fechaIni,
      fechaFin,
      monto,
      descripcion,
      cuenta,
      nro,
      rut,
      soloPendientes = false,
      limit = 100,
      offset = 0,
      sort = 'issued_at:desc,id:desc'
   } = {}) {
      const { models, sequelize } = require('../libs/sequelize');
      const { Op } = require('sequelize');

      const where = {};

      // 1) filtros base por entidad y cuenta
      if (entityId) where.entity_id = entityId;
      if (accountId) where.entity_bank_account_id = accountId;

      // 2) tipo (income/expense)
      if (tipo === 'Abonos') where.type = 'income';
      if (tipo === 'Cargos') where.type = 'expense';

      // 3) rango de fechas (issued_at)
      if (fechaIni || fechaFin) {
         where.issued_at = {};
         if (fechaIni) where.issued_at[Op.gte] = new Date(`${fechaIni}T00:00:00.000Z`);
         if (fechaFin) where.issued_at[Op.lte] = new Date(`${fechaFin}T23:59:59.999Z`);
      }

      // 4) monto exacto (en BD amount es positivo; el signo lo da 'type')
      if (monto != null && monto !== '') {
         const n = Number(String(monto).replace(/\./g, '').replace(',', '.'));
         if (Number.isFinite(n)) {
            where.amount = Math.abs(n);
         }
      }

      // 5) filtros por descripción (LIKE) combinables
      const descLikes = [];
      if (descripcion) descLikes.push({ description: { [Op.like]: `%${descripcion}%` } });
      if (rut) descLikes.push({ description: { [Op.like]: `%${rut}%` } });
      if (nro) descLikes.push({ description: { [Op.like]: `${nro}%` } }); // prefijo típico de N° op

      if (descLikes.length === 1) {
         Object.assign(where, descLikes[0]);
      } else if (descLikes.length > 1) {
         where[Op.and] = (where[Op.and] || []).concat(descLikes);
      }

      // 6) ordenamiento (permite múltiples "campo:dir" separados por coma)
      let order = [['issued_at', 'DESC'], ['id', 'DESC']];
      if (sort) {
         const parts = String(sort).split(',').map(s => s.trim()).filter(Boolean);
         const allowed = new Set(['issued_at', 'amount', 'id', 'balance']);
         const parsed = [];
         for (const p of parts) {
            const [col, dirRaw] = p.split(':');
            const dir = (String(dirRaw || 'desc').toUpperCase() === 'ASC') ? 'ASC' : 'DESC';
            if (allowed.has(col)) parsed.push([col, dir]);
         }
         if (parsed.length) order = parsed;
      }

      const baseAlias = models.EntityBankTransaction.name || 'EntityBankTransaction';
      const baseQuoted = `\`${baseAlias}\``; // MySQL quoting

      // Suma aplicada contra el movimiento (tabla de asociación many-to-many)
      const appliedSumSQL = BankService.#bankAppliedSumSql(baseQuoted);
      const remainingSQL = BankService.#bankRemainingSql(baseQuoted);
      const runningBalanceSQL = BankService.#bankRunningBalanceSql(baseQuoted);

      // Filtro "solo pendientes"
      if (soloPendientes) {
         (where[Op.and] = where[Op.and] || []).push(
            sequelize.where(sequelize.literal(remainingSQL), { [Op.gt]: 0 })
         );
      }

      const includeBankAccount = {
         model: models.EntityBankAccount,
         as: 'bank_account',
         attributes: ['id', 'bank_name', 'account_number', 'currency']
      };

      if (cuenta && String(cuenta).trim()) {
         const q = String(cuenta).trim();
         includeBankAccount.where = {
            [Op.or]: [
               { bank_name: { [Op.like]: `%${q}%` } },
               { account_number: { [Op.like]: `%:${q}%` } },
               { account_number: { [Op.like]: `%${q}%` } }
            ]
         };
         includeBankAccount.required = true;
      }

      // 7) consulta y mapeo
      const { rows, count } = await models.EntityBankTransaction.findAndCountAll({
         where,
         limit,
         offset,
         order,
         distinct: true, // evita duplicados en el count cuando hay include
         attributes: {
            include: [
               [sequelize.literal(appliedSumSQL), 'applied_sum'],
               [sequelize.literal(remainingSQL), 'remaining_amount'],
               [sequelize.literal(runningBalanceSQL), 'running_balance']
            ]
         },
         include: [includeBankAccount]
      });

      // helper: intenta extraer un "documento" al inicio de la descripcion (p.ej. "0270747809 Transf...")
      const extractDoc = (s) => {
         const m = String(s || '').trim().match(/^([0-9A-Z]{8,12})\b/);
         return m ? BankService.#normalizeDocumentRef(m[1]) : null;
      };

      const mapped = rows.map((r) => {
         const sign = r.type === 'expense' ? -1 : 1; // expense = cargo, income = abono
         const remaining = typeof r.get === 'function'
            ? Number(r.get('remaining_amount') ?? 0)
            : Number(r.remaining_amount ?? 0);
         const runningBalanceRaw = typeof r.get === 'function'
            ? r.get('running_balance')
            : r.running_balance;
         const runningBalance = runningBalanceRaw != null ? Number(runningBalanceRaw) : null;
         return {
            _id: `tx-${r.id}`,
            source: 'bank',
            fecha: r.issued_at?.toISOString?.().slice(0, 10) || null,
            cuenta_corriente: (() => {
               const a = r.bank_account || {};
               if (a.alias) return a.alias;
               const plain = BankService.#decryptAccountNumberFromStorage(a.account_number);
               const masked = plain
                  ? BankService.#maskAccountNumber(plain)
                  : (() => {
                     const last4 = BankService.#extractLast4FromStorage(a.account_number);
                     return last4 ? `****${last4}` : '';
                  })();
               const currencyLabel = a.currency === 'USD' ? 'DOLAR' : a.currency;
               const parts = [a.bank_name, masked, currencyLabel].filter(Boolean);
               return parts.length ? parts.join(' - ') : (r.entity_bank_account_id ?? null);
            })(),

            documento: BankService.#normalizeDocumentRef(r.document_ref) || extractDoc(r.description),
            descripcion: r.description || '',
            monto: sign * Number(r.amount || 0),
            balance: runningBalance,
            sucursal: r.branch || null,
            raw: {
               id: r.id,
               entity_id: r.entity_id,
               entity_bank_account_id: r.entity_bank_account_id,
               type: r.type,
               amount: Number(r.amount || 0),
               balance: runningBalance,
               document_ref: BankService.#normalizeDocumentRef(r.document_ref),
               branch: r.branch || null,
               issued_at: r.issued_at,
               sii_document_id: r.sii_document_id,
               applied_sum: Number(r.get?.('applied_sum') ?? 0),
               remaining_amount: remaining,
            }
         };
      });

      return {
         ok: true,
         total: count,
         limit,
         offset,
         rows: mapped
      };
   }

   async reconcile({ entityId, bank_transaction_id, document_id, amount = null }) {

      if (!entityId) throw boom.badRequest("entityId is required");
      if (!bank_transaction_id) throw boom.badRequest("bank_transaction_id is required");
      if (!document_id) throw boom.badRequest("document_id is required");
      if (amount != null && !(Number(amount) > 0)) throw boom.badRequest("amount must be a positive number");

      return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
         return await this.#reconcileWithTx({ entityId, bank_transaction_id, document_id, amount, method: 'manual', t });
      });

   }

   async searchBankCounterparts({ entityId, bank_transaction_id, q = null, limit = 50 }) {
      const parsedEntityId = Number(entityId);
      const sourceId = Number(bank_transaction_id);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) throw boom.badRequest("entityId is required");
      if (!Number.isInteger(sourceId) || sourceId <= 0) throw boom.badRequest("bank_transaction_id is required");

      const remainingSQL = BankService.#bankRemainingSql("bt");
      const [source] = await sequelize.query(
         `
         SELECT bt.id, bt.type, bt.amount, bt.issued_at, ${remainingSQL} AS remaining_amount
         FROM entity_bank_transactions bt
         WHERE bt.id = :sourceId AND bt.entity_id = :entityId
         LIMIT 1
         `,
         { replacements: { sourceId, entityId: parsedEntityId }, type: QueryTypes.SELECT }
      );

      if (!source) throw boom.notFound("bank transaction not found for the given entity");
      const sourceRemaining = Number(source.remaining_amount || 0);
      if (!(sourceRemaining > 0)) return { ok: true, rows: [], total: 0 };

      const search = String(q || '').trim();
      const searchClause = search
         ? `AND (
            bt.description LIKE :searchLike
            OR bt.document_ref LIKE :searchLike
            OR ba.bank_name LIKE :searchLike
            OR CAST(bt.amount AS CHAR) LIKE :searchLike
         )`
         : '';

      const rows = await sequelize.query(
         `
         SELECT
            bt.id,
            bt.entity_id,
            bt.entity_bank_account_id,
            bt.type,
            bt.amount,
            bt.description,
            bt.document_ref,
            bt.branch,
            bt.issued_at,
            ba.bank_name,
            ba.account_number,
            ba.currency,
            ${remainingSQL} AS remaining_amount,
            ABS(${remainingSQL} - :sourceRemaining) AS amount_distance,
            ABS(DATEDIFF(DATE(bt.issued_at), DATE(:sourceIssuedAt))) AS date_distance
         FROM entity_bank_transactions bt
         JOIN entity_bank_accounts ba ON ba.id = bt.entity_bank_account_id
         WHERE bt.entity_id = :entityId
           AND bt.id <> :sourceId
           AND bt.type <> :sourceType
           ${searchClause}
         HAVING remaining_amount > 0
         ORDER BY amount_distance ASC, date_distance ASC, bt.issued_at DESC, bt.id DESC
         LIMIT :limit
         `,
         {
            replacements: {
               entityId: parsedEntityId,
               sourceId,
               sourceType: source.type,
               sourceRemaining,
               sourceIssuedAt: source.issued_at,
               searchLike: `%${search}%`,
               limit: Math.min(Math.max(Number(limit) || 50, 1), 100),
            },
            type: QueryTypes.SELECT,
         }
      );

      const mapped = rows.map((row) => {
         const plain = BankService.#decryptAccountNumberFromStorage(row.account_number);
         const masked = plain
            ? BankService.#maskAccountNumber(plain)
            : (() => {
               const last4 = BankService.#extractLast4FromStorage(row.account_number);
               return last4 ? `****${last4}` : '';
            })();
         const currencyLabel = row.currency === 'USD' ? 'DOLAR' : row.currency;

         return {
            id: Number(row.id),
            target_kind: 'bank_transaction',
            bank_type: row.type,
            issue_date: row.issued_at?.toISOString?.().slice(0, 10) || String(row.issued_at || '').slice(0, 10),
            description: row.description || '',
            counterparty_name: row.description || '',
            folio: BankService.#normalizeDocumentRef(row.document_ref) || `MOV-${row.id}`,
            total_amount: Number(row.amount || 0),
            remaining_amount: Number(row.remaining_amount || 0),
            account_label: [row.bank_name, masked, currencyLabel].filter(Boolean).join(' - '),
            document_ref: BankService.#normalizeDocumentRef(row.document_ref),
         };
      });

      return { ok: true, rows: mapped, total: mapped.length };
   }

   async reconcileBankTransaction({ entityId, bank_transaction_id, target_bank_transaction_id, amount = null }) {
      const parsedEntityId = Number(entityId);
      const sourceId = Number(bank_transaction_id);
      const targetId = Number(target_bank_transaction_id);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) throw boom.badRequest("entityId is required");
      if (!Number.isInteger(sourceId) || sourceId <= 0) throw boom.badRequest("bank_transaction_id is required");
      if (!Number.isInteger(targetId) || targetId <= 0) throw boom.badRequest("target_bank_transaction_id is required");
      if (sourceId === targetId) throw boom.badRequest("cannot reconcile a transaction with itself");
      if (amount != null && !(Number(amount) > 0)) throw boom.badRequest("amount must be a positive number");

      return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
         const remainingSQL = BankService.#bankRemainingSql("bt");
         const loadTx = async (id) => {
            const [row] = await sequelize.query(
               `
               SELECT bt.id, bt.entity_id, bt.type, bt.amount, bt.description, bt.issued_at,
                      ${remainingSQL} AS remaining_amount
               FROM entity_bank_transactions bt
               WHERE bt.id = :id AND bt.entity_id = :entityId
               LIMIT 1
               FOR UPDATE
               `,
               { replacements: { id, entityId: parsedEntityId }, type: QueryTypes.SELECT, transaction: t }
            );
            return row;
         };

         const source = await loadTx(sourceId);
         const target = await loadTx(targetId);
         if (!source) throw boom.notFound("bank transaction not found for the given entity");
         if (!target) throw boom.notFound("target bank transaction not found for the given entity");
         if (source.type === target.type) throw boom.badRequest("bank transactions must have opposite types");

         const sourceRemaining = Number(source.remaining_amount || 0);
         const targetRemaining = Number(target.remaining_amount || 0);
         if (sourceRemaining <= 0) throw boom.conflict("bank transaction has no remaining balance");
         if (targetRemaining <= 0) throw boom.conflict("target bank transaction has no remaining balance");

         let toApply = amount != null ? Number(amount) : Math.min(sourceRemaining, targetRemaining);
         if (!Number.isFinite(toApply) || toApply <= 0) throw boom.badRequest("invalid amount to apply");
         if (toApply > sourceRemaining + 1e-6) throw boom.conflict("amount exceeds bank transaction remaining balance");
         if (toApply > targetRemaining + 1e-6) throw boom.conflict("amount exceeds target bank transaction remaining balance");

         const dup = await models.BankTransactionMatch.findOne({
            where: {
               [Op.or]: [
                  { source_bank_transaction_id: sourceId, target_bank_transaction_id: targetId, amount_applied: toApply },
                  { source_bank_transaction_id: targetId, target_bank_transaction_id: sourceId, amount_applied: toApply },
               ],
            },
            transaction: t,
            lock: t.LOCK.UPDATE,
         });
         if (dup) throw boom.conflict("an identical bank reconciliation already exists for this pair and amount");

         const link = await models.BankTransactionMatch.create({
            source_bank_transaction_id: sourceId,
            target_bank_transaction_id: targetId,
            amount_applied: toApply,
            method: 'manual',
         }, { transaction: t });

         const sourceAfter = await loadTx(sourceId);
         const targetAfter = await loadTx(targetId);

         return {
            ok: true,
            applied: {
               id: link.id,
               bank_transaction_id: sourceId,
               target_bank_transaction_id: targetId,
               amount_applied: toApply,
            },
            bank: {
               id: sourceId,
               type: source.type,
               amount: Number(source.amount || 0),
               remaining_before: sourceRemaining,
               remaining_after: Number(sourceAfter.remaining_amount || 0),
               description: source.description,
               issued_at: source.issued_at,
            },
            target: {
               id: targetId,
               type: target.type,
               amount: Number(target.amount || 0),
               remaining_before: targetRemaining,
               remaining_after: Number(targetAfter.remaining_amount || 0),
               description: target.description,
               issued_at: target.issued_at,
            },
         };
      });
   }

   async unreconcile({ id, entityId, kind = 'document' }) {
      if (!id || !entityId) throw boom.badRequest('id and entityId are required');

      if (kind === 'bank_transaction') {
         return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
            const link = await models.BankTransactionMatch.findOne({
               where: { id },
               transaction: t,
               lock: t.LOCK.UPDATE,
            });
            if (!link) throw boom.notFound('reconciliation not found');

            // validacion de pertenencia: join para verificar entity_id en ambos extremos del cruce
            const [own] = await sequelize.query(`
            SELECT 1
            FROM bank_transaction_matches btm
            JOIN entity_bank_transactions src ON src.id = btm.source_bank_transaction_id AND src.entity_id = :e
            JOIN entity_bank_transactions tgt ON tgt.id = btm.target_bank_transaction_id AND tgt.entity_id = :e
            WHERE btm.id = :id
            LIMIT 1
            `, { type: QueryTypes.SELECT, transaction: t, replacements: { id, e: entityId } });

            if (!own) throw boom.forbidden('reconciliation does not belong to the given entity');

            await link.destroy({ transaction: t });

            return { ok: true, removed: id };
         });
      }

      return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
         const link = await sequelize.models.BankTransactionDocument.findOne({
            where: { id },
            transaction: t,
            lock: t.LOCK.UPDATE,
         });
         if (!link) throw boom.notFound('reconciliation not found');

         // validacion de pertenencia: join para verificar entity_id en ambos lados
         const [own] = await sequelize.query(`
         SELECT 1
         FROM bank_transaction_documents btd
         JOIN entity_bank_transactions bt ON bt.id = btd.entity_bank_transaction_id AND bt.entity_id = :e
         JOIN entity_sii_documents d ON d.id = btd.entity_sii_document_id AND d.entity_id = :e
         WHERE btd.id = :id
         LIMIT 1
         `, { type: QueryTypes.SELECT, transaction: t, replacements: { id, e: entityId } });

         if (!own) throw boom.forbidden('reconciliation does not belong to the given entity');

         await link.destroy({ transaction: t });

         return { ok: true, removed: id };
      });
   }

   async listReconciliations({ entityId, bank_transaction_id = null, document_id = null, limit = 50, offset = 0 }) {
      const whereTx = bank_transaction_id ? 'AND btd.entity_bank_transaction_id = :bt' : '';
      const whereDoc = document_id ? 'AND btd.entity_sii_document_id = :doc' : '';

      const params = {
         e: entityId, bt: bank_transaction_id, doc: document_id,
         limit: Number(limit), offset: Number(offset),
      };

      const sql = `
         SELECT
            btd.id,
            btd.entity_bank_transaction_id AS bank_transaction_id,
            btd.entity_sii_document_id     AS document_id,
            btd.amount_applied,
            bt.type AS bank_type,
            bt.amount AS bank_amount,
            bt.issued_at AS bank_issued_at,
            bt.description AS bank_description,
            d.doc_type_code,
            d.folio,
            d.issue_date,
            d.counterparty_rut,
            d.total_amount AS doc_amount
         FROM bank_transaction_documents btd
         JOIN entity_bank_transactions bt ON bt.id = btd.entity_bank_transaction_id AND bt.entity_id = :e
         JOIN entity_sii_documents d ON d.id = btd.entity_sii_document_id AND d.entity_id = :e
         WHERE 1=1
            ${whereTx}
            ${whereDoc}
         ORDER BY btd.id DESC
         LIMIT :limit OFFSET :offset
      `;
      const sqlCount = `
         SELECT COUNT(*) AS total
         FROM bank_transaction_documents btd
         JOIN entity_bank_transactions bt ON bt.id = btd.entity_bank_transaction_id AND bt.entity_id = :e
         JOIN entity_sii_documents d ON d.id = btd.entity_sii_document_id AND d.entity_id = :e
         WHERE 1=1
            ${whereTx}
            ${whereDoc}
      `;

      const [{ total }] = await sequelize.query(sqlCount, { replacements: params, type: QueryTypes.SELECT });
      const rows = await sequelize.query(sql, { replacements: params, type: QueryTypes.SELECT });

      let bankRows = [];
      if (bank_transaction_id && !document_id) {
         bankRows = await sequelize.query(
            `
            SELECT
               btm.id,
               'bank_transaction' AS kind,
               :bt AS bank_transaction_id,
               CASE
                  WHEN btm.source_bank_transaction_id = :bt THEN btm.target_bank_transaction_id
                  ELSE btm.source_bank_transaction_id
               END AS target_bank_transaction_id,
               btm.amount_applied,
               otherbt.type AS target_bank_type,
               otherbt.amount AS doc_amount,
               otherbt.issued_at AS issue_date,
               otherbt.description AS bank_description,
               otherbt.document_ref AS folio,
               NULL AS document_id,
               NULL AS doc_type_code,
               NULL AS counterparty_rut
            FROM bank_transaction_matches btm
            JOIN entity_bank_transactions selectedbt
              ON selectedbt.id = :bt
             AND selectedbt.entity_id = :e
            JOIN entity_bank_transactions otherbt
              ON otherbt.id = CASE
                  WHEN btm.source_bank_transaction_id = :bt THEN btm.target_bank_transaction_id
                  ELSE btm.source_bank_transaction_id
               END
             AND otherbt.entity_id = :e
            WHERE btm.source_bank_transaction_id = :bt
               OR btm.target_bank_transaction_id = :bt
            ORDER BY btm.id DESC
            LIMIT :limit OFFSET :offset
            `,
            { replacements: params, type: QueryTypes.SELECT }
         );
      }

      return { total: Number(total || 0) + bankRows.length, rows: [...rows, ...bankRows] };
   }

   async #reconcileWithTx({ entityId, bank_transaction_id, document_id, amount = null, method = 'manual', t }) {
      // === Copia de tu reconcile actual, PERO:
      // 1) NO abras una nueva transaction; usa la `t` recibida.
      // 2) Donde usas queries, pasa { transaction: t }.
      // 3) Devuelve el mismo payload final.
      // 4) Mantén los mismos boom.* en inglés.

      // 1) lock filas
      const bankTx = await models.EntityBankTransaction.findOne({
         where: { id: bank_transaction_id, entity_id: entityId },
         attributes: ["id", "entity_id", "entity_bank_account_id", "type", "amount", "issued_at", "description"],
         transaction: t,
         lock: t.LOCK.UPDATE,
      });
      if (!bankTx) throw boom.notFound("bank transaction not found for the given entity");

      const doc = await models.EntitySiiDocument.findOne({
         where: { id: document_id, entity_id: entityId },
         attributes: ["id", "entity_id", "doc_type_code", "folio", "issue_date", "counterparty_rut", "total_amount", "received_date", "purchase_type", "operation_type"],
         transaction: t,
         lock: t.LOCK.UPDATE,
      });
      if (!doc) throw boom.notFound("document not found for the given entity");



      const docTypeCode = Number(doc.doc_type_code);
      const docOperationType = String(
doc.get?.("operation_type") || doc.getDataValue?.("operation_type") || doc.operation_type || doc.operationType || ""
).toUpperCase();
      const isLegacyPurchaseDoc = !docOperationType
         && [33, 34].includes(docTypeCode)
         && Boolean(doc.received_date || doc.purchase_type);
      const isLegacyIncomeDoc = !docOperationType && (
         [39, 41, 1001].includes(docTypeCode)
         || ([33, 34].includes(docTypeCode) && !doc.received_date && !doc.purchase_type)
      );
      const isLegacyExpenseDoc = !docOperationType && (
         docTypeCode === 1002
         || isLegacyPurchaseDoc
         || doc.doc_type_code == null
      );
      const isPurchaseDoc = docOperationType === "EXPENSE" || isLegacyExpenseDoc;
      const isIncomeDoc = docOperationType === "INCOME" || isLegacyIncomeDoc;




      if (bankTx.type === "expense") {
         if (!isPurchaseDoc) {
            throw boom.badRequest("only purchase documents are allowed for expense transactions");
         }
      } else if (bankTx.type === "income") {
         if (!isIncomeDoc) {
            throw boom.badRequest("purchase documents cannot be reconciled with income transactions");
         }
      }

      const docReconcileAmount = BankService.#documentReconcileAmountSql("d");
      const bankRemainingSql = BankService.#bankRemainingSql("bt");

      const [agg] = await sequelize.query(
         `
         SELECT
            bt.amount AS bank_amount,
            ${bankRemainingSql} AS bank_remaining,
            ${docReconcileAmount} AS doc_amount,
            (${docReconcileAmount} - IFNULL(SUM(btd2.amount_applied),0)) AS doc_remaining
         FROM entity_bank_transactions bt
         JOIN entity_sii_documents d ON d.id = :docId AND d.entity_id = :entityId
         LEFT JOIN bank_transaction_documents btd2 ON btd2.entity_sii_document_id = d.id
         WHERE bt.id = :bankTxId AND bt.entity_id = :entityId
         GROUP BY bt.id, d.id
         `,
         { type: QueryTypes.SELECT, transaction: t, replacements: { bankTxId: bankTx.id, docId: doc.id, entityId } }
      );

      if (!agg) throw boom.badImplementation("could not compute balances");

      const bankRemaining = Number(agg.bank_remaining ?? 0);
      const docRemaining = Number(agg.doc_remaining ?? 0);
      if (bankRemaining <= 0) throw boom.conflict("bank transaction has no remaining balance");
      if (docRemaining <= 0) throw boom.conflict("document has no remaining balance");

      let toApply = amount != null ? Number(amount) : Math.min(bankRemaining, docRemaining);
      if (!Number.isFinite(toApply) || toApply <= 0) throw boom.badRequest("invalid amount to apply");
      if (toApply > bankRemaining + 1e-6) throw boom.conflict("amount exceeds bank transaction remaining balance");
      if (toApply > docRemaining + 1e-6) throw boom.conflict("amount exceeds document remaining balance");

      const dup = await models.BankTransactionDocument.findOne({
         where: {
            entity_bank_transaction_id: bankTx.id,
            entity_sii_document_id: doc.id,
            amount_applied: toApply,
         },
         transaction: t,
         lock: t.LOCK.UPDATE,
      });
      if (dup) { throw boom.conflict("an identical reconciliation already exists for this pair and amount"); }

      const link = await models.BankTransactionDocument.create(
         {
            entity_bank_transaction_id: bankTx.id,
            entity_sii_document_id: doc.id,
            amount_applied: toApply,
         },
         { transaction: t }
      );

      const [after] = await sequelize.query(
         `
         SELECT
            bt.id AS bank_tx_id,
            bt.amount AS bank_amount,
            ${bankRemainingSql} AS bank_remaining,
            d.id AS doc_id,
            ${docReconcileAmount} AS doc_amount,
            (${docReconcileAmount} - IFNULL(SUM(btd2.amount_applied),0)) AS doc_remaining
         FROM entity_bank_transactions bt
         JOIN entity_sii_documents d ON d.id = :docId AND d.entity_id = :entityId
         LEFT JOIN bank_transaction_documents btd2 ON btd2.entity_sii_document_id = d.id
         WHERE bt.id = :bankTxId AND bt.entity_id = :entityId
         GROUP BY bt.id, d.id
         `,
         { type: QueryTypes.SELECT, transaction: t, replacements: { bankTxId: bankTx.id, docId: doc.id, entityId } }
      );

      return {
         ok: true,
         applied: {
            id: link.id,
            bank_transaction_id: bankTx.id,
            document_id: doc.id,
            amount_applied: toApply,
         },
         bank: {
            id: bankTx.id,
            type: bankTx.type,
            amount: Number(agg.bank_amount ?? bankTx.amount),
            remaining_before: bankRemaining,
            remaining_after: Number(after.bank_remaining ?? 0),
            description: bankTx.description,
            issued_at: bankTx.issued_at,
         },
         document: {
            id: doc.id,
            doc_type_code: doc.doc_type_code,
            folio: doc.folio,
            issue_date: doc.issue_date,
            counterparty_rut: doc.counterparty_rut,
            total_amount: Number(agg.doc_amount ?? doc.total_amount),
            remaining_before: docRemaining,
            remaining_after: Number(after.doc_remaining ?? 0),
         },
      };
   }

   async reconcileBulk({ entityId, pairs = [], method = 'bulk' }) {
      if (!entityId) throw boom.badRequest("entityId is required");
      if (!Array.isArray(pairs) || pairs.length === 0) {
         throw boom.badRequest("pairs[] is required");
      }

      return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
         const results = [];

         for (const p of pairs) {
            const bank_transaction_id = Number(p.bank_transaction_id);
            const document_id = Number(p.document_id);
            const amount = p.amount != null ? Number(p.amount) : null;

            if (!bank_transaction_id) throw boom.badRequest("bank_transaction_id is required");
            if (!document_id) throw boom.badRequest("document_id is required");
            if (amount != null && !(amount > 0)) throw boom.badRequest("amount must be a positive number");

            // reutiliza tu propio reconcile pero pasando la misma transacción
            const out = await this.#reconcileWithTx({
               entityId: Number(entityId),
               bank_transaction_id,
               document_id,
               amount,
               method,
               t
            });
            results.push(out);
         }

         return { ok: true, count: results.length, results };
      });
   }

   // === NUEVO: busca documento(s) candidato(s) para conciliar un movimiento (Sequelize, sin daysWindow) ===
   async autoFindDocument({ entityId, bank_transaction_id, rut = null, limit = 10 } = {}) {
      if (!entityId) throw boom.badRequest('entityId is required');
      if (!bank_transaction_id) throw boom.badRequest('bank_transaction_id is required');

      // 1) Traer el movimiento bancario
      const bankTx = await models.EntityBankTransaction.findOne({
         where: { id: bank_transaction_id, entity_id: entityId },
         attributes: ['id', 'entity_id', 'type', 'amount', 'issued_at', 'description'],
      });
      if (!bankTx) throw boom.notFound('bank transaction not found for the given entity');

      // 1) monto objetivo (positivo, porque total_amount es positivo)
      const bankAmt = Math.abs(Number(bankTx.amount || 0));
      const docReconcileAmount = BankService.#documentReconcileAmountSql("`EntitySiiDocument`");
      const absDiffLiteral = sequelize.literal(
         `ABS((${docReconcileAmount}) - ${bankAmt})`
      );

      // 2) diferencia de días contra la fecha del movimiento
      //   - issued_at viene como DATETIME; lo casteamos a DATE para DATEDIFF
      const txDate = bankTx.issued_at; // ej: "2025-08-29T00:00:00.000Z"
      const dateDiffLiteral = sequelize.literal(
         `ABS(DATEDIFF(DATE(\`EntitySiiDocument\`.\`issue_date\`), DATE('${txDate}')))`
      );

      // 4) Reglas por tipo de documento (opcional; coméntalo si no aplica en tu dominio)
      const docTypeFilter = (bankTx.type === 'expense')
         ? {
            [Op.or]: [
               { operation_type: 'EXPENSE' },
               {
                  [Op.and]: [
                     { operation_type: null },
                     { doc_type_code: 1002 },
                  ],
               },
               {
                  [Op.and]: [
                     { operation_type: null },
                     { doc_type_code: null },
                  ],
               },
               {
                  [Op.and]: [
                     { operation_type: null },
                     { doc_type_code: { [Op.in]: [33, 34] } },
                     {
                        [Op.or]: [
                           { received_date: { [Op.ne]: null } },
                           { purchase_type: { [Op.ne]: null } },
                        ],
                     },
                  ],
               },
            ],
         }
         : {
            [Op.or]: [
               { operation_type: 'INCOME' },
               {
                  [Op.and]: [
                     { operation_type: null },
                     { doc_type_code: { [Op.in]: [39, 41, 1001] } },
                  ],
               },
               {
                  [Op.and]: [
                     { operation_type: null },
                     { doc_type_code: { [Op.in]: [33, 34] } },
                     { received_date: null },
                     { purchase_type: null },
                  ],
               },
            ],
         };

      // 5) Saldo pendiente > 0 (subselect como literal)
      const remainingLiteral = sequelize.literal(
         `((${docReconcileAmount}) - COALESCE((
       SELECT SUM(btd.amount_applied)
       FROM bank_transaction_documents btd
       WHERE btd.entity_sii_document_id = \`EntitySiiDocument\`.\`id\`
     ),0))`
      );

      // 6) WHERE base: entity, tipo (opcional), rut (opcional) y saldo pendiente
      const rutParts = BankService.#rutParts(rut);
      const rutFilter = rutParts ? {
         [Op.or]: [
            sequelize.where(
               sequelize.literal("REPLACE(REPLACE(UPPER(`EntitySiiDocument`.`counterparty_rut`),'.',''),'-','')"),
               { [Op.like]: `%${rutParts.full}%` }
            ),
            sequelize.where(
               sequelize.literal("REPLACE(REPLACE(UPPER(`EntitySiiDocument`.`counterparty_rut`),'.',''),'-','')"),
               { [Op.like]: `%${rutParts.body}%` }
            ),
         ],
      } : null;

      const andFilters = [
         docTypeFilter,
         sequelize.where(remainingLiteral, { [Op.gt]: 0 }),
      ];
      if (rutFilter) andFilters.push(rutFilter);

      const where = {
         entity_id: entityId,
         [Op.and]: andFilters,
      };

      // 7) Consulta: sin BETWEEN; ordenamos por cercanía de monto
      const docs = await models.EntitySiiDocument.findAll({
         where,
         attributes: [
            'id',
            'doc_type_code',
            'folio',
            'issue_date',
            'counterparty_rut',
            'counterparty_name',
            'total_amount',
            [remainingLiteral, 'doc_remaining'],
            [absDiffLiteral, 'abs_diff'],
            [dateDiffLiteral, 'date_diff'],
         ],
         order: [
            [absDiffLiteral, 'ASC'],
            [dateDiffLiteral, 'ASC'],
            ['issue_date', 'DESC'],
            ['id', 'DESC'],
         ],
         limit: Math.min(Math.max(Number(limit) || 10, 1), 50),
         subQuery: false,
      });

      const candidates = docs.map(d => ({
         id: d.id,
         doc_type_code: Number(d.doc_type_code),
         folio: d.folio,
         issue_date: d.issue_date,
         counterparty_rut: d.counterparty_rut,
         counterparty_name: d.counterparty_name,
         total_amount: Number(d.total_amount || 0),
         remaining_amount: Number(d.get('doc_remaining') || 0),
         abs_diff: Number(d.get('abs_diff') || 0),
      }));

      return {
         ok: true,
         bank: {
            id: bankTx.id,
            amount: Number(bankTx.amount || 0),
            issued_at: bankTx.issued_at,
            description: bankTx.description,
            target_amount: bankAmt,
         },
         best: candidates[0] || null,
         candidates,
      };
   }



}

module.exports = BankService;
