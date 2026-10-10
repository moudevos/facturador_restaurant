import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { FeedbackProvider } from "@/components/feedback";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getSalesContext } from "@/features/sales/server/context";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    redirect("/login");
  }

  const context = await getSalesContext();

  return (
    <FeedbackProvider>
      <div className="flex min-h-screen bg-neutral-50/40">
        <AppSidebar brandName={context?.tradeName ?? "Facturador Restaurant"} />
        <main className="min-w-0 flex-1 p-5 pb-10 sm:p-8 lg:p-10">{children}</main>
      </div>
    </FeedbackProvider>
  );
}
