# Roadmap

## Fase 0 — base técnica

- [x] Next.js + TypeScript + Tailwind.
- [x] Supabase SSR/Auth.
- [x] RLS y roles base.
- [x] SQL secuencial y registro de ejecución.
- [x] Esquema de productos, ventas, egresos y auditoría.
- [x] Vitest + Playwright + CI.

## Fase 1 — administración mínima

- [x] Alta/edición de productos.
- [x] Configuración visual de empresa/local.
- [x] Gestión básica de usuarios owner/cashier.
- [x] Clientes base para boletas/facturas.
- [x] Dashboard conectado a datos reales de Supabase.

## Fase 2 — operación de venta

- [x] Área de venta con apertura/cierre de sesión de caja.
- [x] Fondo inicial, movimientos y arqueo.
- [x] Historial de sesiones.
- [x] POS independiente por sesión.
- [x] Carrito con Zustand.
- [x] Selector de productos y clientes.
- [x] Cobro y persistencia del medio de pago.
- [x] Reserva atómica del correlativo mediante PostgreSQL.
- [x] Preview fiscal con Intifact compute.
- [x] Emitir boleta/factura con Intifact.
- [x] Estados de emisión y retry seguro.
- [x] Ticket fiscal A4 / 80 mm / 58 mm.

## Fase 3 — control

- [x] Historial, filtros, detalle y descargas de comprobantes.
- [ ] Anulación de boletas.
- [x] Registro/anulación de egresos.
- [x] Resumen operativo de ventas, egresos y sesión en Dashboard.
- [ ] Reportes por período y exportación.

## Fase 4 — endurecimiento para producción

- [ ] Backups externos y prueba de restauración.
- [ ] Observabilidad/errores.
- [ ] Tests E2E de emisión con ambiente test de Intifact.
- [ ] Revisión RLS con usuarios owner/cashier.
- [ ] Rate limiting en operaciones sensibles.
- [ ] Procedimiento operativo ante caída de Intifact/SUNAT.

## Fuera del MVP

Inventario, recetas, insumos, kardex, mermas, costo de venta, margen real, contabilidad completa y multiempresa avanzada. Se incorporarán solo cuando exista necesidad operativa concreta.
