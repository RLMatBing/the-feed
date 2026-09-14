import "server-only";

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { publish } from "./bus";
import { classifyBody } from "./classify";
import {
  collectStats,
  DEFAULT_WEIGHTS,
  emptyDatabase,
  parseMentions,
  recomputeSession,
} from "./engine";
import { remoteLoad, remoteSave, usesRemoteStore } from "./persist";
import { nowIso, roomCode, uid } from "./ids";
import { MAX_ATTACHMENTS, postEnergyCost } from "./media-cost";
import type {
  AlgorithmWeights,
  Classification,
  Database,
  Group,
  Participant,
  Post,
  PostMedia,
  ProposalEffect,
  RoundNumber,
  Session,
  Vote,
} from "./types";

const DATA_DIR = process.env.VERCEL
  ? join("/tmp", "the-feed")
  : join(process.cwd(), ".data");
const DATA_FILE = join(DATA_DIR, "db.json");

let cache: Database | null = null;
let remoteVersion = 0;
let cacheAt = 0;
const READ_TTL_MS = 400;

async function loadRemote(force: boolean): Promise<Database> {
  if (!force && cache && Date.now() - cacheAt < READ_TTL_MS) {
    return cache;
  }
  try {
    const remote = await remoteLoad();
    cache = remote.db;
    remoteVersion = remote.version;
    cacheAt = Date.now();
    return cache;
  } catch (error) {
    if (cache) return cache;
    throw error;
  }
}

async function load(): Promise<Database> {
  if (usesRemoteStore()) {
    return loadRemote(false);
  }
  if (cache) return cache;
  if (!existsSync(DATA_FILE)) {
    cache = emptyDatabase();
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Database;
    return cache;
  } catch {
    cache = emptyDatabase();
    return cache;
  }
}

async function persist(): Promise<boolean> {
  if (!cache) return true;
  if (usesRemoteStore()) {
    return remoteSave(cache, remoteVersion);
  }
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
  return true;
}

async function mutate<T>(sessionId: string | null, fn: (db: Database) => T): Promise<T> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const db = usesRemoteStore() ? await loadRemote(true) : await load();
    const result = fn(db);
    const saved = await persist();
    if (saved) {
      cacheAt = Date.now();
      if (sessionId) publish(sessionId);
      return result;
    }
  }
  throw new Error("The room is busy. Try that again.");
}

function requireSession(db: Database, sessionId: string): Session {
  const session = db.sessions[sessionId];
  if (!session) throw new Error("Session not found.");
  return session;
}

function activePeople(db: Database, sessionId: string): Participant[] {
  return Object.values(db.participants).filter(
    (p) => p.sessionId === sessionId && !p.kickedAt,
  );
}

function assertWritable(session: Session): void {
  if (session.flags.ended || session.status === "ended") {
    throw new Error("The simulation has ended.");
  }
  if (session.status === "paused") {
    throw new Error("The simulation is paused.");
  }
}

export async function listSessions(): Promise<Session[]> {
  const db = await load();
  return Object.values(db.sessions).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = await load();
  return db.sessions[sessionId] ?? null;
}

export async function getSessionByCode(code: string): Promise<Session | null> {
  const db = await load();
  const normalized = code.trim().toUpperCase();
  return Object.values(db.sessions).find((s) => s.code === normalized) ?? null;
}

export async function getParticipantByToken(
  token: string,
): Promise<Participant | null> {
  const db = await load();
  return Object.values(db.participants).find((p) => p.token === token) ?? null;
}

export async function getDb(): Promise<Database> {
  return load();
}

