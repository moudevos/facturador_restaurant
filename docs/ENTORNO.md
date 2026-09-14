# Entorno de desarrollo

## Requisitos

- Git.
- Node.js 22 o superior. El repositorio incluye `.nvmrc`.
- Corepack habilitado para pnpm.
- VS Code recomendado, aunque no obligatorio.

## Preparación

```bash
git clone https://github.com/moudevos/facturador_restaurant.git
cd facturador_restaurant
nvm use
corepack enable
pnpm install
cp .env.example .env.local
pnpm dev
```

Abrir `http://localhost:3000`.

Para pruebas E2E instalar Chromium una vez:

```bash
pnpm exec playwright install chromium
```

## Lockfile

El primer `pnpm install` genera `pnpm-lock.yaml`. Debe agregarse al repositorio inmediatamente y, desde ese momento, CI debe instalar con lockfile congelado. No regenerarlo sin un cambio explícito de dependencias.

## Variables

`NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` son públicas por diseño. Cualquier credencial de Intifact o clave privilegiada de Supabase es secreto de servidor y nunca debe usar el prefijo `NEXT_PUBLIC_`.

## Antes de programar dominio

1. Ejecutar los SQL `001` a `005` en orden.
2. Crear el primer usuario desde Supabase Auth.
3. Ejecutar la plantilla `database/templates/crear_empresa_inicial.sql` luego de editar sus valores.
4. Confirmar que `/login` permite acceder y que el usuario ve el dashboard.
