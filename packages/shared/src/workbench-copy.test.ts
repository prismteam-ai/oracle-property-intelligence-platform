import { describe, expect, it } from "vitest";

import {
  WORKBENCH_NAV_ITEMS,
  WORKSPACE_COPY,
} from "./workbench-copy.js";

describe("workbench frontend copy contract", () => {
  it("uses the new workbench navigation labels", () => {
    expect(WORKBENCH_NAV_ITEMS.map((item) => item.label)).toEqual([
      "Workspace",
      "Properties",
      "Businesses",
      "Contractors",
      "Tenancy",
      "Inquiries",
      "Sources",
    ]);
  });

  it("frames the default route as a workspace", () => {
    expect(WORKSPACE_COPY.title).toBe("Workspace");
    expect(WORKSPACE_COPY.inquiryTitle).toBe("Inquiry console");
    expect(WORKSPACE_COPY.sections).toEqual(
      expect.arrayContaining([
        "Property watchlist",
        "Contractor risk",
        "Inquiry console",
      ]),
    );
  });
});
