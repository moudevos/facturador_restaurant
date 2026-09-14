# Base de datos

La base de datos se administra mediante scripts SQL versionados y ejecutados manualmente en Supabase SQL Editor. No se usa `supabase migration up`, migraciones de ORM ni modificación automática del esquema desde la aplicación.

## Orden obligatorio

1. `sql/001_esquema_inicial.sql`
2. `sql/002_funciones_y_triggers.sql`
3. `sql/003_seguridad_rls.sql`
4. `sql/004_indices.sql`
5. `sql/005_vistas_reportes_iniciales.sql`

Al terminar:

```sql
select *
from public.schema_change_log
order by script_code;
```

Deben aparecer `001` a `005`.

## Regla de cambios

Un archivo aplicado no se modifica ni se reutiliza. El siguiente cambio será `006_descripcion.sql`, después `007_...`, etc. Esto conserva un registro reproducible incluso sin usar un motor de migraciones.

## Bootstrap

Después de crear el primer usuario en Supabase Auth, editar y ejecutar `templates/crear_empresa_inicial.sql`. La plantilla crea organización, local principal, propietario y serie `B001`.

## Venta atómica

La función `public.create_sale_draft(...)` recibe productos y cantidades, obtiene los precios desde la base de datos, reserva el correlativo y guarda cabecera/detalle en una sola transacción PostgreSQL. Si falla cualquier paso, también se revierte el correlativo.
