# POS y sesiones de caja

## Rutas

- `/ventas`: Área de venta. Apertura, estado, movimientos, cierre e historial de sesiones.
- `/pos/[sessionId]`: POS independiente, sin sidebar administrativo.
- `/clientes`: catálogo simple de clientes utilizado por el POS.

## Flujo

1. Abrir sesión para un local.
2. Registrar fondo inicial y cajero responsable.
3. Abrir el POS en otra pestaña.
4. Paso 1: seleccionar productos y preparar el carrito.
5. Paso 2: seleccionar cliente y comprobante.
6. Cobrar en efectivo, Yape, Plin, tarjeta o transferencia.
7. PostgreSQL valida sesión/productos/precios, reserva correlativo y registra el pago.
8. Reiniciar el POS para la siguiente venta sin cerrar la sesión.
9. Al terminar el turno, contar efectivo y cerrar la sesión.

## Caja versus egresos

Los movimientos de caja no son sinónimos de egresos. Un retiro a caja fuerte solo cambia dónde está el efectivo. Una compra de insumos puede requerir además registrar un egreso financiero, pero esa vinculación no se automatiza en el MVP para evitar doble contabilización.

## Fiscal

El POS actual registra la venta local y reserva su identidad fiscal. No marca la venta como aceptada por SUNAT. La siguiente fase debe integrar Intifact compute/send/polling sobre la misma venta, sin generar un nuevo correlativo ante retries.
