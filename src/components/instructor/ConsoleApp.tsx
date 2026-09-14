"use client";

import {
  actionBroadcastMessage,
  actionClassify,
  actionCreateSession,
  actionEnd,
  actionFlagPost,
  actionKick,
  actionMonetize,
  actionNextRound,
  actionOpenGovernance,
  actionRatify,
  actionResetEnergy,
  actionRevealAlgorithm,
  actionRevealValue,
  actionSaveEnergy,
  actionSaveThresholds,
  actionSaveWeights,
  actionSetStat,
  actionTogglePause,
  actionVeto,
} from "@/app/actions/instructor";
import { PostImage } from "@/components/PostImage";
import { formatDollars, timeAgo } from "@/lib/format";
import { useLiveState } from "@/lib/use-live";
import type {
  AlgorithmWeights,
  InstructorSnapshot,
  Post,
} from "@/lib/types";
import { CLASSIFICATIONS } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

export function ConsoleApp({ initial }: { initial: InstructorSnapshot }) {
  const { state } = useLiveState(initial.session.id, "admin", initial);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [roomPending, startRoom] = useTransition();
  const [panel, setPanel] = useState<"queue" | "users" | "system" | "debrief">(
    "queue",
  );

  return (
    <div className="min-h-[100dvh] bg-ops-bg text-ops-text">
      <header className="sticky top-0 z-20 border-b border-ops-line bg-ops-bg">
        <div className="flex gap-2 border-b border-ops-line px-4 py-2">
          <button
            type="button"
            onClick={() => router.push("/console")}
            className="border border-ops-line px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide hover:bg-white hover:text-black"
          >
            Leave room
          </button>
          <button
            type="button"
            disabled={roomPending}
            onClick={() =>
              startRoom(async () => {
                const result = await actionCreateSession();
                if (!result.ok) setError(result.error);
                else router.push(`/console/${result.id}`);
              })
            }
            className="bg-white px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-black active:scale-[0.98] disabled:opacity-50"
          >
            New room
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-wide text-white">
              Operator console
            </p>
            <p className="font-mono text-lg">
              {state.session.code} · R{state.session.currentRound} ·{" "}
              {state.session.status}
            </p>
          </div>
          <div className="ml-auto font-mono text-sm text-white">
            {formatDollars(state.session.platformValue)}
          </div>
        </div>
        <Controls sessionId={state.session.id} status={state.session.status} onError={setError} />
      </header>

      <Stats state={state} />

      <nav className="grid grid-cols-4 border-y border-ops-line font-mono text-[11px] uppercase tracking-wider">
        {(
          [
            ["queue", `Queue ${state.unclassifiedCount}`],
            ["users", `Users ${state.stats.activeUsers}`],
            ["system", "System"],
            ["debrief", "Debrief"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPanel(id)}
            className={`py-2 ${
              panel === id ? "bg-white text-black" : "text-ops-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {panel === "queue" && <Queue state={state} onError={setError} />}
      {panel === "users" && <Users state={state} onError={setError} />}
      {panel === "system" && <System state={state} onError={setError} />}
      {panel === "debrief" && <Debrief state={state} />}

      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="fixed bottom-4 right-4 bg-ops-text px-3 py-2 font-mono text-xs text-ops-bg"
        >
          {error}
        </button>
      )}
    </div>
  );
}

function Controls({
  sessionId,
  status,
  onError,
}: {
  sessionId: string;
  status: string;
  onError: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");

  function run(fn: () => Promise<{ error?: string }>) {
    start(async () => {
      const result = await fn();
      if (result.error) onError(result.error);
    });
  }

  const actions: { label: string; fn: () => Promise<{ error?: string }>; danger?: boolean }[] = [
    { label: "Next round", fn: () => actionNextRound(sessionId) },
    {
      label: status === "paused" ? "Resume" : "Pause",
      fn: () => actionTogglePause(sessionId),
    },
    { label: "Reset energy", fn: () => actionResetEnergy(sessionId) },
    { label: "Reveal value", fn: () => actionRevealValue(sessionId) },
    { label: "Reveal algorithm", fn: () => actionRevealAlgorithm(sessionId) },
    { label: "Open governance", fn: () => actionOpenGovernance(sessionId) },
    { label: "Monetize resistance", fn: () => actionMonetize(sessionId) },
    { label: "End simulation", fn: () => actionEnd(sessionId), danger: true },
  ];

  return (
    <div className="border-t border-ops-line px-4 py-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={pending}
            onClick={() => run(action.fn)}
            className={`px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide active:scale-[0.98] ${
              action.danger
                ? "bg-white text-black"
                : "border border-ops-line text-ops-text hover:bg-white hover:text-black"
            }`}
          >
            {action.label}
          </button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(async () => {
            const result = await actionBroadcastMessage(sessionId, message);
            if (!result.error) setMessage("");
            return result;
          });
        }}
      >
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Broadcast to the room"
          className="flex-1 border border-ops-line bg-transparent px-2 py-1 font-mono text-xs outline-none"
        />
        <button
          type="submit"
          className="border border-ops-line px-2 font-mono text-[11px] uppercase"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function Stats({ state }: { state: InstructorSnapshot }) {
  const items = [
    ["Users", state.stats.activeUsers],
    ["Posts", state.stats.posts],
    ["Likes", state.stats.likes],
    ["Replies", state.stats.replies],
    ["Threads", state.stats.conversations],
    ["Groups", state.stats.groups],
    ["Untagged", state.unclassifiedCount],
  ] as const;
  return (
    <div className="grid grid-cols-3 gap-px border-b border-ops-line bg-ops-line sm:grid-cols-7">
      {items.map(([label, value]) => (
        <div key={label} className="bg-ops-bg px-3 py-3">
          <p className="font-mono text-xl text-white">{value}</p>
          <p className="font-mono text-[10px] uppercase tracking-wider text-ops-muted">
            {label}
          </p>
        </div>
      ))}
    </div>
  );
}

function Queue({
  state,
  onError,
}: {
  state: InstructorSnapshot;
  onError: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  const roots = useMemo(
    () => state.posts.filter((p) => !p.parentId),
    [state.posts],
  );
  const names = new Map(state.participants.map((p) => [p.id, p.username]));

  return (
    <div className="divide-y divide-ops-line">
      <p className="px-4 py-3 font-mono text-[11px] text-ops-muted">
        New posts are tagged automatically. Change a tag if the guess is wrong.
      </p>
      {roots.map((post) => (
        <article key={post.id} className="px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 font-mono text-[11px] text-ops-muted">
            <span>
              @{names.get(post.authorId) ?? "?"} · {timeAgo(post.createdAt)} ·
              vis {post.visibilityScore} · views {post.viewsDisplay}
            </span>
            <span>
              {post.likedBy.length} likes ·{" "}
              {state.posts.filter((p) => p.parentId === post.id).length} replies
            </span>
          </div>
          {post.body ? <p className="mt-2 text-sm">{post.body}</p> : null}
          <PostImage url={post.imageUrl} media={post.media} />
          <div className="mt-2 flex flex-wrap gap-1">
            {CLASSIFICATIONS.map((tag) => (
              <button
                key={tag}
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const result = await actionClassify(
                      state.session.id,
                      post.id,
                      tag,
                    );
                    if (result.error) onError(result.error);
                  })
                }
                className={`px-2 py-0.5 font-mono text-[10px] uppercase ${
                  post.tags.includes(tag)
                    ? "bg-white text-black"
                    : "border border-ops-line text-ops-muted"
                }`}
              >
                {tag.replace("_", " ")}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 font-mono text-[10px] uppercase">
            <Flag
              label={post.boosted ? "Boosted" : "Boost"}
              onClick={() =>
                start(async () => {
                  const result = await actionFlagPost(
                    state.session.id,
                    post.id,
                    "boosted",
                  );
                  if (result.error) onError(result.error);
                })
              }
            />
            <Flag
              label={post.buried ? "Buried" : "Bury"}
              onClick={() =>
                start(async () => {
                  const result = await actionFlagPost(
                    state.session.id,
                    post.id,
                    "buried",
                  );
                  if (result.error) onError(result.error);
                })
              }
            />
            <Flag
              label={post.trending ? "Trending" : "Make trending"}
              onClick={() =>
                start(async () => {
                  const result = await actionFlagPost(
                    state.session.id,
                    post.id,
                    "trending",
                  );
                  if (result.error) onError(result.error);
                })
              }
            />
          </div>
          <Replies post={post} posts={state.posts} names={names} />
        </article>
      ))}
      {roots.length === 0 && (
        <p className="px-4 py-10 font-mono text-xs text-ops-muted">
          No posts yet. Wait for the room.
        </p>
      )}
    </div>
  );
}

function Replies({
  post,
  posts,
  names,
}: {
  post: Post;
  posts: Post[];
  names: Map<string, string>;
}) {
  const replies = posts.filter((p) => p.parentId === post.id);
  if (replies.length === 0) return null;
  return (
    <div className="mt-2 space-y-1 border-l border-ops-line pl-3">
      {replies.map((reply) => (
        <p key={reply.id} className="text-xs text-ops-muted">
          <span className="text-ops-text">
            @{names.get(reply.authorId) ?? "?"}
          </span>{" "}
          {reply.body}
        </p>
      ))}
    </div>
  );
}

function Flag({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-ops-line px-2 py-0.5 hover:bg-white hover:text-black"
    >
      {label}
    </button>
  );
}

function Users({
  state,
  onError,
}: {
  state: InstructorSnapshot;
  onError: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left font-mono text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-ops-muted">
          <tr>
            <th className="px-4 py-2">Rank</th>
            <th>User</th>
            <th>Inf</th>
            <th>Energy</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {state.participants.map((person) => (
            <tr
              key={person.id}
              className={`border-t border-ops-line ${
                person.kickedAt ? "opacity-40" : ""
              }`}
            >
              <td className="px-4 py-2">{person.rank || "—"}</td>
              <td>@{person.username}</td>
              <td>
                <InlineStat
                  value={person.influence}
                  onSave={(value) =>
                    start(async () => {
                      const result = await actionSetStat(
                        state.session.id,
                        person.id,
                        "influence",
                        value,
                      );
                      if (result.error) onError(result.error);
                    })
                  }
                />
              </td>
              <td>
                <InlineStat
                  value={person.energy}
                  onSave={(value) =>
                    start(async () => {
                      const result = await actionSetStat(
                        state.session.id,
                        person.id,
                        "energy",
                        value,
                      );
                      if (result.error) onError(result.error);
                    })
                  }
                />
              </td>
              <td className="pr-4 text-right">
                {!person.kickedAt && (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        const result = await actionKick(
                          state.session.id,
                          person.id,
                        );
                        if (result.error) onError(result.error);
                      })
                    }
                    className="text-neutral-400 hover:text-white"
                  >
                    Kick
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InlineStat({
  value,
  onSave,
}: {
  value: number;
  onSave: (value: number) => void;
}) {
  return (
    <input
      defaultValue={value}
      key={value}
      type="number"
      className="w-16 bg-transparent outline-none"
      onBlur={(e) => {
        const next = Number(e.target.value);
        if (!Number.isNaN(next) && next !== value) onSave(next);
      }}
    />
  );
}

function System({
  state,
  onError,
}: {
  state: InstructorSnapshot;
  onError: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  const round = state.session.currentRound;
  const [weights, setWeights] = useState<AlgorithmWeights>(
    state.session.weights[round],
  );
  const [energy, setEnergy] = useState(state.session.energyPerRound);
  const [boost, setBoost] = useState(state.session.influenceThresholds.boost);
  const [pin, setPin] = useState(state.session.influenceThresholds.pin);

  return (
    <div className="space-y-8 px-4 py-5">
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ops-muted">
          Current weights · round {round}
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {(Object.keys(weights) as (keyof AlgorithmWeights)[]).map((key) => (
            <label key={key} className="border border-ops-line px-2 py-1">
              <span className="block font-mono text-[10px] uppercase text-ops-muted">
                {key}
              </span>
              <input
                type="number"
                step="0.1"
                value={weights[key]}
                onChange={(e) =>
                  setWeights({ ...weights, [key]: Number(e.target.value) })
                }
                className="w-full bg-transparent font-mono text-sm outline-none"
              />
            </label>
          ))}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const result = await actionSaveWeights(
                state.session.id,
                round,
                weights,
              );
              if (result.error) onError(result.error);
            })
          }
          className="mt-3 border border-ops-line px-3 py-1 font-mono text-[11px] uppercase hover:bg-white hover:text-black"
        >
          Apply weights
        </button>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <label className="border border-ops-line px-2 py-1">
          <span className="block font-mono text-[10px] uppercase text-ops-muted">
            Energy / round
          </span>
          <input
            type="number"
            value={energy}
            onChange={(e) => setEnergy(Number(e.target.value))}
            className="w-full bg-transparent font-mono outline-none"
          />
        </label>
        <label className="border border-ops-line px-2 py-1">
          <span className="block font-mono text-[10px] uppercase text-ops-muted">
            Boost at influence
          </span>
          <input
            type="number"
            value={boost}
            onChange={(e) => setBoost(Number(e.target.value))}
            className="w-full bg-transparent font-mono outline-none"
          />
        </label>
        <label className="border border-ops-line px-2 py-1">
          <span className="block font-mono text-[10px] uppercase text-ops-muted">
            Pin at influence
          </span>
          <input
            type="number"
            value={pin}
            onChange={(e) => setPin(Number(e.target.value))}
            className="w-full bg-transparent font-mono outline-none"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const a = await actionSaveEnergy(state.session.id, energy);
              const b = await actionSaveThresholds(state.session.id, boost, pin);
              if (a.error) onError(a.error);
              else if (b.error) onError(b.error);
            })
          }
          className="border border-ops-line px-3 py-1 font-mono text-[11px] uppercase hover:bg-white hover:text-black"
        >
          Save settings
        </button>
      </section>

      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-wider text-ops-muted">
          Governance
        </h2>
        <div className="mt-3 space-y-3">
          {state.proposals.map((proposal) => {
            const yes = Object.values(proposal.votes).filter((v) => v === "yes")
              .length;
            const no = Object.values(proposal.votes).filter((v) => v === "no")
              .length;
            return (
              <div key={proposal.id} className="border border-ops-line p-3">
                <p className="font-mono text-[10px] uppercase text-ops-muted">
                  {proposal.status} · yes {yes} · no {no} · need {proposal.threshold}
                </p>
                <p className="mt-1 text-sm">{proposal.title}</p>
                <p className="text-xs text-ops-muted">{proposal.body}</p>
                {proposal.status !== "applied" && proposal.status !== "vetoed" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        start(async () => {
                          const result = await actionRatify(
                            state.session.id,
                            proposal.id,
                          );
                          if (result.error) onError(result.error);
                        })
                      }
                      className="bg-white px-2 py-1 font-mono text-[10px] uppercase text-black"
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        start(async () => {
                          const result = await actionVeto(
                            state.session.id,
                            proposal.id,
                          );
                          if (result.error) onError(result.error);
                        })
                      }
                      className="border border-ops-line px-2 py-1 font-mono text-[10px] uppercase"
                    >
                      Veto
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          {state.proposals.length === 0 && (
            <p className="font-mono text-xs text-ops-muted">No proposals yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Debrief({ state }: { state: InstructorSnapshot }) {
  return (
    <div className="space-y-6 px-4 py-6">
      <p className="font-mono text-[11px] uppercase tracking-wider text-ops-muted">
        Instructor only · not shown during play
      </p>
      <Concept
        title="Immaterial labor"
        body="Students produced value through language, humor, knowledge, emotion, and symbolic production. The platform authored almost none of the content."
      />
      <Concept
        title="Society of control"
        body="Nobody was told to become controversial or personal. Rank, views, and Energy made students modify themselves."
      />
      <Concept
        title="Biopolitical production"
        body="Later rounds paid out for mentions, conversation depth, groups, and personal disclosure. Social life became inventory."
      />
      <Concept
        title="Empire"
        body="Power sat in architecture: weights, ranking, visibility, and ratification. The operator never needed to command a genre of post."
      />
      <Concept
        title="Multitude"
        body="The same communication infrastructure that produced Platform Value also let students form groups, broadcast, and write rules."
      />
      <Concept
        title="Central paradox"
        body="The system requires cooperation. Cooperation creates value. Cooperation also creates collective power. Those capacities cannot be fully owned."
      />
      <Concept
        title="Critical ending"
        body="Did they keep competing? Fail to organize? Reproduce hierarchy? Did resistance become trending inventory after Monetize Resistance? Leave that open."
      />
      <section>
        <h3 className="font-mono text-[11px] uppercase text-ops-muted">
          Session log
        </h3>
        <ul className="mt-2 space-y-1 font-mono text-[11px] text-ops-muted">
          {state.events.map((event) => (
            <li key={event.id}>
              {timeAgo(event.createdAt)} · {event.type}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Concept({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h3 className="font-mono text-sm text-white">{title}</h3>
      <p className="mt-1 max-w-prose text-sm leading-relaxed text-ops-text/85">
        {body}
      </p>
    </section>
  );
}