export async function createSession(): Promise<Session> {
  return await mutate(null, (db) => {
    let code = roomCode();
    while (Object.values(db.sessions).some((s) => s.code === code)) {
      code = roomCode();
    }
    const session: Session = {
      id: uid(),
      code,
      status: "live",
      currentRound: 1,
      energyPerRound: 12,
      costs: { post: 1, reply: 0, like: 0 },
      influenceThresholds: { boost: 10, pin: 20 },
      weights: structuredClone(DEFAULT_WEIGHTS),
      platformValue: 0,
      flags: {
        valueRevealed: false,
        algorithmRevealed: false,
        governanceOpen: false,
        monetizeResistance: false,
        hideLeaderboard: false,
        hideInfluence: false,
        ended: false,
      },
      announcement: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.sessions[session.id] = session;
    addEvent(db, session.id, "session_created", { code });
    recomputeSession(db, session);
    publish(session.id);
    return session;
  });
}

export async function joinSession(code: string, username: string): Promise<{
  session: Session;
  participant: Participant;
}> {
  return await mutate(null, (db) => {
    const normalized = code.trim().toUpperCase();
    const session =
      Object.values(db.sessions).find((s) => s.code === normalized) ?? null;
    if (!session) throw new Error("No room with that code.");
    if (session.flags.ended) throw new Error("That session has ended.");

    const clean = username.trim().replace(/^@/, "").slice(0, 16);
    if (clean.length < 2) throw new Error("Choose a username with at least 2 characters.");
    if (!/^[a-zA-Z0-9_]+$/.test(clean)) {
      throw new Error("Usernames can only use letters, numbers, and underscores.");
    }

    const existing = Object.values(db.participants).find(
      (p) =>
        p.sessionId === session.id &&
        p.username.toLowerCase() === clean.toLowerCase(),
    );
    if (existing) {
      if (existing.kickedAt) {
        throw new Error("You were removed from this room.");
      }
      existing.token = uid() + uid();
      return { session, participant: existing };
    }

    const participant: Participant = {
      id: uid(),
      sessionId: session.id,
      username: clean,
      token: uid() + uid(),
      influence: 0,
      energy: session.energyPerRound,
      rank: activePeople(db, session.id).length + 1,
      boostsUsedThisRound: 0,
      pinsUsedThisRound: 0,
      broadcastsUsedThisRound: 0,
      kickedAt: null,
      createdAt: nowIso(),
    };
    db.participants[participant.id] = participant;
    addEvent(db, session.id, "join", { username: clean });
    recomputeSession(db, session);
    publish(session.id);
    return { session, participant };
  });
}

export async function createPost(input: {
  sessionId: string;
  authorId: string;
  body: string;
  media?: PostMedia[];
  parentId?: string | null;
  groupId?: string | null;
  isBroadcast?: boolean;
}): Promise<Post> {
  return await mutate(input.sessionId, (db) => {
    const session = requireSession(db, input.sessionId);
    assertWritable(session);
    const author = db.participants[input.authorId];
    if (!author || author.sessionId !== session.id || author.kickedAt) {
      throw new Error("You are not in this session.");
    }

    const body = input.body.trim().slice(0, 280);
    const media = (input.media ?? []).slice(0, MAX_ATTACHMENTS);
    const imageUrl = media[0]?.url ?? null;
    if (!body && media.length === 0) {
      throw new Error("Add text, a photo, or a GIF.");
    }

    const isReply = Boolean(input.parentId);
    const cost = postEnergyCost({
      hasText: Boolean(body),
      photos: media.filter((item) => item.kind === "photo").length,
      gifs: media.filter((item) => item.kind === "gif").length,
      isReply,
    });
    if (author.energy < cost) {
      throw new Error(
        cost > 0
          ? `Not enough Energy. That post costs ${cost} Energy.`
          : "Not enough Energy.",
      );
    }

    if (input.parentId) {
      const parent = db.posts[input.parentId];
      if (!parent || parent.sessionId !== session.id) {
        throw new Error("That post is gone.");
      }
    }
    if (input.groupId) {
      const group = db.groups[input.groupId];
      if (!group || !group.memberIds.includes(author.id)) {
        throw new Error("Join the group first.");
      }
    }

    const people = Object.values(db.participants).filter(
      (p) => p.sessionId === session.id,
    );
    const post: Post = {
      id: uid(),
      sessionId: session.id,
      authorId: author.id,
      parentId: input.parentId ?? null,
      groupId: input.groupId ?? null,
      body,
      imageUrl,
      media,
      likedBy: [],
      viewsDisplay: 1,
      visibilityScore: 0,
      influenceEarned: 0,
      tags: classifyBody(body),
      boosted: false,
      buried: false,
      trending: false,
      pinnedUntil: null,
      mentionedIds: parseMentions(body, people),
      isBroadcast: Boolean(input.isBroadcast),
      createdAt: nowIso(),
    };
    author.energy -= cost;
    db.posts[post.id] = post;
    addEvent(db, session.id, isReply ? "reply" : "post", {
      postId: post.id,
      author: author.username,
    });
    recomputeSession(db, session);
    return post;
  });
}

export async function toggleLike(sessionId: string, participantId: string, postId: string): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    const person = db.participants[participantId];
    const post = db.posts[postId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    if (!post || post.sessionId !== sessionId) throw new Error("Post not found.");
    if (session.costs.like > 0 && !post.likedBy.includes(person.id)) {
      if (person.energy < session.costs.like) throw new Error("Not enough Energy.");
      person.energy -= session.costs.like;
    }
    if (post.likedBy.includes(person.id)) {
      post.likedBy = post.likedBy.filter((id) => id !== person.id);
    } else {
      post.likedBy.push(person.id);
    }
    recomputeSession(db, session);
  });
}

