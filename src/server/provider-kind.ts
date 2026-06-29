export type ProviderKind = "memory" | "local" | "neon";

type ProviderEnv = {
  DATA_SOURCE?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
};

const REAL_DB_SOURCES = new Set<ProviderKind>(["local", "neon"]);

export function resolveProviderKind(env: ProviderEnv): ProviderKind {
  const source = env.DATA_SOURCE?.toLowerCase();
  const isTest = env.NODE_ENV === "test";
  const isProduction = env.NODE_ENV === "production";

  if (source === "local" || source === "neon") {
    if (!env.DATABASE_URL) {
      throw new Error(
        `[oracle] DATA_SOURCE=${source} requires DATABASE_URL (real Postgres). ` +
          "Refusing to start: not falling back to the in-memory provider.",
      );
    }
    return source;
  }

  if (isTest) return "memory";
  if (source === "memory") return "memory";

  if (isProduction) {
    throw new Error(
      `[oracle] DATA_SOURCE must be one of: ${[...REAL_DB_SOURCES].join(" | ")} in production ` +
        `(got ${source ? `"${source}"` : "unset"}). ` +
        "Refusing to start: the in-memory provider is never a silent production fallback. " +
        "Set DATA_SOURCE=local with DATABASE_URL pointing at real Postgres.",
    );
  }

  return "memory";
}
