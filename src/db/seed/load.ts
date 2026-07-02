import { db } from "@/server/pg";
import {
  addresses,
  businessRegistrationAddresses,
  businessRegistrationParties,
  businessRegistrations,
  businessReputationComplaintEvents,
  businessReputationComplaints,
  businessReputationProfiles,
  businessReputationReviews,
  companies,
  contractorQualityScores,
  entityDocuments,
  occupancies,
  ownerships,
  parcels,
  people,
  permitContacts,
  projectContractors,
  projectPermits,
  projects,
  properties,
  propertyImprovements,
  propertySignalRollups,
  propertyValuations,
  publicRecords,
  salesHistories,
  taxes,
  tenants,
} from "@/db/schema";
import { generate, type GeneratedGraph } from "./generate";
import { buildDocuments } from "./documents";

async function insertChunked(
  table: Parameters<typeof db.insert>[0],
  rows: readonly Record<string, unknown>[],
  chunkSize = 1000,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = rows.slice(i, i + chunkSize);
    if (batch.length === 0) continue;
    await db.insert(table).values(batch).onConflictDoNothing();
  }
}

async function insertAll(graph: GeneratedGraph): Promise<void> {
  await insertChunked(people, graph.people);
  await insertChunked(companies, graph.companies);
  await insertChunked(addresses, graph.addresses);
  await insertChunked(parcels, graph.parcels);
  await insertChunked(properties, graph.properties);
  await insertChunked(ownerships, graph.ownerships);
  await insertChunked(taxes, graph.taxes);
  await insertChunked(salesHistories, graph.salesHistories);
  await insertChunked(propertyValuations, graph.propertyValuations);
  await insertChunked(propertyImprovements, graph.propertyImprovements);
  await insertChunked(permitContacts, graph.permitContacts);
  await insertChunked(businessRegistrations, graph.businessRegistrations);
  await insertChunked(businessRegistrationParties, graph.businessRegistrationParties);
  await insertChunked(businessRegistrationAddresses, graph.businessRegistrationAddresses);
  await insertChunked(businessReputationProfiles, graph.businessReputationProfiles);
  await insertChunked(businessReputationReviews, graph.businessReputationReviews);
  await insertChunked(businessReputationComplaints, graph.businessReputationComplaints);
  await insertChunked(
    businessReputationComplaintEvents,
    graph.businessReputationComplaintEvents,
  );
  await insertChunked(contractorQualityScores, graph.contractorQualityScores);
  await insertChunked(tenants, graph.tenants);
  await insertChunked(occupancies, graph.occupancies);
  await insertChunked(projects, graph.projects);
  await insertChunked(projectPermits, graph.projectPermits);
  await insertChunked(projectContractors, graph.projectContractors);
  await insertChunked(propertySignalRollups, graph.rollups);
  await insertChunked(publicRecords, graph.publicRecords);
}

export async function load(): Promise<{ inserted: number; documents: number }> {
  const graph = generate();
  await insertAll(graph);
  const docs = buildDocuments(graph);
  await insertChunked(entityDocuments, docs);
  const inserted = Object.values(graph).reduce(
    (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
    0,
  );
  return { inserted, documents: docs.length };
}

const isMain =
  typeof process !== "undefined" &&
  process.argv[1] &&
  process.argv[1].endsWith("load.ts");
if (isMain) {
  load()
    .then((r) => {
      console.log(`Seed complete: ${r.inserted} rows, ${r.documents} RAG documents.`);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
