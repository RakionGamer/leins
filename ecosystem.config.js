module.exports = {
   apps: [
      // -----------------------------------------------------------------------
      // 1. mantenimiento (limpieza previa)
      // ejecucion: todos los dias a las 01:15 am
      // objetivo: limpiar tokens viejos antes de iniciar los procesos
      // -----------------------------------------------------------------------
      {
         name: "cleanup-tokens",
         script: "scripts/cleanup-refresh-tokens.js",
         exec_mode: "fork",
         instances: 1,
         cron_restart: "15 1 * * *",
         autorestart: false,
         time: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      },

      // -----------------------------------------------------------------------
      // 2. auditoria anual dte (facturas/compras/ventas)
      // ejecucion: solo domingos a las 02:00 am
      // objetivo: revision profunda de todo el ano en curso
      // -----------------------------------------------------------------------
      {
         name: "sii-dte-audit",
         script: "scripts/sii-dte-consult.js",
         args: "--month ALL",
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "0 2 * * 0",
         max_memory_restart: "1G",
         out_file: "logs/sii-dte-audit.log",
         error_file: "logs/sii-dte-audit-err.log",
         merge_logs: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      },

      // -----------------------------------------------------------------------
      // 3. auditoria anual boletas
      // ejecucion: solo domingos a las 04:00 am (2 horas despues de dte)
      // objetivo: descarga masiva de boletas de todo el ano
      // -----------------------------------------------------------------------
      {
         name: "sii-boletas-audit",
         script: "scripts/sii-boletas-consult.js",
         args: "--month ALL",
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "0 4 * * 0",
         max_memory_restart: "1G",
         out_file: "logs/sii-boletas-audit.log",
         error_file: "logs/sii-boletas-audit-err.log",
         merge_logs: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      },

      // -----------------------------------------------------------------------
      // 4. barrido diario dte (facturas/compras/ventas)
      // ejecucion: todos los dias a las 05:00 am
      // objetivo: traer solo lo del mes actual para el dia a dia
      // -----------------------------------------------------------------------
      {
         name: "sii-dte-daily",
         script: "scripts/sii-dte-consult.js",
         // sin args: detecta automaticamente el mes actual
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "0 5 * * *",
         max_memory_restart: "1G",
         out_file: "logs/sii-dte-daily.log",
         error_file: "logs/sii-dte-daily-err.log",
         merge_logs: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      },

      // -----------------------------------------------------------------------
      // 5. barrido diario boletas
      // ejecucion: todos los dias a las 05:30 am (30 min despues de dte)
      // objetivo: traer boletas del mes actual
      // -----------------------------------------------------------------------
      {
         name: "sii-boletas-daily",
         script: "scripts/sii-boletas-consult.js",
         // sin args: detecta automaticamente el mes actual
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "30 5 * * *",
         max_memory_restart: "1G",
         out_file: "logs/sii-boletas-daily.log",
         error_file: "logs/sii-boletas-daily-err.log",
         merge_logs: true,
         env: { NODE_ENV: "production", TZ: "America/Santiago" }
      }
   ]
}