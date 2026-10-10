# Intifact — emisión sin webhooks

## Entorno

Variables server-only en `.env.local`:

```env
INTIFACT_API_URL=https://api-facturacion.intifact.com
INTIFACT_API_KEY=fact_test_TU_KEY
SUPABASE_SECRET_KEY=TU_SECRET_KEY_DE_SUPABASE
```

No uses `NEXT_PUBLIC_` para ninguna de estas credenciales.

Mientras se prueba la integración debe utilizarse una key `fact_test_`. La key `fact_live_` se reserva para producción.

## Flujo POS

1. El POS envía productos/cantidades al Server Action.
2. El servidor llama a `POST /api/v1/invoice/compute` con `preciosIncluyenIgv: true`.
3. Si Intifact y el POS no coinciden en el total, la venta se detiene antes de reservar correlativo.
4. PostgreSQL ejecuta `create_pos_sale`, congela precio/afectación IGV y registra pago.
5. El servidor reconstruye el comprobante desde la venta persistida.
6. Se llama a `POST /api/v1/invoice/send` reutilizando exactamente la identidad fiscal persistida.
7. La respuesta normalmente queda en `ENCOLADO`.
8. Sin webhooks, el modal postventa consulta `GET /api/v1/documents/{id}` con backoff.
9. Al quedar `ACEPTADO`, se habilitan PDF e impresión/compartir.
10. Si tarda, el cajero puede iniciar otra venta; no se genera un correlativo nuevo.

## Estados

Mapeo local:

- `PENDIENTE` / `ENVIANDO` → `processing`
- `ENCOLADO` → `queued`
- `ACEPTADO` → `accepted`
- `RECHAZADO` → `rejected`
- `COLA_FALLIDA` → `queue_failed`
- `ANULADO` → `voided`

Un HTTP 202 o estado `ENCOLADO` NO equivale a aceptación SUNAT.

## PDF

La API oficial soporta:

- `a4`: hoja A4.
- `ticket` / `ticket80`: ticket térmico 80 mm.
- `ticket58`: ticket térmico 58 mm.

No existe un formato oficial `40mm` documentado. Para impresoras compactas se usa `ticket58` y, si el hardware lo exige, el driver de impresión debe escalarlo.

El frontend nunca recibe la API key de Intifact. Descarga los PDFs mediante una ruta autenticada del propio Next.js:

```text
/api/intifact/sales/{saleId}/pdf?format=a4
/api/intifact/sales/{saleId}/pdf?format=ticket80
/api/intifact/sales/{saleId}/pdf?format=ticket58
```

En móvil, "Enviar por WhatsApp" usa Web Share para compartir el PDF como archivo. Si el navegador no permite compartir archivos, se descarga el PDF para adjuntarlo manualmente.

## Sin webhooks

No se configura webhook secret en esta fase. El plan gratuito se opera con polling controlado y, más adelante, reconciliación desde el módulo Comprobantes.

Nunca reintentes una caída creando otro correlativo. La identidad RUC + tipo + serie + correlativo se mantiene.
