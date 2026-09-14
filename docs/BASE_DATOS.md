# Base de datos y cambios SQL

## Política

No se usa un motor automático de migraciones. Cada modificación de estructura se conserva como SQL numerado y se ejecuta manualmente desde Supabase SQL Editor.

Secuencia inicial:

```text
001_esquema_inicial.sql
002_funciones_y_triggers.sql
003_seguridad_rls.sql
004_indices.sql
005_vistas_reportes_iniciales.sql
```

## Regla inmutable

Después de aplicar un archivo en un entorno compartido o producción, no se modifica. Si hay que corregir algo, se crea `006_correccion_...sql`. Así el historial representa lo que realmente ocurrió.

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

## Correlativos

No se obtiene un correlativo en el frontend. `create_sale_draft` incrementa `document_sequences` y crea la venta en la misma transacción. Si falla el alta de la venta, PostgreSQL revierte también el incremento.

Una vez creado un comprobante, cualquier retry contra Intifact debe reutilizar exactamente `RUC + tipoDoc + serie + correlativo`.

## Datos iniciales

La creación de la empresa no es una migración de esquema. Crear primero al propietario en Supabase Auth y luego editar/ejecutar `database/templates/crear_empresa_inicial.sql`.
