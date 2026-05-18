#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const { createGunzip } = require("zlib");
const { pipeline } = require("stream/promises");
const { DateTime } = require("luxon");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

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
   ensureDownloadHooks,
   sleep,
   isFuturePeriod,
   arg,
   parseTypes,
   monthsOfYear,
} = require("../libs/functions");

const aesKey = process.env.MYSQL_AES_KEY;
const CL_TZ = process.env.SII_TZ || "America/Santiago";
const DEFAULT_TYPES = [33];

function getArgValue(flag) {
   const withEquals = process.argv.find(v => v.startsWith(`--${flag}=`));
   if (withEquals) return withEquals.split("=").slice(1).join("=");

   const idx = process.argv.indexOf(`--${flag}`);
   return (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : null;
}

function normalizeText(value) {
   return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
}

async function removeBlockingOverlays(page) {
   await page.evaluate(() => {
      document
         .querySelectorAll("#esperaDialog, .modal-backdrop, .block-ui-wrapper, .block-ui-overlay")
         .forEach(el => el.remove());
   }).catch(() => {});
}

async function saveDebugSnapshot(page, downloadDir, filename) {
   try {
      const html = await page.content();
      const url = page.url();
      const bodyText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
      const filePath = path.join(downloadDir, filename);
      fs.writeFileSync(filePath, `URL: ${url}\n\nTEXT:\n${bodyText}\n\nHTML:\n${html}`, "utf8");
      console.log(`Snapshot diagnostico guardado: ${filePath}`);
   } catch (err) {
      console.warn(`No se pudo guardar snapshot diagnostico: ${err.message}`);
   }
}

async function waitForVentasSummary(page, timeout = 45000) {
   await page.waitForFunction(() => {
      const normalize = (value) => String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/\s+/g, " ")
         .trim()
         .toLowerCase();

      const hasDetailLink = Boolean(
         document.querySelector('a[href="#detalle/33"], a[href="#/detalle/33"], a[href*="detalle/33"]')
      );
      const text = normalize(document.body.innerText || "");
      return hasDetailLink || text.includes("factura electronica (33)");
   }, { timeout });
}

async function clickFirstVisibleByText(page, selectors, textPatterns, { timeout = 15000 } = {}) {
   const started = Date.now();
   const normalizedPatterns = textPatterns.map(normalizeText);

   while (Date.now() - started < timeout) {
      const handle = await page.evaluateHandle(({ selectors: cssSelectors, patterns }) => {
         const normalize = (value) => String(value || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

         const nodes = Array.from(document.querySelectorAll(cssSelectors.join(",")));
         return nodes.find((el) => {
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            if (!rect.width || !rect.height || styles.display === "none" || styles.visibility === "hidden") {
               return false;
            }
            const text = normalize(el.innerText || el.textContent || el.getAttribute("title") || "");
            return patterns.some(pattern => text.includes(pattern));
         }) || null;
      }, { selectors, patterns: normalizedPatterns });

      const element = handle.asElement();
      if (element) {
         await element.evaluate(el => el.scrollIntoView({ block: "center", inline: "center" }));
         await element.click({ delay: 40 });
         await handle.dispose().catch(() => {});
         return true;
      }

      await handle.dispose().catch(() => {});
      await sleep(500);
   }

   return false;
}

async function clickVentasTab(page) {
   await removeBlockingOverlays(page);

   const clickedByState = await page.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll("[ui-sref], a, button"));
      const node = candidates.find((el) => {
         const state = el.getAttribute("ui-sref") || "";
         const href = el.getAttribute("href") || "";
         const text = String(el.innerText || el.textContent || "").trim().toLowerCase();
         return state === "venta"
            || state.startsWith("venta(")
            || href === "#venta"
            || href === "#/venta"
            || text === "venta";
      });

      if (!node) return false;
      node.scrollIntoView({ block: "center", inline: "center" });
      node.click();
      return true;
   }).catch(() => false);

   if (clickedByState) {
      await waitForVentasSummary(page, 45000);
      return true;
   }

   const clicked = await clickFirstVisibleByText(
      page,
      ["a", "button"],
      ["venta"],
      { timeout: 12000 }
   );

   if (clicked) {
      await waitForVentasSummary(page, 45000);
   }
   return clicked;
}

