const TRANSIENT_CONNECTION_PATTERNS = [
  "connection terminated unexpectedly",
  "terminating connection due to administrator command",
  "client has encountered a connection error",
  "connection terminated",
  "socket hang up",
  "server closed the connection unexpectedly",
  "connection refused",
  "connection reset",
];

const TRANSIENT_CONNECTION_CODES = [
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "ETIMEDOUT",
  "57P01",
  "57P02",
  "57P03",
  "08000",
  "08003",
  "08006",
];

export interface TransientRetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(
      `[oracle] ${name} must be a positive integer (got ${JSON.stringify(raw)}).`,
    );
  }
  return parsed;
}

export function transientRetryConfig(): TransientRetryConfig {
  return {
    maxAttempts: readPositiveInt("DB_RETRY_MAX_ATTEMPTS", 3),
    baseDelayMs: readPositiveInt("DB_RETRY_BASE_DELAY_MS", 100),
    maxDelayMs: readPositiveInt("DB_RETRY_MAX_DELAY_MS", 1000),
  };
}

export function isTransientConnectionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && TRANSIENT_CONNECTION_CODES.includes(code)) {
    return true;
  }
  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return false;
  const normalized = message.toLowerCase();
  return TRANSIENT_CONNECTION_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function backoffDelayMs(attempt: number, config: TransientRetryConfig): number {
  const exponential = config.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, config.maxDelayMs);
  return Math.round(capped * (0.5 + Math.random() * 0.5));
}

export async function runWithTransientRetry<T>(
  execute: () => Promise<T>,
  config: TransientRetryConfig = transientRetryConfig(),
  sleep: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<T> {
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await execute();
    } catch (error) {
      if (attempt >= config.maxAttempts || !isTransientConnectionError(error)) {
        throw error;
      }
      await sleep(backoffDelayMs(attempt, config));
    }
  }
}
