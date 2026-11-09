// Task 121 security rework — previously an unauthenticated IDOR: anyone could
// read any ?userId='s plan. Now the plan is always the SESSION user's own;
// a mismatched userId parameter is a hard 403 (audited by the guard layer).
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { synthesizePlan } from "@/lib/latent/plan-synthesizer";
import { getOrCreateSessionUser } from "@/lib/latent/user-identity";
import { withUser } from "@/lib/latent/guard";

export const GET = withUser(null, async (req, _segment, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const requestedUserId = searchParams.get("userId");

    const sessionUser = await getOrCreateSessionUser(user);
    if (requestedUserId && requestedUserId !== sessionUser.id) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: sessionUser.id },
      include: { riskProfile: true, plans: { orderBy: { createdAt: "desc" }, take: 1 } },
    });

    if (!dbUser || !dbUser.riskProfile) {
      return NextResponse.json({ error: "No risk profile on file" }, { status: 404 });
    }

    const latestPlan = dbUser.plans[0];
    if (!latestPlan) {
      // Re-synthesize if missing
      const plan = synthesizePlan(dbUser.id, {
        riskTolerance: dbUser.riskProfile.riskTolerance,
        timeHorizon: dbUser.riskProfile.timeHorizon,
        monthlyContribution: dbUser.riskProfile.monthlyContribution,
        goalLabel: dbUser.riskProfile.goalLabel,
        goalTargetAmount: dbUser.riskProfile.goalTargetAmount,
        goalDate: dbUser.riskProfile.goalDate.toISOString(),
      });
      return NextResponse.json({ plan, profileBucket: dbUser.riskProfile.profileBucket });
    }

    const plan = {
      id: latestPlan.id,
      userId: latestPlan.userId,
      profileBucket: dbUser.riskProfile.profileBucket,
      allocation: JSON.parse(latestPlan.allocation),
      entryLadder: JSON.parse(latestPlan.entryLadder),
      rebalancingRules: JSON.parse(latestPlan.rebalancingRules),
      expectedReturnPct:
        dbUser.riskProfile.profileBucket === "conservative" ? 12 :
        dbUser.riskProfile.profileBucket === "moderate" ? 16 :
        dbUser.riskProfile.profileBucket === "growth" ? 22 : 28,
      riskScore: dbUser.riskProfile.riskTolerance,
    };

    return NextResponse.json({ plan, profileBucket: dbUser.riskProfile.profileBucket });
  } catch (err) {
    console.error("Plan fetch error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Plan fetch failed" },
      { status: 500 }
    );
  }
});
