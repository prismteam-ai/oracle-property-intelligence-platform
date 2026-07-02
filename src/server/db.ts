import "server-only";

import type { DataAccess } from "./ports";
import { memoryProvider } from "./providers/memory";
import { localProvider } from "./providers/local";
import { neonProvider } from "./providers/neon";
import { resolveProviderKind } from "./provider-kind";

function selectProvider(): DataAccess {
  switch (resolveProviderKind(process.env)) {
    case "neon":
      return neonProvider;
    case "local":
      return localProvider;
    case "memory":
      return memoryProvider;
  }
}

export const data: DataAccess = selectProvider();

export { localProvider, memoryProvider, neonProvider };
