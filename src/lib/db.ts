import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Task 117 Part D: query logging is OFF by default — Prisma query logs embed
// parameter values (session-token hashes, profile data) and would write
// sensitive values into dev.log / server logs. Opt in explicitly with
// PRISMA_QUERY_LOG=true for debugging; errors are still logged.
const shouldLogQueries = process.env.PRISMA_QUERY_LOG === "true"

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: shouldLogQueries ? ['query'] : ['error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
