#!/usr/bin/env node

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const RUT = '258902580';
const CLAVE = 'Hjml2.';

// util: encuentra el frame que contiene el selector dado
async function resolveFrameWith(page, selector, ttlMs = 30_000, pollMs = 200) {
   const t0 = Date.now();
   while (Date.now() - t0 < ttlMs) {
      // 1) main
      const main = page.mainFrame();
      if (await main.$(selector)) return main;

      // 2) iframes
      for (const f of page.frames()) {
         if (await f.$(selector)) return f;
      }
      await new Promise(r => setTimeout(r, pollMs));
   }
   return null;
}

async function waitForFrameUrl(page, regex, { timeout = 45000 } = {}) {
   const t0 = Date.now();
   // chequeo inmediato
   for (const f of page.frames()) if (regex.test(f.url())) return f;

   return new Promise((resolve, reject) => {
      const onNav = f => {
         try { if (regex.test(f.url())) done(null, f); } catch { }
      };
      const timer = setTimeout(() => done(new Error('Timeout esperando frame con URL ' + regex)), timeout);

      function done(err, frame) {
         page.removeListener('framenavigated', onNav);
         clearTimeout(timer);
         err ? reject(err) : resolve(frame);
      }

      page.on('framenavigated', onNav);
      // fallback: poll por si el evento se perdió
      (async function poll() {
         while (Date.now() - t0 < timeout) {
            const hit = page.frames().find(f => regex.test(f.url()));
            if (hit) return done(null, hit);
            await new Promise(r => setTimeout(r, 250));
         }
      })().catch(() => { });
   });
}

async function safeScreenshot(page, path) {
   try {
      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
      // Evita screenshot si aún no hay body o ancho util
      await page.waitForFunction(
         () => document.body && Math.max(document.documentElement.clientWidth, document.body.clientWidth) > 0,
         { timeout: 5000 }
      );
      await page.screenshot({ path, fullPage: true });
   } catch (e) {
      console.warn('screenshot omitido:', e.message);
   }
}

function navWaiters(page, timeout = 45000) {
   // Algunos bancos navegan dentro del iframe y/o el top.
   // Esperamos ambas cosas en paralelo y dejamos que “gane” cualquiera.
   return Promise.race([
      page.waitForNavigation({ waitUntil: ['load', 'networkidle0'], timeout }).catch(() => { }),
      waitForFrameUrl(page, /officebanking\.cl\/(EOB|poc\/eob|eob\/validar|TEFP|CTA|wslogin)/i, { timeout })
   ]);
}

// util: espera a que el frame "se renueve"
// (el form desaparece y vuelve a aparecer, o cambia la url del frame/página)
async function waitForPostSubmitChange(page, { prevUrl, selectorInNextPage = null, timeout = 30_000 }) {
   const end = Date.now() + timeout;

   // 1) si hay navegación de página, la tomamos
   try {
      await page.waitForNavigation({ waitUntil: "networkidle2", timeout: Math.max(1, end - Date.now()) });
      return "navigation";
   } catch (_) { }

   // 2) si define un selector de destino, espéralo (SPA)
   if (selectorInNextPage) {
      try {
         await page.waitForSelector(selectorInNextPage, { timeout: Math.max(1, end - Date.now()) });
         return "selector";
      } catch (_) { }
   }

   // 3) como fallback, espera cambio de URL (SPA) o quietud de red
   try {
      await page.waitForFunction(
         old => location.href !== old,
         { timeout: Math.max(1, end - Date.now()) },
         prevUrl
      );
      return "url-changed";
   } catch (_) { }

   try {
      await page.waitForNetworkIdle({ idleTime: 1500, timeout: Math.max(1, end - Date.now()) });
      return "network-idle";
   } catch (_) { }

   return "timeout";
}

// === escribir credenciales con re-resolución preventiva ===
async function safeType(frameResolver, selector, text, opts = { delay: 20 }) {
   for (let i = 0; i < 2; i++) { // 1 reintento por si el frame se recarga
      try {
         const f = await frameResolver();
         await f.waitForSelector(selector, { visible: true, timeout: 10_000 });
         // usar type directo desde el frame (sin guardar el handle)
         await f.type(selector, text, opts);
         return;
      } catch (e) {
         if (String(e.message || e).includes("Execution context was destroyed") ||
            String(e.message || e).includes("Cannot find context with specified id") ||
            String(e.message || e).includes("Target closed")) {
            // frame se recargó; reintentar
            continue;
         }
         throw e;
      }
   }
   // último intento definitivo con resolución fresca
   const f = await frameResolver();
   await f.waitForSelector(selector, { visible: true, timeout: 10_000 });
   await f.type(selector, text, opts);
}

