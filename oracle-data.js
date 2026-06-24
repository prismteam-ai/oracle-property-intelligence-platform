/* Oracle Property Intelligence — deterministic fixture corpus.
   Exposes window.ORACLE_DATA. Lee County, FL public-record style data. */
(function () {
  const SRC = {
    leepa:  { system: "Lee County Property Appraiser", host: "leepa.org" },
    permit: { system: "Lee County Permitting (BLDPMT)", host: "leegov.com/dcd" },
    sunbiz: { system: "Sunbiz — FL Division of Corporations", host: "sunbiz.org" },
    bbb:    { system: "BBB of Southwest Florida", host: "bbb.org" },
    tax:    { system: "Lee County Tax Collector", host: "leetc.com" }
  };
  const prov = (key, ref, daysAgoCollected, daysAgoRefreshed) => ({
    system: SRC[key].system,
    url: "https://" + SRC[key].host + "/" + ref,
    collected: iso(daysAgoCollected),
    refreshed: iso(daysAgoRefreshed)
  });
  function iso(daysAgo) {
    const d = new Date("2026-06-18T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - daysAgo);
    return d.toISOString().slice(0, 10);
  }

  // ---- Contractors ----
  const contractors = [
    { id: "c1", name: "Gulfstream Roofing & Sheet Metal", license: "CCC-1330781", trades: ["Roofing"], county: "Lee", projects: 34, bbb: "A+", complaints: [], review: 4.7, src: [prov("bbb", "us/fl/fort-myers/roofing/gulfstream", 41, 9)] },
    { id: "c2", name: "Cape Coral Electric Co.", license: "EC-13007722", trades: ["Electrical"], county: "Lee", projects: 28, bbb: "A", complaints: [], review: 4.5, src: [prov("bbb", "us/fl/cape-coral/electrician/cce", 38, 11)] },
    { id: "c3", name: "Caloosa Concrete & Foundations", license: "CGC-1521004", trades: ["Concrete", "Structural"], county: "Lee", projects: 19, bbb: "B", complaints: [], review: 4.1, src: [prov("bbb", "us/fl/fort-myers/concrete/caloosa", 52, 14)] },
    { id: "c4", name: "SunCoast Roofing Solutions", license: "CCC-1328890", trades: ["Roofing"], county: "Lee", projects: 22, bbb: "C", complaints: [{ date: iso(120), summary: "Failure to complete re-roof within agreed timeline.", status: "Resolved" }, { date: iso(64), summary: "Disputed change-order billing on tile replacement.", status: "Answered" }], review: 3.2, src: [prov("bbb", "us/fl/cape-coral/roofing/suncoast", 33, 7)] },
    { id: "c5", name: "Apex Mechanical & HVAC", license: "CAC-1819033", trades: ["HVAC", "Mechanical"], county: "Lee", projects: 17, bbb: "A-", complaints: [], review: 4.3, src: [prov("bbb", "us/fl/estero/hvac/apex", 44, 12)] },
    { id: "c6", name: "Estero Plumbing Works", license: "CFC-1429110", trades: ["Plumbing"], county: "Lee", projects: 14, bbb: "B+", complaints: [], review: 4.0, src: [prov("bbb", "us/fl/estero/plumbing/epw", 47, 16)] },
    { id: "c7", name: "Southwest Structural Group", license: "CGC-1509812", trades: ["Structural", "Concrete"], county: "Lee", projects: 12, bbb: "A", complaints: [], review: 4.6, src: [prov("bbb", "us/fl/fort-myers/general-contractor/swsg", 50, 13)] },
    { id: "c8", name: "Tri-County Electrical Contractors", license: "EC-13004411", trades: ["Electrical"], county: "Lee", projects: 9, bbb: "F", complaints: [{ date: iso(210), summary: "Unpermitted panel work; failed county inspection.", status: "Unresolved" }, { date: iso(155), summary: "Customer deposit not refunded after cancellation.", status: "Unresolved" }, { date: iso(98), summary: "Repeated no-shows for scheduled service.", status: "Answered" }, { date: iso(70), summary: "Aggressive collections on disputed invoice.", status: "Unresolved" }, { date: iso(30), summary: "Work abandoned mid-project at commercial site.", status: "Unresolved" }], review: 2.1, src: [prov("bbb", "us/fl/lehigh-acres/electrician/tricounty", 25, 4)] },
    { id: "c9", name: "Palm City Roofing", license: "CCC-1331540", trades: ["Roofing"], county: "Lee", projects: 11, bbb: "D", complaints: [{ date: iso(180), summary: "Leak recurrence within warranty period; unaddressed.", status: "Unresolved" }, { date: iso(112), summary: "Improper flashing led to interior water damage.", status: "Answered" }, { date: iso(48), summary: "Misrepresented insurance-claim scope.", status: "Unresolved" }], review: 2.6, src: [prov("bbb", "us/fl/north-fort-myers/roofing/palmcity", 29, 6)] },
    { id: "c10", name: "Coastline Builders LLC", license: "CGC-1514402", trades: ["Structural", "Concrete", "Roofing"], county: "Lee", projects: 26, bbb: "B", complaints: [{ date: iso(140), summary: "Punch-list items delayed past closeout.", status: "Resolved" }], review: 3.8, src: [prov("bbb", "us/fl/fort-myers/general-contractor/coastline", 36, 10)] },
    { id: "c11", name: "Lee Mechanical Systems", license: "CAC-1817744", trades: ["HVAC", "Plumbing"], county: "Lee", projects: 15, bbb: "A", complaints: [], review: 4.4, src: [prov("bbb", "us/fl/fort-myers/hvac/lms", 42, 12)] },
    { id: "c12", name: "Reliable Electric & Solar", license: "EC-13009955", trades: ["Electrical"], county: "Lee", projects: 7, bbb: "Not Rated", complaints: [], review: 3.9, src: [prov("bbb", "us/fl/cape-coral/electrician/reliable", 22, 5)] }
  ];

  // ---- Owners ----
  const owners = [
    { id: "o1", name: "Horizon Holdings LLC", type: "LLC", since: "2014", props: ["p4", "p10", "p15", "p18"], src: [prov("sunbiz", "Inquiry/L14000088210", 60, 18)] },
    { id: "o2", name: "Mangrove Capital Group", type: "LLC", since: "2016", props: ["p9", "p13", "p20"], src: [prov("sunbiz", "Inquiry/L16000231104", 58, 15)] },
    { id: "o3", name: "J. Whitfield Family Trust", type: "Trust", since: "2009", props: ["p2", "p7"], src: [prov("leepa", "parcel/owner/whitfield", 70, 20)] },
    { id: "o4", name: "Marisol Reyes", type: "Individual", since: "2019", props: ["p1"], src: [prov("leepa", "parcel/owner/reyes", 64, 19)] },
    { id: "o5", name: "Caloosa Hospitality Partners", type: "LLC", since: "2018", props: ["p3"], src: [prov("sunbiz", "Inquiry/L18000402210", 55, 17)] },
    { id: "o6", name: "David & Anna Kowalski", type: "Individual", since: "2021", props: ["p5"], src: [prov("leepa", "parcel/owner/kowalski", 49, 14)] },
    { id: "o7", name: "Pelican Bay Ventures LLC", type: "LLC", since: "2017", props: ["p6", "p11"], src: [prov("sunbiz", "Inquiry/L17000119087", 53, 16)] },
    { id: "o8", name: "Estero Commerce Trust", type: "Trust", since: "2015", props: ["p8", "p16"], src: [prov("leepa", "parcel/owner/estero-commerce", 61, 19)] },
    { id: "o9", name: "Thomas Nguyen", type: "Individual", since: "2022", props: ["p12"], src: [prov("leepa", "parcel/owner/nguyen", 40, 11)] },
    { id: "o10", name: "Gateway Retail Holdings LLC", type: "LLC", since: "2013", props: ["p14", "p17", "p19"], src: [prov("sunbiz", "Inquiry/L13000556621", 57, 18)] }
  ];

  // ---- Businesses ----
  const businesses = [
    { id: "b1", name: "Caloosa Coffee Co.", btype: "Food & Beverage", sunbiz: "L19000345021", status: "Active", owner: "Horizon Holdings LLC", locations: ["p10", "p15", "p18"], registered: "2019-03-12", src: [prov("sunbiz", "Inquiry/L19000345021", 45, 12)] },
    { id: "b2", name: "Riverwalk Dental Group", btype: "Healthcare", sunbiz: "L17000220114", status: "Active", owner: "Riverwalk Holdings PLLC", locations: ["p4", "p13"], registered: "2017-08-01", src: [prov("sunbiz", "Inquiry/L17000220114", 51, 13)] },
    { id: "b3", name: "Gulfside Outfitters", btype: "Retail", sunbiz: "L20000118776", status: "Active", owner: "Gulfside Retail LLC", locations: ["p17"], registered: "2020-01-22", src: [prov("sunbiz", "Inquiry/L20000118776", 44, 12)] },
    { id: "b4", name: "Edison Brew Hall", btype: "Food & Beverage", sunbiz: "L18000990013", status: "Active", owner: "Edison Hospitality LLC", locations: ["p3"], registered: "2018-11-09", src: [prov("sunbiz", "Inquiry/L18000990013", 48, 14)] },
    { id: "b5", name: "Cape Tackle & Marine", btype: "Retail", sunbiz: "L15000771220", status: "Inactive", owner: "Cape Marine Holdings", locations: ["p15"], registered: "2015-05-30", src: [prov("sunbiz", "Inquiry/L15000771220", 52, 16)] },
    { id: "b6", name: "Bluepoint Logistics", btype: "Industrial", sunbiz: "L16000455900", status: "Active", owner: "Bluepoint Holdings LLC", locations: ["p10", "p18"], registered: "2016-09-14", src: [prov("sunbiz", "Inquiry/L16000455900", 50, 15)] },
    { id: "b7", name: "Daniels Family Dentistry", btype: "Healthcare", sunbiz: "L21000300441", status: "Active", owner: "Daniels Dental PLLC", locations: ["p14"], registered: "2021-02-18", src: [prov("sunbiz", "Inquiry/L21000300441", 39, 11)] },
    { id: "b8", name: "Sanibel Provisions", btype: "Food & Beverage", sunbiz: "L14000662100", status: "Dissolved", owner: "Sanibel Provisions Inc.", locations: ["p15"], registered: "2014-07-07", src: [prov("sunbiz", "Inquiry/L14000662100", 60, 19)] },
    { id: "b9", name: "Estero Tech Works", btype: "Professional Services", sunbiz: "L22000510032", status: "Active", owner: "Estero Commerce Trust", locations: ["p16"], registered: "2022-04-05", src: [prov("sunbiz", "Inquiry/L22000510032", 33, 8)] },
    { id: "b10", name: "Pine Island Pottery", btype: "Retail", sunbiz: "L20000880117", status: "Active", owner: "K. Alvarez", locations: ["p19"], registered: "2020-10-19", src: [prov("sunbiz", "Inquiry/L20000880117", 41, 12)] }
  ];

  // ---- Tenants ----
  const tenants = [
    { id: "t1", name: "Gulf Coast Pediatrics", ttype: "Medical", locations: ["p4", "p13"], businesses: ["b2"], activity: "Active lease across two clinics; expanded 2024.", src: [prov("tax", "biztax/gulfcoast-peds", 35, 10)] },
    { id: "t2", name: "Bluepoint Logistics (operations)", ttype: "Industrial", locations: ["p10", "p18"], businesses: ["b6"], activity: "Warehousing tenant occupying two flex-industrial units.", src: [prov("tax", "biztax/bluepoint", 37, 11)] },
    { id: "t3", name: "Caloosa Coffee Co.", ttype: "Retail F&B", locations: ["p10", "p15", "p18"], businesses: ["b1"], activity: "Three storefront leases; newest opened Q1 2026.", src: [prov("tax", "biztax/caloosa-coffee", 31, 9)] },
    { id: "t4", name: "Edison Brew Hall", ttype: "Retail F&B", locations: ["p3"], businesses: ["b4"], activity: "Single anchor lease, River District.", src: [prov("tax", "biztax/edison-brew", 46, 13)] },
    { id: "t5", name: "Gulfside Outfitters", ttype: "Retail", locations: ["p17"], businesses: ["b3"], activity: "Single-location retail tenant since 2020.", src: [prov("tax", "biztax/gulfside", 43, 12)] }
  ];

  // permit helper
  let pidc = 1000;
  const pm = (type, status, contractor, value, daysAgo, scope, major) => ({
    id: "BP-" + (++pidc), type, status, contractor, value, filed: iso(daysAgo),
    scope, major: !!major
  });

  // ---- Properties ----
  const properties = [
    { id: "p1", address: "2210 First Street", city: "Fort Myers", neighborhood: "Downtown River District", parcel: "12-44-24-P3-00100.0010", class: "Commercial", year: 1968, owner: "o4",
      ownerHistory: [{ owner: "Marisol Reyes", date: "2019-05", type: "Warranty Deed" }, { owner: "Riverside Equity LLC", date: "2011-02", type: "Special Warranty" }],
      tenants: [], businesses: [],
      permits: [pm("Roofing", "Open", "c1", 86000, 22, "Full membrane re-roof, 3-story mixed-use", true), pm("Electrical", "Open", "c2", 41000, 18, "Service upgrade to 800A", false), pm("Plumbing", "Closed", "c6", 12000, 240, "Restroom riser replacement", false)],
      src: [prov("leepa", "parcel/12-44-24-P3-00100.0010", 64, 8), prov("permit", "permit/BP-1001", 22, 5)] },
    { id: "p2", address: "1480 McGregor Boulevard", city: "Fort Myers", neighborhood: "McGregor Corridor", parcel: "07-45-24-01-00012.0040", class: "Residential", year: 1952, owner: "o3",
      ownerHistory: [{ owner: "J. Whitfield Family Trust", date: "2009-06", type: "Trust Transfer" }],
      tenants: [], businesses: [],
      permits: [pm("Concrete", "Final", "c3", 132000, 300, "Foundation underpinning + new seawall cap", true), pm("Structural", "Closed", "c7", 95000, 280, "Load-bearing wall reframe", true), pm("HVAC", "Closed", "c5", 22000, 200, "New 5-ton system", false)],
      src: [prov("leepa", "parcel/07-45-24-01-00012.0040", 70, 9), prov("permit", "permit/BP-1004", 300, 30)] },
    { id: "p3", address: "2305 Main Street", city: "Fort Myers", neighborhood: "Downtown River District", parcel: "13-44-24-P2-00400.0120", class: "Commercial", year: 1925, owner: "o5",
      ownerHistory: [{ owner: "Caloosa Hospitality Partners", date: "2018-04", type: "Warranty Deed" }, { owner: "Heritage Block LLC", date: "2006-09", type: "Warranty Deed" }],
      tenants: ["t4"], businesses: ["b4"],
      permits: [pm("Roofing", "Open", "c9", 58000, 14, "Historic clay tile replacement", false), pm("Roofing", "Final", "c1", 74000, 410, "Major roof replacement, full deck", true), pm("Electrical", "Closed", "c2", 30000, 380, "Bar/kitchen circuits", false)],
      src: [prov("leepa", "parcel/13-44-24-P2-00400.0120", 55, 7), prov("permit", "permit/BP-1007", 14, 4)] },
    { id: "p4", address: "8801 College Parkway", city: "Fort Myers", neighborhood: "Whiskey Creek", parcel: "21-45-24-08-00002.0050", class: "Commercial", year: 1998, owner: "o1",
      ownerHistory: [{ owner: "Horizon Holdings LLC", date: "2024-01", type: "Warranty Deed" }, { owner: "College Plaza LP", date: "2010-03", type: "Warranty Deed" }],
      tenants: ["t1"], businesses: ["b2"],
      permits: [pm("Electrical", "Active", "c2", 26000, 33, "Tenant build-out, dental suite", false), pm("Plumbing", "Closed", "c11", 18000, 120, "Medical gas + sinks", false)],
      src: [prov("leepa", "parcel/21-45-24-08-00002.0050", 64, 6), prov("permit", "permit/BP-1010", 33, 5)] },
    { id: "p5", address: "1714 SE 16th Place", city: "Cape Coral", neighborhood: "Pelican", parcel: "18-44-24-C2-01055.0220", class: "Residential", year: 2004, owner: "o6",
      ownerHistory: [{ owner: "David & Anna Kowalski", date: "2021-07", type: "Warranty Deed" }],
      tenants: [], businesses: [],
      permits: [pm("Electrical", "Open", "c12", 38000, 12, "Whole-home rewire + solar interconnect", true), pm("Electrical", "Open", "c8", 9000, 20, "Subpanel addition", false), pm("HVAC", "Active", "c5", 14000, 26, "Mini-split zones", false)],
      src: [prov("leepa", "parcel/18-44-24-C2-01055.0220", 49, 7), prov("permit", "permit/BP-1013", 12, 3)] },
    { id: "p6", address: "27200 Bay Landing Drive", city: "Bonita Springs", neighborhood: "Pelican Landing", parcel: "10-47-25-B1-00800.0090", class: "Multi-family", year: 1995, owner: "o7",
      ownerHistory: [{ owner: "Pelican Bay Ventures LLC", date: "2017-05", type: "Warranty Deed" }],
      tenants: [], businesses: [],
      permits: [pm("Roofing", "Final", "c1", 410000, 360, "Major roof replacement, 6 buildings", true), pm("Structural", "Closed", "c10", 88000, 320, "Balcony railing structural repair", true)],
      src: [prov("leepa", "parcel/10-47-25-B1-00800.0090", 53, 8), prov("permit", "permit/BP-1018", 360, 28)] },
    { id: "p7", address: "1601 Hendry Street", city: "Fort Myers", neighborhood: "Downtown River District", parcel: "13-44-24-P1-00220.0030", class: "Commercial", year: 1948, owner: "o3",
      ownerHistory: [{ owner: "J. Whitfield Family Trust", date: "2009-06", type: "Trust Transfer" }],
      tenants: [], businesses: [],
      permits: [pm("Concrete", "Final", "c3", 165000, 260, "Structural slab + parking deck pour", true), pm("Concrete", "Closed", "c7", 72000, 230, "Stairwell concrete repair", true), pm("Plumbing", "Closed", "c6", 16000, 180, "Backflow + risers", false)],
      src: [prov("leepa", "parcel/13-44-24-P1-00220.0030", 61, 9), prov("permit", "permit/BP-1020", 260, 24)] },
    { id: "p8", address: "10800 Corkscrew Road", city: "Estero", neighborhood: "Daniels Corridor", parcel: "33-46-26-E4-00100.0070", class: "Commercial", year: 2008, owner: "o8",
      ownerHistory: [{ owner: "Estero Commerce Trust", date: "2015-02", type: "Trust Transfer" }],
      tenants: [], businesses: [],
      permits: [pm("Electrical", "Final", "c2", 142000, 220, "Major electrical upgrade, new switchgear", true), pm("Mechanical", "Closed", "c5", 60000, 190, "Rooftop units", false)],
      src: [prov("leepa", "parcel/33-46-26-E4-00100.0070", 61, 8), prov("permit", "permit/BP-1024", 220, 20)] },
    { id: "p9", address: "3920 Dr Martin Luther King Jr Blvd", city: "Fort Myers", neighborhood: "Dunbar", parcel: "14-44-25-P4-00060.0110", class: "Commercial", year: 1979, owner: "o2",
      ownerHistory: [{ owner: "Mangrove Capital Group", date: "2025-03", type: "Warranty Deed" }, { owner: "Eastside Partners LLC", date: "2012-08", type: "Warranty Deed" }],
      tenants: [], businesses: [],
      permits: [pm("Roofing", "Open", "c4", 92000, 16, "TPO re-roof, full tear-off", true), pm("Electrical", "Active", "c8", 47000, 24, "Panel + feeder replacement", false), pm("Concrete", "Open", "c10", 54000, 19, "Loading dock slab", true), pm("HVAC", "Closed", "c11", 21000, 150, "Split systems", false)],
      src: [prov("leepa", "parcel/14-44-25-P4-00060.0110", 58, 6), prov("permit", "permit/BP-1028", 16, 4)] },
    { id: "p10", address: "4530 Cleveland Avenue", city: "Fort Myers", neighborhood: "Page Park", parcel: "23-44-24-P6-00300.0010", class: "Commercial", year: 1986, owner: "o1",
      ownerHistory: [{ owner: "Horizon Holdings LLC", date: "2014-11", type: "Warranty Deed" }],
      tenants: ["t2", "t3"], businesses: ["b1", "b6"],
      permits: [pm("Electrical", "Active", "c2", 33000, 28, "Suite build-out for cafe", false), pm("Roofing", "Closed", "c1", 60000, 130, "Re-roof flat section", false), pm("Plumbing", "Active", "c6", 12000, 22, "Grease interceptor", false)],
      src: [prov("leepa", "parcel/23-44-24-P6-00300.0010", 56, 7), prov("permit", "permit/BP-1032", 28, 5)] },
    { id: "p11", address: "9120 Estero Park Commons", city: "Estero", neighborhood: "Daniels Corridor", parcel: "33-46-26-E5-00200.0040", class: "Commercial", year: 2012, owner: "o7",
      ownerHistory: [{ owner: "Pelican Bay Ventures LLC", date: "2017-05", type: "Warranty Deed" }],
      tenants: [], businesses: [],
      permits: [pm("Electrical", "Open", "c12", 51000, 11, "EV charging infrastructure", true), pm("HVAC", "Closed", "c5", 28000, 140, "VRF replacement", false)],
      src: [prov("leepa", "parcel/33-46-26-E5-00200.0040", 49, 7), prov("permit", "permit/BP-1037", 11, 3)] },
    { id: "p12", address: "640 Lehigh Avenue", city: "Lehigh Acres", neighborhood: "Lehigh Center", parcel: "26-44-26-L3-00500.0080", class: "Residential", year: 1989, owner: "o9",
      ownerHistory: [{ owner: "Thomas Nguyen", date: "2022-09", type: "Warranty Deed" }, { owner: "GreenField Homes LLC", date: "2015-06", type: "Warranty Deed" }],
      tenants: [], businesses: [],
      permits: [pm("Concrete", "Final", "c10", 78000, 240, "New foundation + driveway pour", true), pm("Roofing", "Closed", "c4", 32000, 210, "Shingle replacement", false)],
      src: [prov("leepa", "parcel/26-44-26-L3-00500.0080", 40, 6), prov("permit", "permit/BP-1041", 240, 22)] },
    { id: "p13", address: "12701 World Plaza Lane", city: "Fort Myers", neighborhood: "Gateway", parcel: "32-44-25-G2-00010.0220", class: "Commercial", year: 2007, owner: "o2",
      ownerHistory: [{ owner: "Mangrove Capital Group", date: "2024-10", type: "Warranty Deed" }, { owner: "World Plaza LLC", date: "2009-01", type: "Warranty Deed" }],
      tenants: ["t1"], businesses: ["b2"],
      permits: [pm("Electrical", "Active", "c2", 29000, 30, "Clinic expansion circuits", false), pm("HVAC", "Active", "c11", 24000, 27, "Dedicated outdoor air system", false)],
      src: [prov("leepa", "parcel/32-44-25-G2-00010.0220", 50, 6), prov("permit", "permit/BP-1045", 30, 5)] },
    { id: "p14", address: "9901 Gateway Boulevard", city: "Fort Myers", neighborhood: "Gateway", parcel: "32-44-25-G3-00040.0100", class: "Commercial", year: 2015, owner: "o10",
      ownerHistory: [{ owner: "Gateway Retail Holdings LLC", date: "2013-04", type: "Warranty Deed" }],
      tenants: [], businesses: ["b7"],
      permits: [pm("Electrical", "Open", "c2", 44000, 13, "Pad-mount transformer + feeders", false), pm("Plumbing", "Open", "c11", 19000, 17, "Dental suite plumbing", false), pm("Mechanical", "Closed", "c5", 30000, 160, "RTU swap", false)],
      src: [prov("leepa", "parcel/32-44-25-G3-00040.0100", 57, 7), prov("permit", "permit/BP-1049", 13, 3)] },
    { id: "p15", address: "1520 Periwinkle Way", city: "Sanibel", neighborhood: "Periwinkle", parcel: "19-46-23-S1-00080.0030", class: "Commercial", year: 1978, owner: "o1",
      ownerHistory: [{ owner: "Horizon Holdings LLC", date: "2020-02", type: "Warranty Deed" }, { owner: "Island Retail Trust", date: "2003-11", type: "Warranty Deed" }],
      tenants: ["t3"], businesses: ["b1", "b5", "b8"],
      permits: [pm("Roofing", "Closed", "c1", 70000, 170, "Hurricane re-roof", false), pm("Electrical", "Active", "c12", 22000, 25, "Cafe tenant power", false)],
      src: [prov("leepa", "parcel/19-46-23-S1-00080.0030", 60, 8), prov("permit", "permit/BP-1053", 25, 5)] },
    { id: "p16", address: "20281 Grande Oak Shoppes", city: "Estero", neighborhood: "Daniels Corridor", parcel: "33-46-26-E6-00300.0060", class: "Commercial", year: 2011, owner: "o8",
      ownerHistory: [{ owner: "Estero Commerce Trust", date: "2015-02", type: "Trust Transfer" }],
      tenants: [], businesses: ["b9"],
      permits: [pm("Roofing", "Open", "c1", 120000, 15, "Standing-seam metal re-roof", true), pm("Roofing", "Final", "c10", 98000, 300, "Major roof replacement, retail strip", true), pm("Electrical", "Closed", "c2", 40000, 220, "Common-area lighting", false)],
      src: [prov("leepa", "parcel/33-46-26-E6-00300.0060", 61, 7), prov("permit", "permit/BP-1057", 15, 4)] },
    { id: "p17", address: "15880 San Carlos Boulevard", city: "Fort Myers Beach", neighborhood: "San Carlos", parcel: "29-46-24-B7-00010.0090", class: "Commercial", year: 1990, owner: "o10",
      ownerHistory: [{ owner: "Gateway Retail Holdings LLC", date: "2019-08", type: "Warranty Deed" }],
      tenants: ["t5"], businesses: ["b3"],
      permits: [pm("Structural", "Closed", "c7", 64000, 200, "Storm-damage structural repair", true), pm("Roofing", "Closed", "c4", 41000, 175, "Re-roof", false)],
      src: [prov("leepa", "parcel/29-46-24-B7-00010.0090", 43, 6), prov("permit", "permit/BP-1061", 175, 16)] },
    { id: "p18", address: "3801 Hancock Bridge Parkway", city: "North Fort Myers", neighborhood: "Hancock", parcel: "11-44-24-N2-00400.0050", class: "Industrial", year: 1983, owner: "o1",
      ownerHistory: [{ owner: "Horizon Holdings LLC", date: "2023-06", type: "Warranty Deed" }, { owner: "Northside Industrial LP", date: "2008-12", type: "Warranty Deed" }],
      tenants: ["t2", "t3"], businesses: ["b1", "b6"],
      permits: [pm("Electrical", "Active", "c2", 36000, 29, "Warehouse power for new tenant", false), pm("Mechanical", "Closed", "c11", 26000, 145, "Dock equipment", false)],
      src: [prov("leepa", "parcel/11-44-24-N2-00400.0050", 50, 7), prov("permit", "permit/BP-1065", 29, 5)] },
    { id: "p19", address: "10561 Stringfellow Road", city: "Pine Island", neighborhood: "Pine Island", parcel: "08-44-22-PI-00200.0010", class: "Commercial", year: 1972, owner: "o10",
      ownerHistory: [{ owner: "Gateway Retail Holdings LLC", date: "2018-03", type: "Warranty Deed" }],
      tenants: [], businesses: ["b10"],
      permits: [pm("Plumbing", "Closed", "c6", 9000, 160, "Studio sink + kiln vent", false)],
      src: [prov("leepa", "parcel/08-44-22-PI-00200.0010", 41, 7), prov("permit", "permit/BP-1069", 160, 14)] },
    { id: "p20", address: "2120 Edwards Drive", city: "Fort Myers", neighborhood: "Downtown River District", parcel: "13-44-24-P5-00010.0040", class: "Commercial", year: 1962, owner: "o2",
      ownerHistory: [{ owner: "Mangrove Capital Group", date: "2022-12", type: "Warranty Deed" }, { owner: "Riverfront Assoc.", date: "2005-07", type: "Warranty Deed" }],
      tenants: [], businesses: [],
      permits: [pm("Roofing", "Final", "c1", 156000, 280, "Major roof replacement, waterfront office", true), pm("HVAC", "Closed", "c5", 34000, 240, "Chiller replacement", false)],
      src: [prov("leepa", "parcel/13-44-24-P5-00010.0040", 49, 7), prov("permit", "permit/BP-1073", 280, 25)] }
  ];

  // ---- Agents (Soofi Team Kit roster + the oracle agent under certification) ----
  const agents = [
    { id: "oracle", display: "oracle", role: "Property Intelligence Agent", status: "Discovered", version: "0.9.0",
      summary: "Ingests Oracle-collected Lee County public records, reconciles entities into the Elephant Lexicon, indexes a RAG knowledge layer, and answers property / tenant / business / contractor inquiries with cited provenance.",
      triggers: "/oracle Show all properties with more than one open permit",
      skills: ["build-rag-systems", "use-elephant-query-db", "build-lexicon-product"],
      deps: ["Elephant Query DB", "Bedrock embeddings", "OpenSearch"], runtime: "Lambda · tRPC · Vercel AI SDK",
      docs: "github.com/prismteam-ai/oracle-property-intelligence-platform", source: "self", new: true,
      certifiedDate: null, reviewer: null },
    { id: "arceus", display: "arceus", role: "Master Router", status: "Certified", version: "2.4.1",
      summary: "Reads the team-kit README, agent definitions and skills, then routes any task to the right specialist(s). Does not implement work itself.",
      triggers: "/arceus Which agent should handle…", skills: ["apply-engineering-guidelines"], deps: [], runtime: "Cursor / Copilot CLI",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/arceus.md", source: "team-kit",
      certifiedDate: "2026-02-04", reviewer: "platform-governance" },
    { id: "alakazam", display: "alakazam", role: "RAG Agent Builder", status: "Certified", version: "3.1.0",
      summary: "Directs reusable AWS RAG agents with Bedrock, OpenSearch, DynamoDB, S3, SAM local, and Docker OpenSearch replay.",
      triggers: "/alakazam Build RAG for…", skills: ["build-rag-systems", "build-local-rag-pocs"], deps: ["Bedrock", "OpenSearch", "DynamoDB"], runtime: "AWS · CDK",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/alakazam.md", source: "team-kit",
      certifiedDate: "2026-01-19", reviewer: "platform-governance" },
    { id: "espeon", display: "espeon", role: "End-to-end RAG System Builder", status: "Certified", version: "2.0.3",
      summary: "Local TypeScript CLI POC first, then AWS OpenSearch migration, historical backfill, webhook ingestion, and rollout.",
      triggers: "/espeon Build an end-to-end RAG system…", skills: ["build-rag-systems", "build-local-rag-pocs"], deps: ["OpenSearch", "Bedrock"], runtime: "TypeScript · AWS",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/espeon.md", source: "team-kit",
      certifiedDate: "2026-02-22", reviewer: "platform-governance" },
    { id: "metagross", display: "metagross", role: "Fullstack Monorepo Architect", status: "Certified", version: "1.8.0",
      summary: "Designs and scaffolds fullstack frontend-backend monorepos with Turborepo, Amplify, tRPC, Lambda, and CDK.",
      triggers: "/metagross Scaffold fullstack app…", skills: ["build-frontend-backends"], deps: ["Turborepo", "tRPC", "CDK"], runtime: "AWS Amplify",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/metagross.md", source: "team-kit",
      certifiedDate: "2026-03-02", reviewer: "platform-governance" },
    { id: "porygon", display: "porygon", role: "Metrics Unification", status: "In Review", version: "1.2.0",
      summary: "Unifies and analyzes metrics across vendors and data sources with a lexicon-first, audit-friendly workflow.",
      triggers: "/porygon Compare metrics for…", skills: ["unify-metrics", "build-lexicon-product"], deps: ["Lexicon"], runtime: "AWS",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/porygon.md", source: "team-kit",
      certifiedDate: null, reviewer: "platform-governance" },
    { id: "sylveon", display: "sylveon", role: "Figma-to-Code Specialist", status: "Registered", version: "1.0.4",
      summary: "Updates existing frontend code to match Figma while preserving business logic and locking breakpoints.",
      triggers: "/sylveon Apply Figma design…", skills: ["figma-to-code", "responsive-design-tests"], deps: ["Figma API"], runtime: "Node",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/sylveon.md", source: "team-kit",
      certifiedDate: null, reviewer: null },
    { id: "audino", display: "audino", role: "Frontend Bug-fix Specialist", status: "Changes Requested", version: "0.7.2",
      summary: "Design comparison, override archaeology, minimal fixes, and regression-proof tests.",
      triggers: "/audino Fix this UI bug…", skills: ["frontend-bug-fix", "responsive-design-tests"], deps: [], runtime: "Node",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/audino.md", source: "team-kit",
      certifiedDate: null, reviewer: "platform-governance" },
    { id: "regigigas", display: "regigigas", role: "SaaS Marketplace Architect", status: "Discovered", version: "0.4.0",
      summary: "Centralized marketplace account governing per-customer AWS tenant accounts and CloudFormation bundle distribution.",
      triggers: "/regigigas Design marketplace…", skills: ["build-saas-marketplace"], deps: ["AWS Organizations"], runtime: "AWS",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/regigigas.md", source: "team-kit",
      certifiedDate: null, reviewer: null },
    { id: "smeargle", display: "smeargle", role: "Responsive Design Testing", status: "Rejected", version: "0.3.1",
      summary: "Playwright design specs across breakpoints, with mocked and real-device lane selection.",
      triggers: "/smeargle Add responsive tests…", skills: ["responsive-design-tests"], deps: ["Playwright"], runtime: "Node",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/smeargle.md", source: "team-kit",
      certifiedDate: null, reviewer: "platform-governance" },
    { id: "machamp", display: "machamp", role: "AWS Batch Workflow Builder", status: "Deprecated", version: "1.9.0",
      summary: "AWS batch workflows with strategy selection, cost gates, throttling, idempotency, and staged test pipelines.",
      triggers: "/machamp Build batch workflow…", skills: ["build-batch-workflows"], deps: ["Step Functions", "Glue"], runtime: "AWS",
      docs: "github.com/soofi-xyz/soofi-xyz-team-kit/blob/main/agents/machamp.md", source: "team-kit",
      certifiedDate: "2025-08-14", reviewer: "platform-governance" }
  ];

  // ---- Required demo inquiries (verbatim from Oracle README) ----
  const inquiries = [
    { id: "q1", label: "Show all properties with more than one open permit", entity: "property", kind: "prop_multi_open" },
    { id: "q2", label: "Show all properties with open roofing permits", entity: "property", kind: "prop_open_trade", arg: "Roofing" },
    { id: "q3", label: "Show all properties with open electrical permits", entity: "property", kind: "prop_open_trade", arg: "Electrical" },
    { id: "q4", label: "Show all properties that underwent major concrete work", entity: "property", kind: "prop_major_trade", arg: "Concrete" },
    { id: "q5", label: "Show all properties that underwent major roof replacements", entity: "property", kind: "prop_major_trade", arg: "Roofing" },
    { id: "q6", label: "Show all properties that underwent major electrical upgrades", entity: "property", kind: "prop_major_trade", arg: "Electrical" },
    { id: "q7", label: "Show all properties with the highest permit activity during the last five years", entity: "property", kind: "prop_top_activity" },
    { id: "q8", label: "Show all properties with significant renovation activity", entity: "property", kind: "prop_significant_reno" },
    { id: "q9", label: "Show all contractors performing roofing work in Lee County", entity: "contractor", kind: "contractor_trade", arg: "Roofing" },
    { id: "q10", label: "Show all contractors performing electrical work in Lee County", entity: "contractor", kind: "contractor_trade", arg: "Electrical" },
    { id: "q11", label: "Show contractors with negative BBB ratings", entity: "contractor", kind: "contractor_negative_bbb" },
    { id: "q12", label: "Show contractors with complaint histories", entity: "contractor", kind: "contractor_complaints" },
    { id: "q13", label: "Show projects completed by contractors with negative BBB ratings or complaint histories", entity: "project", kind: "projects_risky" },
    { id: "q14", label: "Show businesses operating across multiple properties", entity: "business", kind: "business_multi" },
    { id: "q15", label: "Show owners associated with multiple properties", entity: "owner", kind: "owner_multi" },
    { id: "q16", label: "Show tenants operating across multiple locations", entity: "tenant", kind: "tenant_multi" },
    { id: "q17", label: "Show properties with both ownership changes and active permit activity", entity: "property", kind: "prop_ownerchange_active" },
    { id: "q18", label: "Show properties with active permit activity and business turnover", entity: "property", kind: "prop_active_turnover" },
    { id: "q19", label: "Show neighborhoods with increasing permit activity", entity: "neighborhood", kind: "neighborhood_increasing" },
    { id: "q20", label: "Show neighborhoods with the highest concentration of major renovations", entity: "neighborhood", kind: "neighborhood_reno" },
    { id: "q21", label: "Show the most active contractors by project count", entity: "contractor", kind: "contractor_top" },
    { id: "q22", label: "Show the most active businesses by property footprint", entity: "business", kind: "business_top" },
    { id: "q23", label: "Show relationships between a selected property, contractor, business, tenant, and owner", entity: "graph", kind: "relationship_graph" }
  ];

  // turnover signals (businesses that closed/changed at a property)
  const turnover = {
    p10: "Cape Tackle & Marine vacated; Caloosa Coffee Co. + Bluepoint Logistics now occupying.",
    p15: "Sanibel Provisions (Dissolved) and Cape Tackle (Inactive) replaced by Caloosa Coffee Co.",
    p18: "Northside tenant turnover; two new active leases in 2023–2026."
  };

  function expandCorpus() {
    contractors.push(
      { id: "c13", name: "Royal Palm Restoration", license: "CGC-1532100", trades: ["Structural", "Roofing"], county: "Lee", projects: 16, bbb: "A-", complaints: [], review: 4.2, src: [prov("bbb", "us/fl/fort-myers/restoration/royalpalm", 28, 6)] },
      { id: "c14", name: "Barrier Island Concrete", license: "CGC-1529984", trades: ["Concrete"], county: "Lee", projects: 13, bbb: "B+", complaints: [], review: 4.0, src: [prov("bbb", "us/fl/sanibel/concrete/barrier", 35, 8)] },
      { id: "c15", name: "Harbor Electrical Services", license: "EC-13010842", trades: ["Electrical"], county: "Lee", projects: 18, bbb: "C", complaints: [{ date: iso(88), summary: "Delayed inspection correction response.", status: "Resolved" }], review: 3.4, src: [prov("bbb", "us/fl/bonita-springs/electrician/harbor", 30, 7)] }
    );

    owners.push(
      { id: "o11", name: "Caladium Asset Management LLC", type: "LLC", since: "2020", props: [], src: [prov("sunbiz", "Inquiry/L20000444001", 45, 10)] },
      { id: "o12", name: "Tamiami Redevelopment Trust", type: "Trust", since: "2018", props: [], src: [prov("leepa", "parcel/owner/tamiami-redevelopment", 48, 9)] }
    );

    const businessTypes = ["Retail", "Healthcare", "Food & Beverage", "Professional Services", "Industrial"];
    for (let i = 11; i <= 25; i++) {
      businesses.push({
        id: "b" + i,
        name: [
          "Cypress Wellness Studio",
          "Tamiami Tile Gallery",
          "Harbor Pet Clinic",
          "Royal Palm Fitness",
          "Caladium Market",
          "Gateway Bike Works",
          "Six Mile Print House",
          "Estero Learning Lab",
          "Periwinkle Pharmacy",
          "McGregor Design Co.",
          "Hancock Auto Supply",
          "Dunbar Food Hall",
          "Corkscrew Pediatrics",
          "San Carlos Surf Shop",
          "Lehigh Appliance Depot"
        ][i - 11],
        btype: businessTypes[i % businessTypes.length],
        sunbiz: "L2" + String(100000000 + i * 3137),
        status: i % 7 === 0 ? "Inactive" : "Active",
        owner: i % 2 === 0 ? "Caladium Asset Management LLC" : "Tamiami Redevelopment Trust",
        locations: [],
        registered: "202" + (i % 6) + "-" + String((i % 12) + 1).padStart(2, "0") + "-15",
        src: [prov("sunbiz", "Inquiry/L2" + String(100000000 + i * 3137), 32 + (i % 18), 7 + (i % 8))]
      });
    }

    for (let i = 6; i <= 18; i++) {
      tenants.push({
        id: "t" + i,
        name: [
          "Cypress Wellness Studio",
          "Tamiami Tile Gallery",
          "Harbor Pet Clinic",
          "Royal Palm Fitness",
          "Caladium Market",
          "Gateway Bike Works",
          "Six Mile Print House",
          "Estero Learning Lab",
          "Periwinkle Pharmacy",
          "McGregor Design Co.",
          "Hancock Auto Supply",
          "Dunbar Food Hall",
          "Corkscrew Pediatrics"
        ][i - 6],
        ttype: i % 3 === 0 ? "Medical" : (i % 3 === 1 ? "Retail" : "Professional Services"),
        locations: [],
        businesses: ["b" + (i + 5)],
        activity: "Active lease record reconciled from business tax and occupancy sources.",
        src: [prov("tax", "biztax/tenant-" + i, 30 + i, 8 + (i % 5))]
      });
    }

    const cities = ["Fort Myers", "Cape Coral", "Bonita Springs", "Estero", "Lehigh Acres", "North Fort Myers", "Sanibel", "Fort Myers Beach"];
    const neighborhoods = ["Tamiami Trail", "Cypress Lake", "Gateway", "Daniels Corridor", "Hancock", "McGregor Corridor", "Periwinkle", "Dunbar", "Six Mile", "San Carlos"];
    const classes = ["Commercial", "Residential", "Industrial", "Multi-family"];
    const tradeCycle = ["Roofing", "Electrical", "Concrete", "Structural", "Plumbing", "HVAC"];
    const contractorByTrade = {
      Roofing: ["c1", "c4", "c9", "c10", "c13"],
      Electrical: ["c2", "c8", "c12", "c15"],
      Concrete: ["c3", "c7", "c10", "c14"],
      Structural: ["c7", "c10", "c13"],
      Plumbing: ["c6", "c11"],
      HVAC: ["c5", "c11"]
    };
    const ownerIds = owners.map(o => o.id);
    const streetNames = ["Tamiami", "Cypress", "Royal Palm", "Harbor", "Six Mile", "McGregor", "Corkscrew", "Periwinkle", "Hancock", "Gateway", "Caladium"];

    for (let i = 21; i <= 75; i++) {
      const ownerId = ownerIds[i % ownerIds.length];
      const city = cities[i % cities.length];
      const neighborhood = neighborhoods[i % neighborhoods.length];
      const propertyClass = classes[i % classes.length];
      const businessId = "b" + (11 + ((i - 21) % 15));
      const tenantId = "t" + (6 + ((i - 21) % 13));
      const hasOccupancy = propertyClass !== "Residential" && i % 3 !== 0;
      const permits = [];
      const permitCount = 1 + (i % 3);
      for (let j = 0; j < permitCount; j++) {
        const trade = tradeCycle[(i + j) % tradeCycle.length];
        const candidates = contractorByTrade[trade];
        const contractor = candidates[(i + j) % candidates.length];
        const status = j === 0 && i % 4 !== 0 ? (i % 2 === 0 ? "Open" : "Active") : (i % 5 === 0 ? "Final" : "Closed");
        const major = ["Roofing", "Concrete", "Structural", "Electrical"].includes(trade) && (i + j) % 2 === 0;
        permits.push(pm(trade, status, contractor, 12000 + (i * 4300) + (j * 17000), 10 + ((i * 9 + j * 31) % 420), major ? "Major " + trade.toLowerCase() + " improvement package" : trade + " tenant improvement", major));
      }
      const property = {
        id: "p" + i,
        address: (1000 + i * 37) + " " + streetNames[i % streetNames.length] + " " + (propertyClass === "Residential" ? "Lane" : "Avenue"),
        city,
        neighborhood,
        parcel: String(10 + (i % 30)).padStart(2, "0") + "-44-2" + (i % 8) + "-FX-" + String(i).padStart(5, "0") + ".00" + (i % 9),
        class: propertyClass,
        year: 1950 + (i % 70),
        owner: ownerId,
        ownerHistory: [
          { owner: owners.find(o => o.id === ownerId).name, date: "202" + (i % 6) + "-0" + ((i % 9) + 1), type: i % 2 === 0 ? "Warranty Deed" : "Trust Transfer" },
          ...(i % 5 === 0 ? [{ owner: "Prior Holdings " + i + " LLC", date: "201" + (i % 9) + "-04", type: "Special Warranty" }] : [])
        ],
        tenants: hasOccupancy ? [tenantId] : [],
        businesses: hasOccupancy ? [businessId] : [],
        permits,
        src: [prov("leepa", "parcel/generated-" + i, 35 + (i % 35), 6 + (i % 9)), prov("permit", "permit/" + permits[0].id, 10 + (i % 30), 3 + (i % 6))]
      };
      properties.push(property);
      const owner = owners.find(o => o.id === ownerId);
      if (owner && !owner.props.includes(property.id)) owner.props.push(property.id);
      const business = businesses.find(b => b.id === businessId);
      if (business && hasOccupancy && !business.locations.includes(property.id)) business.locations.push(property.id);
      const tenant = tenants.find(t => t.id === tenantId);
      if (tenant && hasOccupancy && !tenant.locations.includes(property.id)) tenant.locations.push(property.id);
      if (i % 11 === 0) turnover[property.id] = "Occupancy change detected after permit activity; prior tenant replaced during renovation window.";
    }
  }

  expandCorpus();

  const target = typeof window !== "undefined" ? window : globalThis;
  target.ORACLE_DATA = {
    contractors, owners, businesses, tenants, properties, agents, inquiries, turnover,
    corpus: {
      properties: properties.length,
      permits: properties.reduce((sum, p) => sum + p.permits.length, 0),
      contractors: contractors.length,
      businesses: businesses.length,
      owners: owners.length,
      tenants: tenants.length,
      sources: 5,
      lastRefresh: "2026-06-18 04:12 UTC",
      county: "Lee County, FL"
    }
  };
})();
