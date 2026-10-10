// The new-agent form. Existing planes open their Herdr session directly.

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

export function newFlightForm(a: { launch: () => void; close: () => void }) {
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
