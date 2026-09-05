"use strict";

// este envoltorio atrapa cualquier error asincrono y lo pasa al middleware de errores (next)
// asi evitamos escribir try/catch en todos los controladores
const asyncHandler = (fn) => (req, res, next) => {
   Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;