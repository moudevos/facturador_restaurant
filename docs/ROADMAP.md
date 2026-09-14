# Roadmap

## Fase 0 — base técnica

- [x] Next.js + TypeScript + Tailwind.
- [x] Supabase SSR/Auth.
- [x] RLS y roles base.
- [x] SQL secuencial y registro de ejecución.
- [x] Esquema de productos, ventas, egresos y auditoría.
- [x] Vitest + Playwright + CI.

## Fase 1 — administración mínima

- [ ] Alta/edición de productos.
- [ ] Configuración visual de empresa/local.
- [ ] Gestión básica de usuarios owner/cashier.
- [ ] Dashboard conectado a vistas SQL.

## Fase 2 — venta y boleta

- [ ] Carrito con Zustand.
- [ ] Preview fiscal con Intifact compute.
- [ ] Crear venta atómica en PostgreSQL.
- [ ] Emitir boleta con Intifact.
- [ ] Estados de emisión y retry seguro.
- [ ] Ticket 80 mm.

## Fase 3 — control

- [ ] Historial y filtros de comprobantes.
- [ ] Anulación de boletas.
- [ ] Registro/anulación de egresos.
- [ ] Facturado, egresos y resultado simple por período.

## Fase 4 — endurecimiento para producción

- [ ] Backups externos y prueba de restauración.
- [ ] Observabilidad/errores.
- [ ] Tests E2E de emisión con ambiente test de Intifact.
- [ ] Revisión RLS con usuarios owner/cashier.
- [ ] Rate limiting en operaciones sensibles.
- [ ] Procedimiento operativo ante caída de Intifact/SUNAT.

## Fuera del MVP

Inventario, recetas, insumos, kardex, mermas, costo de venta, margen real, contabilidad completa y multiempresa avanzada. Se incorporarán solo cuando exista necesidad operativa concreta.
