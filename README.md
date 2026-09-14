# Facturador Restaurant

Aplicación web para emisión y control de boletas de un restaurante pequeño. El MVP prioriza facturación, catálogo de productos, ingresos facturados y egresos generales. La arquitectura queda preparada para crecer posteriormente hacia inventario, costos, márgenes reales, multisucursal y múltiples cajas.

## Stack base

- Next.js 16 (App Router) + React 19 + TypeScript estricto.
- Tailwind CSS 4 + componentes estilo shadcn/ui + Lucide Icons.
- Supabase: PostgreSQL, Auth, RLS y Realtime.
- TanStack Query para estado remoto; Zustand únicamente para estado local de venta/UI.
- React Hook Form + Zod para formularios y validación.
- Intifact para facturación electrónica.
- pnpm + Node.js 22+.

## Inicio local

```bash
git clone https://github.com/moudevos/facturador_restaurant.git
cd facturador_restaurant
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

El proyecto Supabase ya dispone de URL y publishable key. Copiar los valores de `.env.example` a `.env.local`. Nunca guardar claves secretas de Supabase ni credenciales de Intifact en variables `NEXT_PUBLIC_*`.

## Base de datos

No utilizamos el sistema automático de migraciones de Supabase. Los cambios de esquema se versionan como SQL manual en `database/sql/` y se ejecutan en orden desde Supabase SQL Editor.

Ejemplo:

```text
001_esquema_inicial.sql
002_funciones_y_triggers.sql
003_seguridad_rls.sql
004_indices.sql
```

Cada script registra su ejecución en `public.schema_change_log`. No renombrar, reordenar ni modificar un script ya aplicado en producción: cualquier cambio posterior debe crear el siguiente archivo numerado.

Ver `docs/BASE_DATOS.md` antes de ejecutar SQL.

## Reglas del MVP

- `sales` representa facturación/ingresos emitidos.
- `expenses` representa egresos generales.
- `facturación - egresos` se denomina **resultado simple**, no utilidad o ganancia real.
- No se implementa inventario, kardex, recetas ni costo de venta en esta fase.
- Los comprobantes fiscales no se eliminan físicamente.
- Las credenciales de Intifact se usan únicamente del lado servidor.

## Comandos

```bash
pnpm dev          # desarrollo
pnpm build        # build de producción
pnpm start        # ejecutar build
pnpm lint         # ESLint
pnpm typecheck    # TypeScript
pnpm check        # lint + typecheck
```

## Documentación

- `docs/ARQUITECTURA.md`: decisiones y límites de arquitectura.
- `docs/BASE_DATOS.md`: orden de scripts SQL y reglas de datos.
- `docs/SEGURIDAD.md`: RLS, secretos y permisos.
- `docs/INTIFACT.md`: diseño de integración fiscal.
- `docs/CONVENCIONES.md`: nombres, commits y estructura del código.
- `docs/ROADMAP.md`: alcance del MVP y evolución prevista.

## Estado

Base técnica inicial. Las pantallas incluidas son scaffolding funcional para comenzar la implementación de módulos reales.