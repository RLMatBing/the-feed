import { isAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/instructor/LoginForm";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConsoleLoginPage() {
  if (await isAdmin()) redirect("/console");
  return (
    <main className="flex min-h-[100dvh] flex-col justify-center bg-ops-bg px-8 text-ops-text">
      <div className="mx-auto w-full max-w-md">
      <p className="font-mono text-[11px] uppercase tracking-wide text-white">
        Restricted
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">
        Operator access
      </h1>
      <p className="mt-3 text-sm text-ops-muted">
        This console is not part of the student game.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
      </div>
    </main>
  );
}