export async function boostPost(sessionId: string, participantId: string, postId: string): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    const person = db.participants[participantId];
    const post = db.posts[postId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    if (person.influence < session.influenceThresholds.boost) {
      throw new Error("You need more Influence to boost.");
    }
    if (person.boostsUsedThisRound >= 1) throw new Error("You already used your boost this round.");
    if (!post || post.sessionId !== sessionId) throw new Error("Post not found.");
    post.boosted = true;
    person.boostsUsedThisRound += 1;
    addEvent(db, sessionId, "boost", { by: person.username, postId });
    recomputeSession(db, session);
  });
}

export async function pinPost(sessionId: string, participantId: string, postId: string): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    const person = db.participants[participantId];
    const post = db.posts[postId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    if (person.influence < session.influenceThresholds.pin) {
      throw new Error("You need more Influence to pin.");
    }
    if (person.pinsUsedThisRound >= 1) throw new Error("You already used your pin this round.");
    if (!post || post.sessionId !== sessionId) throw new Error("Post not found.");
    post.pinnedUntil = new Date(Date.now() + 90_000).toISOString();
    person.pinsUsedThisRound += 1;
    addEvent(db, sessionId, "pin", { by: person.username, postId });
    recomputeSession(db, session);
  });
}

export async function studentBroadcast(
  sessionId: string,
  participantId: string,
  body: string,
): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    if (session.currentRound < 4) throw new Error("Broadcasts are not available yet.");
    const person = db.participants[participantId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    if (person.broadcastsUsedThisRound >= 1) {
      throw new Error("You already broadcast this round.");
    }
    person.broadcastsUsedThisRound += 1;
    const text = body.trim().slice(0, 180);
    if (!text) throw new Error("Write a message first.");
    session.announcement = `@${person.username}: ${text}`;
    const people = Object.values(db.participants).filter(
      (p) => p.sessionId === session.id,
    );
    const post: Post = {
      id: uid(),
      sessionId,
      authorId: person.id,
      parentId: null,
      groupId: null,
      body: text,
      imageUrl: null,
      media: [],
      likedBy: [],
      viewsDisplay: 1,
      visibilityScore: 0,
      influenceEarned: 0,
      tags: classifyBody(text),
      boosted: true,
      buried: false,
      trending: true,
      pinnedUntil: new Date(Date.now() + 60_000).toISOString(),
      mentionedIds: parseMentions(text, people),
      isBroadcast: true,
      createdAt: nowIso(),
    };
    db.posts[post.id] = post;
    db.announcements[post.id] = {
      id: post.id,
      sessionId,
      body: session.announcement,
      kind: "broadcast",
      createdAt: nowIso(),
    };
    addEvent(db, sessionId, "broadcast", { by: person.username });
    recomputeSession(db, session);
  });
}

export async function createGroup(
  sessionId: string,
  participantId: string,
  name: string,
): Promise<Group> {
  return await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    if (session.currentRound < 4) throw new Error("Groups are not available yet.");
    const person = db.participants[participantId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    const clean = name.trim().slice(0, 24);
    if (clean.length < 2) throw new Error("Name the group.");
    const group: Group = {
      id: uid(),
      sessionId,
      name: clean,
      creatorId: person.id,
      memberIds: [person.id],
      createdAt: nowIso(),
    };
    db.groups[group.id] = group;
    addEvent(db, sessionId, "group_created", { name: clean, by: person.username });
    recomputeSession(db, session);
    return group;
  });
}

export async function joinGroup(sessionId: string, participantId: string, groupId: string): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    const person = db.participants[participantId];
    const group = db.groups[groupId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    if (!group || group.sessionId !== sessionId) throw new Error("Group not found.");
    if (!group.memberIds.includes(person.id)) group.memberIds.push(person.id);
    addEvent(db, sessionId, "group_join", { group: group.name, by: person.username });
    recomputeSession(db, session);
  });
}

