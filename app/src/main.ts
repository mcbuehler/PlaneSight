// Plane Sight: a live airport over the coding agents in Herdr.
// Taxiway = agents that need you, in the tower's order. Gates and stands = idle agents.
// Working agents are hidden until they need attention. Click a plane to open its Herdr session.
import "./style.css";
import logoUrl from "./assets/plane-sight-logo.png?url";
import airportSignUrl from "./assets/agent-airport-international.png?url";
import { createAirport, screenResolution, type PlaneView, type StripView } from "./AirportScene";
import { drawRoads } from "./airfield";
import { H, STATUS_WORD, W, airframe, airline, groups, layout, name, tone } from "./model";
import { h, newFlightForm } from "./ui";
import type { Plane, Spot, TowerState } from "./types";
import { sentPane } from "./herdrEmbed";
import { Departures } from "./departures";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $("stage");
const viewport = stage.parentElement!;
const herdrView = $("herdr-view");
const viewSwitch = $<HTMLButtonElement>("switch-view");
const tower = $("tower");
const towerToggle = $<HTMLButtonElement>("tower-toggle");
let towerHovered = false;
let towerPinned = false;
let framedPane: string | null = null;
let lastHerdrPane: string | null = null;
let returningToAirport = false;

let state: TowerState = { now: 0, gemini: { enabled: false, lastError: null }, planes: [] };
let selected: string | null = null; // a session, or "new" for the new-flight form
let pinned = false; // true when you picked a plane; otherwise highlight #1
const departures = new Departures();
const departing = departures.sessions;
const grounds: number[][] = []; // development aid: where ground clicks landed

// ---------------------------------------------------------------- airport

const roads = await drawRoads(Math.max(2, Math.ceil(screenResolution())));
const airport = createAirport($("game"), {
  onSelect: (session) => {
    const plane = state.planes.find((p) => p.session === session);
    if (plane) openHerdr(plane);
  },
  onGround: (x, y) => {
    grounds.push([Math.round(x), Math.round(y)]);
    // the terminal in the top-left corner opens the new-flight form
    if (x > 20 && x < 160 && y > 10 && y < 120) select("new");
    else { selected = null; pinned = true; render(); }
  },
}, roads);

function fit() {
  const s = Math.min(viewport.clientWidth / W, viewport.clientHeight / H);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  airport.refresh();
}
window.addEventListener("resize", fit);
$<HTMLImageElement>("logo").src = logoUrl;
$<HTMLImageElement>("airport-sign").src = airportSignUrl;

// Hover the tower, focus it with the keyboard, or tap to keep its card open.
function updateTowerDisclosure() {
  const open = towerHovered || towerPinned || tower.contains(document.activeElement);
  towerToggle.setAttribute("aria-expanded", String(open));
  $("tower-info").hidden = !open;
  tower.classList.toggle("is-open", open);
}
tower.addEventListener("pointerenter", (event) => {
  if (event.pointerType === "touch") return;
  towerHovered = true;
  updateTowerDisclosure();
});
tower.addEventListener("pointerleave", () => {
  towerHovered = false;
  updateTowerDisclosure();
});
tower.addEventListener("focusin", updateTowerDisclosure);
tower.addEventListener("focusout", () => queueMicrotask(updateTowerDisclosure));
towerToggle.addEventListener("click", () => {
  towerPinned = !towerPinned;
  if (!towerPinned) towerToggle.blur();
  updateTowerDisclosure();
});
document.addEventListener("pointerdown", (event) => {
  if (tower.contains(event.target as Node)) return;
  towerPinned = false;
  updateTowerDisclosure();
});
tower.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  event.stopPropagation();
  towerHovered = false;
  towerPinned = false;
  towerToggle.blur();
  updateTowerDisclosure();
});

// ---------------------------------------------------------------- render

