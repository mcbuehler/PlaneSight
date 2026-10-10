import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDigest } from '../src/digest.js';
import { extractFeatures } from '../src/features.js';
import { makeDecision, learnFromDecision, selectSimilarDecisions } from '../src/learn.js';
import { DEFAULT_WEIGHTS, prescore, updateWeights } from '../src/prescore.js';
import { rankSessions } from '../src/rank.js';
import * as scenarios from '../mocks/scenarios.js';

const now = Date.parse('2026-10-10T12:00:00Z');
const featuresOf = (make) => extractFeatures(buildDigest(make({ now }).jsonl(), { now }));

test('default weights rank bugs and design decisions above routine and running sessions', () => {
  const score = (make) => prescore(featuresOf(make));
  const bug = score(scenarios.criticalBug);
  const design = score(scenarios.designDecision);
  const routine = score(scenarios.routineCommit);
  const running = score(scenarios.running);
  assert.ok(bug > routine && design > routine, `bug=${bug} design=${design} routine=${routine}`);
  assert.ok(routine > running);
  assert.equal(running, 0);
});

test('updateWeights moves toward the chosen session and does not mutate input', () => {
  const chosen = featuresOf(scenarios.permissionPrompt);
  const rejected = [featuresOf(scenarios.designDecision)];
  const before = { ...DEFAULT_WEIGHTS };
  const after = updateWeights(DEFAULT_WEIGHTS, chosen, rejected, { learningRate: 0.5 });
  assert.deepEqual({ ...DEFAULT_WEIGHTS }, before);
  assert.ok(after.permissionPrompt > before.permissionPrompt);
  assert.ok(after.designDecision < before.designDecision);
});

test('repeated choices flip the order (personalization)', () => {
  const permission = featuresOf(scenarios.permissionPrompt);
  const design = featuresOf(scenarios.designDecision);
  let w = { ...DEFAULT_WEIGHTS };
  assert.ok(prescore(design, w) > prescore(permission, w));
  for (let i = 0; i < 40; i++) w = updateWeights(w, permission, [design], { learningRate: 0.2 });
  assert.ok(prescore(permission, w) > prescore(design, w));
});

test('makeDecision + learnFromDecision from a ranking result', async () => {
  const sessions = [scenarios.designDecision, scenarios.routineCommit, scenarios.running].map((m) => {
    const s = m({ now });
    return { sessionId: s.sessionId, jsonl: s.jsonl() };
  });
  const result = await rankSessions(sessions, { now });
  const decision = makeDecision(result, 'sess-routine', { now });
  assert.equal(decision.chosen.project, 'website');
  assert.deepEqual(decision.others.map((o) => o.sessionId), ['sess-design']); // running sessions excluded
  assert.equal(decision.agentTopPick, 'sess-design');
  const w = learnFromDecision(DEFAULT_WEIGHTS, decision);
  assert.ok(w.routineConfirmation > DEFAULT_WEIGHTS.routineConfirmation);
  assert.throws(() => makeDecision(result, 'nope'));
});

test('selectSimilarDecisions prefers similar situations', () => {
  const mk = (features, id) => ({ ts: '', chosen: { sessionId: id, features }, others: [], agentTopPick: null });
  const design = featuresOf(scenarios.designDecision);
  const permission = featuresOf(scenarios.permissionPrompt);
  const past = [mk(design, 'd'), mk(permission, 'p')];
  assert.equal(selectSimilarDecisions(past, [permission], 1)[0].chosen.sessionId, 'p');
  assert.deepEqual(selectSimilarDecisions([], [permission]), []);
});
