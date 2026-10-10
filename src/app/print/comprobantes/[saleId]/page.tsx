/* eslint-disable @next/next/no-img-element */

import { notFound, redirect } from "next/navigation";
import type { CSSProperties } from "react";

import { getReceiptData } from "@/features/receipts/server/receipt-data";
import type { ReceiptPaperWidth } from "@/features/settings/types";
import { getSalesContext } from "@/features/sales/server/context";

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

function money(value: number) {
  return value.toFixed(2);
}

function quantity(value: number) {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
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
  const contentWidth =
    paper === "80"
      ? "76mm"
      : paper === "58"
        ? "54mm"
        : paper === "48"
          ? "48mm"
          : "80mm";

  const pageSize = paper === "a4" ? "A4" : contentWidth + " auto";
  const pageMargin = paper === "a4" ? "12mm" : "1.5mm";
  const compact = paper === "48";
  const subtotalAmount = Math.max(0, receipt.totalAmount - receipt.igvAmount);

  const css =
    "@page{size:" +
    pageSize +
    ";margin:" +
    pageMargin +
    "}" +
    "html,body{background:#fff!important;color:#000!important}body{margin:0}" +
    ".ticket{width:var(--receipt-width);margin:0 auto;padding:1.8mm;box-sizing:border-box;font-family:'Courier New',ui-monospace,monospace;font-size:" +
    (compact ? "7.2px" : paper === "58" ? "8px" : "9px") +
    ";line-height:1.18;color:#000}" +
    ".center{text-align:center}.bold{font-weight:800}.brand{font-family:Arial,sans-serif;font-size:" +
    (compact ? "13px" : "16px") +
    ";font-weight:900;line-height:1.02;text-transform:uppercase}" +
    ".legal{margin-top:1px;font-weight:700}.tiny{font-size:.88em}.doc-title{margin-top:4px;font-weight:900;font-size:1.08em}.doc-number{font-weight:900;font-size:1.08em}" +
    ".rule{border-top:1px dashed #000;margin:4px 0}.meta{display:grid;grid-template-columns:1fr 1fr;gap:1px 5px}.meta-line{display:flex;gap:3px;min-width:0}.meta-label{font-weight:800}.client{margin-top:3px}.client-name{font-weight:700;overflow-wrap:anywhere}" +
    ".items{width:100%;border-collapse:collapse;table-layout:fixed}.items th{padding:2px 1px;border-top:1px solid #000;border-bottom:1px solid #000;font-size:.9em;text-align:right}.items th:nth-child(1){width:10%;text-align:center}.items th:nth-child(2){width:48%;text-align:left}.items th:nth-child(3){width:19%}.items th:nth-child(4){width:23%}.items td{padding:1.5px 1px;vertical-align:top}.items td:nth-child(1){text-align:center}.items td:nth-child(3),.items td:nth-child(4){text-align:right;white-space:nowrap}.desc{overflow-wrap:anywhere}.code{display:block;font-size:.78em}.totals{margin-left:auto;width:" +
    (compact ? "82%" : "72%") +
    ";margin-top:4px}.total-row{display:grid;grid-template-columns:1fr auto;gap:6px;padding:1px 0}.grand{font-size:1.16em;font-weight:900;border-top:1px solid #000;margin-top:2px;padding-top:3px}.payment{margin-top:6px}.payment-line{display:flex;justify-content:space-between;gap:6px}.thanks{margin-top:7px;text-align:center;font-weight:900;font-size:1.06em}.footer{text-align:center;margin-top:2px}.verify{margin-top:5px;text-align:center;font-size:.72em;overflow-wrap:anywhere}.test{border:1px solid #000;padding:3px;margin:4px 0;font-weight:900;text-align:center}" +
    "img.logo{display:block;max-width:" +
    (compact ? "82%" : "72%") +
    ";max-height:" +
    (compact ? "19mm" : "24mm") +
    ";margin:0 auto 2px;object-fit:contain}" +
    "@media screen{body{background:#eee!important;padding:18px 0}.ticket{background:#fff;box-shadow:0 8px 28px rgba(0,0,0,.12)}}" +
    "@media print{.ticket{box-shadow:none}}";

  return (
    <main
      className="ticket"
      style={{ "--receipt-width": contentWidth } as CSSProperties}
    >
      <style>{css}</style>

      {receipt.logoUrl ? (
        <img className="logo" src={receipt.logoUrl} alt="" />
      ) : null}

      <header className="center">
        <div className="brand">{receipt.displayName}</div>

        {receipt.legalName !== receipt.displayName ? (
          <div className="legal">{receipt.legalName}</div>
        ) : null}

        <div className="tiny">RUC: {receipt.ruc}</div>
        <div className="tiny">{receipt.branchName}</div>
        {receipt.branchAddress ? (
          <div className="tiny">{receipt.branchAddress}</div>
        ) : null}

        <div className="doc-title">{receipt.documentTypeLabel}</div>
        <div className="doc-number">{receipt.documentNumber}</div>
      </header>

      {receipt.isTest ? (
        <div className="test">
          DOCUMENTO DE PRUEBA · SIN VALIDEZ FISCAL
        </div>
      ) : null}

      <section className="meta">
        <div className="meta-line">
          <span className="meta-label">FECHA:</span>
          <span>{receipt.issueDateLabel}</span>
        </div>
        <div className="meta-line">
          <span className="meta-label">HORA:</span>
          <span>{receipt.issueTimeLabel}</span>
        </div>
        <div className="meta-line">
          <span className="meta-label">LOCAL:</span>
          <span>{receipt.branchName}</span>
        </div>
        {receipt.showPaymentMethod && receipt.paymentLabel ? (
          <div className="meta-line">
            <span className="meta-label">PAGO:</span>
            <span>{receipt.paymentLabel}</span>
          </div>
        ) : null}
      </section>

      <section className="client">
        <div className="meta-line">
          <span className="meta-label">CLIENTE:</span>
          <span className="client-name">{receipt.clientName}</span>
        </div>
        {receipt.clientDocument ? (
          <div className="meta-line">
            <span className="meta-label">
              {receipt.clientDocumentLabel || "DOC"}:
            </span>
            <span>{receipt.clientDocument}</span>
          </div>
        ) : null}
      </section>

      <table className="items">
        <thead>
          <tr>
            <th>CANT</th>
            <th>DESCRIPCIÓN</th>
            <th>P. UNIT</th>
            <th>IMPORTE</th>
          </tr>
        </thead>
        <tbody>
          {receipt.items.map((item, index) => (
            <tr key={item.code + "-" + index}>
              <td>{quantity(item.quantity)}</td>
              <td className="desc">
                {receipt.showProductCode ? (
                  <span className="code">{item.code}</span>
                ) : null}
                {item.description}
              </td>
              <td>{money(item.unitPrice)}</td>
              <td>{money(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <section className="totals">
        <div className="total-row">
          <span>SUBTOTAL</span>
          <span>S/ {money(subtotalAmount)}</span>
        </div>

        {receipt.exoneratedAmount > 0 ? (
          <div className="total-row">
            <span>EXONERADA</span>
            <span>S/ {money(receipt.exoneratedAmount)}</span>
          </div>
        ) : null}

        {receipt.unaffectedAmount > 0 ? (
          <div className="total-row">
            <span>INAFECTA</span>
            <span>S/ {money(receipt.unaffectedAmount)}</span>
          </div>
        ) : null}

        <div className="total-row">
          <span>IGV (18%)</span>
          <span>S/ {money(receipt.igvAmount)}</span>
        </div>

        <div className="total-row grand">
          <span>TOTAL</span>
          <span>S/ {money(receipt.totalAmount)}</span>
        </div>
      </section>

      <section className="payment">
        {receipt.showPaymentMethod && receipt.paymentLabel ? (
          <div className="payment-line">
            <span>FORMA DE PAGO:</span>
            <b>{receipt.paymentLabel}</b>
          </div>
        ) : null}

        {receipt.receivedAmount !== null ? (
          <div className="payment-line">
            <span>MONTO RECIBIDO:</span>
            <span>S/ {money(receipt.receivedAmount)}</span>
          </div>
        ) : receipt.paymentAmount !== null ? (
          <div className="payment-line">
            <span>MONTO PAGADO:</span>
            <span>S/ {money(receipt.paymentAmount)}</span>
          </div>
        ) : null}

        {receipt.changeAmount > 0 ? (
          <div className="payment-line">
            <span>VUELTO:</span>
            <span>S/ {money(receipt.changeAmount)}</span>
          </div>
        ) : null}
      </section>

      <div className="thanks">¡GRACIAS POR SU VISITA!</div>

      {receipt.footerText ? (
        <div className="footer">{receipt.footerText}</div>
      ) : null}

      <div className="verify">
        Representación impresa del comprobante electrónico.
        <br />
        Consulta: {receipt.verificationUrl}
      </div>
    </main>
  );
}
