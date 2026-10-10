import type { Plane } from "./types";

/** Only the currently embedded Herdr window can complete this handoff. */
export function sentPane(event: Pick<MessageEvent, "source" | "origin" | "data">, frame: Pick<HTMLIFrameElement, "contentWindow" | "src">): string | null {
  if (event.source !== frame.contentWindow || !frame.contentWindow) return null;
  if (event.origin !== new URL(frame.src).origin) return null;
  const message: unknown = event.data;
  if (!message || typeof message !== "object") return null;
  const { type, machineId, paneId } = message as Record<string, unknown>;
  return type === "herdr:message-sent" && machineId === "local" && typeof paneId === "string" && paneId.length > 0 ? paneId : null;
}
/** Native terminal input has no composer receipt; the agent starting work is its receipt. */
export function resumedPane(pane: string | null, previous: Plane[], next: Plane[]): Plane | null {
  if (!pane || pane === "overview") return null;
  const before = previous.find((plane) => plane.pane === pane);
  if (!before || before.status === "working") return null;
  const after = next.find((plane) => plane.session === before.session && plane.pane === pane);
  return after?.status === "working" && !after.need ? before : null;
}
