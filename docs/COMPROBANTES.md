# Módulo de Comprobantes

## Fuente de datos

El módulo `/comprobantes` lista las ventas locales de PostgreSQL. No usa el listado de Intifact como fuente primaria porque la venta local contiene sesión, pago, local, cliente y permisos RLS.

Intifact se usa para:

- reconciliar el estado fiscal;
- reencolar exclusivamente `COLA_FALLIDA`;
- descargar PDF, XML y CDR.

## Fecha fiscal

SQL 013 agrega `sales.fiscal_issue_date`.

Esta fecha se calcula en la zona horaria de la organización al crear la venta y queda inmutable. Un retry del día siguiente conserva la fecha fiscal original.

`issued_at` continúa siendo un `timestamptz` técnico que indica cuándo se hizo el primer envío.

## Estados operativos

- `draft`: venta registrada, emisión todavía no completada.
- `queued`: Intifact la tiene en cola.
- `processing`: Intifact/SUNAT la está procesando.
- `accepted`: aceptado; habilita PDF/XML/CDR.
- `rejected`: SUNAT rechazó el comprobante. No se ejecuta retry automático.
- `queue_failed`: fallo de cola; owner puede usar retry sobre el mismo ID.
- `error`: error local o de comunicación que requiere revisión.
- `voided`: anulado.

## Sin webhooks

El botón "Actualizar pendientes" consulta como máximo 10 documentos por acción para mantenerse conservador frente al rate limit del plan Free de Intifact.

No crea nuevos correlativos.

## Retry

`POST /api/v1/documents/{id}/retry` solo se habilita en la UI para `queue_failed`.

Un documento `rejected` no se reencola automáticamente: primero debe corregirse la causa y posteriormente implementarse el flujo explícito de reemisión.

## Archivos

Para documentos aceptados:

- PDF A4
- PDF ticket 80 mm
- PDF ticket 58 mm
- XML firmado
- CDR SUNAT

Para rechazados se permite consultar XML/CDR cuando Intifact los tenga disponibles para diagnóstico.

Las credenciales Intifact permanecen en servidor; el navegador descarga mediante rutas autenticadas de Next.js.

## Anulación

La anulación no se trata como un simple cambio de estado local. Intifact genera un RC para boletas y una RA para facturas, ambos con ticket asíncrono. Ese flujo se implementará en una fase separada persistiendo ticket, estado y motivo de baja.
