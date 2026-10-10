import { redirect } from "next/navigation";

import { PosClient } from "@/features/sales/components/pos-client";
import { getSalesContext } from "@/features/sales/server/context";
import {
  listActiveCustomers,
  listActiveProducts,
  listActiveSequences,
} from "@/features/sales/server/sales";
import { createClient } from "@/lib/supabase/server";

export default async function PosPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const context = await getSalesContext();
  if (!context) redirect("/login");

  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase
    .from("v_sales_session_summary")
    .select("session_id, branch_id, status, cashier_user_id")
    .eq("session_id", sessionId)
    .limit(1)
    .maybeSingle();

  if (
    sessionError ||
    !session ||
    session.status !== "open" ||
    (session.cashier_user_id !== context.userId && context.role !== "owner")
  ) {
    redirect("/ventas");
  }

  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("id, code, name")
    .eq("id", session.branch_id)
    .maybeSingle();

  if (branchError || !branch) redirect("/ventas");

  const [products, customers, sequenceResult] = await Promise.all([
    listActiveProducts(context),
    listActiveCustomers(context),
    listActiveSequences(branch.id),
  ]);

  return (
    <PosClient
      sessionId={sessionId}
      tradeName={context.tradeName}
      branchName={`${branch.code} · ${branch.name}`}
      products={products}
      initialCustomers={customers}
      sequences={sequenceResult.sequences}
    />
  );
}
