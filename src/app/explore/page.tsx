import { Citations } from "@/components/Citations";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const question = (q ?? "").trim();

  return (
    <div>
      <h1>Explore</h1>
      <form method="get" action="/explore" className="card">
        <input
          type="search"
          name="q"
          defaultValue={question}
          placeholder="Ask anything about properties, contractors, businesses, tenants..."
          style={{ width: "70%" }}
        />
        <button type="submit">Ask</button>
      </form>

      {question ? <Answer question={question} /> : <p className="muted">Enter a question above.</p>}
    </div>
  );
}

async function Answer({ question }: { question: string }) {
  const result = await data.answerQuestion(question);
  return (
    <div>
      <div className="card">
        <div className="muted">Mode: {result.mode}</div>
        <p>{result.answer}</p>
        <h3>Citations</h3>
        <Citations items={result.citations} />
      </div>

      <div className="card">
        <h3>Evidence ({result.evidence.length})</h3>
        {result.evidence.length === 0 ? (
          <p className="muted">No supporting evidence.</p>
        ) : (
          <ul>
            {result.evidence.map((e) => (
              <li key={e.documentId}>
                <strong>{e.title}</strong> <span className="muted">[{e.entityType}] score {e.score.toFixed(3)}</span>
                <div className="muted">{e.snippet}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
