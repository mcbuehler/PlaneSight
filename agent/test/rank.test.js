import assert from 'node:assert/strict';
import { test } from 'node:test';
import { rankSessions } from '../src/rank.js';
import { allScenarios, FAKE_SECRETS } from '../mocks/scenarios.js';

const now = Date.parse('2026-10-10T12:00:00Z');

/** Fake fetch that records the request and answers with `reply(requestBody)`. */
function fakeGemini(reply, { status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, init, body });
    const payload =
      status === 200
        ? { candidates: [{ content: { parts: [{ text: JSON.stringify(reply(body)) }] } }] }
        : { error: { message: 'quota exceeded' } };
    return new Response(JSON.stringify(payload), { status });
  };
  return { fetchImpl, calls };
}

const sessionsInPrompt = (body) => {
  const text = body.contents[0].parts[0].text;
  return JSON.parse(text.match(/<sessions>\n([\s\S]*?)\n<\/sessions>/)[1]);
};

test('heuristic fallback without API key', async () => {
  const result = await rankSessions(allScenarios({ now }), { now });
  assert.equal(result.source, 'heuristic');
  assert.equal(result.topPick, 'sess-bug');
  assert.equal(result.ranking.at(-1).sessionId, 'sess-running');
  assert.equal(result.ranking.length, 6);
});

test('sends only waiting sessions, redacted, with aliases; merges Gemini order', async () => {
  const { fetchImpl, calls } = fakeGemini((body) => {
    const sessions = sessionsInPrompt(body);
    const design = sessions.find((s) => s.project === 'billing-api');
    return {
      ranking: [
        { id: design.id, urgency: 95, category: 'design_decision', reason: 'Data model choice blocks the migration.' },
        { id: 'S99', urgency: 50, category: 'blocked', reason: 'unknown id is ignored' },
      ],
      topPick: design.id,
      explanation: 'The invoice data model decision blocks all further work.',
    };
  });

  const result = await rankSessions(allScenarios({ now }), { now, apiKey: 'test-key', model: 'm', fetchImpl });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/models\/m:generateContent$/);
  assert.equal(calls[0].init.headers['x-goog-api-key'], 'test-key');

  const raw = JSON.stringify(calls[0].body);
  for (const secret of FAKE_SECRETS) assert.ok(!raw.includes(secret), `leaked ${secret}`);
  assert.ok(!raw.includes('sess-'), 'session ids must be aliased');
  assert.ok(!raw.includes('/Users/dev'), 'only project basenames are sent as context');

  const sent = sessionsInPrompt(calls[0].body);
  assert.equal(sent.length, 5); // running session not sent
  assert.ok(sent.every((s) => s.agentOutput && !('task' in s) && 'pendingQuestion' in s));

  assert.equal(result.source, 'gemini');
  assert.equal(result.topPick, 'sess-design');
  assert.equal(result.ranking[0].sessionId, 'sess-design');
  assert.equal(result.ranking[0].urgency, 95);
  assert.equal(result.ranking.length, 6); // dropped sessions appended
  assert.equal(new Set(result.ranking.map((r) => r.sessionId)).size, 6);
  assert.equal(result.ranking.find((r) => r.sessionId === 'sess-running').urgency, null);
});

test('past decisions and profile go into the prompt', async () => {
  const { fetchImpl, calls } = fakeGemini(() => ({ ranking: [], topPick: 'S1', explanation: 'x' }));
  const pastDecisions = [
    {
      ts: '2026-10-01T00:00:00Z',
      chosen: { sessionId: 'a', project: 'infra', state: 'awaiting_permission', summary: 'Bash: terraform apply', features: { needsInput: 1, permissionPrompt: 1 } },
      others: [{ sessionId: 'b', project: 'web', state: 'waiting_for_user', summary: 'Commit?', features: { needsInput: 1, routineConfirmation: 1 } }],
      agentTopPick: 'b',
      note: 'infra changes first',
    },
  ];
  await rankSessions(allScenarios({ now }), {
    now,
    apiKey: 'k',
    fetchImpl,
    profile: 'Always handle payments first. My token=abc123',
    pastDecisions,
  });
  const text = calls[0].body.contents[0].parts[0].text;
  assert.match(text, /<profile>\nAlways handle payments first\. My token=\[REDACTED\]/);
  assert.match(text, /infra changes first/);
});

test('falls back to heuristic when Gemini fails', async () => {
  const { fetchImpl } = fakeGemini(() => ({}), { status: 429 });
  const result = await rankSessions(allScenarios({ now }), { now, apiKey: 'k', fetchImpl });
  assert.equal(result.source, 'heuristic');
  assert.match(result.error, /429: quota exceeded/);
  assert.equal(result.topPick, 'sess-bug');
});

test('no API call when nothing is waiting', async () => {
  const { fetchImpl, calls } = fakeGemini(() => ({}));
  const result = await rankSessions([allScenarios({ now })[3]], { now, apiKey: 'k', fetchImpl });
  assert.equal(calls.length, 0);
  assert.equal(result.topPick, null);
});
