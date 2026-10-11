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

## Prevención y recuperación de correlativos

Antes de llamar a `create_pos_sale`, el servidor comprueba que el RUC emisor figure
en Intifact bajo la API key del entorno activo. `invoice/compute` por sí solo
no verifica el RUC. Si falla la verificación, no se reserva correlativo.

La conciliación por identidad fiscal consulta todas las páginas pertinentes del
listado Intifact (hasta 5000 registros por RUC/tipo/serie); si no puede terminar
la consulta, **falla de forma cerrada** y prohíbe reemitir basándose en un falso
"no encontrado".

Un owner puede recuperar una venta `draft/pending` nunca enviada y una venta
`error/pending` mediante **Reintentar emisión**. Primero concilia con Intifact
y después reutiliza el mismo RUC/tipo/serie/correlativo y fecha fiscal.
No se reenvía un documento efectivamente `rejected` ni uno con estado comercial
`failed`.

Números asignados localmente y comprobantes emitidos/aceptados son métricas
distintas: no deben coincidir necesariamente. No reiniciar ni reducir secuencias
para tapar diferencias históricas.

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

## Captura de errores HTTP 400 (SQL 017)

Antes de desplegar la versión que mostrará la respuesta estructurada,
ejecutar `database/sql/017_diagnostico_intifact.sql` desde el editor SQL
de Supabase (una vez, después del 016). No repetir la migración.

En una emisión rechazada por Intifact con HTTP 400, se conserva:
- `intifact_error_message`: error legible incluyendo campo(s) inválido(s).
- `intifact_last_http_status`: código de respuesta HTTP del proveedor.
- `intifact_error_response`: respuesta del proveedor (JSON completo salvo
  credenciales y cuerpos mayores de 48 KiB, que se recortan).
- `intifact_error_response_at`: instante del error.

Los datos se guardan dentro de la **misma venta** y su correlativo. El
owner puede desplegar "Diagnóstico HTTP Intifact" en el detalle de ese
comprobante. La API key y el JSON enviado NO se almacenan en este campo.
Si el 017 falta, la venta continúa registrando el error en texto; el
intento de guardar el diagnóstico es no crítico.

Para diagnosticar "Cliente varios", emitir **solo una prueba en TEST**
inferior a S/ 700. El backend envía exclusivamente
`clienteRazonSocial: "CLIENTE VARIOS"`, sin `clienteNumDoc` ni
`clienteTipoDoc`; no enviar valores falsos `0`, `-` ni ceros sin
confirmación del contrato de Intifact. Si falla, abrir el detalle de la
venta y leer el HTTP 400 exacto antes de modificar el payload.

Esta captura **no corrige por sí misma** la aceptación del comprador
genérico. Tampoco recupera errores previos al despliegue ni reenvía
automáticamente comprobantes rechazados o comercialmente fallidos.