async function clickFacturaElectronicaDetail(page) {
   await removeBlockingOverlays(page);

   await page.waitForFunction(() => {
      const rows = Array.from(document.querySelectorAll("tr"));
      return rows.some(row => {
         const text = String(row.innerText || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
         return text.includes("factura electronica") && text.includes("(33)");
      });
   }, { timeout: 30000 }).catch(() => {});

   const selectors = [
      'a[href="#detalle/33"]',
      'a[href="#/detalle/33"]',
      'a[href*="detalle/33"]',
      'a[ui-sref*="detalle"][href*="33"]',
   ];

   for (const selector of selectors) {
      try {
         const link = await page.waitForSelector(selector, { visible: true, timeout: 5000 });
         await Promise.allSettled([
            link.click({ delay: 40 }),
            page.waitForNavigation({ waitUntil: "networkidle0", timeout: 15000 }),
         ]);
         await page.waitForFunction(() => {
            const text = String(document.body.innerText || "").toLowerCase();
            return document.querySelector('button[ng-click*="bajarArchivo"]') || text.includes("exportar csv");
         }, { timeout: 30000 });
         return true;
      } catch (_) {
         // Probar siguiente selector.
      }
   }

   const clickedByText = await page.evaluate(() => {
      const normalize = (value) => String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/\s+/g, " ")
         .trim()
         .toLowerCase();

      const links = Array.from(document.querySelectorAll("a"));
      const link = links.find((el) => {
         const text = normalize(el.innerText || el.textContent || "");
         const href = el.getAttribute("href") || "";
         return href.includes("detalle/33") || text.includes("factura electronica (33)");
      });

      if (!link) return false;
      link.scrollIntoView({ block: "center", inline: "center" });
      link.click();
      return true;
   }).catch(() => false);

   if (!clickedByText) return false;

   try {
      await page.waitForFunction(() => {
         const text = String(document.body.innerText || "").toLowerCase();
         return document.querySelector('button[ng-click*="bajarArchivo"]') || text.includes("exportar csv");
      }, { timeout: 30000 });
      return true;
   } catch (_) {
      return false;
   }
}

async function cleanPendingDownloads(downloadDir, nameHint) {
   try {
      const files = fs.readdirSync(downloadDir);
      files.forEach((file) => {
         const shouldRemove = file.endsWith(".crdownload")
            || file.endsWith(".gz")
            || file.startsWith("dte_")
            || (nameHint && file.includes(nameHint) && file.endsWith(".csv"));
         if (shouldRemove) fs.unlinkSync(path.join(downloadDir, file));
      });
   } catch (_) {
      // Ignorar limpieza: el flujo de descarga aun puede continuar.
   }
}

async function waitForNewFile(downloadDir, filesBefore, timeoutMs = 90000) {
   const started = Date.now();
   while (Date.now() - started < timeoutMs) {
      await sleep(1000);
      const filesAfter = fs.readdirSync(downloadDir);
      const newFile = filesAfter.find(file => !filesBefore.includes(file) && !file.endsWith(".crdownload"));
      if (newFile) return path.join(downloadDir, newFile);
   }
   return null;
}

async function gunzipIfNeeded(filePath) {
   if (!filePath || !filePath.endsWith(".gz")) return filePath;

   const csvName = path.basename(filePath).replace(/\.gz$/, "");
   const destPath = path.join(
      path.dirname(filePath),
      csvName.endsWith(".csv") ? csvName : `${csvName}.csv`
   );

   await pipeline(
      fs.createReadStream(filePath),
      createGunzip(),
      fs.createWriteStream(destPath)
   );

   return destPath;
}

