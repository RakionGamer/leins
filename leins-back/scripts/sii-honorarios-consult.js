#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const { parse } = require("csv-parse/sync");
const xlsx = require("xlsx");
const { DateTime } = require("luxon");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const SiiLoaderService = require("../services/sii-loader.service");
const { sequelize } = require("../libs/sequelize");
const loaderService = new SiiLoaderService();

const {
   SII_URLS,
   loginSII,
   getYearMonthPair,
   fetchCredentials,
   ensureDir,
   createBrowser,
   preparePage,
   ensureDownloadHooks,
   sleep,
   isFuturePeriod,
   arg,
   monthsOfYear,
} = require("../libs/functions");

const aesKey = process.env.MYSQL_AES_KEY;
const CL_TZ = process.env.SII_TZ || "America/Santiago";
const DIRECTIONS = {
   issued: {
      label: "emitidas",
      url: SII_URLS.honorariosEmitidas,
   },
   received: {
      label: "recibidas",
      url: SII_URLS.honorariosRecibidas,
   },
};

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

function resolveDirections(value) {
   const raw = normalizeText(value || getArgValue("direction") || getArgValue("directions") || "both");
   if (["both", "ambas", "todos", "all"].includes(raw)) return ["issued", "received"];
   if (["issued", "emitidas", "emitida"].includes(raw)) return ["issued"];
   if (["received", "recibidas", "recibida"].includes(raw)) return ["received"];
   throw new Error(`direccion invalida: ${value}`);
}

function withFreshDummy(url) {
   try {
      const parsed = new URL(url);
      parsed.searchParams.set("dummy", String(Date.now()));
      return parsed.toString();
   } catch {
      const separator = String(url).includes("?") ? "&" : "?";
      return `${url}${separator}dummy=${Date.now()}`;
   }
}

async function ensureWritableDir(dirPath) {
   const abs = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
   await ensureDir(abs);

   const probe = path.join(abs, `.write-test-${process.pid}-${Date.now()}`);
   fs.writeFileSync(probe, "ok", "utf8");
   fs.unlinkSync(probe);
   return abs;
}

async function resolveDownloadDir(entityId, year) {
   const candidates = [
      process.env.SII_DOWNLOAD_DIR ? path.join(process.env.SII_DOWNLOAD_DIR, String(entityId), String(year), "honorarios") : null,
      path.join(path.resolve(__dirname, "downloads"), String(entityId), String(year), "honorarios"),
      path.join(os.tmpdir(), "leins-sii-downloads", String(entityId), String(year), "honorarios"),
   ].filter(Boolean);

   let lastError = null;
   for (const candidate of candidates) {
      try {
         return await ensureWritableDir(candidate);
      } catch (err) {
         lastError = err;
         console.warn(`Directorio de descarga no disponible (${candidate}): ${err.message}`);
      }
   }

   throw new Error(`No hay directorio de descarga writable. Ultimo error: ${lastError?.message || "desconocido"}`);
}

async function ensureDatabaseAvailable() {
   try {
      await sequelize.authenticate();
   } catch (err) {
      const host = process.env.DB_HOST || "localhost";
      const port = process.env.DB_PORT || "3306";
      const name = process.env.DB_NAME || "";
      throw new Error(`no se pudo conectar a mysql (${host}:${port}/${name}): ${err.name || err.message}`);
   }
}

async function removeBlockingOverlays(page) {
   await page.evaluate(() => {
      document
         .querySelectorAll("#esperaDialog, .modal-backdrop, .block-ui-wrapper, .block-ui-overlay, #modalInforma")
         .forEach(el => el.remove());
   }).catch(() => {});
}

async function saveDebugSnapshot(page, downloadDir, filename) {
   try {
      const html = await page.content();
      const text = await page.evaluate(() => document.body.innerText || "").catch(() => "");
      fs.writeFileSync(path.join(downloadDir, filename), `URL: ${page.url()}\n\nTEXT:\n${text}\n\nHTML:\n${html}`, "utf8");
   } catch (err) {
      console.warn(`No se pudo guardar snapshot diagnostico: ${err.message}`);
   }
}

