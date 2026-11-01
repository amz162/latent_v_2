#!/usr/bin/env python3
"""Task 99 — reference architecture audit + license/provenance artifacts.

Records what was verified by reading the actual reference sources (fetched
from raw.githubusercontent.com on 2026-11-01), including every defect that the
PSX adaptation corrects, and the licensing decision.
"""
import json
import time
from pathlib import Path

BASE = Path("data/backtest_reports/task99")

AUDIT = {
    "reference_url": "https://github.com/jiewwantan/RNN_LSTM_trading_model",
    "audit_date": "2026-11-01",
    "sources_inspected": ["README.md (4,286 B)", "rnn_modelling.py (50,707 B)",
                          "rnn_backtesting.py (36,512 B)", "rnn_modelling.ipynb (1,103,765 B)",
                          "rnn_bactesting.ipynb (513,371 B)"],
    "default_branch": "master",
    "reference_data": "AAPL (US) OHLCV + S&P 500 market context; pre-trained AAPL .h5 checkpoints shipped",
    "architectures": {
        "lstm": {
            "source": "rnn_modelling.py Models.build_rnn_model",
            "layers": ["LSTM(256, return_sequences=True, kernel_initializer=random_uniform)",
                       "Dropout(0.25)", "LSTM(64)", "Dropout(0.25)", "Dense(1)"],
            "optimizer": "RMSprop(lr=0.01, rho=0.9, epsilon=1e-8, decay=0.0002)",
            "loss": "mae", "batch_size": 4, "epochs": 500,
            "validation": "validation_split=0.2 with shuffle=True (DEFECT — not chronological)",
            "callbacks": ["EarlyStopping(val_loss, patience=40)", "ModelCheckpoint(best val_loss)"]
        },
        "cnn_lstm": {
            "source": "rnn_modelling.py Models.build_cnn_model",
            "layers": ["Conv1D(256, kernel=8, activation=linear)", "Conv1D(256, kernel=6, activation=linear)",
                       "Dropout(0.25)", "MaxPooling1D(3)", "LSTM(128)", "Dropout(0.25)", "Dense(1)"],
            "optimizer": "Adagrad(lr=0.01, epsilon=1e-8, decay=0.0002)",
            "loss": "mae", "batch_size": 8, "epochs": 500
        }
    },
    "verified_input_shapes": {
        "cnn": "train_X.reshape((samples, n_features, 1)) — the FEATURE axis is used as the Conv1D time axis (seq_length=3 refers to OHLCV lag COLUMNS T-0..T-2, not the conv time axis)",
        "lstm": "train_X.reshape((samples, 1, n_features)) — single timestep",
        "implication": "kernels 8/6 only 'fit' because the feature axis (~30-40 wide) is treated as time; the PSX adaptation replaces this with a genuine 30-step time axis"
    },
    "target": {
        "original": "PREDICTION_AHEAD=1 — next-day future close price (regression), MinMax-scaled",
        "defect_objective_mismatch": "feature selection (FeatureSelector, task='regression', eval_metric='auc') runs against a BINARY daily-return-direction label (Returns>0) while the forecast target is next-day close — objective mismatch"
    },
    "feature_engineering": {
        "family": "OHLCV T-0..T-2 columns, MA5/10/20/60/120, ADX(14), ADXR(14), MACD(12,26,9), RSI(14), BBANDS(5,2,2), AD, ATR(14), HT_DCPERIOD, High/Open, Low/Open, Close/Open",
        "defect_ma_collision": "ta['MA5'] = tb.MA(close,5) is OVERWRITTEN by tb.MA(volume,5) — same for MA10/MA20 (close MAs 5/10/20 lost)",
        "psx_fix": "distinct close_ma_5/10/20/60/120 and volume_ma_5/10/20 fields"
    },
    "leakage_defects_identified": [
        "scalers (Normalizer/StandardScaler/MinMaxScaler) fit on the FULL feature history before any split",
        "feature selection performed before a clean walk-forward split",
        "feature-selector validation uses random train_test_split",
        "objective mismatch: directional label for selection vs close-price regression target",
        "model.fit uses shuffle=True + generic validation_split=0.2 (no chronological split, no maturity purge)"
    ],
    "backtesting": {
        "source": "rnn_backtesting.py",
        "assumptions": ["DOW VIX (FRED VXDCLS) context", "long-only signal strategy", "KPI table (max consecutive losers etc.)",
                        "US-style cost assumptions; options/premium hedging context — NOT portable to PSX"],
        "psx_decision": "NOT ported; Task 99 uses Latent.pk's strategy-engine + PSX User Schedule V2"
    },
    "psx_adaptation_summary": {
        "time_axis": "genuine 30-step sequences (SEQ=30) of the same feature vector",
        "targets": "5d/10d/21d forward-return regression, output_dim=3 (primary); 1-day-ahead reproduction experiment separate",
        "leakage": "chronological 60/20/20 split, strict 21-session maturity purge, train-only scaler + feature selection",
        "market_context": "EXCLUDED — no genuine KSE-100 series in the DB; synthetic proxy forbidden",
        "indicators": "numpy/pandas equivalents (TA-Lib not installed); HT_DCPERIOD as Ehlers-style approximation"
    }
}

LICENSE = {
    "reference_repo": AUDIT["reference_url"],
    "license_file_found": False,
    "verified_how": "GitHub repo page file listing (2026-11-01): no LICENSE file at root or Resources section",
    "decision": {
        "copy_source_code": False,
        "reuse_pretrained_h5_weights": False,
        "rehost_reference_csv_datasets": False,
        "independent_pytorch_implementation": True,
        "attribution": "architecture attributed to the reference repository in model metadata, "
                       "task99_jw_models.py header, task99_feature_schema.json and the registry entries",
        "disclaimer": "attribution is not permission to copy; the implementation is an independent "
                      "PSX adaptation, not a byte-for-byte port"
    },
    "dependency_policy": "no TensorFlow/Keras added; PyTorch (already the project stack) used",
    "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
}

if __name__ == "__main__":
    BASE.mkdir(parents=True, exist_ok=True)
    (BASE / "task99_reference_architecture_audit.json").write_text(json.dumps(AUDIT, indent=2))
    (BASE / "task99_license_and_provenance.json").write_text(json.dumps(LICENSE, indent=2))
    print("reference audit + license artifacts written")
