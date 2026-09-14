"use client";

import {
  actionBoost,
  actionBroadcast,
  actionCreateGroup,
  actionCreatePost,
  actionJoinGroup,
  actionLike,
  actionPin,
  actionPropose,
  actionVote,
} from "@/app/actions/student";
import { PostImage } from "@/components/PostImage";
import { GifPicker } from "@/components/student/GifPicker";
import { compact, formatDollars, timeAgo } from "@/lib/format";
import {
  energyBreakdown,
  GIF_ENERGY,
  kindFromFile,
  MAX_ATTACHMENTS,
  PHOTO_ENERGY,
  postEnergyCost,
  TEXT_ENERGY,
} from "@/lib/media-cost";
import { useLiveState } from "@/lib/use-live";
import type { Post, ProposalEffect, StudentSnapshot } from "@/lib/types";
import { PROPOSAL_EFFECTS } from "@/lib/types";
import {
  Broadcast,
  ChatCircle,
  Eye,
  FireSimple,
  Gif,
  Heart,
  House,
  ImageSquare,
  PushPin,
  Lightning,
  Scales,
  UsersThree,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, useTransition } from "react";

type ActionResult = { error?: string; state?: StudentSnapshot };

type Tab = "feed" | "groups" | "rules";

export function StudentApp({ initial }: { initial: StudentSnapshot }) {
  const { state, refresh, replace } = useLiveState(
    initial.session.id,
    "student",
    initial,
  );
  const [tab, setTab] = useState<Tab>("feed");
  const [error, setError] = useState<string | null>(null);

  function apply(result: ActionResult) {
    if (result.error) setError(result.error);
    else if (result.state) replace(result.state);
    else void refresh();
  }
  const late =
    state.session.currentRound >= 4 || state.session.flags.governanceOpen;

  if (state.you?.kickedAt) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-6">
        <p className="text-center text-lg text-feed-muted">
          You were removed from this room.
        </p>
      </div>
    );
  }

  if (state.session.flags.ended) {
    return <EndScreen state={state} />;
  }

  return (
    <div className="min-h-[100dvh] bg-feed-bg">
      <div className="mx-auto grid min-h-[100dvh] max-w-[1180px] grid-cols-1 md:grid-cols-[220px_minmax(0,1fr)_280px]">
        <SideNav state={state} tab={tab} setTab={setTab} late={late} />
        <main className="min-w-0 border-x border-white/10 md:border-x">
          <div className="md:hidden">
            <Hud state={state} />
          </div>
          {state.session.announcement && (
            <div className="border-b border-white/10 bg-feed-accent px-4 py-2 text-center text-[13px] font-semibold tracking-wide text-white">
              {state.session.announcement}
            </div>
          )}
          {state.trendingHashtag && (
            <div className="border-b border-feed-gold/30 bg-feed-gold/10 px-4 py-2 text-center text-[13px] font-semibold text-feed-gold">
              {state.trendingHashtag} trending · 412% increase in engagement
            </div>
          )}
          {state.session.flags.valueRevealed && (
            <ValueReveal value={state.session.platformValue ?? 0} />
          )}
          {state.session.flags.algorithmRevealed && state.session.weights && (
            <AlgorithmReveal weights={state.session.weights} />
          )}
          {late && (
            <div className="sticky top-0 z-20 grid grid-cols-3 border-b border-white/10 bg-feed-bg md:hidden">
              {(
                [
                  ["feed", "Feed"],
                  ["groups", "Groups"],
                  ["rules", "Rules"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`py-2.5 text-[13px] font-semibold ${
                    tab === id
                      ? "border-b-2 border-feed-accent text-white"
                      : "text-feed-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {tab === "feed" && (
            <Feed state={state} apply={apply} late={late} />
          )}
          {tab === "groups" && <Groups state={state} apply={apply} />}
          {tab === "rules" && <Rules state={state} apply={apply} />}
        </main>
        <RightRail state={state} />
      </div>
      {error && (
        <button
          type="button"
          onClick={() => setError(null)}
          className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-feed-accent px-4 py-2 text-sm text-white"
        >
          {error}
        </button>
      )}
    </div>
  );
}

function Hud({ state }: { state: StudentSnapshot }) {
  const you = state.you;
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/10 bg-feed-bg/95 px-4 py-2.5 backdrop-blur-sm">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold tracking-[0.18em] text-feed-accent">
          THE FEED
        </p>
        <p className="text-xs text-feed-muted">
          Round {state.session.currentRound}
          {you ? ` · @${you.username}` : ""}
        </p>
      </div>
      {you && (
        <div className="flex items-center gap-3 text-right">
          {!state.session.flags.hideInfluence && (
            <Metric label="Influence" value={String(you.influence)} />
          )}
          <Metric
            label="Energy"
            value={`${you.energy}/${state.session.energyPerRound}`}
          />
          {!state.session.flags.hideLeaderboard && (
            <Metric label="Rank" value={`#${you.rank || "—"}`} />
          )}
        </div>
      )}
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-sm font-semibold leading-none">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-wider text-feed-muted">
        {label}
      </p>
    </div>
  );
}

function SideNav({
  state,
  tab,
  setTab,
  late,
}: {
  state: StudentSnapshot;
  tab: Tab;
  setTab: (tab: Tab) => void;
  late: boolean;
}) {
  const you = state.you;
  return (
    <nav className="sticky top-0 hidden h-[100dvh] flex-col overflow-y-auto px-6 py-6 md:flex">
      <p className="text-[11px] font-semibold tracking-[0.2em] text-feed-accent">
        THE FEED
      </p>
      <p className="mt-1 text-sm text-feed-muted">
        Round {state.session.currentRound}
      </p>
      {you && (
        <>
          <p className="mt-8 text-xl font-semibold">@{you.username}</p>
          <dl className="mt-6 space-y-4">
            <div>
              <dt className="text-[10px] uppercase tracking-wider text-feed-muted">
                Energy
              </dt>
              <dd className="mt-1 font-mono text-lg">
                {you.energy}/{state.session.energyPerRound}
              </dd>
            </div>
            {!state.session.flags.hideInfluence && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-feed-muted">
                  Influence
                </dt>
                <dd className="mt-1 font-mono text-lg">{you.influence}</dd>
              </div>
            )}
            {!state.session.flags.hideLeaderboard && (
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-feed-muted">
                  Rank
                </dt>
                <dd className="mt-1 font-mono text-lg">#{you.rank || "—"}</dd>
              </div>
            )}
          </dl>
        </>
      )}
      {late && (
        <div className="mt-10 space-y-1">
          {(
            [
              ["feed", "Feed", House],
              ["groups", "Groups", UsersThree],
              ["rules", "Rules", Scales],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm ${
                tab === id ? "bg-white/8 text-white" : "text-feed-muted"
              }`}
            >
              <Icon size={18} />
              {label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}

function RightRail({ state }: { state: StudentSnapshot }) {
  const room = state.participants.filter((p) => !p.kickedAt);
  const trending = state.posts
    .filter((p) => !p.parentId && p.trending)
    .slice(0, 4);
  return (
    <aside className="sticky top-0 hidden h-[100dvh] overflow-y-auto md:block">
      {!state.session.flags.hideLeaderboard && room.length > 0 && (
        <div className="border-b border-white/10 px-5 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-feed-muted">
            Rank
          </p>
          <ol className="mt-3 space-y-2">
            {room.slice(0, 8).map((p) => (
              <li key={p.id} className="flex items-baseline justify-between text-sm">
                <span>
                  <span className="text-feed-muted">#{p.rank}</span>{" "}
                  <span className={p.id === state.you?.id ? "text-feed-accent" : ""}>
                    @{p.username}
                  </span>
                </span>
                {!state.session.flags.hideInfluence && (
                  <span className="font-mono text-xs text-feed-muted">
                    {p.influence}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {trending.length > 0 && (
        <div className="px-5 py-5">
          <p className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-feed-gold">
            <FireSimple size={14} weight="fill" /> Trending
          </p>
          <div className="mt-3 space-y-3">
            {trending.map((post) => (
              <p key={post.id} className="text-sm leading-snug text-feed-muted">
                {previewText(post, 90)}
              </p>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}

function Feed({
  state,
  apply,
  late,
}: {
  state: StudentSnapshot;
  apply: (result: ActionResult) => void;
  late: boolean;
}) {
  const roots = useMemo(
    () => state.posts.filter((p) => !p.parentId),
    [state.posts],
  );
  const trending = roots.filter((p) => p.trending).slice(0, 3);

  return (
    <div>
      <Composer
        state={state}
        apply={apply}
        showBroadcast={late}
      />
      {!state.session.flags.hideLeaderboard && (
        <div className="md:hidden">
          <RankStrip state={state} />
        </div>
      )}
      {trending.length > 0 && (
        <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-4 py-3 md:hidden">
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-feed-gold">
            <FireSimple size={14} weight="fill" /> Trending
          </span>
          {trending.map((post) => (
            <span
              key={post.id}
              className="shrink-0 rounded-full bg-white/5 px-3 py-1 text-xs text-feed-muted"
            >
              {previewText(post, 36)}
            </span>
          ))}
        </div>
      )}
      <div className="divide-y divide-white/8">
        {roots.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-feed-muted">
            The feed is empty. Spend 1 Energy and post first.
          </p>
        ) : (
          roots.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              state={state}
              apply={apply}
            />
          ))
        )}
      </div>
    </div>
  );
}

function RankStrip({ state }: { state: StudentSnapshot }) {
  const top = state.participants.filter((p) => !p.kickedAt).slice(0, 5);
  if (top.length === 0) return null;
  return (
    <div className="flex gap-3 overflow-x-auto border-b border-white/10 px-4 py-2">
      {top.map((p) => (
        <div key={p.id} className="shrink-0 text-xs">
          <span className="text-feed-muted">#{p.rank}</span>{" "}
          <span className={p.id === state.you?.id ? "text-feed-accent" : ""}>
            @{p.username}
          </span>
          {!state.session.flags.hideInfluence && (
            <span className="ml-1 font-mono text-feed-muted">{p.influence}</span>
          )}
        </div>
      ))}
    </div>
  );
}

function Composer({
  state,
  apply,
  showBroadcast,
  parentId,
  groupId,
  onDone,
}: {
  state: StudentSnapshot;
  apply: (result: ActionResult) => void;
  showBroadcast?: boolean;
  parentId?: string;
  groupId?: string | null;
  onDone?: () => void;
}) {
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<
    Array<{
      key: string;
      kind: "photo" | "gif";
      preview: string;
      file?: File;
      giphyId?: string;
    }>
  >([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, start] = useTransition();
  const you = state.you;
  const paused = state.session.status === "paused";
  const isReply = Boolean(parentId);
  const photos = attachments.filter((item) => item.kind === "photo").length;
  const gifs = attachments.filter((item) => item.kind === "gif").length;
  const hasText = Boolean(body.trim());
  const canPost = hasText || attachments.length > 0;
  const energyCost = postEnergyCost({ hasText, photos, gifs, isReply });
  const enoughEnergy = Boolean(you && you.energy >= energyCost);
  const roomLeft = MAX_ATTACHMENTS - attachments.length;

  useEffect(() => {
    return () => {
      for (const item of attachments) {
        if (item.file) URL.revokeObjectURL(item.preview);
      }
    };
    // revoke only on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next = [...attachments];
    for (const file of Array.from(list)) {
      if (next.length >= MAX_ATTACHMENTS) break;
      next.push({
        key: crypto.randomUUID(),
        kind: kindFromFile(file),
        preview: URL.createObjectURL(file),
        file,
      });
    }
    setAttachments(next);
  }

  function addGif(gif: { id: string; preview: string }) {
    if (attachments.length >= MAX_ATTACHMENTS) return;
    if (attachments.some((item) => item.giphyId === gif.id)) return;
    setAttachments((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        kind: "gif",
        preview: gif.preview,
        giphyId: gif.id,
      },
    ]);
    setPickerOpen(false);
  }

  function removeAttachment(key: string) {
    setAttachments((current) => {
      const target = current.find((item) => item.key === key);
      if (target?.file) URL.revokeObjectURL(target.preview);
      return current.filter((item) => item.key !== key);
    });
  }

  function clearDraft() {
    setAttachments((current) => {
      for (const item of current) {
        if (item.file) URL.revokeObjectURL(item.preview);
      }
      return [];
    });
    setBody("");
    setPickerOpen(false);
  }

  function submit(kind: "post" | "broadcast") {
    if (!you) return;
    start(async () => {
      const data = new FormData();
      data.set("body", body);
      if (parentId) data.set("parentId", parentId);
      if (groupId) data.set("groupId", groupId);
      for (const item of attachments) {
        if (item.file) data.append("images", item.file);
        if (item.giphyId) data.append("giphyIds", item.giphyId);
      }
      const result =
        kind === "broadcast"
          ? await actionBroadcast(body)
          : await actionCreatePost(data);
      apply(result);
      if (!result.error) {
        clearDraft();
        onDone?.();
      }
    });
  }

  if (!you) return null;

  return (
    <div className="border-b border-white/10 px-4 py-3 lg:px-8">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={280}
        rows={parentId ? 2 : 3}
        disabled={paused}
        placeholder={
          parentId
            ? "Reply with text, a photo, or a GIF…"
            : "Text is optional if you add a photo or GIF"
        }
        className="w-full resize-none bg-transparent text-[15px] outline-none placeholder:text-feed-muted/70"
      />
      {attachments.length > 0 && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {attachments.map((item) => (
            <div key={item.key} className="relative overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.preview}
                alt=""
                referrerPolicy="no-referrer"
                className="h-24 w-full object-cover"
              />
              <span className="absolute left-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] uppercase">
                {item.kind === "gif" ? `GIF ${GIF_ENERGY}` : `Photo ${PHOTO_ENERGY}`}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(item.key)}
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"
                aria-label="Remove"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {pickerOpen && (
        <GifPicker
          onPick={addGif}
          onClose={() => setPickerOpen(false)}
        />
      )}
      <p className="mt-2 text-[11px] leading-snug text-feed-muted">
        Images and GIFs must be classroom-appropriate. Don’t post anything you
        wouldn’t show on a projector.
      </p>
      <p className="mt-2 font-mono text-[12px] text-feed-gold">
        {energyCost === 0
          ? isReply
            ? "Reply is free until you add a photo or GIF"
            : `This post: 0 Energy · add text (${TEXT_ENERGY}), a photo (${PHOTO_ENERGY}), or a GIF (${GIF_ENERGY})`
          : `This post: ${energyCost} Energy · ${energyBreakdown({
              hasText,
              photos,
              gifs,
              isReply,
            })}`}
        {you ? ` · you have ${you.energy}` : ""}
      </p>
      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-feed-muted hover:text-feed-text">
            <ImageSquare size={16} />
            Photos
            <input
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="sr-only"
              disabled={paused || roomLeft <= 0}
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <button
            type="button"
            disabled={paused || roomLeft <= 0 || state.gifsEnabled === false}
            onClick={() => setPickerOpen((open) => !open)}
            title={
              state.gifsEnabled
                ? "Search GIPHY"
                : "GIF search isn’t available in this room"
            }
            className="inline-flex items-center gap-1 text-[11px] text-feed-muted hover:text-feed-text"
          >
            <Gif size={16} />
            GIFs
          </button>
        </div>
        <div className="flex gap-2">
          {showBroadcast && !parentId && (
            <button
              type="button"
              disabled={pending || paused || !body.trim()}
              onClick={() => submit("broadcast")}
              className="inline-flex items-center gap-1 rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold active:scale-[0.98]"
            >
              <Broadcast size={14} /> Broadcast
            </button>
          )}
          <button
            type="button"
            disabled={pending || paused || !canPost || !enoughEnergy}
            onClick={() => submit("post")}
            className="rounded-full bg-feed-accent px-4 py-1.5 text-xs font-semibold text-white active:scale-[0.98] disabled:opacity-40"
          >
            {parentId ? "Reply" : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PostCard({
  post,
  state,
  apply,
}: {
  post: Post;
  state: StudentSnapshot;
  apply: (result: ActionResult) => void;
}) {
  const [replyOpen, setReplyOpen] = useState(false);
  const [pending, start] = useTransition();
  const author = state.participants.find((p) => p.id === post.authorId);
  const liked = Boolean(state.you && post.likedBy.includes(state.you.id));
  const replies = state.posts
    .filter((p) => p.parentId === post.id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const you = state.you;
  const canBoost =
    you &&
    you.influence >= state.session.influenceThresholds.boost &&
    you.boostsUsedThisRound < 1;
  const canPin =
    you &&
    you.influence >= state.session.influenceThresholds.pin &&
    you.pinsUsedThisRound < 1;

  return (
    <article className="px-4 py-4 lg:px-8">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold">
          @{author?.username ?? "unknown"}
          {post.isBroadcast && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-feed-gold">
              broadcast
            </span>
          )}
          {post.trending && (
            <span className="ml-2 text-[10px] uppercase tracking-wider text-feed-gold">
              trending
            </span>
          )}
        </p>
        <p className="text-[11px] text-feed-muted" suppressHydrationWarning>
          {timeAgo(post.createdAt)}
        </p>
      </div>
      {post.body ? (
        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed">
          {post.body}
        </p>
      ) : null}
      <PostImage url={post.imageUrl} media={post.media} />
      <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-feed-muted">
        <button
          type="button"
          disabled={pending || !you}
          onClick={() =>
            start(async () => {
              apply(await actionLike(post.id));
            })
          }
          className={`inline-flex min-h-8 items-center gap-1.5 active:scale-[0.98] ${
            liked ? "text-feed-accent" : "hover:text-feed-text"
          }`}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <Heart size={18} weight={liked ? "fill" : "regular"} />
          {post.likedBy.length}
        </button>
        <button
          type="button"
          onClick={() => setReplyOpen((v) => !v)}
          className={`inline-flex items-center gap-1 hover:text-feed-text ${
            replyOpen ? "text-feed-text" : ""
          }`}
          aria-label="Reply"
        >
          <ChatCircle size={16} weight={replyOpen ? "fill" : "regular"} />
          {replies.length}
        </button>
        <span className="inline-flex items-center gap-1">
          <Eye size={14} />
          {compact(post.viewsDisplay)}
        </span>
        {post.influenceEarned > 0 && (
          <span className="inline-flex items-center gap-1 text-feed-gold">
            <TrendUp size={14} />+{post.influenceEarned} Influence
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {canBoost && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                apply(await actionBoost(post.id));
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold"
          >
            <Lightning size={12} /> Boost
          </button>
        )}
        {canPin && (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                apply(await actionPin(post.id));
              })
            }
            className="inline-flex items-center gap-1 rounded-full bg-white/8 px-3 py-1 text-xs font-semibold"
          >
            <PushPin size={12} /> Pin
          </button>
        )}
      </div>
      {replies.map((reply) => {
        const who = state.participants.find((p) => p.id === reply.authorId);
        const replyLiked = Boolean(
          state.you && reply.likedBy.includes(state.you.id),
        );
        return (
          <div
            key={reply.id}
            className="mt-3 border-l border-white/10 pl-3"
          >
            <p className="text-xs font-semibold">
              @{who?.username ?? "unknown"}{" "}
              <span className="font-normal text-feed-muted" suppressHydrationWarning>
                {timeAgo(reply.createdAt)}
              </span>
            </p>
            {reply.body ? <p className="mt-1 text-sm">{reply.body}</p> : null}
            <PostImage url={reply.imageUrl} media={reply.media} />
            <button
              type="button"
              className={`mt-1 inline-flex items-center gap-1 text-[11px] ${
                replyLiked ? "text-feed-accent" : "text-feed-muted"
              }`}
              aria-label={replyLiked ? "Unlike" : "Like"}
              onClick={() =>
                start(async () => {
                  apply(await actionLike(reply.id));
                })
              }
            >
              <Heart size={12} weight={replyLiked ? "fill" : "regular"} />
              {reply.likedBy.length}
            </button>
          </div>
        );
      })}
      {replyOpen && (
        <div className="mt-3 rounded-xl bg-white/4">
          <Composer
            state={state}
            apply={apply}
            parentId={post.id}
            onDone={() => setReplyOpen(false)}
          />
        </div>
      )}
    </article>
  );
}

function Groups({
  state,
  apply,
}: {
  state: StudentSnapshot;
  apply: (result: ActionResult) => void;
}) {
  const [name, setName] = useState("");
  const [active, setActive] = useState<string | null>(
    state.groups[0]?.id ?? null,
  );
  const [pending, start] = useTransition();
  const group = state.groups.find((g) => g.id === active) ?? null;
  const member = Boolean(group && state.you && group.memberIds.includes(state.you.id));

  return (
    <div>
      <form
        className="flex gap-2 border-b border-white/10 px-4 py-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await actionCreateGroup(name);
            apply(result);
            if (!result.error) setName("");
          });
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Create a group"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-feed-muted"
        />
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-full bg-feed-accent px-3 py-1 text-xs font-semibold text-white"
        >
          Create
        </button>
      </form>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {state.groups.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => setActive(g.id)}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              active === g.id ? "bg-feed-accent text-white" : "bg-white/8"
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>
      {group && (
        <div>
          <div className="flex items-center justify-between px-4 pb-2">
            <p className="inline-flex items-center gap-2 text-sm text-feed-muted">
              <UsersThree size={16} /> {group.memberIds.length} members
            </p>
            {state.you && !member && (
              <button
                type="button"
                onClick={() =>
                  start(async () => {
                    apply(await actionJoinGroup(group.id));
                  })
                }
                className="text-xs font-semibold text-feed-accent"
              >
                Join
              </button>
            )}
          </div>
          {member && (
            <Composer state={state} apply={apply} groupId={group.id} />
          )}
          {state.posts
            .filter((p) => p.groupId === group.id && !p.parentId)
            .map((post) => (
              <PostCard
                key={post.id}
                post={post}
                state={state}
                apply={apply}
              />
            ))}
        </div>
      )}
      {state.groups.length === 0 && (
        <p className="px-4 py-12 text-center text-sm text-feed-muted">
          No groups yet. Name one and invite the room.
        </p>
      )}
    </div>
  );
}

function Rules({
  state,
  apply,
}: {
  state: StudentSnapshot;
  apply: (result: ActionResult) => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [effect, setEffect] = useState<ProposalEffect>("theatrical");
  const [pending, start] = useTransition();
  const voters = state.participants.filter((p) => !p.kickedAt).length;

  return (
    <div className="px-4 py-4">
      <h2 className="text-sm font-semibold tracking-wide">Platform governance</h2>
      <p className="mt-1 text-xs text-feed-muted">
        Write a proposal. Votes require about two-thirds of the room. The
        operator still has to apply it.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const result = await actionPropose({ title, body, effect });
            apply(result);
            if (!result.error) {
              setTitle("");
              setBody("");
            }
          });
        }}
      >
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Proposal"
          className="w-full border-b border-white/10 bg-transparent py-2 text-sm outline-none"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Why should the room adopt this?"
          className="w-full resize-none bg-transparent text-sm outline-none"
          rows={3}
        />
        <select
          value={effect}
          onChange={(e) => setEffect(e.target.value as ProposalEffect)}
          className="w-full bg-feed-bg text-sm"
        >
          {PROPOSAL_EFFECTS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !title.trim()}
          className="rounded-full bg-feed-accent px-4 py-2 text-xs font-semibold text-white"
        >
          Propose
        </button>
      </form>

      <div className="mt-8 space-y-4">
        {state.proposals.map((proposal) => {
          const yes = Object.values(proposal.votes).filter((v) => v === "yes")
            .length;
          const no = Object.values(proposal.votes).filter((v) => v === "no")
            .length;
          const mine = state.you ? proposal.votes[state.you.id] : undefined;
          return (
            <div key={proposal.id} className="border-t border-white/10 pt-4">
              <p className="text-[11px] uppercase tracking-wider text-feed-muted">
                {proposal.status} · {proposal.threshold}/{voters} required
              </p>
              <p className="mt-1 font-semibold">{proposal.title}</p>
              {proposal.body && (
                <p className="mt-1 text-sm text-feed-muted">{proposal.body}</p>
              )}
              <p className="mt-2 text-sm">
                YES {yes} · NO {no}
              </p>
              {proposal.status === "open" && state.you && (
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        apply(await actionVote(proposal.id, "yes"));
                      })
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      mine === "yes" ? "bg-feed-accent text-white" : "bg-white/8"
                    }`}
                  >
                    Vote yes
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      start(async () => {
                        apply(await actionVote(proposal.id, "no"));
                      })
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      mine === "no" ? "bg-white text-black" : "bg-white/8"
                    }`}
                  >
                    Vote no
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ValueReveal({ value }: { value: number }) {
  return (
    <section className="border-b border-white/10 px-4 py-6 text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-feed-muted">
        Estimated platform value
      </p>
      <p className="mt-2 font-mono text-4xl font-semibold">
        {formatDollars(value)}
      </p>
      <p className="mt-3 text-sm text-feed-muted">Your earnings</p>
      <p className="font-mono text-2xl">{formatDollars(0)}</p>
    </section>
  );
}

function AlgorithmReveal({
  weights,
}: {
  weights: NonNullable<StudentSnapshot["session"]["weights"]>;
}) {
  const rows = Object.entries(weights).filter(([, value]) => value > 0);
  return (
    <section className="border-b border-white/10 px-4 py-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-feed-muted">
        The algorithm
      </p>
      <div className="mt-4 grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-feed-muted">What you saw</p>
          <ul className="mt-2 space-y-1 text-sm">
            <li>Likes</li>
            <li>Replies</li>
            <li>Views</li>
          </ul>
        </div>
        <div>
          <p className="text-xs text-feed-muted">What determined visibility</p>
          <ul className="mt-2 space-y-1 text-sm">
            {rows.map(([key, value]) => (
              <li key={key} className="flex justify-between gap-3">
                <span className="capitalize">{labelWeight(key)}</span>
                <span className="font-mono">×{value}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-6 text-sm font-semibold">
        Did the platform tell you what to create?
      </p>
      <p className="mt-1 text-sm font-semibold">Or did you change yourself?</p>
    </section>
  );
}

function EndScreen({ state }: { state: StudentSnapshot }) {
  const s = state.stats;
  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-[11px] font-semibold tracking-[0.22em] text-feed-accent">
        SIMULATION COMPLETE
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">
        You collectively produced
      </h1>
      <dl className="mt-8 space-y-2 font-mono text-sm">
        <Row k="Posts" v={s.posts} />
        <Row k="Likes" v={s.likes} />
        <Row k="Comments" v={s.replies} />
        <Row k="Conversations" v={s.conversations} />
        <Row k="Communities" v={s.groups} />
        <Row k="Total interactions" v={s.interactions} />
      </dl>
      <p className="mt-10 text-xs uppercase tracking-[0.18em] text-feed-muted">
        Estimated platform value
      </p>
      <p className="mt-2 font-mono text-4xl">
        {formatDollars(state.session.platformValue ?? 0)}
      </p>
      <p className="mt-6 text-xs uppercase tracking-[0.18em] text-feed-muted">
        Total user earnings
      </p>
      <p className="mt-2 font-mono text-4xl">{formatDollars(0)}</p>
      <p className="mt-12 text-xl font-semibold">What created the value?</p>
      <p className="mt-3 text-lg text-feed-muted">The platform?</p>
      <p className="text-lg text-feed-muted">or you?</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between border-b border-white/8 py-2">
      <dt className="text-feed-muted">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

function labelWeight(key: string): string {
  const labels: Record<string, string> = {
    likes: "Likes",
    replies: "Replies",
    replyDepth: "Reply depth",
    funny: "Humor",
    emotional: "Emotion",
    controversial: "Controversy",
    personal: "Personal disclosure",
    informational: "Information",
    mention: "Tagging another user",
    conversationDepth: "Conversation depth",
    groupInteraction: "Group interaction",
    antiPlatform: "Anti-platform content",
  };
  return labels[key] ?? key;
}

function previewText(post: Post, max: number): string {
  if (post.body.trim()) {
    const text = post.body.trim();
    return text.length > max ? `${text.slice(0, max)}…` : text;
  }
  const photos = post.media?.filter((item) => item.kind === "photo").length ?? 0;
  const gifs = post.media?.filter((item) => item.kind === "gif").length ?? 0;
  if (photos && gifs) return `${photos} photos · ${gifs} GIFs`;
  if (gifs) return gifs === 1 ? "GIF" : `${gifs} GIFs`;
  if (photos) return photos === 1 ? "Photo" : `${photos} photos`;
  return post.imageUrl ? "Photo" : "";
}
