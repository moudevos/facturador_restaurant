# Integración Intifact

Documentación oficial: https://docs.intifact.com/docs/facturacion

Base API: `https://api-facturacion.intifact.com`.

## Endpoints relevantes

- `POST /api/v1/invoice/compute`: cálculo fiscal sin emitir.
- `POST /api/v1/invoice/send`: emisión de factura/boleta.
- `GET /api/v1/documents/{id}`: estado del documento.
- `POST /api/v1/documents/{id}/retry`: reencolar fallidos.
- `GET /api/v1/invoice/{id}/pdf?format=ticket80`: PDF de ticket.
- `POST /api/v1/boleta/cancel`: anulación de boleta.

## Idempotencia

La identidad fiscal es `RUC + tipoDoc + serie + correlativo`. Si una llamada falla por red y no sabemos si Intifact la recibió, se reenvía la misma venta con el mismo correlativo. Nunca se crea otra venta para resolver un timeout.

## Flujo propuesto

1. Carrito local: aún no existe comprobante.
2. Para previsualizar impuestos se puede usar `/invoice/compute` sin reservar correlativo.
3. Al confirmar, ejecutar `create_sale_draft`; esto congela productos/precios y reserva correlativo de forma atómica.
4. Transformar esa venta persistida al payload Intifact.
5. Enviar `/invoice/send`.
6. Guardar `intifact_document_id`, hash y estado recibido.
7. Sincronizar el estado definitivo por webhook o consulta del documento.

## Mapeo de estados

| Intifact | Local |
| --- | --- |
| PENDIENTE | draft/processing según etapa |
| ENCOLADO | queued |
| ENVIANDO | processing |
| ACEPTADO | accepted |
| RECHAZADO | rejected |
| COLA_FALLIDA | queue_failed |
| ANULADO | voided |

La API responde de forma asíncrona; `202`/`ENCOLADO` no significa que SUNAT ya aceptó la boleta.

## Webhooks

Cuando el plan de Intifact los habilite, verificar:

- `X-Facturacion-Delivery-Id` para idempotencia;
- `X-Facturacion-Timestamp` con ventana máxima de 5 minutos;
- `X-Facturacion-Signature` como HMAC-SHA256 de `${timestamp}.${rawBody}`.

Los eventos principales son `document.accepted`, `document.rejected` y `document.queue_failed`.

El plan Free de Intifact actualmente no incluye webhooks. Si se utiliza ese plan, el sistema debe hacer polling temporal del documento recién emitido y reconciliar documentos pendientes al volver a abrir el sistema. No diseñar la consistencia fiscal dependiendo exclusivamente de webhooks.

## PDF/XML/CDR

No duplicar archivos fiscales en Supabase Storage durante el MVP. Guardar identificadores y descargar el documento desde Intifact cuando el usuario lo solicite. Reevaluar esta decisión si aparecen requisitos legales/operativos de archivo independiente.
