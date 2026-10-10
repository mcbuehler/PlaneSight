// What the Plane Sight server sends over /events (see server/server.mjs, snapshot()).

export type Action = "allow" | "deny" | "answer" | "prompt" | "dismiss";

export interface Card {
  title: string;
  summary: string;
  category: string;
  proposal: { action: Action; text: string };
  reasoning: string;
  effort_seconds: number;
  risk: "low" | "medium" | "high";
}

export interface Need {
  kind: "approval" | "question" | "blocked" | "landed";
  key: string;
  skipped: boolean;
  since: number | null;
  rank: number | null;
  /** The tower's one-line reason for this place in the queue. */
  reason: string | null;
  /** 0 to 100 from the team's decision maker; null from the built-in ranking. */
  urgency: number | null;
  request: { tool?: string; input?: Record<string, unknown>; expired: boolean } | null;
  message: string | null;
  collision: { file: string; other: string; otherSession: string } | null;
  card: Card | null;
  cardPending: boolean;
}

export interface Plane {
  session: string;
  pane: string | null;
  herdrUrl: string | null;
  agent: string;
  name: string | null;
  title: string | null;
  repo: string | null;
  status: string;
  tokens: number | null;
  files: string[];
  need: Need | null;
}

export interface TowerState {
  now: number;
  herdrUrl?: string | null;
  gemini: { enabled: boolean; lastError: string | null };
  /** Which decision maker ranked the queue: "built-in", or "team (gemini)" / "team (heuristic)". */
  ranker?: { source: string; error: string | null; explanation: string | null };
  planes: Plane[];
}

/** Status colour of a plane: what it needs from you, or where it is. */
export type Tone = "approve" | "decide" | "review" | "alert" | "parked" | "flying";

export type Airline = "cloud-code" | "openair";
export type Airframe = "narrowbody" | "widebody";

/** Where a plane stands on the airfield, in the 1280 x 720 grid. Heading 0 faces up, 90 faces right. */
export interface Spot {
  x: number;
  y: number;
  heading: number;
  scale: number;
  kind: "queue" | "parked" | "flying";
  rank?: number;
  /** For a plane in the queue: the entry it takes onto the runway (see airfield.ts). */
  entry?: string;
  /** Only the first-priority plane occupies the runway. */
  runway?: boolean;
  /** The plane immediately ahead in departure order. */
  follows?: string;
  tag: "left" | "above" | "below" | "none";
}
