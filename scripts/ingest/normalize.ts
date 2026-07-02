import { createHash } from "node:crypto";

import type {
  NewAddress,
  NewCompany,
  NewOwnership,
  NewParcel,
  NewPerson,
  NewProperty,
  NewPropertyImprovement,
  NewPublicRecord,
  NewSalesHistory,
  NewTax,
} from "@/db/schema/types";
import { normalizeName } from "@/db/seed/vocab";

import { LEEPA_SOURCE_SYSTEM, type LeepaParcelAttributes } from "./leepa-source";

const UUID_NAMESPACE = "1b671a64-40d5-491e-99b0-da01ff1f3341";
const JURISDICTION_KEY = "fl-lee";
const COUNTY_NAME = "Lee";
const STATE_CODE = "FL";

export function deterministicUuid(key: string): string {
  const hash = createHash("sha1")
    .update(UUID_NAMESPACE.replace(/-/g, ""), "hex")
    .update(key, "utf8")
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes.writeUInt8((bytes.readUInt8(6) & 0x0f) | 0x50, 6);
  bytes.writeUInt8((bytes.readUInt8(8) & 0x3f) | 0x80, 8);
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function clean(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function cleanOwnerName(value: string | null | undefined): string | null {
  const base = clean(value);
  if (base === null) return null;
  const stripped = base.replace(/[\s+&]+$/g, "").trim();
  return stripped.length === 0 ? base : stripped;
}

function money(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value.toFixed(2);
}

function epochToDate(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return new Date(value).toISOString().slice(0, 10);
}

const COMPANY_TOKENS = new Set([
  "LLC", "L.L.C.", "INC", "INC.", "CORP", "CORP.", "CO", "CO.", "LP", "L.P.",
  "LTD", "LLP", "PA", "PLLC", "TRUST", "TR", "ASSN", "ASSOCIATION", "BANK",
  "CHURCH", "CITY", "COUNTY", "DEPT", "FOUNDATION", "FUND", "HOLDINGS",
  "PARTNERS", "PARTNERSHIP", "PROPERTIES", "REALTY", "MINISTRIES", "ENTERPRISES",
  "GROUP", "INVESTMENTS", "DISTRICT", "AUTHORITY", "STATE", "USA", "US",
]);

export function isCompanyOwner(name: string): boolean {
  const upper = name.toUpperCase();
  const tokens = upper.split(/[\s,]+/).filter(Boolean);
  return tokens.some((token) => COMPANY_TOKENS.has(token));
}

export type NormalizedParcel = {
  parcel: NewParcel;
  property: NewProperty;
  siteAddress: NewAddress | null;
  ownerPerson: NewPerson | null;
  ownerCompany: NewCompany | null;
  ownership: NewOwnership;
  tax: NewTax | null;
  sales: NewSalesHistory[];
  improvement: NewPropertyImprovement | null;
  publicRecord: NewPublicRecord;
};

function siteAddressFields(strap: string, a: LeepaParcelAttributes): NewAddress | null {
  const number = clean(a.SITENUMBER);
  const street = clean(a.SITESTREET);
  const city = clean(a.SITECITY);
  const zip = clean(a.SITEZIP);
  const full = clean(a.SITEADDR);
  if (!number && !street && !city && !full) return null;
  const addressId = deterministicUuid(`leepa:site_address:${strap}`);
  return {
    addressId,
    streetNumber: number,
    streetName: street,
    unitIdentifier: clean(a.SITEUNIT),
    cityName: city,
    municipalityName: city,
    countyName: COUNTY_NAME,
    stateCode: STATE_CODE,
    postalCode: zip,
    countryCode: "US",
    latitude: a.LATITUDE != null ? String(a.LATITUDE) : null,
    longitude: a.LONGITUDE != null ? String(a.LONGITUDE) : null,
    section: clean(a.TRSPARCEL)?.slice(0, 2) ?? null,
    unnormalizedAddress: full ?? [number, street, city, STATE_CODE, zip].filter(Boolean).join(" "),
    normalizedAddressKey: normalizeName(
      [number, street, city, zip].filter(Boolean).join(" "),
    ),
    sourceSystem: LEEPA_SOURCE_SYSTEM,
    sourceRecordKey: `leepa:site_address:${strap}`,
    sourceArtifactUri: clean(a.Property_URL),
    sourcePayload: {},
  };
}

function salesFor(propertyId: string, strap: string, a: LeepaParcelAttributes): NewSalesHistory[] {
  const slots: { date: number | null; amount: number | null; vi: string | null; or: string | null }[] = [
    { date: a.S_1DATE, amount: a.S_1AMOUNT, vi: a.S_1VI, or: a.S_1OR_NUM },
    { date: a.S_2DATE, amount: a.S_2AMOUNT, vi: a.S_2VI, or: a.S_2OR_NUM },
    { date: a.S_3DATE, amount: a.S_3AMOUNT, vi: a.S_3VI, or: a.S_3OR_NUM },
    { date: a.S_4DATE, amount: a.S_4AMOUNT, vi: a.S_4VI, or: a.S_4OR_NUM },
  ];
  const out: NewSalesHistory[] = [];
  slots.forEach((slot, index) => {
    const date = epochToDate(slot.date);
    const amount = money(slot.amount);
    const orNumber = clean(slot.or);
    if (!date && !amount && !orNumber) return;
    out.push({
      salesHistoryId: deterministicUuid(`leepa:sale:${strap}:${index + 1}`),
      propertyId,
      ownershipTransferDate: date,
      purchasePriceAmount: amount,
      saleType: slot.vi === "I" ? "improved" : slot.vi === "V" ? "vacant" : null,
      instrumentNumber: orNumber,
      sourceSystem: LEEPA_SOURCE_SYSTEM,
      sourceRecordKey: `leepa:sale:${strap}:${index + 1}`,
      sourceArtifactUri: clean(a.Property_URL),
      sourcePayload: { transactionCode: slot.vi },
    });
  });
  return out;
}

function numericText(value: number | null | undefined): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return String(value);
}

function yesNo(value: string | null | undefined): boolean | null {
  const cleaned = clean(value);
  if (cleaned === null) return null;
  const upper = cleaned.toUpperCase();
  if (upper === "Y" || upper === "YES" || upper === "TRUE") return true;
  if (upper === "N" || upper === "NO" || upper === "FALSE") return false;
  return null;
}

function buildingCharacteristics(
  propertyId: string,
  parcelId: string,
  addressId: string | null,
  strap: string,
  a: LeepaParcelAttributes,
): NewPropertyImprovement | null {
  const bldgCount = a.BLDGCOUNT ?? 0;
  const heated = a.HEATEDAREA ?? 0;
  const total = a.TOTALAREA ?? 0;
  if (bldgCount <= 0 && heated <= 0 && total <= 0) return null;
  const builtYear = a.MAXBUILTY && a.MAXBUILTY > 0 ? a.MAXBUILTY : null;
  const descriptionParts = [
    bldgCount > 0 ? `${bldgCount} building(s)` : null,
    heated > 0 ? `${heated} sq ft heated` : null,
    a.BEDROOMS ? `${a.BEDROOMS} bed` : null,
    a.BATHROOMS ? `${a.BATHROOMS} bath` : null,
    builtYear ? `built ${builtYear}` : null,
  ].filter(Boolean);
  return {
    propertyImprovementId: deterministicUuid(`leepa:building:${strap}`),
    propertyId,
    parcelId,
    addressId,
    parcelIdentifier: strap,
    improvementType: "building_characteristics",
    improvementStatus: builtYear ? "existing" : null,
    completionDate: builtYear ? `${builtYear}-01-01` : null,
    estimatedSqFt: numericText(heated > 0 ? heated : total),
    description: descriptionParts.join(", ") || null,
    projectDescription: clean(a.LANDUSEDES),
    isOwnerBuilder: yesNo(null),
    source: "leepa",
    sourceUrl: clean(a.Property_URL),
    moreDetails: {
      buildingCount: a.BLDGCOUNT,
      minBuiltYear: a.MINBUILTY,
      maxBuiltYear: a.MAXBUILTY,
      totalArea: a.TOTALAREA,
      heatedArea: a.HEATEDAREA,
      maxStories: a.MAXSTORIES,
      bedrooms: a.BEDROOMS,
      bathrooms: a.BATHROOMS,
      garage: clean(a.GARAGE),
      carport: clean(a.CARPORT),
      pool: clean(a.POOL),
      boatDock: clean(a.BOATDOCK),
      seawall: clean(a.SEAWALL),
      condoType: clean(a.CONDOTYPE),
    },
    sourceSystem: LEEPA_SOURCE_SYSTEM,
    sourceRecordKey: `leepa:building:${strap}`,
    sourceArtifactUri: clean(a.Property_URL),
    sourcePayload: {},
  };
}

export function normalizeParcel(a: LeepaParcelAttributes): NormalizedParcel | null {
  const strap = clean(a.STRAP);
  if (!strap) return null;

  const parcelId = deterministicUuid(`leepa:parcel:${strap}`);
  const propertyId = deterministicUuid(`leepa:property:${strap}`);
  const propertyUrl = clean(a.Property_URL);
  const builtYear = a.MAXBUILTY && a.MAXBUILTY > 0 ? a.MAXBUILTY : null;
  const effectiveBuilt = a.MINBUILTY && a.MINBUILTY > 0 ? a.MINBUILTY : null;

  const siteAddress = siteAddressFields(strap, a);

  const parcel: NewParcel = {
    parcelId,
    parcelIdentifier: strap,
    countyName: COUNTY_NAME,
    stateCode: STATE_CODE,
    jurisdictionKey: JURISDICTION_KEY,
    sourcePayload: { folioId: a.FOLIOID, dorCode: clean(a.DORCODE), gisAcres: a.GISACRES },
    sourceSystem: LEEPA_SOURCE_SYSTEM,
    sourceRecordKey: `leepa:parcel:${strap}`,
    sourceArtifactUri: propertyUrl,
  };

  const property: NewProperty = {
    propertyId,
    parcelId,
    addressId: siteAddress?.addressId ?? null,
    parcelIdentifier: strap,
    propertyType: clean(a.LANDUSEDES),
    propertyUsageType: clean(a.LANDUSEDES),
    propertyLegalDescriptionText: clean(a.LEGAL),
    propertyStructureBuiltYear: builtYear,
    propertyEffectiveBuiltYear: effectiveBuilt,
    livableFloorArea: a.HEATEDAREA != null ? String(a.HEATEDAREA) : null,
    areaUnderAir: a.HEATEDAREA != null ? String(a.HEATEDAREA) : null,
    totalArea: a.TOTALAREA != null ? String(a.TOTALAREA) : null,
    numberOfUnits: a.NUMUNITS != null ? Math.round(a.NUMUNITS) : null,
    zoning: clean(a.ZONING),
    sourcePayload: {},
    sourceSystem: LEEPA_SOURCE_SYSTEM,
    sourceRecordKey: `leepa:property:${strap}`,
    sourceArtifactUri: propertyUrl,
  };

  const ownerName = cleanOwnerName(a.O_NAME);
  let ownerPerson: NewPerson | null = null;
  let ownerCompany: NewCompany | null = null;
  if (ownerName) {
    if (isCompanyOwner(ownerName)) {
      ownerCompany = {
        companyId: deterministicUuid(`leepa:owner_company:${strap}`),
        name: ownerName,
        normalizedName: normalizeName(ownerName),
        sourceSystem: LEEPA_SOURCE_SYSTEM,
        sourceRecordKey: `leepa:owner_company:${strap}`,
        sourceArtifactUri: propertyUrl,
        sourcePayload: {},
      };
    } else {
      ownerPerson = {
        personId: deterministicUuid(`leepa:owner_person:${strap}`),
        fullName: ownerName,
        normalizedName: normalizeName(ownerName),
        sourceSystem: LEEPA_SOURCE_SYSTEM,
        sourceRecordKey: `leepa:owner_person:${strap}`,
        sourceArtifactUri: propertyUrl,
        sourcePayload: {},
      };
    }
  }

  const ownership: NewOwnership = {
    ownershipId: deterministicUuid(`leepa:ownership:${strap}`),
    propertyId,
    ownerPersonId: ownerPerson?.personId ?? null,
    ownerCompanyId: ownerCompany?.companyId ?? null,
    mailingAddressId: null,
    ownedBy: ownerName,
    propertyOwnershipStructure: ownerCompany ? "entity" : ownerPerson ? "individual" : null,
    ownerOccupiedIndicator: a.HSTDAMOUNT != null && a.HSTDAMOUNT > 0,
    sourceSystem: LEEPA_SOURCE_SYSTEM,
    sourceRecordKey: `leepa:ownership:${strap}`,
    sourceArtifactUri: propertyUrl,
    sourcePayload: {
      ownerOthers: clean(a.O_OTHERS),
      ownerCareOf: clean(a.O_CAREOF),
      mailingAddress: [clean(a.O_ADDR1), clean(a.O_ADDR2), clean(a.O_CITY), clean(a.O_STATE), clean(a.O_ZIP)]
        .filter(Boolean)
        .join(" "),
    },
  };

  const market = money(a.JUST);
  const assessed = money(a.ASSESSED);
  const land = money(a.LAND);
  const building = money(a.BUILDING);
  const taxable = money(a.TAXABLE);
  const tax: NewTax | null =
    market || assessed || land || building || taxable
      ? {
          taxId: deterministicUuid(`leepa:tax:${strap}`),
          propertyId,
          propertyMarketValueAmount: market,
          propertyAssessedValueAmount: assessed,
          propertyLandAmount: land,
          propertyBuildingAmount: building,
          propertyTaxableValueAmount: taxable,
          propertyExemptionAmount: money(
            (a.HSTDAMOUNT ?? 0) +
              (a.SNRAMOUNT ?? 0) +
              (a.WHLYAMOUNT ?? 0) +
              (a.WIDAMOUNT ?? 0) +
              (a.WIDRAMOUNT ?? 0) +
              (a.DISAMOUNT ?? 0) +
              (a.AGAMOUNT ?? 0) +
              (a.HISTAMOUNT ?? 0),
          ),
          firstYearOnTaxRoll: a.CREATEYEAR && a.CREATEYEAR > 0 ? a.CREATEYEAR : null,
          firstYearBuildingOnTaxRoll: effectiveBuilt,
          sourceSystem: LEEPA_SOURCE_SYSTEM,
          sourceRecordKey: `leepa:tax:${strap}`,
          sourceArtifactUri: propertyUrl,
          sourcePayload: {},
        }
      : null;

  const publicRecord: NewPublicRecord = {
    publicRecordId: deterministicUuid(`leepa:public_record:${strap}`),
    entityType: "property",
    entityId: propertyId,
    sourceUrl: propertyUrl,
    collectionTimestamp: new Date(),
    lineage: {
      synthetic: false,
      pipeline: "oracle-ingest@leepa-arcgis",
      sourceSystem: LEEPA_SOURCE_SYSTEM,
      sourceRecordKey: `leepa:property:${strap}`,
      strap,
      folioId: a.FOLIOID,
    },
    sourcePayload: {},
    sourceSystem: LEEPA_SOURCE_SYSTEM,
    sourceRecordKey: `leepa:public_record:${strap}`,
    sourceArtifactUri: propertyUrl,
  };

  return {
    parcel,
    property,
    siteAddress,
    ownerPerson,
    ownerCompany,
    ownership,
    tax,
    sales: salesFor(propertyId, strap, a),
    improvement: buildingCharacteristics(propertyId, parcelId, siteAddress?.addressId ?? null, strap, a),
    publicRecord,
  };
}
