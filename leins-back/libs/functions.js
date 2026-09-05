"use strict";

const fs = require("fs/promises");
const path = require("path");
const puppeteer = require("puppeteer");
const { sequelize, models } = require("./sequelize");
const { parse } = require("csv-parse/sync");
const { Credential, Entity } = models;

// urls fijas del sii
const SII_URLS = {
   login: "https://zeusr.sii.cl/AUT2000/InicioAutenticacion/IngresoRutClave.html?https://www4.sii.cl/consdcvinternetui/#/index",
   comprasventas: "https://www4.sii.cl/consdcvinternetui/#/index",
   honorariosEmitidas: "https://loa.sii.cl/cgi_IMT/TMBCOC_MenuConsultasContrib.cgi?dummy=1461943167534",
   honorariosRecibidas: "https://loa.sii.cl/cgi_IMT/TMBCOC_MenuConsultasContribRec.cgi?dummy=1461943244650"
};

// url fijas bancos
const BANK_URLS = {
   login_santander_officebanking: "https://wslogin.officebanking.cl/"
}

// ——— helper robusto para post-login (page o frame) ———
async function waitForPostLogin(page, {
   timeout = 40_000,
   portalHostIncludes = ["officebanking.cl", "ob2", "portal", "channel", "home"],
} = {}) {
   const t0 = Date.now();
   const isInWslogin = () => page.url().includes("wslogin.officebanking.cl");

   // a) carrera entre señales de "salí de wslogin"
   const urlChange = page.waitForFunction(
      (subs) => {
         const href = location.href;
         return subs.some(s => href.includes(s)) && !href.includes("wslogin.");
      },
      { timeout },
      portalHostIncludes
   ).catch(() => { });

   const anyFrameNav = new Promise((resolve) => {
      const onFrameNav = (frame) => {
         try {
            const u = frame.url() || "";
            if (!u) return;
            if (!u.includes("wslogin.") && portalHostIncludes.some(s => u.includes(s))) {
               page.off("framenavigated", onFrameNav);
               resolve({ frame, url: u });
            }
         } catch { }
      };
      page.on("framenavigated", onFrameNav);
      setTimeout(() => {
         page.off("framenavigated", onFrameNav);
         resolve(null);
      }, timeout);
   });

   const portalResponse = page.waitForResponse(res => {
      try {
         const u = res.url();
         return !u.includes("wslogin.") && portalHostIncludes.some(s => u.includes(s));
      } catch { return false; }
   }, { timeout }).catch(() => { });

   // b) algún selector "genérico" que suele existir en home
   const dashboardSelector = Promise.any([
      page.waitForSelector("nav, #menu, .main-menu, [role=navigation]", { timeout }),
      page.waitForSelector("a[href*='cuenta'], a[href*='movimiento'], a[href*='saldo']", { timeout }),
   ]).catch(() => { });

   // c) ejecuta la carrera
   await page.screenshot({ path: "after_submit.png" });
   await Promise.race([urlChange, anyFrameNav, portalResponse, dashboardSelector]);

   // d) si seguimos en wslogin, intenta inspeccionar frames por si cambió contenido sin cambiar url de "page"
   if (isInWslogin()) {
      const frames = page.frames();
      for (const f of frames) {
         const u = f.url() || "";
         if (!u) continue;
         if (!u.includes("wslogin.") && portalHostIncludes.some(s => u.includes(s))) {
            await f.waitForSelector("body", { timeout: 10_000 }).catch(() => { });
            await page.screenshot({ path: "post_login_frame.png" });
            break;
         }
      }
   }

   // e) manejar pantallas intermedias (empresa / términos / mfa)
   // selección de empresa (heurísticas comunes)
   const companyNode = await Promise.any([
      page.$("select[name*='empresa'], select#company, select#empresa"),
      page.$("table[role='grid'] tr td a[href*='empresa'], .company-list a, .seleccion-empresa a")
   ]).catch(() => null);

   if (companyNode) {
      await page.screenshot({ path: "company_prompt.png" });
      // preferimos "legal_name" si está disponible en el título de la página
      try { await companyNode.click({ delay: 10 }); } catch { }
      await page.waitForTimeout(1000);
   }

   // términos / aviso
   const acceptBtn = await Promise.any([
      page.$("button:has-text('Aceptar')"),
      page.$("button:has-text('Continuar')"),
      page.$("input[type=button][value='Aceptar'], input[type=submit][value='Aceptar']"),
   ]).catch(() => null);

   if (acceptBtn) {
      await page.screenshot({ path: "terms_modal.png" });
      try { await acceptBtn.click({ delay: 10 }); } catch { }
      await page.waitForTimeout(800);
   }

   // MFA (si aparece, lo declaramos explícitamente)
   const mfaInput = await Promise.any([
      page.$("input[name='otp'], input#otp, input[name*='token'], input#token"),
   ]).catch(() => null);

   if (mfaInput) {
      await page.screenshot({ path: "mfa_detected.png" });
      throw new Error("MFA requerido: se detectó un campo OTP/TOKEN en post-login.");
   }

   // f) confirmación de dashboard genérico
   await Promise.any([
      page.waitForSelector("nav, #menu, .main-menu, [role=navigation]", { timeout: 10_000 }),
      page.waitForSelector("a[href*='cuenta'], a[href*='movimiento'], a[href*='saldo']", { timeout: 10_000 }),
      page.waitForFunction(
         (subs) => subs.some(s => location.href.includes(s)) && !location.href.includes("wslogin."),
         { timeout: 10_000 },
         portalHostIncludes
      ),
   ]).catch(() => { });

   await page.screenshot({ path: "dashboard_ready.png" });

   const ms = Date.now() - t0;
   console.log(`✅ post-login listo en ~${ms}ms`);
}


