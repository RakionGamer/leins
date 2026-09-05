// src/env.js
// comentarios en minusculas y sin acentos

// leer variables
const raw = {
   apiUrl: import.meta.env.VITE_API_URL,
   nodeEnv: import.meta.env.MODE,
   publicUrl: import.meta.env.BASE_URL,
};

// construir config tipada
const env = {
   apiUrl: raw.apiUrl ?? 'https://api.leinsadvisor.cl/api',
   nodeEnv: raw.nodeEnv || 'development',
   isDev: raw.nodeEnv === 'development',
   isProd: raw.nodeEnv === 'production',
   publicUrl: raw.publicUrl || '/',
};

// validaciones minimas
if (!env.apiUrl) {
   const msg = 'vite_api_url no definida; revisa tu .env.*';
   if (env.isProd) {
      // en prod preferible lanzar error temprano
      throw new Error(msg);
   } else {
      // en dev solo avisar en consola
      // eslint-disable-next-line no-console
      console.warn(msg);
   }
}

// congelar para evitar mutaciones en runtime
export default Object.freeze(env);
