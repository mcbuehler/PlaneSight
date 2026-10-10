# Plane Sight: build plan

Hackathon: Agentic AI Hack Zürich, 10 Oct 2026. Demo at 20:00. Code freeze at 19:15.

## Goal

A browser view over many coding agents that run in Herdr. Gemini ranks the agents that need you and drafts the answer. You accept with one key.

## Architecture

- One Node process, `server/server.mjs`. Base: `agentic-ai-hack/poc/herdr-smoke/server.mjs`.
  - `POST /hook/claude[/permission|/question]` and `POST /hook/codex[/permission]` hold approvals and questions.
  - Herdr socket (`~/.config/herdr/herdr.sock`): `agent.list` snapshot, `events.subscribe` for status changes.
  - Herdr CLI: `agent prompt`, `agent send-keys`, `agent focus`, `pane read`.
  - Entire CLI: `entire session info <id> --json` for summaries and tokens.
  - Gemini: `@google/genai`, Interactions API, `gemini-3.8-flash`.
  - `GET /events`: Server-Sent Events with the full state.
- One ID everywhere: Herdr `agent_session.value` = hook `session_id` = Entire session ID.
- Files edited per session come from `PostToolUse` Write and Edit hooks. They feed the collision check.

## Plane states

| Source | Plane | Where |
|---|---|---|
| Herdr `working` | In flight | Sky, faded, count only |
| Held approval or question | Needs you | Taxiway, in rank order |
| Herdr `done` | Landed, needs review (blue) | Taxiway, in rank order |
| Seen or skipped `idle` | Parked | Gate of its repository |

## Answer paths

- Claude approval or question: answer the held hook. Hook timeout 3600 s.
- Codex approval: the server gives up after 60 s. Then it answers with `herdr agent send-keys`, and a deny reason goes in a follow-up prompt.
- Landed agent: `herdr agent prompt` with the accepted next prompt.
- Collision: deny with the PoC wording ("The user denied this from their dashboard. Another agent is editing X. Do not retry. Stop and wait for the user.").

## Gemini

- Card call, once for each new request or landed agent. Returns category, summary, proposed action, reasoning and effort.
- Ranking call each time the queue changes, debounced. Input: the cards and the last 20 decisions (`data/decisions.jsonl`).
- Gemini never sends anything by itself.

## UI

- `web/index.html`, no build step.
- Left 60%: Phaser 4.2.1 from a CDN, pixel-art airport. The taxiway is the queue, with #1 at the runway. Gates are repositories. The sky shows working agents.
- Calm rules: motion only on change, only #1 pulses, color only for request type.
- Right 40%: HTML decision card. Enter accepts, E edits, S skips. A collapsed `pane read` tail and a "Jump to terminal" button.
- Sprites from Nano Banana 2.1, made once and committed. Limit 30 min. Fallback: shapes drawn in code.

## Milestones

1. Until 16:45: server with Herdr state, hooks and SSE, and a plain list UI.
2. Until 17:45: Gemini cards, ranking and all answer paths.
3. Until 18:30: airport UI.
4. Until 19:15: Entire summaries and collisions.
5. 19:15: freeze, rehearse, record a backup video.

Cut order if late: plane size, personalization, collisions, Entire summaries.

## Split

- Builder: the prototype and `scripts/launch-demo.sh`.
- Teammates: the pitch, the demo repo, and 8 task prompts. Two Claude tasks must edit the same file.

## Unresolved questions

1. Does Claude accept a 3600 s hook timeout?
2. The demo slot and pitch length, from the organizers.
3. Pitch questions Q9 to Q13, for the teammates.
4. `GEMINI_API_KEY` must be set.
