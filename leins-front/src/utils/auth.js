// src/utils/auth.js

const ACCESS_KEY = 'accessToken';
const REFRESH_KEY = 'refreshToken';
const USER_KEY = 'user';

export function saveTokens({ accessToken, refreshToken, user }) {
   if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
   if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
   if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function setStoredUser(user) {
   if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getStoredUser() {
   try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
   } catch {
      return null;
   }
}

export function getAccessToken() {
   return localStorage.getItem(ACCESS_KEY) || null;
}

export function getRefreshToken() {
   return localStorage.getItem(REFRESH_KEY) || null;
}

export function clearTokens() {
   localStorage.removeItem(ACCESS_KEY);
   localStorage.removeItem(REFRESH_KEY);
   localStorage.removeItem(USER_KEY);
}

export function logout() {
   clearTokens();
   // propaga a otras pestañas
   try {
      localStorage.setItem('logout', String(Date.now()));
   } catch { }
}

const ROLE_KEY = 'authRole';

// se guarda aparte de accessToken/refreshToken/user porque debe sobrevivir a clearTokens():
// privateroute lo necesita para decidir a que login redirigir tras un logout o refresh fallido
export function setAuthRole(role) {
   if (role) localStorage.setItem(ROLE_KEY, role);
   else localStorage.removeItem(ROLE_KEY);
}

export function getAuthRole() {
   return localStorage.getItem(ROLE_KEY) || null;
}

export function decodeJwt(token) {
   try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(decodeURIComponent(escape(atob(base64))));
      return payload || null;
   } catch {
      return null;
   }
}

export function isTokenValid(skewSeconds = 90) {
   const token = getAccessToken();
   if (!token) return false;
   const payload = decodeJwt(token);
   if (!payload?.exp) return false;
   const now = Math.floor(Date.now() / 1000);
   return payload.exp - skewSeconds > now;
}