// crea un directorio si no existe
async function ensureDir(dirPath) {
   const abs = path.isAbsolute(dirPath) ? dirPath : path.resolve(process.cwd(), dirPath);
   await fs.mkdir(abs, { recursive: true });
   return abs;
}

// lee credenciales por tipo ('SII' | 'BANK')
const BANK_ADAPTERS = {
   "santander-officebanking": (secret) => ({
      bank: "santander-officebanking",
      username: secret.rut_sin_dv || secret.username || "",
      dv: secret.dv || "",
      password: secret.clave || secret.password || "",
   }),
   // agrega otros bancos aqui...
   "default": (secret) => ({
      bank: secret.bank || "",
      username: secret.username || secret.rut_sin_dv || "",
      dv: secret.dv || "",
      password: secret.password || secret.clave || "",
   }),
};

async function fetchCredentials({
   type = "SII",
   aesKey,
   onlyWithEntity = true,
   banks = [], // <— nuevo
}) {
   if (!aesKey) throw new Error("aesKey requerido para desencriptar");
   if (type !== "SII" && type !== "BANK") throw new Error(`type inválido: ${type}`);

   const rows = await Credential.findAll({
      where: { type },
      attributes: [
         "id",
         "entity_id",
         "user_id",
         "type",
         "created_by",
         "created_at",
         [
            sequelize.literal(
               `CAST(AES_DECRYPT(FROM_BASE64(secret_encrypted), ${sequelize.escape(aesKey)}) AS CHAR)`
            ),
            "secret_json",
         ],
      ],
      include: [{
         model: Entity,
         as: "entity",
         attributes: ["id", "legal_name", "tax_id"],
         required: !!onlyWithEntity,
      }],
      order: [["entity_id", "ASC"], ["id", "ASC"]],
      raw: true,
   });

   const mapped = rows.map((r) => {
      let secret = {};
      try { secret = JSON.parse(r.secret_json || "{}"); } catch { }

      const base = {
         id: r.id,
         type: r.type,
         entity_id: r.entity_id ?? null,
         user_id: r.user_id ?? null,
         created_by: r.created_by,
         created_at: r.created_at,
         legal_name: r["entity.legal_name"] ?? null,
         tax_id: r["entity.tax_id"] ?? null,
      };

      if (type === "SII") {
         return {
            ...base,
            rut_sin_dv: secret.rut_sin_dv || secret.rut || "",
            dv: secret.dv || "",
            clave: secret.clave || "",
         };
      }

      // BANK: usar adapter por proveedor (si no hay, default)
      const provider = (secret.bank || "").toLowerCase();
      const adapter = BANK_ADAPTERS[provider] || BANK_ADAPTERS["default"];
      const bankOut = adapter(secret);

      return {
         ...base,
         bank: bankOut.bank,
         username: bankOut.username,
         dv: bankOut.dv,
         password: bankOut.password,
      };
   });

   // validaciones finales por tipo + filtro por bancos solicitados
   if (type === "SII") {
      return mapped.filter(x => x.rut_sin_dv && x.dv && x.clave);
   }

   // BANK: si banks está vacío, no filtra; si no, incluye solo coincidencias exactas
   const banksLower = banks.map(b => b.toLowerCase());
   return mapped.filter(x => {
      const hasCore = x.bank && x.username && x.password; // minimos requeridos
      const okBank = !banksLower.length || banksLower.includes((x.bank || "").toLowerCase());
      return hasCore && okBank;
   });
}

