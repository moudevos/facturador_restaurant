# Reglas de desarrollo

## Flujo de ramas
- Hasta que el proyecto pase formalmente a producción, `main` es la rama de desarrollo y concentra los cambios.
- Realizar commits y `push` directamente a `main`; no crear ramas de funcionalidades ni PR salvo solicitud explícita.
- Cuando se despliegue `main` en producción, cambiar al flujo de ramas por tarea con revisión antes de fusionar.
- Antes de hacer push, ejecutar `pnpm check` y comprobar que no haya migraciones SQL pendientes de aplicar manualmente.

## Arquitectura
- Next.js App Router con TypeScript estricto.
- Preferir Server Components. Usar `"use client"` solo cuando haya interacción, estado o APIs del navegador.
- Supabase es la fuente de verdad. No crear una API duplicada para CRUD ordinario.
- Operaciones fiscales y secretos de Intifact deben ejecutarse únicamente en servidor.
- Toda autorización de datos se aplica también con RLS; ocultar un botón no es seguridad.

## Base de datos
- No usar migraciones automáticas de Supabase.
- Cada cambio SQL nuevo crea `database/sql/NNN_descripcion.sql`.
- Nunca editar un SQL ya aplicado en producción.
- Montos monetarios: `numeric`, nunca `float`.
- Documentos fiscales y registros financieros no se eliminan físicamente.

## Dominio
- El MVP registra facturación e egresos generales.
- No llamar `ganancia` ni `utilidad` a `facturación - egresos`; usar `resultado simple`.
- No implementar inventario, recetas o márgenes reales sin una decisión explícita de alcance.

## Calidad
- Antes de integrar: `pnpm check`.
- Nuevas reglas de negocio deben incluir pruebas unitarias.
- Flujos críticos de login y facturación deben cubrirse con Playwright.
