// The HTML layer over the airport: flight tags that follow the planes, and the bubble.
import { AIRLINE_NAME, STATUS_WORD, airline, flightId, name, short, tone, waited } from "./model";
import type { Action, Need, Plane, Spot } from "./types";

type Child = Node | string | null | undefined | false | Child[];

export function h(tag: string, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElement {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v as EventListener);
    else if (v !== null && v !== undefined && v !== false) e.setAttribute(k, String(v));
  }
  const flat = (c: Child): (Node | string)[] => (Array.isArray(c) ? c.flatMap(flat) : c ? [c] : []);
  e.append(...children.flatMap(flat));
  return e;
}

// ---------------------------------------------------------------- flight tags

const tags = new Map<string, HTMLElement>();

/** One strip per plane in the queue, in the promo's flight-strip style. */
export function renderTags(host: HTMLElement, planes: Plane[], spots: Map<string, Spot>, selected: string | null) {
  const seen = new Set<string>();
  for (const p of planes) {
    const spot = spots.get(p.session);
    if (!spot || spot.tag === "none") continue;
    seen.add(p.session);
    let tag = tags.get(p.session);
    if (!tag) {
      tag = h("div", { class: "tag" });
      tags.set(p.session, tag);
      host.append(tag);
    }
    const status = p.need?.collision ? `Collides with ${p.need.collision.other}` : STATUS_WORD[tone(p)];
    tag.className = `tag ${airline(p)} tone-${tone(p)} is-${spot.tag}${spot.rank === 0 ? " is-next" : ""}${p.session === selected ? " is-selected" : ""}`;
    tag.replaceChildren(
      h("span", { class: "tag-line" }, h("b", {}, `${(spot.rank ?? 0) + 1}`), h("strong", {}, short(name(p), 14)), h("small", {}, flightId(p))),
      h("span", { class: "tag-status" }, status),
    );
  }
  for (const [session, tag] of tags) {
    if (seen.has(session)) continue;
    tag.remove();
    tags.delete(session);
  }
}

export function positionTags(positions: Map<string, { x: number; y: number; visible: boolean }>) {
  for (const [session, tag] of tags) {
    const at = positions.get(session);
    if (!at) continue;
    tag.style.transform = `translate(${at.x}px, ${at.y}px)`;
    tag.style.opacity = at.visible ? "1" : "0";
  }
}

// ---------------------------------------------------------------- bubble

export interface BubbleActions {
  accept: (p: Plane) => void;
  startEdit: () => void;
  sendEdit: (p: Plane, action: Action) => void;
  cancelEdit: () => void;
  skip: (p: Plane) => void;
  toggleOutput: () => void;
  focus: (p: Plane) => void;
  sendPrompt: (p: Plane) => void;
  stop: (p: Plane) => void;
  launch: () => void;
  close: () => void;
}

const ACTIONS: Record<Action, { label: string; head: string }> = {
  allow: { label: "Approve", head: "Proposed: approve" },
  deny: { label: "Deny", head: "Proposed: deny and tell it why" },
  answer: { label: "Answer", head: "Proposed answer" },
  prompt: { label: "Send", head: "Proposed next prompt" },
  dismiss: { label: "Park it", head: "Nothing more to do" },
};
export const EDIT_ACTION: Partial<Record<Action, Action>> = { allow: "deny", dismiss: "prompt" };

function head(p: Plane) {
  return h("div", { class: "bubble-head" },
    h("strong", {}, short(name(p), 24)),
    h("small", {}, `${AIRLINE_NAME[airline(p)]} ${flightId(p)}`),
    h("span", { class: "kind" }, STATUS_WORD[tone(p)]),
    h("span", { class: "wait" }, p.need ? waited(p.need.since) : ""));
}

function wants(n: Need) {
  if (n.kind === "approval") return `Asks to run ${n.request?.tool ?? "a tool"}.`;
  if (n.kind === "question") return "Asks you a question.";
  if (n.kind === "landed") return "Finished its turn.";
  return "Waits at a prompt in its terminal.";
}

