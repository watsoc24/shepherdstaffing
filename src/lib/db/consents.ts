import { db } from "./client";
import type { ConsentType } from "../../generated/prisma/client";

export const record = (userId: string, type: ConsentType, version: string, ip?: string | null) =>
  db().consent.create({ data: { userId, type, version, ip: ip ?? null } });

export const latest = (userId: string, type: ConsentType) =>
  db().consent.findFirst({ where: { userId, type }, orderBy: { acceptedAt: "desc" } });