// helpers reutilizables
async function resolveFrameWith(page, selector, ttlMs = 30_000, pollMs = 200) {
   const t0 = Date.now();
   while (Date.now() - t0 < ttlMs) {
      const main = page.mainFrame();
      if (await main.$(selector)) return main;
      for (const f of page.frames()) {
         if (await f.$(selector)) return f;
      }
      await new Promise(r => setTimeout(r, pollMs));
   }
   return null;
}

async function waitForPostChange(page, { prevUrl, nextSelector = null, timeout = 40_000 }) {
   const end = Date.now() + timeout;
   try { await page.waitForNavigation({ waitUntil: "networkidle2", timeout: Math.max(1, end - Date.now()) }); return "navigation"; } catch { }
   if (nextSelector) {
      try { await page.waitForSelector(nextSelector, { timeout: Math.max(1, end - Date.now()) }); return "selector"; } catch { }
   }
   try { await page.waitForFunction(old => location.href !== old, { timeout: Math.max(1, end - Date.now()) }, prevUrl); return "url-changed"; } catch { }
   try { await page.waitForNetworkIdle({ idleTime: 1500, timeout: Math.max(1, end - Date.now()) }); return "network-idle"; } catch { }
   return "timeout";
}

// función que intenta encontrar y hacer click en “entrar” para la empresa
async function tryClickEmpresa(frame, targetName) {
   return await frame.evaluate((name) => {
      const norm = (s) => (s || "").normalize("NFKD").toLowerCase().replace(/\s+/g, " ").trim();
      const target = norm(name);
      const rows = document.querySelectorAll('#listadoEmpresas table tbody tr[data-test="fila-empresa"]');
      for (const tr of rows) {
         const cell = tr.querySelector('td[data-test="nombre-empresa"]');
         const text = norm(cell?.innerText || cell?.textContent || "");
         if (text.includes(target)) {
            const btn = tr.querySelector('button[name="entrar"], button[data-test="entrar"]') || tr.querySelector('button');
            if (btn) { btn.scrollIntoView({ block: "center" }); btn.click(); return { clicked: true, name: cell?.innerText?.trim() || name }; }
         }
      }
      return { clicked: false };
   }, targetName);
}

// si hay paginación, intenta avanzar hasta encontrar la empresa
async function clickEmpresaConPaginacion(frameResolver, targetName, maxPages = 20) {
   for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
      const f = await frameResolver();
      // esperar a que la tabla esté poblada
      await f.waitForSelector('#listadoEmpresas table tbody tr[data-test="fila-empresa"]', { timeout: 20_000 });

      // intentar click en la página actual
      const res = await tryClickEmpresa(f, targetName);
      if (res.clicked) return { ok: true, foundAs: res.name, page: pageIdx + 1 };

      // buscar botón “siguiente” habilitado
      const nextEnabled = await f.$eval(
         'button[data-test="pagina-siguiente"], button[aria-label="Siguiente"], .pagination [rel="next"]',
         (el) => {
            const b = el;
            return !!b && !b.disabled && !b.getAttribute?.("aria-disabled");
         }
      ).catch(() => false);

      if (!nextEnabled) break;

      // click en siguiente via evaluate (evita stale handles)
      await f.evaluate(() => {
         const btn = document.querySelector('button[data-test="pagina-siguiente"], button[aria-label="Siguiente"], .pagination [rel="next"]');
         if (btn) { btn.scrollIntoView({ block: "center" }); (btn).click(); }
      });

      // esperar a que cambien las filas (mutación simple)
      await f.waitForFunction(() => {
         const tb = document.querySelector('#listadoEmpresas table tbody');
         if (!tb) return false;
         // usa un atributo volátil: cantidad de filas
         const count = tb.querySelectorAll('tr[data-test="fila-empresa"]').length;
         (window).__lastCount = (window).__lastCount || 0;
         if (count !== (window).__lastCount) { (window).__lastCount = count; return true; }
         return false;
      }, { timeout: 15_000 }).catch(() => { });
   }
   return { ok: false };
}

