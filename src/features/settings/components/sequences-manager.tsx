"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Power } from "lucide-react";

import { Modal } from "@/components/modal";
import { useFeedback } from "@/components/feedback";
import { createSequenceAction, toggleSequenceAction } from "@/app/(dashboard)/configuracion/actions";
import { listBranchesAction, listSequencesAction } from "../server/list-actions";
import type { Branch, DocumentSequence } from "../types";
import { EmptySettingsState, SETTINGS_INPUT, StatusBadge } from "./shared";

export function SequencesManager({
  organizationId,
  isOwner,
  initialBranches,
  initialSequences,
}: {
  organizationId: string;
  isOwner: boolean;
  initialBranches: Branch[];
  initialSequences: DocumentSequence[];
}) {
  const queryClient = useQueryClient();
  const { toast, confirm } = useFeedback();
  const [modalOpen, setModalOpen] = useState(false);

  const branchesQuery = useQuery({
    queryKey: ["settings", "branches", organizationId],
    queryFn: listBranchesAction,
    initialData: { data: initialBranches, errorMessage: null },
  });
  const sequencesQuery = useQuery({
    queryKey: ["settings", "sequences", organizationId],
    queryFn: listSequencesAction,
    initialData: { data: initialSequences, errorMessage: null },
    enabled: isOwner,
  });

  const createMutation = useMutation({ mutationFn: createSequenceAction });
  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleSequenceAction(id, active),
  });

  const branches = branchesQuery.data.data;
  const activeBranches = branches.filter((branch) => branch.active);
  const sequences = sequencesQuery.data.data;

  async function createSequence(formData: FormData) {
    const result = await createMutation.mutateAsync(formData);
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["settings", "sequences", organizationId] });
    setModalOpen(false);
    toast.success(result.message);
  }

  async function changeStatus(sequence: DocumentSequence) {
    if (sequence.active) {
      const accepted = await confirm({
        title: "Desactivar serie",
        description:
          "La serie dejará de estar disponible para nuevas emisiones. El correlativo y los comprobantes existentes no se modificarán.",
        tone: "danger",
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      });
      if (!accepted) return;
    }

    const result = await toggleMutation.mutateAsync({ id: sequence.id, active: !sequence.active });
    if (!result.success) {
      toast.error(result.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["settings", "sequences", organizationId] });
    toast.success(result.message);
  }

  if (!isOwner) {
    return (
      <div className="mt-6 rounded-xl bg-neutral-50 p-4 text-sm text-neutral-600">
        La administración y visualización de series está reservada a propietarios por la política de seguridad actual.
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={activeBranches.length === 0}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-neutral-950 px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" aria-hidden="true" />
          Agregar serie
        </button>
      </div>

      {sequencesQuery.data.errorMessage ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {sequencesQuery.data.errorMessage}
        </div>
      ) : sequences.length === 0 ? (
        <EmptySettingsState>No hay series registradas.</EmptySettingsState>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-neutral-200 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Local</th>
                  <th className="px-4 py-3 font-medium">Documento</th>
                  <th className="px-4 py-3 font-medium">Serie</th>
                  <th className="px-4 py-3 font-medium">Último correlativo</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {sequences.map((sequence) => {
                  const branch = branches.find((item) => item.id === sequence.branch_id);
                  return (
                    <tr key={sequence.id}>
                      <td className="px-4 py-3">{branch?.name ?? "—"}</td>
                      <td className="px-4 py-3">{sequence.document_type === "03" ? "Boleta" : "Factura"}</td>
                      <td className="px-4 py-3 font-medium">{sequence.series}</td>
                      <td className="px-4 py-3 tabular-nums">{sequence.current_value}</td>
                      <td className="px-4 py-3"><StatusBadge active={sequence.active} /></td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => void changeStatus(sequence)}
                          disabled={toggleMutation.isPending}
                          aria-label={sequence.active ? `Desactivar serie ${sequence.series}` : `Activar serie ${sequence.series}`}
                          className="inline-flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50"
                        >
                          <Power className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {sequences.map((sequence) => {
              const branch = branches.find((item) => item.id === sequence.branch_id);
              return (
                <article key={sequence.id} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{sequence.series} · {sequence.document_type === "03" ? "Boleta" : "Factura"}</p>
                      <p className="mt-1 text-sm text-neutral-500">{branch?.name ?? "Local no disponible"}</p>
                      <p className="mt-1 text-xs text-neutral-400">Último correlativo: {sequence.current_value}</p>
                    </div>
                    <StatusBadge active={sequence.active} />
                  </div>
                  <button type="button" onClick={() => void changeStatus(sequence)} className="mt-4 h-10 w-full rounded-lg border text-sm font-medium">
                    {sequence.active ? "Desactivar" : "Activar"}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Modal
        open={modalOpen}
        onClose={() => !createMutation.isPending && setModalOpen(false)}
        dismissible={!createMutation.isPending}
        title="Agregar serie"
        description="Crea una nueva serie para un local. Serie, tipo y correlativo no se editan después."
        size="md"
      >
        <SequenceForm
          branches={activeBranches}
          isSaving={createMutation.isPending}
          onSubmit={createSequence}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function SequenceForm({
  branches,
  isSaving,
  onSubmit,
  onCancel,
}: {
  branches: Branch[];
  isSaving: boolean;
  onSubmit: (formData: FormData) => Promise<void>;
  onCancel: () => void;
}) {
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(new FormData(event.currentTarget));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block text-sm font-medium text-neutral-700">
        Local
        <select className={SETTINGS_INPUT} name="branchId" required disabled={isSaving}>
          {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-neutral-700">
        Documento
        <select className={SETTINGS_INPUT} name="documentType" defaultValue="03" disabled={isSaving}>
          <option value="03">Boleta</option>
          <option value="01">Factura</option>
        </select>
      </label>
      <label className="block text-sm font-medium text-neutral-700">
        Serie
        <input className={SETTINGS_INPUT} name="series" required placeholder="B002" maxLength={4} disabled={isSaving} />
        <span className="mt-1.5 block text-xs font-normal text-neutral-500">4 caracteres. Ejemplo: B002 o F001.</span>
      </label>
      <div className="flex flex-col-reverse gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} disabled={isSaving} className="h-11 rounded-lg border border-neutral-200 px-5 text-sm font-medium">Cancelar</button>
        <button type="submit" disabled={isSaving || branches.length === 0} className="h-11 rounded-lg bg-neutral-950 px-5 text-sm font-medium text-white disabled:opacity-60">
          {isSaving ? "Guardando..." : "Crear serie"}
        </button>
      </div>
    </form>
  );
}
