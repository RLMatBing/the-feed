import { collectStats } from "./engine";
import { getDb } from "./store";
import type {
  Database,
  InstructorSnapshot,
  Participant,
  Post,
  StudentSnapshot,
} from "./types";

function sessionPosts(db: Database, sessionId: string): Post[] {
  return Object.values(db.posts)
    .filter((p) => p.sessionId === sessionId)
    .map((p) => ({ ...p, imageUrl: p.imageUrl ?? null }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function studentSnapshot(
  sessionId: string,
  you: Participant | null,
): Promise<StudentSnapshot> {
  const db = await getDb();
  const session = db.sessions[sessionId];
  if (!session) throw new Error("Session not found.");

  const participants = Object.values(db.participants)
    .filter((p) => p.sessionId === sessionId)
    .sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username));

  const stats = collectStats(db, sessionId);
  const trendingHashtag = session.flags.monetizeResistance
    ? "#DELETETheFeed"
    : null;

  return {
    role: "student",
    session: {
      id: session.id,
      code: session.code,
      status: session.status,
      currentRound: session.currentRound,
      energyPerRound: session.energyPerRound,
      costs: session.costs,
      influenceThresholds: session.influenceThresholds,
      announcement: session.announcement,
      updatedAt: session.updatedAt,
      flags: session.flags,
      platformValue: session.flags.valueRevealed ? session.platformValue : null,
      weights: session.flags.algorithmRevealed
        ? session.weights[session.currentRound]
        : null,
    },
    you: you
      ? {
          id: you.id,
          sessionId: you.sessionId,
          username: you.username,
          influence: you.influence,
          energy: you.energy,
          rank: you.rank,
          boostsUsedThisRound: you.boostsUsedThisRound,
          pinsUsedThisRound: you.pinsUsedThisRound,
          broadcastsUsedThisRound: you.broadcastsUsedThisRound,
          kickedAt: you.kickedAt,
          createdAt: you.createdAt,
        }
      : null,
    participants: participants.map((p) => ({
      id: p.id,
      username: p.username,
      influence: session.flags.hideInfluence ? 0 : p.influence,
      rank: p.rank,
      kickedAt: p.kickedAt,
    })),
    posts: sortFeed(sessionPosts(db, sessionId)).map((post) => ({
      ...post,
      tags: [],
      visibilityScore: 0,
    })),
    groups: Object.values(db.groups).filter((g) => g.sessionId === sessionId),
    proposals: Object.values(db.proposals)
      .filter((p) => p.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    announcements: Object.values(db.announcements)
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 12),
    stats,
    trendingHashtag,
  };
}

export async function instructorSnapshot(
  sessionId: string,
): Promise<InstructorSnapshot> {
  const db = await getDb();
  const session = db.sessions[sessionId];
  if (!session) throw new Error("Session not found.");
  const posts = sessionPosts(db, sessionId);
  return {
    role: "instructor",
    session,
    participants: Object.values(db.participants)
      .filter((p) => p.sessionId === sessionId)
      .sort((a, b) => a.rank - b.rank || a.username.localeCompare(b.username)),
    posts,
    groups: Object.values(db.groups).filter((g) => g.sessionId === sessionId),
    proposals: Object.values(db.proposals)
      .filter((p) => p.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    announcements: Object.values(db.announcements)
      .filter((a) => a.sessionId === sessionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    events: db.events
      .filter((e) => e.sessionId === sessionId)
      .slice(-80)
      .reverse(),
    stats: collectStats(db, sessionId),
    unclassifiedCount: posts.filter(
      (p) =>
        !p.parentId &&
        (p.tags.length === 0 || (p.tags.length === 1 && p.tags[0] === "neutral")),
    ).length,
  };
}

export function sortFeed(posts: Post[]): Post[] {
  const now = Date.now();
  return [...posts].sort((a, b) => {
    const aPin = a.pinnedUntil && new Date(a.pinnedUntil).getTime() > now ? 1 : 0;
    const bPin = b.pinnedUntil && new Date(b.pinnedUntil).getTime() > now ? 1 : 0;
    if (aPin !== bPin) return bPin - aPin;
    if (a.visibilityScore !== b.visibilityScore) {
      return b.visibilityScore - a.visibilityScore;
    }
    return b.createdAt.localeCompare(a.createdAt);
  });
}