function render() {
  const g = groups(state, departing);
  const { spots, overflow } = layout(g);

  if (selected !== "new" && !state.planes.some((p) => p.session === selected)) selected = null;
  // follow #1 unless the user has picked a plane
  if (!pinned && selected !== "new" && !g.queue.some((p) => p.session === selected)) selected = g.queue[0]?.session ?? null;

  const views: PlaneView[] = state.planes
    .filter((p) => spots.has(p.session) && !departing.has(p.session))
    .map((p) => {
      const spot = spots.get(p.session)!;
      return { session: p.session, airline: airline(p), airframe: airframe(p), tone: spot.follows ? "alert" : tone(p), spot, strip: strip(p, spot) };
    });
  airport.scene.apply(views, selected === "new" ? null : selected);

  const rankerSource = state.ranker?.source ?? "";
  const usingGemini = rankerSource.startsWith("team")
    ? rankerSource.includes("gemini") && !state.ranker?.error
    : state.gemini.enabled && !state.gemini.lastError;
  tower.dataset.mode = usingGemini ? "gemini" : "fallback";
  $("tower-status").textContent = usingGemini ? "Keeping your agents in order." : "Using simple rules for now.";
  $("flight").textContent = g.flying.length ? `${g.flying.length} in flight` : "";
  $("overflow").textContent = overflow ? `+${overflow} more waiting` : "";
  updateNavigation();
  if (herdrView.hidden) renderNewFlightForm();
}

/** The flight strip of a plane in the queue, in the promo's style; the scene draws it. */
function strip(p: Plane, spot: Spot): StripView | null {
  if (spot.tag === "none") return null;
  const ahead = state.planes.find((plane) => plane.session === spot.follows);
  return {
    rank: (spot.rank ?? 0) + 1,
    name: name(p),
    status: spot.runway ? "Next to depart" : ahead ? `After ${name(ahead)}` : STATUS_WORD[tone(p)],
    next: spot.rank === 0,
    alert: Boolean(ahead) || tone(p) === "alert",
    selected: p.session === selected,
  };
}

function renderNewFlightForm() {
  const host = $("bubble");
  if (selected !== "new") { host.replaceChildren(); return; }
  // Preserve a partially filled launch form when agent state updates.
  if (host.contains(document.activeElement) && document.activeElement?.tagName === "TEXTAREA") return;
  const form = h("section", { class: "bubble tone-review is-below", "aria-label": "New flight" }, newFlightForm({ launch, close: () => select(null) }));
  form.style.left = "12px";
  form.style.top = "136px";
  form.style.setProperty("--tail-x", "78px");
  host.replaceChildren(form);
}

// ---------------------------------------------------------------- actions

function updateNavigation() {
  const showingHerdr = !herdrView.hidden;
  $("airport-banner").hidden = showingHerdr;
  const p = state.planes.find((plane) => plane.session === selected);
  viewSwitch.textContent = showingHerdr ? "← Back to airport" : "Herdr →";
  viewSwitch.setAttribute("aria-label", showingHerdr ? "Back to airport" : "Open Herdr");
  viewSwitch.setAttribute("aria-controls", showingHerdr ? "stage" : "herdr-view");
  $("view-title").textContent = showingHerdr ? "Herdr" : "Plane Sight";
  $("view-session").textContent = showingHerdr && framedPane === "overview" ? "All sessions" : p?.name ?? p?.title ?? "";
}

function showHerdr(p?: Plane) {
  if (returningToAirport || (p && (!p.herdrUrl || !p.pane))) return;
  // Keep the airport and its selection mounted; only the session view changes.
  if (p) { selected = p.session; pinned = true; lastHerdrPane = p.pane; }
  viewport.inert = true;
  viewport.setAttribute("aria-hidden", "true");
  herdrView.hidden = false;
  const pane = p?.pane ?? "overview";
  if (framedPane !== pane) {
    const url = new URL(p?.herdrUrl ?? state.herdrUrl ?? "http://127.0.0.1:7317/");
    url.searchParams.set("embed_origin", location.origin);
    const frame = h("iframe", { src: url.href, title: p ? `Herdr: ${p.name ?? p.title ?? p.agent}` : "Herdr web" });
    $("herdr-frame-host").replaceChildren(frame);
    framedPane = pane;
    viewSwitch.focus();
  }
  updateNavigation();
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
  viewSwitch.focus();
}

function syncHerdrRoute() {
  const pane = new URL(location.href).searchParams.get("herdr");
  if (!pane) { hideHerdr(); return; }
  if (pane === "overview") { showHerdr(); return; }
  const p = state.planes.find((plane) => plane.pane === pane);
  if (p) showHerdr(p);
}

