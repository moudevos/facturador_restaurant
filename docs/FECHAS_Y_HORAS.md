# Fechas y horas

## Regla principal

El sistema maneja dos conceptos distintos:

1. **Instante absoluto**: se almacena en PostgreSQL como `timestamptz` y se genera desde servidor/BD.
2. **Fecha de negocio**: representa el día calendario del restaurante según `organizations.timezone` (por defecto `America/Lima`).

Nunca se guarda una segunda copia del mismo instante convertida a hora Perú. Esa duplicación genera inconsistencias. Se conserva un solo instante y se convierte al presentar o agrupar.

## PostgreSQL

PostgreSQL `timestamptz` ocupa 8 bytes (64 bits) y representa un instante con precisión de microsegundos. No depende del problema de timestamps Unix de 32 bits.

Campos como estos deben continuar siendo `timestamptz`:

- `created_at`
- `updated_at`
- `issued_at`
- `accepted_at`
- `voided_at`
- `received_at`
- `processed_at`

Se usa `default now()` para auditoría y creación. El navegador no debe enviar `created_at` ni `updated_at`.

## Hora de Perú

La zona de negocio inicial es:

```text
America/Lima
```

Debe usarse una zona IANA, no offsets fijos como `UTC-5` o `-05:00`.

Para convertir en PostgreSQL:

```sql
select timezone('America/Lima', created_at);
```

Para obtener el día de negocio:

```sql
select timezone('America/Lima', created_at)::date;
```

Las vistas de dashboard ya convierten `issued_at`/`created_at` usando `organizations.timezone` antes de agrupar por día.

## Egresos

`expenses.expense_date` es un `date`, no un timestamp. Representa la fecha contable/operativa de la compra.

Desde `006_estandar_fechas_y_horas.sql`, si no se envía `expense_date`, PostgreSQL la calcula con su propio reloj y la zona horaria de la organización. También puede enviarse explícitamente una fecha pasada cuando se registra una compra de otro día.

## Frontend

Nunca formatear fechas dependiendo de la zona del equipo del usuario. Usar explícitamente la zona del negocio:

```ts
new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  dateStyle: 'short',
  timeStyle: 'short',
}).format(date);
```

El helper oficial del proyecto está en `src/lib/date-time.ts`.

## Facturación / Intifact

- El momento de emisión se determina del lado servidor.
- `issued_at` se guarda como `timestamptz`.
- Los campos de fecha/hora que Intifact/SUNAT requieran en hora local se construyen desde ese instante usando `America/Lima`.
- Nunca se usa el reloj del navegador como fuente de verdad fiscal.

## Reglas que no deben romperse

- No usar `timestamp without time zone` para eventos reales.
- No almacenar timestamps Unix de 32 bits.
- No guardar `created_at_peru` junto a `created_at`.
- No usar `current_date` para una fecha de negocio sin hacer explícita la zona horaria.
- No confiar en la zona horaria configurada en Windows, navegador, Node.js o sesión SQL.
- Los filtros "hoy" deben usar límites del día en la zona del negocio o las vistas `business_date`, no asumir UTC.
