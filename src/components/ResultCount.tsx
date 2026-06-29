export function ResultCount({
  shown,
  noun,
  pluralNoun,
  limit,
  capped,
  testid = "result-count",
}: {
  shown: number;
  noun: string;
  pluralNoun?: string;
  limit: number;
  capped: boolean;
  testid?: string;
}) {
  const word = shown === 1 ? noun : pluralNoun ?? `${noun}s`;
  return (
    <p className="muted result-meta" data-testid={testid}>
      {capped ? (
        <>
          Showing first <strong>{shown}</strong> {word}{" "}
          <span className="truncation" data-testid="result-truncated">
            (display cap {limit} reached — refine filters to narrow, or raise ROW_DISPLAY_LIMIT)
          </span>
        </>
      ) : (
        <>
          Showing <strong>{shown}</strong> {word}
        </>
      )}
    </p>
  );
}
