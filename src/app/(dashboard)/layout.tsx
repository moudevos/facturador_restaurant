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
      <div className="flex min-h-dvh bg-[#f6f3ec]">
        <AppSidebar brandName={context?.tradeName ?? "Facturador Restaurant"} />
        <main className="min-w-0 flex-1 px-4 pb-28 pt-[82px] sm:px-6 lg:px-8 lg:pb-10 lg:pt-8 xl:px-10">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </FeedbackProvider>
  );
}