async function openReceivedMonthlyMenu(page, creds) {
   let lastText = "";
   let lastUrl = "";

   for (let attempt = 1; attempt <= 3; attempt++) {
      const targetUrl = withFreshDummy(DIRECTIONS.received.url);
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
      await removeBlockingOverlays(page);

      const monthSelect = await page.waitForSelector('select[name="cbmesinformemensual"]', {
         visible: true,
         timeout: attempt === 3 ? 30000 : 12000,
      }).catch(() => null);
      const yearSelect = await page.$('select[name="cbanoinformemensual"]').catch(() => null);

      if (monthSelect && yearSelect) return;

      lastUrl = page.url();
      lastText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
      if (/superado el maximo de sesiones|m[aá]ximo de sesiones/i.test(lastText)) {
         throw new Error("SII bloqueo el acceso por maximo de sesiones autenticadas. Cerrar sesiones SII activas e intentar nuevamente.");
      }
      console.warn(`⚠️ formulario mensual recibidas no disponible (intento ${attempt}). url=${lastUrl}`);
      await sleep(1500 * attempt);
   }

   const snippet = normalizeText(lastText).slice(0, 220);
   throw new Error(`No se encontro formulario mensual recibidas. url=${lastUrl || page.url()} texto="${snippet}"`);
}

async function selectPeriod(page, { year, month }) {
   await removeBlockingOverlays(page);
   await page.waitForSelector("body", { timeout: 60000 });

   const selected = await page.evaluate(({ yy, mm }) => {
      const normalize = (value) => String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/\s+/g, " ")
         .trim()
         .toLowerCase();
      const visible = (el) => {
         const rect = el.getBoundingClientRect();
         const style = window.getComputedStyle(el);
         return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      };
      const dispatch = (el) => {
         el.dispatchEvent(new Event("input", { bubbles: true }));
         el.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const selects = Array.from(document.querySelectorAll("select")).filter(visible);
      let yearSet = false;
      let monthSet = false;

      for (const select of selects) {
         const name = normalize([select.name, select.id, select.getAttribute("aria-label")].join(" "));
         const options = Array.from(select.options || []);
         const yearOption = options.find(opt => normalize(opt.value) === String(yy) || normalize(opt.textContent) === String(yy));
         const monthOption = options.find((opt) => {
            const value = normalize(opt.value).padStart(2, "0");
            const text = normalize(opt.textContent);
            return value === String(mm).padStart(2, "0") || text === String(Number(mm)) || text.startsWith(String(Number(mm)).padStart(2, "0"));
         });

         if (!yearSet && (name.includes("ano") || name.includes("anio") || name.includes("year") || yearOption) && yearOption) {
            select.value = yearOption.value;
            dispatch(select);
            yearSet = true;
            continue;
         }

         if (!monthSet && (name.includes("mes") || name.includes("month") || monthOption) && monthOption) {
            select.value = monthOption.value;
            dispatch(select);
            monthSet = true;
         }
      }

      const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
      for (const input of inputs) {
         const name = normalize([input.name, input.id, input.placeholder].join(" "));
         if (!yearSet && (name.includes("ano") || name.includes("anio") || name.includes("year"))) {
            input.value = String(yy);
            dispatch(input);
            yearSet = true;
         }
         if (!monthSet && (name.includes("mes") || name.includes("month"))) {
            input.value = String(Number(mm));
            dispatch(input);
            monthSet = true;
         }
      }

      return { yearSet, monthSet };
   }, { yy: String(year), mm: String(month).padStart(2, "0") });

   if (!selected.yearSet || !selected.monthSet) {
      throw new Error(`No se pudo seleccionar periodo ${year}-${month}`);
   }

   const clicked = await page.evaluate(() => {
      const normalize = (value) => String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/\s+/g, " ")
         .trim()
         .toLowerCase();
      const candidates = Array.from(document.querySelectorAll("button, input[type=submit], input[type=button], a"));
      const button = candidates.find((el) => {
         const text = normalize(el.innerText || el.value || el.title || el.getAttribute("aria-label"));
         return ["consultar", "buscar", "aceptar", "enviar"].some(word => text.includes(word));
      });
      if (!button) return false;
      button.scrollIntoView({ block: "center", inline: "center" });
      button.click();
      return true;
   });

   if (!clicked) throw new Error("No se encontro boton para consultar periodo");

   await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 45000 }).catch(() => false),
      page.waitForFunction(() => {
         const text = document.body.innerText || "";
         return /boleta|folio|receptor|emisor|bruto|liquido|no existen|sin movimientos/i.test(text);
      }, { timeout: 45000 }).catch(() => false),
   ]);
}

