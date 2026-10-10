// Builder for synthetic Claude Code session logs in the same JSONL shape that
// Claude Code writes to ~/.claude/projects/<project>/<session>.jsonl.

import { randomUUID } from 'node:crypto';

/**
 * @example
 * const s = mockSession({ cwd: '/Users/dev/api' })
 *   .user('Add rate limiting')
 *   .toolUse('Bash', { command: 'npm test' }, { result: 'ok' })
 *   .assistant('Should I use a token bucket or a sliding window?')
 *   .finish({ idleSeconds: 300 });
 * s.jsonl(); // -> string
 */
export function mockSession({
  sessionId = randomUUID(),
  cwd = '/Users/dev/projects/demo',
  gitBranch = 'main',
  stepSeconds = 15,
} = {}) {
  const records = [];
  let t = 0; // relative ms; shifted to absolute time in finish()
  let parentUuid = null;
  let toolCounter = 0;

  function push(type, message, extra = {}) {
    const uuid = randomUUID();
    records.push({ parentUuid, isSidechain: false, cwd, sessionId, gitBranch, type, message, uuid, timestamp: t, ...extra });
    parentUuid = uuid;
    t += stepSeconds * 1000;
  }

  const api = {
    sessionId,
    /** A user prompt. */
    user(text) {
      push('user', { role: 'user', content: text });
      return api;
    },
    /** An assistant text message ending the turn. */
    assistant(text) {
      push('assistant', { role: 'assistant', content: [{ type: 'text', text }], stop_reason: 'end_turn' });
      return api;
    },
    /**
     * An assistant tool call. Without `result` the call stays pending
     * (running, or waiting for permission once idle).
     */
    toolUse(name, input, { result, isError = false } = {}) {
      const id = `toolu_mock_${++toolCounter}`;
      push('assistant', { role: 'assistant', content: [{ type: 'tool_use', id, name, input }], stop_reason: 'tool_use' });
      if (result !== undefined) {
        push('user', {
          role: 'user',
          content: [{ type: 'tool_result', tool_use_id: id, content: result, is_error: isError }],
        });
      }
      return api;
    },
    /** A pending AskUserQuestion call: questions = [{ question, header?, options: [{label, description}] }]. */
    ask(questions) {
      return api.toolUse('AskUserQuestion', {
        questions: questions.map((q) => ({ header: q.header ?? 'Question', multiSelect: false, ...q })),
      });
    },
    /** The developer pressed Esc mid-turn. */
    interrupt() {
      push('user', { role: 'user', content: [{ type: 'text', text: '[Request interrupted by user]' }] });
      return api;
    },
    /** Fix timestamps so the last record happened `idleSeconds` before `now`. */
    finish({ idleSeconds = 0, now = Date.now() } = {}) {
      const lastRelative = records.at(-1)?.timestamp ?? 0;
      const offset = now - idleSeconds * 1000 - lastRelative;
      for (const r of records) {
        if (typeof r.timestamp === 'number') r.timestamp = new Date(r.timestamp + offset).toISOString();
      }
      return api;
    },
    records() {
      return records;
    },
    jsonl() {
      return records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    },
  };
  return api;
}
