#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { createGunzip } = require("zlib");
const { pipeline } = require("stream/promises");
const { DateTime } = require("luxon");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

// importamos e instanciamos el nuevo servicio unificado
const SiiLoaderService = require("../services/sii-loader.service");
const loaderService = new SiiLoaderService();

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
   sleep,
   isFuturePeriod,
   arg,
   monthsOfYear,
} = require("../libs/functions");

const aesKey = process.env.MYSQL_AES_KEY;
const CL_TZ = process.env.SII_TZ || "America/Santiago";

const run = async ({ entityId = null, year: inYear = null, month: inMonth = null } = {}) => {
   console.log("🚀 iniciando servicio de boletas sii");

   const now = DateTime.now().setZone(CL_TZ);

   const getArgValue = (flag) => {
      const idx = process.argv.indexOf(`--${flag}`);
      return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
   };

   const yearInput = inYear || getArgValue("year") || arg("year", now.toFormat("yyyy"));
   const monthInput = inMonth || getArgValue("month") || arg("month", now.toFormat("MM"));

   const fullYear = !inMonth && (String(monthInput).toUpperCase() === "ALL" || process.argv.includes("--fullYear"));

   const { year, month } = getYearMonthPair(yearInput, fullYear ? "01" : monthInput);

   console.log(`▶ modo: ${fullYear ? "📅 auditoria anual" : "⚡ carga mensual"}`);
   console.log(`▶ objetivo: ${fullYear ? `año ${year}` : `${year}-${month}`}`);

   if (!fullYear && isFuturePeriod(year, month, CL_TZ)) {
      console.warn(`⏭️ periodo futuro ${year}-${month}. cancelando.`);
      return { ok: false, message: "Periodo futuro" };
   }

   if (!aesKey) { console.error("❌ falta mysql_aes_key"); process.exit(2); }

   let siiCreds = await fetchCredentials({ type: "SII", aesKey });

   if (entityId) {
      siiCreds = siiCreds.filter(c => String(c.entity_id) === String(entityId));
      if (!siiCreds.length) {
         console.error(`❌ No se encontraron credenciales para entityId ${entityId}`);
         return { ok: false, message: "Sin credenciales" };
      }
   } else {
      const rutsVistos = new Set();
      siiCreds = siiCreds.filter(c => {
         const key = `${c.rut_sin_dv}`;
         if (rutsVistos.has(key)) return false;
         rutsVistos.add(key);
         return true;
      });
   }

   if (!siiCreds.length) { console.log("⚠️ no hay credenciales activas."); return { ok: true, count: 0 }; }

   console.log("🔌 iniciando navegador...");
   const browser = await createBrowser();

   const statsReport = { processed: 0, errors: [] };

   try {
      const processEntity = async (creds) => {
         const label = `${creds.legal_name || 'Empresa'} (${creds.rut_sin_dv})`;
         const context = await browser.createBrowserContext();
         const page = await context.newPage();

         try {
            console.log(`🔷 procesando: ${label}`);

            const baseDownloads = path.resolve(__dirname, "downloads");
            const entityDir = path.join(baseDownloads, String(creds.entity_id), String(year));
            await ensureDir(entityDir);

            await preparePage(page, { downloadDir: entityDir, navTimeout: 60000, blockResources: true });

            let logged = false;
            for (let i = 1; i <= 3; i++) {
               try {
                  await loginSII(page, creds.rut_sin_dv, creds.dv, creds.clave);
                  logged = true; break;
               } catch (e) { await sleep(2000); }
            }
            if (!logged) throw new Error("fallo login tras 3 intentos");

            await navigatePages(page, [SII_URLS.comprasventas], { lastSelector: 'form[name="formContribuyente"]' });

            const monthsList = fullYear ? monthsOfYear(year) : [{ year, month }];

            for (const { month: mm } of monthsList) {
               if (isFuturePeriod(year, mm, CL_TZ)) {
                  if (fullYear) console.log(`   ⏭️ deteniendo anual en ${year}-${mm} (es futuro)`);
                  break;
               }

               console.log(`📅 periodo ${year}-${mm}...`);

               try {
                  await fillComprasVentasForm(page, {
                     rut: `${creds.rut_sin_dv}-${creds.dv}`,
                     mes: mm,
                     anho: year,
                     timeout: 60000
                  });

                  const selectorVentas = "#my-wrapper > div.web-sii.cuerpo > div.container > div:nth-child(1) > div > div:nth-child(2) > ul > li:nth-child(2) > a > strong";
                  try {
                     await page.waitForSelector(selectorVentas, { timeout: 30000 });
                     await page.evaluate(sel => document.querySelector(sel)?.click(), selectorVentas);
                     await sleep(5000);
                  } catch (e) { console.warn("⚠️ pestana ventas ya activa o no encontrada."); }

                  const selectorBoletas = "button[ng-click*='3941']";
                  const boletasBtn = await page.waitForSelector(selectorBoletas, { visible: true, timeout: 15000 });

                  await page.evaluate(() => {
                     document.querySelectorAll('#esperaDialog, .modal-backdrop, .block-ui-wrapper').forEach(el => el.remove());
                  });

                  await page.evaluate(el => el.click(), boletasBtn);
                  console.log("⚡ solicitud enviada.");

                  console.log("🔎 esperando modal 'ver detalles'...");
                  await page.waitForSelector(".modal-content", { visible: true, timeout: 15000 });

                  await page.evaluate(() => {
                     const btn = document.querySelector(".modal-content .btn-primary");
                     if (btn) btn.click();
                  });
                  console.log("✅ confirmado. verificando estado...");

                  await sleep(2000);
                  const alertaVigente = await page.evaluate(() => {
                     const m = document.querySelector("#alert-modal");
                     return m && (m.classList.contains('in') || m.style.display === 'block');
                  });

                  if (alertaVigente) {
                     console.log("⚠️ aviso: descarga ya vigente. cerrando modal...");
                     await page.evaluate(() => {
                        const btnCerrar = document.querySelector("#alert-modal .btn-danger");
                        if (btnCerrar) btnCerrar.click();
                     });
                     await sleep(1000);
                  }

                  console.log("⏳ esperando generacion de archivo (boton final)...");

                  const selectorDescargaFinal = "button[ng-click*='bajarArchivo']";

                  try {
                     const btnFinal = await page.waitForSelector(selectorDescargaFinal, { visible: true, timeout: 90000 });

                     try {
                        const archivosExistentes = fs.readdirSync(entityDir);
                        archivosExistentes.forEach(f => {
                           if (f.endsWith('.gz') || f.endsWith('.crdownload')) {
                              fs.unlinkSync(path.join(entityDir, f));
                           }
                        });
                     } catch (errClean) { /* ignorar */ }

                     const filesBefore = fs.readdirSync(entityDir);

                     await page.evaluate(el => el.click(), btnFinal);
                     console.log("⬇️ clic final realizado. monitoreando...");

                     let newFile = null;
                     for (let w = 0; w < 60; w++) {
                        await sleep(1000);
                        const filesAfter = fs.readdirSync(entityDir);
                        newFile = filesAfter.find(f => !filesBefore.includes(f) && !f.endsWith('.crdownload'));
                        if (newFile) break;
                     }

                     if (newFile) {
                        let finalPath = path.join(entityDir, newFile);
                        console.log(`✅ archivo descargado: ${newFile}`);

                        if (newFile.endsWith(".gz")) {
                           console.log("🗜️ descomprimiendo...");
                           const csvName = newFile.replace(/\.gz$/, "");
                           const destPath = path.join(entityDir, csvName.endsWith(".csv") ? csvName : csvName + ".csv");

                           await pipeline(
                              fs.createReadStream(finalPath),
                              createGunzip(),
                              fs.createWriteStream(destPath)
                           );
                           finalPath = destPath;
                        }

                        // usamos el nuevo servicio asegurando solo tipos 39 y 41
                        const stats = await loaderService.loadCsv(finalPath, {
                           entityId: creds.entity_id,
                           year,
                           month: mm,
                           onlyTypes: [39, 41]
                        });

                        console.log(`💾 BD: ${stats.totals.inserted} registros procesados.`);
                        statsReport.processed += stats.totals.inserted;

                     } else {
                        console.warn("⚠️ timeout: archivo no aparecio en disco.");
                     }

                  } catch (e) {
                     console.warn("⚠️ no aparecio boton final (sii sigue procesando o sin datos).");
                  }

               } catch (errStep) {
                  const pageText = await page.evaluate(() => document.body.innerText);
                  if (pageText.includes("no existen movimientos")) {
                     console.log(`ℹ️ sin movimientos.`);
                  } else {
                     console.error(`❌ error mes ${mm}: ${errStep.message}`);
                     statsReport.errors.push(`Mes ${mm}: ${errStep.message}`);
                  }
               }

               if (fullYear) await sleep(2000);
            }

         } catch (e) {
            console.error(`❌ error entidad ${label}:`, e.message);
            statsReport.errors.push(e.message);
            throw e;
         } finally {
            await context.close();
         }
      };

      for (const creds of siiCreds) {
         await processEntity(creds);
      }

      return { ok: true, stats: statsReport };

   } finally {
      console.log("🔌 finalizado.");
      await browser.close();
   }
};

if (require.main === module) {
   run().catch(err => {
      console.error("FATAL:", err);
      process.exit(1);
   });
}

module.exports = {
   runManualSync: (entityId, year, month) => run({ entityId, year, month })
}; 