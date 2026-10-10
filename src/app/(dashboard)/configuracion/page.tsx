import {
  Building2,
  CircleCheck,
  KeyRound,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { redirect } from "next/navigation";

import { initializeOrganizationAction, updateOrganizationAction } from "./actions";
import { parseTab } from "./tab-ids";
import { TabInput, TabPanel, TabsNav, TabsProvider } from "./tabs";
import { createClient } from "@/lib/supabase/server";
import { AlertTester } from "./alert-tester";
import { BranchesManager } from "@/features/settings/components/branches-manager";
import { SequencesManager } from "@/features/settings/components/sequences-manager";
import { MembersManager } from "@/features/settings/components/members-manager";
import type { Branch, DocumentSequence, OrganizationMember } from "@/features/settings/types";

type SettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string; tab?: string }>;
};

const inputClass =
  "mt-1.5 h-12 w-full rounded-[13px] border-[1.5px] border-[#e8e3d7] bg-white px-3.5 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 disabled:bg-[#f6f3ec] disabled:text-[#7b8680]";
const buttonClass =
  "inline-flex h-12 items-center justify-center rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50";
const panelClass = "rounded-[20px] border border-[#e8e3d7] bg-white p-4 sm:p-6";

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
  const activeTab = parseTab(params.tab);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/configuracion");

  const { data: membershipRows, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, branch_id, active, organizations(id, legal_name, trade_name, ruc, timezone, currency, active)")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1);

  if (membershipError) throw membershipError;

  const membership = membershipRows?.[0];

  if (!membership) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <Header />
        <Message success={params.success} error={params.error} />
        <section className={panelClass}>
          <div className="flex items-start gap-3">
            <div className="rounded-[14px] bg-[#fff0e2] p-2 text-orange-600"><Building2 className="size-5" /></div>
            <div>
              <h2 className="font-bold">Configurar el negocio</h2>
              <p className="mt-1 text-sm text-[#7b8680]">
                Este asistente crea la empresa, el local principal, tu acceso como propietario y la serie B001 para boletas.
              </p>
            </div>
          </div>

          <form action={initializeOrganizationAction} className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Razón social" name="legalName" required />
            <Field label="Nombre comercial" name="tradeName" />
            <Field label="RUC" name="ruc" required inputMode="numeric" maxLength={11} />
            <Field label="Nombre del local" name="branchName" required defaultValue="Local principal" />
            <Field label="Dirección" name="branchAddress" className="sm:col-span-2" />
            <Field label="Ubigeo" name="branchUbigeo" maxLength={6} inputMode="numeric" />
            <div className="flex items-end">
              <button className={buttonClass} type="submit">Crear configuración inicial</button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  const organizationValue = membership.organizations;
  const organization = Array.isArray(organizationValue) ? organizationValue[0] : organizationValue;
  if (!organization) throw new Error("No se encontró la organización asociada al usuario.");

  const organizationId = membership.organization_id;
  const isOwner = membership.role === "owner";

  const { data: branchRows, error: branchesError } = await supabase
    .from("branches")
    .select("id, code, name, address, ubigeo, active")
    .eq("organization_id", organizationId)
    .order("name");

  if (branchesError) throw branchesError;
  const branches = (branchRows ?? []) as Branch[];

  let sequences: DocumentSequence[] = [];
  let members: OrganizationMember[] = [];

  if (isOwner) {
    const [{ data: sequenceRows, error: sequencesError }, { data: memberRows, error: membersError }] =
      await Promise.all([
        supabase
          .from("document_sequences")
          .select("id, branch_id, document_type, series, current_value, active")
          .eq("organization_id", organizationId)
          .order("document_type")
          .order("series"),
        supabase.rpc("list_organization_members", { p_organization_id: organizationId }),
      ]);

    if (sequencesError) throw sequencesError;
    if (membersError) throw membersError;

    sequences = (sequenceRows ?? []) as DocumentSequence[];
    members = (memberRows ?? []) as OrganizationMember[];
  }

  const intifactConfigured = Boolean(process.env.INTIFACT_API_KEY && process.env.INTIFACT_API_URL);

  return (
    <div className="space-y-6">
      <Header />
      <Message success={params.success} error={params.error} />

      {!isOwner ? (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Tu rol es cajero. Puedes consultar la configuración disponible, pero solo un propietario puede modificarla.
        </div>
      ) : null}

      <TabsProvider defaultTab={activeTab}>
        <TabsNav />

        <TabPanel id="empresa">
          <section className={panelClass}>
            <SectionTitle icon={Building2} title="Empresa" description="Datos fiscales y zona horaria del negocio." />
            <form action={updateOrganizationAction} className="mt-6 grid gap-4 sm:grid-cols-2">
              <TabInput />
              <Field label="Razón social" name="legalName" defaultValue={organization.legal_name ?? ""} disabled={!isOwner} required />
              <Field label="Nombre comercial" name="tradeName" defaultValue={organization.trade_name ?? ""} disabled={!isOwner} />
              <Field label="RUC" name="ruc" defaultValue={organization.ruc ?? ""} disabled={!isOwner} required maxLength={11} inputMode="numeric" />
              <label className="text-sm font-medium text-[#35423c]">
                Zona horaria
                <select className={inputClass} name="timezone" defaultValue={organization.timezone ?? "America/Lima"} disabled={!isOwner}>
                  <option value="America/Lima">America/Lima — Perú</option>
                </select>
              </label>
              {isOwner ? <div className="sm:col-span-2"><button className={buttonClass}>Guardar empresa</button></div> : null}
            </form>
          </section>
        </TabPanel>

        <TabPanel id="locales">
          <section className={panelClass}>
            <SectionTitle icon={Building2} title="Locales" description="Sucursales o puntos de emisión. Los locales históricos se desactivan; no se eliminan." />
            <BranchesManager organizationId={organizationId} isOwner={isOwner} initialBranches={branches} />
          </section>
        </TabPanel>

        <TabPanel id="series">
          <section className={panelClass}>
            <SectionTitle icon={Building2} title="Series de comprobantes" description="El correlativo es administrado por PostgreSQL y nunca se edita manualmente." />
            <SequencesManager
              organizationId={organizationId}
              isOwner={isOwner}
              initialBranches={branches}
              initialSequences={sequences}
            />
          </section>
        </TabPanel>

        <TabPanel id="usuarios">
          <section className={panelClass}>
            <SectionTitle icon={Building2} title="Usuarios y permisos" description="Owner administra el negocio; cashier opera ventas en el local asignado." />
            <MembersManager
              organizationId={organizationId}
              isOwner={isOwner}
              initialBranches={branches}
              initialMembers={members}
            />
          </section>
        </TabPanel>

        <TabPanel id="integraciones">
          <section className={panelClass}>
            <SectionTitle icon={KeyRound} title="Integraciones" description="Las credenciales sensibles permanecen en variables del servidor y nunca se guardan en tablas públicas." />
            <div className="mt-6 flex items-center justify-between rounded-[14px] border p-4">
              <div>
                <div className="font-medium">Intifact</div>
                <div className="mt-1 text-sm text-[#7b8680]">API de facturación electrónica</div>
              </div>
              <div className={`rounded-full px-3 py-1 text-xs font-medium ${intifactConfigured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {intifactConfigured ? "Configurado" : "Pendiente"}
              </div>
            </div>
            <div className="mt-4"><AlertTester /></div>
          </section>
        </TabPanel>
      </TabsProvider>
    </div>
  );
}

function Header() {
  return (
    <div>
      <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-600"><Settings className="size-4" /> Administración</div>
      <h1 className="mt-1 text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[27px]">Configuración</h1>
      <p className="mt-2 text-sm text-[#7b8680]">Datos maestros del negocio, locales, series y accesos.</p>
    </div>
  );
}

function Message({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return (
    <div className={`flex items-start gap-2 rounded-[14px] border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
      {error ? <ShieldCheck className="mt-0.5 size-4" /> : <CircleCheck className="mt-0.5 size-4" />}
      <span>{error ?? success}</span>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="rounded-[14px] bg-[#e9e4d6] p-2"><Icon className="size-5" /></div>
      <div><h2 className="font-bold">{title}</h2><p className="mt-1 text-sm text-[#7b8680]">{description}</p></div>
    </div>
  );
}

function Field({ label, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={`text-sm font-medium text-[#35423c] ${className}`}>{label}<input className={inputClass} {...props} /></label>;
}
