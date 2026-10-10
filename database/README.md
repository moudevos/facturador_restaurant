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
13. `sql/013_comprobantes_fiscales.sql`
14. `sql/014_configuracion_fiscal_comprobante_pwa.sql`
15. `sql/015_motor_transaccional_ventas.sql`
16. `sql/016_clientes_manuales_y_cliente_generico.sql`

Al terminar:

```sql
select *
from public.schema_change_log
order by script_code;
```

Deben aparecer `001` a `016`.

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

`create_pos_sale(...)` valida la sesión abierta, cliente, método de pago y luego llama a `create_sale_draft(...)`. Los productos y precios se vuelven a leer desde la base de datos antes de reservar el correlativo. El cobro se persiste inicialmente como `pending` en `sale_payments`. Desde SQL 015 no impacta caja, sesiones ni Dashboard hasta que SUNAT/Intifact deje el comprobante en `accepted`; entonces pasa a `completed`. Un rechazo definitivo conserva el intento para auditoría pero revierte el pago a `reversed` y la venta queda `failed`.

Un comprobante no se considera venta efectiva hasta recibir el estado fiscal real de Intifact/SUNAT.


## Cliente varios y alta manual

Desde SQL 016 una boleta sin cliente registrado conserva `CLIENTE VARIOS` como nombre de snapshot, pero no inventa DNI/RUC. La integración fiscal omite los campos de identificación del cliente en lugar de serializarlos con `null`.

El alta manual se usa únicamente como fallback para DNI no encontrados por ApiPeru. Un RUC destinado a factura debe seguir pasando por la validación fiscal.
