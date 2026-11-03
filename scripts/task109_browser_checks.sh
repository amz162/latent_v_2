#!/usr/bin/env bash
# Task 109 Phase 5/11 — headless browser verification of the deployed site.
# Desktop + mobile viewport, console errors, monitor tab, detail view, filters.
# Every value written to the output JSON is MEASURED, never asserted.
set -u
AB="agent-browser"
OUT="${1:-/tmp/task109_browser.json}"
BASE="http://localhost:3000"

CONS0=$($AB console 2>/dev/null | grep -cE "\[error\]" || true)
$AB open "$BASE" >/dev/null 2>&1; sleep 6

ENTER=$($AB snapshot -i 2>/dev/null | grep -iE "enter (the )?platform" | grep -oE "ref=e[0-9]+" | cut -d= -f2 | head -1)
[ -n "$ENTER" ] && $AB click "@$ENTER" >/dev/null 2>&1; sleep 4
SIDEBAR=$($AB snapshot -i 2>/dev/null | grep -iE "toggle sidebar" | grep -oE "ref=e[0-9]+" | cut -d= -f2 | head -1)
[ -n "$SIDEBAR" ] && $AB click "@$SIDEBAR" >/dev/null 2>&1; sleep 2
TAB=$($AB snapshot -i 2>/dev/null | grep -iE "paper trade monitor" | grep -oE "ref=e[0-9]+" | cut -d= -f2 | head -1)
[ -n "$TAB" ] && $AB click "@$TAB" >/dev/null 2>&1; sleep 7

BODY_NORM=$($AB eval "document.body.innerText" 2>/dev/null | tr '\n' ' ' | tr -s ' ')
BODY_NORM="${BODY_NORM//\\n/ }"
export B_DELAY=$(printf '%s' "$BODY_NORM" | grep -c "delayed by approximately 15 minutes" || true)
export B_REALIZED=$(printf '%s' "$BODY_NORM" | grep -c "Never counted as realized" || true)
export B_LEGACY=$(printf '%s' "$BODY_NORM" | grep -c "Task 76-era" || true)
export B_MTM=$(printf '%s' "$BODY_NORM" | grep -c "Unrealized MTM" || true)
export B_GEN=$(printf '%s' "$BODY_NORM" | grep -oE "task10[567]-gen[123]" | sort -u | tr '\n' ',' || true)
export B_STALE=$(printf '%s' "$BODY_NORM" | grep -oiE "session_closed_data|stale_data" | wc -l || true)
export B_SUMMARY=$(printf '%s' "$BODY_NORM" | grep -oE "Open paper trades [0-9]+" | head -1)
export B_ROWS=$(printf '%s' "$BODY_NORM" | grep -oE "Showing [0-9]+ of [0-9]+|[0-9]+ of [0-9]+ positions" | head -1)

# detail view: click the first table's Detail button (DOM-based, robust)
CLICKED=$($AB eval "(() => { const b = [...document.querySelectorAll('button')].find(x => x.innerText.trim() === 'Detail'); if (b) { b.click(); return 'clicked'; } return 'none'; })()" 2>/dev/null)
sleep 3
DET=$($AB eval "document.body.innerText" 2>/dev/null)
D1=$(printf '%s' "$DET" | grep -cE "Generation: task10[567]" || true)
D2=$(printf '%s' "$DET" | grep -coE "Signal time|Entry (date|price)|Stop[- ]loss" || true)
D3=$(printf '%s' "$DET" | grep -oE "task10[4567]-gen[123]" | head -1)
export B_DETAIL="click=$CLICKED gen_label=$D1 decision_fields=$D2 gen_badge=$D3"
CONS2=$($AB console 2>/dev/null | grep -cE "\[error\]" || true)
export B_CONSOLE=$((CONS2 > CONS0 ? CONS2 - CONS0 : 0))

# mobile viewport
$AB set viewport 390 844 >/dev/null 2>&1 || $AB viewport 390 844 >/dev/null 2>&1
sleep 3
MBODY=$($AB eval "document.body.innerText" 2>/dev/null | tr '\n' ' ' | tr -s ' ')
MBODY="${MBODY//\\n/ }"
export M_DELAY=$(printf '%s' "$MBODY" | grep -c "delayed by approximately 15 minutes" || true)
export M_MTM=$(printf '%s' "$MBODY" | grep -c "Unrealized MTM" || true)
export M_HSCROLL=$($AB eval "String(document.documentElement.scrollWidth > document.documentElement.clientWidth + 2)" 2>/dev/null)

python3 - "$OUT" << 'PYEOF'
import json, os, sys
def n(k): return int(os.environ.get(k, "0") or 0)
measured = {
  "desktop": {
    "delay_banner_count": n("B_DELAY"),
    "realized_separation_count": n("B_REALIZED"),
    "legacy_group_label_count": n("B_LEGACY"),
    "unrealized_mtm_card_count": n("B_MTM"),
    "generation_badges_seen": os.environ.get("B_GEN", ""),
    "stale_session_label_count": n("B_STALE"),
    "open_trades_summary_text": os.environ.get("B_SUMMARY", ""),
    "rows_text": os.environ.get("B_ROWS", ""),
    "detail_view": os.environ.get("B_DETAIL", "not_tested")},
  "mobile_390x844": {
    "delay_banner_count": n("M_DELAY"),
    "unrealized_mtm_card_count": n("M_MTM"),
    "horizontal_overflow": os.environ.get("M_HSCROLL", "unmeasured")},
  "console_error_count": n("B_CONSOLE")}
d, m = measured["desktop"], measured["mobile_390x844"]
checks = {
  "delay_banner": d["delay_banner_count"] >= 1,
  "realized_separation_text": d["realized_separation_count"] >= 1,
  "legacy_group_honest_label": d["legacy_group_label_count"] >= 1,
  "unrealized_mtm_card": d["unrealized_mtm_card_count"] >= 1,
  "generation_origin_rendered": bool(d["generation_badges_seen"].strip(",")) or bool(d["detail_view"].split("gen_badge=")[-1].strip()),
  "detail_view_opens": "gen_label=1" in d["detail_view"],
  "mobile_delay_banner": m["delay_banner_count"] >= 1,
  "mobile_no_horizontal_overflow": str(m["horizontal_overflow"]).strip("\"").lower() == "false",
  "no_console_errors": n("B_CONSOLE") == 0}
out = {"tool": "agent-browser (headless) 0.41.1",
       "url": "http://localhost:3000 -> Enter platform -> Paper Trade Monitor",
       "measured": measured, "checks": checks,
       "passed": all(checks.values()),
       "generated_at": os.environ.get("TASK109_TS")}
json.dump(out, open(sys.argv[1], "w"), indent=1)
print(json.dumps(checks))
PYEOF