async function downloadFacturaElectronica(page, downloadDir, { year, month }) {
   const nameHint = `FacturaElectronica_${year}${month}`;

   await cleanPendingDownloads(downloadDir, nameHint);

   const clickedDetail = await clickFacturaElectronicaDetail(page);

   if (!clickedDetail) {
      await saveDebugSnapshot(page, downloadDir, `debug-ventas-${year}${month}.html`);
      throw new Error("No se encontro el link Factura Electronica (33) en la pestana Ventas");
   }

   if (clickedDetail) {
      console.log("Detalle Factura Electronica (33) abierto.");
      const exportSelector = "button[ng-click*='bajarArchivo']";
      try {
         const exportButton = await page.waitForSelector(exportSelector, { visible: true, timeout: 30000 });
         await removeBlockingOverlays(page);

         const filesBefore = fs.readdirSync(downloadDir);
         await exportButton.evaluate(el => el.scrollIntoView({ block: "center", inline: "center" }));
         await exportButton.click({ delay: 40 });

         const downloaded = await waitForNewFile(downloadDir, filesBefore, 90000);
         if (downloaded) return gunzipIfNeeded(downloaded);
      } catch (err) {
         console.warn(`No se pudo exportar CSV desde detalle 33: ${err.message}`);
         try {
            const backButton = await page.waitForSelector('button[ng-click*="doTheBack"]', { visible: true, timeout: 5000 });
            await backButton.click({ delay: 40 });
            await page.waitForSelector('a[href="#detalle/33"], a[href*="detalle/33"]', { visible: true, timeout: 15000 });
         } catch (_) {
            // Si no vuelve al resumen, el fallback probablemente no estara disponible.
         }
      }
   }

   await saveDebugSnapshot(page, downloadDir, `debug-exportar-csv-${year}${month}.html`);
   throw new Error("No se pudo descargar el CSV desde el detalle Factura Electronica (33)");
}