function openHerdr(p: Plane) {
  if (!p.herdrUrl || !p.pane) return;
  navigateToHerdr(p.pane);
}

function navigateToHerdr(pane: string) {
  const url = new URL(location.href);
  url.searchParams.set("herdr", pane);
  history.pushState({ planeSightHerdr: true }, "", url);
  syncHerdrRoute();
}

function openHerdrFromBar() {
  const available = state.planes.filter((p) => p.pane && p.herdrUrl);
  const target = available.find((p) => p.session === selected)
    ?? available.find((p) => p.pane === lastHerdrPane)
    ?? groups(state, departing).queue.find((p) => p.pane && p.herdrUrl)
    ?? available[0];
  navigateToHerdr(target?.pane ?? "overview");
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

viewSwitch.addEventListener("click", () => {
  if (herdrView.hidden) openHerdrFromBar();
  else returnToAirport();
});
window.addEventListener("message", (event) => {
  if (herdrView.hidden) return;
  const frame = $("herdr-frame-host").querySelector("iframe");
  if (!frame) return;
  const pane = sentPane(event, frame);
  if (!pane) return;
  const plane = state.planes.find((p) => p.pane === pane);
  if (plane) {
    selected = plane.session;
    pinned = true;
    sendOff(plane);
  }
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
  render();
}

function sendOff(plane: Plane) {
  if (!departures.start(plane)) return;
  airport.scene.takeoff(plane.session, () => {
    departures.finish(plane.session, state.planes);
    render();
  });
  render();
}

function launch() {
  const repo = $<HTMLInputElement>("repo").value.trim();
  const box = $<HTMLTextAreaElement>("prompt");
  const prompt = box.value.trim();
  if (!repo || !prompt) return;
  try { localStorage.setItem("planesight:repo", repo); } catch { /* storage blocked */ }
  box.blur();
  const kind = $<HTMLSelectElement>("kind").value;
  select(null);
  void post("/api/launch", { repo, prompt, kind });
}

// ---------------------------------------------------------------- keyboard

document.addEventListener("keydown", (e) => {
  if (!herdrView.hidden) return;
  const target = e.target as HTMLElement;
  const inField = target.closest?.("input, textarea, select");
  const p: Plane | undefined = state.planes.find((x) => x.session === selected);
  if (e.key === "Escape") { selected = null; pinned = true; target.blur?.(); render(); return; }
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && selected === "new") {
    e.preventDefault();
    launch();
    return;
  }
  if (inField || target.closest?.("button, a")) return;
  const { queue } = groups(state, departing);
  if (e.key === "Enter" && p) {
    e.preventDefault();
    if (!e.repeat) openHerdr(p);
  } else if (e.key === "n" || e.key === "N") select("new");
  else if (["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown", "Tab"].includes(e.key) && queue.length) {
    e.preventDefault();
    const i = queue.findIndex((x) => x.session === selected);
    const step = e.key === "ArrowLeft" || e.key === "ArrowDown" || (e.key === "Tab" && !e.shiftKey) ? 1 : -1;
    select(queue[(Math.max(i, 0) + step + queue.length) % queue.length].session);
  }
});

// ---------------------------------------------------------------- boot

await document.fonts.ready;
fit();
const events = new EventSource("/events");
events.onmessage = (e) => {
  const next = JSON.parse(e.data) as TowerState;
  // Also animate submissions made directly in Herdr before its send event arrives.
  // Otherwise the transient need=null/status=done snapshot routes a queued plane to a stand.
  for (const plane of state.planes) {
    const updated = next.planes.find((candidate) => candidate.session === plane.session);
    if (plane.need && !plane.need.skipped && updated && !updated.need) sendOff(plane);
  }
  state = next;
  departures.reconcile(state.planes);
  render();
  syncHerdrRoute();
};

// Development only: lets browser scripts select planes that are hard to hit while they move.
if (import.meta.env.DEV) Object.assign(window, { planesight: { select, state: () => state, debug: () => ({ selected, pinned, grounds, departing: [...departing] }), position: (s: string) => airport.scene.positionOf(s) } });
