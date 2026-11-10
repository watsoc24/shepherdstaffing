import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client";
import { env } from "../env";

/**
 * The ONLY place a database connection is created. Routes never import this;
 * they call the table modules in src/lib/db/*. All queries are parameterized
 * by Prisma — user input is never concatenated into SQL.
 */
const g = globalThis as unknown as { prisma?: PrismaClient };

export function db(): PrismaClient {
  if (!g.prisma) {
    const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
    g.prisma = new PrismaClient({ adapter });
  }
  return g.prisma;
}

export type { PrismaClient };
export * as P from "../../generated/prisma/client";
