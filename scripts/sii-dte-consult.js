#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { DateTime } = require("luxon");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });
const { loadCsvEntitySiiDocumentsAny } = require("../loaders/entitySiiDocumentsAny");

const {
   SII_URLS,
   loginSII,
   getYearMonthPair,
   fetchCredentials,
   ensureDir,
   createBrowser,
   preparePage,
   navigatePages,
   fillComprasVentasForm,
   ensureDownloadHooks,
   clickAndDownload,
   sleep,
   isFuturePeriod,
   arg,
   parseTypes,
   monthsOfYear,
} = require("../libs/functions");

const aesKey = process.env.MYSQL_AES_KEY;
const CL_TZ = process.env.SII_TZ || "America/Santiago";

// CONCURRENCIA: 1 es lo mas seguro. Subir si tienes mucha RAM.
const MAX_CONCURRENCY = 3;

const run = async ({ entityId = null, year: inYear = null, month: inMonth = null } = {}) => {
   console.log("🚀 Iniciando servicio de consulta SII (Compras/Ventas)");

   // -----------------------------------------------------------------------
   // 1. CONFIGURACION DE FECHAS
   // -----------------------------------------------------------------------
   const now = DateTime.now().setZone(CL_TZ);

   const getArgValue = (flag) => {
      const idx = process.argv.indexOf(`--${flag}`);
      return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
   };

   // Prioridad: API > Argumento > arg() > Fecha actual
   const yearInput = inYear || getArgValue("year") || arg("year", now.toFormat("yyyy"));
   const monthInput = inMonth || getArgValue("month") || arg("month", now.toFormat("MM"));

   // Deteccion de modo anual
   const fullYear = !inMonth && (String(monthInput).toUpperCase() === "ALL" || process.argv.includes("--fullYear"));

   const { year, month } = getYearMonthPair(yearInput, fullYear ? "01" : monthInput);

   // Validacion de futuro
   if (!fullYear && isFuturePeriod(year, month, CL_TZ)) {
      console.warn(`⏭️ El período ${year}-${month} es futuro. Cancelando.`);
      return { ok: false, message: "Periodo futuro" };
   }

   console.log(`▶ Modo: ${fullYear ? "📅 AUDITORÍA ANUAL" : "⚡ CARGA DIARIA"}`);
   console.log(`▶ Objetivo: ${fullYear ? `Año ${year}` : `${year}-${month}`}`);

   // -----------------------------------------------------------------------
   // 2. PREPARACIÓN Y CREDENCIALES
   // -----------------------------------------------------------------------
   if (!aesKey) { console.error("❌ Falta MYSQL_AES_KEY"); process.exit(2); }

   let siiCreds = await fetchCredentials({ type: "SII", aesKey });

   // Filtro por entityId si viene de la API
   if (entityId) {
      siiCreds = siiCreds.filter(c => String(c.entity_id) === String(entityId));
      if (!siiCreds.length) return { ok: false, message: "Sin credenciales" };
   }

   console.log(`👥 Empresas a procesar: ${siiCreds.length}`);
   if (!siiCreds.length) return { ok: true, count: 0 };

   const onlyTypes = parseTypes(arg("types", ""));

   // 3. Inicio Navegador
   console.log("🔌 Iniciando navegador base...");
   const browser = await createBrowser();
   const statsReport = { processed: 0, details: [] };

   try {
      const processEntity = async (creds) => {
         const label = `${creds.legal_name || 'Empresa'} (${creds.rut_sin_dv})`;
         const context = await browser.createBrowserContext();
         const page = await context.newPage();

         try {
            console.log(`🔷 Procesando: ${label}`);

            const baseDownloads = path.resolve(__dirname, "downloads");
            const downloadDir = fullYear
               ? path.join(baseDownloads, String(creds.entity_id), String(year))
               : path.join(baseDownloads, String(creds.entity_id));

            await ensureDir(downloadDir);

            await preparePage(page, {
               downloadDir: downloadDir,
               navTimeout: 60000,
               defaultTimeout: 60000,
               blockResources: true
            });

            await ensureDownloadHooks(page, downloadDir);

            // Login
            let logged = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
               try {
                  await loginSII(page, creds.rut_sin_dv, creds.dv, creds.clave);
                  logged = true; break;
               } catch (e) { await sleep(2000); }
            }
            if (!logged) throw new Error("Fallo login tras 3 intentos");

            // Navegacion
            await navigatePages(page, [SII_URLS.comprasventas], {
               lastSelector: 'form[name="formContribuyente"]'
            });

            const monthsList = fullYear ? monthsOfYear(year) : [{ year, month }];

            for (const { month: mm } of monthsList) {
               if (isFuturePeriod(year, mm)) {
                  if (fullYear) console.log(`   ⏭️ Fin anual en ${year}-${mm} (Futuro)`);
                  break;
               }

               // Llenar formulario
               await fillComprasVentasForm(page, {
                  rut: `${creds.rut_sin_dv}-${creds.dv}`,
                  mes: mm,
                  anho: year,
                  timeout: 60000
               });

               // --- [LIMPIEZA] Borrar versiones previas ---
               try {
                  const pattern = `Detalle_${year}${mm}`;
                  const files = fs.readdirSync(downloadDir);
                  files.forEach(f => {
                     if (f.endsWith('.crdownload') || (f.includes(pattern) && f.endsWith('.csv'))) {
                        fs.unlinkSync(path.join(downloadDir, f));
                     }
                  });
               } catch (eClean) { /* ignorar */ }

               // Descargar
               const file = await clickAndDownload(
                  page,
                  "//button[contains(., 'Descargar Detalles')]",
                  downloadDir,
                  { timeout: 90000, nameHint: `Detalle_${year}${mm}` }
               );

               if (file) {
                  // Carga BD
                  const res = await loadCsvEntitySiiDocumentsAny(file, {
                     entityId: creds.entity_id,
                     year,
                     month: mm,
                     onlyTypes
                  });
                  console.log(`   ✅ [${year}-${mm}] Procesado: ${res.totals.inserted} nuevos.`);
                  statsReport.processed += res.totals.inserted;
               } else {
                  console.log(`   ⚠️ [${year}-${mm}] No se descargo archivo.`);
               }

               if (fullYear) await sleep(1000);
            }

         } catch (err) {
            console.error(`❌ Error ${label}: ${err.message}`);
            throw err;
         } finally {
            await context.close();
         }
      };

      // Ejecucion por lotes (si estamos en API con entityId, solo hay 1)
      for (let i = 0; i < siiCreds.length; i += MAX_CONCURRENCY) {
         const chunk = siiCreds.slice(i, i + MAX_CONCURRENCY);
         await Promise.all(chunk.map(c => processEntity(c)));
      }

      return { ok: true, stats: statsReport };

   } finally {
      console.log("🔌 Finalizado.");
      await browser.close();
   }
};

// AUTO-EJECUCIÓN (CLI)
if (require.main === module) {
   run().catch(err => {
      console.error("FATAL:", err);
      process.exit(1);
   });
}

// EXPORTACIÓN (API)
module.exports = {
   runManualSync: (entityId, year, month) => run({ entityId, year, month })
};