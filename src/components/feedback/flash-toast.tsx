"use client";

import { useEffect, useRef } from "react";

import { useFeedback } from "./feedback-provider";

type FlashToastProps = {
  success?: string;
  error?: string;
  /** Valor único por redirect, para que el mismo mensaje pueda mostrarse dos veces seguidas. */
  nonce?: string;
};

export function FlashToast({ success, error, nonce }: FlashToastProps) {
  const { toast } = useFeedback();
  const lastKey = useRef<string | null>(null);

  useEffect(() => {
    if (!success && !error) return;

    const key = `${nonce ?? ""}|${success ?? ""}|${error ?? ""}`;
    if (lastKey.current === key) return; // evita duplicados en modo estricto
    lastKey.current = key;

    if (error) toast.error(error);
    else if (success) toast.success(success);

    const url = new URL(window.location.href);
    url.searchParams.delete("success");
    url.searchParams.delete("error");
    url.searchParams.delete("n");
    window.history.replaceState(null, "", `${url.pathname}${url.search}`);
  }, [success, error, nonce, toast]);

  return null;
}