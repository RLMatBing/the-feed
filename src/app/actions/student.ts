"use server";

import {
  readParticipantCookies,
  setParticipantCookies,
} from "@/lib/auth";
import { resolveGiphy } from "@/lib/giphy";
import { storePostImage } from "@/lib/media";
import {
  kindFromFile,
  MAX_ATTACHMENTS,
  postEnergyCost,
} from "@/lib/media-cost";
import { studentSnapshot } from "@/lib/snapshot";
import {
  createGroup,
  createPost,
  createProposal,
  getParticipantByToken,
  getSession,
  getSessionByCode,
  joinGroup,
  joinSession,
  studentBroadcast,
  toggleLike,
  boostPost,
  pinPost,
  voteProposal,
} from "@/lib/store";
import type { PostMedia, ProposalEffect, StudentSnapshot, Vote } from "@/lib/types";

type StudentResult = { error?: string; state?: StudentSnapshot };

async function actor() {
  const { sessionId, token } = await readParticipantCookies();
  if (!sessionId || !token) throw new Error("Join a room first.");
  const participant = await getParticipantByToken(token);
  if (!participant || participant.sessionId !== sessionId) {
    throw new Error("Your session expired. Join again.");
  }
  if (participant.kickedAt) throw new Error("You were removed from this room.");
  return participant;
}

async function snapshotOf(sessionId: string, token: string): Promise<StudentSnapshot> {
  const you = await getParticipantByToken(token);
  return studentSnapshot(sessionId, you);
}

export async function actionJoin(
  code: string,
  username: string,
): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
  try {
    const { session, participant } = await joinSession(code, username);
    await setParticipantCookies(session.id, participant.token);
    return { ok: true, code: session.code };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not join." };
  }
}

export async function actionCreatePost(formData: FormData): Promise<StudentResult> {
  try {
    const you = await actor();
    const body = String(formData.get("body") ?? "");
    const files = formData
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0);
    const giphyIds = formData
      .getAll("giphyIds")
      .map((value) => String(value).trim())
      .filter(Boolean);

    if (files.length + giphyIds.length > MAX_ATTACHMENTS) {
      throw new Error(`You can attach up to ${MAX_ATTACHMENTS} images.`);
    }

    const planned: PostMedia[] = [
      ...files.map((file) => ({
        url: "",
        kind: kindFromFile(file),
      })),
      ...giphyIds.map(() => ({ url: "", kind: "gif" as const })),
    ];
    const session = await getSession(you.sessionId);
    if (!session) throw new Error("Session not found.");
    const cost = postEnergyCost({
      hasText: Boolean(body.trim()),
      photos: planned.filter((item) => item.kind === "photo").length,
      gifs: planned.filter((item) => item.kind === "gif").length,
      isReply: Boolean(optional(formData.get("parentId"))),
    });
    if (you.energy < cost) {
      throw new Error(`Not enough Energy. That post costs ${cost} Energy.`);
    }

    const media: PostMedia[] = [];
    for (const file of files) {
      media.push({
        url: await storePostImage(file),
        kind: kindFromFile(file),
      });
    }
    for (const id of giphyIds) {
      media.push({
        url: await resolveGiphy(id),
        kind: "gif",
      });
    }

    await createPost({
      sessionId: you.sessionId,
      authorId: you.id,
      body,
      media,
      parentId: optional(formData.get("parentId")),
      groupId: optional(formData.get("groupId")),
    });
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not post." };
  }
}

export async function actionLike(postId: string): Promise<StudentResult> {
  try {
    const you = await actor();
    await toggleLike(you.sessionId, you.id, postId);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not like." };
  }
}

export async function actionBoost(postId: string): Promise<StudentResult> {
  try {
    const you = await actor();
    await boostPost(you.sessionId, you.id, postId);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not boost." };
  }
}

export async function actionPin(postId: string): Promise<StudentResult> {
  try {
    const you = await actor();
    await pinPost(you.sessionId, you.id, postId);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not pin." };
  }
}

export async function actionBroadcast(body: string): Promise<StudentResult> {
  try {
    const you = await actor();
    await studentBroadcast(you.sessionId, you.id, body);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not broadcast." };
  }
}

export async function actionCreateGroup(name: string): Promise<StudentResult> {
  try {
    const you = await actor();
    await createGroup(you.sessionId, you.id, name);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create group." };
  }
}

export async function actionJoinGroup(groupId: string): Promise<StudentResult> {
  try {
    const you = await actor();
    await joinGroup(you.sessionId, you.id, groupId);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not join." };
  }
}

export async function actionPropose(input: {
  title: string;
  body: string;
  effect: ProposalEffect;
}): Promise<StudentResult> {
  try {
    const you = await actor();
    await createProposal({
      sessionId: you.sessionId,
      authorId: you.id,
      title: input.title,
      body: input.body,
      effect: input.effect,
    });
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not propose." };
  }
}

export async function actionVote(
  proposalId: string,
  vote: Vote,
): Promise<StudentResult> {
  try {
    const you = await actor();
    await voteProposal(you.sessionId, you.id, proposalId, vote);
    return { state: await snapshotOf(you.sessionId, you.token) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not vote." };
  }
}

export async function loadStudentState(code: string): Promise<StudentSnapshot | null> {
  const session = await getSessionByCode(code);
  if (!session) return null;
  const { token, sessionId } = await readParticipantCookies();
  const you =
    token && sessionId === session.id
      ? await getParticipantByToken(token)
      : null;
  return studentSnapshot(session.id, you);
}

function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text ? text : null;
}
