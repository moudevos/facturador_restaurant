/* eslint-disable @next/next/no-img-element */

import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { getReceiptData } from "@/features/receipts/server/receipt-data";
import type { ReceiptPaperWidth } from "@/features/settings/types";
import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney } from "@/features/sales/utils/format";

function normalizePaper(
  value: string | undefined,
  fallback: ReceiptPaperWidth,
): ReceiptPaperWidth {
  return value === "48" ||
    value === "58" ||
    value === "80" ||
    value === "a4"
    ? value
    : fallback;
}

export default async function ReceiptPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<{ paper?: string }>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/login");

  const { saleId } = await params;
  const query = await searchParams;
  const receipt = await getReceiptData(context, saleId);

  if (!receipt) notFound();

  const paper = normalizePaper(query.paper, receipt.paperWidth);
  const paperCss =
    paper === "a4"
      ? "190mm"
      : paper === "80"
        ? "72mm"
        : paper === "58"
          ? "54mm"
          : "48mm";

  const css =
    "@page{size:" +
    (paper === "a4" ? "A4" : paperCss + " auto") +
    ";margin:" +
    (paper === "a4" ? "12mm" : "2mm") +
    "}" +
    "html,body{background:white!important;color:black!important}body{margin:0}" +
    ".receipt-sheet{width:var(--receipt-width);margin:0 auto;padding:2mm;box-sizing:border-box;font-family:Arial,sans-serif;font-size:" +
    (paper === "a4" ? "12px" : "10px") +
    ";line-height:1.28;color:#000}" +
    ".center{text-align:center}.bold{font-weight:800}.mono{font-variant-numeric:tabular-nums}" +
    ".rule{border-top:1px dashed #000;margin:6px 0}.row{display:flex;justify-content:space-between;gap:8px}" +
    ".items{width:100%;border-collapse:collapse}.items td{padding:2px 0;vertical-align:top}" +
    ".test{border:2px solid #000;padding:4px;margin:6px 0;font-weight:800;text-align:center}" +
    "img.logo{display:block;max-width:70%;max-height:22mm;margin:0 auto 4px;object-fit:contain}" +
    ".verify{overflow-wrap:anywhere;font-size:8px;margin-top:4px}" +
    "@media screen{body{background:#ececec!important;padding:20px 0}.receipt-sheet{background:white;box-shadow:0 8px 28px rgba(0,0,0,.12)}}" +
    "@media print{.receipt-sheet{box-shadow:none}}";

  return (
    <main
      className="receipt-sheet"
      style={{ "--receipt-width": paperCss } as CSSProperties}
    >
      <style>{css}</style>

      {receipt.logoUrl ? (
        <img className="logo" src={receipt.logoUrl} alt="" />
      ) : null}

      <div className="center">
        <div
          className="bold"
          style={{ fontSize: paper === "a4" ? 18 : 13 }}
        >
          {receipt.displayName}
        </div>

        {receipt.legalName !== receipt.displayName ? (
          <div>{receipt.legalName}</div>
        ) : null}

        <div className="bold">RUC {receipt.ruc}</div>
        <div className="bold">{receipt.documentTypeLabel}</div>
        <div className="bold mono">{receipt.documentNumber}</div>
      </div>

      {receipt.isTest ? (
        <div className="test">
          DOCUMENTO DE PRUEBA · SIN VALIDEZ FISCAL
        </div>
      ) : null}

      <div className="rule" />

      <div className="bold">CLIENTE</div>
      <div>{receipt.clientName}</div>
      {receipt.clientDocument ? (
        <div>DOC: {receipt.clientDocument}</div>
      ) : null}
      <div>FECHA: {receipt.fiscalDate}</div>
      <div>LOCAL: {receipt.branchName}</div>
      {receipt.branchAddress ? <div>{receipt.branchAddress}</div> : null}
      {receipt.showPaymentMethod && receipt.paymentLabel ? (
        <div>PAGO: {receipt.paymentLabel}</div>
      ) : null}

      <div className="rule" />

      <table className="items">
        <tbody>
          {receipt.items.map((item, index) => (
            <tr key={item.code + "-" + index}>
              <td>
                {receipt.showProductCode ? (
                  <span className="mono">{item.code} </span>
                ) : null}
                {item.quantity} {item.unit} · {item.description}
              </td>
              <td
                className="mono"
                style={{ textAlign: "right", whiteSpace: "nowrap" }}
              >
                {formatMoney(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rule" />

      {receipt.taxableAmount > 0 ? (
        <div className="row">
          <span>GRAVADA</span>
          <b>{formatMoney(receipt.taxableAmount)}</b>
        </div>
      ) : null}

      {receipt.exoneratedAmount > 0 ? (
        <div className="row">
          <span>EXONERADA</span>
          <b>{formatMoney(receipt.exoneratedAmount)}</b>
        </div>
      ) : null}

      {receipt.unaffectedAmount > 0 ? (
        <div className="row">
          <span>INAFECTA</span>
          <b>{formatMoney(receipt.unaffectedAmount)}</b>
        </div>
      ) : null}

      <div className="row">
        <span>IGV</span>
        <b>{formatMoney(receipt.igvAmount)}</b>
      </div>

      <div
        className="row bold"
        style={{ fontSize: paper === "a4" ? 16 : 13 }}
      >
        <span>TOTAL</span>
        <span>{formatMoney(receipt.totalAmount)}</span>
      </div>

      <div className="rule" />

      <div className="center">
        <div>Representación impresa del comprobante electrónico</div>
        <div className="verify">{receipt.verificationUrl}</div>
        {receipt.footerText ? (
          <div className="bold" style={{ marginTop: 8 }}>
            {receipt.footerText}
          </div>
        ) : null}
      </div>
    </main>
  );
}
