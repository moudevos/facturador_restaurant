# ApiPeru — validación de clientes

El alta de clientes usa ApiPeru únicamente desde el servidor. El token nunca debe exponerse con `NEXT_PUBLIC_`.

## Variables

```env
APIPERU_API_URL=https://api.apiperu.dev
APIPERU_API_TOKEN=TU_TOKEN
```

## Flujo

1. En "Nuevo cliente" se solicita primero el número de documento.
2. Ocho dígitos se interpretan como DNI y once como RUC.
3. El Server Action consulta ApiPeru.
4. Para DNI se usa `POST /dni` y se recupera el nombre completo.
5. Para RUC se usa `POST /ruc` y se recuperan razón social, estado, condición y dirección.
6. Solo después de una respuesta `found` se habilita el guardado del cliente.
7. Nombre/razón social y, para RUC, dirección provienen de la consulta y no se editan en el flujo normal.
8. Teléfono y correo continúan siendo datos internos opcionales.

## Errores

La integración decide por `code` y `retryable`, no por el texto del mensaje:

- `invalid_input`: no reintentar.
- `document_not_found`: no reintentar.
- `upstream_unavailable`: mostrar error temporal y permitir nueva consulta.
- HTTP 401/403: revisar token/permisos.
- HTTP 429: se alcanzó el límite del plan.

ApiPeru indica que la consulta DNI usa padrón reducido SUNAT y otras fuentes públicas, no RENIEC. Por eso un DNI sin resultado puede ser válido en la realidad; en esta primera versión no se crea como "verificado" para evitar completar datos fiscales manualmente con errores.
