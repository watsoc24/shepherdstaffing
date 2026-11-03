import { db } from "./client";

export const recent = async (userId: string, take = 20) =>
  (await db().chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take })).reverse();

export const add = (userId: string, role: "user" | "assistant", content: string) =>
  db().chatMessage.create({ data: { userId, role, content } });

export const recordUsage = (u: { userId: string | null; feature: string; model: string; inputTokens: number; outputTokens: number; ok: boolean }) =>
  db().aiUsage.create({ data: u });
