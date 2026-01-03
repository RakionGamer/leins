// comentarios en minusculas y sin acentos
exports.logInfo = (tag, payload = {}) =>
   console.info(JSON.stringify({ tag, ts: new Date().toISOString(), ...payload }));
exports.logWarn = (tag, payload = {}) =>
   console.warn(JSON.stringify({ tag, ts: new Date().toISOString(), ...payload }));
exports.logError = (tag, payload = {}) =>
   console.error(JSON.stringify({ tag, ts: new Date().toISOString(), ...payload }));