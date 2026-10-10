// Turns a raw Claude Code session log (~/.claude/projects/<project>/<session>.jsonl)
// into a compact digest: session state, the last user prompt, the agent output since
// that prompt, and the pending question.
// Deterministic, no LLM. The JSONL format is not a stable public API, so all
// format-specific parsing lives here.

import { touchesSecretFile } from './redact.js';

/**
 * @typedef {'awaiting_answer' | 'awaiting_permission' | 'waiting_for_user' | 'running'} SessionState
 *
 * @typedef {object} PendingQuestion
 * @property {'multiple_choice' | 'permission' | 'open'} kind
 * @property {string} [text]
 * @property {{question: string, options: {label: string, description?: string}[]}[]} [questions]
 * @property {string} [tool]
 *
 * @typedef {object} SessionDigest
 * @property {string} sessionId
 * @property {string} project      basename of the working directory
 * @property {string} branch
 * @property {SessionState} state
 * @property {number} idleSeconds
 * @property {number} recentErrorCount  failed tool results among the last 10
 * @property {string} lastUserPrompt
 * @property {PendingQuestion | null} pendingQuestion
 * @property {{role: 'assistant' | 'tool', text: string}[]} agentOutput  what the agent did since lastUserPrompt (most recent entries)
 * @property {string | null} lastActivity  ISO timestamp
 */

const ASK_TOOL = 'AskUserQuestion';

/** Parse JSONL text into records, skipping blank and partially written lines. */
export function parseJsonl(text) {
  const records = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      records.push(JSON.parse(trimmed));
    } catch {
      // The last line may be mid-write while the session is active.
    }
  }
  return records;
}

function truncate(text, max) {
  if (typeof text !== 'string') return '';
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/** Keep the end of long text: for questions, the ask is usually at the end. */
function truncateStart(text, max) {
  const t = (text ?? '').trim();
  return t.length > max ? `…${t.slice(t.length - max + 1)}` : t;
}

function toolResultText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (c?.type === 'text' ? c.text : '')).join('\n');
  }
  return '';
}

