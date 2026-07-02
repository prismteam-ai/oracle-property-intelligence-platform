import Link from "next/link";
import { notFound } from "next/navigation";

import { Citations } from "@/components/Citations";
import { PermitTable, PropertyLink } from "@/components/PermitTable";
import { Empty, Field, Section, Stat } from "@/components/ui";
import { buildCitations } from "@/lib/provenance";
import { data } from "@/server/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function ContractorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const detail = await data.getContractorDetail(id);
  if (!detail) notFound();

  const {
    company,
    reputation,
    reviews,
    complaints,
    reviewSummary,
    permits,
    projects,
    properties,
    isNegative,
  } = detail;

  return (
    <div data-testid="contractor-detail">
      <div className="breadcrumb">
        <Link href="/contractors">Contractors</Link> / {company.name}
      </div>
      <h1 data-testid="contractor-title">{company.name ?? "Contractor"}</h1>
      <p className="muted">
        Lee County contractor ·{" "}
        {isNegative ? (
          <span className="pill pill-bad">negative BBB</span>
        ) : (
          <span className="pill pill-good">no negative BBB indicators</span>
        )}
      </p>

      {/* BBB rating + review summary (AC #38, #40) */}
      <Section title="BBB rating & reputation" testid="contractor-bbb">
        <div className="grid">
          <Stat
            label="BBB rating"
            value={reputation?.bbbRating ?? "NR"}
            testid="bbb-rating"
          />
          <Stat
            label="Rating score"
            value={reputation?.ratingScore ?? "—"}
            testid="bbb-score"
          />
          <Stat
            label="Avg review"
            value={reviewSummary.averageRating ?? "—"}
            testid="review-average"
          />
          <Stat label="Reviews" value={reviewSummary.reviewCount} testid="review-count" />
          <Stat
            label="Complaints"
            value={reputation?.complaintCount ?? complaints.length}
            testid="complaint-count"
          />
          <Stat
            label="Accredited"
            value={String(reputation?.isAccredited ?? false)}
            testid="accredited"
          />
        </div>
        <div style={{ marginTop: 12 }}>
          <Field label="Review sentiment" value={`${reviewSummary.positiveCount} positive · ${reviewSummary.negativeCount} negative`} />
          <Field label="Provider" value={reputation?.provider ?? "—"} />
          {reputation?.profileUrl ? (
            <Field
              label="BBB profile"
              value={
                <a href={reputation.profileUrl} target="_blank" rel="noreferrer">
                  open
                </a>
              }
            />
          ) : null}
        </div>
      </Section>

      <Section title="Review summaries" count={reviews.length} testid="contractor-reviews">
        {reviews.length ? (
          <table data-testid="reviews-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Rating</th>
                <th>Reviewer</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              {reviews.slice(0, 25).map((r, i) => (
                <tr key={r.businessReputationReviewId ?? i} data-testid="review-row">
                  <td>{r.reviewDate ?? "—"}</td>
                  <td>{r.reviewRating ?? "—"}</td>
                  <td>{r.reviewerDisplayName ?? "—"}</td>
                  <td>{r.reviewText ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No reviews on file.</Empty>
        )}
      </Section>

      {/* BBB complaints (AC #39) */}
      <Section title="BBB complaints" count={complaints.length} testid="contractor-complaints">
        {complaints.length ? (
          <table data-testid="complaints-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Status</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {complaints.slice(0, 25).map((c, i) => (
                <tr key={c.businessReputationComplaintId ?? i} data-testid="complaint-row">
                  <td>{c.complaintDate ?? "—"}</td>
                  <td>{c.complaintCategory ?? "—"}</td>
                  <td>{c.complaintStatus ?? "—"}</td>
                  <td>{c.complaintSummary ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No complaints on file.</Empty>
        )}
      </Section>

      <Section title="Permit history" count={permits.length} testid="contractor-permits">
        <PermitTable permits={permits} testid="contractor-permits-table" />
      </Section>

      {/* Project history (AC #36) */}
      <Section title="Project history" count={projects.length} testid="contractor-projects">
        {projects.length ? (
          <table data-testid="projects-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Status</th>
                <th>Type</th>
                <th>Permits</th>
                <th>Value</th>
                <th>Major</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p, i) => (
                <tr key={p.projectId ?? i} data-testid="project-row">
                  <td>{p.projectName ?? "—"}</td>
                  <td>{p.projectStatus ?? "—"}</td>
                  <td>{p.projectType ?? "—"}</td>
                  <td>{p.permitCount ?? 0}</td>
                  <td>
                    {p.totalEstimatedValue
                      ? `$${Number(p.totalEstimatedValue).toLocaleString()}`
                      : "—"}
                  </td>
                  <td>{p.isMajorRenovation ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No named projects.</Empty>
        )}
      </Section>

      <Section
        title="Properties worked on"
        count={properties.length}
        testid="contractor-properties"
      >
        {properties.length ? (
          <table data-testid="contractor-properties-table">
            <thead>
              <tr>
                <th>Parcel</th>
                <th>Subdivision</th>
                <th>Municipality</th>
                <th>Permits</th>
              </tr>
            </thead>
            <tbody>
              {properties.slice(0, 50).map((p) => (
                <tr key={p.propertyId} data-testid="contractor-property-row">
                  <td>
                    <PropertyLink propertyId={p.propertyId} label={p.parcelIdentifier} />
                  </td>
                  <td>{p.subdivision ?? "—"}</td>
                  <td>{p.municipalityName ?? "—"}</td>
                  <td>{p.permitCount ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty>No linked properties.</Empty>
        )}
      </Section>

      <Section title="Provenance" testid="contractor-provenance">
        <Citations items={buildCitations(reputation ? [reputation] : [])} />
      </Section>
    </div>
  );
}
