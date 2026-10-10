// Turns the server's agents into planes on the airfield: who needs you, who is parked, who is flying.
import { ENTRIES, H, NORTH_Y, PARKED_SCALE, RUNWAY_Y, STANDS, W, type Entry } from "./airfieldLayout";
import type { Airframe, Airline, Plane, Spot, Tone, TowerState } from "./types";

export { H, W };

/** Agents that have spent this many tokens fly a widebody. */
const WIDEBODY_TOKENS = 400_000;

export function tone(p: Plane): Tone {
  const n = p.need;
  if (!n || n.skipped) return p.status === "working" ? "flying" : "parked";
  const c = n.card?.category;
  if (c === "error") return "alert";
  if (n.kind === "landed" || c === "review") return "review";
  if (n.kind === "question" || c === "design_decision" || c === "clarification") return "decide";
  return "approve";
}

export const STATUS_WORD: Record<Tone, string> = {
  approve: "Needs approval",
  decide: "Needs a decision",
  review: "Ready for review",
  alert: "Needs attention",
  parked: "At the stand",
  flying: "In flight",
};

export const airline = (p: Plane): Airline => (p.agent === "codex" ? "openair" : "cloud-code");
export const airframe = (p: Plane): Airframe => ((p.tokens ?? 0) >= WIDEBODY_TOKENS ? "widebody" : "narrowbody");
export const AIRLINE_NAME: Record<Airline, string> = { "cloud-code": "Cloud Code", openair: "OpenAir" };

// Readable conversation titles for the existing demo sessions. Match the task
// title, not an agent's short handle, so unrelated agents keep their own title.
const CONVERSATION_TITLES: Record<string, string> = {
  "Landing.js copy polish": "Polish landing page copy",
  "Dashboard workspace label and invite permission": "Add workspace invite controls",
  "visibleProjects workspace isolation fix": "Fix workspace isolation",
  "Bounded pagination for listProjects": "Add API pagination",
  "Invite dialog focus cycling": "Fix invite dialog focus",
};

export function name(p: Plane) {
  const title = p.title?.trim() || p.need?.card?.title?.trim();
  if (title) return CONVERSATION_TITLES[title] ?? title;
  return p.name?.replace(/[-_]+/g, " ") ?? p.session.slice(0, 6);
}
export const short = (s: string | null | undefined, n: number) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s ?? "");

export function waited(since: number | null | undefined) {
  if (!since) return "";
  const s = Math.max(0, Math.round((Date.now() - since) / 1000));
  if (s < 60) return `${s} s`;
  if (s < 3600) return `${Math.floor(s / 60)} min`;
  return `${Math.floor(s / 3600)} h`;
}

export function groups(state: TowerState, departing: Set<string>) {
  const queue = state.planes
    .filter((p) => p.need && !p.need.skipped && !departing.has(p.session))
    .sort((a, b) => (a.need!.rank ?? 999) - (b.need!.rank ?? 999) || (a.need!.since ?? 0) - (b.need!.since ?? 0));
  const flying = state.planes.filter((p) => p.status === "working" && !queue.includes(p) && !departing.has(p.session));
  const parked = state.planes.filter((p) => !queue.includes(p) && !flying.includes(p) && !departing.has(p.session));
  return { queue, flying, parked };
}

/** Follow the angled entry back to its taxiway, then leave room for readable labels. */
function linePosition(entry: Entry, index: number) {
  // Keep the next plane's nose behind the hold mark, including larger airframes.
  const distance = 30 + (index === 0 ? 0 : 126 + (index - 1) * 208);
  const radians = entry.heading * Math.PI / 180;
  const diagonal = Math.abs((entry.hold.y - entry.taxiY) / Math.cos(radians));
  const onEntry = distance < diagonal;
  const alongEntry = Math.min(distance, diagonal);
  return {
    x: entry.hold.x - Math.sin(radians) * alongEntry - Math.max(0, distance - diagonal),
    y: onEntry ? entry.hold.y + Math.cos(radians) * alongEntry : entry.taxiY,
    heading: onEntry ? entry.heading : 90,
    tag: onEntry ? "left" as const : entry.taxiY === NORTH_Y ? "above" as const : "below" as const,
  };
}

// Each idle agent keeps its stand while it stays parked, so the others never shuffle along.
const standOf = new Map<string, number>();

function assignStands(parked: Plane[]) {
  const here = new Set(parked.map((p) => p.session));
  for (const session of standOf.keys()) if (!here.has(session)) standOf.delete(session);
  const used = new Set(standOf.values());
  for (const p of parked) {
    if (standOf.has(p.session)) continue;
    const free = STANDS.findIndex((_, i) => !used.has(i));
    if (free < 0) break;
    standOf.set(p.session, free);
    used.add(free);
  }
}

export function layout({ queue, parked }: ReturnType<typeof groups>) {
  const spots = new Map<string, Spot>();
  const entry = ENTRIES.find((candidate) => candidate.id === "nc")!;
  // One departure line makes priority unambiguous: only #1 occupies the runway.
  queue.forEach((p, index) => {
    const position = index === 0
      ? { x: 890, y: RUNWAY_Y, heading: 90, tag: "above" as const }
      : linePosition(entry, index - 1);
    if (position.x < 100) return;
    spots.set(p.session, {
      ...position, scale: 1, kind: "queue", rank: index, entry: entry.id,
      runway: index === 0, follows: index > 0 ? queue[index - 1].session : undefined,
    });
  });
  const overflow = queue.length - spots.size;
  assignStands(parked);
  for (const p of parked) {
    const stand = STANDS[standOf.get(p.session) ?? -1];
    if (stand) spots.set(p.session, { x: stand.x, y: stand.y, heading: 0, scale: PARKED_SCALE, kind: "parked", tag: "none" });
  }
  // Working agents still contribute to the in-flight count, but have no visible plane.
  return { spots, overflow };
}
