// services/bank.service.js
const xlsx = require('xlsx');
const boom = require('@hapi/boom');
const { models, sequelize } = require('../libs/sequelize');
const { QueryTypes, Transaction, Op } = require("sequelize");

class BankService {

   // importa bancos o movimientos desde buffer de Excel
   async importFromExcelBuffer(buffer, { commit = false, entityId, entityBankAccountId } = {}) {
      const wb = this.#readWorkbook(buffer);
      const { sheetName, rows, _mode, headerRowIdx } = this.#sheetToRows(wb);

      // fila base para _rowNumber (opcional)
      const startRowExcel = (headerRowIdx >= 0 ? headerRowIdx + 2 : 2);

      if (_mode === 'santander_movs' || _mode === 'bci_movs' || _mode === 'estado_movs') {
         // seleccionar mapeador según modo
         const mapper = {
            santander_movs: (r) => this.#mapSantanderRow(r),
            bci_movs: (r) => this.#mapBCIRow(r),
            estado_movs: (r) => this.#mapBancoEstadoRow(r),
         }[_mode];

         const mapped = rows.map((r, i) => ({ ...mapper(r), _rowNumber: startRowExcel + i }));
         const { valid, invalid } = this.#splitValidMovements(mapped);

         let saved = 0, skipped = [];
         if (commit) {
            if (!entityId || !entityBankAccountId) throw boom.badRequest('faltan entityId o entityBankAccountId para persistir');
            const res = await this.#persistValidMovements(valid, { entityId, entityBankAccountId, collectSkipped: true });
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

      // === fallback original (lista de bancos) ===
      const normalized = rows.map(r => this.#normalizeObjKeys(r));
      const mapped = normalized.map(r => this.#mapRowToBank(r));
      const { valid, invalid } = this.#splitValid(mapped);

      let saved = 0;
      if (commit) saved = await this.#persistValid(valid);

      return {
         ok: true,
         mode: 'banks',
         sheet: sheetName,
         total_rows: rows.length,
         valid_rows: valid.length,
         invalid_rows: invalid.length,
         committed: commit,
         saved_rows: saved,
         preview_valid: valid.slice(0, 5),
         preview_invalid: invalid.slice(0, 5),
         columns_detected: Object.keys(rows[0] || {})
      };
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

      await sequelize.transaction(async (t) => {
         for (const m of valid) {
            const type = (m.amount ?? 0) < 0 ? 'expense' : 'income';
            const amountAbs = Math.abs(Number(m.amount ?? 0));
            const issuedAt = new Date(`${m.movementDate}T00:00:00.000Z`);
            const description = m.detail || null;
            const balance = (m.balance != null) ? Number(m.balance) : null; // <- normaliza saldo

            const where = {
               entity_id: entityId,
               entity_bank_account_id: entityBankAccountId,
               issued_at: issuedAt,
               type,
               amount: amountAbs,
               description,
            };
            if (balance != null) where.balance = balance; // <- usa saldo si viene

            const exists = await models.EntityBankTransaction.findOne({ where, transaction: t });

            if (exists) {
               if (collectSkipped) {
                  skipped.push({
                     rowNumber: m._rowNumber,
                     date: m.movementDate,
                     type,
                     amount: amountAbs,
                     balance,              // <- muestra saldo en el detalle
                     description,
                     documentRef: m.documentRef || null,
                     branch: m.branch || null
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
      const m = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/.exec(s);
      if (!m) return null;
      const [_, dd, mm, yyyy] = m;
      const d = new Date(`${yyyy}-${mm}-${dd}`);
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
   }

   // analiza montos numéricos en formatos comunes
   static #parseAmount(str) {
      if (str == null) return null;
      let s = String(str).trim().replace(/\s+/g, '');
      s = s.replace(/[^\d\.\,\-]/g, ''); // deja dígitos, ., , y -
      const hasDot = s.includes('.');
      const hasComma = s.includes(',');
      if (hasDot && hasComma) s = s.replace(/\./g, '').replace(',', '.'); // 317.533,25 -> 317533.25
      else if (hasComma && !hasDot) s = s.replace(/,/g, '');              // 15,000 -> 15000
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
         if (!it.movementDate) reasons.push('fecha inválida o ausente');
         if (!it.detail) reasons.push('detalle requerido');
         if (typeof it.amount !== 'number') reasons.push('monto inválido');

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

   // === Santander (ya lo tienes, lo dejamos compacto) ===
   #mapSantanderRow(r) {
      const rawAmount = BankService.#pickFromRow(r, 'Monto');
      const rawDetail = BankService.#pickFromRow(r, 'Descripción Movimiento', 'Descripcion Movimiento', 'Detalle Movimiento', 'Movimiento');
      const rawDate = BankService.#pickFromRow(r, 'Fecha');
      const rawBalance = BankService.#pickFromRow(r, 'Saldo');
      const rawDoc = BankService.#pickFromRow(r, 'N° Documento', 'No Documento', 'N Documento', 'Nro Documento', 'Numero Documento');
      const rawBranch = BankService.#pickFromRow(r, 'Sucursal');
      const rawKind = BankService.#pickFromRow(r, 'Cargo/Abono', 'Cargo - Abono', 'Cargo Abono', 'Cargoabono', 'Tipo');

      const amt = BankService.#parseAmount(rawAmount);
      const kind = rawKind ? String(rawKind).trim().toUpperCase() : null;
      const amount = (kind === 'C' && typeof amt === 'number' && amt > 0) ? -amt : amt;

      return {
         movementDate: BankService.#parseDDMMYYYY(rawDate),
         detail: rawDetail ? String(rawDetail).trim() : null,
         amount,
         balance: BankService.#parseAmount(rawBalance),
         documentRef: rawDoc ? String(rawDoc).trim() : null,
         branch: rawBranch ? String(rawBranch).trim() : null,
         kind,
         _raw: r,
      };
   }

   // === BCI: cargo y abono separados ===
   #mapBCIRow(r) {
      const rawDate = BankService.#pickFromRow(r, 'Fecha');
      const rawDesc = BankService.#pickFromRow(r, 'Descripción', 'Descripcion', 'Glosa', 'Detalle');
      const rawCargo = BankService.#pickFromRow(r, 'Cargo');
      const rawAbono = BankService.#pickFromRow(r, 'Abono');
      const rawSaldo = BankService.#pickFromRow(r, 'Saldo');
      const rawDoc = BankService.#pickFromRow(r, 'N° Documento', 'No Documento', 'Documento', 'N Documento');
      const rawSuc = BankService.#pickFromRow(r, 'Sucursal');

      const cargo = BankService.#parseAmount(rawCargo) || 0;
      const abono = BankService.#parseAmount(rawAbono) || 0;
      const amount = abono - cargo;        // positivo si hay abono, negativo si cargo
      const kind = amount < 0 ? 'C' : 'A'; // inferimos tipo

      return {
         movementDate: BankService.#parseDDMMYYYY(rawDate),
         detail: rawDesc ? String(rawDesc).trim() : null,
         amount,
         balance: BankService.#parseAmount(rawSaldo),
         documentRef: rawDoc ? String(rawDoc).trim() : null,
         branch: rawSuc ? String(rawSuc).trim() : null,
         kind,
         _raw: r,
      };
   }

   // === BancoEstado: similar a BCI, a veces sin doc ===
   #mapBancoEstadoRow(r) {
      const rawDate = BankService.#pickFromRow(r, 'Fecha');
      const rawDesc = BankService.#pickFromRow(r, 'Descripción', 'Descripcion', 'Detalle', 'Glosa');
      const rawCargo = BankService.#pickFromRow(r, 'Cargo');
      const rawAbono = BankService.#pickFromRow(r, 'Abono');
      const rawSaldo = BankService.#pickFromRow(r, 'Saldo');
      const rawDoc = BankService.#pickFromRow(r, 'N° Doc', 'N° Documento', 'No Documento', 'Documento', 'N Documento');
      const rawSuc = BankService.#pickFromRow(r, 'Sucursal');

      const cargo = BankService.#parseAmount(rawCargo) || 0;
      const abono = BankService.#parseAmount(rawAbono) || 0;
      const amount = abono - cargo;
      const kind = amount < 0 ? 'C' : 'A';

      return {
         movementDate: BankService.#parseDDMMYYYY(rawDate),
         detail: rawDesc ? String(rawDesc).trim() : null,
         amount,
         balance: BankService.#parseAmount(rawSaldo),
         documentRef: rawDoc ? String(rawDoc).trim() : null,
         branch: rawSuc ? String(rawSuc).trim() : null,
         kind,
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

   static #detectSantander(headerSet) {
      const need = ['monto', 'fecha', 'saldo'];
      const hasNeed = need.every(k => headerSet.has(k));
      const hasDesc = Array.from(headerSet).some(k => k.startsWith('descripcion movimiento') || k.startsWith('descripcion') || k.startsWith('descripcio'));
      return { matched: hasNeed && hasDesc, mode: 'santander_movs', needsArray: true };
   }

   // BCI típico: columnas separadas CARGO/ABONO (o "Cargo" y "Abono")
   static #detectBCI(headerSet) {
      const hasFecha = headerSet.has('fecha');
      const hasDesc = headerSet.has('descripcion') || Array.from(headerSet).some(k => k.startsWith('descripcion'));
      const hasCargo = headerSet.has('cargo');
      const hasAbono = headerSet.has('abono');
      const hasSaldo = headerSet.has('saldo');
      const ok = hasFecha && hasDesc && hasSaldo && (hasCargo || hasAbono);
      return { matched: ok, mode: 'bci_movs', needsArray: true };
   }

   // BancoEstado típico: muy parecido a BCI, a veces "N° Doc" o "Nº Doc"
   static #detectBancoEstado(headerSet) {
      const hasFecha = headerSet.has('fecha');
      const hasDesc = headerSet.has('descripcion') || Array.from(headerSet).some(k => k.startsWith('descripcion'));
      const hasSaldo = headerSet.has('saldo');
      const hasDoc = Array.from(headerSet).some(k => k.includes('n documento') || k.includes('no documento') || k.includes('nro documento') || k.includes('numero documento'));
      const hasCargo = headerSet.has('cargo');
      const hasAbono = headerSet.has('abono');
      const ok = hasFecha && hasDesc && hasSaldo && (hasDoc || hasCargo || hasAbono);
      return { matched: ok, mode: 'estado_movs', needsArray: true };
   }

   // Registro de detectores en orden de prioridad
   static #BANK_DETECTORS = [
      BankService.#detectSantander,
      BankService.#detectBCI,
      BankService.#detectBancoEstado,
   ];

   // extrae filas de la primera hoja del workbook
   #sheetToRows(wb) {
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // Leer como matriz para inspeccionar headers reales
      const rows2D = xlsx.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false, raw: false });
      if (!rows2D.length) throw boom.badRequest('el excel no contiene hojas');

      // Encuentra la fila que luce como encabezado (más robusto: busca palabras clave)
      let headerRowIdx = -1;
      for (let i = 0; i < Math.min(rows2D.length, 30); i++) {
         const row = rows2D[i] || [];
         const set = BankService.#normHeaderRow(row);
         // prueba cada detector
         for (const det of BankService.#BANK_DETECTORS) {
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

   static #normalizeKey(k) {
      return String(k || '')
         .trim()
         .toLowerCase()
         .replace(/\s+/g, '_')
         .replace(/[^\w_]/g, '');
   }

   #normalizeObjKeys(obj) {
      const out = {};
      for (const k in obj) out[BankService.#normalizeKey(k)] = obj[k];
      return out;
   }

   static #toDateISO(v) {
      if (v instanceof Date) return v.toISOString().slice(0, 10);
      if (typeof v === 'number') {
         // serial excel a fecha (base 1900)
         const epoch = new Date(Date.UTC(1899, 11, 30));
         const ms = v * 24 * 60 * 60 * 1000;
         return new Date(epoch.getTime() + ms).toISOString().slice(0, 10);
      }
      const d = new Date(v);
      return isNaN(d) ? null : d.toISOString().slice(0, 10);
   }

   static #isEmail(str) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || '').trim());
   }

   /**
    * Ajusta este mapeo a tus encabezados reales del Excel.
    * code/name/swift/email_contact pueden venir con nombres distintos.
    */
   #mapRowToBank(r) {
      return {
         code: r.codigo ?? r.code ?? r.cod_banco ?? r.banco_codigo ?? null,
         name: r.nombre ?? r.name ?? r.banco ?? r.nombre_banco ?? null,
         swift: r.swift ?? r.cod_swift ?? null,
         emailContact: r.email_contacto ?? r.email_contact ?? r.email ?? r.contacto_email ?? null,
         createdAtExcel: r.fecha ? BankService.#toDateISO(r.fecha) : null,
         _raw: r,
      };
   }

   // separa válidos e inválidos según reglas de negocio
   #splitValid(items) {
      // ajusta validación según tus requerimientos
      const valid = [];
      const invalid = [];

      // validamos por _raw para conservar datos originales
      for (const it of items) {
         if (it?._raw) valid.push(it);
         else invalid.push(it);
      }
      // devolver separación
      return { valid, invalid };
   }

   async #persistValid(valid) {
      if (!valid.length) return 0;

      // arma payload de columnas reales de tu modelo
      const payload = valid.map((r) => ({
         code: String(r.code).trim(),
         name: String(r.name).trim(),
         swift: r.swift ? String(r.swift).trim() : null,
         emailContact:
            r.emailContact && BankService.#isEmail(r.emailContact)
               ? String(r.emailContact).toLowerCase().trim()
               : null,
      }));

      let saved = 0;

      await sequelize.transaction(async (t) => {
         if (sequelize.getDialect() === 'postgres') {
            // requiere índice/constraint único en "code"
            const results = await models.Bank.bulkCreate(payload, {
               updateOnDuplicate: ['name', 'swift', 'emailContact'],
               transaction: t,
            });
            saved = results.length;
         } else {
            // fallback universal: upsert uno a uno
            for (const item of payload) {
               await models.Bank.upsert(item, { transaction: t });
               saved++;
            }
         }
      });

      return saved;
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
      const appliedSumSQL =
         `(SELECT COALESCE(SUM(btd.amount_applied),0)
        FROM bank_transaction_documents btd
       WHERE btd.entity_bank_transaction_id = ${baseQuoted}.id)`;

      // Remanente del movimiento (= amount - suma aplicada)
      const remainingSQL = `(${baseQuoted}.amount - ${appliedSumSQL})`;

      // Filtro "solo pendientes"
      if (soloPendientes) {
         (where[Op.and] = where[Op.and] || []).push(
            sequelize.where(sequelize.literal(remainingSQL), { [Op.gt]: 0 })
         );
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
               [sequelize.literal(remainingSQL), 'remaining_amount']
            ]
         },
         include: [{
            model: models.EntityBankAccount,
            as: 'bank_account',
            attributes: ['id', 'bank_name', 'account_number']
         }]
      });

      // helper: intenta extraer un "documento" al inicio de la glosa (p.ej. "0270747809 Transf...")
      const extractDoc = (s) => {
         const m = String(s || '').trim().match(/^([0-9A-Z]{8,12})\b/);
         return m ? m[1] : null;
      };

      const mapped = rows.map((r) => {
         const sign = r.type === 'expense' ? -1 : 1; // expense = cargo, income = abono
         const remaining = typeof r.get === 'function'
            ? Number(r.get('remaining_amount') ?? 0)
            : Number(r.remaining_amount ?? 0);
         return {
            _id: `tx-${r.id}`,
            source: 'bank',
            fecha: r.issued_at?.toISOString?.().slice(0, 10) || null,
            cuenta_corriente: (() => {
               const a = r.bank_account || {};
               if (a.alias) return a.alias;
               const parts = [a.bank_name, a.account_number, a.account_type].filter(Boolean);
               return parts.length ? parts.join(' · ') : (r.entity_bank_account_id ?? null);
            })(),

            documento: extractDoc(r.description),                   // opcional según glosa real
            glosa: r.description || '',
            descripcion: r.description || '',
            monto: sign * Number(r.amount || 0),
            balance: (r.balance != null) ? Number(r.balance) : null,
            comentarios: null,
            raw: {
               id: r.id,
               entity_id: r.entity_id,
               entity_bank_account_id: r.entity_bank_account_id,
               type: r.type,
               amount: Number(r.amount || 0),
               balance: (r.balance != null) ? Number(r.balance) : null,
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

      if (!entityId) return next(boom.badRequest("entityId is required"));
      if (!bank_transaction_id) return next(boom.badRequest("bank_transaction_id is required"));
      if (!document_id) return next(boom.badRequest("document_id is required"));
      if (amount != null && !(Number(amount) > 0)) return next(boom.badRequest("amount must be a positive number"));

      return await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED }, async (t) => {
         return await this.#reconcileWithTx({ entityId, bank_transaction_id, document_id, amount, method: 'manual', t });
      });

   }

   async unreconcile({ id, entityId }) {
      if (!id || !entityId) throw boom.badRequest('id and entityId are required');

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
      return { total: Number(total || 0), rows };
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
         attributes: ["id", "entity_id", "doc_type_code", "folio", "issue_date", "counterparty_rut", "total_amount", "received_date", "purchase_type"],
         transaction: t,
         lock: t.LOCK.UPDATE,
      });
      if (!doc) throw boom.notFound("document not found for the given entity");

      if (bankTx.type === "expense") {
         if (![33, 34].includes(Number(doc.doc_type_code))) {
            throw boom.badRequest("only purchase documents (33,34) are allowed for expense transactions");
         }
      } else if (bankTx.type === "income") {
         if ([33, 34].includes(Number(doc.doc_type_code))) {
            throw boom.badRequest("purchase documents (33,34) cannot be reconciled with income transactions");
         }
      }

      const [agg] = await sequelize.query(
         `
         SELECT
            bt.amount AS bank_amount,
            (bt.amount - IFNULL(SUM(btd1.amount_applied),0)) AS bank_remaining,
            d.total_amount AS doc_amount,
            (d.total_amount - IFNULL(SUM(btd2.amount_applied),0)) AS doc_remaining
         FROM entity_bank_transactions bt
         JOIN entity_sii_documents d ON d.id = :docId AND d.entity_id = :entityId
         LEFT JOIN bank_transaction_documents btd1 ON btd1.entity_bank_transaction_id = bt.id
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
            (bt.amount - IFNULL(SUM(btd1.amount_applied),0)) AS bank_remaining,
            d.id AS doc_id,
            d.total_amount AS doc_amount,
            (d.total_amount - IFNULL(SUM(btd2.amount_applied),0)) AS doc_remaining
         FROM entity_bank_transactions bt
         JOIN entity_sii_documents d ON d.id = :docId AND d.entity_id = :entityId
         LEFT JOIN bank_transaction_documents btd1 ON btd1.entity_bank_transaction_id = bt.id
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
      const absDiffLiteral = sequelize.literal(
         `ABS(\`EntitySiiDocument\`.\`total_amount\` - ${bankAmt})`
      );

      // 2) diferencia de días contra la fecha del movimiento
      //   - issued_at viene como DATETIME; lo casteamos a DATE para DATEDIFF
      const txDate = bankTx.issued_at; // ej: "2025-08-29T00:00:00.000Z"
      const dateDiffLiteral = sequelize.literal(
         `ABS(DATEDIFF(DATE(\`EntitySiiDocument\`.\`issue_date\`), DATE('${txDate}')))`
      );

      // 4) Reglas por tipo de documento (opcional; coméntalo si no aplica en tu dominio)
      const docTypeFilter = (bankTx.type === 'expense')
         ? { doc_type_code: { [Op.in]: [33, 34] } }  // ejemplo: compras (factura/b. exento)
         : { doc_type_code: { [Op.notIn]: [33, 34] } }; // ejemplo: ventas

      // 5) Saldo pendiente > 0 (subselect como literal)
      const remainingLiteral = sequelize.literal(
         `(COALESCE(\`EntitySiiDocument\`.\`total_amount\`,0) - COALESCE((
       SELECT SUM(btd.amount_applied)
       FROM bank_transaction_documents btd
       WHERE btd.entity_sii_document_id = \`EntitySiiDocument\`.\`id\`
     ),0))`
      );

      // 6) WHERE base: entity, tipo (opcional), rut (opcional) y saldo pendiente
      const where = {
         entity_id: entityId,
         ...docTypeFilter,                         // quita esta línea si no quieres filtrar por tipo
         ...(rut ? { counterparty_rut: { [Op.like]: `%${String(rut).trim()}%` } } : {}),
         [Op.and]: [sequelize.where(remainingLiteral, { [Op.gt]: 0 })],
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