function safeDownloadFilename(filename) {
   return path.basename(String(filename || `honorarios-${Date.now()}.csv`))
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
      .trim() || `honorarios-${Date.now()}.csv`;
}

function parseFilenameFromContentDisposition(headerValue) {
   if (!headerValue) return null;
   const match = String(headerValue).match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
   return match && match[1] ? decodeURIComponent(match[1]) : null;
}

async function waitForNewFile(downloadDir, filesBefore, timeoutMs = 60000) {
   const started = Date.now();
   while (Date.now() - started < timeoutMs) {
      await sleep(1000);
      const filesAfter = fs.readdirSync(downloadDir);
      const file = filesAfter.find(name => !filesBefore.includes(name) && !name.endsWith(".crdownload"));
      if (file) return path.join(downloadDir, file);
   }
   return null;
}

async function waitAndSaveAttachment(page, downloadDir, { timeoutMs = 60000, nameHint = "honorarios" } = {}) {
   const response = await page.waitForResponse((res) => {
      const headers = res.headers() || {};
      const cd = headers["content-disposition"] || "";
      const ct = headers["content-type"] || "";
      return /attachment/i.test(cd)
         || /text\/csv|application\/octet-stream|application\/vnd\.ms-excel|application\/excel|text\/plain/i.test(ct);
   }, { timeout: timeoutMs });

   const headers = response.headers() || {};
   const suggested = safeDownloadFilename(
      parseFilenameFromContentDisposition(headers["content-disposition"])
      || `${nameHint}-${Date.now()}.csv`
   );
   const filePath = path.join(downloadDir, suggested);
   fs.writeFileSync(filePath, await response.buffer());
   return filePath;
}

async function waitForHookedDownload(page, timeoutMs = 60000) {
   const started = Date.now();
   while (Date.now() - started < timeoutMs) {
      if (page.__lastSavedFile && fs.existsSync(page.__lastSavedFile)) {
         return page.__lastSavedFile;
      }

      const browserPath = await page.evaluate(() => window.__lastSavedFile || null).catch(() => null);
      if (browserPath && fs.existsSync(browserPath)) {
         return browserPath;
      }

      await sleep(500);
   }
   return null;
}

async function tryDownload(page, downloadDir, nameHint) {
   await ensureDownloadHooks(page, downloadDir);
   await removeBlockingOverlays(page);

   const downloadHandle = await page.evaluateHandle(() => {
      const normalize = (value) => String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/\s+/g, " ")
         .trim()
         .toLowerCase();
      const nodes = Array.from(document.querySelectorAll("button, input[type=button], input[type=submit], a"));
      return nodes.find((el) => {
         const text = normalize(el.innerText || el.value || el.title || el.getAttribute("aria-label") || el.getAttribute("href"));
         return ["descargar", "exportar", "excel", "csv", "bajar", "planilla"].some(word => text.includes(word));
      }) || null;
   });

   const element = downloadHandle.asElement();
   if (!element) {
      await downloadHandle.dispose().catch(() => {});
      return null;
   }

   const filesBefore = fs.readdirSync(downloadDir);
   page.__lastSavedFile = null;
   await page.evaluate(() => { window.__lastSavedFile = null; }).catch(() => {});

   const filePromise = waitForNewFile(downloadDir, filesBefore, 60000).catch(() => null);
   const attachmentPromise = waitAndSaveAttachment(page, downloadDir, { timeoutMs: 60000, nameHint }).catch(() => null);
   const hookedPromise = waitForHookedDownload(page, 60000).catch(() => null);
   const navigationPromise = page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 })
      .then(() => null)
      .catch(() => null);

   await element.evaluate(el => el.scrollIntoView({ block: "center", inline: "center" }));
   await element.click({ delay: 40 });
   await downloadHandle.dispose().catch(() => {});

   return Promise.race([
      filePromise,
      attachmentPromise,
      hookedPromise,
      navigationPromise,
      sleep(65000).then(() => null),
   ]);
}

