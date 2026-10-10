"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useFeedback } from "@/components/feedback";
import { setProductActiveAction } from "../server/actions";

export function ProductStatusButton({ id, active }: { id: string; active: boolean }) {
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const { confirm, toast } = useFeedback();

  async function changeStatus() {
    if (active) {
      const accepted = await confirm({
        title: "Desactivar producto",
        description:
          "Este producto dejará de estar disponible para nuevas ventas. Los comprobantes históricos no se modificarán.",
        tone: "danger",
        confirmText: "Desactivar",
        cancelText: "Cancelar",
      });
      if (!accepted) return;
    }

    startTransition(async () => {
      const result = await setProductActiveAction(id, !active);
      if (!result.success) {
        toast.error(result.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success(result.message);
    });
  }

  return (
    <button
      type="button"
      onClick={() => void changeStatus()}
      disabled={isPending}
      className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-500/30"
          : "hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-emerald-500/30"
      }`}
    >
      {isPending ? "Guardando..." : active ? "Desactivar" : "Activar"}
    </button>
  );
}
