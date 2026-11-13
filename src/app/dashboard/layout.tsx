
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  // Wait for a real incoming request.
  // Prevents Supabase Auth from running during prerendering.
  await connection();

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/login");
  }

  return <>{children}</>;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<p>Checking your session...</p>}>
      <AuthenticatedDashboard>
        {children}
      </AuthenticatedDashboard>
    </Suspense>
  );
}
