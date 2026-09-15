import { JoinForm } from "@/components/student/JoinForm";

export default function HomePage() {
  return (
    <main className="flex min-h-[100dvh] flex-col justify-center bg-feed-bg px-6">
      <div className="mx-auto w-full max-w-sm">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-feed-accent">
          CLASSROOM SESSION
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight">THE FEED</h1>
        <p className="mt-4 text-sm leading-relaxed text-feed-muted">
          Enter the room code. Pick a username. Start posting.
        </p>
        <div className="mt-10">
          <JoinForm />
        </div>
      </div>
    </main>
  );
}