(async () => {

   const browser = await puppeteer.launch({
      headless: false, // o false si quieres ver
      args: ['--window-size=1280,900', '--start-maximized'],
      defaultViewport: { width: 1280, height: 900, deviceScaleFactor: 1 },
   });


   const page = await browser.newPage();

   // timeouts por página (mejor que 'timeout' en launch)
   page.setDefaultTimeout(120_000);
   page.setDefaultNavigationTimeout(120_000);

   // UA: usa el del navegador para no quedarte obsoleto
   const baseUA = await browser.userAgent();
   await page.setUserAgent(baseUA); // o ajusta mínimamente si realmente lo necesitas

   // idioma/locale coherentes
   await page.setExtraHTTPHeaders({ "Accept-Language": "es-CL,es;q=0.9" });
   await page.emulateTimezone("America/Santiago");

   try {

      // === paso 1: login ===
      console.log("🔍 abriendo pagina de login...");

      // ir a la portada con una espera razonable
      await page.goto("https://empresas.officebanking.cl/", {
         waitUntil: "domcontentloaded",
         timeout: 60_000,
      });

      // espera explicita del boton por xpath (si cambia el copy, usar selector css)
      const botonXpath = "//button[contains(normalize-space(.), 'Ingresar')]";
      const botonHandle = await page
         .waitForXPath(botonXpath, { timeout: 60_000 })
         .catch(() => null);

      if (!botonHandle) {
         console.error("❌ no se encontro el boton 'Ingresar'");
         await page.screenshot({ path: `error_no_boton_ingresar_${Date.now()}.png`, fullPage: true });
         throw new Error("no se encontro el boton 'Ingresar'");
      }

      await page.waitForTimeout(2000);

      // click solido (scroll + click via js) para evitar overlays
      await page.evaluate((xpath) => {
         const r = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
         const el = r.singleNodeValue;
         if (el) { el.scrollIntoView({ block: "center", inline: "center" }); (el).click(); }
      }, botonXpath);

      console.log("✅ click en boton 'Ingresar' hecho");

      // === buscar el form, robusto contra recargas ===
      console.log("🔍 Buscando formulario en main o iframes...");

      await page.waitForTimeout(2000);

      let formFrame = await resolveFrameWith(page, "#userInput", 60_000);
      if (!formFrame) {
         console.log("❌ No se encontró #userInput en ningún frame");
         await page.screenshot({ path: `error_no_userinput_${Date.now()}.png`, fullPage: true });
         await browser.close();
         return;
      }
      console.log(`✅ Form encontrado en frame: ${formFrame.url()}`);

      // resolver fresco on-demand (captura la página por cierre sobre variables)
      const getFormFrame = async () => {
         const f = await resolveFrameWith(page, "#userInput", 10_000);
         if (!f) throw new Error("form frame desapareció");
         return f;
      };

      // colocamos un timeout extra antes de interactuar
      await page.waitForTimeout(2000);

      // type seguro
      await safeType(getFormFrame, "#userInput", RUT);
      await safeType(getFormFrame, "#userCodeInput", CLAVE);
      console.log("✅ Credenciales ingresadas");

      // === submit robusto ===
      const prevUrl = page.url();
      const clickLogin = async () => {
         const f = await getFormFrame();
         await f.waitForSelector("#doLoginButton", { visible: true, timeout: 10_000 });
         // evita usar un ElementHandle guardado; reobtén y clickea
         await f.click("#doLoginButton");
      };

      // frameLogin: el frame donde está el formulario de login (p. ej. https://wslogin.officebanking.cl/…)
      await Promise.all([
         (async () => { await clickLogin(); })(),
         navWaiters(page, 60000),
      ]);

      // --- POST-LOGIN ESTABLE ---
      // Espera a que la app cargue algo “real”: o tabla de empresas, o el menú lateral
      await Promise.race([
         page.waitForFunction(() => {
            return !!document.querySelector('#listadoEmpresas table tbody tr');
         }, { timeout: 90_000 }),
         page.waitForFunction(() => {
            return !!document.querySelector('aside app-menu-perfilado, app-menu-perfilado aside, #cont-interior aside');
         }, { timeout: 90_000 })
      ]).catch(() => { });

      await safeScreenshot(page, '01-post-login.png');

      // Si el formulario sigue, avisa (MFA/Error), pero no abortes de inmediato
      const formSigue = await resolveFrameWith(page, "#userInput", 2_000);
      if (formSigue) {
         console.warn("⚠️ El formulario sigue visible; puede haber MFA/CAPTCHA o credenciales inválidas");
         await page.screenshot({ path: `warning_form_persiste_${Date.now()}.png`, fullPage: true });
      } else {
         console.log("✅ Login exitoso y UI cargada");
      }

      // pequeña pausa para que terminen animaciones/loaders
      await page.waitForTimeout(1500);

      // === paso 2: elegir empresa ===
      const empresaNombre = "MONTOYA ASESORIAS SPEED LIMITADA";

      // localiza la tabla en main o iframe
      console.log("🔍 esperando tabla de empresas...");
      const empresasFrame = await resolveFrameWith(page, '#listadoEmpresas table tbody', 30_000);
      if (!empresasFrame) {
         await page.screenshot({ path: `error_no_tabla_empresas_${Date.now()}.png`, fullPage: true });
         throw new Error("no se encontró la tabla de empresas (#listadoEmpresas)");
      }

      const getEmpresasFrame = async () => {
         const fr = await resolveFrameWith(page, '#listadoEmpresas table tbody', 10_000);
         if (!fr) throw new Error("tabla de empresas no disponible");
         return fr;
      };

      console.log(`🔎 buscando empresa: "${empresaNombre}"...`);

      const prevUrl2 = page.url();
      const pick = await clickEmpresaConPaginacion(getEmpresasFrame, empresaNombre, 30);

      if (!pick.ok) {
         await page.screenshot({ path: `error_empresa_no_encontrada_${Date.now()}.png`, fullPage: true });
         throw new Error(`no se encontró la empresa '${empresaNombre}' en la tabla (incluida paginación)`);
      }

      console.log(`✅ empresa seleccionada: ${pick.foundAs} (página ${pick.page})`);

      // esperar transición post-selección (navegación o SPA)
      const outcome2 = await waitForPostChange(page, { prevUrl: prevUrl2, timeout: 45_000 });

      console.log(`ℹ️ post-selección: ${outcome2}`);

      // verificación del menú “Cuentas corrientes” (por texto, robusto a clases/ids)
      console.log("🔍 verificando menú 'Cuentas corrientes'...");

      const menuOk = await page.waitForFunction(() => {
         const norm = (s) => (s || "").toLowerCase().normalize("NFKD");
         const texts = ["cuentas corrientes", "cuenta corriente"];
         const nodes = Array.from(document.querySelectorAll("a, button, [role='menuitem'], li, span, div"));
         return nodes.some(n => {
            const t = norm(n.textContent);
            return t && texts.some(tt => t.includes(tt));
         });
      }, { timeout: 30_000 }).catch(() => null);

      if (!menuOk) {
         console.warn("⚠️ no se detectó el menú 'Cuentas corrientes' todavía; puede haber un loader o layout diferido");
         await page.screenshot({ path: `warning_sin_menu_cuentas_${Date.now()}.png`, fullPage: true });
      } else {
         console.log("✅ menú 'Cuentas corrientes' visible");
      }

      await page.waitForTimeout(2000);

      // === paso 3: ir a "Cuentas Corrientes" / "Saldos y movimientos" ===
      console.log("🔍 navegando a 'Cuentas Corrientes' → 'Saldos y movimientos'...");

      // asegura que el menú lateral ya existe en el DOM
      await page.waitForFunction(() => {
         return !!document.querySelector('aside app-menu-perfilado, app-menu-perfilado aside, #cont-interior aside');
      }, { timeout: 30_000 });

      // todo dentro de evaluate para evitar stale handles
      const didClick = await page.evaluate(() => {
         const norm = s => (s || "").toLowerCase().normalize("NFKD").replace(/\s+/g, " ").trim();

         // 1) localizar TODOS los UL de la estructura tipo disclosure
         const blocks = Array.from(document.querySelectorAll('app-sub-menu-disclose ul.lista-funcs'));

         // 2) elegir el bloque cuyo <span> diga "cuentas corrientes"
         const targetBlock = blocks.find(ul => {
            const sp = ul.querySelector('span');
            return sp && norm(sp.textContent).includes("cuentas corrientes");
         });

         if (!targetBlock) return false;

         // 3) si está colapsado, intentar expandirlo clickeando su span/cabecera
         if (targetBlock.classList.contains('close')) {
            const header = targetBlock.querySelector('span');
            if (header) {
               header.scrollIntoView({ block: "center" });
               header.click();
            }
         }

         // 4) ahora buscar dentro del MISMO bloque el enlace correcto
         const links = Array.from(targetBlock.querySelectorAll('a.obLink, a, button'));
         const link = links.find(a => norm(a.textContent).includes("saldos y movimientos")
            || norm(a.textContent).includes("movimientos"));

         if (!link) return false;

         link.scrollIntoView({ block: "center" });
         link.click();
         return true;
      });

      if (!didClick) {
         await page.screenshot({ path: `error_no_cc_mov_${Date.now()}.png`, fullPage: true });
         throw new Error("no se pudo abrir 'Cuentas Corrientes' o no se encontró 'Saldos y movimientos'");
      }

      console.log("✅ click en 'Cuentas Corrientes' → 'Saldos y movimientos'");

      // esperar efecto (SPA o navegación)
      const prevUrl3 = page.url();
      const outcome3 = await waitForPostChange(page, {
         prevUrl: prevUrl3,
         timeout: 45_000,
      });
      console.log(`ℹ️ post-click movimientos: ${outcome3}`);

      // verificación ligera del módulo de movimientos
      const moduloOk = await page.waitForFunction(() => {
         const bySel = document.querySelector("#movimientosTable, [data-test='movimientos-grid'], .movements-table, table.movimientos, #tabla_transferencias");
         if (bySel) return true;
         const norm = s => (s || "").toLowerCase().normalize("NFKD");
         return Array.from(document.querySelectorAll("h1,h2,h3,span,div,th"))
            .some(n => {
               const t = norm(n.textContent);
               return t && (
                  t.includes("movimientos") ||
                  t.includes("cuenta corriente") ||
                  t.includes("saldo") ||
                  t.includes("fecha desde") ||
                  t.includes("fecha hasta")
               );
            });
      }, { timeout: 30_000 }).catch(() => null);

      if (!moduloOk) {
         console.warn("⚠️ no se detectó el módulo de movimientos aún (¿carga diferida/loader?)");
         await page.screenshot({ path: `warning_sin_modulo_mov_${Date.now()}.png`, fullPage: true });
      } else {
         console.log("✅ módulo de movimientos visible");
      }

      // === Paso 4: operar dentro del iframe existente (sin nueva pestaña) ===
      console.log("🗓️ estableciendo fechas y consultando (en el iframe de la página)…");

      // Asegura viewport válido para evitar screenshots con width=0
      try {
         const vp = page.viewport();
         if (!vp || vp.width === 0 || vp.height === 0) {
            await page.setViewport({ width: 1366, height: 900 });
         }
      } catch { }

      // 1) Espera a que aparezca el iframe y tenga SRC real (no about:blank)
      await page.waitForSelector('iframe#derecho', { timeout: 60000 });

      await page.waitForFunction(() => {
         const f = document.querySelector('iframe#derecho');
         return !!(f && f.src && !/^about:blank$/i.test(f.src));
      }, { timeout: 60000 });


      // === Resolver el frame que realmente contiene los inputs (#FechaDesde/#FechaHasta) ===
      // Busca en todos los frames (y subframes) aquel que tenga los inputs.
      async function findFrameWithSelector(rootPage, selector, timeoutMs = 60000) {
         const start = Date.now();
         while (Date.now() - start < timeoutMs) {
            const frames = rootPage.frames();
            for (const f of frames) {
               try {
                  const handle = await f.$(selector);
                  if (handle) {
                     return f;
                  }
               } catch { }
            }
            await new Promise(r => setTimeout(r, 250));
         }
         throw new Error(`Timeout buscando un frame con el selector ${selector}`);
      }

      // Espera a que el contenedor del iframe exista (aunque sea about:blank)
      await page.waitForSelector('iframe#derecho', { timeout: 60000 }).catch(() => { });
      // Ahora localiza el frame real por presencia de #FechaDesde
      const movFrame = await findFrameWithSelector(page, '#FechaDesde', 60000);

      console.log("iframe url (resuelto por selector):", movFrame.url() || '<sin url/inline>');

      // === Helpers de fecha (si ya los tienes arriba, puedes omitir estas funciones duplicadas) ===
      function formatDMY(d) {
         const dd = String(d.getDate()).padStart(2, '0');
         const mm = String(d.getMonth() + 1).padStart(2, '0');
         const yyyy = d.getFullYear();
         return `${dd}/${mm}/${yyyy}`;
      }
      function parseDMY(str) {
         const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str || '');
         if (!m) return null;
         const dd = Number(m[1]), mm = Number(m[2]), yyyy = Number(m[3]);
         const d = new Date(yyyy, mm - 1, dd);
         return (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) ? d : null;
      }
      function getArg(name) {
         const i = process.argv.indexOf(name);
         return i > -1 ? process.argv[i + 1] : null;
      }
      function computeRangeFromArgs() {
         const desdeArg = getArg('--desde');
         const hastaArg = getArg('--hasta');
         if (desdeArg && hastaArg) {
            const d1 = parseDMY(desdeArg);
            const d2 = parseDMY(hastaArg);
            if (!d1 || !d2) throw new Error('Formato inválido en --desde/--hasta. Usa dd/mm/aaaa');
            if (d1 > d2) throw new Error('--desde no puede ser mayor que --hasta');
            return { desdeStr: formatDMY(d1), hastaStr: formatDMY(d2) };
         }
         // Por defecto: mes calendario vigente completo
         const base = new Date();
         return {
            desdeStr: formatDMY(new Date(base.getFullYear(), base.getMonth(), 1)),
            hastaStr: formatDMY(new Date(base.getFullYear(), base.getMonth() + 1, 0)),
         };
      }

      // Seteo seguro que dispara input/change y respeta IMask/KO
      async function setDateSafelyInFrame(frame, selector, value) {
         const el = await frame.$(selector);
         if (!el) throw new Error(`No se encontró ${selector} en el iframe`);
         // limpiar seleccionando todo y tipeando
         try { await el.click({ clickCount: 3 }); } catch { }
         await el.type(value, { delay: 20 });
         await frame.evaluate((sel) => {
            const n = document.querySelector(sel);
            if (!n) return;
            n.dispatchEvent(new Event('input', { bubbles: true }));
            n.dispatchEvent(new Event('change', { bubbles: true }));
            n.blur?.();
         }, selector);
         // confirmar que quedó seteado
         await frame.waitForFunction((sel, val) => {
            const n = document.querySelector(sel);
            return !!n && (n.value || '').trim() === val;
         }, { polling: 100, timeout: 8000 }, selector, value).catch(() => { });
      }

      // 5) Determina rango (CLI o mes completo)
      const { desdeStr, hastaStr } = computeRangeFromArgs();

      // 6) Setea fechas dentro del iframe
      await setDateSafelyInFrame(movFrame, '#FechaDesde', desdeStr);
      await setDateSafelyInFrame(movFrame, '#FechaHasta', hastaStr);

      // 7) Click en “Consultar” dentro del iframe (usa evaluate para evitar "not clickable")
      const clickedConsultar = await movFrame.evaluate(() => {
         const btn = document.querySelector('button[data-bind*="BuscarMovimientos"]');
         if (!btn) return false;
         btn.scrollIntoView({ block: 'center' });
         btn.click();
         return true;
      });
      if (!clickedConsultar) throw new Error("No se encontró el botón Consultar dentro del iframe");

      // 8) Espera resultados en el iframe: tabla o paginador
      await movFrame.waitForSelector('#tabla_detalle tbody, #paginador', { timeout: 60000 });

      console.log(`✅ Consultado (iframe): ${desdeStr} → ${hastaStr}`);

   } catch (error) {
      console.error("❌ Error general:", error.message);
      await page.screenshot({ path: 'error_general.png', fullPage: true });
   } finally {
      // await browser.close();
   }
})();