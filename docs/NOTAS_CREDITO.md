# Notas de crédito (NC) — alcance y condiciones de emisión

## Fase preparada: payload y pruebas

El módulo `src/features/credit-notes/server/build-credit-note.ts` construye el
payload de una NC tipo `07` para los **únicos motivos previstos inicialmente**:

- `01` Anulación total de la operación.
- `06` Devolución total.

Se toma un snapshot de la **boleta/factura aceptada** y se conserva exactamente
el RUC del emisor, comprador, detalle, afectación IGV e importe. La identidad
del documento afectado se envía en `afectadoTipoDoc` y
`afectadoNumDoc`. El motivo se transmite en `motivoCod` y `motivoDes`.

Las series deben ser **FC##** (factura original) o **BC##** (boleta original).
Una NC debe obtener su **propio correlativo**, diferente al de la venta, sin
reutilizar números fallidos ni alterar `document_sequences` de la boleta.

La especificación está en:
https://docs.intifact.com/docs/facturacion/notes

## Bloqueos para habilitar "Emitir NC" en la interfaz

1. Crear una migración SQL **018** que incluya `credit_notes`, una secuencia
   por RUC/local/tipo/serie, campos de auditoría, RLS y restricciones de
   unicidad fiscal e idempotencia. No cambiar los scripts aplicados 001–016.
2. Una RPC atómica debe reservar el correlativo de NC y crear su registro
   antes del POST `/api/v1/note/send`; el envío debe reconciliar en
   `/api/v1/documents` ante errores inciertos.
3. Persistir estados independientes `draft/queued/processing/accepted/
   rejected/error`, `intifact_document_id`, CDR, mensajes SUNAT y
   eventos de reintento.
4. Aplicar el ajuste comercial y de caja **una única vez tras aceptación
   fiscal** de NC (no es suficiente marcar la venta original como `voided`).
   Guardar importe devuelto, medio y fecha; evitar afectar el arqueo histórico
   o duplicar devoluciones.
5. Mostrar notas asociadas en el detalle de la venta y habilitar PDF/XML/CDR
   oficiales de `/api/v1/note/{id}/...`.
6. Probar en ambiente TEST: NC sobre boleta genérica, factura con RUC, rechazo
   fiscal, latencia SUNAT, devolución económica y emisión duplicada.

**Estado actual**: la construcción del payload y sus tests están preparados.
No existe todavía un endpoint transaccional de emisión de NC, ni se modificó
el esquema productivo ni el estado de caja. No habilitar emisión directa sin
cumplir los puntos anteriores.

## Impresión y marca de agua

`receipt_settings.logo_path` es el logo **local** usado por el POS en su
recibo térmico. El PDF oficial de Intifact utiliza el logo configurado en
el portal de Empresas de Intifact; con la API key disponible, este recurso
es de solo lectura: `GET /api/v1/companies/{id}/logo`.

La key `fact_test_` corresponde a SUNAT beta: **carece de validez fiscal**
y sus PDF pueden incluir indicaciones de prueba. Eliminar visualmente esa
indicación de un PDF TEST no convierte el documento en real. Para PDF fiscal
sin indicación de prueba hace falta emitir una venta real con `fact_live_`,
verificar certificado/credenciales y examinar el PDF realmente generado
antes de declarar que el comprobante está listo.