// iniciar sesion en SII
async function loginSII(page, rutSinDv, dv, clave, timeoutMs = 30_000) {
   console.log("🔑 login SII...");
   await page.goto(SII_URLS.login, { waitUntil: "domcontentloaded", timeout: timeoutMs });
   await page.waitForSelector("#rutcntr", { timeout: timeoutMs });
   await page.waitForSelector("#clave", { timeout: timeoutMs });

   await page.type("#rutcntr", rutSinDv + dv, { delay: 10 });
   await page.type("#clave", clave, { delay: 10 });

   await Promise.all([
      page.click("#bt_ingresar"),
      page.waitForNavigation({ waitUntil: "networkidle0", timeout: timeoutMs }),
   ]);
   console.log('✅ Login exitoso');
}

// espera a que el panel lateral este visible y estable
async function waitForPanelOpen(page, { panelSelector, expandedSelector, timeoutMs = 30000 }) {
   // si hay un nodo con aria-expanded, esperar true
   if (expandedSelector) {
      await page.waitForFunction(
         (sel) => {
            const el = document.querySelector(sel);
            if (!el) return false;
            const aria = el.getAttribute('aria-expanded');
            const cls = el.className || '';
            return aria === 'true' || /\b(open|is-open|expanded|active)\b/i.test(cls);
         },
         { timeout: timeoutMs },
         expandedSelector
      );
   }

   // esperar visibilidad y tamanio > 0
   await page.waitForSelector(panelSelector, { visible: true, timeout: timeoutMs });
   await page.waitForFunction(
      (sel) => {
         const el = document.querySelector(sel);
         if (!el) return false;
         const rect = el.getBoundingClientRect();
         const st = getComputedStyle(el);
         return rect.width > 0 && rect.height > 0 && st.display !== 'none' && st.visibility !== 'hidden';
      },
      { timeout: timeoutMs },
      panelSelector
   );

}

// abre el panel usando el handle del boton, si aun no esta visible
async function ensureSidebarOpenWithHandle(page, { buttonHandle, panelSelector, expandedSelector, timeoutMs = 30000 }) {
   const isOpen = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      const st = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && st.display !== 'none' && st.visibility !== 'hidden';
   }, panelSelector);

   if (!isOpen) {
      // foco + scroll + click para disparar eventos reales
      await buttonHandle.evaluate(el => el.scrollIntoView({ block: 'center', inline: 'center' }));
      try { await buttonHandle.focus(); } catch (_) { }
      await buttonHandle.click({ delay: 10 });
      await waitForPanelOpen(page, { panelSelector, expandedSelector, timeoutMs });
   }
}

// busca un selector dentro del contenedor del panel
async function waitInPanel(page, panelSelector, innerSelector, timeoutMs = 30000) {
   // esperar a que inner exista dentro del panel
   await page.waitForFunction(
      ({ p, s }) => {
         const panel = document.querySelector(p);
         return !!(panel && panel.querySelector(s));
      },
      { timeout: timeoutMs },
      { p: panelSelector, s: innerSelector }
   );
   // devolver el handle del elemento dentro del panel
   const handle = await page.$(`${panelSelector} ${innerSelector}`);
   if (!handle) throw new Error(`no se encontro ${innerSelector} dentro de ${panelSelector}`);
   return handle;
}

