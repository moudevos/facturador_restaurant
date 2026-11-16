# Rediseño: restaurante, POS interno y resultado simple

## Objetivo y alcance

Este trabajo amplía el facturador existente **sin destruir** el circuito fiscal:
POS de venta directa, tickets internos, ingresos adicionales, egresos,
deudas y reporte simple por fecha. No hay inventario, kardex, activos,
depreciaciones ni contabilidad general.

**Resultado simple = ingresos registrados − gastos registrados**. Las compras
se registran como egreso en su fecha de negocio, incluso cuando son a crédito.
Un abono reduce el saldo de la deuda, **nunca** vuelve a restar el gasto.
Esta medición es un resultado operativo bruto, no utilidad neta contable
ni fiscal. Para efectos tributarios hay que reconciliar IGV y documentos.

## Lo que se puede probar en esta rama

- \`/pos-rapido\`: caja abierta obligatoria, búsqueda de productos,
  combos cuyo precio es fijo o la suma de sus componentes, adicionales gratuitos
  o con precio, notas, descuentos por línea y venta, cobros mixtos y comprobante
  **interno** de 58/80 mm.
- \`/ventas\`: caja actual conservada del proyecto original. Las ventas internas
  en efectivo se registran como movimiento \`cash_in\` y figuran en el arqueo.
  El registro de un egreso no mueve la caja.
- \`/historial-interno\`: visualizar operaciones, revertir venta interna
  sin comprobante fiscal y registrar devoluciones parciales o totales.
  La reversión del día actual no modifica un arqueo cerrado.
- \`/ingresos\`: otros ingresos, distintos de las ventas del POS.
- \`/egresos/registro\`: registrar compras y gastos, fecha real,
  categoría personalizada, pago opcional, crédito y archivo privado.
- \`/egresos/deudas\`: saldo y abonos parciales sin duplicar egreso.
- \`/resultado\`: vista de ingresos, egresos y resultado por período.
- \`/metodos-pago\`, \`/descuentos\`, \`/categorias-egresos\`,
  \`/combos\` e \`/impresion-ticket\`: configuraciones.
- \`/comprobantes\`: circuito fiscal ya existente. No se eliminó ni se
  sobreescribió.

## Límites importantes antes de llevar a producción

Este PR es **de desarrollo**: no asumir que está validado en una base real.
Las migraciones 017–019 no se han aplicado ni probado contra Supabase.
Hay que probar con una base de ensayo y verificar integración de caja,
RLS y conciliación de ventas. El nuevo flujo POS interno todavía **NO**
puede generar desde su historial una boleta/factura electrónica Intifact;
solo emite ticket interno. La vinculación fiscal posterior, la emisión de
notas de crédito y la reconciliación del flujo fiscal siguen pendientes.
El facturador fiscal anterior permanece operativo en sus rutas originales.

Las devoluciones se registran manualmente y pueden estar pendientes de
pago; cuando la devolución se hace en efectivo, requiere la sesión actual
abierta. Una operación con documento fiscal vinculado no se puede revertir
mediante el flujo interno: requiere primero corregir el estado fiscal por
un proceso autorizado.

La impresión usa la opción del navegador. Para impresoras térmicas,
confirmar configuración de papel/márgenes y dispositivo en el equipo local.

## Instalación de SQL sin migraciones automáticas

1. Realizar **backup** o usar una base de ensayo.
2. Comprobar que \`public.schema_change_log\` registra \`001\` a \`016\`.
3. Ejecutar **en este orden**, una sola vez, desde Supabase SQL Editor:

   - \`database/sql/017_finanzas_restaurante.sql\`
   - \`database/sql/018_ventas_internas.sql\`
   - \`database/sql/019_egresos_credito_adjuntos.sql\`

4. Cada archivo tiene \`begin/commit\`, validación de prerequisitos y
   \`schema_change_log\`. No reejecutar scripts aplicados.
5. Para verificar el registro:

   \`\`\`sql
   select script_code, script_name, executed_at
   from public.schema_change_log
   where script_code in ('017','018','019')
   order by script_code;
   \`\`\`

6. Comprobar permisos y flujos con un usuario \`owner\` real en un local
   de pruebas: registro de ingreso, gasto, deuda, cobro combinado,
   anulación, devolución en caja nueva y cálculo del resultado.

Para archivos, \`restaurant-expense-docs\` es un bucket privado. Los
documentos deben asociarse al egreso y al mismo \`organization_id\`.

## Ejecución local (PowerShell)

\`\`\`powershell
git fetch origin
git switch feat/restaurant-pos-finanzas-redesign
git pull --ff-only origin feat/restaurant-pos-finanzas-redesign
corepack enable
pnpm install --frozen-lockfile
pnpm dev -p 3001
\`\`\`

Si la rama todavía no existe en tu clon:
\`git switch -c feat/restaurant-pos-finanzas-redesign --track origin/feat/restaurant-pos-finanzas-redesign\`.

En \`.env.local\` reutiliza las credenciales propias de Supabase y
las de Intifact del proyecto base. Nunca publiques las claves secretas.

## Modernización frontend

El frontend nuevo utiliza controles nativos (formularios, validación del
navegador, \`<details>\`, impresión CSS), estados de carga, teclas táctiles
de tamaño suficiente, etiquetas y zonas de alerta accesibles, con layout
responsive, sin incorporar otra biblioteca de componentes.

Referencia oficial:
https://github.com/GoogleChrome/modern-web-guidance

Ejecutar con acceso a internet en la raíz del repo:

\`\`\`powershell
npx modern-web-guidance@latest install
npx -y modern-web-guidance@latest legacy-scan . --json
npx modern-web-guidance@latest search "accessible interactive forms"
\`\`\`

**Nota:** \`modern-web-guidance\` no pudo ejecutarse en el entorno de
autoría (sin acceso al registro npm). No se inventa ningún resultado de
\`legacy-scan\`. Hay que ejecutar la auditoría antes de aprobar PR.
Además hay que ejecutar \`pnpm lint\`, \`pnpm typecheck\`,
\`pnpm test:unit\` y \`pnpm build\` localmente o por CI.

## Criterios de pruebas

- Venta de S/ 10 con efectivo S/ 4, Yape S/ 6: un ingreso S/ 10,
  efectivo esperado en caja +S/ 4, Yape no suma efectivo.
- Compra de S/ 200 a crédito: egreso del día +S/ 200;
  abono S/ 80 hoy y S/ 120 mañana no genera otros egresos.
- Anular mañana una venta de hoy: ajuste mañana −S/ 10
  y arqueo de hoy permanece intacto.
- Devolver S/ 10 en efectivo mañana: salida de caja mañana,
  pero sin crear otro gasto en P&L.
- Ticket 58/80, addons gratuitos, porcentajes y topes,
  selección de cliente, categorías y filtros por fecha.
