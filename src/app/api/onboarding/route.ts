// Task 121 security rework — previously this route trusted a client-supplied
// email with zero auth (anyone could create users/plans for arbitrary
// identities). Now it requires an authenticated ACTIVE session and derives
// the User row from the session; the client email is treated as a display
// label only, never as identity.
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { synthesizePlan, classifyRiskBucket } from "@/lib/latent/plan-synthesizer";
import { getOrCreateSessionUser } from "@/lib/latent/user-identity";
import { withUser } from "@/lib/latent/guard";

const OnboardingSchema = z.object({
  // display label only — NOT used for identity anymore
  email: z.string().email().optional(),
  name: z.string().optional().default(""),
  riskTolerance: z.number().min(1).max(10),
  timeHorizon: z.number().min(1).max(40),
  monthlyContribution: z.number().min(1000),
  goalLabel: z.string(),
  goalTargetAmount: z.number().min(10000),
  goalDate: z.string(),
});

export const POST = withUser(null, async (req, _segment, user) => {
  try {
    const body = await req.json();
    const parsed = OnboardingSchema.parse(body);

    // Identity is the session, never the request body.
    const sessionUser = await getOrCreateSessionUser(user, parsed.name || null);

    // Upsert risk profile
    const profileBucket = classifyRiskBucket({
      riskTolerance: parsed.riskTolerance,
      timeHorizon: parsed.timeHorizon,
      monthlyContribution: parsed.monthlyContribution,
      goalLabel: parsed.goalLabel,
      goalTargetAmount: parsed.goalTargetAmount,
      goalDate: parsed.goalDate,
    });

    const existing = await db.riskProfile.findUnique({ where: { userId: sessionUser.id } });
    if (existing) {
      await db.riskProfile.update({
        where: { userId: sessionUser.id },
        data: {
          riskTolerance: parsed.riskTolerance,
          timeHorizon: parsed.timeHorizon,
          monthlyContribution: parsed.monthlyContribution,
          goalLabel: parsed.goalLabel,
          goalTargetAmount: parsed.goalTargetAmount,
          goalDate: new Date(parsed.goalDate),
          profileBucket,
        },
      });
    } else {
      await db.riskProfile.create({
        data: {
          userId: sessionUser.id,
          riskTolerance: parsed.riskTolerance,
          timeHorizon: parsed.timeHorizon,
          monthlyContribution: parsed.monthlyContribution,
          goalLabel: parsed.goalLabel,
          goalTargetAmount: parsed.goalTargetAmount,
          goalDate: new Date(parsed.goalDate),
          profileBucket,
        },
      });
    }

    // Synthesize plan
    const plan = synthesizePlan(sessionUser.id, {
      riskTolerance: parsed.riskTolerance,
      timeHorizon: parsed.timeHorizon,
      monthlyContribution: parsed.monthlyContribution,
      goalLabel: parsed.goalLabel,
      goalTargetAmount: parsed.goalTargetAmount,
      goalDate: parsed.goalDate,
    });

    await db.plan.create({
      data: {
        userId: sessionUser.id,
        allocation: JSON.stringify(plan.allocation),
        entryLadder: JSON.stringify(plan.entryLadder),
        rebalancingRules: JSON.stringify(plan.rebalancingRules),
      },
    });

    return NextResponse.json({
      userId: sessionUser.id,
      profileBucket,
      plan,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "invalid_request", details: err.issues.slice(0, 3) }, { status: 400 });
    }
    console.error("Onboarding error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Onboarding failed" },
      { status: 400 }
    );
  }
});
