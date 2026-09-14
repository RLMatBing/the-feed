"use server";

import {
  readParticipantCookies,
  setParticipantCookies,
} from "@/lib/auth";
import { studentSnapshot } from "@/lib/snapshot";
import {
  createGroup,
  createPost,
  createProposal,
  getParticipantByToken,
  getSessionByCode,
  joinGroup,
  joinSession,
  studentBroadcast,
  toggleLike,
  boostPost,
  pinPost,
  voteProposal,
} from "@/lib/store";
import type { ProposalEffect, StudentSnapshot, Vote } from "@/lib/types";

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

export async function actionCreatePost(formData: FormData): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await createPost({
      sessionId: you.sessionId,
      authorId: you.id,
      body: String(formData.get("body") ?? ""),
      parentId: optional(formData.get("parentId")),
      groupId: optional(formData.get("groupId")),
    });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not post." };
  }
}

export async function actionLike(postId: string): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await toggleLike(you.sessionId, you.id, postId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not like." };
  }
}

export async function actionBoost(postId: string): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await boostPost(you.sessionId, you.id, postId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not boost." };
  }
}

export async function actionPin(postId: string): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await pinPost(you.sessionId, you.id, postId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not pin." };
  }
}

export async function actionBroadcast(body: string): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await studentBroadcast(you.sessionId, you.id, body);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not broadcast." };
  }
}

export async function actionCreateGroup(name: string): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await createGroup(you.sessionId, you.id, name);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create group." };
  }
}

export async function actionJoinGroup(groupId: string): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await joinGroup(you.sessionId, you.id, groupId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not join." };
  }
}

export async function actionPropose(input: {
  title: string;
  body: string;
  effect: ProposalEffect;
}): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await createProposal({
      sessionId: you.sessionId,
      authorId: you.id,
      title: input.title,
      body: input.body,
      effect: input.effect,
    });
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not propose." };
  }
}

export async function actionVote(
  proposalId: string,
  vote: Vote,
): Promise<{ error?: string }> {
  try {
    const you = await actor();
    await voteProposal(you.sessionId, you.id, proposalId, vote);
    return {};
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
