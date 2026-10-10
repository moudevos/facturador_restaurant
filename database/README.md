# Base de datos

La base de datos se administra mediante scripts SQL versionados y ejecutados manualmente en Supabase SQL Editor. No se usa `supabase migration up`, migraciones de ORM ni modificación automática del esquema desde la aplicación.

## Orden obligatorio

1. `sql/001_esquema_inicial.sql`
2. `sql/002_funciones_y_triggers.sql`
3. `sql/003_seguridad_rls.sql`
4. `sql/004_indices.sql`
5. `sql/005_vistas_reportes_iniciales.sql`
6. `sql/006_estandar_fechas_y_horas.sql`
7. `sql/007_configuracion_administrable.sql`
8. `sql/008_productos_catalogo.sql`
9. `sql/009_egresos_financieros.sql`
10. `sql/010_pos_sesiones_clientes_pagos.sql`
11. `sql/011_intifact_emision.sql`

Al terminar:

```sql
select *
from public.schema_change_log
order by script_code;
```

Deben aparecer `001` a `011`.

## Regla de cambios

Un archivo aplicado no se modifica ni se reutiliza. El siguiente cambio debe usar un nuevo número secuencial.

## Bootstrap

Después de crear el primer usuario en Supabase Auth y ejecutar los scripts, abre `/configuracion` para crear organización, local principal, owner y serie B001.

## Venta POS

`create_pos_sale(...)` valida la sesión abierta, cliente, método de pago y luego llama a `create_sale_draft(...)`. Los productos y precios se vuelven a leer desde la base de datos antes de reservar el correlativo. El cobro se persiste en `sale_payments`.

La venta queda localmente registrada y pagada. La emisión electrónica Intifact sigue siendo una fase separada y no debe simularse como aceptada hasta recibir el estado fiscal real.
