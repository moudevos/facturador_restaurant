import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileCode2,
  FileDown,
  FileText,
  ReceiptText,
  UserRound,
} from "lucide-react";

import { DocumentDetailActions } from "@/features/documents/components/document-detail-actions";
import { getDocumentDetail } from "@/features/documents/server/documents";
import {
  DOCUMENT_STATUS_LABELS,
  documentNumber,
  documentStatusClass,
  documentTypeLabel,
} from "@/features/documents/utils/document-format";
import { getSalesContext } from "@/features/sales/server/context";
import { formatMoney, PAYMENT_LABELS } from "@/features/sales/utils/format";
import {
  formatBusinessDateOnly,
  formatBusinessDateTime,
} from "@/lib/date-time";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ saleId: string }>;
}) {
  const context = await getSalesContext();
  if (!context) redirect("/login");

  const { saleId } = await params;
  const document = await getDocumentDetail(context, saleId);
  if (!document) notFound();

  const number = documentNumber(document.series, document.correlative);
  const accepted = document.status === "accepted";
  const terminalWithArtifacts =
    document.status === "accepted" || document.status === "rejected";

  return (
    <section className="space-y-4 sm:space-y-6">
      <header>
        <Link
          href="/comprobantes"
          className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#7b8680] hover:text-[#14201b]"
        >
          <ArrowLeft className="size-3.5" />
          Volver a comprobantes
        </Link>

        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="erp-mono text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[28px]">
                {number}
              </h1>
              <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-extrabold uppercase text-blue-700">
                {documentTypeLabel(document.document_type)}
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${documentStatusClass(document.status)}`}
              >
                {DOCUMENT_STATUS_LABELS[document.status]}
              </span>
            </div>
            <p className="mt-1.5 text-xs text-[#7b8680]">
              {document.branch_name}
            </p>
          </div>

          <DocumentDetailActions
            saleId={document.id}
            status={document.status}
            isOwner={context.role === "owner"}
          />
        </div>
      </header>

      {document.status === "rejected" ? (
        <div className="rounded-[18px] border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-extrabold">Rechazado por SUNAT</p>
          <p className="mt-1 leading-relaxed">
            {document.intifact_sunat_description ||
              document.intifact_error_message ||
              "El comprobante fue rechazado. No uses retry automático: debe corregirse la causa y reemitirse con un nuevo correlativo."}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2.5 xl:grid-cols-4">
        <Metric label="Total" value={formatMoney(document.total_amount)} />
        <Metric label="IGV" value={formatMoney(document.igv_amount)} />
        <Metric
          label="Fecha fiscal"
          value={formatBusinessDateOnly(document.fiscal_issue_date)}
          mono={false}
        />
        <Metric
          label="Estado Intifact"
          value={document.intifact_status || "Sin estado"}
          mono={false}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-[20px] border border-[#e8e3d7] bg-white">
          <div className="flex items-center gap-2 border-b border-[#eee9df] px-4 py-4 sm:px-5">
            <ReceiptText className="size-4 text-orange-600" />
            <h2 className="text-sm font-extrabold text-[#14201b]">
              Detalle ({document.items.length} items)
            </h2>
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead className="bg-[#f6f3ec] text-left text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
                <tr>
                  <th className="px-4 py-3">Código</th>
                  <th className="px-4 py-3">Descripción</th>
                  <th className="px-4 py-3 text-right">P. unit.</th>
                  <th className="px-4 py-3 text-right">Cant.</th>
                  <th className="px-4 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eee9df]">
                {document.items.map((item) => (
                  <tr key={item.id}>
                    <td className="erp-mono px-4 py-3 text-xs font-bold text-[#59665f]">
                      {item.product_code}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-[#14201b]">{item.description}</p>
                      <p className="mt-0.5 text-[10px] text-[#7b8680]">
                        Afectación {item.tax_affectation_code}
                        {item.sunat_product_code
                          ? ` · UNSPSC ${item.sunat_product_code}`
                          : ""}
                      </p>
                    </td>
                    <td className="erp-mono px-4 py-3 text-right">
                      {formatMoney(item.unit_price)}
                    </td>
                    <td className="erp-mono px-4 py-3 text-right">
                      {Number(item.quantity).toFixed(2)} {item.unit_code}
                    </td>
                    <td className="erp-mono px-4 py-3 text-right font-bold">
                      {formatMoney(item.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-[#eee9df] px-4 md:hidden">
            {document.items.map((item) => (
              <div key={item.id} className="py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold text-[#14201b]">{item.description}</p>
                    <p className="erp-mono mt-1 text-[10px] font-bold text-[#7b8680]">
                      {item.product_code}
                    </p>
                  </div>
                  <p className="erp-mono shrink-0 font-bold text-[#14201b]">
                    {formatMoney(item.line_total)}
                  </p>
                </div>
                <p className="mt-2 text-xs text-[#7b8680]">
                  {Number(item.quantity).toFixed(2)} {item.unit_code} ×{" "}
                  {formatMoney(item.unit_price)} · Afectación {item.tax_affectation_code}
                </p>
              </div>
            ))}
          </div>
        </section>

        <div className="space-y-4">
          <InfoCard icon={UserRound} title="Cliente">
            <p className="font-extrabold text-[#14201b]">
              {document.customer_name || "Cliente varios"}
            </p>
            <p className="erp-mono mt-1 text-xs text-[#7b8680]">
              {document.customer_document_number || "Sin documento"}
            </p>
          </InfoCard>

          <InfoCard icon={CalendarDays} title="Trazabilidad fiscal">
            <InfoLine
              label="Fecha fiscal"
              value={formatBusinessDateOnly(document.fiscal_issue_date)}
            />
            <InfoLine
              label="Primer envío"
              value={
                document.issued_at
                  ? formatBusinessDateTime(document.issued_at, context.timeZone)
                  : "—"
              }
            />
            <InfoLine
              label="Aceptación"
              value={
                document.accepted_at
                  ? formatBusinessDateTime(document.accepted_at, context.timeZone)
                  : "—"
              }
            />
            <InfoLine
              label="Última consulta"
              value={
                document.intifact_last_checked_at
                  ? formatBusinessDateTime(
                      document.intifact_last_checked_at,
                      context.timeZone,
                    )
                  : "—"
              }
            />
            <InfoLine
              label="Intentos"
              value={String(document.intifact_attempt_count)}
            />
          </InfoCard>

          {document.payments.length ? (
            <InfoCard icon={FileText} title="Pago">
              {document.payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between gap-3 py-1.5"
                >
                  <span className="text-sm font-semibold text-[#59665f]">
                    {PAYMENT_LABELS[payment.payment_method]}
                  </span>
                  <span className="erp-mono text-sm font-bold text-[#14201b]">
                    {formatMoney(payment.amount)}
                  </span>
                </div>
              ))}
            </InfoCard>
          ) : null}
        </div>
      </div>

      <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-5">
        <h2 className="text-sm font-extrabold text-[#14201b]">
          Intifact / SUNAT
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <InfoLine
            label="ID Intifact"
            value={document.intifact_document_id || "—"}
          />
          <InfoLine
            label="Código SUNAT"
            value={document.intifact_sunat_code || "—"}
          />
        </div>

        {document.intifact_sunat_description ||
        document.intifact_error_message ? (
          <div className="mt-3 rounded-[14px] bg-[#f6f3ec] p-3 text-xs leading-relaxed text-[#59665f]">
            {document.intifact_sunat_description ||
              document.intifact_error_message}
          </div>
        ) : null}

        {accepted || terminalWithArtifacts ? (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#eee9df] pt-4">
            {accepted ? (
              <>
                <ArtifactLink
                  href={`/api/intifact/sales/${document.id}/pdf?format=a4`}
                  label="PDF A4"
                  icon={FileDown}
                />
                <ArtifactLink
                  href={`/api/intifact/sales/${document.id}/pdf?format=ticket80`}
                  label="Ticket 80 mm"
                  icon={Download}
                />
                <ArtifactLink
                  href={`/api/intifact/sales/${document.id}/pdf?format=ticket58`}
                  label="Ticket 58 mm"
                  icon={Download}
                />
              </>
            ) : null}
            {terminalWithArtifacts ? (
              <>
                <ArtifactLink
                  href={`/api/intifact/sales/${document.id}/xml`}
                  label="XML"
                  icon={FileCode2}
                />
                <ArtifactLink
                  href={`/api/intifact/sales/${document.id}/cdr`}
                  label="CDR"
                  icon={FileDown}
                />
              </>
            ) : null}
          </div>
        ) : null}
      </section>
    </section>
  );
}

function Metric({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <article className="rounded-[18px] border border-[#e8e3d7] bg-white p-3.5">
      <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#7b8680]">
        {label}
      </p>
      <p
        className={`mt-1.5 truncate text-lg font-extrabold text-[#14201b] ${
          mono ? "erp-mono" : ""
        }`}
      >
        {value}
      </p>
    </article>
  );
}

function InfoCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[#e8e3d7] bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex size-9 items-center justify-center rounded-[12px] bg-[#fff0e2] text-orange-600">
          <Icon className="size-4" />
        </div>
        <h2 className="text-sm font-extrabold text-[#14201b]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-[#7b8680]">{label}</span>
      <span className="max-w-[65%] break-all text-right font-bold text-[#35423c]">
        {value}
      </span>
    </div>
  );
}

function ArtifactLink({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-10 items-center gap-2 rounded-[13px] border border-[#e8e3d7] bg-white px-3 text-xs font-extrabold text-[#14201b] hover:bg-[#fbfaf6]"
    >
      <Icon className="size-3.5" />
      {label}
    </a>
  );
}
