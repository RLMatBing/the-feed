import { readParticipantCookies } from "@/lib/auth";
import { giphyConfigured, searchGiphy } from "@/lib/giphy";
import { proxiedMediaUrl } from "@/lib/giphy-url";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!giphyConfigured()) {
    return Response.json({ error: "Giphy is not configured." }, { status: 503 });
  }

  const { sessionId, token } = await readParticipantCookies();
  if (!sessionId || !token) {
    return Response.json({ error: "Join a room first." }, { status: 401 });
  }

  const q = new URL(request.url).searchParams.get("q") ?? "";
  try {
    const gifs = (await searchGiphy(q)).map((gif) => ({
      ...gif,
      preview: proxiedMediaUrl(gif.preview),
    }));
    return Response.json({ gifs });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Could not search GIFs." },
      { status: 502 },
    );
  }
}