// login banco santander - officebanking con barra lateral
async function loginBankSantanderOfficebanking(page, rutSinDv, dv, clave, timeoutMs = 30_000) {
   console.log("🔑 login bank santander-officebanking...");

   // 1) ir a la landing donde esta el boton ingresar
   await page.goto(BANK_URLS.login_santander_officebanking, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs
   });

   await page.screenshot({ path: 'pagina.png' });

   // selectores dentro del frame (no uses panelSelector aquí)
   const rutSelector = '#userInput';
   const passSelector = '#userCodeInput';
   const submitSelector = '#doLoginButton';

   // espera y rellena dentro del frame
   const rutInput = await page.waitForSelector(rutSelector, { visible: true, timeout: timeoutMs });
   await rutInput.click({ clickCount: 3 });
   await rutInput.type(rutSinDv + dv, { delay: 10 });  // tu flujo actual concatena el DV en el mismo input

   const passInput = await page.waitForSelector(passSelector, { visible: true, timeout: timeoutMs });
   await passInput.click({ clickCount: 3 });
   await passInput.type(clave, { delay: 10 });

   // enviar y esperar navegación (page o frame; el que ocurra primero)
   const submitBtn = await page.waitForSelector(submitSelector, { visible: true, timeout: timeoutMs });
   await submitBtn.evaluate(el => el.scrollIntoView({ block: 'center' }));

   await page.screenshot({ path: 'con_cred.png' });

   await Promise.race([
      (async () => {
         await Promise.allSettled([
            submitBtn.click({ delay: 10 }),
            page.waitForNavigation({ waitUntil: 'networkidle0', timeout: timeoutMs }).catch(() => { }),
         ]);
      })(),
      (async () => {
         // algunos sitios cambian el contenido dentro del mismo frame
         await Promise.allSettled([
            submitBtn.click({ delay: 10 }),
            page.waitForSelector('body *', { timeout: timeoutMs }).catch(() => { })
         ]);
      })()
   ]);

   console.log('✅ login enviado desde el frame de wslogin.officebanking.cl');

}

// navega por paginas pasadas por parametros
async function navigatePages(page, urls, {
   waitUntil = "domcontentloaded",
   delayMs = 1000,
   lastSelector = null,
   timeout = 30_000,
} = {}) {
   if (!Array.isArray(urls) || urls.length === 0) {
      throw new Error("navigatePages: 'urls' debe ser un arreglo con al menos 1 url");
   }

   page.setDefaultNavigationTimeout(timeout);

   for (let i = 0; i < urls.length; i++) {
      const url = String(urls[i]).trim();
      if (!url) continue;

      console.log(`🌐 navegando a: ${url}`);
      try {
         await page.goto(url, { waitUntil, timeout });
      } catch (err) {
         throw new Error(`fallo al navegar a ${url}: ${err && err.message ? err.message : err}`);
      }

      if (delayMs > 0) {
         await new Promise(r => setTimeout(r, delayMs));
      }

      if (i === urls.length - 1 && lastSelector) {
         await page.waitForSelector(lastSelector, { timeout });
      }
   }
   console.log("✅ navegación completada");
}

// formulario de compra/venta
async function fillComprasVentasForm(page, { rut, mes, anho, timeout = 30_000 }) {
   console.log(`📝 completando formulario (RUT: ${rut}, periodo: ${anho}-${mes})`);

   await page.waitForSelector('form[name="formContribuyente"]', { timeout });

   if (rut) {
      await page.select('form[name="formContribuyente"] select[name="rut"]', rut);
   }

   if (mes) {
      await page.select('#periodoMes', mes);
   }
   if (anho) {
      await page.select('form[name="formContribuyente"] select[ng-model="periodoAnho"]', anho);
   }

   // envía el formulario
   await page.click('form[name="formContribuyente"] button[type="submit"]');

   // SPA-safe: espera EITHER navegación o que aparezca el botón de descarga
   const downloadBtnXPath = "//button[contains(., 'Descargar Detalles')]";
   await Promise.race([
      page.waitForNavigation({ waitUntil: "networkidle0", timeout }).catch(() => false),
      page.waitForSelector(`xpath/${downloadBtnXPath}`, { timeout }).catch(() => false),
   ]);

   console.log("✅ formulario enviado, esperando resultados...");
}

