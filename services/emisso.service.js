// services/emisso.service.js
const { config } = require('../config/config');
const { logInfo, logWarn, logError } = require('../utils/logger');

class EmissoService {
   constructor(apiKey = config.emissoApiKey, baseUrl = config.emissoApiUrl) {
      this.apiKey = apiKey;
      this.baseUrl = (baseUrl || 'https://connect.emisso.ai/api/v1').replace(/\/$/, '');
   }

   #getHeaders(connectionId = null) {
      if (!this.apiKey) {
         logWarn('EMISSO_API_KEY_MISSING', { message: 'No se ha configurado EMISSO_API_KEY en las variables de entorno' });
      }
      const headers = {
         'Content-Type': 'application/json',
         'Authorization': `Bearer ${this.apiKey}`,
      };
      if (connectionId) {
         headers['X-Connect-Connection'] = connectionId;
      }
      return headers;
   }

   async #executeTool(toolName, input = {}, connectionId = null) {
      const url = `${this.baseUrl}/tools/${toolName}/execute`;
      const headers = this.#getHeaders(connectionId);

      try {
         const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify({ input: input || {} }),
         });

         const text = await response.text();
         let resJson;
         try {
            resJson = text ? JSON.parse(text) : null;
         } catch {
            resJson = { raw: text };
         }

         if (!response.ok) {
            const errorMsg = resJson?.error?.message || resJson?.message || `Error HTTP ${response.status} de Emisso`;
            logError('EMISSO_API_ERROR', { status: response.status, toolName, message: errorMsg, resJson });
            const err = new Error(errorMsg);
            err.status = response.status;
            err.details = resJson;
            throw err;
         }

         return resJson?.data ?? resJson;
      } catch (err) {
         if (err.name === 'AbortError') {
            logError('EMISSO_TIMEOUT', { toolName });
            throw new Error('Tiempo de espera agotado al conectar con Emisso Connect');
         }
         throw err;
      }
   }

   // 1. Obtener estado de las conexiones activas
   async getConnectionsStatus(connectionId = null) {
      const input = connectionId ? { conexionId: connectionId } : {};
      return this.#executeTool('conexiones.estado.consultar', input);
   }

   // 2. Crear un enlace hosted para conectar un nuevo sistema (un solo uso)
   async createConnectionLink({ system, rut = null, redirectUrl = null }) {
      const input = { sistema: system };
      if (rut) input.rut = rut;
      if (redirectUrl) input.redirectUrl = redirectUrl;
      return this.#executeTool('conexiones.enlace.crear', input);
   }

   // 3. Solicitar sincronizacion en vivo de un banco
   async syncBankConnection(system = 'bch_empresas', connectionId, scopes = ['saldos', 'movimientos']) {
      return this.#executeTool(`${system}.conexion.sincronizar`, { alcances: scopes }, connectionId);
   }

   // 4. Consultar saldos y cuentas disponibles de una conexion
   async getBalances(system = 'bch_empresas', connectionId) {
      const tool = system === 'bch_empresas'
         ? 'bch_empresas.saldos.consultar_v2'
         : `${system}.saldos.consultar`;
      return this.#executeTool(tool, {}, connectionId);
   }

   // 5. Consultar movimientos sincronizados para un periodo (AAAA-MM)
   async getMovements(system = 'bch_empresas', connectionId, period = null, cursor = null) {
      const input = {};
      if (period) input.periodo = period;
      if (cursor) input.cursor = cursor;

      return this.#executeTool(`${system}.movimientos.consultar`, input, connectionId);
   }

   // 6. Obtener todos los movimientos paginados de un periodo
   async getAllMovements(system = 'bch_empresas', connectionId, period = null) {
      const allRows = [];
      let cursor = null;
      let page = 0;
      const maxPages = 50;

      do {
         page++;
         const response = await this.getMovements(system, connectionId, period, cursor);
         const rows = response?.movimientos || response?.items || (Array.isArray(response) ? response : []);
         allRows.push(...rows);
         cursor = response?.cursor || null;
      } while (cursor && page < maxPages);

      return allRows;
   }
}

module.exports = EmissoService;
