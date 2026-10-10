# Contrato Android para impresoras Bluetooth Classic

Muchas impresoras térmicas genéricas usan Bluetooth Classic SPP/RFCOMM y no pueden ser controladas por Web Bluetooth.

El frontend está desacoplado del transporte. Un host Android con WebView debe publicar un objeto JavaScript llamado `FacturadorPrinter` con:

```text
isAvailable()
printEscPosBase64(base64)
```

`printEscPosBase64` recibe exactamente los bytes ESC/POS generados por el POS codificados en Base64. El host Android debe:

1. solicitar permisos Bluetooth correspondientes a la versión de Android;
2. seleccionar o recordar el dispositivo emparejado;
3. abrir RFCOMM/SPP;
4. decodificar Base64;
5. escribir los bytes al socket;
6. cerrar/reutilizar la conexión de forma segura;
7. devolver error al WebView si la escritura falla.

No se debe almacenar una MAC de impresora compartida en Supabase. Cada tablet/caja mantiene su dispositivo local.

Este contrato permite añadir el wrapper nativo posteriormente sin modificar carrito, venta, comprobante ni motor fiscal.