// pasa el ano y el mes
function getYearMonthPair(yearInput, monthInput) {
   const year = Number(yearInput);
   const month = Number(monthInput);

   if (!Number.isFinite(year) || year < 2000) {
      throw new Error(`año inválido: ${yearInput}`);
   }
   if (!Number.isFinite(month) || month < 1 || month > 12) {
      throw new Error(`mes inválido: ${monthInput}`);
   }

   return {
      year: String(year),
      month: String(month).padStart(2, "0"),
   };
}

// crea un navegador limpio en modo headless moderno
async function createBrowser(options = {}) {
   const {
      headless = "new",
      args = [
         "--no-sandbox",
         "--disable-setuid-sandbox",
         "--disable-dev-shm-usage",
      ],
   } = options;

   const browser = await puppeteer.launch({ headless, args });
   return browser;
}

// prepara una page lista para scraping/descargas 
async function preparePage(page, opts = {}) {
   const {
      downloadDir,
      navTimeout = 90_000,
      defaultTimeout = 90_000,
      acceptLanguage = "es-CL,es;q=0.9,en;q=0.8",
      blockResources = true,
      setModernUserAgent = true,
      customUserAgent,
   } = opts;

   page.setDefaultNavigationTimeout(navTimeout);
   page.setDefaultTimeout(defaultTimeout);

   if (customUserAgent) {
      await page.setUserAgent(customUserAgent);
   } else if (setModernUserAgent) {
      const defaultUA = await page.browser().userAgent();
      await page.setUserAgent(defaultUA.replace("Headless", ""));
   }

   await page.setExtraHTTPHeaders({ "Accept-Language": acceptLanguage });

   if (blockResources && !page.__requestHookInstalled) {
      await page.setRequestInterception(true);
      page.on("request", (req) => {
         try {
            const t = req.resourceType();
            if (t === "image" || t === "media" || t === "font") return req.abort();
            return req.continue();
         } catch (_) {
            // si otro handler ya resolvió el request, ignoramos
         }
      });
      page.__requestHookInstalled = true;
   }

   if (downloadDir) {
      const abs = path.isAbsolute(downloadDir)
         ? downloadDir
         : path.resolve(process.cwd(), downloadDir);
      await fs.mkdir(abs, { recursive: true });

      const client = await page.target().createCDPSession();
      await client.send("Page.setDownloadBehavior", {
         behavior: "allow",
         downloadPath: abs,
      });
   }
}

function parseFilenameFromContentDisposition(cd) {
   if (!cd) return null;
   const m = cd.match(/filename\*?=(?:UTF-8'')?"?([^"]+)"?/i);
   return m ? decodeURIComponent(m[1]) : null;
}

async function waitAndSaveAttachment(page, { timeout = 60000, downloadDir = "/tmp", nameHint = "detalle" } = {}) {
   const res = await page.waitForResponse(
      (r) => {
         const headers = r.headers();
         const cd = (headers && headers["content-disposition"]) || "";
         const ct = (headers && headers["content-type"]) || "";
         return (cd && cd.toLowerCase().includes("attachment")) ||
            /text\/csv|application\/octet-stream|application\/vnd\.ms-excel|application\/zip|application\/pdf/i.test(ct);
      },
      { timeout }
   );

   const headers = res.headers() || {};
   const cd = headers["content-disposition"] || "";
   const suggested = parseFilenameFromContentDisposition(cd) || `${nameHint}-${Date.now()}.bin`;
   const filePath = path.join(downloadDir, suggested);
   const buf = await res.buffer();
   await fs.writeFile(filePath, buf);
   return filePath;
}

