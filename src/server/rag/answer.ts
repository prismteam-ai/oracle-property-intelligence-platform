import "server-only";

import type { RagAnswer, RagEvidence } from "@/server/ports";
import { ragRetrieve } from "./retrieve";
import { runInquiry } from "@/server/queries/runInquiry";
import { synthesizeAnswer, type InquiryRunResult } from "./synthesize";
import { BedrockClaudeAnswerService } from "./synthesize-bedrock";

const ANSWER_PROVIDER = (process.env.ANSWER_PROVIDER ?? "bedrock").toLowerCase();

function selectLlmSynthesize():
  | ((question: string, evidence: RagEvidence[]) => Promise<string | null>)
  | undefined {
  switch (ANSWER_PROVIDER) {
    case "bedrock": {
      let service: BedrockClaudeAnswerService | undefined;
      return (question, evidence) => {
        if (evidence.length === 0) return Promise.resolve(null);
        service ??= new BedrockClaudeAnswerService();
        return service.synthesize(question, evidence);
      };
    }
    case "template":
      return undefined;
    default:
      throw new Error(
        `[oracle] Unknown ANSWER_PROVIDER="${ANSWER_PROVIDER}". ` +
          "Expected one of: bedrock | template. " +
          "The deterministic template is test-only and is never a silent runtime fallback.",
      );
  }
}

const llmSynthesize = selectLlmSynthesize();

export async function answerQuestion(question: string): Promise<RagAnswer> {
  return synthesizeAnswer(question, {
    retrieve: (q, limit) => ragRetrieve(q, limit),
    runInquiry: (id) => runInquiry(id) as Promise<InquiryRunResult>,
    llmSynthesize,
  });
}
