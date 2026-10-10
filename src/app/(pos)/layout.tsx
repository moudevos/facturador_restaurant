import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { FeedbackProvider } from "@/components/feedback";
import { createClient } from "@/lib/supabase/server";

export default async function PosLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) redirect("/login");

  return <FeedbackProvider>{children}</FeedbackProvider>;
}
