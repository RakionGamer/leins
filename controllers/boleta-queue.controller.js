// controllers/boleta-queue.controller.js
'use strict';

const BoletaQueueService = require('../services/boleta-queue.service');
const service = new BoletaQueueService();

const getNextJob = async (req, res, next) => {
   try {
      const agentToken = req.headers['x-agent-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
      const result = await service.getNextJob({ agentToken });
      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

const consultPendingJobs = async (req, res, next) => {
   try {
      const agentToken = req.headers['x-agent-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
      const limit = req.query.limit || 50;
      const result = await service.listPendingJobs({ agentToken, limit });
      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

const uploadPdf = async (req, res, next) => {
   try {
      const agentToken = req.headers['x-agent-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
      const { id, folio } = req.body || {};
      const file = req.file;

      const result = await service.uploadPdf({
         id,
         folio,
         file,
         agentToken,
      });

      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

const reportError = async (req, res, next) => {
   try {
      const agentToken = req.headers['x-agent-token'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');
      const { id, mensaje_error } = req.body || {};

      const result = await service.reportError({
         id,
         mensajeError: mensaje_error,
         agentToken,
      });

      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

// Endpoints internos de Leins (autenticados con JWT del usuario)
const createRequest = async (req, res, next) => {
   try {
      const {
         entityId,
         bank_transaction_id,
         amount,
         description,
         customer_rut,
         customer_name,
         is_exempt,
         doc_type_code,
      } = req.body || {};

      const createdBy = req.user?.sub || req.user?.id || null;

      const result = await service.createRequest({
         entityId,
         bankTransactionId: bank_transaction_id,
         amount,
         description,
         customerRut: customer_rut,
         customerName: customer_name,
         isExempt: is_exempt,
         docTypeCode: doc_type_code,
         createdBy,
      });

      return res.status(201).json({
         ok: true,
         message: 'Solicitud de boleta encolada con exito',
         data: result,
      });
   } catch (error) {
      return next(error);
   }
};

const createBatchRequests = async (req, res, next) => {
   try {
      const { entityId, transactions } = req.body || {};
      const createdBy = req.user?.sub || req.user?.id || null;

      const result = await service.createBatchRequests({
         entityId,
         transactions,
         createdBy,
      });

      return res.status(201).json({
         ok: true,
         message: `${result.totalCreated} boletas encoladas con exito`,
         data: result,
      });
   } catch (error) {
      return next(error);
   }
};

const listRequests = async (req, res, next) => {
   try {
      const { entityId, status, page, limit } = req.query || {};
      const result = await service.listRequests({
         entityId,
         status,
         page,
         limit,
      });
      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

const getActiveMap = async (req, res, next) => {
   try {
      const { entityId } = req.query;
      const idsRaw = req.query.ids;
      const bankTxIds = idsRaw ? String(idsRaw).split(',').map(Number).filter(Boolean) : [];

      const map = await service.getActiveRequestsByBankTxIds({
         entityId,
         bankTxIds,
      });
      return res.status(200).json({ ok: true, map });
   } catch (error) {
      return next(error);
   }
};

const cancelRequest = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { entityId } = req.body || req.query || {};
      const result = await service.cancelRequest({ id, entityId });
      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

const downloadPdf = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { entityId } = req.query;
      const { filePath, filename } = await service.getPdfFilePath({ id, entityId });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      return res.sendFile(filePath);
   } catch (error) {
      return next(error);
   }
};


const retryRequest = async (req, res, next) => {
   try {
      const { id } = req.params;
      const { entityId } = req.body || req.query || {};
      const result = await service.retryRequest({ id, entityId });
      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

const retryAllFailed = async (req, res, next) => {
   try {
      const { entityId } = req.body || req.query || {};
      const result = await service.retryAllFailed({ entityId });
      return res.status(200).json(result);
   } catch (error) {
      return next(error);
   }
};

module.exports = {
   getNextJob,
   consultPendingJobs,
   uploadPdf,
   reportError,
   createRequest,
   createBatchRequests,
   listRequests,
   getActiveMap,
   cancelRequest,
   downloadPdf,
   retryRequest,
   retryAllFailed,
};
