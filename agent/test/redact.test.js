import assert from 'node:assert/strict';
import { test } from 'node:test';
import { redactDeep, redactSecrets, touchesSecretFile } from '../src/redact.js';

const join = (...parts) => parts.join('');

test('redacts known token formats', () => {
  const samples = [
    join('sk-ant-api03-', 'Zx81kQp2LmN0vB7cR4tY9wE6uI3oP5aS'),
    join('sk-proj-', 'abcDEF123456ghiJKL789012mnoPQR'),
    join('AKIA', 'Q7XK2M9PLR4TVW3N'),
    join('ghp_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'),
    join('xoxb-', '1234567890-abcdefghij'),
    join('AIza', 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q'),
    join('eyJhbGciOiJIUzI1NiJ9', '.eyJzdWIiOiIxMjM0NTY3ODkwIn0', '.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'),
  ];
  for (const secret of samples) {
    const out = redactSecrets(`token here: ${secret} end`);
    assert.ok(!out.includes(secret), `leaked ${secret}: ${out}`);
  }
});

test('redacts private key blocks', () => {
  const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\nabc\n-----END RSA PRIVATE KEY-----';
  assert.equal(redactSecrets(`key:\n${pem}\ndone`), 'key:\n[REDACTED_PRIVATE_KEY]\ndone');
});

test('redacts .env lines and sensitive assignments', () => {
  const env = 'NODE_ENV=production\nDATABASE_URL=postgres://u:p@h/db\nexport STRIPE_KEY=whatever';
  const out = redactSecrets(env);
  assert.equal(out, 'NODE_ENV=[REDACTED]\nDATABASE_URL=[REDACTED]\nexport STRIPE_KEY=[REDACTED]');

  assert.equal(redactSecrets('{"password": "hunter2"}'), '{"password": "[REDACTED]"}');
  assert.equal(redactSecrets('client_secret=abc123'), 'client_secret=[REDACTED]');
  assert.equal(redactSecrets('Authorization: Bearer abc.def.ghi123'), 'Authorization: Bearer [REDACTED]');
});

test('redacts credentials in URLs', () => {
  assert.equal(
    redactSecrets('postgres://admin:hunter2@db.internal:5432/app'),
    'postgres://[REDACTED]@db.internal:5432/app',
  );
});

test('keeps ordinary text, paths, uuids and git shas', () => {
  const text =
    'Should we use a ledger table? See /Users/dev/projects/billing-api/src/models/invoice.ts, ' +
    'session 7a6ec4ac-f814-44d1-825f-45319e0b77ac at commit e9ea0761c0d5e1a8f3b2c4d6e8f0a1b2c3d4e5f6. max_tokens: 1000';
  assert.equal(redactSecrets(text), text);
});

test('redacts high-entropy opaque strings', () => {
  const secret = 'q8Zr2LxP0vN4mB7cT1yW9eK3uJ6hG5fD';
  assert.ok(!redactSecrets(`value ${secret}`).includes(secret));
});

test('redactDeep walks nested objects', () => {
  const out = redactDeep({ a: [{ b: 'DB_PASSWORD=x1' }], n: 3, nil: null });
  assert.deepEqual(out, { a: [{ b: 'DB_PASSWORD=[REDACTED]' }], n: 3, nil: null });
});

test('touchesSecretFile flags env and key files', () => {
  assert.ok(touchesSecretFile({ file_path: '/repo/.env' }));
  assert.ok(touchesSecretFile({ file_path: '/repo/.env.local' }));
  assert.ok(touchesSecretFile({ command: 'cat .env | grep KEY' }));
  assert.ok(touchesSecretFile({ file_path: '/home/u/.ssh/id_ed25519' }));
  assert.ok(touchesSecretFile({ file_path: '/repo/config/secrets.yml' }));
  assert.ok(!touchesSecretFile({ file_path: '/repo/src/environment.ts' }));
  assert.ok(!touchesSecretFile({ command: 'npm test' }));
});
