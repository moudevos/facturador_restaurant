"use client";

import { useState } from "react";
import { FlaskConical } from "lucide-react";

import { useFeedback } from "@/components/feedback";

const btn =
    "inline-flex h-8 items-center justify-center rounded-lg border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50";

export function AlertTester() {
    const { toast, confirm, alert, withLoading } = useFeedback();
    const [open, setOpen] = useState(false);

    return (
        <div className="rounded-xl border border-dashed p-4">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-2 text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
                <FlaskConical className="size-4" />
                Probar alertas
                <span className="ml-auto text-xs text-neutral-400">{open ? "Ocultar" : "Mostrar"}</span>
            </button>

            {open && (
                <div className="mt-4 space-y-3">
                    <div>
                        <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Arriba izquierda</p>
                        <div className="flex flex-wrap gap-2">
                            <button className={btn} onClick={() => toast.success("Guardado correctamente")}>Éxito</button>
                            <button className={btn} onClick={() => toast.info("Dato informativo", { description: "Mensaje con detalle." })}>Info</button>
                            <button className={btn} onClick={() => toast.warning("Stock bajo")}>Advertencia</button>
                            <button className={btn} onClick={() => toast.error("No se pudo guardar")}>Error</button>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Abajo centro</p>
                        <div className="flex flex-wrap gap-2">
                            <button className={btn} onClick={() => toast.success("Copiado", { position: "bottom-center", duration: 2500 })}>Éxito</button>
                            <button className={btn} onClick={() => toast.error("Sin conexión", { position: "bottom-center" })}>Error</button>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-xs font-medium uppercase text-neutral-500">Modales</p>
                        <div className="flex flex-wrap gap-2">
                            <button
                                className={btn}
                                onClick={async () => {
                                    const ok = await confirm({
                                        title: "¿Continuar?",
                                        description: "Confirmación normal.",
                                    });
                                    toast.info(ok ? "Confirmaste" : "Cancelaste", { position: "bottom-center" });
                                }}
                            >
                                Confirmar
                            </button>

                            <button
                                className={btn}
                                onClick={async () => {
                                    const ok = await confirm({
                                        title: "¿Eliminar registro?",
                                        description: "Esta acción no se puede deshacer.",
                                        tone: "danger",
                                        confirmText: "Eliminar",
                                    });
                                    if (ok) toast.success("Eliminado");
                                }}
                            >
                                Peligro
                            </button>

                            <button
                                className={btn}
                                onClick={() =>
                                    alert({
                                        title: "Sesión por expirar",
                                        description: "Guarda tus cambios antes de continuar.",
                                        tone: "warning",
                                    })
                                }
                            >
                                Alerta
                            </button>

                            <button
                                className={btn}
                                onClick={async () => {
                                    await withLoading(() => new Promise((r) => setTimeout(r, 2000)), "Procesando…");
                                    toast.success("Proceso terminado");
                                }}
                            >
                                Loading 2s
                            </button>
                            <button className={btn} onClick={() => alert.success({ title: "¡Todo listo!", description: "La boleta B001-00045 se emitió correctamente." })}>Alerta éxito</button>
                            <button className={btn} onClick={() => alert.error({ title: "No se pudo emitir", description: "Intifact rechazó el comprobante: RUC inválido." })}>Alerta error</button>
                            <button className={btn} onClick={() => alert.warning({ title: "Stock bajo", description: "Quedan 3 unidades de este producto." })}>Alerta aviso</button>
                            <button className={btn} onClick={() => alert.info({ title: "Sincronización", description: "Los datos se actualizarán en unos minutos." })}>Alerta info</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}