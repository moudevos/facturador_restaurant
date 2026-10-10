import type {
  ReceiptPaperWidth,
  ReceiptPrinterMode,
} from "@/features/settings/types";
import type { ReceiptData } from "@/features/receipts/types/receipt";

const BLE_STORAGE_KEY = "facturador:printer:ble";

const COMMON_PRINTER_SERVICES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "000018f0-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

type WritableProperties = {
  write?: boolean;
  writeWithoutResponse?: boolean;
};

type BleCharacteristic = {
  properties?: WritableProperties;
  writeValue?: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
};

type BleService = {
  getCharacteristics(): Promise<BleCharacteristic[]>;
};

type BleServer = {
  getPrimaryServices(): Promise<BleService[]>;
};

type BleDevice = {
  id: string;
  name?: string | null;
  gatt?: {
    connect(): Promise<BleServer>;
  };
};

type BluetoothLike = {
  requestDevice(options: {
    acceptAllDevices: boolean;
    optionalServices: string[];
  }): Promise<BleDevice>;
  getDevices?(): Promise<BleDevice[]>;
};

type AndroidPrinterBridge = {
  isAvailable?: () => boolean;
  printEscPosBase64?: (payload: string) => void | Promise<void>;
};

declare global {
  interface Window {
    FacturadorPrinter?: AndroidPrinterBridge;
  }
}

function browserBluetooth(): BluetoothLike | null {
  if (typeof navigator === "undefined") return null;

  return (
    navigator as Navigator & {
      bluetooth?: BluetoothLike;
    }
  ).bluetooth ?? null;
}

export function getPrinterStatus() {
  if (typeof window === "undefined") {
    return {
      bleSupported: false,
      bleDeviceName: null as string | null,
      androidBridge: false,
    };
  }

  let bleDeviceName: string | null = null;

  try {
    const saved = localStorage.getItem(BLE_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as {
        id?: string;
        name?: string | null;
      };
      bleDeviceName = parsed.name || null;
    }
  } catch {
    // El permiso del navegador es la fuente real del vínculo.
  }

  return {
    bleSupported: Boolean(browserBluetooth()),
    bleDeviceName,
    androidBridge: Boolean(
      window.FacturadorPrinter &&
        (!window.FacturadorPrinter.isAvailable ||
          window.FacturadorPrinter.isAvailable()),
    ),
  };
}

export async function linkBlePrinter() {
  const bluetooth = browserBluetooth();

  if (!bluetooth) {
    throw new Error(
      "Web Bluetooth no está disponible. Usa impresión del sistema o el bridge Android.",
    );
  }

  const device = await bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: COMMON_PRINTER_SERVICES,
  });

  if (!device.gatt) {
    throw new Error(
      "El dispositivo no expone BLE/GATT. Probablemente usa Bluetooth Classic/SPP.",
    );
  }

  const server = await device.gatt.connect();
  await findWritableCharacteristic(server);

  try {
    localStorage.setItem(
      BLE_STORAGE_KEY,
      JSON.stringify({
        id: device.id,
        name: device.name || "Impresora BLE",
      }),
    );
  } catch {
    // No impide imprimir.
  }

  return { id: device.id, name: device.name ?? null };
}

export async function printTestReceipt(
  mode: ReceiptPrinterMode,
  paperWidth: ReceiptPaperWidth,
) {
  if (mode === "system") {
    printSystemTest(paperWidth);
    return;
  }

  const bytes = buildEscPosReceipt(testReceipt(paperWidth, mode));

  if (mode === "bluetooth-ble") {
    await writeBle(bytes);
    return;
  }

  await writeAndroidBridge(bytes);
}

export async function printSaleReceipt(
  saleId: string,
  options: { requireAutoPrint?: boolean } = {},
): Promise<boolean> {
  const response = await fetch(
    "/api/receipts/" + encodeURIComponent(saleId),
    { cache: "no-store" },
  );

  const payload = (await response.json()) as ReceiptData & {
    error?: string;
  };

  if (!response.ok) {
    throw new Error(
      payload.error || "No se pudo preparar el comprobante.",
    );
  }

  if (options.requireAutoPrint && !payload.autoPrint) {
    return false;
  }

  if (payload.printerMode === "system") {
    printSystemReceipt(saleId, payload.paperWidth);
    return true;
  }

  const bytes = buildEscPosReceipt(payload);

  if (payload.printerMode === "bluetooth-ble") {
    await writeBle(bytes);
    return true;
  }

  await writeAndroidBridge(bytes);
  return true;
}

