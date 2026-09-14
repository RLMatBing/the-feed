import { readParticipantCookies } from "@/lib/auth";
import { isGiphyMediaUrl } from "@/lib/giphy-url";

export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

async function fetchAllowlisted(url: string): Promise<Response | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    if (!isGiphyMediaUrl(current)) return null;
    const response = await fetch(current, {
      redirect: "manual",
      cache: "force-cache",
      headers: { Accept: "image/*" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    return response.ok ? response : null;
  }
  return null;
}

export async function GET(request: Request) {
  const { sessionId, token } = await readParticipantCookies();
  if (!sessionId || !token) {
    return new Response("Join a room first.", { status: 401 });
  }

  const raw = new URL(request.url).searchParams.get("u") ?? "";
  if (!isGiphyMediaUrl(raw)) {
    return new Response("Not found", { status: 404 });
  }

  const upstream = await fetchAllowlisted(raw);
  if (!upstream) {
    return new Response("Not found", { status: 404 });
  }

  const type = upstream.headers.get("content-type") ?? "image/gif";
  if (!type.startsWith("image/")) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Buffer.from(await upstream.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(bytes, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
