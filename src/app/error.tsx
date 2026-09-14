"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-feed-bg px-6 text-center">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-feed-accent">
        THE FEED
      </p>
      <h1 className="mt-3 max-w-sm text-3xl font-semibold tracking-tight">
        This room hiccuped.
      </h1>
      <p className="mt-3 max-w-sm text-sm text-feed-muted">
        Reload to get back into the session.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-8 rounded-full bg-feed-accent px-5 py-2.5 text-sm font-semibold text-white"
      >
        Reload
      </button>
    </main>
  );
}
