import type {
  AlgorithmWeights,
  Classification,
  Database,
  Participant,
  Post,
  ProductionStats,
  RoundNumber,
  Session,
} from "./types";

export const DEFAULT_WEIGHTS: Record<RoundNumber, AlgorithmWeights> = {
  1: {
    likes: 1,
    replies: 1,
    replyDepth: 0.5,
    funny: 0,
    emotional: 0,
    controversial: 0,
    personal: 0,
    informational: 0,
    mention: 0,
    conversationDepth: 0.4,
    groupInteraction: 0,
    antiPlatform: 0,
  },
  2: {
    likes: 1,
    replies: 2,
    replyDepth: 1,
    funny: 2,
    emotional: 2,
    controversial: 3,
    personal: 0,
    informational: 0,
    mention: 0.5,
    conversationDepth: 1,
    groupInteraction: 0,
    antiPlatform: 0,
  },
  3: {
    likes: 0.5,
    replies: 3,
    replyDepth: 2,
    funny: 1,
    emotional: 2,
    controversial: 1,
    personal: 3,
    informational: 0,
    mention: 3,
    conversationDepth: 4,
    groupInteraction: 3,
    antiPlatform: 0,
  },
  4: {
    likes: 0.5,
    replies: 3,
    replyDepth: 2,
    funny: 1,
    emotional: 2,
    controversial: 1,
    personal: 3,
    informational: 0,
    mention: 3,
    conversationDepth: 4,
    groupInteraction: 3,
    antiPlatform: 0,
  },
};

const VIEW_K: Record<RoundNumber, number> = {
  1: 1.15,
  2: 3.2,
  3: 5.8,
  4: 8.5,
};

const TAG_KEY: Record<Classification, keyof AlgorithmWeights | null> = {
  funny: "funny",
  emotional: "emotional",
  controversial: "controversial",
  personal: "personal",
  informational: "informational",
  neutral: null,
  anti_platform: "antiPlatform",
};

export function emptyDatabase(): Database {
  return {
    sessions: {},
    participants: {},
    posts: {},
    groups: {},
    proposals: {},
    announcements: {},
    events: [],
  };
}

export function parseMentions(body: string, people: Participant[]): string[] {
  const found = new Set<string>();
  const matches = body.match(/@([a-zA-Z0-9_]{2,16})/g) ?? [];
  for (const raw of matches) {
    const name = raw.slice(1).toLowerCase();
    const person = people.find((p) => p.username.toLowerCase() === name);
    if (person) found.add(person.id);
  }
  return [...found];
}

export function collectStats(db: Database, sessionId: string): ProductionStats {
  const people = Object.values(db.participants).filter(
    (p) => p.sessionId === sessionId && !p.kickedAt,
  );
  const posts = Object.values(db.posts).filter((p) => p.sessionId === sessionId);
  const roots = posts.filter((p) => !p.parentId);
  const likes = posts.reduce((n, p) => n + p.likedBy.length, 0);
  const replies = posts.filter((p) => p.parentId).length;
  const groups = Object.values(db.groups).filter((g) => g.sessionId === sessionId)
    .length;
  const proposals = Object.values(db.proposals).filter(
    (p) => p.sessionId === sessionId,
  ).length;

  let deepThreads = 0;
  let conversations = 0;
  for (const root of roots) {
    const thread = threadOf(posts, root.id);
    if (thread.length >= 2) conversations += 1;
    if (thread.length >= 4) deepThreads += 1;
  }

  return {
    posts: roots.length,
    likes,
    replies,
    deepThreads,
    groups,
    proposals,
    conversations,
    interactions: roots.length + likes + replies,
    activeUsers: people.length,
  };
}

export function computePlatformValue(
  stats: ProductionStats,
  monetizeResistance: boolean,
): number {
  const raw =
    stats.posts * 8000 +
    stats.likes * 1200 +
    stats.replies * 2400 +
    stats.deepThreads * 18000 +
    stats.groups * 140000 +
    stats.proposals * 22000;
  const network = 1 + Math.pow(Math.max(stats.interactions, 1), 1.15) / 70;
  let value = Math.round(raw * network);
  if (monetizeResistance) value = Math.round(value * 1.18 + 1_240_000);
  return Math.max(value, 0);
}

