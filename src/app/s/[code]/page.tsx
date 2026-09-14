import { loadStudentState } from "@/app/actions/student";
import { InstructorLink } from "@/components/student/InstructorLink";
import { JoinForm } from "@/components/student/JoinForm";
import { StudentApp } from "@/components/student/StudentApp";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const state = await loadStudentState(code);
  if (!state) notFound();
  if (!state.you) {
    if (state.session.flags.ended) {
      return (
        <main className="flex min-h-[100dvh] flex-col justify-center bg-feed-bg px-6">
          <div className="mx-auto w-full max-w-sm">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-feed-accent">
              ROOM {state.session.code}
            </p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">
              This session has ended.
            </h1>
          </div>
        </main>
      );
    }
    return (
      <main className="flex min-h-[100dvh] flex-col justify-center bg-feed-bg px-6">
        <div className="mx-auto w-full max-w-sm">
          <p className="text-[11px] font-semibold tracking-[0.22em] text-feed-accent">
            ROOM {state.session.code}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">Join</h1>
          <div className="mt-8">
            <JoinForm presetCode={state.session.code} />
          </div>
          <div className="mt-10">
            <InstructorLink />
          </div>
        </div>
      </main>
    );
  }
  return <StudentApp initial={state} />;
}
