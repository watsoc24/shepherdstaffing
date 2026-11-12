import { db } from "./client";

export const list = (threadId: string, take = 100) =>
  db().message.findMany({ where: { threadId }, orderBy: { createdAt: "asc" }, take });

export async function send(threadId: string, senderUserId: string, body: string) {
  const [msg] = await db().$transaction([
    db().message.create({ data: { threadId, senderUserId, body } }),
    db().thread.update({ where: { id: threadId }, data: { updatedAt: new Date() } }),
  ]);
  return msg;
}

export const markRead = (threadId: string, readerUserId: string) =>
  db().message.updateMany({ where: { threadId, senderUserId: { not: readerUserId }, readAt: null }, data: { readAt: new Date() } });

export const unreadCount = (threadId: string, readerUserId: string) =>
  db().message.count({ where: { threadId, senderUserId: { not: readerUserId }, readAt: null } });

export const isBlocked = async (a: string, b: string) =>
  !!(await db().block.findFirst({
    where: { OR: [{ blockerUserId: a, blockedUserId: b }, { blockerUserId: b, blockedUserId: a }] },
  }));

export const block = (blockerUserId: string, blockedUserId: string) =>
  db().block.upsert({
    where: { blockerUserId_blockedUserId: { blockerUserId, blockedUserId } },
    create: { blockerUserId, blockedUserId },
    update: {},
  });

export const report = (reporterUserId: string, reportedUserId: string, reason: string, threadId?: string) =>
  db().report.create({ data: { reporterUserId, reportedUserId, reason, threadId } });
