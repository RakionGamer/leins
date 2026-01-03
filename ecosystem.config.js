module.exports = {
   apps: [
      {
         name: "cleanup-refresh-tokens",
         script: "scripts/cleanup-refresh-tokens.js",
         exec_mode: "fork",
         instances: 1,
         cron_restart: "15 3 * * *",
         autorestart: false,
         time: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      },
      {
         name: "cron:sii-dte-consult",           // <- nuevo nombre del proceso
         script: "scripts/sii-dte-consult.js",    // <- nueva ruta del script
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "10 3 * * *",
         out_file: "logs/sii-dte-consult-out.log",
         error_file: "logs/sii-dte-consult-err.log",
         merge_logs: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      }
   ]
}