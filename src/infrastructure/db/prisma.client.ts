
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "../../../generated/prisma/client.js";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

const prismaClient =
  globalThis.prisma ??
  (() => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required (e.g. "file:./dev.db")');
    }

    const adapter = new PrismaLibSql({ url: databaseUrl });

    return new PrismaClient({ adapter });
  })();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prismaClient;
}

export { prismaClient };

