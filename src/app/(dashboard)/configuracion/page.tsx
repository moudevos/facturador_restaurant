import {
  Building2,
  CircleCheck,
  KeyRound,
  MapPin,
  ReceiptText,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { redirect } from "next/navigation";

import {
  addMemberAction,
  createBranchAction,
  createSequenceAction,
  initializeOrganizationAction,
  toggleSequenceAction,
  updateBranchAction,
  updateMemberAction,
  updateOrganizationAction,
} from "./actions";
import { createClient } from "@/lib/supabase/server";

type SettingsPageProps = {
  searchParams: Promise<{ success?: string; error?: string }>;
};

const inputClass =
  "mt-1 h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-200 disabled:bg-neutral-100 disabled:text-neutral-500";
const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex h-9 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-medium text-neutral-800 hover:bg-neutral-50";

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const params = await searchParams;
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
        <section className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-neutral-100 p-2"><Building2 className="size-5" /></div>
            <div>
              <h2 className="font-semibold">Configurar el negocio</h2>
              <p className="mt-1 text-sm text-neutral-500">
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

  const [{ data: branches, error: branchesError }, { data: sequences, error: sequencesError }] = await Promise.all([
    supabase
      .from("branches")
      .select("id, code, name, address, ubigeo, active")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("document_sequences")
      .select("id, branch_id, document_type, series, current_value, active")
      .eq("organization_id", organizationId)
      .order("document_type")
      .order("series"),
  ]);

  if (branchesError) throw branchesError;
  if (sequencesError && isOwner) throw sequencesError;

  let members: Array<{
    member_id: string;
    user_id: string;
    email: string | null;
    role: string;
    branch_id: string | null;
    active: boolean;
    created_at: string;
  }> = [];

  if (isOwner) {
    const { data, error } = await supabase.rpc("list_organization_members", {
      p_organization_id: organizationId,
    });
    if (error) throw error;
    members = data ?? [];
  }

  const intifactConfigured = Boolean(process.env.INTIFACT_API_KEY && process.env.INTIFACT_API_URL);

  return (
    <div className="space-y-6">
      <Header />
      <Message success={params.success} error={params.error} />

      {!isOwner && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Tu rol es cajero. Puedes consultar la configuración, pero solo un propietario puede modificarla.
        </div>
      )}

      <nav className="flex flex-wrap gap-2 text-sm">
        <Anchor href="#empresa">Empresa</Anchor>
        <Anchor href="#locales">Locales</Anchor>
        <Anchor href="#series">Series</Anchor>
        <Anchor href="#usuarios">Usuarios</Anchor>
        <Anchor href="#integraciones">Integraciones</Anchor>
      </nav>

      <section id="empresa" className="scroll-mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <SectionTitle icon={Building2} title="Empresa" description="Datos fiscales y zona horaria del negocio." />
        <form action={updateOrganizationAction} className="mt-6 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="organizationId" value={organizationId} />
          <Field label="Razón social" name="legalName" defaultValue={organization.legal_name ?? ""} disabled={!isOwner} required />
          <Field label="Nombre comercial" name="tradeName" defaultValue={organization.trade_name ?? ""} disabled={!isOwner} />
          <Field label="RUC" name="ruc" defaultValue={organization.ruc ?? ""} disabled={!isOwner} required maxLength={11} inputMode="numeric" />
          <label className="text-sm font-medium text-neutral-700">
            Zona horaria
            <select className={inputClass} name="timezone" defaultValue={organization.timezone ?? "America/Lima"} disabled={!isOwner}>
              <option value="America/Lima">America/Lima — Perú</option>
            </select>
          </label>
          {isOwner && <div className="sm:col-span-2"><button className={buttonClass}>Guardar empresa</button></div>}
        </form>
      </section>

      <section id="locales" className="scroll-mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <SectionTitle icon={MapPin} title="Locales" description="Sucursales o puntos de emisión. Los locales históricos se desactivan; no se eliminan." />

        <div className="mt-6 space-y-3">
          {(branches ?? []).map((branch) => (
            <details key={branch.id} className="rounded-xl border p-4" open={(branches?.length ?? 0) === 1}>
              <summary className="cursor-pointer list-none font-medium">
                <div className="flex items-center justify-between gap-4">
                  <span>{branch.code} · {branch.name}</span>
                  <Status active={branch.active} />
                </div>
              </summary>
              <form action={updateBranchAction} className="mt-4 grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="organizationId" value={organizationId} />
                <input type="hidden" name="branchId" value={branch.id} />
                <Field label="Código" name="code" defaultValue={branch.code} disabled={!isOwner} required />
                <Field label="Nombre" name="name" defaultValue={branch.name} disabled={!isOwner} required />
                <Field label="Dirección" name="address" defaultValue={branch.address ?? ""} disabled={!isOwner} className="sm:col-span-2" />
                <Field label="Ubigeo" name="ubigeo" defaultValue={branch.ubigeo ?? ""} disabled={!isOwner} />
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={branch.active} disabled={!isOwner} />
                  Local activo
                </label>
                {isOwner && <div className="sm:col-span-2"><button className={secondaryButtonClass}>Guardar local</button></div>}
              </form>
            </details>
          ))}
        </div>

        {isOwner && (
          <form action={createBranchAction} className="mt-6 grid gap-4 rounded-xl bg-neutral-50 p-4 sm:grid-cols-2">
            <input type="hidden" name="organizationId" value={organizationId} />
            <div className="sm:col-span-2 text-sm font-semibold">Agregar local</div>
            <Field label="Código" name="code" required placeholder="002" />
            <Field label="Nombre" name="name" required placeholder="Sucursal centro" />
            <Field label="Dirección" name="address" className="sm:col-span-2" />
            <Field label="Ubigeo" name="ubigeo" maxLength={6} inputMode="numeric" />
            <div className="flex items-end"><button className={buttonClass}>Crear local</button></div>
          </form>
        )}
      </section>

      <section id="series" className="scroll-mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <SectionTitle icon={ReceiptText} title="Series de comprobantes" description="El correlativo es administrado por PostgreSQL y nunca se edita manualmente." />

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b text-xs uppercase text-neutral-500">
              <tr><th className="pb-3">Local</th><th className="pb-3">Tipo</th><th className="pb-3">Serie</th><th className="pb-3">Último correlativo</th><th className="pb-3">Estado</th><th className="pb-3"></th></tr>
            </thead>
            <tbody>
              {(sequences ?? []).map((sequence) => {
                const branch = branches?.find((item) => item.id === sequence.branch_id);
                return (
                  <tr className="border-b last:border-0" key={sequence.id}>
                    <td className="py-3">{branch?.name ?? "—"}</td>
                    <td className="py-3">{sequence.document_type === "03" ? "Boleta" : "Factura"}</td>
                    <td className="py-3 font-medium">{sequence.series}</td>
                    <td className="py-3 tabular-nums">{sequence.current_value}</td>
                    <td className="py-3"><Status active={sequence.active} /></td>
                    <td className="py-3 text-right">
                      {isOwner && (
                        <form action={toggleSequenceAction}>
                          <input type="hidden" name="organizationId" value={organizationId} />
                          <input type="hidden" name="sequenceId" value={sequence.id} />
                          <input type="hidden" name="active" value={sequence.active ? "false" : "true"} />
                          <button className={secondaryButtonClass}>{sequence.active ? "Desactivar" : "Activar"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isOwner && (
          <form action={createSequenceAction} className="mt-6 grid gap-4 rounded-xl bg-neutral-50 p-4 sm:grid-cols-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <label className="text-sm font-medium text-neutral-700">Local
              <select className={inputClass} name="branchId" required>
                {(branches ?? []).filter((branch) => branch.active).map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
              </select>
            </label>
            <label className="text-sm font-medium text-neutral-700">Documento
              <select className={inputClass} name="documentType" defaultValue="03"><option value="03">Boleta</option><option value="01">Factura</option></select>
            </label>
            <Field label="Serie" name="series" required placeholder="B002" maxLength={4} />
            <div className="flex items-end"><button className={buttonClass}>Crear serie</button></div>
          </form>
        )}
      </section>

      <section id="usuarios" className="scroll-mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <SectionTitle icon={Users} title="Usuarios y permisos" description="Owner administra el negocio; cashier opera ventas en el local asignado." />

        {isOwner ? (
          <>
            <div className="mt-6 space-y-3">
              {members.map((member) => (
                <form action={updateMemberAction} key={member.member_id} className="grid gap-3 rounded-xl border p-4 md:grid-cols-[1.5fr_0.8fr_1fr_auto_auto] md:items-end">
                  <input type="hidden" name="organizationId" value={organizationId} />
                  <input type="hidden" name="memberId" value={member.member_id} />
                  <div><div className="text-xs font-medium uppercase text-neutral-500">Usuario</div><div className="mt-2 truncate text-sm font-medium">{member.email ?? member.user_id}</div></div>
                  <label className="text-xs font-medium uppercase text-neutral-500">Rol
                    <select className={inputClass} name="role" defaultValue={member.role}><option value="owner">Owner</option><option value="cashier">Cashier</option></select>
                  </label>
                  <label className="text-xs font-medium uppercase text-neutral-500">Local
                    <select className={inputClass} name="branchId" defaultValue={member.branch_id ?? ""}><option value="">Todos / sin restricción</option>{(branches ?? []).filter((branch) => branch.active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select>
                  </label>
                  <label className="flex h-10 items-center gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={member.active} /> Activo</label>
                  <button className={secondaryButtonClass}>Guardar</button>
                </form>
              ))}
            </div>

            <form action={addMemberAction} className="mt-6 grid gap-4 rounded-xl bg-neutral-50 p-4 md:grid-cols-[1.5fr_0.8fr_1fr_auto] md:items-end">
              <input type="hidden" name="organizationId" value={organizationId} />
              <Field label="Correo del usuario" name="email" type="email" required placeholder="cajero@negocio.com" />
              <label className="text-sm font-medium text-neutral-700">Rol<select className={inputClass} name="role" defaultValue="cashier"><option value="cashier">Cashier</option><option value="owner">Owner</option></select></label>
              <label className="text-sm font-medium text-neutral-700">Local<select className={inputClass} name="branchId" defaultValue=""><option value="">Todos / sin restricción</option>{(branches ?? []).filter((branch) => branch.active).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
              <button className={buttonClass}>Agregar</button>
              <p className="text-xs text-neutral-500 md:col-span-4">El correo debe existir previamente en Supabase Auth. Más adelante podemos añadir el flujo de invitación desde la aplicación.</p>
            </form>
          </>
        ) : (
          <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">La administración de usuarios está reservada a propietarios.</div>
        )}
      </section>

      <section id="integraciones" className="scroll-mt-6 rounded-2xl border bg-white p-6 shadow-sm">
        <SectionTitle icon={KeyRound} title="Integraciones" description="Las credenciales sensibles permanecen en variables del servidor y nunca se guardan en tablas públicas." />
        <div className="mt-6 flex items-center justify-between rounded-xl border p-4">
          <div><div className="font-medium">Intifact</div><div className="mt-1 text-sm text-neutral-500">API de facturación electrónica</div></div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${intifactConfigured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>{intifactConfigured ? "Configurado" : "Pendiente"}</div>
        </div>
      </section>
    </div>
  );
}

function Header() {
  return <div><div className="flex items-center gap-2 text-sm font-medium text-neutral-500"><Settings className="size-4" /> Administración</div><h1 className="mt-1 text-2xl font-semibold tracking-tight">Configuración</h1><p className="mt-2 text-sm text-neutral-500">Datos maestros del negocio, locales, series y accesos.</p></div>;
}

function Message({ success, error }: { success?: string; error?: string }) {
  if (!success && !error) return null;
  return <div className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>{error ? <ShieldCheck className="mt-0.5 size-4" /> : <CircleCheck className="mt-0.5 size-4" />}<span>{error ?? success}</span></div>;
}

function Anchor({ href, children }: { href: string; children: React.ReactNode }) {
  return <a className="rounded-lg border bg-white px-3 py-2 text-neutral-700 hover:bg-neutral-50" href={href}>{children}</a>;
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof Building2; title: string; description: string }) {
  return <div className="flex items-start gap-3"><div className="rounded-xl bg-neutral-100 p-2"><Icon className="size-5" /></div><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-neutral-500">{description}</p></div></div>;
}

function Status({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-100 text-emerald-800" : "bg-neutral-100 text-neutral-600"}`}>{active ? "Activo" : "Inactivo"}</span>;
}

function Field({ label, className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className={`text-sm font-medium text-neutral-700 ${className}`}>{label}<input className={inputClass} {...props} /></label>;
}
