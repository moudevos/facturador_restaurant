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
6. Si el DNI es encontrado, se guarda como cliente verificado y el nombre proviene de ApiPeru.
7. Si ApiPeru devuelve `document_not_found` para un DNI, el POS permite un alta manual explícita: nombre, dirección y contacto son ingresados por el cajero.
8. Un RUC no encontrado no habilita alta manual para factura; debe verificarse primero para evitar una identidad fiscal inválida.
9. Teléfono y correo continúan siendo datos internos opcionales.

## Errores

La integración decide por `code` y `retryable`, no por el texto del mensaje:

- `invalid_input`: no reintentar.
- `document_not_found`: no reintentar.
- `upstream_unavailable`: mostrar error temporal y permitir nueva consulta.
- HTTP 401/403: revisar token/permisos.
- HTTP 429: se alcanzó el límite del plan.

ApiPeru indica que la consulta DNI usa padrón reducido SUNAT y otras fuentes públicas, no RENIEC. Por eso un DNI sin resultado puede ser válido en la realidad. Desde el flujo manual ese DNI se puede guardar, pero la interfaz lo identifica como dato ingresado manualmente y no como resultado verificado por ApiPeru.

Para `Cliente varios` no se inventa un DNI/RUC. El snapshot de la venta conserva el nombre `CLIENTE VARIOS`, mientras que el request fiscal omite por completo `clienteTipoDoc`, `clienteNumDoc` y `clienteRazonSocial` en lugar de enviarlos como `null`.
