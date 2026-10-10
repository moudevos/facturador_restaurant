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
011_intifact_emision.sql
012_catalogo_productos_normalizado.sql
013_comprobantes_fiscales.sql
014_configuracion_fiscal_comprobante_pwa.sql
015_motor_transaccional_ventas.sql
```

## Regla inmutable

Después de aplicar un archivo en un entorno compartido o producción, no se modifica. Si hay que corregir algo, se crea el siguiente SQL numerado.

## Productos

El catálogo distingue:

```text
product_code       P000001      código interno estable
sku                HAMB-CLA     código comercial opcional
sunat_product_code 50192701     UNSPSC SUNAT (8 dígitos)
```

`product_code` se genera en PostgreSQL y es inmutable. El UUID de `products.id` sigue siendo la clave técnica interna, pero no se envía como código de producto a SUNAT/Intifact.

`product_categories` organiza el catálogo y el POS. SQL 012 crea categorías iniciales para restaurante y asigna los productos existentes a `Otros` para que el owner los reclasifique deliberadamente.

Al crear una venta, `sale_items` congela código interno, código UNSPSC y afectación IGV además del nombre/precio.

## Correlativos y ventas

`create_sale_draft` obtiene productos/precios desde PostgreSQL y reserva el correlativo en la misma transacción. `create_pos_sale` añade la validación de sesión abierta, cliente y pago, y reutiliza `create_sale_draft`. El frontend nunca genera correlativos ni confía en precios enviados por el navegador.


## Emisor fiscal y comprobante

SQL 014 separa la identidad fiscal de la identidad comercial. El RUC, nombre legal, estado, condición y domicilio fiscal se validan server-side con ApiPeru. El nombre comercial, logo, pie e impresión se configuran aparte en `receipt_settings`. El mismo RUC se cruza con las empresas emisoras disponibles para la API key de Intifact.

Los locales pueden almacenar `sunat_establishment_code`; la matriz usa `0000` y los anexos conservan su código SUNAT real.

## Motor transaccional de ventas

SQL 015 separa tres conceptos:

```text
sales.status              estado fiscal
sales.commercial_status   impacto comercial
sale_payments.status      impacto del cobro
```

Solo una venta con estado fiscal `accepted`, estado comercial `completed` y pago `completed` impacta caja y reportes operativos.

Estados inciertos, colas y timeouts permanecen `pending` y deben reconciliarse usando la misma identidad fiscal. Un rechazo definitivo conserva el comprobante fallido para auditoría y revierte el efecto comercial/pago sin borrar filas.

No se permite cerrar una sesión con ventas comerciales pendientes.
