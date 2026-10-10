import type { Plane } from "./types";

/** Keep a sent plane out of the queue until both takeoff and a fresh agent status arrive. */
export class Departures {
  readonly sessions = new Set<string>();
  private pending = new Map<string, { needKey: string | null; finished: boolean }>();

  start(plane: Plane) {
    if (this.pending.has(plane.session)) return false;
    this.pending.set(plane.session, { needKey: plane.need?.key ?? null, finished: false });
    this.sessions.add(plane.session);
    return true;
  }

  finish(session: string, planes: Plane[]) {
    const departure = this.pending.get(session);
    if (departure) departure.finished = true;
    this.reconcile(planes);
  }

  reconcile(planes: Plane[]) {
    for (const [session, departure] of this.pending) {
      const plane = planes.find((candidate) => candidate.session === session);
      // A send notification can beat the hooks/poller. The old need, and the brief
      // gap before "working", must never put this plane back at its stand or runway.
      const fresh = !plane || (plane.status === "working" && !plane.need)
        || (plane.need != null && plane.need.key !== departure.needKey);
      if (departure.finished && fresh) {
        this.pending.delete(session);
        this.sessions.delete(session);
      }
    }
  }
}
