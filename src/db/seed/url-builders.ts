export function leepaParcelUrl(strapNormalized: string): string {
  return `https://www.leepa.org/Display/DisplayParcel.aspx?FolioID=${strapNormalized}`;
}

export function leepaSearchUrl(parcelIdentifier: string): string {
  return `https://www.leepa.org/Search/PropertySearch.aspx?STRAP=${encodeURIComponent(parcelIdentifier)}`;
}

export function accelaPermitUrl(permitNumber: string): string {
  return `https://aca-prod.accela.com/LEE/Cap/CapDetail.aspx?Module=Permits&capID=${encodeURIComponent(permitNumber)}`;
}

export function sunbizUrl(documentNumber: string): string {
  return `https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=DocumentNumber&directionType=Initial&searchNameOrder=&aggregateId=${encodeURIComponent(documentNumber)}`;
}

export function bbbProfileUrl(slug: string): string {
  return `https://www.bbb.org/us/fl/fort-myers/profile/contractors/${slug}`;
}

export function femaSearchUrl(communityId: string): string {
  return `https://msc.fema.gov/portal/search?AddressQuery=${encodeURIComponent(communityId)}`;
}
