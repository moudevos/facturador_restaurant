"use client";

import { useState, useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { setProductActiveAction } from "../server/actions";

export function ProductStatusButton({ id, active }: { id: string; active: boolean }) {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState("");
    const queryClient = useQueryClient();

    function changeStatus() {
        if (
            active &&
            !window.confirm(
                "Este producto dejará de estar disponible para nuevas ventas. Los comprobantes históricos no se modificarán.",
            )
        )
            return;

        startTransition(async () => {
            const result = await setProductActiveAction(id, !active);
            setMessage(result.message);
            if (result.success) await queryClient.invalidateQueries({ queryKey: ["products"] });
        });
    }

    return (
        <div className="space-y-1">
            <button
                type="button"
                onClick={changeStatus}
                disabled={isPending}
                className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium text-neutral-600 transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${active
                        ? "hover:bg-red-50 hover:text-red-700 focus-visible:ring-red-500/30"
                        : "hover:bg-emerald-50 hover:text-emerald-700 focus-visible:ring-emerald-500/30"
                    }`}
            >
                {isPending ? "Guardando..." : active ? "Desactivar" : "Activar"}
            </button>
            {message ? (
                <p role="status" aria-live="polite" className="px-3 text-xs text-neutral-500">
                    {message}
                </p>
            ) : null}
        </div>
    );
}
