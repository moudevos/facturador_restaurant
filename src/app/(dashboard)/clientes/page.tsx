import { redirect } from "next/navigation";

import { CustomersManager } from "@/features/customers/components/customers-manager";
import { getSalesContext } from "@/features/sales/server/context";
import { listActiveCustomers } from "@/features/sales/server/sales";

export default async function CustomersPage() {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");

  const customers = await listActiveCustomers(context);

  return (
    <section className="space-y-4 sm:space-y-6">
      <header>
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-orange-600">
          Catálogo comercial
        </p>
        <h1 className="mt-1 text-[23px] font-extrabold tracking-[-0.02em] text-[#14201b] sm:text-[27px]">
          Clientes
        </h1>
        <p className="mt-1.5 text-[13px] text-[#7b8680]">
          Personas y empresas disponibles para boletas y facturas del POS.
        </p>
      </header>
      <CustomersManager initialCustomers={customers} />
    </section>
  );
}
