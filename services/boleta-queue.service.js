// services/boleta-queue.service.js
'use strict';

const fs = require('fs');
const path = require('path');
const Boom = require('@hapi/boom');
const { models, sequelize } = require('../libs/sequelize');
const BankService = require('./bank.service');

const UPLOADS_DIR = path.resolve(__dirname, '..', 'uploads', 'boletas');
if (!fs.existsSync(UPLOADS_DIR)) {
   fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const EXPECTED_AGENT_TOKEN = process.env.AGENT_TOKEN || process.env.BOLETA_AGENT_TOKEN || 'leins_boleta_bot_2026_seguro';

class BoletaQueueService {
   constructor() {
      this.bankService = new BankService();
   }

   #verifyAgentToken(token) {
      if (!token || String(token).trim() !== String(EXPECTED_AGENT_TOKEN).trim()) {
         throw Boom.unauthorized('X-Agent-Token invalido');
      }
   }

   /**
    * Crear una solicitud para encolar la emisión de una boleta
    */
   async createRequest({
      entityId,
      bankTransactionId = null,
      amount,
      description = null,
      customerRut = null,
      customerName = null,
      isExempt = true,
      docTypeCode = null,
      createdBy = null,
   }) {
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw Boom.badRequest('entityId es requerido');
      }

      const parsedAmount = Math.round(Number(amount));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
         throw Boom.badRequest('El monto debe ser un numero mayor a 0');
      }

      // Si viene asociado a un movimiento bancario, verificar que no tenga ya solicitud pendiente/activa
      if (bankTransactionId) {
         const existingActive = await models.EntityBoletaRequest.findOne({
            where: {
               bank_transaction_id: Number(bankTransactionId),
               status: ['pending', 'processing', 'completed'],
            },
         });

         if (existingActive) {
            if (existingActive.status === 'completed') {
               throw Boom.conflict(`Este movimiento ya tiene una boleta emitida (Folio ${existingActive.folio || '-'})`);
            }
            throw Boom.conflict('Este movimiento ya se encuentra en cola de boleteo');
         }
      }

      const finalIsExempt = isExempt === true || isExempt === 'true' || isExempt === 1 || isExempt === '1';
      const finalDocType = docTypeCode ? Number(docTypeCode) : (finalIsExempt ? 41 : 39);

      let netAmount = parsedAmount;
      let vatAmount = 0;
      if (!finalIsExempt) {
         netAmount = Math.round(parsedAmount / 1.19);
         vatAmount = parsedAmount - netAmount;
      }

      const request = await models.EntityBoletaRequest.create({
         entity_id: parsedEntityId,
         bank_transaction_id: bankTransactionId ? Number(bankTransactionId) : null,
         amount: parsedAmount,
         net_amount: netAmount,
         vat_amount: vatAmount,
         description: description ? String(description).slice(0, 500) : null,
         customer_rut: customerRut ? String(customerRut).slice(0, 20) : null,
         customer_name: customerName ? String(customerName).slice(0, 255) : null,
         is_exempt: finalIsExempt,
         doc_type_code: finalDocType,
         status: 'pending',
         created_by: createdBy ? Number(createdBy) : null,
      });

      return request;
   }

   /**
    * Crear solicitudes en lote para encolar la emisión de boletas (masivo)
    */
   async createBatchRequests({ entityId, transactions = [], createdBy = null }) {
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw Boom.badRequest('entityId es requerido');
      }

      if (!Array.isArray(transactions) || transactions.length === 0) {
         throw Boom.badRequest('Debes enviar al menos un movimiento para encolar');
      }

      const txIds = transactions.map((t) => Number(t.bank_transaction_id || t.id)).filter(Boolean);
      const existing = await models.EntityBoletaRequest.findAll({
         where: {
            bank_transaction_id: txIds,
            status: ['pending', 'processing', 'completed'],
         },
         attributes: ['bank_transaction_id'],
      });
      const alreadyInQueue = new Set(existing.map((e) => Number(e.bank_transaction_id)));

      const created = [];
      for (const item of transactions) {
         const txId = Number(item.bank_transaction_id || item.id);
         if (txId && alreadyInQueue.has(txId)) {
            continue;
         }

         const parsedAmount = Math.round(Number(item.amount || item.monto));
         if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            continue;
         }

         const req = await models.EntityBoletaRequest.create({
            entity_id: parsedEntityId,
            bank_transaction_id: txId || null,
            amount: parsedAmount,
            net_amount: parsedAmount,
            vat_amount: 0,
            description: item.description || item.descripcion || 'Venta',
            customer_rut: item.customer_rut || null,
            customer_name: item.customer_name || 'Consumidor Final',
            is_exempt: true,
            doc_type_code: 41,
            status: 'pending',
            created_by: createdBy ? Number(createdBy) : null,
         });
         created.push(req);
      }

      return {
         ok: true,
         totalCreated: created.length,
         requests: created,
      };
   }

   /**
    * Endpoint para el Worker de Harry: Obtener siguiente trabajo pendiente
    * Contrato: devuelve { ok: true, solicitud: { id, operacion_id, monto, empresa, rut_empresa } } o { ok: true, solicitud: null }
    */
   async getNextJob({ agentToken }) {
      this.#verifyAgentToken(agentToken);

      // Buscar la solicitud pendiente más antigua
      const request = await models.EntityBoletaRequest.findOne({
         where: { status: 'pending' },
         order: [['id', 'ASC']],
         include: [{ model: models.Entity, as: 'entity', attributes: ['id', 'legal_name', 'tax_id'] }],
      });

      if (!request) {
         return { ok: true, solicitud: null };
      }

      // Marcarla atómicamente como processing
      await request.update({ status: 'processing' });

      const entityName = request.entity?.legal_name || 'EMPRESA';
      const entityRut = request.entity?.tax_id || '';

      return {
         ok: true,
         solicitud: {
            id: request.id,
            operacion_id: request.bank_transaction_id || request.id,
            monto: Math.round(Number(request.amount)),
            descripcion: request.description || 'Venta',
            cliente_rut: request.customer_rut || null,
            cliente_nombre: request.customer_name || 'Consumidor Final',
            empresa: entityName,
            rut_empresa: entityRut,
            tipo_boleta: request.is_exempt ? 'exenta' : 'afecta',
            fecha: request.createdAt,
         },
      };
   }

   /**
    * Endpoint para consultar la lista de boletas pendientes sin marcarlas como en proceso
    */
   async listPendingJobs({ agentToken, limit = 50 }) {
      this.#verifyAgentToken(agentToken);

      const requests = await models.EntityBoletaRequest.findAll({
         where: { status: 'pending' },
         order: [['id', 'ASC']],
         limit: Math.min(100, Math.max(1, Number(limit) || 50)),
         include: [{ model: models.Entity, as: 'entity', attributes: ['id', 'legal_name', 'tax_id'] }],
      });

      return {
         ok: true,
         total: requests.length,
         boletas: requests.map((r) => ({
            id: r.id,
            operacion_id: r.bank_transaction_id || r.id,
            monto: Math.round(Number(r.amount)),
            descripcion: r.description || 'Venta',
            cliente_rut: r.customer_rut || null,
            cliente_nombre: r.customer_name || 'Consumidor Final',
            empresa: r.entity?.legal_name || 'EMPRESA',
            rut_empresa: r.entity?.tax_id || '',
            tipo_boleta: r.is_exempt ? 'exenta' : 'afecta',
            fecha: r.createdAt,
            estado: r.status,
         })),
      };
   }

   /**
    * Endpoint para el Worker de Harry: Subir PDF de la boleta emitida
    */
   async uploadPdf({ id, folio, file, agentToken }) {
      this.#verifyAgentToken(agentToken);

      const parsedId = Number(id);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
         throw Boom.badRequest('id de solicitud invalido');
      }

      const request = await models.EntityBoletaRequest.findByPk(parsedId, {
         include: [{ model: models.Entity, as: 'entity' }],
      });

      if (!request) {
         throw Boom.notFound(`Solicitud de boleta ${parsedId} no encontrada`);
      }

      const parsedFolio = folio ? parseInt(String(folio).replace(/\D/g, ''), 10) : null;
      if (!parsedFolio || parsedFolio <= 0) {
         throw Boom.badRequest('folio es requerido y debe ser numerico');
      }

      // Guardar archivo PDF físicamente
      let savedPath = null;
      let filename = null;
      if (file && file.buffer) {
         filename = `boleta_${request.id}_folio_${parsedFolio}_${Date.now()}.pdf`;
         savedPath = path.join(UPLOADS_DIR, filename);
         fs.writeFileSync(savedPath, file.buffer);
      }

      // 1. Crear el documento oficial en entity_sii_documents
      const docTypeCode = request.doc_type_code || (request.is_exempt ? 41 : 39);
      const todayYmd = new Date().toISOString().slice(0, 10);

      // Si viene de un movimiento bancario, obtener su fecha
      let issueDate = todayYmd;
      let bankTx = null;
      if (request.bank_transaction_id) {
         bankTx = await models.EntityBankTransaction.findByPk(request.bank_transaction_id);
         if (bankTx && bankTx.issued_at) {
            issueDate = String(bankTx.issued_at).slice(0, 10);
         }
      }

      const [yearStr, monthStr] = issueDate.split('-');
      const periodYear = Number(yearStr);
      const periodMonth = Number(monthStr);

      let siiDoc = await models.EntitySiiDocument.findOne({
         where: {
            entity_id: request.entity_id,
            doc_type_code: docTypeCode,
            folio: parsedFolio,
         },
      });

      if (!siiDoc) {
         siiDoc = await models.EntitySiiDocument.create({
            entity_id: request.entity_id,
            doc_type_code: docTypeCode,
            folio: parsedFolio,
            issue_date: issueDate,
            period_year: periodYear,
            period_month: periodMonth,
            total_amount: request.amount,
            amount_exempt: request.is_exempt ? request.amount : 0,
            amount_net: request.is_exempt ? 0 : request.net_amount,
            amount_vat: request.is_exempt ? 0 : request.vat_amount,
            counterparty_rut: request.customer_rut || null,
            counterparty_name: request.customer_name || 'Consumidor Final',
            source: 'BOLETA_WORKER',
            state_id: 1,
            operation_type: 'INCOME',
            operationType: 'INCOME',
         });
      }

      // 2. Actualizar la solicitud de boleta
      await request.update({
         status: 'completed',
         folio: parsedFolio,
         pdf_path: savedPath ? `/uploads/boletas/${filename}` : null,
         pdf_filename: filename,
         sii_document_id: siiDoc.id,
         completed_at: new Date(),
      });

      // 3. Conciliar automáticamente contra el movimiento bancario si existe
      if (request.bank_transaction_id && siiDoc) {
         try {
            await this.bankService.reconcile({
               entityId: request.entity_id,
               bank_transaction_id: request.bank_transaction_id,
               document_id: siiDoc.id,
               amount: Number(request.amount),
            });
         } catch (reconcileErr) {
            console.error(`[BoletaQueue] Error conciliando tx ${request.bank_transaction_id} con doc ${siiDoc.id}:`, reconcileErr.message);
         }
      }

      return {
         ok: true,
         pdf_url: savedPath ? `/uploads/boletas/${filename}` : null,
         folio: parsedFolio,
         sii_document_id: siiDoc?.id,
      };
   }

   /**
    * Endpoint para el Worker de Harry: Reportar error de emisión
    */
   async reportError({ id, mensajeError, agentToken }) {
      this.#verifyAgentToken(agentToken);

      const parsedId = Number(id);
      if (!Number.isInteger(parsedId) || parsedId <= 0) {
         throw Boom.badRequest('id de solicitud invalido');
      }

      const request = await models.EntityBoletaRequest.findByPk(parsedId);
      if (!request) {
         throw Boom.notFound(`Solicitud de boleta ${parsedId} no encontrada`);
      }

      const mensaje = String(mensajeError || 'Error desconocido en emisión');
      const posiblementeEmitida = mensaje.includes('LA BOLETA YA SE EMITIÓ EN EL SII') || mensaje.includes('posiblemente');

      await request.update({
         status: posiblementeEmitida ? 'posiblemente_emitida' : 'failed',
         error_message: mensaje,
      });

      return { ok: true };
   }

   /**
    * Listar solicitudes de boleta para la interfaz de Leins
    */
   async listRequests({ entityId, status, page = 1, limit = 50 }) {
      const parsedEntityId = Number(entityId);
      if (!Number.isInteger(parsedEntityId) || parsedEntityId <= 0) {
         throw Boom.badRequest('entityId es requerido');
      }

      const where = { entity_id: parsedEntityId };
      if (status && status !== 'all') {
         where.status = status;
      }

      const parsedLimit = Math.min(200, Math.max(1, Number(limit) || 50));
      const parsedPage = Math.max(1, Number(page) || 1);
      const offset = (parsedPage - 1) * parsedLimit;

      const { count, rows } = await models.EntityBoletaRequest.findAndCountAll({
         where,
         limit: parsedLimit,
         offset,
         order: [['id', 'DESC']],
         include: [
            {
               model: models.EntityBankTransaction,
               as: 'bankTransaction',
               attributes: ['id', 'description', 'amount', 'issued_at', 'document_ref'],
            },
         ],
      });

      return {
         total: count,
         page: parsedPage,
         limit: parsedLimit,
         totalPages: Math.ceil(count / parsedLimit) || 1,
         rows,
      };
   }

   /**
    * Obtener mapa de solicitudes activas por bank_transaction_id para la cartola bancaria
    */
   async getActiveRequestsByBankTxIds({ entityId, bankTxIds = [] }) {
      if (!bankTxIds.length) return {};

      const requests = await models.EntityBoletaRequest.findAll({
         where: {
            entity_id: Number(entityId),
            bank_transaction_id: bankTxIds,
         },
         order: [['id', 'DESC']],
      });

      const map = {};
      for (const r of requests) {
         // Si hay múltiples, mantener el más reciente
         if (!map[r.bank_transaction_id]) {
            map[r.bank_transaction_id] = {
               id: r.id,
               status: r.status,
               folio: r.folio,
               amount: r.amount,
               pdf_path: r.pdf_path,
               error_message: r.error_message,
            };
         }
      }
      return map;
   }

   /**
    * Cancelar una solicitud pendiente
    */
   async cancelRequest({ id, entityId }) {
      const parsedId = Number(id);
      const request = await models.EntityBoletaRequest.findOne({
         where: { id: parsedId, entity_id: Number(entityId) },
      });

      if (!request) throw Boom.notFound('Solicitud no encontrada');
      if (request.status !== 'pending' && request.status !== 'failed') {
         throw Boom.badRequest(`No se puede cancelar una solicitud en estado ${request.status}`);
      }

      await request.update({ status: 'cancelled' });
      return { ok: true, message: 'Solicitud cancelada con exito' };
   }

   /**
    * Obtener ruta local absoluta del PDF para descarga
    */
   async getPdfFilePath({ id, entityId }) {
      const request = await models.EntityBoletaRequest.findOne({
         where: { id: Number(id), entity_id: Number(entityId) },
      });

      if (!request || !request.pdf_filename) {
         throw Boom.notFound('Archivo PDF no encontrado');
      }

      const filePath = path.join(UPLOADS_DIR, request.pdf_filename);
      if (!fs.existsSync(filePath)) {
         throw Boom.notFound('El archivo fisico del PDF no existe en el servidor');
      }

      return { filePath, filename: request.pdf_filename };
   }
}

module.exports = BoletaQueueService;
