import { PrismaClient } from "@prisma/client";

// One client per process. Next's bundle and the custom server share it via globalThis.
const g = globalThis as unknown as { __pvPrisma?: PrismaClient };

export const db: PrismaClient = g.__pvPrisma ?? new PrismaClient({ log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"] });
g.__pvPrisma = db;
