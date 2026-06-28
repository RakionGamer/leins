module.exports = {
   apps: [
      // -----------------------------------------------------------------------
      // 1. api principal
      // ejecucion: proceso permanente
      // objetivo: levantar el backend http de leinsadvisor
      // -----------------------------------------------------------------------
      {
         name: "leinsadvisor-api",
         script: "server.js",
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: true,
         max_memory_restart: "1G",
         time: true,
         out_file: "logs/api.log",
         error_file: "logs/api-err.log",
         merge_logs: true,
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 2. mantenimiento (limpieza previa)
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
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 3. auditoria anual dte (compras)
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
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 4. auditoria anual facturas de venta
      // ejecucion: solo domingos a las 03:00 am (1 hora despues de dte)
      // objetivo: descarga masiva de facturas de venta afectas y exentas del ano
      // -----------------------------------------------------------------------
      {
         name: "sii-sales-invoices-audit",
         script: "scripts/sii-ventas-facturas-consult.js",
         args: "--month ALL --types=33,34",
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "0 3 * * 0",
         max_memory_restart: "1G",
         out_file: "logs/sii-sales-invoices-audit.log",
         error_file: "logs/sii-sales-invoices-audit-err.log",
         merge_logs: true,
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 5. auditoria anual boletas
      // ejecucion: solo domingos a las 04:00 am (1 hora despues de facturas de venta)
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
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 6. barrido diario dte (compras)
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
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 7. barrido diario facturas de venta
      // ejecucion: todos los dias a las 05:15 am (15 min despues de dte)
      // objetivo: traer facturas de venta afectas y exentas del mes actual
      // -----------------------------------------------------------------------
      {
         name: "sii-sales-invoices-daily",
         script: "scripts/sii-ventas-facturas-consult.js",
         args: "--types=33,34",
         exec_mode: "fork",
         instances: 1,
         watch: false,
         autorestart: false,
         time: true,
         cron_restart: "15 5 * * *",
         max_memory_restart: "1G",
         out_file: "logs/sii-sales-invoices-daily.log",
         error_file: "logs/sii-sales-invoices-daily-err.log",
         merge_logs: true,
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      },

      // -----------------------------------------------------------------------
      // 8. barrido diario boletas
      // ejecucion: todos los dias a las 05:30 am (15 min despues de facturas)
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
         env: {
            NODE_ENV: "production",
            TZ: "America/Santiago",
            SII_DOWNLOAD_DIR: "/tmp/leins-sii-downloads"
         }
      }
   ]
}
