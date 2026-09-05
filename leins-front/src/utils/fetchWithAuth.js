import { getAccessToken, getRefreshToken, saveTokens, logout, getStoredUser } from '../utils/auth';
import { refreshTokens } from '../services/auth';
import env from '../env';

const API_BASE = env.apiUrl + '/v1';

// variables para controlar multiples peticiones simultaneas
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
   failedQueue.forEach(prom => {
      if (error) {
         prom.reject(error);
      } else {
         prom.resolve(token);
      }
   });
   failedQueue = [];
};

export async function fetchWithAuth(path, options = {}) {
   const url = path.startsWith('http') ? path : `${API_BASE}${path}`;

   let token = getAccessToken();
   let res = await doFetch(url, token, options);

   // si el servidor nos confirma que el token murio (401)
   if (res.status === 401) {

      // 1. si soy la primera peticion, cierro la puerta y voy a refrescar
      if (!isRefreshing) {
         isRefreshing = true;
         try {
            const { accessToken, refreshToken } = await refreshTokens({
               userId: getStoredUser()?.id || getStoredUser()?.userId,
               refreshToken: getRefreshToken(),
               expiredAccessToken: getAccessToken(),
            });

            saveTokens({ accessToken, refreshToken });
            isRefreshing = false;

            // le aviso a todos los que estaban esperando y les doy el nuevo token
            processQueue(null, accessToken);

            // reintento mi propia peticion original
            return doFetch(url, accessToken, options);

         } catch (err) {
            // si el refresh fallo (ej. el refresh token tambien expiro)
            isRefreshing = false;
            processQueue(err, null);
            logout(); // destruyo la sesion
            throw new Error('Sesión expirada. Por favor, inicia sesión nuevamente.');
         }
      }

      // 2. si alguien mas ya esta refrescando, me pongo en la fila de espera
      return new Promise((resolve, reject) => {
         failedQueue.push({
            resolve: (newToken) => resolve(doFetch(url, newToken, options)),
            reject: (err) => reject(err)
         });
      });
   }

   return res;
}

async function doFetch(url, token, options) {
   const headers = { ...options.headers };

   if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
   }

   if (token) {
      headers['Authorization'] = `Bearer ${token}`;
   }

   return fetch(url, { ...options, headers });
}