# Oracle Elephant Lexicon

This build models Oracle property intelligence through a typed Elephant Lexicon in `packages/domain/src/index.ts`.

## Canonical Entities

| Entity | Durable identifier | Primary sources |
| --- | --- | --- |
| Property | `property:{county}:{parcel}` | Lee County Property Appraiser, Lee County Permitting, Sunbiz, BBB |
| Owner | `owner:{normalized-name}:{county}` | Lee County Property Appraiser, Sunbiz |
| Tenant | `tenant:{normalized-name}:{county}` | Oracle occupancy records, Sunbiz, Lee County Permitting |
| Business | `business:{sunbiz-document-number}` | Sunbiz, Lee County Permitting, BBB |
| Contractor | `contractor:{license-or-normalized-name}:{county}` | Lee County Permitting, BBB, Sunbiz |
| Permit | `permit:{source}:{permit-number}` | Lee County Permitting |
| Address | `address:{normalized-address-hash}` | Lee County Property Appraiser, Lee County Permitting, Sunbiz, BBB |
| Parcel | `parcel:{county}:{normalized-parcel-id}` | Lee County Property Appraiser, Lee County Permitting |
| Project | `project:{property-id}:{permit-id}` | Lee County Permitting, BBB |
| Review | `review:{source}:{contractor-or-business}:{review-id}` | BBB |
| Complaint | `complaint:{source}:{contractor-or-business}:{complaint-id}` | BBB |
| PublicRecord | `public-record:{source}:{record-key}` | Lee County Property Appraiser, Lee County Permitting, Sunbiz, BBB |

Every entity is expected to preserve source system, source URL, collection timestamp, refresh timestamp, and lineage evidence.

## Relationships

| Relationship | From | To | Evidence |
| --- | --- | --- | --- |
| `property-owned-by-owner` | Property | Owner | ownership history and property source records |
| `property-identified-by-parcel` | Property | Parcel | parcel id and appraiser/permitting records |
| `property-located-at-address` | Property | Address | situs address, city, source records |
| `property-has-permit` | Property | Permit | permit list and property provenance |
| `permit-performed-by-contractor` | Permit | Contractor | permit contractor id and contractor records |
| `property-occupied-by-tenant` | Property | Tenant | occupancy and tenant records |
| `tenant-associated-with-business` | Tenant | Business | tenant business links and Sunbiz records |
| `business-operates-at-property` | Business | Property | business locations and property records |
| `permit-produces-project` | Permit | Project | permit scope, major flag, and property records |
| `contractor-has-review` | Contractor | Review | BBB rating/review evidence |
| `contractor-has-complaint` | Contractor | Complaint | BBB complaint evidence |
| `public-record-supports-entity` | PublicRecord | Property | source URL, collection timestamp, refresh timestamp |

## Structured Query Surface

`packages/retrieval` supports structured filters over the lexicon:

- county
- municipality
- permit type
- contractor
- property class
- business type
- status
- date range

The tRPC API exposes this through `intelligence.structuredSearch` and exposes the lexicon through `intelligence.lexicon` and `dashboard.lexicon`.
