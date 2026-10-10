"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  BadgeCheck,
  Bluetooth,
  Building2,
  CheckCircle2,
  Cloud,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Printer,
  RefreshCw,
  ShieldAlert,
  Smartphone,
} from "lucide-react";

import { useFeedback } from "@/components/feedback";
import {
  getPrinterStatus,
  linkBlePrinter,
  printTestReceipt,
} from "@/lib/printing";
import {
  getVerifiedEstablishmentsAction,
  importSunatEstablishmentsAction,
  saveReceiptSettingsAction,
  uploadReceiptLogoAction,
  verifyIssuerRucAction,
} from "../server/receipt-actions";
import type {
  IssuerFiscalProfile,
  ReceiptSettings,
  SunatEstablishment,
} from "../types";

export function ReceiptSettingsManager({
  isOwner,
  tradeName,
  issuer,
  settings,
}: {
  isOwner: boolean;
  tradeName: string | null;
  issuer: IssuerFiscalProfile;
  settings: ReceiptSettings;
}) {
  const { toast, withLoading } = useFeedback();

  const [ruc, setRuc] = useState(issuer.ruc);
  const [profile, setProfile] = useState(issuer);
  const [establishments, setEstablishments] = useState<SunatEstablishment[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [logoUrl, setLogoUrl] = useState(settings.logo_url);
  const [tradeNameValue, setTradeNameValue] = useState(tradeName ?? "");
  const [footerText, setFooterText] = useState(settings.footer_text ?? "");
  const [paperWidth, setPaperWidth] = useState(settings.paper_width);
  const [printerMode, setPrinterMode] = useState(settings.printer_mode);
  const [autoPrint, setAutoPrint] = useState(settings.auto_print);
  const [showProductCode, setShowProductCode] = useState(
    settings.show_product_code,
  );
  const [showPaymentMethod, setShowPaymentMethod] = useState(
    settings.show_payment_method,
  );
  const [saving, setSaving] = useState(false);
  const [printerStatus, setPrinterStatus] = useState({
    bleSupported: false,
    bleDeviceName: null as string | null,
    androidBridge: false,
  });

  useEffect(() => {
    setPrinterStatus(getPrinterStatus());
  }, []);

  const selectedCount = selectedCodes.length;
  const allImported = useMemo(
    () =>
      establishments.length > 0 &&
      establishments.every((item) => item.localImported),
    [establishments],
  );

  async function verifyRuc() {
    const result = await withLoading(() => verifyIssuerRucAction(ruc), {
      title: "Verificando emisor",
      message: "Consultando ApiPeru, domicilio fiscal e Intifact...",
    });

    if (!result.success || !result.data) {
      toast.error(result.message);
      return;
    }

    setProfile({
      ruc: result.data.ruc,
      legalName: result.data.legalName,
      tradeName: tradeNameValue || null,
      verified: true,
      verifiedAt: new Date().toISOString(),
      sunatStatus: result.data.taxpayerStatus,
      sunatCondition: result.data.taxpayerCondition,
      fiscalAddress: result.data.fiscalAddress,
      fiscalUbigeo: result.data.fiscalUbigeo,
      intifactCompanyId: result.data.intifactCompanyId,
      intifactVerifiedAt: result.data.intifactMatched
        ? new Date().toISOString()
        : null,
    });
    setRuc(result.data.ruc);
    setEstablishments(result.data.establishments);
    setSelectedCodes(
      result.data.establishments
        .filter((item) => !item.localImported)
        .map((item) => item.code),
    );

    if (result.data.intifactMatched) {
      toast.success(result.message);
    } else {
      toast.warning(result.data.intifactMessage || result.message);
    }
  }

  async function refreshEstablishments() {
    const result = await withLoading(() => getVerifiedEstablishmentsAction(), {
      title: "Consultando establecimientos",
      message: "Leyendo matriz y anexos declarados en SUNAT...",
    });

    if (!result.success || !result.data) {
      toast.error(result.message);
      return;
    }

    setEstablishments(result.data);
    setSelectedCodes(
      result.data
        .filter((item) => !item.localImported)
        .map((item) => item.code),
    );
    toast.success(result.message);
  }

  async function importEstablishments() {
    if (!selectedCodes.length) return;

    const result = await withLoading(
      () => importSunatEstablishmentsAction(selectedCodes),
      {
        title: "Importando locales",
        message: "Actualizando Locales con códigos y domicilios SUNAT...",
      },
    );

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    toast.success(result.message);
    await refreshEstablishments();
  }

  async function saveSettings() {
    setSaving(true);
    try {
      const result = await saveReceiptSettingsAction({
        tradeName: tradeNameValue,
        footerText,
        paperWidth,
        printerMode,
        autoPrint,
        showProductCode,
        showPaymentMethod,
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(result.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File | null) {
    if (!file) return;

    const formData = new FormData();
    formData.set("logo", file);

    const result = await withLoading(() => uploadReceiptLogoAction(formData), {
      title: "Subiendo logo",
      message: "Actualizando la identidad visual del comprobante...",
    });

    if (!result.success) {
      toast.error(result.message);
      return;
    }

    if (result.logoUrl) setLogoUrl(result.logoUrl);
    toast.success(result.message);
  }

  async function linkPrinter() {
    try {
      const linked = await linkBlePrinter();
      setPrinterStatus(getPrinterStatus());
      toast.success(
        "Impresora vinculada: " + (linked.name || "Bluetooth BLE") + ".",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo vincular la impresora.",
      );
    }
  }

  async function testPrinter() {
    try {
      await printTestReceipt(printerMode, paperWidth);
      toast.success("Prueba de impresión enviada.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo imprimir la prueba.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
        <SectionHeader
          icon={BadgeCheck}
          title="Emisor fiscal"
          description="RUC y nombre legal se verifican con ApiPeru. El mismo RUC se cruza con las empresas emisoras de Intifact."
        />

        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
              RUC
            </span>
            <input
              value={ruc}
              onChange={(event) =>
                setRuc(event.target.value.replace(/\D/g, "").slice(0, 11))
              }
              inputMode="numeric"
              disabled={!isOwner}
              className="erp-mono mt-1.5 h-12 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-lg font-bold outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:bg-[#f6f3ec]"
            />
          </label>

          {isOwner ? (
            <button
              type="button"
              onClick={() => void verifyRuc()}
              disabled={ruc.length !== 11}
              className="mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-orange-500 px-5 text-sm font-extrabold text-white disabled:opacity-50"
            >
              <RefreshCw className="size-4" />
              Verificar RUC
            </button>
          ) : null}
        </div>

        {profile.verified ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Info label="Nombre legal" value={profile.legalName} />
            <Info
              label="SUNAT"
              value={
                [profile.sunatStatus, profile.sunatCondition]
                  .filter(Boolean)
                  .join(" · ") || "Verificado"
              }
              tone={
                profile.sunatStatus?.toUpperCase() === "ACTIVO" &&
                profile.sunatCondition?.toUpperCase() === "HABIDO"
                  ? "success"
                  : "warning"
              }
            />
            <Info
              label="Domicilio fiscal"
              value={profile.fiscalAddress || "Sin dirección"}
            />
            <Info
              label="Intifact"
              value={
                profile.intifactCompanyId
                  ? "RUC vinculado como empresa emisora"
                  : "Falta registrar/vincular este RUC en Intifact"
              }
              tone={profile.intifactCompanyId ? "success" : "danger"}
            />
          </div>
        ) : (
          <div className="mt-4 flex items-start gap-3 rounded-[15px] bg-amber-50 p-3.5 text-xs text-amber-900">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            Verifica el RUC antes de emitir con una key de producción.
          </div>
        )}
      </section>

      {profile.verified ? (
        <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionHeader
              icon={MapPin}
              title="Establecimientos SUNAT"
              description="Importa matriz y anexos para que cada local use su código de establecimiento real."
            />
            {isOwner ? (
              <button
                type="button"
                onClick={() => void refreshEstablishments()}
                className="inline-flex h-10 items-center gap-2 rounded-[12px] border border-[#e8e3d7] bg-white px-3 text-xs font-extrabold text-[#14201b]"
              >
                <RefreshCw className="size-3.5" />
                Consultar
              </button>
            ) : null}
          </div>

          {establishments.length ? (
            <div className="mt-4 space-y-2">
              {establishments.map((item) => {
                const checked = selectedCodes.includes(item.code);

                return (
                  <label
                    key={item.code}
                    className="flex items-start gap-3 rounded-[16px] border border-[#e8e3d7] bg-[#fbfaf6] p-3.5"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!isOwner || item.localImported}
                      onChange={(event) =>
                        setSelectedCodes((current) =>
                          event.target.checked
                            ? [...new Set([...current, item.code])]
                            : current.filter((code) => code !== item.code),
                        )
                      }
                      className="mt-1 size-4 accent-orange-500"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="erp-mono text-sm font-extrabold text-[#14201b]">
                          {item.code}
                        </span>
                        <span className="text-xs font-bold text-[#59665f]">
                          {item.type}
                        </span>
                        {item.localImported ? (
                          <Badge tone="success">Importado</Badge>
                        ) : null}
                        {item.intifactRegistered ? (
                          <Badge tone="success">Intifact OK</Badge>
                        ) : (
                          <Badge tone="danger">Falta en Intifact</Badge>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-[#7b8680]">
                        {item.address}
                      </p>
                    </div>
                  </label>
                );
              })}

              {isOwner && !allImported ? (
                <button
                  type="button"
                  disabled={!selectedCount}
                  onClick={() => void importEstablishments()}
                  className="mt-2 h-11 w-full rounded-[14px] bg-[#14201b] text-sm font-extrabold text-white disabled:opacity-40"
                >
                  Importar {selectedCount || ""} a Locales
                </button>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-xs text-[#7b8680]">
              Pulsa “Consultar” para leer domicilio fiscal y anexos.
            </p>
          )}
        </section>
      ) : null}

      <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
        <SectionHeader
          icon={Building2}
          title="Identidad del comprobante"
          description="El nombre comercial, logo y pie son configurables. El nombre legal permanece ligado al RUC verificado."
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-[#35423c]">
              Nombre comercial
            </span>
            <input
              value={tradeNameValue}
              onChange={(event) => setTradeNameValue(event.target.value)}
              disabled={!isOwner}
              className="mt-1.5 h-12 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] px-3.5 text-sm outline-none focus:border-orange-500 disabled:bg-[#f6f3ec]"
              placeholder="Ara Burger"
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-[#35423c]">Logo</span>
            <div className="mt-1.5 flex min-h-14 items-center gap-3 rounded-[14px] border border-[#e8e3d7] bg-[#fbfaf6] p-2">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo del comprobante"
                  width={52}
                  height={52}
                  unoptimized
                  className="size-13 rounded-[10px] object-contain"
                />
              ) : (
                <div className="flex size-13 items-center justify-center rounded-[10px] bg-[#e9e4d6] text-[#7b8680]">
                  <ImagePlus className="size-5" />
                </div>
              )}

              {isOwner ? (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) =>
                    void uploadLogo(event.target.files?.[0] ?? null)
                  }
                  className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-[10px] file:border-0 file:bg-[#14201b] file:px-3 file:py-2 file:font-bold file:text-white"
                />
              ) : null}
            </div>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-sm font-bold text-[#35423c]">
            Pie del comprobante
          </span>
          <textarea
            value={footerText}
            onChange={(event) => setFooterText(event.target.value.slice(0, 240))}
            disabled={!isOwner}
            className="mt-1.5 min-h-20 w-full rounded-[14px] border-[1.5px] border-[#e8e3d7] p-3 text-sm outline-none focus:border-orange-500 disabled:bg-[#f6f3ec]"
            placeholder="Gracias por su compra"
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Toggle
            label="Mostrar código del producto"
            checked={showProductCode}
            onChange={setShowProductCode}
            disabled={!isOwner}
          />
          <Toggle
            label="Mostrar método de pago"
            checked={showPaymentMethod}
            onChange={setShowPaymentMethod}
            disabled={!isOwner}
          />
        </div>
      </section>

      <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
        <SectionHeader
          icon={Printer}
          title="Impresión"
          description="Para tu genérica compacta usamos 48 mm útiles. Si resulta ser rollo 58 mm con 48 mm imprimibles, solo cambia el perfil."
        />

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-bold text-[#35423c]">
              Ancho predeterminado
            </span>
            <select
              value={paperWidth}
              onChange={(event) =>
                setPaperWidth(
                  event.target.value as ReceiptSettings["paper_width"],
                )
              }
              disabled={!isOwner}
              className="mt-1.5 h-12 w-full rounded-[14px] border border-[#e8e3d7] bg-white px-3 text-sm"
            >
              <option value="48">48 mm útil · genérica compacta</option>
              <option value="58">58 mm</option>
              <option value="80">80 mm</option>
              <option value="a4">A4</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-bold text-[#35423c]">Método</span>
            <select
              value={printerMode}
              onChange={(event) =>
                setPrinterMode(
                  event.target.value as ReceiptSettings["printer_mode"],
                )
              }
              disabled={!isOwner}
              className="mt-1.5 h-12 w-full rounded-[14px] border border-[#e8e3d7] bg-white px-3 text-sm"
            >
              <option value="system">Impresora del sistema</option>
              <option value="bluetooth-ble">Bluetooth BLE directo</option>
              <option value="android-bridge">
                Android bridge · Bluetooth Classic
              </option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Capability
            icon={Cloud}
            label="Sistema"
            value="Disponible"
            ok
          />
          <Capability
            icon={Bluetooth}
            label="Web Bluetooth"
            value={printerStatus.bleSupported ? "Compatible" : "No disponible"}
            ok={printerStatus.bleSupported}
          />
          <Capability
            icon={Smartphone}
            label="Android bridge"
            value={printerStatus.androidBridge ? "Detectado" : "No detectado"}
            ok={printerStatus.androidBridge}
          />
        </div>

        {printerStatus.bleDeviceName ? (
          <div className="mt-3 rounded-[14px] bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
            BLE vinculada en este dispositivo: {printerStatus.bleDeviceName}
          </div>
        ) : null}

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {isOwner ? (
            <button
              type="button"
              onClick={() => void linkPrinter()}
              disabled={!printerStatus.bleSupported}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border border-[#e8e3d7] bg-white text-sm font-extrabold text-[#14201b] disabled:opacity-40"
            >
              <Bluetooth className="size-4" />
              Vincular impresora BLE
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => void testPrinter()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] bg-[#14201b] text-sm font-extrabold text-white"
          >
            <Printer className="size-4" />
            Imprimir prueba
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <Toggle
            label="Imprimir automáticamente cuando SUNAT acepte"
            checked={autoPrint}
            onChange={setAutoPrint}
            disabled={!isOwner}
          />
          <p className="text-[10px] leading-relaxed text-[#7b8680]">
            Web Bluetooth solo sirve si la impresora expone BLE/GATT. Si la
            genérica usa Bluetooth Classic/SPP, selecciona Android bridge o
            impresión del sistema.
          </p>
        </div>
      </section>

      {isOwner ? (
        <button
          type="button"
          onClick={() => void saveSettings()}
          disabled={saving || tradeNameValue.trim().length < 2}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] disabled:opacity-50 sm:w-auto"
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          Guardar configuración
        </button>
      ) : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[#fff0e2] text-orange-600">
        <Icon className="size-5" />
      </div>
      <div>
        <h2 className="font-extrabold text-[#14201b]">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-[#7b8680]">
          {description}
        </p>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
}) {
  const toneClass =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50"
        : tone === "danger"
          ? "border-red-200 bg-red-50"
          : "border-[#e8e3d7] bg-[#fbfaf6]";

  return (
    <div className={"rounded-[15px] border p-3.5 " + toneClass}>
      <p className="text-[9px] font-extrabold uppercase tracking-[0.09em] text-[#7b8680]">
        {label}
      </p>
      <p className="mt-1.5 text-sm font-bold leading-relaxed text-[#14201b]">
        {value}
      </p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "success" | "danger";
}) {
  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[9px] font-extrabold " +
        (tone === "success"
          ? "bg-emerald-100 text-emerald-700"
          : "bg-red-100 text-red-700")
      }
    >
      {children}
    </span>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex min-h-12 items-center justify-between gap-3 rounded-[14px] border border-[#e8e3d7] bg-[#fbfaf6] px-3.5 py-2.5 text-sm font-bold text-[#35423c]">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        disabled={disabled}
        className="size-4 accent-orange-500"
      />
    </label>
  );
}

function Capability({
  icon: Icon,
  label,
  value,
  ok,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-[#e8e3d7] bg-[#fbfaf6] p-3">
      <Icon className={"size-4 " + (ok ? "text-emerald-600" : "text-[#9b9f99]")} />
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
        {label}
      </p>
      <p className="mt-1 text-xs font-bold text-[#14201b]">{value}</p>
    </div>
  );
}