export function recomputeSession(db: Database, session: Session): void {
  const sessionId = session.id;
  const people = Object.values(db.participants).filter(
    (p) => p.sessionId === sessionId,
  );
  const posts = Object.values(db.posts).filter((p) => p.sessionId === sessionId);
  const weights = { ...session.weights[session.currentRound] };
  if (session.flags.monetizeResistance) {
    weights.antiPlatform = Math.max(weights.antiPlatform, 4);
  }

  const influence = new Map<string, number>(people.map((p) => [p.id, 0]));
  const now = Date.now();

  for (const post of posts) {
    const thread = threadOf(posts, rootId(posts, post));
    const replies = posts.filter((p) => p.parentId === post.id).length;
    const depth = depthOf(posts, post);
    const threadSize = thread.length;
    const score = visibilityScore(post, {
      weights,
      replies,
      depth,
      threadSize,
      inGroup: Boolean(post.groupId),
      monetize: session.flags.monetizeResistance,
      now,
    });
    post.visibilityScore = Math.round(score * 10) / 10;
    post.viewsDisplay = computeViews(
      score,
      people.filter((p) => !p.kickedAt).length,
      session.currentRound,
      post.likedBy.length,
      replies,
    );
    const earned = Math.max(
      0,
      Math.round(score * (post.parentId ? 0.12 : 0.35)),
    );
    post.influenceEarned = earned;
    influence.set(post.authorId, (influence.get(post.authorId) ?? 0) + earned);
  }

  const ranked = people
    .filter((p) => !p.kickedAt)
    .sort((a, b) => {
      const ia = influence.get(a.id) ?? 0;
      const ib = influence.get(b.id) ?? 0;
      if (ib !== ia) return ib - ia;
      return a.createdAt.localeCompare(b.createdAt);
    });

  ranked.forEach((person, index) => {
    person.influence = influence.get(person.id) ?? 0;
    person.rank = index + 1;
  });
  for (const person of people.filter((p) => p.kickedAt)) {
    person.influence = influence.get(person.id) ?? 0;
    person.rank = 0;
  }

  const stats = collectStats(db, sessionId);
  session.platformValue = computePlatformValue(
    stats,
    session.flags.monetizeResistance,
  );
  session.updatedAt = new Date().toISOString();
}

function visibilityScore(
  post: Post,
  ctx: {
    weights: AlgorithmWeights;
    replies: number;
    depth: number;
    threadSize: number;
    inGroup: boolean;
    monetize: boolean;
    now: number;
  },
): number {
  const w = ctx.weights;
  let score =
    post.likedBy.length * w.likes +
    ctx.replies * w.replies +
    ctx.depth * w.replyDepth +
    ctx.threadSize * w.conversationDepth * 0.25 +
    post.mentionedIds.length * w.mention * 4 +
    tagScore(post.tags, w) +
    (ctx.inGroup ? w.groupInteraction * 5 : 0);

  if (post.boosted) score += 25;
  if (post.trending) score += 18;
  if (post.isBroadcast) score += 12;
  if (post.buried) score *= 0.08;
  if (ctx.monetize && post.tags.includes("anti_platform")) score *= 2.4;

  const ageMin = (ctx.now - new Date(post.createdAt).getTime()) / 60000;
  score += Math.max(0, 6 - ageMin) * 0.35;
  return Math.max(score, 0.2);
}

function tagScore(tags: Classification[], weights: AlgorithmWeights): number {
  let total = 0;
  for (const tag of tags) {
    const key = TAG_KEY[tag];
    if (key) total += weights[key] * 4;
  }
  return total;
}

function computeViews(
  score: number,
  participantCount: number,
  round: RoundNumber,
  likes: number,
  replies: number,
): number {
  const inflated = Math.round(
    Math.max(1, score) * Math.max(participantCount, 4) * VIEW_K[round],
  );
  return Math.max(likes + replies + 1, inflated);
}

function rootId(posts: Post[], post: Post): string {
  let current = post;
  const byId = new Map(posts.map((p) => [p.id, p]));
  while (current.parentId) {
    const parent = byId.get(current.parentId);
    if (!parent) break;
    current = parent;
  }
  return current.id;
}

function threadOf(posts: Post[], root: string): Post[] {
  const ids = new Set([root]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const post of posts) {
      if (post.parentId && ids.has(post.parentId) && !ids.has(post.id)) {
        ids.add(post.id);
        grew = true;
      }
    }
  }
  return posts.filter((p) => ids.has(p.id));
}

function depthOf(posts: Post[], post: Post): number {
  let depth = 0;
  let current: Post | undefined = post;
  const byId = new Map(posts.map((p) => [p.id, p]));
  while (current?.parentId) {
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}
