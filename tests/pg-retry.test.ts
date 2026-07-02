import { describe, expect, it } from "vitest";

import {
  isTransientConnectionError,
  runWithTransientRetry,
  type TransientRetryConfig,
} from "@/server/pg-retry";

const config: TransientRetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 1,
  maxDelayMs: 1,
};

const noSleep = async (): Promise<void> => {};

function transientError(message: string, code?: string): Error {
  const error = new Error(message);
  if (code) (error as Error & { code?: string }).code = code;
  return error;
}

describe("isTransientConnectionError", () => {
  it("recognizes Neon cold-start connection messages", () => {
    expect(
      isTransientConnectionError(new Error("Connection terminated unexpectedly")),
    ).toBe(true);
    expect(
      isTransientConnectionError(
        new Error("terminating connection due to administrator command"),
      ),
    ).toBe(true);
    expect(
      isTransientConnectionError(
        new Error("Client has encountered a connection error and is not queryable"),
      ),
    ).toBe(true);
    expect(isTransientConnectionError(new Error("socket hang up"))).toBe(true);
  });

  it("recognizes transient error codes", () => {
    expect(isTransientConnectionError(transientError("read", "ECONNRESET"))).toBe(true);
    expect(isTransientConnectionError(transientError("admin", "57P01"))).toBe(true);
  });

  it("rejects real SQL errors", () => {
    expect(
      isTransientConnectionError(new Error('column "missing" does not exist')),
    ).toBe(false);
    expect(
      isTransientConnectionError(
        new Error("syntax error at or near \"SELCT\""),
      ),
    ).toBe(false);
    expect(
      isTransientConnectionError(transientError("duplicate key", "23505")),
    ).toBe(false);
  });
});

describe("runWithTransientRetry", () => {
  it("retries a transient connection error on the first attempt and then succeeds", async () => {
    let attempts = 0;
    const result = await runWithTransientRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("Connection terminated unexpectedly");
        return "rows";
      },
      config,
      noSleep,
    );
    expect(result).toBe("rows");
    expect(attempts).toBe(2);
  });

  it("throws a real SQL error immediately without retrying", async () => {
    let attempts = 0;
    await expect(
      runWithTransientRetry(
        async () => {
          attempts += 1;
          throw new Error('column "owner_naem" does not exist');
        },
        config,
        noSleep,
      ),
    ).rejects.toThrow('column "owner_naem" does not exist');
    expect(attempts).toBe(1);
  });

  it("throws once the retry budget is exhausted on a persistent connection error", async () => {
    let attempts = 0;
    await expect(
      runWithTransientRetry(
        async () => {
          attempts += 1;
          throw transientError("socket hang up", "ECONNRESET");
        },
        config,
        noSleep,
      ),
    ).rejects.toThrow("socket hang up");
    expect(attempts).toBe(config.maxAttempts);
  });
});
