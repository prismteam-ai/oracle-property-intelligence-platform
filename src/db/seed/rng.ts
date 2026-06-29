export const SEED = Number(process.env.SEED ?? 20260615);
export const BASE_DATE = process.env.BASE_DATE ?? "2026-06-15";

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  private next: () => number;
  constructor(seed: number = SEED) {
    this.next = mulberry32(seed);
  }
  float(): number {
    return this.next();
  }
  int(minInclusive: number, maxInclusive: number): number {
    return minInclusive + Math.floor(this.next() * (maxInclusive - minInclusive + 1));
  }
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick on empty array");
    return items[this.int(0, items.length - 1)]!;
  }
  bool(probabilityTrue = 0.5): boolean {
    return this.next() < probabilityTrue;
  }
  dateOffset(daysFromBase: number): string {
    const base = new Date(`${BASE_DATE}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + daysFromBase);
    return base.toISOString().slice(0, 10);
  }
}

export function deterministicUuid(rng: Rng): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 32; i++) {
    if (i === 12) {
      out += "4";
      continue;
    }
    if (i === 16) {
      out += hex[(rng.int(0, 15) & 0x3) | 0x8]!;
      continue;
    }
    out += hex[rng.int(0, 15)]!;
  }
  return [
    out.slice(0, 8),
    out.slice(8, 12),
    out.slice(12, 16),
    out.slice(16, 20),
    out.slice(20, 32),
  ].join("-");
}
