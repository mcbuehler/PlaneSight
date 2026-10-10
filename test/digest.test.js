import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDigest, parseJsonl } from '../src/digest.js';
import { mockSession } from '../mocks/mockSession.js';
import * as scenarios from '../mocks/scenarios.js';

const now = Date.parse('2026-10-10T12:00:00Z');

test('parseJsonl skips blank and partially written lines', () => {
  assert.deepEqual(parseJsonl('{"a":1}\n\n{"b":2}\n{"c":'), [{ a: 1 }, { b: 2 }]);
});

test('detects states', () => {
  const state = (s) => buildDigest(s.jsonl(), { now }).state;
  assert.equal(state(scenarios.designDecision({ now })), 'awaiting_answer');
  assert.equal(state(scenarios.criticalBug({ now })), 'waiting_for_user');
  assert.equal(state(scenarios.routineCommit({ now })), 'waiting_for_user');
  assert.equal(state(scenarios.running({ now })), 'running');
  assert.equal(state(scenarios.permissionPrompt({ now })), 'awaiting_permission');
  assert.equal(state(mockSession().user('do it').finish({ now })), 'running');
  assert.equal(state(mockSession().user('do it').interrupt().finish({ now })), 'waiting_for_user');
});

test('extracts context, pending question and agent output', () => {
  const d = buildDigest(scenarios.designDecision({ now }).records(), { now });
  assert.equal(d.sessionId, 'sess-design');
  assert.equal(d.project, 'billing-api');
  assert.equal(d.branch, 'feat/invoices');
  assert.equal(d.idleSeconds, 240);
  assert.equal(d.lastUserPrompt, 'Add support for multi-currency invoices.');
  assert.equal(d.pendingQuestion.kind, 'multiple_choice');
  assert.match(d.pendingQuestion.questions[0].question, /which data model/);
  assert.equal(d.pendingQuestion.questions[0].options.length, 3);
  assert.ok(d.agentOutput.some((t) => t.text.startsWith('Read: ')));
  // successful tool results are never included
  assert.ok(!d.agentOutput.some((t) => t.text.includes('export interface Invoice')));
});

test('counts recent errors and includes error text', () => {
  const d = buildDigest(scenarios.criticalBug({ now }).jsonl(), { now });
  assert.equal(d.recentErrorCount, 2);
  assert.ok(d.agentOutput.some((t) => t.role === 'tool' && t.text.includes('expected 120 rows')));
  assert.match(d.pendingQuestion.text, /Which do you want\?$/);
});

test('drops results of tool calls on secret files, even errors', () => {
  const d = buildDigest(scenarios.secretLeak({ now }).jsonl(), { now });
  assert.ok(!d.agentOutput.some((t) => t.text.includes('AWS_ACCESS_KEY_ID')));
});

test('ignores sidechain (subagent) records', () => {
  const records = mockSession().user('main task').assistant('Done?').finish({ now }).records();
  records.push({ ...records[1], isSidechain: true, message: { role: 'user', content: 'subagent prompt' } });
  assert.equal(buildDigest(records, { now }).state, 'waiting_for_user');
});

test('agent output covers only what happened after the last prompt', () => {
  const d = buildDigest(
    mockSession()
      .user('First task: set up the repo')
      .assistant('Repo is set up.')
      .user('Now add auth')
      .toolUse('Bash', { command: 'npm i passport' }, { result: 'ok' })
      .assistant('Session cookies or JWTs?')
      .finish({ now })
      .jsonl(),
    { now },
  );
  assert.equal(d.lastUserPrompt, 'Now add auth');
  assert.deepEqual(d.agentOutput, [
    { role: 'assistant', text: 'Bash: npm i passport' },
    { role: 'assistant', text: 'Session cookies or JWTs?' },
  ]);
  assert.ok(!JSON.stringify(d).includes('First task'));
});
