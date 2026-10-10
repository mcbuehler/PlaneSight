# How Plane Sight talks to the decision maker

The decision maker (`agent/`, merged from `feat/session-urgency-ranker`) decides which agent needs the developer first. Plane Sight shows that order on the airfield. The adapter between the two is `server/ranker.mjs`. Plane Sight uses no other code from the module.

## Connect it

Nothing to set up: the server loads the decision maker from `agent/src/index.js` in this repository. To use another copy, set `PLANESIGHT_RANKER` to its entry file.

The server log says `ranking: team decision maker (../agent/src/index.js)`, and the tower label in the app says "Tower: team ranker". If the module fails, the built-in ranking takes over, so the airport keeps working.

## What Plane Sight sends

Plane Sight calls `rankSessions(sessions, options)` each time the queue changes, about once a second at most.

- `sessions` holds one entry per agent that needs the developer: `{ sessionId, jsonl }`.
  - `jsonl` is the end of the agent's Claude Code transcript, at most 2 MB, cut at a line boundary.
  - The path comes from the hook's `transcript_path`. For agents without the hooks, it is `~/.claude/projects/<cwd with / and . replaced by ->/<sessionId>.jsonl`.
  - Codex agents have no Claude transcript. They are not sent, and they keep their place after the ranked agents.
- `options.apiKey` is `GEMINI_API_KEY` from `.env`.
- `options.profile` is `PLANESIGHT_PROFILE`, free text about the developer's preferences. It is empty when unset.
- `options.pastDecisions` holds the last 40 lines of `data/ranker-decisions.jsonl`.

## What Plane Sight uses from the result

| Field | Where it shows |
|---|---|
| `ranking[].sessionId` order | The order of the planes: #1 at the first hold mark, #2 at the second, and so on |
| `ranking[].urgency` | The "Urgency N" tag in the bubble |
| `ranking[].reason` | The line next to that tag |
| `explanation` | The tooltip on the tower label |
| `source`, `error` | The tower label and its tooltip |

`category`, `prescore`, `features` and `digest` are not used yet.

## What Plane Sight sends back

When the developer answers an agent (accept or edit, not skip), Plane Sight calls `makeDecision(lastResult, sessionId)`. It appends the result as one JSON line to `data/ranker-decisions.jsonl`. These are the `pastDecisions` of the next call. Learning the weights (`learnFromDecision`) stays with the decision maker.
