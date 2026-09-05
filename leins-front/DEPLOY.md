# Flujo de trabajo: leins-back + leins-front

Este sistema vive en dos repos de GitHub separados:
- `leins-back` (repo hermano) — API Node/Express, corre con PM2 en el servidor.
- `leins-front` (este repo) — SPA React + Vite, se compila y se sube como archivos estáticos.

## 0. Regla de oro (evita quedar desactualizado)

**Antes de tocar cualquiera de los dos repos, haz `git pull`.** Kevin también trabaja en ambos.
Si no jalas primero, puedes terminar editando código viejo (nos pasó con la migración de
`leins-front` a Vite: el repo local estaba 10 commits atrás y el flujo de despliegue no
coincidía con lo que había en producción).

## 1. ¿Backend o frontend?

| El cambio es... | Se edita en... |
|---|---|
| Pantalla, componente, formulario, texto, gráfico | `leins-front` (`src/pages`, `src/components`) |
| Endpoint, lógica de negocio, acceso a BD, migración | `leins-back` (`routes`, `controllers`, `services`, `db/models`, `migrations`) |

Un módulo nuevo completo normalmente toca **ambos**: primero el backend (endpoint + modelo +
migración), después el frontend (pantalla que lo consume).

## 2. Flujo backend (`leins-back`)

1. `git pull` antes de empezar.
2. Editar y probar localmente.
3. **Ojo:** `.vscode/sftp.json` tiene `uploadOnSave: true` — cada vez que guardas un archivo se
   sube automáticamente al servidor (`/var/www/api.leinsadvisor.cl/htdocs/`). Guardar ≠ probado.
4. Si el cambio necesita una migración de base de datos, córrela en el servidor (no hay MySQL
   local): `npx sequelize-cli db:migrate`.
5. Guardar el archivo solo lo sube — **no reinicia el proceso Node**. Si el cambio afecta código
   que ya se ejecuta, reinicia en el servidor: `pm2 restart leinsadvisor-api-0`.
6. Cuando el cambio funcione: `git add` + `commit` + `push`.

## 3. Flujo frontend (`leins-front`)

1. `git pull` antes de empezar.
2. Editar y probar localmente (`npm start` o `npm run dev` contra el backend).
3. Cuando esté listo: `npm run build` (genera la carpeta `build/`, configurado así en
   `vite.config.js` aunque el proyecto usa Vite).
4. En VS Code: clic derecho sobre `build` → **"SFTP: Upload Folder"** (usuario `kllanquel` en
   `.vscode/sftp.json` — el usuario `sadvisor` no tiene permisos de escritura en
   `/var/www/app.leinsadvisor.cl/`).
5. Verificar en el navegador con hard refresh (Ctrl+F5), ya que los archivos quedan
   cacheados.
6. `git add` + `commit` + `push`.

## 4. GitHub vs servidor: son cosas distintas

- **Servidor** = lo que ven los usuarios ahora mismo. Se sube cuando el cambio ya funciona.
- **GitHub** = historial y respaldo compartido con Kevin. Se hace `commit`/`push` cuando algo
  queda funcionando, sea antes o después de subirlo al servidor.

No asumas que un `push` despliega o que un despliegue implica que ya quedó en GitHub — hay que
hacer ambas cosas por separado.
