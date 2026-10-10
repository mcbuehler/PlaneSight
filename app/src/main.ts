// Plane Sight: a live airport over the coding agents in Herdr.
// Taxiway = agents that need you, in the tower's order. Gates and stands = idle agents.
// Working agents are hidden until they need attention. Click a waiting plane to inspect it.
import "./style.css";
import logoUrl from "../../public/branding/plane-sight-logo.png?url";
import { PLANE_SIZE, createAirport, screenResolution, type PlaneView, type StripView } from "./AirportScene";
import { drawRoads } from "./airfield";
import { H, STATUS_WORD, W, airframe, airline, flightId, groups, layout, name, tone, waited } from "./model";
import { EDIT_ACTION, decision, flightCard, h, newFlightForm, type BubbleActions } from "./ui";
import type { Action, Plane, Spot, TowerState } from "./types";
import { sentPane } from "./herdrEmbed";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage");
const viewport = stage.parentElement!;
const herdrView = $("herdr-view");
let framedPane: string | null = null;
let returningToAirport = false;

let state: TowerState = { now: 0, gemini: { enabled: false, lastError: null }, planes: [] };
let selected: string | null = null; // a session, or "new" for the new-flight form
let pinned = false; // true when you picked the plane; otherwise the bubble follows #1
let editing = false;
let outputOpen = false;
let shownAt = 0;
let lastKey: string | null = null;
const departing = new Set<string>();
const grounds: number[][] = []; // development aid: where ground clicks landed

// ---------------------------------------------------------------- airport

const roads = await drawRoads(Math.max(2, Math.ceil(screenResolution())));
const airport = createAirport($("game"), {
  onSelect: (session) => select(session),
  onGround: (x, y) => {
    grounds.push([Math.round(x), Math.round(y)]);
    // the terminal in the top-left corner opens the new-flight form; anything else closes the bubble
    if (x > 20 && x < 160 && y > 10 && y < 120) select("new");
    else { selected = null; pinned = true; editing = false; render(); }
  },
}, roads);

function fit() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  airport.refresh();
}
window.addEventListener("resize", fit);
$<HTMLImageElement>("logo").src = logoUrl;

// ---------------------------------------------------------------- render

function render() {
  const g = groups(state, departing);
  const { spots, overflow } = layout(g);

  if (selected !== "new" && !state.planes.some((p) => p.session === selected)) selected = null;
  // follow #1, but never move a bubble away from a plane that still needs you
  if (!pinned && selected !== "new" && !g.queue.some((p) => p.session === selected)) selected = g.queue[0]?.session ?? null;
  const sel = state.planes.find((p) => p.session === selected);
  const key = sel ? `${sel.session}:${sel.need?.key ?? sel.status}` : selected;
  if (key !== lastKey) { lastKey = key; shownAt = Date.now(); editing = false; }

  const views: PlaneView[] = state.planes
    .filter((p) => spots.has(p.session) && !departing.has(p.session))
    .map((p) => {
      const spot = spots.get(p.session)!;
      return { session: p.session, airline: airline(p), airframe: airframe(p), tone: tone(p), spot, strip: strip(p, spot) };
    });
  airport.scene.apply(views, selected === "new" ? null : selected);

  const team = state.ranker?.source.startsWith("team");
  $("tower").textContent = team ? "Tower: team ranker" : state.gemini.enabled ? "Gemini 3.8 Flash" : "Simple rules";
  $("tower").title = state.ranker?.error ?? state.ranker?.explanation ?? "";
  $("flight").textContent = g.flying.length ? `${g.flying.length} in flight` : "";
  $("overflow").textContent = overflow ? `+${overflow} more waiting` : "";
  if (herdrView.hidden) renderBubble(spots);
}

/** The flight strip of a plane in the queue, in the promo's style; the scene draws it. */
function strip(p: Plane, spot: Spot): StripView | null {
  if (spot.tag === "none") return null;
  return {
    rank: (spot.rank ?? 0) + 1,
    name: name(p),
    flight: flightId(p),
    status: p.need?.collision ? `Collides with ${p.need.collision.other}` : STATUS_WORD[tone(p)],
    next: spot.rank === 0,
    alert: tone(p) === "alert",
    selected: p.session === selected,
  };
}

