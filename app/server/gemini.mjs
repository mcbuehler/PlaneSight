// The control tower: Gemini writes one card per item that needs the user, and ranks the queue.
// Without GEMINI_API_KEY both calls fall back to simple heuristics so the UI still works.
import { GoogleGenAI } from "@google/genai";

const MODEL = process.env.PLANESIGHT_MODEL ?? "gemini-3.8-flash";
const RANK_MODEL = process.env.PLANESIGHT_RANK_MODEL ?? MODEL;
const client = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export const geminiEnabled = () => client !== null;
export const status = { lastError: null, calls: 0 };

async function json(model, system, input, schema) {
  status.calls++;
  const interaction = await client.interactions.create({
    model,
    system_instruction: system,
    input: JSON.stringify(input),
    response_format: { type: "text", mime_type: "application/json", schema },
  });
  return JSON.parse(interaction.output_text);
}

const CARD_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "3 to 6 words naming what the agent works on" },
    summary: { type: "string", description: "At most 2 short sentences: what the agent did and what it needs now" },
    category: { type: "string", enum: ["tool_approval", "design_decision", "clarification", "review", "error", "collision"] },
    proposal: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["allow", "deny", "answer", "prompt", "dismiss"] },
        text: { type: "string", description: "Deny reason, answer, or next prompt. Empty for allow and dismiss." },
      },
      required: ["action", "text"],
    },
    reasoning: { type: "string", description: "One line: why this proposal" },
    effort_seconds: { type: "integer", description: "How long the user needs to check and accept this" },
    risk: { type: "string", enum: ["low", "medium", "high"] },
  },
  required: ["title", "summary", "category", "proposal", "reasoning", "effort_seconds", "risk"],
};

const CARD_SYSTEM = `You are the control tower of Plane Sight. A developer runs many coding agents in parallel.
One agent needs the developer. Write a short decision card so the developer can decide in seconds.

Allowed proposal actions by kind:
- approval (the agent asks to run a tool): "allow", or "deny" with a reason the agent will read.
- question (the agent asks the user a question): "answer" with the exact option label to pick, or "deny" with a free-text answer.
- blocked (a prompt is on the agent's screen; you only see the terminal text): "allow" or "deny" with a reason.
- landed (the agent finished its turn): "prompt" with the next instruction, or "dismiss" if nothing is left to do.

Rules:
- Propose "deny" for destructive or irreversible actions (deleting data, force pushes, publishing, spending money) and set risk "high".
- If a collision is reported for a pending edit, use category "collision" and propose "deny" with this wording:
  "The user denied this from their dashboard. Another agent is editing <file> right now. Do not retry. Stop and wait for the user."
- For a landed agent with a shared-file collision, use category "collision" and action "prompt" asking it to explain the overlapping changes and wait for review. This is a shared-file warning, not proof of a merge conflict. Never use "deny" for a landed agent.
- For a landed agent, a good next prompt is concrete: run the tests, fix what the agent itself flagged, or open a PR.
- Be specific. Name files and commands. No filler.`;

export async function writeCard(item) {
  if (!client) return fallbackCard(item);
  try {
    return await json(MODEL, CARD_SYSTEM, item, CARD_SCHEMA);
  } catch (e) {
    status.lastError = `card: ${e.message}`;
    return fallbackCard(item);
  }
}

function fallbackCard(item) {
  const tool = item.request?.tool ?? "";
  const base = {
    title: item.title ?? item.repo,
    effort_seconds: 10,
    risk: "low",
    reasoning: "Heuristic card (Gemini is not configured).",
  };
  if (item.collision) {
    if (item.kind === "landed") return { ...base, category: "collision", risk: "high",
      summary: `Shares edits to ${item.collision.file} with ${item.collision.other}. Review both branches together.`,
      proposal: { action: "prompt", text: `Explain your changes to ${item.collision.file} and the dependency on ${item.collision.other}. Do not merge; wait for review.` } };
    return { ...base, category: "collision", risk: "high", summary: `Wants to edit ${item.collision.file}, which ${item.collision.other} is editing.`,
      proposal: { action: "deny", text: `The user denied this from their dashboard. Another agent is editing ${item.collision.file} right now. Do not retry. Stop and wait for the user.` } };
  }
  if (item.kind === "question") {
    const first = item.request?.input?.questions?.[0];
    return { ...base, category: "clarification", summary: first?.question ?? "The agent asks a question.",
      proposal: { action: "answer", text: first?.options?.[0]?.label ?? "" } };
  }
  if (item.kind === "landed") {
    return { ...base, category: "review", summary: (item.last_message ?? "The agent finished its turn.").slice(0, 200),
      proposal: { action: "dismiss", text: "" } };
  }
  return { ...base, category: "tool_approval", summary: `Wants to run ${tool || "a tool"}.`, proposal: { action: "allow", text: "" } };
}

const RANK_SCHEMA = {
  type: "object",
  properties: {
    order: {
      type: "array",
      items: {
        type: "object",
        properties: { key: { type: "string" }, reason: { type: "string", description: "At most 8 words" } },
        required: ["key", "reason"],
      },
    },
  },
  required: ["order"],
};

const RANK_SYSTEM = `You are the control tower of Plane Sight. Order the waiting agents so the developer unblocks
the most work per second of attention:
1. Collisions first, because two agents are about to overwrite each other.
2. Quick, low-risk approvals next, because each one sends an agent back to work in seconds.
3. Then decisions and questions that unblock other work.
4. Then reviews of agents that finished.
Longer waits break ties. The developer's recent decisions show their preferences: if they keep skipping
a kind of item or a repository, rank it lower; if they act on something fast, rank similar items higher.
Return every key exactly once.`;

export async function rank(items, decisions) {
  const fallback = fallbackRank(items);
  if (!client || items.length < 2) return fallback;
  try {
    const { order } = await json(RANK_MODEL, RANK_SYSTEM, { items, recent_decisions: decisions }, RANK_SCHEMA);
    const known = new Set(items.map((i) => i.key));
    const seen = new Set();
    const ranked = order.filter((o) => known.has(o.key) && !seen.has(o.key) && seen.add(o.key));
    // Anything Gemini dropped goes to the end in fallback order.
    return [...ranked, ...fallback.filter((f) => !seen.has(f.key))];
  } catch (e) {
    status.lastError = `rank: ${e.message}`;
    return fallback;
  }
}

function fallbackRank(items) {
  const weight = (i) => (i.collision ? -1 : { approval: 0, blocked: 0.5, question: 1, landed: 2 }[i.kind] ?? 3);
  return [...items]
    .sort((a, b) => weight(a) - weight(b) || b.waiting_seconds - a.waiting_seconds)
    .map((i) => ({ key: i.key, reason: i.collision ? "Collision" : i.kind === "landed" ? "Ready for review" : "Quick unblock" }));
}