function secondary(p: Plane, a: BubbleActions, outputOpen: boolean) {
  return h("span", { class: "secondary" },
    h("button", { class: "small", onclick: () => a.toggleOutput() }, outputOpen ? "Hide output" : "Output"),
    h("button", { class: "small", onclick: () => a.focus(p) }, "Herdr"));
}

function output(p: Plane) {
  const pre = h("pre", { class: "output" }, "…");
  fetch(`/api/tail/${p.session}`).then((r) => r.text()).then((t) => {
    pre.textContent = t.trimEnd() || "(empty)";
    pre.scrollTop = pre.scrollHeight;
  });
  return pre;
}

export function decision(p: Plane, a: BubbleActions, editing: boolean, outputOpen: boolean) {
  const n = p.need!;
  const card = n.card;
  const action = card?.proposal.action ?? "allow";
  const editAction = EDIT_ACTION[action] ?? action;
  return [
    head(p),
    n.reason && h("p", { class: "why" }, h("b", {}, n.urgency === null ? "Tower" : `Urgency ${n.urgency}`), n.reason),
    h("p", { class: "summary" }, card?.summary ?? n.message ?? (n.cardPending ? "The tower is reading this agent." : wants(n))),
    n.collision && h("p", { class: "collision" }, `${n.collision.other} already edited ${n.collision.file}.`),
    editing
      ? h("textarea", { id: "edit", "aria-label": editAction === "prompt" ? "Your next prompt" : "Your answer" }, card?.proposal.text ?? "")
      : card && h("p", { class: "proposal" }, h("b", {}, ACTIONS[action].head), card.proposal.text || card.reasoning),
    h("div", { class: "actions" },
      editing
        ? [h("button", { class: "primary", onclick: () => a.sendEdit(p, editAction) }, "Send", h("kbd", {}, "⌘⏎")),
           h("button", { onclick: () => a.cancelEdit() }, "Cancel")]
        : [h("button", { class: "primary", disabled: card ? null : "", onclick: () => a.accept(p) }, ACTIONS[action].label, h("kbd", {}, "⏎")),
           h("button", { disabled: card ? null : "", onclick: () => a.startEdit() }, "Edit", h("kbd", {}, "E")),
           h("button", { onclick: () => a.skip(p) }, "Skip", h("kbd", {}, "S"))],
      secondary(p, a, outputOpen)),
    outputOpen && output(p),
  ];
}

export function flightCard(p: Plane, a: BubbleActions, outputOpen: boolean) {
  const working = p.status === "working";
  return [
    head(p),
    h("p", { class: "summary" }, working ? `Working in ${p.repo ?? "its worktree"}.` : `Idle in ${p.repo ?? "its worktree"}.`),
    h("textarea", { id: "prompt", placeholder: working ? "Queue a message for this agent" : "What should it do next?", "aria-label": "Prompt" }),
    h("div", { class: "actions" },
      h("button", { class: "primary", onclick: () => a.sendPrompt(p) }, "Send", h("kbd", {}, "⌘⏎")),
      working && h("button", { onclick: () => a.stop(p) }, "Stop"),
      secondary(p, a, outputOpen)),
    outputOpen && output(p),
  ];
}

export function newFlightForm(a: BubbleActions) {
  let repo = "";
  try { repo = localStorage.getItem("planesight:repo") ?? ""; } catch { /* storage blocked */ }
  return [
    h("div", { class: "bubble-head" }, h("strong", {}, "New flight"), h("span", { class: "kind" }, "Starts an agent in its own worktree")),
    h("input", { id: "repo", class: "field", placeholder: "/path/to/repo", value: repo, "aria-label": "Repository" }),
    h("select", { id: "kind", class: "field", "aria-label": "Airline" },
      h("option", { value: "claude" }, "Cloud Code (Claude Code)"),
      h("option", { value: "codex" }, "OpenAir (Codex)")),
    h("textarea", { id: "prompt", placeholder: "What should the agent do?", "aria-label": "Task" }),
    h("div", { class: "actions" },
      h("button", { class: "primary", onclick: () => a.launch() }, "Take off", h("kbd", {}, "⌘⏎")),
      h("button", { onclick: () => a.close() }, "Cancel")),
  ];
}