function renderBubble(spots: ReturnType<typeof layout>["spots"]) {
  const host = $("bubble");
  // keep a half-typed answer or prompt; the next update redraws the bubble after it is sent
  if (host.contains(document.activeElement) && document.activeElement?.tagName === "TEXTAREA") return;
  if (!selected) { host.replaceChildren(); return; }

  let anchor: { x: number; y: number; bottom: number };
  let body;
  if (selected === "new") {
    anchor = { x: 90, y: 120, bottom: 120 };
    body = newFlightForm(actions);
  } else {
    const p = state.planes.find((x) => x.session === selected);
    const spot = spots.get(selected!);
    if (!p || !spot) { host.replaceChildren(); return; }
    // circling planes are anchored where they are now; everything else where it is going
    const at = (spot.kind === "flying" && airport.scene.positionOf(p.session)) || spot;
    const half = (PLANE_SIZE[airframe(p)] / 2) * spot.scale;
    anchor = { x: at.x, y: at.y - half - 4, bottom: at.y + half + 4 };
    body = p.need && !p.need.skipped ? decision(p, actions, editing, outputOpen) : flightCard(p, actions, outputOpen);
  }

  const toneName = selected === "new" ? "review" : tone(state.planes.find((x) => x.session === selected)!);
  const bubble = h("section", { class: `bubble tone-${toneName}` }, body);
  host.replaceChildren(bubble);
  // above the anchor, kept inside the picture
  const bw = 380;
  const left = Math.min(Math.max(anchor.x - bw / 2, 12), W - bw - 12);
  const height = bubble.offsetHeight;
  const below = anchor.y - height - 24 < 8;
  bubble.style.left = `${left}px`;
  bubble.style.top = `${below ? anchor.bottom + 16 : anchor.y - height - 16}px`;
  bubble.style.setProperty("--tail-x", `${Math.min(Math.max(anchor.x - left, 24), bw - 24)}px`);
  bubble.classList.toggle("is-below", below);
}

// ---------------------------------------------------------------- actions

function showHerdr(p: Plane) {
  if (!p.herdrUrl || !p.pane || returningToAirport) return;
  // Keep the airport and its selection mounted; only the session view changes.
  selected = p.session;
  pinned = true;
  viewport.inert = true;
  viewport.setAttribute("aria-hidden", "true");
  herdrView.hidden = false;
  $("herdr-session").textContent = p.name ?? p.title ?? p.agent;
  if (framedPane !== p.pane) {
    const url = new URL(p.herdrUrl);
    url.searchParams.set("embed_origin", location.origin);
    const frame = h("iframe", { src: url.href, title: `Herdr: ${p.name ?? p.title ?? p.agent}` });
    $("herdr-frame-host").replaceChildren(frame);
    framedPane = p.pane;
    $("back-to-airport").focus();
  }
}

function hideHerdr() {
  if (herdrView.hidden) return;
  herdrView.hidden = true;
  // Unmount the frame so its terminal connection is released on return.
  $("herdr-frame-host").replaceChildren();
  framedPane = null;
  viewport.inert = false;
  viewport.removeAttribute("aria-hidden");
  render();
  document.querySelector<HTMLButtonElement>("[data-open-herdr]")?.focus();
}

function syncHerdrRoute() {
  const pane = new URL(location.href).searchParams.get("herdr");
  if (!pane) { hideHerdr(); return; }
  const p = state.planes.find((plane) => plane.pane === pane);
  if (p) showHerdr(p);
}

function openHerdr(p: Plane) {
  if (!p.herdrUrl || !p.pane) return;
  const url = new URL(location.href);
  url.searchParams.set("herdr", p.pane);
  history.pushState({ planeSightHerdr: true }, "", url);
  showHerdr(p);
}

function returnToAirport() {
  if (herdrView.hidden || returningToAirport) return;
  returningToAirport = true;
  if (history.state?.planeSightHerdr) history.back();
  else {
    // A bookmarked session URL might not have an airport history entry.
    const url = new URL(location.href);
    url.searchParams.delete("herdr");
    history.replaceState(null, "", url);
    hideHerdr();
    returningToAirport = false;
  }
}

$("back-to-airport").addEventListener("click", returnToAirport);
window.addEventListener("message", (event) => {
  if (herdrView.hidden) return;
  const frame = $("herdr-frame-host").querySelector("iframe");
  if (!frame) return;
  const pane = sentPane(event, frame);
  if (!pane) return;
  const plane = state.planes.find((p) => p.pane === pane);
  if (plane) { selected = plane.session; pinned = true; }
  returnToAirport();
});
window.addEventListener("popstate", () => {
  returningToAirport = false;
  syncHerdrRoute();
});

async function post(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }).catch(() => null);
  if (!res?.ok) console.warn(url, res && (await res.text()));
  return res;
}

