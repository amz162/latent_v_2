"use client";

// Task 111 — small additive research panel shared by the Golden Cross and
// Volatility dashboards. Shows the LLM research signal and the overlay /
// option-availability status next to the existing content. Purely additive:
// neither dashboard's own computation or layout is modified.

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SignalRow {
  symbol: string;
  finalSignal: string;
  llmState: string;
  llmConviction: number | null;
  evidenceQuality: number;
  dataCutoff: string;
}

export function Task111SignalPanel({ symbol }: { symbol: string }) {
  const [row, setRow] = useState<SignalRow | null>(null);
  useEffect(() => {
    let alive = true;
    fetch("/api/ai-analysis", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const found = (j.signals ?? []).find((s: SignalRow) => s.symbol === symbol);
        setRow(found ?? null);
      })
      .catch(() => alive && setRow(null));
    return () => {
      alive = false;
    };
  }, [symbol]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          LLM research signal (side-by-side)
          <Badge variant="outline" className="border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400">
            RESEARCH ONLY
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        {row ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="font-semibold">{row.finalSignal}</span>
            <span className="text-xs text-muted-foreground">
              LLM conviction (uncalibrated): {row.llmConviction ?? "—"} · evidence quality: {row.evidenceQuality} · cutoff {row.dataCutoff} · {row.llmState}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Not a live trading signal; conviction is never a win probability. Details in the AI Analysis tab.
            </span>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No validated LLM research signal for {symbol} (missing, stale or rejected evidence is never fabricated).
          </p>
        )}
      </CardContent>
    </Card>
  );
}
