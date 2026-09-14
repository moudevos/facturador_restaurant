# Seguridad

## Principios

- RLS en toda tabla expuesta al Data API.
- Privilegio mínimo con `GRANT` además de RLS.
- El navegador solo recibe la publishable key.
- API keys de Intifact, webhook secrets y claves privilegiadas permanecen en servidor.
- Ningún documento financiero final se elimina físicamente.
- Cambios relevantes quedan en `audit_logs`.

## Roles

`owner`: administración, productos, egresos, usuarios y lectura completa de su organización.

`cashier`: consulta de catálogo y comprobantes del local permitido, y creación de ventas mediante la función controlada `create_sale_draft`.

El frontend puede ocultar controles por rol, pero eso es UX. La autorización real está en PostgreSQL/RLS.

## SECURITY DEFINER

Las funciones privilegiadas fijan `search_path`, desactivan RLS internamente solo donde es necesario y se revoca `EXECUTE` público. Solo se concede ejecución explícita a `authenticated` en funciones diseñadas para usuarios.

## Intifact

- No registrar la API key en logs.
- Verificar webhooks sobre el body crudo.
- Validar HMAC-SHA256, timestamp y delivery ID.
- `webhook_events.delivery_id` es único para impedir procesamiento duplicado.
- Un timeout al emitir no autoriza a generar otro correlativo.

## Supabase Free

El plan Free es adecuado para el MVP, pero no debe considerarse una estrategia de backup. Antes de producción debe existir exportación periódica verificable de PostgreSQL y un procedimiento probado de restauración.

## Usuarios

No habrá registro público desde la aplicación. Los usuarios se crean/controlan administrativamente. El login usa Supabase Auth y el servidor valida claims; no se confía en una sesión enviada por el cliente sin validación.
