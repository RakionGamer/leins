#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { createGunzip } = require("zlib");
const { pipeline } = require("stream/promises");
const { DateTime } = require("luxon");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

// importaciones de librerias propias
const { loadCsvSiiBoletas41 } = require("../loaders/entitySiiBoletas41");
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

// configuracion general
const aesKey = process.env.MYSQL_AES_KEY;
const CL_TZ = process.env.SII_TZ || "America/Santiago";

(async () => {
   console.log("🚀 iniciando servicio de boletas sii");

   // -----------------------------------------------------------------------
   // 1. CONFIGURACION DE FECHAS (PARSEO MANUAL)
   // -----------------------------------------------------------------------
   const now = DateTime.now().setZone(CL_TZ);

   // Helper para leer argumentos de consola (ej: --year 2025)
   const getArgValue = (flag) => {
      const idx = process.argv.indexOf(`--${flag}`);
      return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
   };

   // Prioridad: Argumento explicito > arg() > Fecha actual
   const yearInput = getArgValue("year") || arg("year", now.toFormat("yyyy"));
   const monthInput = getArgValue("month") || arg("month", now.toFormat("MM"));

   // Deteccion de modo anual
   const fullYear = String(monthInput).toUpperCase() === "ALL" || process.argv.includes("--fullYear");

   // Calculo final de fechas
   const { year, month } = getYearMonthPair(yearInput, fullYear ? "01" : monthInput);

   console.log(`▶ modo: ${fullYear ? "📅 auditoria anual" : "⚡ carga mensual"}`);
   console.log(`▶ objetivo: ${fullYear ? `año ${year}` : `${year}-${month}`}`);

   if (!fullYear && isFuturePeriod(year, month, CL_TZ)) {
      console.warn(`⏭️ periodo futuro ${year}-${month}. cancelando.`);
      process.exit(0);
   }

   // -----------------------------------------------------------------------
   // 2. VALIDACION DE CREDENCIALES
   // -----------------------------------------------------------------------
   if (!aesKey) { console.error("❌ falta mysql_aes_key"); process.exit(2); }

   // Filtro anti-duplicados de empresas
   let siiCreds = await fetchCredentials({ type: "SII", aesKey });
   const rutsVistos = new Set();
   siiCreds = siiCreds.filter(c => {
      const key = `${c.rut_sin_dv}`;
      if (rutsVistos.has(key)) return false;
      rutsVistos.add(key);
      return true;
   });

   if (!siiCreds.length) { console.log("⚠️ no hay credenciales activas."); return; }

   // -----------------------------------------------------------------------
   // 3. INICIO DEL NAVEGADOR
   // -----------------------------------------------------------------------
   console.log("🔌 iniciando navegador...");
   const browser = await createBrowser();

   try {
      // Funcion principal que procesa una empresa
      const processEntity = async (creds) => {
         const label = `${creds.legal_name || 'Empresa'} (${creds.rut_sin_dv})`;
         const context = await browser.createBrowserContext();
         const page = await context.newPage();

         try {
            console.log(`🔷 procesando: ${label}`);

            // Estructura de carpetas: downloads/{ID}/{YEAR}
            const baseDownloads = path.resolve(__dirname, "downloads");
            const entityDir = path.join(baseDownloads, String(creds.entity_id), String(year));
            await ensureDir(entityDir);

            // Preparar pagina (bloqueo de imagenes/css para velocidad)
            await preparePage(page, { downloadDir: entityDir, navTimeout: 60000, blockResources: true });

            // A. Login en SII
            let logged = false;
            for (let i = 1; i <= 3; i++) {
               try {
                  await loginSII(page, creds.rut_sin_dv, creds.dv, creds.clave);
                  logged = true; break;
               } catch (e) { await sleep(2000); }
            }
            if (!logged) throw new Error("fallo login tras 3 intentos");

            // B. Navegacion al registro CV
            await navigatePages(page, [SII_URLS.comprasventas], { lastSelector: 'form[name="formContribuyente"]' });

            // C. Ciclo de meses (1 mes si es diario, 12 si es --fullYear)
            const monthsList = fullYear ? monthsOfYear(year) : [{ year, month }];

            for (const { month: mm } of monthsList) {
               // Saltar meses futuros en modo anual
               if (isFuturePeriod(year, mm, CL_TZ)) {
                  if (fullYear) console.log(`   ⏭️ deteniendo anual en ${year}-${mm} (es futuro)`);
                  break;
               }

               console.log(`📅 periodo ${year}-${mm}...`);

               try {
                  // PASO 1: Llenar formulario
                  await fillComprasVentasForm(page, {
                     rut: `${creds.rut_sin_dv}-${creds.dv}`,
                     mes: mm,
                     anho: year,
                     timeout: 60000
                  });

                  // PASO 2: Activar pestaña Ventas
                  const selectorVentas = "#my-wrapper > div.web-sii.cuerpo > div.container > div:nth-child(1) > div > div:nth-child(2) > ul > li:nth-child(2) > a > strong";
                  try {
                     await page.waitForSelector(selectorVentas, { timeout: 30000 });
                     await page.evaluate(sel => document.querySelector(sel)?.click(), selectorVentas);
                     await sleep(5000);
                  } catch (e) { console.warn("⚠️ pestana ventas ya activa o no encontrada."); }

                  // PASO 3: Solicitar reporte (Boton 3941)
                  const selectorBoletas = "button[ng-click*='3941']";
                  const boletasBtn = await page.waitForSelector(selectorBoletas, { visible: true, timeout: 15000 });

                  // Limpieza de overlays (modals de carga)
                  await page.evaluate(() => {
                     document.querySelectorAll('#esperaDialog, .modal-backdrop, .block-ui-wrapper').forEach(el => el.remove());
                  });

                  // Clic forzado
                  await page.evaluate(el => el.click(), boletasBtn);
                  console.log("⚡ solicitud enviada.");

                  // PASO 4: Modal de confirmacion
                  console.log("🔎 esperando modal 'ver detalles'...");
                  await page.waitForSelector(".modal-content", { visible: true, timeout: 15000 });

                  // Clic en Confirmar
                  await page.evaluate(() => {
                     const btn = document.querySelector(".modal-content .btn-primary");
                     if (btn) btn.click();
                  });
                  console.log("✅ confirmado. verificando estado...");

                  // PASO 5: Manejo de aviso 'descarga vigente' (opcional)
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

                  // PASO 6: Descarga final (Boton bajarArchivo)
                  console.log("⏳ esperando generacion de archivo (boton final)...");

                  const selectorDescargaFinal = "button[ng-click*='bajarArchivo']";

                  try {
                     const btnFinal = await page.waitForSelector(selectorDescargaFinal, { visible: true, timeout: 90000 });

                     // 6.0: LIMPIEZA PREVIA (Borrar .gz viejos para asegurar deteccion)
                     try {
                        const archivosExistentes = fs.readdirSync(entityDir);
                        archivosExistentes.forEach(f => {
                           if (f.endsWith('.gz') || f.endsWith('.crdownload')) {
                              fs.unlinkSync(path.join(entityDir, f));
                           }
                        });
                     } catch (errClean) { /* ignorar */ }

                     // Captura estado carpeta
                     const filesBefore = fs.readdirSync(entityDir);

                     // Clic final
                     await page.evaluate(el => el.click(), btnFinal);
                     console.log("⬇️ clic final realizado. monitoreando...");

                     // PASO 7: Validacion y BD
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

                        // a. Descompresion
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

                        /// b. Carga a BD
                        const stats = await loadCsvSiiBoletas41(finalPath, {
                           entityId: creds.entity_id,
                           year,
                           month: mm,
                        });
                        // Ajustamos el log al objeto que retorna nuestro nuevo loader
                        console.log(`💾 BD: ${stats.totals.inserted} registros procesados (Saltados: ${stats.totals.skipped}).`);

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
                  }
               }

               // Pausa entre meses para no saturar
               if (fullYear) await sleep(2000);
            }

         } catch (e) {
            console.error(`❌ error entidad ${label}:`, e.message);
         } finally {
            await context.close();
         }
      };

      // Ejecucion secuencial
      for (const creds of siiCreds) {
         await processEntity(creds);
      }

   } finally {
      console.log("🔌 finalizado.");
      await browser.close();
   }
})();