function decodeHtmlEntities(value) {
   return String(value ?? "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&deg;/gi, "")
      .replace(/&oacute;/gi, "o")
      .replace(/&aacute;/gi, "a")
      .replace(/&eacute;/gi, "e")
      .replace(/&iacute;/gi, "i")
      .replace(/&uacute;/gi, "u")
      .replace(/&ntilde;/gi, "n")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
}

function normalizeHonorariosSheetRows(matrix) {
   const rows = Array.isArray(matrix) ? matrix : [];
   const normalize = (value) => normalizeText(decodeHtmlEntities(value));
   const headerIndex = rows.findIndex((row) => {
      const text = normalize((row || []).join(" "));
      return text.includes("fecha") && text.includes("rut") && (text.includes("pagado") || text.includes("bruto"));
   });

   if (headerIndex === -1) return [];

   const rawHeaders = rows[headerIndex].map(decodeHtmlEntities);
   const headers = rawHeaders.map((header, index) => {
      const normalized = normalize(header);
      if (normalized === "n" || normalized === "nro" || normalized.includes("boleta")) return "N Boleta";
      if (normalized === "fecha") return "Fecha";
      if (normalized.includes("estado")) return "Estado";
      if (normalized.includes("anulacion")) return "Fecha Anulacion";
      if (normalized === "rut") return "Rut";
      if (normalized.includes("nombre") || normalized.includes("razon social")) return "Nombre o Razon Social";
      if (normalized.includes("soc")) return "Soc Prof";
      if (normalized.includes("bruto")) return "Brutos";
      if (normalized.includes("retenido") || normalized.includes("retencion")) return "Retenido";
      if (normalized.includes("pagado") || normalized.includes("liquido")) return "Pagado";
      return header || `col_${index + 1}`;
   });

   return rows.slice(headerIndex + 1)
      .map((row) => {
         const out = {};
         headers.forEach((header, index) => {
            out[header] = decodeHtmlEntities(row[index]);
         });
         return out;
      })
      .filter((row) => {
         const values = Object.values(row).map(normalize).join(" ");
         return /\d/.test(values) && !values.includes("totales");
      });
}

function readRowsFromFile(filePath) {
   const ext = path.extname(filePath).toLowerCase();
   if ([".xls", ".xlsx"].includes(ext)) {
      const workbook = xlsx.readFile(filePath, { raw: true, cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      const normalized = normalizeHonorariosSheetRows(matrix);
      if (normalized.length) return normalized;
      return xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
   }

   const content = fs.readFileSync(filePath, "utf8");
   if (/^\s*</.test(content)) {
      const workbook = xlsx.read(content, { type: "string", raw: true, cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const matrix = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
      const normalized = normalizeHonorariosSheetRows(matrix);
      if (normalized.length) return normalized;
      return xlsx.utils.sheet_to_json(sheet, { defval: "", raw: false });
   }

   const delimiter = content.includes(";") ? ";" : ",";
   return parse(content, {
      columns: true,
      delimiter,
      bom: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
      relax_quotes: true,
   });
}

async function consultReceivedMonthlyReport(page, downloadDir, { year, month, creds }) {
   await openReceivedMonthlyMenu(page, creds);

   console.log("📝 completando formulario mensual recibidas...");
   await page.select('select[name="cbmesinformemensual"]', String(month).padStart(2, "0"));
   await page.select('select[name="cbanoinformemensual"]', String(year));

   const clicked = await page.evaluate(() => {
      const button = document.querySelector('input[onclick*="validar_mensual_rec"]')
         || Array.from(document.querySelectorAll('input[type="button"], button')).find((el) => {
            const text = String(el.value || el.innerText || "").trim().toLowerCase();
            return text === "consultar";
         });
      if (!button) return false;
      button.scrollIntoView({ block: "center", inline: "center" });
      button.click();
      return true;
   });

   if (!clicked) throw new Error("No se encontro boton Consultar mensual recibidas");
   console.log("⚡ solicitud mensual enviada.");

   console.log("🔎 esperando informe mensual...");
   await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: 60000 }).catch(() => false),
      page.waitForFunction(() => {
         const text = document.body.innerText || "";
         return document.querySelector('input[name="planilla"]')
            || /informe correspondiente al mes|ver informe como planilla|no existen|sin movimientos/i.test(text);
      }, { timeout: 60000 }).catch(() => false),
   ]);

   const pageText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
   if (/no existen|sin movimientos|no se encontraron/i.test(pageText)) {
      return { rows: [], file: null };
   }

   console.log("⏳ esperando planilla electronica...");
   const file = await tryDownload(page, downloadDir, `honorarios-recibidas-${year}${month}`);
   if (file) {
      console.log(`✅ planilla descargada: ${path.basename(file)}`);
      return { rows: readRowsFromFile(file), file };
   }

   console.warn("⚠️ planilla no aparecio en disco. leyendo tabla visible...");
   return { rows: await extractRowsFromTables(page), file: null };
}

async function extractRowsFromTables(page) {
   return page.evaluate(() => {
      const normalize = (value) => String(value || "")
         .normalize("NFD")
         .replace(/[\u0300-\u036f]/g, "")
         .replace(/&[a-z]+;/gi, " ")
         .replace(/[^a-zA-Z0-9]+/g, " ")
         .replace(/\s+/g, " ")
         .trim()
         .toLowerCase();
      const headerScore = (tr) => {
         const cells = Array.from(tr.querySelectorAll("th,td")).map(cell => normalize(cell.innerText));
         const text = ` ${cells.join(" ")} `;
         let score = 0;
         if (/\bn\b|\bnro\b|folio|numero|boleta/.test(text)) score += 1;
         if (/\bfecha\b/.test(text)) score += 2;
         if (/\brut\b/.test(text)) score += 2;
         if (/nombre|razon social/.test(text)) score += 1;
         if (/bruto/.test(text)) score += 2;
         if (/retenido|retencion/.test(text)) score += 2;
         if (/pagado|liquido/.test(text)) score += 2;
         return score;
      };
      const headerName = (value, index) => {
         const text = normalize(value);
         if (text === "n" || text === "nro" || text.includes("folio")) return "N Boleta";
         if (text === "fecha") return "Fecha";
         if (text.includes("estado")) return "Estado";
         if (text.includes("anulacion")) return "Fecha Anulacion";
         if (text === "rut") return "Rut";
         if (text.includes("nombre") || text.includes("razon social")) return "Nombre o Razon Social";
         if (text.includes("soc")) return "Soc Prof";
         if (text.includes("bruto")) return "Brutos";
         if (text.includes("retenido") || text.includes("retencion")) return "Retenido";
         if (text.includes("pagado") || text.includes("liquido")) return "Pagado";
         return String(value || `col_${index + 1}`).trim();
      };
      const tables = Array.from(document.querySelectorAll("table"));
      const allRows = [];

      for (const table of tables) {
         const trs = Array.from(table.querySelectorAll("tr"));
         if (trs.length < 2) continue;

         let headerRowIndex = -1;
         let bestScore = 0;
         trs.forEach((tr, index) => {
            const score = headerScore(tr);
            if (score > bestScore) {
               bestScore = score;
               headerRowIndex = index;
            }
         });
         if (headerRowIndex === -1 || bestScore < 4) continue;

         let headers = Array.from(trs[headerRowIndex].querySelectorAll("th,td")).map(cell => cell.innerText.trim());
         let startIndex = headerRowIndex + 1;
         headers = headers.map(headerName);

         for (const tr of trs.slice(startIndex)) {
            const cells = Array.from(tr.querySelectorAll("td"));
            if (!cells.length || cells.length < 3) continue;

            const values = cells.map(cell => cell.innerText.trim());
            const text = normalize(values.join(" "));
            if (!/\d/.test(text) || /total|subtotal/.test(text)) continue;

            const row = {};
            values.forEach((value, index) => {
               row[headers[index] || `col_${index + 1}`] = value;
            });
            allRows.push(row);
         }
      }

      return allRows;
   });
}

async function consultPeriod(page, downloadDir, { year, month, direction, creds }) {
   if (direction === "received") {
      return consultReceivedMonthlyReport(page, downloadDir, { year, month, creds });
   }

   const def = DIRECTIONS[direction];
   await page.goto(withFreshDummy(def.url), { waitUntil: "domcontentloaded", timeout: 60000 });
   await selectPeriod(page, { year, month });

   const pageText = await page.evaluate(() => document.body.innerText || "").catch(() => "");
   if (/no existen|sin movimientos|no se encontraron/i.test(pageText)) {
      return { rows: [], file: null };
   }

   const file = await tryDownload(page, downloadDir, `honorarios-${direction}-${year}${month}`);
   if (file) {
      const rows = readRowsFromFile(file);
      return { rows, file };
   }

   const rows = await extractRowsFromTables(page);
   return { rows, file: null };
}

const run = async ({ entityId = null, year: inYear = null, month: inMonth = null, directions = null } = {}) => {
   console.log("🚀 iniciando servicio de boletas de honorarios sii");

   const now = DateTime.now().setZone(CL_TZ);
   const cliEntityId = entityId || getArgValue("entityId") || getArgValue("entity");
   const yearInput = inYear || getArgValue("year") || arg("year", now.toFormat("yyyy"));
   const monthInput = inMonth || getArgValue("month") || arg("month", now.toFormat("MM"));
   const fullYear = String(monthInput).toUpperCase() === "ALL" || process.argv.includes("--fullYear");
   const selectedDirections = resolveDirections(directions);

   const { year, month } = getYearMonthPair(yearInput, fullYear ? "01" : monthInput);

   console.log(`▶ modo: ${fullYear ? "📅 auditoria anual" : "⚡ carga mensual"}`);
   console.log(`▶ objetivo: ${fullYear ? `año ${year}` : `${year}-${month}`}`);
   console.log(`▶ tipo: ${selectedDirections.map(d => DIRECTIONS[d].label).join(", ")}`);

   if (!fullYear && isFuturePeriod(year, month, CL_TZ)) {
      console.warn(`⏭️ periodo futuro ${year}-${month}. cancelando.`);
      return { ok: false, message: "Periodo futuro" };
   }

   if (!aesKey) {
      console.error("❌ falta mysql_aes_key");
      process.exit(2);
   }

   await ensureDatabaseAvailable();

   let siiCreds = await fetchCredentials({ type: "SII", aesKey });

   if (cliEntityId) {
      siiCreds = siiCreds.filter(c => String(c.entity_id) === String(cliEntityId));
      if (!siiCreds.length) {
         console.error(`❌ No se encontraron credenciales para entityId ${cliEntityId}`);
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
      console.log("⚠️ no hay credenciales activas.");
      return { ok: true, count: 0 };
   }

   console.log("🔌 iniciando navegador...");
   const browser = await createBrowser();
   const statsReport = { processed: 0, errors: [], details: [] };

   try {
      const processEntity = async (creds) => {
         const label = `${creds.legal_name || "Empresa"} (${creds.rut_sin_dv}-${creds.dv})`;
         const context = await browser.createBrowserContext();
         const page = await context.newPage();

         try {
            console.log(`🔷 procesando: ${label}`);
            const downloadDir = await resolveDownloadDir(creds.entity_id, year);

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
               } catch (err) {
                  console.warn(`⚠️ intento login ${attempt} fallido: ${err.message}`);
                  await sleep(2000);
               }
            }
            if (!logged) throw new Error("fallo login tras 3 intentos");

            const monthsList = fullYear ? monthsOfYear(year) : [{ year, month }];

            for (const { month: mm } of monthsList) {
               if (isFuturePeriod(year, mm, CL_TZ)) {
                  if (fullYear) console.log(`   ⏭️ deteniendo anual en ${year}-${mm} (es futuro)`);
                  break;
               }

               for (const direction of selectedDirections) {
                  console.log(`📅 periodo ${year}-${mm} (${DIRECTIONS[direction].label})...`);

                  try {
                     const { rows, file } = await consultPeriod(page, downloadDir, { year, month: mm, direction, creds });

                     if (!rows.length) {
                        console.log("ℹ️ sin movimientos.");
                        continue;
                     }

                     const stats = await loaderService.loadHonorariosRows(rows, {
                        entityId: creds.entity_id,
                        year,
                        month: mm,
                        direction,
                     });

                     console.log(`💾 BD: ${stats.totals.inserted} nuevos, ${stats.totals.updated} actualizados, ${stats.totals.skipped} omitidos.`);
                     if (stats.totals.skipReasons && Object.keys(stats.totals.skipReasons).length) {
                        console.log(`   ↳ omitidos por motivo: ${JSON.stringify(stats.totals.skipReasons)}`);
                     }
                     statsReport.processed += stats.totals.processed;
                     statsReport.details.push({
                        entityId: creds.entity_id,
                        year,
                        month: mm,
                        direction,
                        downloadPath: file,
                        totals: stats.totals,
                     });
                  } catch (errStep) {
                     await saveDebugSnapshot(page, downloadDir, `debug-honorarios-${direction}-${year}${mm}.html`);
                     console.error(`❌ error mes ${mm} (${DIRECTIONS[direction].label}): ${errStep.message}`);
                     statsReport.errors.push(`Entity ${creds.entity_id} ${direction} ${year}-${mm}: ${errStep.message}`);
                  }

                  await sleep(1000);
               }
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
   runManualSync: (entityId, year, month, options = {}) => run({
      entityId,
      year,
      month,
      directions: options.directions || options.direction || null,
   }),
};
