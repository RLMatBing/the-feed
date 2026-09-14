import { loadInstructorState } from "@/app/actions/instructor";
import { ConsoleApp } from "@/components/instructor/ConsoleApp";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ConsoleSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  if (!(await isAdmin())) redirect("/console/login");
  const { sessionId } = await params;
  const state = await loadInstructorState(sessionId);
  if (!state) notFound();
  return <ConsoleApp initial={state} />;
}
