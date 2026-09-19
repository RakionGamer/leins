# Plan: migrar el despliegue de producción a la rama `vps-sync`

## Contexto

Al diagnosticar un bug de importación de cartolas bancarias (fechas nativas de Excel mal
parseadas, ver fix en `services/bank.service.js` commit `7676ea4` de `vps-sync`), se descubrió
que el proceso PM2 `leinsadvisor-api` en producción **no corre desde la rama `vps-sync`**:

- PM2 corre desde `/var/www/api.leinsadvisor.cl/htdocs/server.js` (`exec cwd`:
  `/var/www/api.leinsadvisor.cl/htdocs`).
- Esa carpeta está en la rama local **`Harry`**, parada en el commit `1878c14`
  ("Mejora conciliacion bancaria y deduplicacion de cartolas"), con **~90 archivos
  modificados sin commitear** (incluye `.env`, `ecosystem.config.js`, `.vscode/sftp.json`)
  y varios archivos sin trackear. Todo indica que esta carpeta se edita directo por SFTP,
  no por git.
- `master` local apunta al mismo commit viejo `1878c14`.
- Existe una segunda copia en `/opt/leins-deploy`, ya en la rama `vps-sync` y sincronizada
  con `origin/vps-sync`, pero **PM2 no la usa**.
- El fix del bug de cartolas se aplicó de forma manual (`cp` de los archivos extraídos con
  `git show origin/vps-sync:...`) directo sobre `htdocs`, **sin pasar por git** — no quedó
  registrado en ningún commit de esa carpeta.

## Objetivo

Consolidar el despliegue de `leinsadvisor-api` en una única fuente de verdad (la rama
`vps-sync` del repo `git@github.com:RakionGamer/leins.git`), sin perder configuración de
producción ni causar downtime evitable.

## Riesgos a tener en cuenta

- Cambiar de rama en `htdocs` (`git checkout vps-sync`) sobreescribiría `.env` y
  `ecosystem.config.js` con lo que exista en `vps-sync`, que puede no tener credenciales o
  configuración agregada directamente en producción.
- Cualquier `git pull`/`checkout`/reconstrucción futura de `htdocs` puede revertir en
  silencio el parche manual de `bank.service.js` / `bank.controller.js`.
- No hay certeza de si existen más hotfixes "fantasma" (nunca commiteados) escondidos entre
  los ~90 archivos modificados en `htdocs`, más allá de los dos que ya identificamos.

## Plan propuesto

### Fase 0 — Snapshot de seguridad (no afecta el proceso corriendo)

1. En `htdocs`, comitear el estado sucio actual tal cual, en su propia rama, para tener un
   punto de recuperación:
   ```bash
   cd /var/www/api.leinsadvisor.cl/htdocs
   git add -A
   git commit -m "snapshot: estado de produccion antes de migrar a vps-sync"
   git tag pre-vps-sync-migration
   ```
   Esto no reinicia ni toca el proceso PM2, solo graba el estado en git local (sin pushear).

### Fase 1 — Diff de configuración crítica

2. Comparar `.env` y `ecosystem.config.js` del snapshot recién hecho contra `origin/vps-sync`:
   ```bash
   git diff --strip-trailing-cr HEAD origin/vps-sync -- .env ecosystem.config.js
   ```
3. Documentar a mano cada diferencia real (variable nueva, valor cambiado, ruta distinta).
   Si `vps-sync` no tiene algo que sí está en producción, hay que agregarlo después del corte.

### Fase 2 — Preparar la carpeta canónica (`/opt/leins-deploy`)

4. Usar `/opt/leins-deploy` (ya limpio, ya en `vps-sync`) como la carpeta real de despliegue
   en vez de intentar "limpiar" `htdocs` in situ.
5. Copiar a `/opt/leins-deploy/.env` solo las claves faltantes/diferentes detectadas en la
   Fase 1 (nunca reemplazar el archivo entero a ciegas).
6. Revisar que `/opt/leins-deploy/ecosystem.config.js` tenga las mismas rutas de logs, cron
   jobs y variables de entorno que `htdocs` (`SII_DOWNLOAD_DIR`, `TZ`, etc.).
7. Confirmar versión de Node compatible (`node -v`; PM2 hoy corre con Node 20.19.4) y correr
   `npm install` en `/opt/leins-deploy` si su `package-lock.json` difiere del de `htdocs`.

### Fase 3 — Corte (ventana de mantenimiento breve)

8. `pm2 stop leinsadvisor-api`
9. Re-registrar el proceso apuntando a la nueva ruta:
   ```bash
   pm2 delete leinsadvisor-api
   cd /opt/leins-deploy
   pm2 start ecosystem.config.js --only leinsadvisor-api
   pm2 save
   ```
10. Verificar `pm2 status` (`online`) y `pm2 logs leinsadvisor-api --lines 100` sin errores de
    arranque (conexión a BD, etc.).
11. Repetir la prueba de subida de cartola (`test.xlsx`) para confirmar que el fix sigue
    funcionando desde la nueva ubicación.

### Fase 4 — Cierre

12. Con el proceso estable 24-48h, renombrar `/var/www/api.leinsadvisor.cl/htdocs` a
    `htdocs.old-<fecha>` (no borrar) para que nadie vuelva a desplegar ahí por error.
13. Documentar en el repo (README o `docs/`) cuál es la carpeta oficial de despliegue y el
    flujo correcto (`git pull origin vps-sync && pm2 restart leinsadvisor-api`), para dejar de
    depender de ediciones directas por SFTP.

## Verificación final

- `pm2 show leinsadvisor-api` → `exec cwd` apunta a `/opt/leins-deploy`.
- `git -C /opt/leins-deploy log -1` coincide con `origin/vps-sync`.
- Subida de cartola con fechas nativas de Excel sigue funcionando (no regresión del bug
  original).
- Conciliación bancaria, listado de movimientos y demás funcionalidades de `bank.*` operan
  con normalidad (probar los flujos usados a diario, no solo el upload).

## Rollback

Si algo falla en la Fase 3:
```bash
pm2 delete leinsadvisor-api
cd /var/www/api.leinsadvisor.cl/htdocs
pm2 start ecosystem.config.js --only leinsadvisor-api
```
El commit de snapshot de la Fase 0 garantiza que nada se perdió en `htdocs` durante el intento.
