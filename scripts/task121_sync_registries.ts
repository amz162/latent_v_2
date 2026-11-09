import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const strat = (await import("../src/lib/latent/strategies/engine")).STRATEGY_INVENTORY;
const models = (await import("../src/lib/latent/ensemble")).ALL_MODELS;
for (const s of strat) await db.strategyConfig.upsert({ where: { strategyId: s.strategyId }, create: { strategyId: s.strategyId }, update: {} });
for (const m of models) await db.modelAccessConfig.upsert({ where: { modelId: m.name }, create: { modelId: m.name }, update: {} });
console.log(`synced ${strat.length} strategies, ${models.length} models`);
await db.$disconnect();
