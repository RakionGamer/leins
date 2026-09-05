import env from '../env';

// Aseguramos que la URL termine en /v1
// Si env.apiUrl es "https://api.leinsadvisor.cl/api", le agregamos "/v1"
const RAW_URL = (env?.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const API_BASE = RAW_URL.includes('/v1') ? RAW_URL : `${RAW_URL}/v1`;

// Helper interno
async function apiFetch(path, { token, ...options } = {}) {
   const res = await fetch(`${API_BASE}${path}`, {
      headers: {
         'Content-Type': 'application/json',
         ...(token ? { Authorization: `Bearer ${token}` } : {}),
         ...(options.headers || {}),
      },
      ...options,
   });

   let payload;
   try {
      payload = await res.json();
   } catch {
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      return null;
   }

   if (!res.ok) {
      const message = payload?.message || payload?.error || `Error HTTP ${res.status}`;
      // Creamos un objeto Error real con propiedades extra
      const error = new Error(message);
      error.status = res.status;
      error.code = payload?.code;
      throw error;
   }

   return payload;
}

// 1. Login Inicial
export async function loginUser({ username, password }) {
   const payload = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
   });

   const data = payload?.data ?? payload;

   // CASO 2FA: Si el backend pide código, retornamos esto sin buscar accessToken
   if (data?.require2fa) {
      return {
         require2fa: true,
         userId: data.userId,
         message: data.message
      };
   }

   // CASO NORMAL: Validamos token
   if (!data?.accessToken) {
      throw new Error('La respuesta del login no contiene accessToken');
   }

   return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
   };
}

// 1b. Login de clientes (cuentas de autogestion por entidad)
export async function loginClient({ username, password }) {
   const payload = await apiFetch('/auth/client/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
   });

   const data = payload?.data ?? payload;

   if (!data?.accessToken) {
      throw new Error('La respuesta del login no contiene accessToken');
   }

   return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      user: data.user,
   };
}

// 2. Verificar Código 2FA en Login (Nuevo)
export async function verifyLogin2FA(userId, token) {
   const payload = await apiFetch('/auth/2fa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ userId, token }),
   });
   
   const data = payload?.data ?? payload;
   return data; // Retorna { accessToken, refreshToken, user }
}

// Renovación de tokens
export async function refreshTokens({ userId, refreshToken, expiredAccessToken } = {}) {
   const rt = refreshToken || localStorage.getItem('refreshToken');
   const at = expiredAccessToken || localStorage.getItem('accessToken');
   let uid = userId;
   if (!uid) {
      try {
         const userRaw = localStorage.getItem('user');
         if (userRaw) uid = JSON.parse(userRaw)?.id;
      } catch { }
   }

   if (!rt) throw new Error('No hay refreshToken disponible');

   const payload = await apiFetch('/auth/refresh', {
      method: 'POST',
      token: at,
      body: JSON.stringify({ refreshToken: rt, ...(uid ? { userId: uid } : {}) }),
   });

   const data = payload?.data ?? payload;

   if (data?.code === 'REFRESH_INVALID' || data?.code === 'REFRESH_REPLAY') {
      const err = new Error(data?.code || 'refresh_error');
      err.code = data.code;
      throw err;
   }

   if (!data?.accessToken) {
      throw new Error('La respuesta del refresh no contiene accessToken');
   }

   return {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken ?? rt,
   };
}

// Recuperación de contraseña
export async function requestPasswordRecovery(email) {
   return apiFetch('/auth/recovery', {
      method: 'POST',
      body: JSON.stringify({ email }),
   });
}

export async function resetPassword({ token, id, newPassword }) {
   return apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, id, newPassword }),
   });
}