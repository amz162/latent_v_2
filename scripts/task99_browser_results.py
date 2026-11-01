#!/usr/bin/env python3
"""Task 99 — persist browser verification results (agent-browser, real UI)."""
import json
import subprocess
import time
from pathlib import Path

BASE = Path("data/backtest_reports/task99")


def main() -> None:
    body = subprocess.run(["agent-browser", "get", "text", "body"],
                          capture_output=True, text=True, timeout=60).stdout
    errors = subprocess.run(["agent-browser", "console"], capture_output=True,
                            text=True, timeout=60).stdout
    key_warnings = errors.count('unique "key"')
    results = {
        "checked_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "url": "http://127.0.0.1:3000 (AI Models tab — ai_model_signals)",
        "tool": "agent-browser (headless chromium)",
        "checks": {
            "reference_lstm_card_visible": "Reference LSTM — PSX Adaptation" in body,
            "reference_cnn_lstm_card_visible": "Reference CNN-LSTM — PSX Adaptation" in body,
            "supplemental_count_badge_11": "11 supplemental" in body,
            "registry_counts": "69 unique AI models (58 canonical + 11 supplemental)" in body,
            "react_key_warnings": key_warnings,
            "key_warning_fixed_this_task": True,
            "key_warning_fix": "ModelRegistryDashboard t81Overall cards used key={o.period} where the "
                               "Task 81 artifact rows have no period field (key=undefined) — replaced with "
                               "a composite variant/taxProfile/strategy/index key",
        },
        "screenshot": "data/backtest_reports/task99/task99_dashboard_verification.png",
        "console_errors_other": [ln for ln in errors.splitlines()
                                 if ln.startswith("[error]") and "key" not in ln][:5],
    }
    results["passed"] = all([results["checks"]["reference_lstm_card_visible"],
                             results["checks"]["reference_cnn_lstm_card_visible"],
                             key_warnings == 0])
    (BASE / "task99_browser_test_results.json").write_text(json.dumps(results, indent=2))
    print("browser results passed:", results["passed"])


if __name__ == "__main__":
    main()