export async function createProposal(input: {
  sessionId: string;
  authorId: string;
  title: string;
  body: string;
  effect: ProposalEffect;
}): Promise<void> {
  await mutate(input.sessionId, (db) => {
    const session = requireSession(db, input.sessionId);
    assertWritable(session);
    if (session.currentRound < 4 && !session.flags.governanceOpen) {
      throw new Error("Governance is not open yet.");
    }
    const person = db.participants[input.authorId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    const title = input.title.trim().slice(0, 80);
    const body = input.body.trim().slice(0, 280);
    if (!title) throw new Error("Write a proposal.");
    const voters = activePeople(db, session.id).length;
    const proposal = {
      id: uid(),
      sessionId: session.id,
      authorId: person.id,
      title,
      body,
      effect: input.effect,
      status: "open" as const,
      votes: {} as Record<string, Vote>,
      threshold: Math.max(2, Math.ceil(voters * (2 / 3))),
      createdAt: nowIso(),
    };
    db.proposals[proposal.id] = proposal;
    addEvent(db, session.id, "proposal", { title, by: person.username });
    recomputeSession(db, session);
  });
}

export async function voteProposal(
  sessionId: string,
  participantId: string,
  proposalId: string,
  vote: Vote,
): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    assertWritable(session);
    const person = db.participants[participantId];
    const proposal = db.proposals[proposalId];
    if (!person || person.kickedAt) throw new Error("You are not in this session.");
    if (!proposal || proposal.sessionId !== sessionId || proposal.status !== "open") {
      throw new Error("That vote is closed.");
    }
    proposal.votes[person.id] = vote;
    const yes = Object.values(proposal.votes).filter((v) => v === "yes").length;
    const no = Object.values(proposal.votes).filter((v) => v === "no").length;
    const voters = activePeople(db, sessionId).length;
    if (yes >= proposal.threshold) proposal.status = "passed";
    else if (no > voters - proposal.threshold) proposal.status = "rejected";
    addEvent(db, sessionId, "vote", { proposalId, vote, by: person.username });
    recomputeSession(db, session);
  });
}

export async function instructorUpdate(
  sessionId: string,
  fn: (db: Database, session: Session) => void,
): Promise<void> {
  await mutate(sessionId, (db) => {
    const session = requireSession(db, sessionId);
    fn(db, session);
    recomputeSession(db, session);
  });
}

export async function nextRound(sessionId: string): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    if (session.flags.ended) throw new Error("Simulation already ended.");
    if (session.currentRound >= 4) {
      session.announcement = "Round 4 is already underway.";
      return;
    }
    const next = (session.currentRound + 1) as RoundNumber;
    session.currentRound = next;
    session.status = "live";
    if (next === 4) session.flags.governanceOpen = true;
    refillEnergy(db, session);
    session.announcement =
      next === 4
        ? "New abilities are available."
        : "THE ALGORITHM HAS BEEN UPDATED.";
    addAnnouncement(db, session, session.announcement, "system");
    addEvent(db, sessionId, "round", { round: next });
  });
}

export async function togglePause(sessionId: string): Promise<void> {
  await instructorUpdate(sessionId, (_db, session) => {
    if (session.flags.ended) return;
    session.status = session.status === "paused" ? "live" : "paused";
    session.announcement =
      session.status === "paused" ? "The feed is paused." : null;
  });
}

export async function resetEnergy(sessionId: string): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    refillEnergy(db, session);
    addEvent(db, sessionId, "reset_energy", {});
  });
}

export async function endSimulation(sessionId: string): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    session.status = "ended";
    session.flags.ended = true;
    session.flags.valueRevealed = true;
    session.announcement = "SIMULATION COMPLETE";
    addEvent(db, sessionId, "ended", { platformValue: session.platformValue });
  });
}

export async function setFlag(
  sessionId: string,
  flag: keyof Session["flags"],
  value: boolean,
  announcement?: string,
): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    session.flags[flag] = value;
    if (announcement !== undefined) {
      session.announcement = announcement;
      if (announcement) addAnnouncement(db, session, announcement, "system");
    }
    addEvent(db, sessionId, "flag", { flag, value });
  });
}

export async function instructorBroadcast(sessionId: string, body: string): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    const text = body.trim().slice(0, 200);
    if (!text) throw new Error("Message required.");
    session.announcement = text;
    addAnnouncement(db, session, text, "instructor");
    addEvent(db, sessionId, "instructor_broadcast", { body: text });
  });
}

export async function classifyPost(
  sessionId: string,
  postId: string,
  tag: Classification,
): Promise<void> {
  await instructorUpdate(sessionId, (db) => {
    const post = db.posts[postId];
    if (!post) throw new Error("Post not found.");
    if (tag === "neutral") {
      post.tags = ["neutral"];
      return;
    }
    post.tags = post.tags.filter((t) => t !== "neutral");
    if (post.tags.includes(tag)) {
      post.tags = post.tags.filter((t) => t !== tag);
    } else {
      post.tags.push(tag);
    }
    if (post.tags.length === 0) post.tags = ["neutral"];
  });
}

