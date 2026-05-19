# Sincronizacion SII

## Objetivo

Cada sincronizacion SII queda registrada en `sii_sync_jobs` para auditar:

- quien la solicito
- entidad y periodo
- tipo de carga
- estado actual
- filas leidas, procesadas, insertadas, actualizadas y omitidas
- motivos de omision
- error final si falla

## Tipos soportados

- `boletas`: ventas SII tipo 39 y 41.
- `sales-invoices`: ventas SII tipo 33, factura electronica.
- `invoices`: compras/ventas desde el flujo historico de DTE.

## Migracion

Ejecutar una vez en cada ambiente:

```bash
npx sequelize-cli db:migrate
```

Esto crea la tabla `sii_sync_jobs`.

## Disparar sincronizacion

El endpoint existente ahora responde inmediatamente con `jobId`:

```http
POST /api/v1/entities/:entityId/sync-sii
```

Body:

```json
{
  "year": 2026,
  "month": "05",
  "type": "sales-invoices"
}
```

Para anual:

```json
{
  "year": 2026,
  "month": "ALL",
  "type": "boletas"
}
```

Si ya existe una sincronizacion `pending` o `running` para la misma entidad, tipo y periodo, no se crea otro proceso. En ese caso la API responde con el job existente:

```json
{
  "ok": true,
  "duplicated": true,
  "jobId": 15,
  "message": "ya existe una sincronizacion en proceso para esta entidad, tipo y periodo."
}
```

Si el job pendiente/en proceso excede `SII_SYNC_STALE_MINUTES` minutos, se marca como `failed` automaticamente y se permite crear un nuevo job. Por defecto son 120 minutos.

## Consultar historial

```http
GET /api/v1/entities/:entityId/sync-sii/jobs
```

Cuando el job fue iniciado por un super administrador, la respuesta incluye `requester` con `id`, `username`, `email`, `name` y `last_name`.

Filtros opcionales:

- `status`: `pending`, `running`, `success`, `failed`
- `type`: `boletas`, `sales-invoices`, `invoices`
- `limit`: maximo 100
- `offset`: paginacion

Ejemplo:

```http
GET /api/v1/entities/4/sync-sii/jobs?type=sales-invoices&limit=10
```

## Errores comunes

- `Sin credenciales`: la entidad no tiene credenciales SII activas.
- `Periodo futuro`: se intento consultar un mes posterior al actual.
- `No se pudo descargar el CSV`: el SII cambio la pantalla, bloqueo el boton o no entrego el archivo.
- `tipo_doc_filtrado`: el CSV tenia documentos fuera del tipo solicitado.

## Directorio de descargas

El proceso de facturas de venta intenta usar, en este orden:

- `SII_DOWNLOAD_DIR`
- `scripts/downloads/:entityId/:year`
- `/tmp/leins-sii-downloads/:entityId/:year`

Si el servidor no puede escribir en `scripts/downloads`, usa `/tmp` automaticamente.
