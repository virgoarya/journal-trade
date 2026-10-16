/**
 * prisma-agent.ts — Prisma Client singleton untuk PostgreSQL Agent DB
 *
 * Digunakan oleh profile-repo, hermes-prompt, dan memory-reflector
 * untuk mengakses UserProfile & UserMemoryNote.
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prismaAgent: PrismaClient | undefined;
}

function createPrismaAgent(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error"] : ["error"],
  });
  return client;
}

// Single instance across cold boots (Next.js/Express deployment)
export const prismaAgent: PrismaClient =
  global.__prismaAgent ?? (global.__prismaAgent = createPrismaAgent());

export default prismaAgent;