function printSystemReceipt(
  saleId: string,
  paperWidth: ReceiptPaperWidth,
) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.width = "1px";
  iframe.style.height = "1px";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.src =
    "/print/comprobantes/" +
    encodeURIComponent(saleId) +
    "?paper=" +
    encodeURIComponent(paperWidth);

  iframe.onload = () => {
    window.setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      window.setTimeout(() => iframe.remove(), 2_000);
    }, 350);
  };

  document.body.appendChild(iframe);
}

function printSystemTest(paperWidth: ReceiptPaperWidth) {
  const popup = window.open(
    "",
    "_blank",
    "noopener,noreferrer,width=420,height=700",
  );

  if (!popup) {
    throw new Error("El navegador bloqueó la ventana de impresión.");
  }

  const width =
    paperWidth === "a4"
      ? "190mm"
      : paperWidth === "80"
        ? "72mm"
        : paperWidth === "58"
          ? "54mm"
          : "48mm";

  popup.document.write(
    "<!doctype html><html><head><title>Prueba de impresora</title>" +
      "<style>body{font-family:ui-monospace,monospace;width:" +
      width +
      ";margin:0 auto;padding:4mm;font-size:11px}" +
      "h1{text-align:center;font-size:16px}hr{border:0;border-top:1px dashed #000}" +
      ".center{text-align:center}</style></head><body>" +
      "<h1>FACTURADOR RESTAURANT</h1>" +
      "<p class='center'>PRUEBA DE IMPRESION</p><hr>" +
      "<p>Ancho: " +
      paperWidth +
      "</p><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>1234567890</p>" +
      "<hr><p class='center'>OK</p>" +
      "<script>window.onload=()=>window.print()</script></body></html>",
  );
  popup.document.close();
}

async function writeBle(bytes: Uint8Array) {
  const bluetooth = browserBluetooth();

  if (!bluetooth?.getDevices) {
    throw new Error(
      "El navegador no permite recuperar la impresora BLE. Vuelve a vincularla.",
    );
  }

  let savedId: string | null = null;
  try {
    const saved = localStorage.getItem(BLE_STORAGE_KEY);
    if (saved) {
      savedId =
        (JSON.parse(saved) as { id?: string }).id ?? null;
    }
  } catch {
    // Ignorar.
  }

  const devices = await bluetooth.getDevices();
  const device =
    devices.find((item) => item.id === savedId) ?? devices[0];

  if (!device?.gatt) {
    throw new Error(
      "No hay una impresora BLE autorizada en este dispositivo.",
    );
  }

  const server = await device.gatt.connect();
  const characteristic = await findWritableCharacteristic(server);

  for (let offset = 0; offset < bytes.length; offset += 180) {
    const chunk = bytes.slice(offset, offset + 180);

    if (
      characteristic.properties?.writeWithoutResponse &&
      characteristic.writeValueWithoutResponse
    ) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(chunk);
    } else {
      throw new Error(
        "La característica BLE no permite escritura.",
      );
    }
  }
}

async function findWritableCharacteristic(server: BleServer) {
  const services = await server.getPrimaryServices();

  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find(
      (item) =>
        item.properties?.writeWithoutResponse ||
        item.properties?.write,
    );
    if (writable) return writable;
  }

  throw new Error(
    "La impresora se conectó, pero no expone escritura ESC/POS por BLE. Puede ser Bluetooth Classic.",
  );
}

async function writeAndroidBridge(bytes: Uint8Array) {
  const bridge = window.FacturadorPrinter;

  if (!bridge?.printEscPosBase64) {
    throw new Error(
      "Android bridge no está disponible en esta instalación. Usa impresión del sistema hasta instalar el wrapper Android.",
    );
  }

  await bridge.printEscPosBase64(toBase64(bytes));
}

function toBase64(bytes: Uint8Array) {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(
      ...bytes.subarray(index, index + 0x8000),
    );
  }

  return btoa(binary);
}

