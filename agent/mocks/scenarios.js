// Ready-made sessions covering the cases the ranker has to tell apart.
// Fake credentials are assembled from pieces so secret scanners don't flag this file.

import { mockSession } from './mockSession.js';

const FAKE = {
  anthropicKey: ['sk', 'ant', 'api03', 'Zx81kQp2LmN0vB7cR4tY9wE6uI3oP5aS1dF8gH2jK'].join('-'),
  awsKeyId: 'AKIA' + 'Q7XK2M9PLR4TVW3N',
  dbPassword: 'hunter2-Very-Secret',
};

/** Agent asks the developer to choose a data model: high urgency (design decision). */
export function designDecision({ now = Date.now() } = {}) {
  return mockSession({ sessionId: 'sess-design', cwd: '/Users/dev/projects/billing-api', gitBranch: 'feat/invoices' })
    .user('Add support for multi-currency invoices.')
    .toolUse('Read', { file_path: '/Users/dev/projects/billing-api/src/models/invoice.ts' }, { result: 'export interface Invoice { amountCents: number }' })
    .toolUse('Grep', { pattern: 'amountCents' }, { result: '42 matches in 17 files' })
    .ask([
      {
        question:
          'Invoices store a single amountCents. For multi-currency, which data model should we use? This affects the DB schema, the public API contract and requires a migration.',
        options: [
          { label: 'Money value object', description: 'amount + currency columns on every monetary field; breaking API change' },
          { label: 'Currency per invoice', description: 'one currency column on invoices; simpler migration, no mixed-currency lines' },
          { label: 'Separate ledger table', description: 'normalize amounts into a ledger; most flexible, largest refactor' },
        ],
      },
    ])
    .finish({ idleSeconds: 240, now });
}

/** Agent found a production data-loss bug and asks how to proceed: high urgency (critical bug). */
export function criticalBug({ now = Date.now() } = {}) {
  return mockSession({ sessionId: 'sess-bug', cwd: '/Users/dev/projects/sync-worker', gitBranch: 'main' })
    .user('Users report missing records after sync. Investigate.')
    .toolUse('Bash', { command: 'npm test -- sync' }, { result: 'FAIL sync.test.ts: expected 120 rows, got 87', isError: true })
    .toolUse('Bash', { command: 'npm test -- sync --runInBand' }, { result: 'FAIL sync.test.ts: expected 120 rows, got 91', isError: true })
    .toolUse('Read', { file_path: '/Users/dev/projects/sync-worker/src/batch.ts' }, { result: '...' })
    .assistant(
      'Found the root cause: a race condition in batch.ts deletes rows before the upsert commits, so production is losing data on every concurrent sync. ' +
        'I can (a) add a transaction lock now as a hotfix, or (b) rewrite the batching to be idempotent. The hotfix is safe to deploy today. Which do you want?',
    )
    .finish({ idleSeconds: 90, now });
}

/** Agent finished and asks whether to commit: low urgency (routine). */
export function routineCommit({ now = Date.now() } = {}) {
  return mockSession({ sessionId: 'sess-routine', cwd: '/Users/dev/projects/website', gitBranch: 'fix/typo' })
    .user('Fix the typo in the footer.')
    .toolUse('Edit', { file_path: '/Users/dev/projects/website/src/Footer.tsx' }, { result: 'ok' })
    .assistant('Fixed the typo in Footer.tsx. Shall I commit and push the change?')
    .finish({ idleSeconds: 1800, now });
}

/** Agent is mid tool call: needs no attention. */
export function running({ now = Date.now() } = {}) {
  return mockSession({ sessionId: 'sess-running', cwd: '/Users/dev/projects/ml-pipeline' })
    .user('Retrain the model with the new features and report metrics.')
    .toolUse('Bash', { command: 'python train.py --epochs 20' })
    .finish({ idleSeconds: 5, now });
}

/** Tool call waiting for approval (idle with a pending, non-question tool use). */
export function permissionPrompt({ now = Date.now() } = {}) {
  return mockSession({ sessionId: 'sess-permission', cwd: '/Users/dev/projects/infra' })
    .user('Clean up old docker images.')
    .toolUse('Bash', { command: 'docker image prune -a' })
    .finish({ idleSeconds: 120, now });
}

/** Session that read .env and echoes credentials: must be redacted before reaching Gemini. */
export function secretLeak({ now = Date.now() } = {}) {
  return mockSession({ sessionId: 'sess-secrets', cwd: '/Users/dev/projects/payments' })
    .user(`Connect to staging. The DB url is postgres://admin:${FAKE.dbPassword}@db.staging.internal:5432/app`)
    .toolUse(
      'Read',
      { file_path: '/Users/dev/projects/payments/.env' },
      { result: `ANTHROPIC_API_KEY=${FAKE.anthropicKey}\nAWS_ACCESS_KEY_ID=${FAKE.awsKeyId}\nDB_PASSWORD=${FAKE.dbPassword}`, isError: true },
    )
    .assistant(
      `The .env has ANTHROPIC_API_KEY=${FAKE.anthropicKey} and AWS key ${FAKE.awsKeyId}, but staging rejects them. ` +
        'Should we switch the payment service architecture to fetch credentials from the secrets manager instead?',
    )
    .finish({ idleSeconds: 600, now });
}

export const FAKE_SECRETS = Object.freeze(Object.values(FAKE));

/** All scenarios as rankSessions() input. */
export function allScenarios({ now = Date.now() } = {}) {
  return [designDecision, criticalBug, routineCommit, running, permissionPrompt, secretLeak].map((make) => {
    const s = make({ now });
    return { sessionId: s.sessionId, jsonl: s.jsonl() };
  });
}
