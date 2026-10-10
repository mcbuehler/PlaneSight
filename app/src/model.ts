// Turns the server's agents into planes on the airfield: who needs you, who is parked, who is flying.
import { BEHIND, ENTRIES, H, NORTH_Y, PARKED_SCALE, STANDS, W } from "./airfield";
import type { Airframe, Airline, Plane, Spot, Tone, TowerState } from "./types";

export { H, W };

/** Agents that have spent this many tokens fly a widebody. */
const WIDEBODY_TOKENS = 400_000;

export function tone(p: Plane): Tone {
  const n = p.need;
  if (!n || n.skipped) return p.status === "working" ? "flying" : "parked";
  const c = n.card?.category;
  if (n.collision || c === "collision" || c === "error") return "alert";
  if (n.kind === "landed" || c === "review") return "review";
  if (n.kind === "question" || c === "design_decision" || c === "clarification") return "decide";
  return "approve";
}

export const STATUS_WORD: Record<Tone, string> = {
  approve: "Needs approval",
  decide: "Needs a decision",
  review: "Ready for review",
  alert: "Collision",
  parked: "At the stand",
  flying: "In flight",
};

export const airline = (p: Plane): Airline => (p.agent === "codex" ? "openair" : "cloud-code");
export const airframe = (p: Plane): Airframe => ((p.tokens ?? 0) >= WIDEBODY_TOKENS ? "widebody" : "narrowbody");
export const AIRLINE_NAME: Record<Airline, string> = { "cloud-code": "Cloud Code", openair: "OpenAir" };

/** A stable flight number per agent session, such as CC-104. */
export function flightId(p: Plane) {
  let hash = 0;
  for (const ch of p.session) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return `${airline(p) === "openair" ? "OA" : "CC"}-${100 + (hash % 900)}`;
}

export const name = (p: Plane) => p.name ?? p.need?.card?.title ?? p.title?.split(" ").slice(0, 3).join(" ") ?? p.session.slice(0, 6);
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

export function layout({ queue, flying, parked }: ReturnType<typeof groups>) {
  const spots = new Map<string, Spot>();
  queue.forEach((p, i) => {
    const entry = ENTRIES[i];
    if (entry) {
      spots.set(p.session, { x: entry.hold.x, y: entry.hold.y, heading: entry.heading, scale: 1, kind: "queue", rank: i, entry: entry.id, tag: "left" });
      return;
    }
    const slot = BEHIND[i - ENTRIES.length];
    if (!slot) return;
    const taxiY = ENTRIES.find((e) => e.id === slot.entry)!.taxiY;
    spots.set(p.session, { x: slot.x, y: taxiY, heading: 90, scale: 1, kind: "queue", rank: i, entry: slot.entry, tag: taxiY === NORTH_Y ? "above" : "below" });
  });
  assignStands(parked);
  for (const p of parked) {
    const stand = STANDS[standOf.get(p.session) ?? -1];
    if (stand) spots.set(p.session, { x: stand.x, y: stand.y, heading: 0, scale: PARKED_SCALE, kind: "parked", tag: "none" });
  }
  const cols = Math.min(Math.max(flying.length, 1), 6);
  flying.forEach((p, i) => {
    const x = 330 + (i % cols) * (780 / Math.max(cols - 1, 1));
    const y = 640 + Math.floor(i / cols) * 46 + (i % 2) * 14;
    spots.set(p.session, { x, y, heading: 70, scale: 0.42, kind: "flying", tag: "none" });
  });
  const overflow = Math.max(0, queue.length - ENTRIES.length - BEHIND.length);
  return { spots, overflow };
}
