import { loadInstructorHome } from "@/app/actions/instructor";
import { ConsoleHome } from "@/components/instructor/ConsoleHome";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ConsoleIndexPage() {
  const home = await loadInstructorHome();
  if (!home.authed) redirect("/console/login");
  return <ConsoleHome sessions={home.sessions} />;
}
