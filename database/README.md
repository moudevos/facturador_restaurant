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
12. `sql/012_catalogo_productos_normalizado.sql`

Al terminar:

```sql
select *
from public.schema_change_log
order by script_code;
```

Deben aparecer `001` a `012`.

## Regla de cambios

Un archivo aplicado no se modifica ni se reutiliza. El siguiente cambio debe usar un nuevo número secuencial.

## Catálogo de productos

Desde SQL 012 cada producto tiene tres identificadores con responsabilidades distintas:

- `product_code`: código interno estable autogenerado (`P000001`, `P000002`, ...). Se usa como `codProducto` en Intifact y nunca es el UUID de Supabase.
- `sku`: código comercial opcional, editable y normalizado a mayúsculas.
- `sunat_product_code`: código UNSPSC de 8 dígitos que se envía como `codProdSunat` cuando está configurado.

Las categorías se almacenan en `product_categories` y se crean con valores iniciales para restaurante: Bebidas, Comidas, Hamburguesas, Salchipapas, Broaster, Combos, Acompañamientos y Otros.

`sale_items` conserva snapshot de `product_code`, `sunat_product_code` y afectación IGV para que cambios futuros del catálogo no alteren comprobantes históricos.

## Venta POS

`create_pos_sale(...)` valida la sesión abierta, cliente, método de pago y luego llama a `create_sale_draft(...)`. Los productos y precios se vuelven a leer desde la base de datos antes de reservar el correlativo. El cobro se persiste en `sale_payments`.

Un comprobante no se considera aceptado hasta recibir el estado fiscal real de Intifact/SUNAT.