async function waitForBlobSaved(page, timeout = 60000) {
   const start = Date.now();
   while (Date.now() - start < timeout) {
      if (page.__lastSavedFile) return page.__lastSavedFile; // Node-side
      const p = await page.evaluate(() => (window.__lastSavedFile || null)).catch(() => null); // Browser-side
      if (p) return p;
      await new Promise(r => setTimeout(r, 300));
   }
   return null;
}
// instala los ganchos de descarga solo una vez por "page"
async function ensureDownloadHooks(page, downloadDir) {
   // 1) expone función Node -> browser (solo una vez) y devuelve la ruta
   if (!page.__blobHookExposed) {
      try {
         await page.exposeFunction("__saveBlobBase64", async (base64, filename) => {
            const buf = Buffer.from(base64, "base64");
            const safeName = filename || `download_${Date.now()}.csv`;
            const filePath = path.join(downloadDir, safeName);
            await fs.writeFile(filePath, buf);
            page.__lastSavedFile = filePath;
            return filePath;
         });
      } catch (e) {
         if (!String(e.message || "").includes("name __saveBlobBase64")) throw e;
      }
      page.__blobHookExposed = true;
   }

   // 2) inyección para nuevos documentos: A.click, data:, blob:, y URL.createObjectURL
   if (!page.__downloadHookInjected) {
      await page.evaluateOnNewDocument(() => {
         if (window.__downloadHookInjected) return;
         window.__downloadHookInjected = true;

         // A) Parchea URL.createObjectURL para blobs generados en runtime
         const origCreate = URL.createObjectURL;
         URL.createObjectURL = function (blob) {
            try {
               const r = new FileReader();
               r.onload = () => {
                  const b64 = String(r.result).split(",")[1] || "";
                  const suggested = (blob && (blob.name || blob.filename)) || "download.bin";
                  if (window.__saveBlobBase64) {
                     window.__saveBlobBase64(b64, suggested).then((p) => { window.__lastSavedFile = p; });
                  }
               };
               r.readAsDataURL(blob);
            } catch { }
            return origCreate.apply(this, arguments);
         };

         // B) Intercepta clicks de <a> (blob: y data:)
         const A = HTMLAnchorElement.prototype;
         const origClick = A.click;
         A.click = function (...args) {
            try {
               const href = this.getAttribute("href") || "";
               const dl = this.getAttribute("download") || "download.csv";

               if (href.startsWith("data:")) {
                  const parts = href.split(",");
                  const b64 = parts[1] || "";
                  if (window.__saveBlobBase64) {
                     window.__saveBlobBase64(b64, dl).then((p) => { window.__lastSavedFile = p; });
                  }
               } else if (href.startsWith("blob:")) {
                  fetch(href).then(r => r.blob()).then(blob => {
                     const r = new FileReader();
                     r.onload = () => {
                        const b64 = String(r.result).split(",")[1] || "";
                        if (window.__saveBlobBase64) {
                           window.__saveBlobBase64(b64, dl).then((p) => { window.__lastSavedFile = p; });
                        }
                     };
                     r.readAsDataURL(blob);
                  }).catch(() => { });
               }
            } catch { }
            return origClick.apply(this, args);
         };
      });
      page.__downloadHookInjected = true;
   }

   // 3) listener de attachments (respuestas con Content-Disposition)
   if (!page.__attachmentListener) {
      page.on("response", async (resp) => {
         try {
            const cd = resp.headers()["content-disposition"] || "";
            if (!/attachment/i.test(cd)) return;

            const m = cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
            const rawName = m && m[1] ? decodeURIComponent(m[1]) : `download_${Date.now()}.csv`;
            const buf = await resp.buffer();
            const filePath = path.join(downloadDir, rawName);
            await fs.writeFile(filePath, buf);
            page.__lastSavedFile = filePath;
         } catch { }
      });
      page.__attachmentListener = true;
   }
}

