/** Only changes to actionable work should ask the tower to reorder its queue. */
export function rankingSignature(items) {
  return JSON.stringify(items.map(({ key, kind, collision, card }) => ({
    key, kind,
    collision: collision ? { file: collision.file, otherSession: collision.otherSession } : null,
    card: card ?? null,
  })).sort((a, b) => a.key.localeCompare(b.key)));
}

/** A timeout must not shuffle known tasks. Drop departed tasks and append new ones. */
export function stableFallback(previous, next) {
  const byKey = new Map(next.map((item) => [item.key, item]));
  const kept = previous.filter((item) => byKey.has(item.key)).map((item) => byKey.get(item.key));
  const known = new Set(kept.map((item) => item.key));
  return [...kept, ...next.filter((item) => !known.has(item.key))];
}

export class QueueRanking {
  constructor({ rank, publish, onError, delayMs = 1200 }) {
    this.rank = rank;
    this.publish = publish;
    this.onError = onError;
    this.delayMs = delayMs;
    this.signature = null;
    this.version = 0;
    this.order = [];
    this.timer = null;
  }

  schedule(items) {
    const signature = rankingSignature(items);
    if (signature === this.signature) return;
    this.signature = signature;
    const version = ++this.version;
    clearTimeout(this.timer);
    this.timer = setTimeout(async () => {
      try {
        const { order, failed } = await this.rank(items);
        // A new need or completed task invalidates older, still-running requests.
        if (version !== this.version) return;
        this.order = failed ? stableFallback(this.order, order) : order;
        this.publish(this.order);
      } catch (error) {
        if (version === this.version) this.onError?.(error);
      }
    }, this.delayMs);
  }
}
