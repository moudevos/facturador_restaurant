# Intifact — emisión sin webhooks

## Entorno

Variables server-only en `.env.local`:

```env
INTIFACT_API_URL=https://api-facturacion.intifact.com
INTIFACT_API_KEY=fact_test_TU_KEY
SUPABASE_SECRET_KEY=TU_SECRET_KEY_DE_SUPABASE
```

No uses `NEXT_PUBLIC_` para ninguna de estas credenciales.

## Identificación de productos

No se envía `products.id` (UUID de Supabase) como código comercial.

```text
product_code       → detalle[].codProducto
sunat_product_code → detalle[].codProdSunat
```

`product_code` es nuestro código interno estable, por ejemplo `P000001`. `codProdSunat` es un identificador diferente: UNSPSC de exactamente 8 dígitos.

El SKU queda como dato comercial interno y de búsqueda; no sustituye automáticamente al UNSPSC.

## Flujo POS

1. El POS envía productos/cantidades al Server Action.
2. El servidor llama a `POST /api/v1/invoice/compute` con `preciosIncluyenIgv: true`.
3. Si Intifact y el POS no coinciden en el total, la venta se detiene antes de reservar correlativo.
4. PostgreSQL ejecuta `create_pos_sale`, congela precio, códigos y afectación IGV y registra pago.
5. El servidor reconstruye el comprobante desde la venta persistida.
6. Se llama a `POST /api/v1/invoice/send`.
7. Sin webhooks, el estado se consulta mediante polling controlado.
8. Al quedar `ACEPTADO`, se habilitan PDF e impresión/compartir.

Un HTTP 202 o estado `ENCOLADO` NO equivale a aceptación SUNAT.

## PDF

La API oficial soporta `a4`, `ticket80` y `ticket58` (además del alias `ticket`).
