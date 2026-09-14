"use server";

import {
  isAdmin,
  passwordsMatch,
  setAdminCookie,
} from "@/lib/auth";
import { instructorSnapshot } from "@/lib/snapshot";
import {
  classifyPost,
  createSession,
  endSimulation,
  flagPost,
  instructorBroadcast,
  kickParticipant,
  listSessions,
  monetizeResistance,
  nextRound,
  ratifyProposal,
  resetEnergy,
  setEnergyPerRound,
  setFlag,
  setParticipantStat,
  setThresholds,
  setWeights,
  togglePause,
  vetoProposal,
} from "@/lib/store";
import type {
  AlgorithmWeights,
  Classification,
  InstructorSnapshot,
  RoundNumber,
} from "@/lib/types";

async function guard(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Instructor login required.");
}

export async function actionInstructorLogin(
  password: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!passwordsMatch(password)) {
    return { ok: false, error: "Wrong password." };
  }
  await setAdminCookie();
  return { ok: true };
}

export async function actionCreateSession(): Promise<
  { ok: true; id: string; code: string } | { ok: false; error: string }
> {
  try {
    await guard();
    const session = await createSession();
    return { ok: true, id: session.id, code: session.code };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionNextRound(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await nextRound(sessionId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionTogglePause(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await togglePause(sessionId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionResetEnergy(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await resetEnergy(sessionId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionEnd(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await endSimulation(sessionId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionRevealValue(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await setFlag(sessionId, "valueRevealed", true);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionRevealAlgorithm(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await setFlag(sessionId, "algorithmRevealed", true);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionOpenGovernance(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await setFlag(sessionId, "governanceOpen", true, "Platform governance is open.");
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionMonetize(sessionId: string): Promise<{ error?: string }> {
  try {
    await guard();
    await monetizeResistance(sessionId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionBroadcastMessage(
  sessionId: string,
  body: string,
): Promise<{ error?: string }> {
  try {
    await guard();
    await instructorBroadcast(sessionId, body);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionClassify(
  sessionId: string,
  postId: string,
  tag: Classification,
): Promise<{ error?: string }> {
  try {
    await guard();
    await classifyPost(sessionId, postId, tag);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionFlagPost(
  sessionId: string,
  postId: string,
  field: "boosted" | "buried" | "trending",
): Promise<{ error?: string }> {
  try {
    await guard();
    await flagPost(sessionId, postId, field);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionSaveWeights(
  sessionId: string,
  round: RoundNumber,
  weights: AlgorithmWeights,
): Promise<{ error?: string }> {
  try {
    await guard();
    await setWeights(sessionId, round, weights);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionSaveEnergy(
  sessionId: string,
  value: number,
): Promise<{ error?: string }> {
  try {
    await guard();
    await setEnergyPerRound(sessionId, value);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionSaveThresholds(
  sessionId: string,
  boost: number,
  pin: number,
): Promise<{ error?: string }> {
  try {
    await guard();
    await setThresholds(sessionId, boost, pin);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionSetStat(
  sessionId: string,
  participantId: string,
  field: "influence" | "energy",
  value: number,
): Promise<{ error?: string }> {
  try {
    await guard();
    await setParticipantStat(sessionId, participantId, field, value);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionKick(
  sessionId: string,
  participantId: string,
): Promise<{ error?: string }> {
  try {
    await guard();
    await kickParticipant(sessionId, participantId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionRatify(
  sessionId: string,
  proposalId: string,
): Promise<{ error?: string }> {
  try {
    await guard();
    await ratifyProposal(sessionId, proposalId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function actionVeto(
  sessionId: string,
  proposalId: string,
): Promise<{ error?: string }> {
  try {
    await guard();
    await vetoProposal(sessionId, proposalId);
    return {};
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed." };
  }
}

export async function loadInstructorHome(): Promise<{
  authed: boolean;
  sessions: { id: string; code: string; status: string; currentRound: number }[];
}> {
  const authed = await isAdmin();
  if (!authed) return { authed: false, sessions: [] };
  return {
    authed: true,
    sessions: (await listSessions()).map((s) => ({
      id: s.id,
      code: s.code,
      status: s.status,
      currentRound: s.currentRound,
    })),
  };
}

export async function loadInstructorState(
  sessionId: string,
): Promise<InstructorSnapshot | null> {
  if (!(await isAdmin())) return null;
  try {
    return await instructorSnapshot(sessionId);
  } catch {
    return null;
  }
}
