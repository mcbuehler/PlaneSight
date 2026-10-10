// Secret redaction. Everything sent to the Gemini API passes through redactDeep()
// (see gemini.js), so this module is the single privacy choke point.
// It errs on the side of over-redaction: losing a harmless value is acceptable,
// leaking a credential is not.

const R = '[REDACTED]';

/** Known token formats: [pattern, replacement]. Order matters (most specific first). */
const TOKEN_PATTERNS = [
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g, '[REDACTED_PRIVATE_KEY]'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, R], // AWS access key id
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, R], // GitHub tokens
  [/\bgithub_pat_[A-Za-z0-9_]{22,}\b/g, R],
  [/\bglpat-[A-Za-z0-9_-]{20,}\b/g, R], // GitLab
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g, R], // Slack
  [/\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g, R], // Anthropic / OpenAI
  [/\bAIza[0-9A-Za-z_-]{35}\b/g, R], // Google API key
  [/\b[spr]k_(?:live|test)_[A-Za-z0-9]{16,}\b/g, R], // Stripe
  [/\bnpm_[A-Za-z0-9]{36}\b/g, R],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, R], // JWT
  [/\b(Bearer|Basic|Token)\s+[A-Za-z0-9._~+/=-]{8,}/gi, `$1 ${R}`],
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s:/@]+:[^\s@/]+@/gi, `$1${R}@`], // credentials in URLs
];

// key = value / "key": "value" where the key name looks sensitive.
const SENSITIVE_KEY =
  '[A-Za-z0-9_.-]*(?:secret|token|passw(?:or)?d|pwd|api[_-]?key|apikey|access[_-]?key|private[_-]?key|credential|authorization|session[_-]?id|cookie)[A-Za-z0-9_.-]*';
const SENSITIVE_ASSIGNMENT = new RegExp(
  `(["']?${SENSITIVE_KEY}["']?\\s*[:=]\\s*)(["']?)([^\\s"',;}]+)\\2`,
  'gi',
);

// .env style lines: UPPER_SNAKE=value at line start (optionally `export`).
const ENV_LINE = /^(\s*(?:export\s+)?[A-Z][A-Z0-9_]*\s*=\s*)(\S.*)$/gm;

// Long opaque strings that look random (unknown token formats).
const OPAQUE = /[A-Za-z0-9_\-+=]{32,}/g;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GIT_SHA = /^[0-9a-f]{40}$/;

function shannonEntropy(s) {
  const counts = new Map();
  for (const ch of s) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let h = 0;
  for (const n of counts.values()) {
    const p = n / s.length;
    h -= p * Math.log2(p);
  }
  return h;
}

function looksLikeOpaqueSecret(s) {
  if (UUID.test(s) || GIT_SHA.test(s)) return false;
  if (!/[0-9]/.test(s) || !/[A-Za-z]/.test(s)) return false;
  return shannonEntropy(s) >= 3.5;
}

/** Redact secrets from a single string. */
export function redactSecrets(text) {
  if (typeof text !== 'string' || text.length === 0) return text;
  let out = text;
  for (const [pattern, replacement] of TOKEN_PATTERNS) out = out.replace(pattern, replacement);
  out = out.replace(SENSITIVE_ASSIGNMENT, (match, prefix, quote, value) =>
    value === R || /^\d+$/.test(value) || /^(?:Bearer|Basic|Token)$/i.test(value) ? match : `${prefix}${quote}${R}${quote}`,
  );
  out = out.replace(ENV_LINE, (match, prefix, value) => (value.startsWith(R) ? match : `${prefix}${R}`));
  out = out.replace(OPAQUE, (m) => (looksLikeOpaqueSecret(m) ? R : m));
  return out;
}

/** Recursively redact every string inside a JSON-like value. Returns a new value. */
export function redactDeep(value) {
  if (typeof value === 'string') return redactSecrets(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  }
  return value;
}

/**
 * True when a tool call reads or writes a file that typically holds secrets.
 * The digest drops the results of such calls entirely instead of relying on
 * pattern-based redaction.
 */
export function touchesSecretFile(toolInput) {
  if (!toolInput || typeof toolInput !== 'object') return false;
  const haystack = [toolInput.file_path, toolInput.path, toolInput.command, toolInput.pattern]
    .filter((v) => typeof v === 'string')
    .join(' ');
  return /(?:^|[\s/'"=])\.env(?:\.[\w-]+)?(?:$|[\s'"])|\.pem\b|\.key\b|id_(?:rsa|ed25519|ecdsa)|\bcredentials(?:\.json)?\b|\.npmrc\b|\.netrc\b|\.pgpass\b|\bsecrets?\.(?:json|ya?ml|toml|env)\b/i.test(
    haystack,
  );
}
