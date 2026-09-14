export type SessionStatus = "lobby" | "live" | "paused" | "ended";
export type RoundNumber = 1 | 2 | 3 | 4;
export type Vote = "yes" | "no";
export type ProposalStatus = "open" | "passed" | "rejected" | "vetoed" | "applied";
export type ProposalEffect =
  | "remove_leaderboard"
  | "hide_influence"
  | "double_energy"
  | "equalize_energy"
  | "theatrical";

export type Classification =
  | "funny"
  | "emotional"
  | "controversial"
  | "personal"
  | "informational"
  | "neutral"
  | "anti_platform";

export type AlgorithmWeights = {
  likes: number;
  replies: number;
  replyDepth: number;
  funny: number;
  emotional: number;
  controversial: number;
  personal: number;
  informational: number;
  mention: number;
  conversationDepth: number;
  groupInteraction: number;
  antiPlatform: number;
};

export type SessionFlags = {
  valueRevealed: boolean;
  algorithmRevealed: boolean;
  governanceOpen: boolean;
  monetizeResistance: boolean;
  hideLeaderboard: boolean;
  hideInfluence: boolean;
  ended: boolean;
};

export type Session = {
  id: string;
  code: string;
  status: SessionStatus;
  currentRound: RoundNumber;
  energyPerRound: number;
  costs: { post: number; reply: number; like: number };
  influenceThresholds: { boost: number; pin: number };
  weights: Record<RoundNumber, AlgorithmWeights>;
  platformValue: number;
  flags: SessionFlags;
  announcement: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Participant = {
  id: string;
  sessionId: string;
  username: string;
  token: string;
  influence: number;
  energy: number;
  rank: number;
  boostsUsedThisRound: number;
  pinsUsedThisRound: number;
  broadcastsUsedThisRound: number;
  kickedAt: string | null;
  createdAt: string;
};

export type Post = {
  id: string;
  sessionId: string;
  authorId: string;
  parentId: string | null;
  groupId: string | null;
  body: string;
  likedBy: string[];
  viewsDisplay: number;
  visibilityScore: number;
  influenceEarned: number;
  tags: Classification[];
  boosted: boolean;
  buried: boolean;
  trending: boolean;
  pinnedUntil: string | null;
  mentionedIds: string[];
  isBroadcast: boolean;
  createdAt: string;
};

export type Group = {
  id: string;
  sessionId: string;
  name: string;
  creatorId: string;
  memberIds: string[];
  createdAt: string;
};

export type Proposal = {
  id: string;
  sessionId: string;
  authorId: string;
  title: string;
  body: string;
  effect: ProposalEffect;
  status: ProposalStatus;
  votes: Record<string, Vote>;
  threshold: number;
  createdAt: string;
};

export type Announcement = {
  id: string;
  sessionId: string;
  body: string;
  kind: "system" | "instructor" | "broadcast";
  createdAt: string;
};

export type GameEvent = {
  id: string;
  sessionId: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type Database = {
  sessions: Record<string, Session>;
  participants: Record<string, Participant>;
  posts: Record<string, Post>;
  groups: Record<string, Group>;
  proposals: Record<string, Proposal>;
  announcements: Record<string, Announcement>;
  events: GameEvent[];
};

export type StudentSnapshot = {
  role: "student";
  session: Pick<
    Session,
    | "id"
    | "code"
    | "status"
    | "currentRound"
    | "energyPerRound"
    | "costs"
    | "influenceThresholds"
    | "announcement"
    | "updatedAt"
  > & {
    flags: SessionFlags;
    platformValue: number | null;
    weights: AlgorithmWeights | null;
  };
  you: Omit<Participant, "token"> | null;
  participants: Array<
    Pick<Participant, "id" | "username" | "influence" | "rank" | "kickedAt">
  >;
  posts: Post[];
  groups: Group[];
  proposals: Proposal[];
  announcements: Announcement[];
  stats: ProductionStats;
  trendingHashtag: string | null;
};

export type InstructorSnapshot = {
  role: "instructor";
  session: Session;
  participants: Participant[];
  posts: Post[];
  groups: Group[];
  proposals: Proposal[];
  announcements: Announcement[];
  events: GameEvent[];
  stats: ProductionStats;
  unclassifiedCount: number;
};

export type ProductionStats = {
  posts: number;
  likes: number;
  replies: number;
  deepThreads: number;
  groups: number;
  proposals: number;
  conversations: number;
  interactions: number;
  activeUsers: number;
};

export const CLASSIFICATIONS: Classification[] = [
  "funny",
  "emotional",
  "controversial",
  "personal",
  "informational",
  "neutral",
  "anti_platform",
];

export const PROPOSAL_EFFECTS: { id: ProposalEffect; label: string }[] = [
  { id: "theatrical", label: "Symbolic only (no system change)" },
  { id: "remove_leaderboard", label: "Hide the rank leaderboard" },
  { id: "hide_influence", label: "Hide Influence scores" },
  { id: "double_energy", label: "Double Energy per round" },
  { id: "equalize_energy", label: "Refill everyone's Energy" },
];
