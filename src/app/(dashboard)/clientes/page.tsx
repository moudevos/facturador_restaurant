import { redirect } from "next/navigation";

import { CustomersManager } from "@/features/customers/components/customers-manager";
import { getSalesContext } from "@/features/sales/server/context";
import { listActiveCustomers } from "@/features/sales/server/sales";

export default async function CustomersPage() {
  const context = await getSalesContext();
  if (!context) redirect("/configuracion");

  const customers = await listActiveCustomers(context);

  return (
    <section className="space-y-6">
      <header>
        <p className="text-sm font-medium text-orange-600">Catálogo comercial</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-900">Clientes</h1>
        <p className="mt-2 text-sm text-neutral-500">
          Personas y empresas disponibles para boletas y facturas del POS.
        </p>
      </header>
      <CustomersManager initialCustomers={customers} />
    </section>
  );
}