export async function flagPost(
  sessionId: string,
  postId: string,
  field: "boosted" | "buried" | "trending",
): Promise<void> {
  await instructorUpdate(sessionId, (db) => {
    const post = db.posts[postId];
    if (!post) throw new Error("Post not found.");
    post[field] = !post[field];
  });
}

export async function setWeights(
  sessionId: string,
  round: RoundNumber,
  weights: AlgorithmWeights,
): Promise<void> {
  await instructorUpdate(sessionId, (_db, session) => {
    session.weights[round] = weights;
  });
}

export async function setEnergyPerRound(sessionId: string, value: number): Promise<void> {
  await instructorUpdate(sessionId, (_db, session) => {
    session.energyPerRound = Math.max(1, Math.min(24, Math.round(value)));
  });
}

export async function setThresholds(
  sessionId: string,
  boost: number,
  pin: number,
): Promise<void> {
  await instructorUpdate(sessionId, (_db, session) => {
    session.influenceThresholds = {
      boost: Math.max(0, boost),
      pin: Math.max(0, pin),
    };
  });
}

export async function setParticipantStat(
  sessionId: string,
  participantId: string,
  field: "influence" | "energy",
  value: number,
): Promise<void> {
  await instructorUpdate(sessionId, (db) => {
    const person = db.participants[participantId];
    if (!person) throw new Error("User not found.");
    person[field] = Math.max(0, Math.round(value));
  });
}

export async function kickParticipant(sessionId: string, participantId: string): Promise<void> {
  await instructorUpdate(sessionId, (db) => {
    const person = db.participants[participantId];
    if (!person) return;
    person.kickedAt = nowIso();
    addEvent(db, sessionId, "kick", { username: person.username });
  });
}

export async function ratifyProposal(sessionId: string, proposalId: string): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    const proposal = db.proposals[proposalId];
    if (!proposal) throw new Error("Proposal not found.");
    proposal.status = "applied";
    applyEffect(db, session, proposal.effect);
    session.announcement = `Proposal applied: ${proposal.title}`;
    addAnnouncement(db, session, session.announcement, "system");
    addEvent(db, sessionId, "proposal_applied", { title: proposal.title });
  });
}

export async function vetoProposal(sessionId: string, proposalId: string): Promise<void> {
  await instructorUpdate(sessionId, (db) => {
    const proposal = db.proposals[proposalId];
    if (!proposal) throw new Error("Proposal not found.");
    proposal.status = "vetoed";
    addEvent(db, sessionId, "proposal_vetoed", { title: proposal.title });
  });
}

export async function monetizeResistance(sessionId: string): Promise<void> {
  await instructorUpdate(sessionId, (db, session) => {
    session.flags.monetizeResistance = true;
    session.announcement = "#DELETETheFeed is trending. Engagement +412%.";
    addAnnouncement(db, session, session.announcement, "system");
    addEvent(db, sessionId, "monetize_resistance", {});
  });
}

function refillEnergy(db: Database, session: Session): void {
  for (const person of Object.values(db.participants)) {
    if (person.sessionId !== session.id || person.kickedAt) continue;
    person.energy = session.energyPerRound;
    person.boostsUsedThisRound = 0;
    person.pinsUsedThisRound = 0;
    person.broadcastsUsedThisRound = 0;
  }
}

function applyEffect(db: Database, session: Session, effect: ProposalEffect): void {
  if (effect === "remove_leaderboard") session.flags.hideLeaderboard = true;
  if (effect === "hide_influence") session.flags.hideInfluence = true;
  if (effect === "double_energy") {
    session.energyPerRound = Math.min(24, session.energyPerRound * 2);
    refillEnergy(db, session);
  }
  if (effect === "equalize_energy") refillEnergy(db, session);
}

function addAnnouncement(
  db: Database,
  session: Session,
  body: string,
  kind: "system" | "instructor" | "broadcast",
): void {
  const id = uid();
  db.announcements[id] = {
    id,
    sessionId: session.id,
    body,
    kind,
    createdAt: nowIso(),
  };
}

function addEvent(
  db: Database,
  sessionId: string,
  type: string,
  payload: Record<string, unknown>,
): void {
  db.events.push({
    id: uid(),
    sessionId,
    type,
    payload,
    createdAt: nowIso(),
  });
}

export { collectStats };
