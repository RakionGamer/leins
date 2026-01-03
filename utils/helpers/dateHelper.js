const { DateTime } = require('luxon');
const { config } = require('./../../config/config');

// Convierte una fecha JS a hora de Santiago con formato YYYY-MM-DD HH:mm:ss
function formatToSantiago(date = new Date()) {
   return DateTime.fromJSDate(date)
      .setZone(config.tz)
      .toFormat('yyyy-MM-dd HH:mm:ss');
}

// exporta funcion
module.exports = { formatToSantiago };