// boton que descarga un csv (click → (posible) modal → espera attachment o blob → si no, forzar Angular)
async function clickAndDownload(page, buttonSelector, downloadDir, { timeout = 90000, nameHint = "Detalle" } = {}) {
   console.log(`⬇️ esperando botón: ${buttonSelector}`);

   await ensureDownloadHooks(page, downloadDir);

   // resolver el boton (xpath o css)
   let button;
   if (buttonSelector.startsWith("//")) {
      try {
         button = await page.waitForSelector(`xpath/${buttonSelector}`, { timeout: Math.min(15000, timeout) });
      } catch {
         const handle = await page.evaluateHandle((xp) => {
            const res = document.evaluate(xp, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
            return res.singleNodeValue;
         }, buttonSelector);
         button = handle && handle.asElement ? handle.asElement() : null;
      }
   } else {
      await page.waitForSelector(buttonSelector, { timeout: Math.min(15000, timeout) });
      button = await page.$(buttonSelector);
   }
   if (!button) throw new Error(`No se encontró el botón: ${buttonSelector}`);

   // reset de flags de la iteración anterior
   page.__lastSavedFile = null;
   try { await page.evaluate(() => { window.__lastSavedFile = null; }); } catch { }

   await button.evaluate((el) => el.scrollIntoView({ block: "center", inline: "center" }));
   await button.click({ delay: 40 });

   // posible confirmacion
   try {
      const modalBtn = await page.waitForSelector(
         [
            "xpath///button[contains(., 'Aceptar')]",
            "xpath///button[contains(., 'Confirmar')]",
            "xpath///button[contains(., 'Descargar')]",
            ".modal-dialog .btn-primary",
            ".swal2-confirm",
         ].join(","),
         { timeout: 3000 }
      );
      if (modalBtn) await modalBtn.click({ delay: 40 });
   } catch { }

   console.log("📥 esperando archivo…");
   const result = await Promise.race([
      waitAndSaveAttachment(page, { timeout: Math.floor(timeout * 0.7), downloadDir, nameHint }).catch(() => null),
      waitForBlobSaved(page, Math.floor(timeout * 0.7))
   ]);

   if (result) {
      console.log(`✅ archivo guardado: ${result}`);
      return result;
   }

   // ultimo intento: invocar AngularJS directamente (si es AngularJS 1.x)
   try {
      const invoked = await page.evaluate(() => {
         try {
            if (typeof angular !== "undefined") {
               const el = document.querySelector("button[ng-click*='descargaDetalle']");
               if (!el) return false;
               const scope = angular.element(el).scope();
               if (scope && typeof scope.descargaDetalle === "function") {
                  scope.$apply(() => scope.descargaDetalle());
                  return true;
               }
            }
         } catch { }
         return false;
      });
      if (invoked) {
         const again = await Promise.race([
            waitAndSaveAttachment(page, { timeout: Math.floor(timeout * 0.3), downloadDir, nameHint }).catch(() => null),
            waitForBlobSaved(page, Math.floor(timeout * 0.3))
         ]);
         if (again) {
            console.log(`✅ archivo guardado (angular): ${again}`);
            return again;
         }
      }
   } catch { }

   console.warn("⚠️ no se detectó archivo descargado en el tiempo esperado");
   return null;
}

const sleep = (ms) => new Promise(res => setTimeout(res, ms));

function getNowYearMonth(tz) {
   const parts = new Intl.DateTimeFormat("es-CL", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
   }).formatToParts(new Date());
   const y = Number(parts.find(p => p.type === "year").value);
   const m = Number(parts.find(p => p.type === "month").value);
   return { y, m };
}

function isFuturePeriod(yearStr, monthStr, tz) {
   const { y, m } = getNowYearMonth(tz);
   const yy = Number(yearStr);
   const mm = Number(monthStr);
   return (yy > y) || (yy === y && mm > m);
}

function arg(name, fallback) {
   const a = process.argv.find(v => v.startsWith(`--${name}=`));
   return a ? a.split("=")[1] : fallback;
}
function parseTypes(argStr) {
   if (!argStr) return null;
   const arr = String(argStr).split(",").map(s => Number(s.trim())).filter(Number.isFinite);
   return arr.length ? arr : null;
}
function monthsOfYear(year) {
   return Array.from({ length: 12 }, (_, i) => ({
      year: String(year),
      month: String(i + 1).padStart(2, "0")
   }));
}


// lee y parsea un archivo CSV en objetos JS
async function parseCsvFile(filePath, {
   delimiter = ";",
   encoding = "utf8",
} = {}) {
   console.log(`📂 leyendo CSV: ${filePath}`);
   const content = await fs.readFile(filePath, encoding);

   const records = parse(content, {
      columns: true,          // usa la 1a fila como encabezado
      delimiter: ";",
      bom: true,              // por si trae BOM
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,   // <<< permite filas con más/menos columnas
      relax_quotes: true,         // <<< tolera comillas raras
      quote: '"',
      escape: '"',
   });

   console.log(`✅ ${records.length} filas parseadas`);
   return records;
}

module.exports = {
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
   parseCsvFile,
   loginBankSantanderOfficebanking,
   waitForPostLogin
};
