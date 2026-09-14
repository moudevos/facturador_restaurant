# Arquitectura

## Criterio

El proyecto usa un monolito modular. No se introducen microservicios, colas propias, Redis ni un ORM en el MVP. La complejidad debe justificarse por una necesidad real del negocio.

## Capas

```text
Next.js App Router
  ├─ UI / Server Components
  ├─ Features de dominio
  ├─ TanStack Query para estado remoto
  └─ Zustand para estado efímero del carrito
          │
          ▼
Supabase
  ├─ Auth
  ├─ PostgreSQL
  ├─ RLS
  └─ Realtime cuando aporte valor
          │
          ▼
Intifact
  └─ emisión y estado fiscal
```

Las operaciones CRUD normales usan Supabase con RLS. Las operaciones que requieran secretos de Intifact deben pasar por una frontera de servidor; nunca se llama Intifact directamente desde el navegador.

## Estructura

- `src/app`: rutas y layouts.
- `src/components`: componentes compartidos de interfaz.
- `src/features`: lógica por módulo cuando empiece la implementación real.
- `src/lib`: clientes, utilidades y adaptadores.
- `src/providers`: providers React.
- `database/sql`: cambios de esquema manuales y secuenciales.
- `database/templates`: scripts operativos editables que no forman parte del historial de esquema.
- `docs`: decisiones técnicas y operativas.

## Escalabilidad

El modelo incluye `organization_id` y `branch_id` desde el inicio. Esto permite crecer hacia múltiples locales y empresas sin convertir el MVP actual en una plataforma multi-tenant compleja antes de necesitarlo.

Escala vertical primero: índices, consultas correctas, cache y límites de conexión. Escala horizontal después: Next.js puede tener múltiples instancias porque el estado duradero vive en Supabase. El carrito es efímero y no debe ser la fuente de verdad después de confirmar una venta.

## Dinero

PostgreSQL usa `numeric`, nunca `float`. El catálogo guarda precio final de venta. La venta copia descripción, precio y totales a `sale_items`, por lo que cambiar un producto no altera comprobantes históricos.

## Resultado financiero

En esta fase:

`resultado simple = facturación aceptada - egresos no anulados`

No se denomina utilidad, margen ni ganancia real hasta incorporar costos, inventario, mermas y demás gastos.
