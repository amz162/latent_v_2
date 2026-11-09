// Task 121 security rework — previously unauthenticated with a client-chosen
// userId (anyone could write trades to any identity). Now: requires the
// tab.execute permission (disabled by default for users) and the trade is
// always created for the SESSION-derived user. Paper/simulated only — this
// endpoint never touches a real broker or real money.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getSignalById } from "@/lib/latent/mock-signals";
import { getOrCreateSessionUser } from "@/lib/latent/user-identity";
import { withUser } from "@/lib/latent/guard";

const ExecuteSchema = z.object({
  userId: z.string().optional(), // ignored — identity is the session (mismatch rejected)
  signalId: z.string(),
  brokerId: z.string().max(64),
  shares: z.number().int().positive(),
  price: z.number().positive(),
});

export const POST = withUser("tab.execute", async (req, _segment, user) => {
  try {
    const body = await req.json();
    const parsed = ExecuteSchema.parse(body);

    const sessionUser = await getOrCreateSessionUser(user);
    if (parsed.userId && parsed.userId !== sessionUser.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const signal = getSignalById(parsed.signalId);
    if (!signal) {
      return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    }

    // Create an OPEN trade record
    const trade = await db.trade.create({
      data: {
        userId: sessionUser.id,
        signalId: parsed.signalId,
        symbol: signal.symbol,
        direction: signal.direction,
        horizon: signal.horizon,
        entryPrice: parsed.price,
        status: "OPEN",
      },
    });

    // Simulate broker confirmation
    const brokerName =
      parsed.brokerId === "broker_singular" ? "Singular Securities" :
      parsed.brokerId === "broker_arif_habib" ? "Arif Habib Limited" :
      "Foundation Securities";

    const orderValue = parsed.shares * parsed.price;
    const commission = orderValue * 0.001; // 0.10% blended
    const totalDebit = orderValue + commission;

    return NextResponse.json({
      tradeId: trade.id,
      status: "FILLED",
      broker: brokerName,
      brokerId: parsed.brokerId,
      symbol: signal.symbol,
      shares: parsed.shares,
      filledPrice: parsed.price,
      orderValue: parseFloat(orderValue.toFixed(2)),
      commission: parseFloat(commission.toFixed(2)),
      totalDebit: parseFloat(totalDebit.toFixed(2)),
      settlementDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      tradeRef: `LTX-${Date.now().toString(36).toUpperCase()}`,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    }
    console.error("Execute error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Execution failed" },
      { status: 400 }
    );
  }
});
