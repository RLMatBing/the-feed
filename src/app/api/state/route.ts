import { isAdmin, readParticipantCookies } from "@/lib/auth";
import { instructorSnapshot, studentSnapshot } from "@/lib/snapshot";
import { getParticipantByToken, getSession } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const role = url.searchParams.get("role") === "admin" ? "admin" : "student";
    const session = await getSession(sessionId);
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }
    if (role === "admin" && !(await isAdmin())) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const cookies = await readParticipantCookies();
    const you =
      cookies.token && cookies.sessionId === sessionId
        ? await getParticipantByToken(cookies.token)
        : null;

    const payload =
      role === "admin"
        ? await instructorSnapshot(sessionId)
        : await studentSnapshot(sessionId, you);

    return Response.json(payload);
  } catch {
    return Response.json({ error: "Room unavailable" }, { status: 503 });
  }
}
