import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/backtest/walk-forward/status
//
// Task 54 — READ-ONLY progress endpoint for RESUMABLE walk-forward runs.
//
// Returns run PROGRESS ONLY (counts + status) for the run directories under
// data/backtest_reports/runs/<run_id>/. It NEVER serves forecast metrics:
// a partial/pilot run must never be mistaken for a completed evaluation.
// The completed-evaluation metrics remain at /api/backtest/walk-forward
// (walk_forward_latest.json) and are only written after a full run finishes
// and passes candidate validation.
//
// Long-running evaluations are NEVER started from an API request — runs are
// invoked explicitly from the local execution environment (the CLI script
// prints the exact resume command after each chunk).
// ─────────────────────────────────────────────────────────────────────────────

interface RunProgress {
  run_id: string;
  universe_mode: string | null;
  total_samples: number | null;
  completed_samples: number | null;
  remaining_samples: number | null;
  model_fits_completed: number | null;
  status: string | null;
  updated_at: string | null;
  universe_selection_cutoff: string | null;
  manifest_available: boolean;
}

export async function GET() {
  const runsDir = path.join(process.cwd(), "data", "backtest_reports", "runs");
  try {
    const entries = await fs.readdir(runsDir, { withFileTypes: true });
    const runs: RunProgress[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const dir = path.join(runsDir, e.name);
      let progress: any = null;
      let manifest: any = null;
      try {
        progress = JSON.parse(await fs.readFile(path.join(dir, "progress.json"), "utf8"));
      } catch {
        continue; // no progress artifact → not a trackable run
      }
      try {
        manifest = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8"));
      } catch {
        manifest = null;
      }
      runs.push({
        run_id: progress.run_id ?? e.name,
        universe_mode: progress.universe_mode ?? manifest?.universe_mode ?? null,
        total_samples: progress.total_samples ?? null,
        completed_samples: progress.completed_samples ?? null,
        remaining_samples: progress.remaining_samples ?? null,
        model_fits_completed: progress.model_fits_completed ?? null,
        status: progress.status ?? null,
        updated_at: progress.updated_at ?? null,
        universe_selection_cutoff: manifest?.universe?.selection_cutoff ?? null,
        manifest_available: !!manifest,
      });
    }
    runs.sort((a, b) => ((a.updated_at ?? "") < (b.updated_at ?? "") ? 1 : -1));
    return NextResponse.json({
      available: runs.length > 0,
      runs: runs.slice(0, 20),
      note:
        "Progress only — NO forecast metrics here. Partial/pilot runs never publish a report; " +
        "final evaluation metrics are served by /api/backtest/walk-forward only after the full run " +
        "completes and passes candidate validation.",
    });
  } catch {
    return NextResponse.json({
      available: false,
      runs: [] as RunProgress[],
      note: "no resumable-runs directory — nothing is running",
    });
  }
}
