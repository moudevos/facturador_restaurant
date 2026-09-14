# Convenciones

## Idioma

Código, tablas, columnas y nombres técnicos: inglés. Interfaz y documentación operativa: español. Los SQL pueden usar descripción española en el nombre para que el orden de ejecución sea legible.

## SQL

Formato: `NNN_descripcion_en_snake_case.sql`.

Ejemplo siguiente: `006_agregar_campo_metodo_pago.sql`.

No usar nombres como `final.sql`, `nuevo.sql`, `fix2.sql` o `ultima_version.sql`.

## Git

Commits pequeños y descriptivos con Conventional Commits:

- `feat:` funcionalidad.
- `fix:` corrección.
- `chore:` infraestructura/mantenimiento.
- `docs:` documentación.
- `test:` pruebas.
- `refactor:` cambio interno sin alterar comportamiento.

## Next.js

Preferir Server Components. Un archivo solo usa `"use client"` si realmente necesita estado React, handlers, hooks de navegador o librerías client-only.

## Estado

- TanStack Query: datos remotos/cache.
- Zustand: carrito y estado temporal de UI.
- URL: filtros que deban poder compartirse/recargarse.
- PostgreSQL: fuente de verdad del negocio.

## Errores y loading

Acciones fiscales no usan optimistic UI. Mientras una emisión está en progreso, el botón se deshabilita y se muestra un estado explícito. Tablas usan skeleton/empty state; formularios muestran errores junto al campo o acción correspondiente.
