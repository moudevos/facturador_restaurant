# Base de datos y cambios SQL

## Política

No se usa un motor automático de migraciones. Cada modificación de estructura se conserva como SQL numerado y se ejecuta manualmente desde Supabase SQL Editor.

Secuencia actual:

```text
001_esquema_inicial.sql
002_funciones_y_triggers.sql
003_seguridad_rls.sql
004_indices.sql
005_vistas_reportes_iniciales.sql
006_estandar_fechas_y_horas.sql
007_configuracion_administrable.sql
008_productos_catalogo.sql
009_egresos_financieros.sql
010_pos_sesiones_clientes_pagos.sql
```

## Regla inmutable

Después de aplicar un archivo en un entorno compartido o producción, no se modifica. Si hay que corregir algo, se crea el siguiente SQL numerado.

## Verificación

```sql
select script_code, script_name, executed_at, executed_by
from public.schema_change_log
order by script_code;
```

## Configuración inicial

Desde `007_configuracion_administrable.sql`, un usuario autenticado que todavía no pertenezca a una organización puede crear empresa, local principal, owner y serie B001 desde `/configuracion`.

## Correlativos y ventas

`create_sale_draft` obtiene productos/precios desde PostgreSQL y reserva el correlativo en la misma transacción. `create_pos_sale` añade la validación de sesión abierta, cliente y pago, y reutiliza `create_sale_draft`. El frontend nunca genera correlativos ni confía en precios enviados por el navegador.

Una venta cobrada por el POS queda inicialmente en estado local `draft` hasta que la fase fiscal la envíe a Intifact. Cualquier retry fiscal debe reutilizar exactamente RUC + tipo + serie + correlativo.

## Sesiones de caja

`sales_sessions` modela la apertura y cierre físico de caja. Existe como máximo una sesión abierta por local.

Efectivo esperado:

```text
fondo inicial
+ ventas cobradas en efectivo
+ ingresos de caja
- salidas de caja
```

El cierre persiste efectivo esperado, contado, diferencia y observación. Si existe diferencia, la observación es obligatoria.

`cash_movements` representa movimientos físicos de efectivo y no equivale automáticamente a `expenses`. Por ejemplo, retirar efectivo a una caja fuerte reduce el efectivo del cajón, pero no es un egreso financiero.

## Pagos

`sale_payments` guarda el medio y monto cobrado. El MVP registra un método principal por venta, pero la tabla admite varias filas por venta para soportar pago mixto más adelante.

Métodos iniciales: efectivo, Yape, Plin, tarjeta y transferencia.

## Clientes

`customers` contiene personas DNI y empresas RUC reutilizables en el POS. La venta conserva además el snapshot de nombre/documento en `sales` para que cambios futuros del cliente no alteren comprobantes históricos.

## Productos

`products.price` es el precio final mostrado al cliente. No hay inventario, costos ni recetas en este MVP.

## Egresos

`expense_date` es fecha de negocio. Los datos financieros de un egreso son inmutables; si hubo un error se anula mediante `void_expense` y se registra otro.
