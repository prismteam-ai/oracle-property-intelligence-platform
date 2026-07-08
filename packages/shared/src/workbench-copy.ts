export const WORKBENCH_NAV_ITEMS = [
  { href: "/", label: "Workspace" },
  { href: "/properties", label: "Properties" },
  { href: "/businesses", label: "Businesses" },
  { href: "/contractors", label: "Contractors" },
  { href: "/tenants", label: "Tenancy" },
  { href: "/ask", label: "Inquiries" },
  { href: "/sources", label: "Sources" },
] as const;

export const WORKSPACE_COPY = {
  title: "Workspace",
  inquiryTitle: "Inquiry console",
  sections: ["Property watchlist", "Contractor risk", "Inquiry console"],
} as const;