function select(session: string | null) {
  selected = session;
  pinned = session !== null;
  outputOpen = false;
  editing = false;
  render();
}

function takeoff(session: string) {
  departing.add(session);
  airport.scene.takeoff(session, () => { departing.delete(session); render(); });
}

function answered() {
  selected = null;
  pinned = false;
  editing = false;
  render();
}

const actions: BubbleActions = {
  accept(p) {
    const card = p.need?.card;
    if (!card) return;
    if (card.proposal.action !== "dismiss") takeoff(p.session);
    answered();
    void post(`/api/answer/${p.session}`, { choice: "accept", key: p.need!.key });
  },
  startEdit() {
    editing = true;
    render();
    const t = $<HTMLTextAreaElement>("edit");
    t?.focus();
    t?.setSelectionRange(t.value.length, t.value.length);
  },
  sendEdit(p, action: Action) {
    const text = $<HTMLTextAreaElement>("edit")?.value.trim() ?? "";
    takeoff(p.session);
    answered();
    void post(`/api/answer/${p.session}`, { choice: "edit", action, text, key: p.need!.key });
  },
  cancelEdit() { editing = false; render(); },
  skip(p) { void post(`/api/answer/${p.session}`, { choice: "skip", key: p.need!.key }); },
  toggleOutput() { outputOpen = !outputOpen; render(); },
  openHerdr,
  sendPrompt(p) {
    const box = $<HTMLTextAreaElement>("prompt");
    const text = box?.value.trim();
    if (!text) return;
    box.blur();
    if (p.status !== "working") takeoff(p.session);
    answered();
    void post(`/api/prompt/${p.session}`, { text });
  },
  stop(p) { void post(`/api/stop/${p.session}`); },
  launch() {
    const repo = $<HTMLInputElement>("repo").value.trim();
    const box = $<HTMLTextAreaElement>("prompt");
    const prompt = box.value.trim();
    if (!repo || !prompt) return;
    try { localStorage.setItem("planesight:repo", repo); } catch { /* storage blocked */ }
    box.blur();
    const kind = $<HTMLSelectElement>("kind").value;
    answered();
    void post("/api/launch", { repo, prompt, kind });
  },
  close() { select(null); },
};

// ---------------------------------------------------------------- keyboard

document.addEventListener("keydown", (e) => {
  if (!herdrView.hidden) return;
  const target = e.target as HTMLElement;
  const inField = target.closest?.("input, textarea, select");
  const p: Plane | undefined = state.planes.find((x) => x.session === selected);
  if (e.key === "Escape") { editing = false; selected = null; pinned = true; target.blur?.(); render(); return; }
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (selected === "new") actions.launch();
    else if (editing && p?.need?.card) actions.sendEdit(p, EDIT_ACTION[p.need.card.proposal.action] ?? p.need.card.proposal.action);
    else if (p && $("prompt")) actions.sendPrompt(p);
    return;
  }
  if (inField || target.closest?.("button, a")) return;
  const { queue } = groups(state, departing);
  if (e.key === "Enter" && p?.need && !p.need.skipped) {
    e.preventDefault();
    // a bubble that just opened is read before it is answered
    if (!e.repeat && Date.now() - shownAt > 700) actions.accept(p);
  } else if ((e.key === "e" || e.key === "E") && p?.need) { e.preventDefault(); actions.startEdit(); }
  else if ((e.key === "s" || e.key === "S") && p?.need) actions.skip(p);
  else if (e.key === "n" || e.key === "N") select("new");
  else if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Tab"].includes(e.key) && queue.length) {
    e.preventDefault();
    const i = queue.findIndex((x) => x.session === selected);
    const step = e.key === "ArrowLeft" || e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey) ? 1 : -1;
    select(queue[(Math.max(i, 0) + step + queue.length) % queue.length].session);
  }
});

// waiting times tick without redrawing the bubble
setInterval(() => {
  const wait = document.querySelector(".bubble .wait");
  const p = state.planes.find((x) => x.session === selected);
  if (wait && p?.need) wait.textContent = waited(p.need.since);
}, 1000);

// ---------------------------------------------------------------- boot

await document.fonts.ready;
fit();
const events = new EventSource("/events");
events.onmessage = (e) => {
  state = JSON.parse(e.data) as TowerState;
  render();
  syncHerdrRoute();
};

// Development only: lets browser scripts select planes that are hard to hit while they move.
if (import.meta.env.DEV) Object.assign(window, { planesight: { select, state: () => state, debug: () => ({ selected, pinned, grounds }), position: (s: string) => airport.scene.positionOf(s) } });
