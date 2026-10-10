# Plane Sight: five-agent demo

Keep the original narration. The live example needs only five real Claude sessions:

| Agent | Why it is in the story |
| --- | --- |
| **authentication** | The urgent security fix; review it first. |
| **api** | Shares `src/permissions.js` with Authentication; lines up behind it. |
| **dashboard** | Depends on the security fix before release. |
| **accessibility** | An independent, routine review. |
| **landing-page** | Cosmetic polish; can wait. |

The entire live interaction is **Authentication → send one instruction → return to airport**. No billing decisions, extra test-failure storyline, merging, or terminal commands during the presentation. Gemini ranks the initial lineup; waiting planes then keep their order, and returning planes join the tail. Click plane names to open their sessions.

## Original narration and presenter cues

Start at **http://127.0.0.1:7777/** with five waiting planes. Keep this cue sheet outside the recording.

| Say | Do |
| --- | --- |
| “Imagine you are coming back from lunch and you see 5 agents requiring your attention. Which one should you look into first? This is what Plane Sight is trying to help you decide.” | Show the airport with all five planes. Do not click yet. |
| “Your product development is like an airport. Agents are taking off from the terminal, spin their engines and generate entire trails before they land again. To prevent any unnecessary delays, a short turnaround time is crucial.” | Leave the airport visible. Gesture toward the terminal, taxiways, and runway. |
| “This is our flight crew for today. I am Jonny, Maître de cabine, this is Max, the Captain, Marcel, Copilot.” | Introduce the team on camera or use your prepared crew insert. No app interaction. |
| “Plane Sight acts as your air traffic controller. It hides agents which are in-flight, because they are not actionable. It recognizes the most urgent task and puts it in front of the line and identifies dependencies between agents, so they don’t collide.” | Point to **authentication** on the runway, labeled “Next to depart,” then follow the numbered line back to **api** and the other planes. Stay in the airport. |
| “In our control tower sits our operator is Gemini 3.8 Flash, which sees all of your agent sessions from above and lines them up in the right order of priority.” | Point toward the tower and queue. No click needed. |
| “On the ground control we have Herdr, which takes command from our operators and leads the agents the right way.” | Click **authentication**. Its Herdr session opens in the same tab. Paste the instruction below into **Message**, then click the yellow **Send message** arrow. The app returns to the airport automatically. Authentication disappears while working. |
| “The check-in process in Agent Airport International (AAI) is operated by Entire, so the high throughput is handled smoothly.” | Keep the airport visible while the agent works. No additional page or tool to open. |
| “So, you’re coming back from lunch. 5 agents are ready for their next flight. Which one should you send off next? You need an air traffic controller to help you make a decision, and thanks to our tool, the answer is in plain sight.” | Finish with all five planes back in the queue. If Authentication is still working, pause briefly before saying “5 agents are ready.” |

## The one message to paste

```text
Run node --test test/permissions.test.js once more. Report the pass/fail count in one sentence, then stop for review. Do not edit files, commit, or merge.
```

This is repeatable and does not change the demo's code. Authentication already has a workspace-isolation fix with passing permissions tests. The other four agents remain waiting while it works. A short task may return quickly; do not claim it stays hidden for a fixed duration.

The single departure queue follows the tower’s priority: one plane on the runway, with the remaining agents in order behind it. API’s shared-file dependency is reflected in its position after Authentication. It is not automatic merging or enforcement of a dependency graph. All five tasks are reviewable patches; the demo does not need another product decision.

## Reproduce with five new Claudes

Prerequisites: Node 22+, Git, authenticated Claude Code, Herdr, Entire CLI. Run the launcher from Herdr, or use the explicit authorization already given for this isolated demo. Startup trust prompts still need to be resolved by the operator. Prompt suggestions are disabled so they cannot be mistaken for unsent terminal text.

From the PlaneSight repository:

```sh
npm ci --prefix app
node app/scripts/setup-five-claudes.mjs --prepare
herdr --session planesight-five-demo server
```

The default disposable root is `out/five-claudes-demo/`; the session is `planesight-five-demo`. Start the airport in another terminal before launching the agents:

```sh
cd app
npm run build
HERDR_SOCKET_PATH="$HOME/.config/herdr/sessions/planesight-five-demo/herdr.sock" \
PLANESIGHT_ONLY="$(cd .. && pwd)/out/five-claudes-demo" npm run server
```

Then, from the repository root:

```sh
node app/scripts/setup-five-claudes.mjs --launch
```

If a task paused at startup, resolve the trust prompt, then run `node app/scripts/setup-five-claudes.mjs --prompt <agent-name>`. Set `HERDR_BIN` if Herdr is not on PATH. Supply `GEMINI_API_KEY` in the repository’s ignored `.env`. Connect the Herdr web UI on port 7317 to the same socket using `HERDR_SOCKET`; the embedding setup is in `app/README.md`.

For another run, set both a fresh `PLANESIGHT_DEMO_ROOT` and `PLANESIGHT_DEMO_SESSION` for every command. Existing worktrees are preserved. To reuse the five matching tasks from an older, larger demo, set its root/session and use the launcher’s `--filter` output as the airport server’s `PLANESIGHT_ONLY` value. This hides the other sessions only from the airport; it does not delete their work.

The old `setup-eight-claudes.mjs` command forwards to the five-agent launcher for compatibility.
