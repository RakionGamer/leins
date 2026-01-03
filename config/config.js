require('dotenv').config();

const config = {
   env: process.env.NODE_ENV || 'dev',
   port: process.env.PORT || 3000,
   dbUser: process.env.DB_USER,
   dbPassword: process.env.DB_PASSWORD,
   dbHost: process.env.DB_HOST,
   dbName: process.env.DB_NAME,
   dbPort: process.env.DB_PORT,
   jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'access-secret-dev',
   jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'refresh-secret-dev',
   jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || '30s',
   jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || '30d',
   tz: process.env.TZ || 'America/Santiago',
   maxActiveSessions: parseInt(process.env.MAX_ACTIVE_SESSIONS || '5', 10),
   mysqlAesKey: process.env.MYSQL_AES_KEY || 'dev_only_key_cambia_esto',
}

module.exports = {
   config
}
