import { Construction } from "lucide-react";

export function ModulePlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="space-y-4 sm:space-y-6">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Módulo
        </p>
        <h1 className="mt-1 text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[27px]">
          {title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#7b8680]">{description}</p>
      </header>
      <div className="rounded-[20px] border-2 border-dashed border-[#d8d2c0] bg-white px-5 py-12 text-center sm:py-16">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#fff0e2] text-orange-600">
          <Construction className="size-6" />
        </div>
        <p className="mt-4 text-sm font-extrabold text-[#14201b]">En preparación</p>
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#7b8680]">
          La estructura visual ya está integrada y este módulo se conectará a su flujo funcional correspondiente.
        </p>
      </div>
    </section>
  );
}
