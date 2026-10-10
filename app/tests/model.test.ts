import { expect, it } from "bun:test";
import { groups, layout } from "../src/model";
import type { Plane, TowerState } from "../src/types";

function plane(session: string, rank: number, other?: string): Plane {
  return {
    session, name: session, pane: session, herdrUrl: null, agent: "claude", title: null,
    repo: "demo", status: "done", tokens: null, files: [],
    need: {
      kind: "landed", key: session, skipped: false, since: rank, rank,
      reason: null, urgency: null, request: null, message: null, card: null, cardPending: false,
      collision: other ? { file: "shared.js", other, otherSession: other } : null,
    },
  };
}

function state(planes: Plane[]): TowerState {
  return { now: 0, gemini: { enabled: true, lastError: null }, planes };
}

it("puts only the highest-priority plane on the runway with the others in one ranked line", () => {
  const auth = plane("authentication", 0, "api");
  const api = plane("api", 1, "authentication");
  const dashboard = plane("dashboard", 2);
  const accessibility = plane("accessibility", 3);
  const landing = plane("landing-page", 4);
  const { spots, overflow } = layout(groups(state([landing, dashboard, api, accessibility, auth]), new Set()));
  expect(overflow).toBe(0);
  expect([...spots.values()].filter(spot => spot.runway).length).toBe(1);
  expect(spots.get(auth.session)!.runway).toBe(true);
  expect(spots.get(auth.session)!.y).toBe(380);
  expect(spots.get(auth.session)!.heading).toBe(90);
  expect([...spots.values()].map(spot => spot.rank)).toEqual([0, 1, 2, 3, 4]);
  expect([...spots.values()].map(spot => spot.follows)).toEqual([undefined, auth.session, api.session, dashboard.session, accessibility.session]);
  expect(new Set([...spots.values()].map(spot => spot.entry)).size).toBe(1);
  const positions = [...spots.values()];
  for (let i = 1; i < positions.length; i++) {
    expect(positions[i].x).toBeLessThan(positions[i - 1].x);
    expect(positions[i].y + 40).toBeLessThan(336);
  }
});

it("keeps the tower's order even when shared-file relationships are reciprocal or cyclic", () => {
  const planes = [plane("c", 2, "a"), plane("b", 1, "c"), plane("a", 0, "b")];
  const { spots } = layout(groups(state(planes), new Set()));
  expect([...spots.keys()]).toEqual(["a", "b", "c"]);
  expect(spots.get("a")!.follows).toBeUndefined();
  expect(spots.get("b")!.follows).toBe("a");
  expect(spots.get("c")!.follows).toBe("b");
});

it("promotes the next plane onto the runway and keeps working planes hidden", () => {
  const auth = { ...plane("authentication", 0, "api"), status: "working", need: null };
  const api = plane("api", 1, "authentication");
  const grouped = groups(state([auth, api]), new Set());
  const { spots } = layout(grouped);
  expect(grouped.flying).toEqual([auth]);
  expect(spots.has(auth.session)).toBe(false);
  expect(spots.get(api.session)!.follows).toBeUndefined();
  expect(spots.get(api.session)!.runway).toBe(true);
  expect(spots.get(api.session)!.y).toBe(380);
});

it("leaves room between all five planes and the horizontal labels", () => {
  const queue = Array.from({ length: 5 }, (_, i) => plane(`p${i}`, i));
  const { spots, overflow } = layout({ queue, parked: [], flying: [] });
  expect(overflow).toBe(0);
  expect(spots.size).toBe(5);
  const positions = [...spots.values()];
  for (const spot of positions) expect(spot.x).toBeGreaterThanOrEqual(100);
  for (let i = 1; i < positions.length; i++) {
    const a = positions[i - 1], b = positions[i];
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(110);
    if (a.y === b.y && !a.runway) expect(a.x - b.x).toBeGreaterThanOrEqual(200);
  }
});

it("accounts for a longer queue's overflow without placing extra planes on the runway", () => {
  const queue = Array.from({ length: 24 }, (_, i) => plane(`p${i}`, i));
  const { spots, overflow } = layout({ queue, parked: [], flying: [] });
  expect(spots.size + overflow).toBe(queue.length);
  expect(overflow).toBeGreaterThan(0);
  expect([...spots.values()].filter(spot => spot.runway).length).toBe(1);
  expect(new Set([...spots.values()].map(spot => `${spot.x}:${spot.y}`)).size).toBe(spots.size);
});

it("keeps an empty departure queue clear", () => {
  const idle = { ...plane("idle", 0), status: "idle", need: null };
  const { spots, overflow } = layout(groups(state([idle]), new Set()));
  expect(overflow).toBe(0);
  expect([...spots.values()].filter(spot => spot.runway).length).toBe(0);
  expect(spots.get(idle.session)!.kind).toBe("parked");
});