export function buildEscPosReceipt(data: ReceiptData) {
  const width = data.paperWidth === "80" ? 48 : 32;
  const chunks: number[] = [];
  const encoder = new TextEncoder();

  const push = (...values: number[]) => chunks.push(...values);
  const text = (value: string) =>
    push(...encoder.encode(ascii(value)));

  push(0x1b, 0x40);
  push(0x1b, 0x61, 0x01);
  push(0x1b, 0x45, 0x01);
  text(data.displayName + "\n");
  push(0x1b, 0x45, 0x00);

  if (data.legalName !== data.displayName) {
    text(data.legalName + "\n");
  }

  text("RUC " + data.ruc + "\n");
  text(data.documentTypeLabel + "\n");
  text(data.documentNumber + "\n");

  if (data.isTest) {
    push(0x1b, 0x45, 0x01);
    text("DOCUMENTO DE PRUEBA\nSIN VALIDEZ FISCAL\n");
    push(0x1b, 0x45, 0x00);
  }

  text("-".repeat(width) + "\n");

  push(0x1b, 0x61, 0x00);
  text("CLIENTE\n");
  text(data.clientName + "\n");

  if (data.clientDocument) {
    text("DOC: " + data.clientDocument + "\n");
  }

  text("FECHA: " + data.fiscalDate + "\n");

  if (data.showPaymentMethod && data.paymentLabel) {
    text("PAGO: " + data.paymentLabel + "\n");
  }

  text("-".repeat(width) + "\n");

  for (const item of data.items) {
    if (data.showProductCode) {
      text(item.code + " ");
    }

    text(
      item.quantity +
        " x " +
        item.description +
        "\n",
    );
    text(right("S/ " + money(item.total), width) + "\n");
  }

  text("-".repeat(width) + "\n");

  if (data.taxableAmount > 0) {
    text(
      line(
        "GRAVADA",
        "S/ " + money(data.taxableAmount),
        width,
      ) + "\n",
    );
  }

  if (data.exoneratedAmount > 0) {
    text(
      line(
        "EXONERADA",
        "S/ " + money(data.exoneratedAmount),
        width,
      ) + "\n",
    );
  }

  if (data.unaffectedAmount > 0) {
    text(
      line(
        "INAFECTA",
        "S/ " + money(data.unaffectedAmount),
        width,
      ) + "\n",
    );
  }

  text(
    line("IGV", "S/ " + money(data.igvAmount), width) + "\n",
  );

  push(0x1b, 0x45, 0x01);
  text(
    line("TOTAL", "S/ " + money(data.totalAmount), width) +
      "\n",
  );
  push(0x1b, 0x45, 0x00);

  push(0x1b, 0x61, 0x01);
  text("\nRepresentacion impresa del comprobante electronico\n");
  pushQr(chunks, data.verificationUrl);
  text("\n");

  if (data.footerText) {
    text(data.footerText + "\n");
  }

  text("\n\n");
  push(0x1d, 0x56, 0x41, 0x03);

  return new Uint8Array(chunks);
}

function testReceipt(
  paperWidth: ReceiptPaperWidth,
  printerMode: ReceiptPrinterMode,
): ReceiptData {
  return {
    saleId: "test",
    documentNumber: "TEST-00000001",
    documentTypeLabel: "PRUEBA DE IMPRESIÓN",
    fiscalDate: new Date().toISOString().slice(0, 10),
    acceptedAt: null,
    displayName: "Facturador Restaurant",
    legalName: "Prueba local",
    ruc: "00000000000",
    branchName: "Caja",
    branchAddress: null,
    clientName: "CLIENTE DE PRUEBA",
    clientDocument: null,
    paymentLabel: "Efectivo",
    items: [
      {
        code: "P000001",
        description: "Producto de prueba",
        quantity: 1,
        unit: "NIU",
        unitPrice: 10,
        total: 10,
      },
    ],
    taxableAmount: 0,
    exoneratedAmount: 10,
    unaffectedAmount: 0,
    igvAmount: 0,
    totalAmount: 10,
    logoUrl: null,
    footerText: "Impresión ESC/POS correcta",
    showProductCode: true,
    showPaymentMethod: true,
    paperWidth,
    printerMode,
    autoPrint: false,
    verificationUrl: "https://example.com",
    isTest: true,
  };
}

function pushQr(target: number[], value: string) {
  const data = new TextEncoder().encode(value);

  target.push(
    0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00,
  );
  target.push(
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, 0x05,
  );
  target.push(
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30,
  );

  const length = data.length + 3;

  target.push(
    0x1d,
    0x28,
    0x6b,
    length & 0xff,
    (length >> 8) & 0xff,
    0x31,
    0x50,
    0x30,
    ...data,
  );
  target.push(
    0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30,
  );
}

function ascii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "?");
}

function money(value: number) {
  return value.toFixed(2);
}

function right(value: string, width: number) {
  return value.length >= width
    ? value
    : " ".repeat(width - value.length) + value;
}

function line(
  left: string,
  rightValue: string,
  width: number,
) {
  const gap = Math.max(
    1,
    width - left.length - rightValue.length,
  );
  return left + " ".repeat(gap) + rightValue;
}