const run = async ({ entityId = null, year: inYear = null, month: inMonth = null } = {}) => {
   console.log("Iniciando servicio SII Ventas - Factura Electronica");

   const now = DateTime.now().setZone(CL_TZ);
   const cliEntityId = entityId || getArgValue("entityId") || getArgValue("entity");
   const yearInput = inYear || getArgValue("year") || arg("year", now.toFormat("yyyy"));
   const monthInput = inMonth || getArgValue("month") || arg("month", now.toFormat("MM"));
   const fullYear = !inMonth && (String(monthInput).toUpperCase() === "ALL" || process.argv.includes("--fullYear"));
   const onlyTypes = parseTypes(getArgValue("types") || arg("types", "")) || DEFAULT_TYPES;

   const { year, month } = getYearMonthPair(yearInput, fullYear ? "01" : monthInput);

   console.log(`Modo: ${fullYear ? "anual" : "mensual"}`);
   console.log(`Objetivo: ${fullYear ? `anio ${year}` : `${year}-${month}`}`);
   console.log(`Tipos documento: ${onlyTypes.join(", ")}`);

   if (!fullYear && isFuturePeriod(year, month, CL_TZ)) {
      console.warn(`Periodo futuro ${year}-${month}. Cancelando.`);
      return { ok: false, message: "Periodo futuro" };
   }

   if (!aesKey) {
      console.error("Falta MYSQL_AES_KEY");
      process.exit(2);
   }

   let siiCreds = await fetchCredentials({ type: "SII", aesKey });

   if (cliEntityId) {
      siiCreds = siiCreds.filter(c => String(c.entity_id) === String(cliEntityId));
      if (!siiCreds.length) {
         console.error(`No se encontraron credenciales para entityId ${cliEntityId}`);
         return { ok: false, message: "Sin credenciales" };
      }
   } else {
      const seen = new Set();
      siiCreds = siiCreds.filter(c => {
         const key = `${c.rut_sin_dv}-${c.dv}`;
         if (seen.has(key)) return false;
         seen.add(key);
         return true;
      });
   }

   if (!siiCreds.length) {
      console.log("No hay credenciales SII activas.");
      return { ok: true, count: 0 };
   }

   const browser = await createBrowser();
   const statsReport = { processed: 0, errors: [], details: [] };

   try {
      const processEntity = async (creds) => {
         const label = `${creds.legal_name || "Empresa"} (${creds.rut_sin_dv}-${creds.dv})`;
         const context = await browser.createBrowserContext();
         const page = await context.newPage();

         try {
            console.log(`Procesando: ${label}`);

            const baseDownloads = path.resolve(__dirname, "downloads");
            const downloadDir = path.join(baseDownloads, String(creds.entity_id), String(year));
            await ensureDir(downloadDir);

            await preparePage(page, {
               downloadDir,
               navTimeout: 60000,
               defaultTimeout: 60000,
               blockResources: true,
            });
            await ensureDownloadHooks(page, downloadDir);

            let logged = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
               try {
                  await loginSII(page, creds.rut_sin_dv, creds.dv, creds.clave);
                  logged = true;
                  break;
               } catch (_) {
                  await sleep(2000);
               }
            }
            if (!logged) throw new Error("Fallo login tras 3 intentos");

            await navigatePages(page, [SII_URLS.comprasventas], {
               lastSelector: 'form[name="formContribuyente"]',
               timeout: 60000,
            });

            const monthsList = fullYear ? monthsOfYear(year) : [{ year, month }];

            for (const { month: mm } of monthsList) {
               if (isFuturePeriod(year, mm, CL_TZ)) {
                  if (fullYear) console.log(`Deteniendo anual en ${year}-${mm} (periodo futuro).`);
                  break;
               }

               console.log(`Periodo ${year}-${mm}`);

               try {
                  await fillComprasVentasForm(page, {
                     rut: `${creds.rut_sin_dv}-${creds.dv}`,
                     mes: mm,
                     anho: year,
                     timeout: 60000,
                  });

                  try {
                     const salesTabClicked = await clickVentasTab(page);
                     if (!salesTabClicked) {
                        await saveDebugSnapshot(page, downloadDir, `debug-sin-pestana-venta-${year}${mm}.html`);
                        throw new Error("No se encontro la pestana Ventas");
                     }
                  } catch (errVenta) {
                     await saveDebugSnapshot(page, downloadDir, `debug-pestana-venta-${year}${mm}.html`);
                     throw new Error(`No se pudo abrir la pestana Ventas: ${errVenta.message}`);
                  }

                  const file = await downloadFacturaElectronica(page, downloadDir, { year, month: mm });

                  if (!file) {
                     console.log(`No se descargo archivo para ${year}-${mm}.`);
                     continue;
                  }

                  const stats = await loaderService.loadCsv(file, {
                     entityId: creds.entity_id,
                     year,
                     month: mm,
                     onlyTypes,
                     operationType: "INCOME",
                  });

                  console.log(`BD: ${stats.totals.inserted} nuevos, ${stats.totals.updated} actualizados.`);
                  statsReport.processed += stats.totals.processed;
                  statsReport.details.push({ entityId: creds.entity_id, year, month: mm, totals: stats.totals });
               } catch (errStep) {
                  const pageText = await page.evaluate(() => document.body.innerText).catch(() => "");
                  if (pageText.includes("no existen movimientos")) {
                     console.log("Sin movimientos.");
                  } else {
                     console.error(`Error periodo ${mm}: ${errStep.message}`);
                     statsReport.errors.push(`Entity ${creds.entity_id} ${year}-${mm}: ${errStep.message}`);
                  }
               }

               if (fullYear) await sleep(2000);
            }
         } finally {
            await context.close();
         }
      };

      for (const creds of siiCreds) {
         await processEntity(creds);
      }

      return { ok: true, stats: statsReport };
   } finally {
      console.log("Finalizado SII Ventas - Factura Electronica.");
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
   runManualSync: (entityId, year, month) => run({ entityId, year, month }),
};
