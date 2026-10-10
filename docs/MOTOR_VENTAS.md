# Motor transaccional de ventas

## Regla principal

Una operación POS no se considera venta efectiva por el solo hecho de haber reservado un correlativo o registrado el medio de pago.

La condición operativa es:

```text
fiscal status       = accepted
commercial status   = completed
payment status      = completed
```

Solo entonces suma en Dashboard, caja, cierre de sesión y ventas por método.

## Flujo

```text
Intifact compute
   ↓ válido
create_pos_sale
   ↓
sale commercial_status=pending
payment status=pending
   ↓
invoice/send
   ├─ accepted  → finalize_sale_after_fiscal_acceptance
   │               commercial=completed
   │               payment=completed
   │
   ├─ rejected  → reverse_sale_after_fiscal_failure
   │               commercial=failed
   │               payment=reversed
   │
   ├─ queued/processing
   │             → sigue pending + polling
   │
   ├─ queue_failed
   │             → sigue pending; retry del mismo documento
   │
   └─ timeout/resultado incierto
                 → sigue pending
                 → reconciliar por RUC+tipo+serie+correlativo
                 → nunca crear otro correlativo automáticamente
```

## Reversa

La reversa es contable/operativa, no un DELETE. Se conservan la venta, items, correlativo, pago y respuesta fiscal para auditoría.

En efectivo, el software revierte el efecto contable pero el cajero debe devolver físicamente el dinero si ya lo recibió. Yape/Plin/tarjeta/transferencia también requieren devolución externa mientras no exista una integración de pagos capaz de reembolsar automáticamente.

## Cierre de sesión

Una sesión con `commercial_status=pending` no se puede cerrar. Primero se deben reconciliar esos comprobantes.

## Vistas

`v_sales_session_summary` y `v_daily_collections` cuentan exclusivamente pagos y ventas completados. Los comprobantes rechazados o pendientes sí permanecen visibles en el módulo Comprobantes.
