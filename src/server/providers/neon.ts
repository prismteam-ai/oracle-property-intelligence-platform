import "server-only";

import type { DataAccess } from "@/server/ports";
import { localProvider } from "./local";
import { ensureMaterialized } from "./neon-materialize";

function withMaterialization<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    await ensureMaterialized();
    return fn(...args);
  };
}

export const neonProvider: DataAccess = {
  ...localProvider,

  getRollupForProperty: withMaterialization(localProvider.getRollupForProperty),
  getPropertyDetail: withMaterialization(localProvider.getPropertyDetail),
  getTenantDetail: withMaterialization(localProvider.getTenantDetail),
  getBusinessDetail: withMaterialization(localProvider.getBusinessDetail),
  getContractorDetail: withMaterialization(localProvider.getContractorDetail),
  listProjects: withMaterialization(localProvider.listProjects),
  listProjectsForProperty: withMaterialization(localProvider.listProjectsForProperty),
  listTenants: withMaterialization(localProvider.listTenants),
  getTenantById: withMaterialization(localProvider.getTenantById),
  listOccupanciesForTenant: withMaterialization(localProvider.listOccupanciesForTenant),
  listOccupanciesForProperty: withMaterialization(localProvider.listOccupanciesForProperty),
  runInquiry: withMaterialization(localProvider.runInquiry),
  getDashboardStats: withMaterialization(localProvider.getDashboardStats),

};
