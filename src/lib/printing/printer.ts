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
      await characteristic.writeValueWithoutResponse(chunk as unknown as BufferSource);
    } else if (characteristic.writeValue) {
      await characteristic.writeValue(chunk as unknown as BufferSource);
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
  const width = data.paperWidth === "80" || data.paperWidth === "a4" ? 48 : 32;
  const qtyWidth = 4;
  const unitWidth = 7;
  const totalWidth = 7;
  const descWidth = width - qtyWidth - unitWidth - totalWidth - 3;
  const chunks: number[] = [];
  const encoder = new TextEncoder();

  const push = (...values: number[]) => chunks.push(...values);
  const text = (value: string) =>
    push(...encoder.encode(ascii(value)));

  push(0x1b, 0x40);
  push(0x1b, 0x61, 0x01);
  push(0x1b, 0x45, 0x01);
  text(data.displayName.toUpperCase() + "\n");
  push(0x1b, 0x45, 0x00);

  if (data.legalName !== data.displayName) {
    text(data.legalName + "\n");
  }

  text("RUC: " + data.ruc + "\n");
  text(data.branchName + "\n");
  if (data.branchAddress) {
    text(data.branchAddress + "\n");
  }
  push(0x1b, 0x45, 0x01);
  text(data.documentTypeLabel + "\n");
  text(data.documentNumber + "\n");
  push(0x1b, 0x45, 0x00);

  if (data.isTest) {
    text("DOCUMENTO DE PRUEBA\nSIN VALIDEZ FISCAL\n");
  }

  text("-".repeat(width) + "\n");
  push(0x1b, 0x61, 0x00);
  text(
    "FECHA: " +
      data.issueDateLabel +
      "  HORA: " +
      data.issueTimeLabel +
      "\n",
  );
  text("LOCAL: " + data.branchName + "\n");

  text("CLIENTE: " + data.clientName + "\n");
  if (data.clientDocument) {
    text(
      (data.clientDocumentLabel || "DOC") +
        ": " +
        data.clientDocument +
        "\n",
    );
  }

  text("-".repeat(width) + "\n");

  text(
    pad("CANT", qtyWidth) +
      " " +
      pad("DESCRIPCION", descWidth) +
      " " +
      padLeft("P.UNIT", unitWidth) +
      " " +
      padLeft("IMPORTE", totalWidth) +
      "\n",
  );
  text("-".repeat(width) + "\n");

  for (const item of data.items) {
    const label = data.showProductCode
      ? item.code + " " + item.description
      : item.description;
    const lines = wrapText(label, descWidth);

    lines.forEach((description, index) => {
      text(
        pad(index === 0 ? quantity(item.quantity) : "", qtyWidth) +
          " " +
          pad(description, descWidth) +
          " " +
          padLeft(index === 0 ? money(item.unitPrice) : "", unitWidth) +
          " " +
          padLeft(index === 0 ? money(item.total) : "", totalWidth) +
          "\n",
      );
    });
  }

  text("-".repeat(width) + "\n");

  const subtotal = Math.max(0, data.totalAmount - data.igvAmount);
  text(line("SUBTOTAL", "S/ " + money(subtotal), width) + "\n");

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
    line(
      "IGV (" + (data.taxableAmount > 0 ? "18%" : "0%") + ")",
      "S/ " + money(data.igvAmount),
      width,
    ) + "\n",
  );

  push(0x1b, 0x45, 0x01);
  text(
    line("TOTAL", "S/ " + money(data.totalAmount), width) +
      "\n",
  );
  push(0x1b, 0x45, 0x00);

  text("\n");

  if (data.showPaymentMethod && data.paymentLabel) {
    text("FORMA DE PAGO: " + data.paymentLabel + "\n");
  }

  if (data.receivedAmount !== null) {
    text(
      "MONTO RECIBIDO: S/ " +
        money(data.receivedAmount) +
        "\n",
    );
  } else if (data.paymentAmount !== null) {
    text(
      "MONTO PAGADO: S/ " +
        money(data.paymentAmount) +
        "\n",
    );
  }

  if (data.changeAmount > 0) {
    text("VUELTO: S/ " + money(data.changeAmount) + "\n");
  }

  push(0x1b, 0x61, 0x01);
  push(0x1b, 0x45, 0x01);
  text("\n!GRACIAS POR SU VISITA!\n");
  push(0x1b, 0x45, 0x00);

  if (data.footerText) {
    text(data.footerText + "\n");
  }

  text("\nRepresentacion impresa del comprobante electronico\n");
  pushQr(chunks, data.verificationUrl);
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
    issueDateLabel: "10/10/2026",
    issueTimeLabel: "14:47",
    acceptedAt: null,
    displayName: "Facturador Restaurant",
    legalName: "Prueba local",
    ruc: "00000000000",
    branchName: "Caja",
    branchAddress: null,
    clientName: "CLIENTE DE PRUEBA",
    clientDocument: "73531356",
    clientDocumentLabel: "DNI",
    paymentLabel: "Efectivo",
    paymentAmount: 10,
    receivedAmount: 20,
    changeAmount: 10,
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

function quantity(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

function pad(value: string, width: number) {
  const normalized = value.slice(0, width);
  return normalized + " ".repeat(Math.max(0, width - normalized.length));
}

function padLeft(value: string, width: number) {
  const normalized = value.slice(-width);
  return " ".repeat(Math.max(0, width - normalized.length)) + normalized;
}

function wrapText(value: string, width: number) {
  const normalized = ascii(value).trim();
  if (!normalized) return [""];

  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = "";
      }

      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      continue;
    }

    const candidate = current ? current + " " + word : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
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
