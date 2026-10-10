# Plane Sight: eight real Claudes

Open **http://127.0.0.1:7777/**. This is the live airport, not the Remotion video.
The demo uses an isolated Herdr session named `planesight-release-demo` and eight
worktrees under `out/eight-claudes-demo/`. Existing sessions are left alone.
No demo branch is merged into PlaneSight or pushed.

## Your transcript and clicks (about 90 seconds)

| Say | Do |
| --- | --- |
| “Imagine coming back from lunch. Eight agents need you. Which one do you look at first?” | Start on the airport with all eight waiting planes. If a previous selection is pinned, reload the page to follow the highest-priority plane. |
| “These are real Claude sessions working on a team app release. One polished the landing page. Another found that users can see projects from a different workspace.” | Point to **authentication** at the front. Its card should describe the workspace isolation bug. Gemini's order can change as agents finish; use the named plane, not a memorized screen coordinate. |
| “The oldest task isn’t necessarily the most important. Our control tower puts the security issue ahead of cosmetic work.” | Read the urgency and the tower's reason on Authentication. **Output** shows the real agent response. |
| “It also notices that API and Authentication changed the same permission helper. I need to review those together so the API change doesn’t bring the bug back.” | Point to the shared-file warning for `src/permissions.js`. Click **api** to see the corresponding warning, then return to **authentication**. This detects overlapping files; it does not automatically merge them or enforce a dependency graph. |
| “I can inspect and steer the session without leaving the airport.” | On Authentication, click **Herdr**. The session opens inside this same tab. |
| “Once I send the next instruction, the agent takes off. While it’s working, it’s out of my way.” | Paste the follow-up below into **Message** and click the yellow **Send message** arrow. You return to the airport automatically. The working plane is hidden; the in-flight count increases. |
| “When it needs me again, it lands back in the queue. That keeps turnaround short.” | Wait for Authentication to return. It runs only a small test, so this can take a few seconds. |
| “A quick product decision can keep another agent moving too.” | Click **billing**. Its question is whether pending invitations count as paid seats. The proposed answer is **Active members only**. Click **Answer** to let it implement and test that policy. Leave this step until the live demo; it consumes the initial question. |
| “Eight sessions, one place to decide what happens next. The answer is in plane sight.” | End on the airport. |

Paste this into Authentication's Herdr message box:

```text
Run node --test test/permissions.test.js once more. Report the pass/fail count and the API shared-file dependency in two short sentences. Do not merge or commit; stop for review.
```

The same follow-up is safe to repeat. The initial live verification passed all five
permissions tests, returned to the airport after sending, and surfaced the agent
again when finished. Authentication's original full suite passed seven tests.
The Test suite branch intentionally has failing isolation regression tests against
the unfixed baseline. Those failures are the demo's release blocker, not a broken
PlaneSight test suite.

## Tasks

- **authentication**: fix cross-workspace data exposure; security/release blocker.
- **api**: pagination/archive options, overlapping the shared permissions helper.
- **test-suite**: failing regression proof against the baseline; depends on Authentication.
- **dashboard**: workspace label and invite permission; needs the isolation fix before release.
- **billing**: decide whether pending invitations count as seats, then implement it.
- **accessibility**: keyboard focus cycling for the invite dialog.
- **documentation**: teammate invitation guide.
- **landing-page**: low-priority launch copy polish.

## Reproduce

Prerequisites: Node 22+, Git, authenticated Claude Code, Herdr, Entire CLI.
Run the launcher from Herdr, or explicitly authorize controlling an isolated Herdr
session from your current agent. The launcher never bypasses startup trust dialogs.
Inspect and resolve those before sending the task with `--prompt <id>`.

```sh
npm ci --prefix app
node app/scripts/setup-eight-claudes.mjs --prepare
herdr --session planesight-release-demo server
```

In another terminal, build/start the airport before launching the agents:

```sh
cd app
npm run build
HERDR_SOCKET_PATH="$HOME/.config/herdr/sessions/planesight-release-demo/herdr.sock" \
PLANESIGHT_ONLY="$(cd .. && pwd)/out/eight-claudes-demo" npm run server
```

Then, from the repository root:

```sh
node app/scripts/setup-eight-claudes.mjs --launch
```

Set `HERDR_BIN` if Herdr is not on PATH. Supply `GEMINI_API_KEY` in the repository's
ignored `.env` for AI ranking. Connect the Herdr web UI on port 7317 to this same
socket using its `HERDR_SOCKET` setting and the embedding patch documented in
`app/README.md`. The web UI's allowed frame ancestor is `http://127.0.0.1:7777`.
The JSON manifest records the generated panes; it is ignored along with all runtime
worktrees. A second `--prepare` refuses to overwrite them. For another run, set
both a fresh `PLANESIGHT_DEMO_ROOT` and `PLANESIGHT_DEMO_SESSION`.
