"use client";

import { useRef, type ButtonHTMLAttributes } from "react";

import { useFeedback, type DialogOptions } from "./feedback-provider";

type ConfirmSubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> & {
  confirm: DialogOptions;
};

export function ConfirmSubmitButton({ confirm: options, children, ...props }: ConfirmSubmitButtonProps) {
  const { confirm } = useFeedback();
  const ref = useRef<HTMLButtonElement>(null);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (await confirm(options)) ref.current?.form?.requestSubmit();
  }

  return (
    <button ref={ref} type="submit" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}