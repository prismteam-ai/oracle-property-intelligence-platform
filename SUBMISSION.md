# Oracle Property Intelligence Platform Submission

## Runtime And Demo

- Runtime: https://oracle-command-center-nine.vercel.app/
- Demo video: https://www.loom.com/share/b65506e580eb4101a812a42f9800a5f2
- Credentials: none required; the runtime is public.

## Evaluation Path

1. Open the runtime on the `Intelligence` workflow.
2. Open the Required Demo Inquiries drawer.
3. Run Oracle inquiries such as `Show all properties with open roofing permits`, `Show contractors with complaint histories`, and `Show relationships between a selected property, contractor, business, tenant, and owner`.
4. Inspect result detail panes for canonical entities, citations, source provenance, and relationship graph evidence.
5. Use the free-text RAG input for stretch questions such as `Which properties appear likely to be undergoing redevelopment?`.
6. Open `Evidence` only as supporting provenance for Oracle intelligence runs.

## Delivery Timing Note

This PR packages the previously completed submission into the requested assignment repository.

- Original completed source commit: https://github.com/gillworks/prismteam/commit/db7e250cf139f47a3ee29ec2ad30745f1b92c92a
- Original completion timestamp: 2026-06-19 04:27:53 UTC
- Original source repository: https://github.com/gillworks/prismteam

The commits in this PR are administrative packaging after Sean's follow-up request for PR-based submission.

## Notes For Slowking

- PR gate: this PR targets the designated Oracle assignment repository.
- Runtime gate: the Vercel deployment is public and does not require local setup.
- Demo gate: the Loom link above is reachable from this PR.
- Credentials gate: no credentials are required for fixture-backed runtime use.
- The original assignment prompt is preserved in `ASSIGNMENT.md`.
