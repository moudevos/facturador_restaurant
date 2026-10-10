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
```

## Regla inmutable

Después de aplicar un archivo en un entorno compartido o producción, no se modifica. Si hay que corregir algo, se crea el siguiente SQL numerado. Así el historial representa lo que realmente ocurrió.

Cada script debe:

1. tener número y descripción en el nombre;
2. ejecutarse dentro de `begin/commit` cuando sea posible;
3. verificar que el script anterior existe en `schema_change_log`;
4. abortar si su propio código ya fue registrado;
5. insertar su registro en `schema_change_log` al final.

## Verificación

```sql
select script_code, script_name, executed_at, executed_by
from public.schema_change_log
order by script_code;
```

## Configuración inicial

Desde `007_configuracion_administrable.sql`, un usuario autenticado que todavía no pertenezca a una organización puede crear desde `/configuracion`:

- empresa;
- local principal;
- membresía `owner`;
- serie inicial `B001` para boletas.

Ya no es obligatorio ejecutar manualmente `database/templates/crear_empresa_inicial.sql`; esa plantilla queda como alternativa administrativa.

## Correlativos

No se obtiene ni edita un correlativo en el frontend. `create_sale_draft` incrementa `document_sequences` y crea la venta en la misma transacción. Si falla el alta de la venta, PostgreSQL revierte también el incremento.

Una serie puede activarse o desactivarse desde Configuración, pero `current_value` no es editable desde la aplicación.

Una vez creado un comprobante, cualquier retry contra Intifact debe reutilizar exactamente `RUC + tipoDoc + serie + correlativo`.

## Usuarios

Los usuarios pertenecientes a una organización se administran mediante RPCs `security definer` que verifican que el actor sea `owner`. El alta por correo requiere que la cuenta ya exista en Supabase Auth; nunca se insertan filas directamente en `auth.users` desde el frontend.

## Productos

`products.price` es el precio final de venta mostrado al cliente; no se guarda precio base más IGV. No hay inventario, costos ni recetas. Los productos se desactivan lógicamente con `active = false`; el SKU es opcional y único por organización sin distinguir mayúsculas ni espacios extremos. Owner administra el catálogo y cashier solo lo consulta.

## Egresos

`expense_date` es una fecha de negocio independiente de `created_at`. El owner registra egresos y, una vez creados, sus datos financieros son inmutables. Si existe un error operativo, se anula mediante `void_expense` y se registra uno nuevo. La anulación conserva el historial con `is_voided`, `voided_at` y `voided_by`; no existe delete físico ni reactivación.

Las categorías iniciales son códigos estables: `compras`, `servicios`, `personal`, `transporte`, `mantenimiento` y `otros`.
