import { readParticipantCookies } from "@/lib/auth";
import { getParticipantByToken } from "@/lib/store";
import type { Participant } from "@/lib/types";

export async function joinedParticipant(): Promise<Participant | null> {
  const { sessionId, token } = await readParticipantCookies();
  if (!sessionId || !token) return null;
  const you = await getParticipantByToken(token);
  if (!you || you.sessionId !== sessionId || you.kickedAt) return null;
  return you;
}
