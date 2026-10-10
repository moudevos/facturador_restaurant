"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Power } from "lucide-react";

import { Modal } from "@/components/modal";
import { useFeedback } from "@/components/feedback";
import { createBranchAction, updateBranchAction } from "@/app/(dashboard)/configuracion/actions";
import { listBranchesAction } from "../server/list-actions";
import type { Branch } from "../types";
import { EmptySettingsState, SETTINGS_INPUT, StatusBadge } from "./shared";

type BranchMutationInput = {
  branch: Branch | null;
  formData: FormData;
};

export function BranchesManager({
  organizationId,
  isOwner,
  initialBranches,
}: {
  organizationId: string;
  isOwner: boolean;
  initialBranches: Branch[];
}) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  const branchesQuery = useQuery({
    queryKey: ["settings", "branches", organizationId],
    queryFn: listBranchesAction,
    initialData: { data: initialBranches, errorMessage: null },
  });

  const saveMutation = useMutation({
    mutationFn: ({ branch, formData }: BranchMutationInput) =>
      branch ? updateBranchAction(formData) : createBranchAction(formData),
  });

  const toggleMutation = useMutation({
    mutationFn: (formData: FormData) => updateBranchAction(formData),
  });

  const branches = branchesQuery.data.data;

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditing(branch);
    setModalOpen(true);
  }

  async function saveBranch(formData: FormData) {
    const result = await saveMutation.mutateAsync({ branch: editing, formData });
    if (!result.success) {
      toast.error(result.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["settings", "branches", organizationId] });
    setModalOpen(false);
    setEditing(null);
    toast.success(result.message);
  }

  async function changeStatus(branch: Branch) {
    if (branch.active) {
      const accepted = await confirm({
        title: "Desactivar local",
        description:
          "El local dejará de estar disponible para nuevas operaciones. Los datos históricos no se eliminarán.",
        tone: "danger",
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      });
      if (!accepted) return;
    }

    const formData = new FormData();
    formData.set("branchId", branch.id);
    formData.set("code", branch.code);
    formData.set("name", branch.name);
    formData.set("address", branch.address ?? "");
    formData.set("ubigeo", branch.ubigeo ?? "");
    formData.set("active", String(!branch.active));

    const result = await toggleMutation.mutateAsync(formData);
    if (!result.success) {
      toast.error(result.message);
      return;
    }

    await queryClient.invalidateQueries({ queryKey: ["settings", "branches", organizationId] });
    toast.success(result.message);
  }

  return (
    <div className="mt-6 space-y-4">
      {isOwner ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-12 items-center gap-2 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_#e86400] transition hover:bg-orange-600"
          >
            <Plus className="size-4" aria-hidden="true" />
            Agregar local
          </button>
        </div>
      ) : null}

      {branchesQuery.data.errorMessage ? (
        <div role="alert" className="rounded-[16px] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {branchesQuery.data.errorMessage}
        </div>
      ) : branches.length === 0 ? (
        <EmptySettingsState>No hay locales registrados.</EmptySettingsState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-[16px] border border-[#e8e3d7] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-[#f6f3ec] text-xs uppercase tracking-wide text-[#7b8680]">
                <tr>
                  <th className="px-4 py-3 font-bold">Código</th>
                  <th className="px-4 py-3 font-bold">Local</th>
                  <th className="px-4 py-3 font-bold">Dirección</th>
                  <th className="px-4 py-3 font-bold">Ubigeo</th>
                  <th className="px-4 py-3 font-bold">Estado</th>
                  <th className="px-4 py-3 text-right font-bold">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {branches.map((branch) => (
                  <tr key={branch.id}>
                    <td className="px-4 py-3 font-bold">{branch.code}</td>
                    <td className="px-4 py-3">{branch.name}</td>
                    <td className="px-4 py-3 text-[#59665f]">{branch.address || "—"}</td>
                    <td className="px-4 py-3 text-[#59665f]">{branch.ubigeo || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge active={branch.active} /></td>
                    <td className="px-4 py-3">
                      {isOwner ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(branch)}
                            aria-label={`Editar ${branch.name}`}
                            className="inline-flex size-9 items-center justify-center rounded-[13px] text-[#7b8680] hover:bg-[#e9e4d6] hover:text-[#14201b]"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void changeStatus(branch)}
                            disabled={toggleMutation.isPending}
                            aria-label={branch.active ? `Desactivar ${branch.name}` : `Activar ${branch.name}`}
                            className="inline-flex size-9 items-center justify-center rounded-[13px] text-[#7b8680] hover:bg-[#e9e4d6] hover:text-[#14201b] disabled:opacity-50"
                          >
                            <Power className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="block text-right text-[#c6c0b3]">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {branches.map((branch) => (
              <article key={branch.id} className="rounded-[16px] border border-[#e8e3d7] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[#14201b]">{branch.code} · {branch.name}</p>
                    <p className="mt-1 text-sm text-[#7b8680]">{branch.address || "Sin dirección"}</p>
                    <p className="mt-1 text-xs text-[#9b9f99]">Ubigeo: {branch.ubigeo || "—"}</p>
                  </div>
                  <StatusBadge active={branch.active} />
                </div>
                {isOwner ? (
                  <div className="mt-4 flex gap-2 border-t border-[#eee9df] pt-3">
                    <button type="button" onClick={() => openEdit(branch)} className="h-10 flex-1 rounded-[13px] border text-sm font-bold">
                      Editar
                    </button>
                    <button type="button" onClick={() => void changeStatus(branch)} className="h-10 flex-1 rounded-[13px] border text-sm font-bold">
                      {branch.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => {
          if (!saveMutation.isPending) {
            setModalOpen(false);
            setEditing(null);
          }
        }}
        dismissible={!saveMutation.isPending}
        title={editing ? "Editar local" : "Agregar local"}
        description={editing ? "Actualiza los datos operativos del local." : "Registra una nueva sucursal o punto de emisión."}
        size="lg"
      >
        <BranchForm branch={editing} isSaving={saveMutation.isPending} onSubmit={saveBranch} onCancel={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}

function BranchForm({
  branch,
  isSaving,
  onSubmit,
  onCancel,
}: {
  branch: Branch | null;
  isSaving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    if (branch) {
      formData.set("branchId", branch.id);
      formData.set("active", formData.get("active") === "true" ? "true" : "false");
    }
    await onSubmit(formData);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-bold text-[#35423c]">
          Código
          <input className={SETTINGS_INPUT} name="code" defaultValue={branch?.code ?? ""} required maxLength={20} disabled={isSaving} placeholder="002" />
        </label>
        <label className="text-sm font-bold text-[#35423c]">
          Nombre
          <input className={SETTINGS_INPUT} name="name" defaultValue={branch?.name ?? ""} required disabled={isSaving} placeholder="Sucursal centro" />
        </label>
        <label className="text-sm font-bold text-[#35423c] sm:col-span-2">
          Dirección
          <input className={SETTINGS_INPUT} name="address" defaultValue={branch?.address ?? ""} disabled={isSaving} />
        </label>
        <label className="text-sm font-bold text-[#35423c]">
          Ubigeo
          <input className={SETTINGS_INPUT} name="ubigeo" defaultValue={branch?.ubigeo ?? ""} maxLength={6} inputMode="numeric" disabled={isSaving} />
        </label>
        {branch ? (
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-[#35423c]">
            <input type="checkbox" name="active" value="true" defaultChecked={branch.active} disabled={isSaving} />
            Local activo
          </label>
        ) : null}
      </div>
      <div className="flex flex-col-reverse gap-3 border-t border-[#eee9df] pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSaving} className="h-12 rounded-[15px] border border-[#e8e3d7] bg-white px-5 text-sm font-bold">
          Cancelar
        </button>
        <button type="submit" disabled={isSaving} className="h-12 rounded-[15px] bg-orange-500 px-5 text-sm font-extrabold text-white disabled:opacity-60">
          {isSaving ? "Guardando..." : branch ? "Guardar cambios" : "Crear local"}
        </button>
      </div>
    </form>
  );
}
