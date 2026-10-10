# PWA e impresión

## PWA

La aplicación publica un Web App Manifest y registra un service worker. El service worker solo cachea recursos estáticos; no cachea navegaciones ni endpoints `/api/`.

Esto permite instalación como PWA sin convertir el POS en un sistema de ventas offline. Las ventas requieren backend, Intifact y reconciliación fiscal.

En producción la PWA y Web Bluetooth requieren HTTPS. `localhost` puede usarse en desarrollo.

## Perfiles

`receipt_settings.paper_width` admite:

- `48`: perfil compacto de 48 mm útiles.
- `58`: papel 58 mm.
- `80`: papel 80 mm.
- `a4`: hoja A4.

Para la impresora genérica actual se usa inicialmente 48 mm. Si el hardware resulta ser rollo 58 mm con aproximadamente 48 mm imprimibles, basta cambiar el perfil.

## PrinterAdapter

La capa web tiene tres modos:

```text
system
bluetooth-ble
android-bridge
```

### system

Usa el sistema de impresión del navegador/OS y la representación personalizada. Es el fallback universal. El navegador puede exigir interacción para abrir el diálogo; no se garantiza impresión silenciosa.

### bluetooth-ble

Usa Web Bluetooth, descubre servicios GATT y una característica escribible y envía ESC/POS en bloques. El vínculo se guarda por dispositivo/navegador; no en Supabase.

Si el dispositivo no expone GATT, probablemente usa Bluetooth Classic/SPP.

### android-bridge

El POS ya soporta el contrato:

```ts
window.FacturadorPrinter = {
  isAvailable?: () => boolean,
  printEscPosBase64: (payload: string) => void | Promise<void>
}
```

Un wrapper Android puede implementar ese contrato con RFCOMM/SPP y enviar los bytes ESC/POS a una impresora Bluetooth Classic sin cambiar el POS.

El repositorio web no incluye todavía un APK/wrapper Android nativo. Primero se prueba BLE; si la impresora genérica resulta Classic se implementa el host Android contra este contrato.

## Autoimpresión

La autoimpresión solo se intenta cuando la venta está simultáneamente `accepted` y `completed`.

En modo BLE o Android bridge puede ser directa. En modo system el navegador/OS puede mostrar un diálogo de impresión.

## Representación

La representación propia utiliza nombre comercial, nombre legal, RUC, CLIENTE, local, detalle, totales y pie configurado. En `fact_test_` siempre muestra que es un documento de prueba sin validez fiscal. El PDF original de Intifact permanece disponible como artefacto oficial.
