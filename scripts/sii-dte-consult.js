#!/usr/bin/env node
"use strict";

const path = require("path");
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

(async () => {
   console.log("🚀 iniciando flujo ");

   // ▶ período: por flags/ENV, conservando tu helper
   const yearArg = arg("year", "2025");

   // Usa un mes numerico por defecto (p.ej. "07").
   const monthArgRaw = arg("month", "ALL"); // "ALL" para ano completo

   // Flag para año completo
   const fullYear = String(monthArgRaw).toUpperCase() === "ALL" || process.argv.includes("--fullYear");

   // Solo pasa mes numerico a getYearMonthPair.
   // Si es year completo, usa "01" como dummy para inicializar.
   const { year, month } = getYearMonthPair(yearArg, fullYear ? "01" : monthArgRaw);

   // despues de obtener { year, month } y de calcular fullYear:
   if (!fullYear && isFuturePeriod(year, month, CL_TZ)) {
      console.warn(`⏭️ ${year}-${month} es futuro respecto a hoy en ${CL_TZ}. No hay datos que descargar.`);
      process.exit(0);
   }

   console.log(`▶ período: ${year}-${month} ${fullYear ? "(modo año completo)" : ""}`);
   if (!aesKey) { console.error("Falta MYSQL_AES_KEY"); process.exit(2); }

   const siiCreds = await fetchCredentials({ type: "SII", aesKey });
   console.log(`👥 entidades con credenciales SII válidas: ${siiCreds.length}`);
   if (!siiCreds.length) { console.error("no hay credenciales SII disponibles"); process.exitCode = 2; return; }

   const onlyTypes = parseTypes(arg("types", ""));

   for (const creds of siiCreds) {
      console.log(`—— entidad #${creds.entity_id} ${creds.legal_name} (${creds.tax_id}) ——`);

      const baseDownloads = path.resolve(__dirname, "downloads");
      // si es año completo, agrupo por año; si no, dejo igual que tenías
      const downloadDir = fullYear
         ? path.join(baseDownloads, String(creds.entity_id), String(year))
         : path.join(baseDownloads, String(creds.entity_id));

      const absDownloadDir = await ensureDir(downloadDir);

      const browser = await createBrowser();
      const page = await browser.newPage();

      // acumulador anual por tipo (para el resumen final por entidad)
      const annualByType = {};

      try {
         
         await preparePage(page, {
            downloadDir: absDownloadDir,
            navTimeout: 90_000,
            defaultTimeout: 90_000,
            acceptLanguage: "es-CL,es;q=0.9,en;q=0.8",
            blockResources: true,
         });

         // inicia sesion en SII
         await ensureDownloadHooks(page, absDownloadDir); // una sola vez por page
         await loginSII(page, creds.rut_sin_dv, creds.dv, creds.clave);

         // navega la pagina hasta encontrar 'formContribuyente'
         await navigatePages(page, [SII_URLS.comprasventas], {
            lastSelector: 'form[name="formContribuyente"]'
         });

         // --- aquí la única diferencia: loop de meses si se pidió año completo ---
         const monthsList = fullYear ? monthsOfYear(year) : [{ year, month }];

         for (const { month: mm } of monthsList) {

            if (isFuturePeriod(year, mm)) {
               console.warn(`⏭️ ${year}-${mm} es futuro respecto a hoy en ${CL_TZ}. Deteniendo el año aquí.`);
               break;
            }

            console.log(`📅 Procesando período: ${year}-${mm}`);

            // filtra formulario
            await fillComprasVentasForm(page, {
               rut: `${creds.rut_sin_dv}-${creds.dv}`,
               mes: mm,
               anho: year,
               timeout: 120_000,
            });

            // descarga archivo
            const file = await clickAndDownload(
               page,
               "//button[contains(., 'Descargar Detalles')]",
               absDownloadDir,
               { timeout: 120_000, nameHint: `Detalle_${year}${mm}` }
            );

            if (file) {
               const res = await loadCsvEntitySiiDocumentsAny(file, {
                  entityId: creds.entity_id,
                  year,
                  month: mm,
                  // onlyTypes: [33,34,61], // opcional
                  onlyTypes,
               });

               // Mensaje por tipo (insertados)
               for (const [tipo, stats] of Object.entries(res.byType)) {
                  // mensaje por mes (tal como pediste antes)
                  if (stats.inserted) {
                     console.log(`🟢 [${year}-${mm}] Se insertaron ${stats.inserted} reportes de tipo ${tipo}.`);
                  }
                  // acumula anual
                  annualByType[tipo] ??= { processed: 0, inserted: 0, updated: 0, skipped: 0 };
                  annualByType[tipo].processed += (stats.processed || 0);
                  annualByType[tipo].inserted += (stats.inserted || 0);
                  annualByType[tipo].updated += (stats.updated || 0);
                  annualByType[tipo].skipped += (stats.skipped || 0);
               }

               // Resumen general del mes
               console.log(`📊 [${year}-${mm}] Procesados: ${res.totals.processed}, Insertados: ${res.totals.inserted}, Actualizados: ${res.totals.updated}, Saltados: ${res.totals.skipped}`);
            } else {
               console.warn(`⚠️ [${year}-${mm}] No hubo archivo (quizá sin movimientos).`);
            }

            // pequeña espera entre meses (anti-rate limit)
            if (fullYear) await sleep(1200 + Math.floor(Math.random() * 600));
         }

         // Resumen anual por tipo (solo si se pidió año completo)
         if (fullYear) {
            console.log(`\n📦 Resumen anual ${year} - entidad #${creds.entity_id}`);
            let totalIns = 0, totalUpd = 0, totalProc = 0, totalSkp = 0;
            for (const [tipo, st] of Object.entries(annualByType)) {
               console.log(`• Tipo ${tipo}: procesados ${st.processed}, insertados ${st.inserted}, actualizados ${st.updated}, saltados ${st.skipped}`);
               totalIns += st.inserted; totalUpd += st.updated; totalProc += st.processed; totalSkp += st.skipped;
            }
            console.log(`➡️ Totales anuales — Procesados: ${totalProc}, Insertados: ${totalIns}, Actualizados: ${totalUpd}, Saltados: ${totalSkp}\n`);
         }

         console.log(`Fin del proceso para entidad #${creds.entity_id}\n\n`);

      } catch (err) {
         console.log(err);

         console.error("❌ error en entidad", creds.entity_id, "-", err && err.message ? err.message : err);
         process.exitCode = 1;
      } finally {
         await browser.close();
      }
   }
})();