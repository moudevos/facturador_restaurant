"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";

import { AppModal } from "@/components/ui/app-modal";
import { useFeedback } from "@/components/feedback";
import { addMemberAction, updateMemberAction } from "@/app/(dashboard)/configuracion/actions";
import { listBranchesAction, listMembersAction } from "../server/list-actions";
import type { Branch, OrganizationMember } from "../types";
import { EmptySettingsState, SETTINGS_INPUT, StatusBadge } from "./shared";

export function MembersManager({
  organizationId,
  isOwner,
  initialBranches,
  initialMembers,
}: {
  organizationId: string;
  isOwner: boolean;
  initialBranches: Branch[];
  initialMembers: OrganizationMember[];
}) {
  const queryClient = useQueryClient();
  const { toast } = useFeedback();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<OrganizationMember | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["settings", "branches", organizationId],
    queryFn: listBranchesAction,
    initialData: { data: initialBranches, errorMessage: null },
  });
  const membersQuery = useQuery({
    queryKey: ["settings", "members", organizationId],
    queryFn: listMembersAction,
    initialData: { data: initialMembers, errorMessage: null },
    enabled: isOwner,
  });

  const saveMutation = useMutation({
    mutationFn: ({ member, formData }: { member: OrganizationMember | null; formData: FormData }) =>
      member ? updateMemberAction(formData) : addMemberAction(formData),
  });

  if (!isOwner) {
    return (
      <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
        La administración de usuarios está reservada a propietarios.
      </div>
    );
  }

  const branches = branchesQuery.data.data;
  const activeBranches = branches.filter((branch) => branch.active);
  const members = membersQuery.data.data;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(member: OrganizationMember) {
    setEditing(member);
    setModalOpen(true);
  }

  async function saveMember(formData: FormData) {
    const result = await saveMutation.mutateAsync({ member: editing, formData });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["settings", "members", organizationId] });
    setModalOpen(false);
    setEditing(null);
    toast.success(result.message);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white">
          <Plus className="size-4" aria-hidden="true" />
          Agregar usuario
        </button>
      </div>

      {membersQuery.data.errorMessage ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {membersQuery.data.errorMessage}
        </div>
      ) : members.length === 0 ? (
        <EmptySettingsState>No hay usuarios registrados.</EmptySettingsState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Usuario</th>
                  <th className="px-4 py-3 font-medium">Rol</th>
                  <th className="px-4 py-3 font-medium">Local</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {members.map((member) => {
                  const branch = branches.find((item) => item.id === member.branch_id);
                  return (
                    <tr key={member.member_id}>
                      <td className="px-4 py-3 font-medium">{member.email ?? member.user_id}</td>
                      <td className="px-4 py-3">{member.role === "owner" ? "Owner" : "Cashier"}</td>
                      <td className="px-4 py-3 text-neutral-600">{branch?.name ?? "Todos / sin restricción"}</td>
                      <td className="px-4 py-3"><StatusBadge active={member.active} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openEdit(member)}
                          aria-label={`Editar permisos de ${member.email ?? "usuario"}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {members.map((member) => {
              const branch = branches.find((item) => item.id === member.branch_id);
              return (
                <article key={member.member_id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{member.email ?? member.user_id}</p>
                      <p className="mt-1 text-sm text-neutral-500">{member.role === "owner" ? "Owner" : "Cashier"} · {branch?.name ?? "Todos / sin restricción"}</p>
                    </div>
                    <StatusBadge active={member.active} />
                  </div>
                  <button type="button" onClick={() => openEdit(member)} className="mt-4 h-10 w-full rounded-lg border text-sm font-medium">
                    Editar permisos
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      <AppModal
        open={modalOpen}
        onClose={() => {
          if (!saveMutation.isPending) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        isBusy={saveMutation.isPending}
        title={editing ? "Editar usuario" : "Agregar usuario"}
        description={
          editing
            ? "Actualiza el rol, local asignado y estado del usuario."
            : "El correo debe existir previamente en Supabase Auth."
        }
        maxWidth="lg"
      >
        <MemberForm
          member={editing}
          branches={activeBranches}
          isSaving={saveMutation.isPending}
          onSubmit={saveMember}
          onCancel={() => setModalOpen(false)}
        />
      </AppModal>
    </div>
  );
}

function MemberForm({
  member,
  branches,
  isSaving,
  onSubmit,
  onCancel,
}: {
  member: OrganizationMember | null;
  branches: Branch[];
  isSaving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (member) {
      formData.set("memberId", member.member_id);
      formData.set("active", formData.get("active") === "true" ? "true" : "false");
    }
    await onSubmit(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {member ? (
        <div className="rounded-lg bg-neutral-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">Usuario</p>
          <p className="mt-1 text-sm font-medium text-neutral-900">{member.email ?? member.user_id}</p>
        </div>
      ) : (
        <label className="block text-sm font-medium text-neutral-700">
          Correo del usuario
          <input className={SETTINGS_INPUT} name="email" type="email" required disabled={isSaving} placeholder="cajero@negocio.com" />
        </label>
      )}

      <label className="block text-sm font-medium text-neutral-700">
        Rol
        <select className={SETTINGS_INPUT} name="role" defaultValue={member?.role ?? "cashier"} disabled={isSaving}>
          <option value="cashier">Cashier</option>
          <option value="owner">Owner</option>
        </select>
      </label>

      <label className="block text-sm font-medium text-neutral-700">
        Local
        <select className={SETTINGS_INPUT} name="branchId" defaultValue={member?.branch_id ?? ""} disabled={isSaving}>
          <option value="">Todos / sin restricción</option>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
        </select>
      </label>

      {member ? (
        <label className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 text-sm">
          <input type="checkbox" name="active" value="true" defaultChecked={member.active} disabled={isSaving} className="mt-0.5" />
          <span>
            <span className="block font-medium text-neutral-900">Usuario activo</span>
            <span className="mt-0.5 block text-xs text-neutral-500">Al desactivarlo perderá acceso operativo a esta organización.</span>
          </span>
        </label>
      ) : (
        <p className="text-xs leading-relaxed text-neutral-500">
          Este flujo no crea cuentas de Auth. Primero crea el usuario en Supabase Auth y luego asígnalo aquí.
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSaving} className="h-11 rounded-lg border border-neutral-200 px-5 text-sm font-medium">Cancelar</button>
        <button type="submit" disabled={isSaving} className="h-11 rounded-lg bg-neutral-950 px-5 text-sm font-medium text-white disabled:opacity-60">
          {isSaving ? "Guardando..." : member ? "Guardar cambios" : "Agregar usuario"}
        </button>
      </div>
    </form>
  );
}