/** Shorten paths: project-relative inside the working directory, ~ for home directories. */
function shortenPaths(text, cwd) {
  let out = cwd ? text.replaceAll(`${cwd}/`, '') : text;
  return out.replace(/\/(?:Users|home)\/[^/\s'"]+/g, '~');
}

function describeToolUse(name, input = {}) {
  const detail = input.command ?? input.file_path ?? input.path ?? input.description ?? input.pattern ?? input.url ?? '';
  return truncate(detail ? `${name}: ${detail}` : name, 200);
}

/**
 * Build a digest from a session log.
 * @param {string | object[]} input  JSONL text or already-parsed records
 * @param {object} [options]
 * @param {number} [options.now]                    epoch ms, defaults to Date.now()
 * @param {number} [options.outputSize]             max agent output entries to keep
 * @param {number} [options.permissionIdleSeconds]  a tool call pending this long is treated as a permission prompt
 * @returns {SessionDigest}
 */
export function buildDigest(input, { now = Date.now(), outputSize = 8, permissionIdleSeconds = 20 } = {}) {
  const records = typeof input === 'string' ? parseJsonl(input) : input;
  const convo = records.filter((r) => (r.type === 'user' || r.type === 'assistant') && !r.isSidechain && r.message);

  let sessionId = '';
  let cwd = '';
  let branch = '';
  let lastTs = null;
  for (const r of records) {
    sessionId = r.sessionId ?? sessionId;
    cwd = r.cwd ?? cwd;
    branch = r.gitBranch ?? branch;
    if (r.timestamp && (r.type === 'user' || r.type === 'assistant')) lastTs = r.timestamp;
  }

  const toolUses = new Map(); // id -> { name, input }
  const resolved = new Set();
  const secretToolIds = new Set();
  const errorFlags = [];
  /** @type {{role: string, kind: string, text: string}[]} */
  const events = [];
  const addEvent = (e) => events.push({ ...e, text: shortenPaths(e.text, cwd) });

  for (const r of convo) {
    const content = r.message.content;
    if (r.type === 'assistant') {
      for (const block of Array.isArray(content) ? content : []) {
        if (block.type === 'text' && block.text?.trim()) {
          addEvent({ role: 'assistant', kind: 'text', text: block.text });
        } else if (block.type === 'tool_use') {
          toolUses.set(block.id, { name: block.name, input: block.input ?? {} });
          if (touchesSecretFile(block.input)) secretToolIds.add(block.id);
          addEvent({ role: 'assistant', kind: 'tool_use', text: describeToolUse(block.name, block.input) });
        }
      }
      continue;
    }
    if (r.isMeta) continue;
    if (typeof content === 'string') {
      if (content.trim()) addEvent({ role: 'user', kind: 'text', text: content });
      continue;
    }
    for (const block of Array.isArray(content) ? content : []) {
      if (block.type === 'text' && block.text?.trim()) {
        addEvent({ role: 'user', kind: 'text', text: block.text });
      } else if (block.type === 'tool_result') {
        resolved.add(block.tool_use_id);
        errorFlags.push(block.is_error === true);
        if (block.is_error === true && !secretToolIds.has(block.tool_use_id)) {
          addEvent({ role: 'tool', kind: 'error', text: `Tool error: ${toolResultText(block.content)}` });
        } else {
          // Successful results are not useful for triage and may contain file contents.
          addEvent({ role: 'tool', kind: 'result', text: '' });
        }
      }
    }
  }

  const idleSeconds = lastTs ? Math.max(0, Math.round((now - Date.parse(lastTs)) / 1000)) : 0;
  const pending = [...toolUses.entries()].filter(([id]) => !resolved.has(id)).map(([, t]) => t);
  const pendingAsk = pending.find((t) => t.name === ASK_TOOL);
  const pendingOther = pending.find((t) => t.name !== ASK_TOOL);
  const meaningful = events.filter((e) => e.kind !== 'result');
  const last = meaningful.at(-1);

  /** @type {SessionState} */
  let state = 'running';
  /** @type {PendingQuestion | null} */
  let pendingQuestion = null;
  if (pendingAsk) {
    state = 'awaiting_answer';
    pendingQuestion = {
      kind: 'multiple_choice',
      questions: (pendingAsk.input.questions ?? []).map((q) => ({
        question: truncate(shortenPaths(q.question ?? '', cwd), 600),
        options: (q.options ?? []).map((o) => ({ label: truncate(o.label, 120), description: truncate(shortenPaths(o.description ?? '', cwd), 300) })),
      })),
    };
  } else if (pendingOther && idleSeconds >= permissionIdleSeconds) {
    state = 'awaiting_permission';
    pendingQuestion = { kind: 'permission', tool: pendingOther.name, text: shortenPaths(describeToolUse(pendingOther.name, pendingOther.input), cwd) };
  } else if (!pendingOther && last?.role === 'assistant' && last.kind === 'text') {
    state = 'waiting_for_user';
    pendingQuestion = { kind: 'open', text: truncateStart(last.text, 1500) };
  } else if (!pendingOther && last?.role === 'user' && /\[Request interrupted by user/.test(last.text)) {
    state = 'waiting_for_user';
  }

  const isPrompt = (e) => e.role === 'user' && e.kind === 'text' && !/^\[Request interrupted/.test(e.text);
  const lastPromptIndex = meaningful.findLastIndex(isPrompt);
  const agentOutput = meaningful.slice(lastPromptIndex + 1).filter((e) => e.role !== 'user');

  return {
    sessionId,
    project: cwd.split('/').filter(Boolean).at(-1) ?? '',
    branch,
    state,
    idleSeconds,
    recentErrorCount: errorFlags.slice(-10).filter(Boolean).length,
    lastUserPrompt: truncate(meaningful[lastPromptIndex]?.text, 600),
    pendingQuestion,
    agentOutput: agentOutput.slice(-outputSize).map((e) => ({ role: e.role, text: truncate(e.text, 500) })),
    lastActivity: lastTs,
  };
}

/** Plain-text rendering of the pending question, used for feature extraction and summaries. */
export function pendingQuestionText(digest) {
  const q = digest.pendingQuestion;
  if (!q) return '';
  if (q.kind === 'multiple_choice') {
    return q.questions
      .map((x) => [x.question, ...x.options.map((o) => `${o.label}: ${o.description ?? ''}`)].join('\n'))
      .join('\n');
  }
  return q.text ?? '';
}
