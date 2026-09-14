# Supabase Edge Functions

Este directorio queda reservado para operaciones que requieran secretos o integración con terceros.

Funciones previstas cuando se implemente Intifact:

- `billing`: compute, emisión, retry, descarga y anulación mediante una API interna controlada.
- `intifact-webhook`: recepción y validación HMAC de eventos cuando el plan contratado soporte webhooks.

No se crea código placeholder que responda éxito sin ejecutar la operación real. La función se agregará cuando se implemente el contrato completo y sus pruebas.

Las funciones no sustituyen RLS. Deben validar la identidad del usuario cuando la operación provenga de la aplicación y usar secretos configurados en Supabase, nunca variables `NEXT_PUBLIC_*`.
