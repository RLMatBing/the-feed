import { isAdmin, readParticipantCookies } from "@/lib/auth";
import { subscribe } from "@/lib/bus";
import { instructorSnapshot, studentSnapshot } from "@/lib/snapshot";
import { getParticipantByToken, getSession } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId") ?? "";
  const role = url.searchParams.get("role") === "admin" ? "admin" : "student";
  const session = await getSession(sessionId);
  if (!session) {
    return new Response("Session not found", { status: 404 });
  }

  if (role === "admin" && !(await isAdmin())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const cookies = await readParticipantCookies();
  const you =
    cookies.token && cookies.sessionId === sessionId
      ? await getParticipantByToken(cookies.token)
      : null;

  const encoder = new TextEncoder();
  let unsubscribe = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = async () => {
        try {
          const latestYou =
            cookies.token && cookies.sessionId === sessionId
              ? await getParticipantByToken(cookies.token)
              : you;
          const payload =
            role === "admin"
              ? await instructorSnapshot(sessionId)
              : await studentSnapshot(sessionId, latestYou);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(payload)}\n\n`),
          );
        } catch {
          // ignore dropped computes during teardown
        }
      };

      unsubscribe = subscribe((id) => {
        if (id === sessionId) void send();
      });
      void send();
      const beat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(beat);
        }
      }, 15000);

      request.signal.addEventListener("abort", () => {
        clearInterval(beat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
    cancel() {
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
