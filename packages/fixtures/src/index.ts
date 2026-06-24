import type { OracleData } from "@oracle-command-center/domain";
import { listSourceBackedAgents, listSourceSnapshots } from "../../team-kit-source/src/index.js";

import "../../../oracle-data.js";

declare global {
  interface Window {
    ORACLE_DATA?: OracleData;
  }

  // eslint-disable-next-line no-var
  var ORACLE_DATA: OracleData | undefined;
}

export function loadFixtureData(): OracleData {
  const root = globalThis as typeof globalThis & { ORACLE_DATA?: OracleData; window?: Window };
  const data = root.window?.ORACLE_DATA ?? root.ORACLE_DATA;

  if (!data) {
    throw new Error("Oracle fixture corpus was not loaded.");
  }

  return data;
}

export function loadReferenceBackedFixtureData(): OracleData {
  const data = loadFixtureData();
  const sourceSnapshots = listSourceSnapshots();
  return {
    ...data,
    agents: listSourceBackedAgents(),
    sourceSnapshots,
    corpus: {
      ...data.corpus,
      sources: data.corpus.sources + sourceSnapshots.length
    }
  };
}

export const fixtureData = loadReferenceBackedFixtureData();
