#!/usr/bin/env bash
# Start the demo fleet: one Herdr worktree and one agent per task, with Plane Sight hooks loaded.
#
# Usage: scripts/launch-demo.sh <repo> <tasks-file>
#   tasks-file: one task per line, "kind|branch|prompt". kind is claude or codex. Lines starting with # are ignored.
#   Example:    claude|login-form|Add a login form to src/app.tsx and ask me before choosing a validation library.
#
# The repo must be a git repo. The script writes .codex/hooks.json, runs `entire enable --project`
# and commits both, so every worktree gets the hooks and Entire.
set -euo pipefail

REPO="$(cd "$1" && pwd)"
TASKS="$2"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
CLAUDE_SETTINGS="$HERE/hooks/claude-settings.json"
CODEX_HOOK="$HERE/hooks/codex-hook.sh"

json() { python3 -I -c "import json,sys; d=json.load(sys.stdin); print(eval(sys.argv[1], {}, {'d': d}))" "$1"; }

setup_repo() {
  mkdir -p "$REPO/.codex"
  cat > "$REPO/.codex/hooks.json" <<EOF
{
  "hooks": {
    "SessionStart":      [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 5",   "timeout": 6 }] }],
    "UserPromptSubmit":  [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 5",   "timeout": 6 }] }],
    "PreToolUse":        [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 5",   "timeout": 6 }] }],
    "PermissionRequest": [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK /permission 70", "timeout": 75 }] }],
    "PostToolUse":       [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 5",   "timeout": 6 }] }],
    "Stop":              [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 5",   "timeout": 6 }] }],
    "Interrupt":         [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 1",   "timeout": 2 }] }],
    "SessionEnd":        [{ "hooks": [{ "type": "command", "command": "sh $CODEX_HOOK '' 2",   "timeout": 3 }] }]
  }
}
EOF
  (cd "$REPO" && entire enable --project --agent claude-code >/dev/null && entire enable --project --agent codex >/dev/null) \
    || echo "warning: entire enable failed, continuing without Entire"
  git -C "$REPO" add -A .codex .entire .claude 2>/dev/null || true
  git -C "$REPO" commit -qm "Plane Sight demo hooks" 2>/dev/null || true
}

# Answer startup prompts (folder trust, Codex update notice) until the agent is ready.
wait_ready() {
  local name="$1" kind="$2" pane="$3"
  for _ in $(seq 1 10); do
    if herdr agent get "$name" 2>/dev/null | grep -q '"interactive_ready":true'; then return 0; fi
    local screen
    screen="$(herdr pane read "$pane" --source visible --lines 30 2>/dev/null || true)"
    if grep -qi "trust" <<<"$screen"; then
      if [ "$kind" = claude ]; then herdr agent send-keys "$name" down enter >/dev/null; else herdr agent send-keys "$name" enter >/dev/null; fi
    elif grep -qiE "update (available|now)|new version" <<<"$screen"; then
      herdr agent send-keys "$name" down enter >/dev/null
    fi
    sleep 2
  done
  echo "warning: $name is not ready. Check its pane: herdr agent focus $name" >&2
}

setup_repo

i=0
while IFS='|' read -r -u 3 kind branch prompt; do
  [[ -z "${kind// }" || "$kind" == \#* ]] && continue
  i=$((i + 1))
  name="${branch}"
  echo "→ $name ($kind): $branch"
  pane="$(herdr worktree create --cwd "$REPO" --branch "$branch" --label "$branch" --no-focus | json "d['result']['root_pane']['pane_id']")"
  if [ "$kind" = claude ]; then
    herdr agent start "$name" --kind claude --pane "$pane" -- --settings "$CLAUDE_SETTINGS" --permission-mode default ${CLAUDE_EXTRA:-} >/dev/null 2>&1 || true
  else
    herdr agent start "$name" --kind codex --pane "$pane" -- -a on-request -s read-only --dangerously-bypass-hook-trust >/dev/null 2>&1 || true
  fi
  wait_ready "$name" "$kind" "$pane"
  herdr agent prompt "$name" "$prompt" >/dev/null
done 3< "$TASKS"

echo "Started $i agents. Open http://127.0.0.1:7777"
