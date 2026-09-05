#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env") });

const {
  loginSII,
  createBrowser,
  preparePage,
  sleep
} = require("../libs/functions");

const DEBUG_DIR = "/var/www/micuenta.leinsadvisor.cl";

function arg(name, def = "") {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 && process.argv[idx + 1] ? process.argv[idx + 1] : def;
}

async function saveDebug(page, name) {
  fs.writeFileSync(path.join(DEBUG_DIR, `${name}.html`), await page.content());
  await page.screenshot({
    path: path.join(DEBUG_DIR, `${name}.png`),
    fullPage: true
  });
}

async function clickByText(page, regex) {
  const ok = await page.evaluate((source, flags) => {
    const re = new RegExp(source, flags);
    const els = [...document.querySelectorAll("button, a, input[type='button'], input[type='submit']")];

    const el = els.find(e => {
      const text = (e.innerText || e.value || "").trim();
      return re.test(text) && !e.disabled;
    });

    if (!el) return false;

    el.scrollIntoView({ block: "center" });
    el.click();
    return true;
  }, regex.source, regex.flags);

  if (!ok) {
    throw new Error(`No encontré botón: ${regex}`);
  }
}

async function setValue(page, selector, value) {
  await page.waitForSelector(selector, { timeout: 30000 });
  await page.focus(selector);

  await page.keyboard.down("Control");
  await page.keyboard.press("A");
  await page.keyboard.up("Control");
  await page.keyboard.press("Backspace");

  await page.type(selector, value, { delay: 60 });

  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
  }, selector);
}

async function check(page, selector) {
  await page.waitForSelector(selector, { timeout: 30000 });

  const checked = await page.$eval(selector, el => el.checked);

  if (!checked) {
    await page.click(selector);
  }
}

async function esperarNoSalaEspera(page) {
  for (let i = 1; i <= 120; i++) {
    const html = await page.content();

    const enSala =
      html.includes("Pronto será tu turno") ||
      html.includes("Espera estimada") ||
      html.toLowerCase().includes("queue-it") ||
      html.toLowerCase().includes("salaespera");

    if (!enSala) return;

    console.log(`Esperando sala SII ${i}/120`);
    await saveDebug(page, "debug-sala-espera");
    await sleep(30000);
  }

  throw new Error("SII mantuvo la sesión en sala de espera.");
}

async function run() {
  const rut = arg("rut");
  const dv = arg("dv");
  const clave = arg("clave");

  const destRut = arg("destRut");
  const destEmail = arg("destEmail");
  const destInstitucion = arg("destInstitucion", "Contador");

  if (!rut || !dv || !clave || !destRut || !destEmail) {
    throw new Error("Faltan parámetros: --rut --dv --clave --destRut --destEmail");
  }

  console.log("Iniciando navegador SII con configuración existente...");

  const browser = await createBrowser();
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  try {
    await preparePage(page, {
      downloadDir: "/tmp",
      navTimeout: 60000,
      blockResources: false
    });

    console.log("Login SII...");

    await loginSII(page, rut, dv, clave);

    await sleep(3000);
    await saveDebug(page, "debug-01-post-login");

    console.log("Entrando a carpeta tributaria regular...");

    await page.goto("https://www2.sii.cl/carpetatributaria/generarcteregular", {
      waitUntil: "networkidle2",
      timeout: 60000
    });

    await esperarNoSalaEspera(page);

    await sleep(3000);
    await saveDebug(page, "debug-02-carpeta");

    console.log("Continuar inicial...");

    await clickByText(page, /continuar/i);

    await sleep(3000);
    await saveDebug(page, "debug-03-formulario");

    console.log("Completando formulario...");

    await setValue(page, "#rutEmisor", destRut);
    await sleep(1500);

    await setValue(page, "#emailDestinatario", destEmail);
    await setValue(page, "#verificaEmail", destEmail);

    await check(page, "#flexRadioDefault1");

    await setValue(page, "#otrainstitucion", destInstitucion);

    await check(page, "#flexCheckDefault");

    await sleep(3000);
    await saveDebug(page, "debug-04-formulario-completo");

    const estado = await page.evaluate(() => {
      const rut = document.querySelector("#rutEmisor")?.value || "";
      const email = document.querySelector("#emailDestinatario")?.value || "";
      const email2 = document.querySelector("#verificaEmail")?.value || "";
      const inst = document.querySelector("#otrainstitucion")?.value || "";
      const continuar = [...document.querySelectorAll("button")]
        .find(b => /continuar/i.test(b.innerText || ""));

      return {
        rut,
        email,
        email2,
        inst,
        continuarDisabled: continuar ? continuar.disabled : null
      };
    });

    console.log("Estado formulario:", JSON.stringify(estado));

    if (estado.continuarDisabled === true) {
      throw new Error("Botón Continuar deshabilitado. Revisar debug-04-formulario-completo.png");
    }

    console.log("Continuar formulario...");

    await clickByText(page, /continuar/i);

    await sleep(3000);
    await saveDebug(page, "debug-05-modal");

    console.log("Aceptando modal...");

    await clickByText(page, /aceptar/i);

    await sleep(10000);
    await saveDebug(page, "debug-06-despues-aceptar");

    console.log("Proceso completado hasta aceptar modal.");

  } finally {
    await context.close();
    await browser.close();
  }
}

run().catch(err => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
