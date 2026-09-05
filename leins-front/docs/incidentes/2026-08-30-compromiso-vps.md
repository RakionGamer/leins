# Incidente: cryptominer en VPS de producción (leinsadvisor.cl)

**Fecha:** 2026-08-29 a 2026-08-30
**Servidor:** `200.73.113.121` (leinsadvisor, VPS de este proyecto — no es infraestructura de Redvoiss)
**Severidad:** Alta — compromiso confirmado, servicio caído para usuarios finales.

## Resumen

El front (`app.leinsadvisor.cl`) daba `Failed to fetch` en el login. Al investigar se encontró que el servidor estaba prácticamente inutilizable (load average ~57 sobre un VPS de recursos reducidos, swap al 100%), causado por **procesos de minería de criptomonedas (XMRig)** camuflados con nombres genéricos, corriendo bajo el usuario de la aplicación (`sadvisor`). Se encontraron **tres copias/generaciones** del mismo dropper.

## Cronología de síntomas → causa raíz

1. Subida por SFTP fallaba con `Config Not Found` → causa real: el `context` de `.vscode/sftp.json` está acotado a `build/`, no a `src/`. No relacionado con el incidente, solo configuración de despliegue.
2. Tras generar el build, la conexión SFTP daba `Timed out while waiting for handshake` → la IP estaba baneada por `fail2ban` en el servidor (tras desbanearla, conectó).
3. Con el front ya desplegado, el login daba `Failed to fetch` → el backend (`leinsadvisor-api` y otros procesos PM2) estaba **detenido**.
4. Al levantar los procesos, seguía fallando y hasta comandos locales (`pm2 show`) se colgaban → el servidor estaba con **recursos agotados** (CPU/memoria/swap) por el minero.

## Hallazgos del compromiso

- **Binario:** XMRig (confirmado por `xmrig.log`/`xmrig.pid` en el mismo directorio y conexiones salientes al puerto **3333**, protocolo Stratum de pools de minería).
- **Ubicaciones encontradas y eliminadas:**
  - `/home/sadvisor/system-check/` (`system-check`, `config.json`)
  - `/home/sadvisor/.kernel-worker/` (`kernel`, `kernelU`, `.temp_config.json`)
  - `/home/sadvisor/.system-check/` (`system-check`, `config.json`, `xmrig.log`, `xmrig.pid`)
  - `/var/tmp/system-check`
- **Sin persistencia por cron/systemd** para el minero — se lanzaba manualmente y quedaba huérfano (`PPID=1`), sobreviviendo a la sesión que lo inició.
- **Vector de entrada probable:** cuenta `sadvisor` (SSH por password). No hay login exitoso de `root` (protegido por `PermitRootLogin without-password`, solo llave), pero `PasswordAuthentication yes` estaba activo para el resto de cuentas y se registró fuerza bruta constante contra `root` desde decenas de IPs (todas fallidas). No se pudo confirmar el momento exacto de entrada de `sadvisor` en los logs revisados — posible entrada vía vulnerabilidad de la app en vez de SSH directo (no se llegó a confirmar).
- **Hallazgo adicional (no explotado, pero de riesgo):** el usuario `kllanquel` tenía sudo total (`ALL:ALL ALL`) sin restricciones.
- **Hallazgo de arquitectura (no es el incidente, pero aumenta el impacto de cualquier futuro bug):** los procesos de la app (PM2: `leinsadvisor-api`, scripts `sii-*-consult.js`, etc.) corren como **root** vía `pm2-root.service`, en vez de un usuario sin privilegios.

## Acciones tomadas (en orden)

1. Procesos del minero eliminados (`pkill -9 -f system-check`) en las 3 ubicaciones.
2. Directorios/binarios del minero borrados.
3. Password de `sadvisor` rotada.
4. Usuario `kllanquel` bloqueado (`usermod -L` + `usermod -e 1`, cuenta expirada) — sospecha/precaución del equipo, no confirmado como vector de entrada.
5. Confirmado que `root` nunca aceptó login por password (protegido de fábrica).
6. Servidor verificado limpio: `ps aux` sin procesos sospechosos, sin conexiones al puerto 3333, load average bajando a la normalidad.

## Pendiente (no aplicado aún — decisión consciente de esperar a una ventana de mantenimiento)

- [ ] Cambiar la clave del portal SII directamente en sii.cl (variable `SII_PASS` en `/var/www/micuenta.leinsadvisor.cl/.env`) — **el más urgente de los pendientes**, es acceso real a datos tributarios del cliente.
- [ ] Rotar `DB_PASSWORD` (`/var/www/api.leinsadvisor.cl/htdocs/.env`) + `ALTER USER` en MySQL.
- [ ] Rotar `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` (invalida sesiones activas, es esperado).
- [ ] Rotar `AGENT_TOKEN` (`/var/www/micuenta2.leinsadvisor.cl/.env`) — coordinar con lo que sea que use `VPS_URL` para no cortar esa integración.
- [ ] **`MYSQL_AES_KEY` — NO rotar sin plan de migración.** Cifra datos ya guardados en la BD a nivel de aplicación; cambiarla sin re-cifrar los datos existentes los deja ilegibles. Requiere revisar el código del backend antes de tocarla.
- [ ] Migrar los procesos PM2 de `root` a un usuario dedicado sin privilegios (`sadvisor`).
- [ ] Deshabilitar `PasswordAuthentication` (solo llaves SSH) para todas las cuentas, una vez que todas tengan su llave configurada.
- [ ] Evaluar si conviene reactivar `kllanquel` con sudo acotado en vez de acceso total, si se decide desbloquear.

## Notas para la próxima revisión

- Se generó un prompt de auditoría reutilizable (basado en estos mismos hallazgos) para revisar otros servidores con la misma arquitectura por señales de compromiso similares.
- Si este documento se está revisando porque el problema volvió a ocurrir: lo primero es repetir los pasos 1-3 de "Hallazgos del compromiso" (buscar `system-check`/`kernel-worker`/conexiones al puerto 3333) antes de asumir que es un problema nuevo.
