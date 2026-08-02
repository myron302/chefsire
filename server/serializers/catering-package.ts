import type { CateringPackage } from "@shared/catering-packages";
type Row = Omit<CateringPackage, "startingPrice" | "createdAt" | "updatedAt"> & { startingPrice: string; createdAt: Date; updatedAt: Date };
export function serializeCateringPackage(row: Row): CateringPackage { return { ...row, startingPrice: Number(row.startingPrice), createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() }; }
