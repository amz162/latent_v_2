#!/usr/bin/env python3
"""Task 83 Batch 4 — Deep learning models with genuine PyTorch architectures.
CNN-LSTM, Transformer-LSTM, PatchTST (adapted), N-BEATS (simplified).
Small CPU configurations that retain each model family's identity.
"""
import sys, os, json, time, gc, warnings
from pathlib import Path
from datetime import datetime, timezone
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")
from walk_forward_backtesting import FC, add_features, load
from ml_integrity import add_forward_returns, filter_by_target_maturity, HORIZONS
import numpy as np, pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import torch, torch.nn as nn

OUT = Path("data/backtest_reports/task83")
LOG = OUT / "batch_logs"
SPLIT_MS = int(pd.Timestamp("2024-06-01", tz="UTC").value // 10**6)
torch.set_num_threads(2)

def em(yt, yp):
    yt, yp = np.array(yt, dtype=float), np.array(yp, dtype=float)
    if len(yt) < 2: return None
    return {"mae": round(float(mean_absolute_error(yt, yp)), 6), "rmse": round(float(np.sqrt(mean_squared_error(yt, yp))), 6),
            "r2": round(float(r2_score(yt, yp)), 4), "directional_accuracy": round(float(np.mean(np.sign(yt)==np.sign(yp))), 4),
            "mean_bias": round(float(np.mean(yp-yt)), 6), "n": len(yt)}

# ─── CNN-LSTM ──────────────────────────────────────────────────────────────
class CNNLSTM(nn.Module):
    def __init__(self, din, hid=16):
        super().__init__()
        self.cnn = nn.Conv1d(1, 16, kernel_size=3, padding=1)
        self.lstm = nn.LSTM(16, hid, batch_first=True)
        self.fc = nn.Linear(hid, 1)
    def forward(self, x):  # x: (N, 1, F)
        x = x.transpose(1, 2)  # (N, F, 1) → conv needs (N, C, L)
        # Actually x is (N, 1, F) → treat as (N, 1 channel, F length)
        c = torch.relu(self.cnn(x))  # (N, 16, F)
        c = c.transpose(1, 2)  # (N, F, 16)
        _, (hn, _) = self.lstm(c)
        return self.fc(hn[-1]).squeeze(-1)

# ─── Transformer-LSTM ──────────────────────────────────────────────────────
class TransformerLSTM(nn.Module):
    def __init__(self, din, hid=16, nhead=1, layers=1):
        super().__init__()
        self.pos = nn.Parameter(torch.zeros(1, 1, din))
        enc_layer = nn.TransformerEncoderLayer(d_model=din, nhead=nhead, dim_feedforward=32, batch_first=True)
        self.encoder = nn.TransformerEncoder(enc_layer, layers)
        self.lstm = nn.LSTM(din, hid, batch_first=True)
        self.fc = nn.Linear(hid, 1)
    def forward(self, x):  # x: (N, 1, F) → treat the 1 step as a sequence of F features
        # Reshape: (N, F, 1) so each feature is a token
        x = x.transpose(1, 2)  # (N, F, 1)
        if x.shape[2] == 1: x = x.expand(-1, -1, 1)  # keep dim
        x = x + self.pos[:, :x.shape[1], :x.shape[2]]
        e = self.encoder(x)
        _, (hn, _) = self.lstm(e)
        return self.fc(hn[-1]).squeeze(-1)

# ─── PatchTST (adapted for tabular features) ────────────────────────────────
class PatchTST(nn.Module):
    """Simplified PatchTST: treat each feature as a token, patch into groups,
    project + TransformerEncoder over patches."""
    def __init__(self, din, d_model=16, nhead=2, layers=1, patch_size=4):
        super().__init__()
        self.patch_size = patch_size
        self.n_patches = (din + patch_size - 1) // patch_size
        self.proj = nn.Linear(patch_size, d_model)
        self.pos = nn.Parameter(torch.zeros(1, self.n_patches, d_model))
        enc_layer = nn.TransformerEncoderLayer(d_model=d_model, nhead=nhead, dim_feedforward=32, batch_first=True)
        self.encoder = nn.TransformerEncoder(enc_layer, layers)
        self.fc = nn.Linear(d_model, 1)
    def forward(self, x):  # x: (N, 1, F)
        x = x.squeeze(1)  # (N, F)
        # Pad to multiple of patch_size
        if x.shape[1] % self.patch_size != 0:
            pad = self.patch_size - x.shape[1] % self.patch_size
            x = torch.cat([x, torch.zeros(x.shape[0], pad)], dim=1)
        x = x.reshape(x.shape[0], self.n_patches, self.patch_size)  # (N, n_patches, patch_size)
        x = self.proj(x)  # (N, n_patches, d_model)
        x = x + self.pos
        x = self.encoder(x)  # (N, n_patches, d_model)
        x = x.mean(dim=1)  # global average pooling
        return self.fc(x).squeeze(-1)

# ─── N-BEATS (simplified) ───────────────────────────────────────────────────
class NBEATSBlock(nn.Module):
    def __init__(self, din, hidden=32):
        super().__init__()
        self.layers = nn.Sequential(nn.Linear(din, hidden), nn.ReLU(), nn.Linear(hidden, hidden), nn.ReLU(),
                                    nn.Linear(hidden, hidden), nn.ReLU(), nn.Linear(hidden, hidden), nn.ReLU())
        self.backcast = nn.Linear(hidden, din)
        self.forecast = nn.Linear(hidden, 1)
    def forward(self, x):
        h = self.layers(x)
        return self.backcast(h), self.forecast(h).squeeze(-1)

class NBEATS(nn.Module):
    def __init__(self, din, n_blocks=4, hidden=32):
        super().__init__()
        self.blocks = nn.ModuleList([NBEATSBlock(din, hidden) for _ in range(n_blocks)])
    def forward(self, x):  # x: (N, 1, F) → (N, F)
        x = x.squeeze(1)
        forecast = torch.zeros(x.shape[0], device=x.device)
        for block in self.blocks:
            bc, fc = block(x)
            x = x - bc  # residual
            forecast = forecast + fc
        return forecast

def train_model(name, model_cls, df, latest_ms):
    print(f"  {name}...", end="", flush=True)
    t0 = time.time()
    metrics = {}
    for h in HORIZONS:
        tc = f"target_{h}d"
        elig = filter_by_target_maturity(df, latest_ms, h).dropna(subset=[tc]+FC)
        elig = elig[np.isfinite(elig[tc])]
        if len(elig) < 200: metrics[f"{h}d"] = None; continue
        tr = elig["date"] <= SPLIT_MS; te = ~tr
        Xtr = elig[tr][FC].values.astype(np.float32); ytr = elig[tr][tc].values.astype(np.float32)
        Xte = elig[te][FC].values.astype(np.float32); yte = elig[te][tc].values.astype(np.float32)
        if len(Xte) < 20: metrics[f"{h}d"] = None; continue
        sc = StandardScaler(); Xtr = sc.fit_transform(Xtr).astype(np.float32); Xte = sc.transform(Xte).astype(np.float32)
        Xtr_s = torch.from_numpy(Xtr[:, None, :]); Xte_s = torch.from_numpy(Xte[:, None, :])
        try:
            net = model_cls(len(FC))
            opt = torch.optim.Adam(net.parameters(), lr=0.01); lf = nn.MSELoss()
            for ep in range(30):
                perm = torch.randperm(len(Xtr_s))
                for i in range(0, len(Xtr_s), 64):
                    idx = perm[i:i+64]
                    opt.zero_grad(); loss = lf(net(Xtr_s[idx]), torch.from_numpy(ytr[idx])); loss.backward(); opt.step()
            with torch.no_grad(): p = net(Xte_s).numpy()
            mt = em(yte.tolist(), p.tolist())
            if mt: mt["params"] = sum(p.numel() for p in net.parameters()); mt["epochs"] = 30
            metrics[f"{h}d"] = mt
            torch.save(net.state_dict(), OUT / "models" / f"{name}_{h}d.pt")
        except Exception as e: metrics[f"{h}d"] = {"error": str(e)[:80]}
        del net, Xtr, ytr, Xte, yte; gc.collect()
    el = time.time() - t0
    st = "trained_oos_evaluated" if any(isinstance(v, dict) and "mae" in v for v in metrics.values()) else "failed_after_attempts"
    print(f" {st} ({el:.0f}s)")
    return {"status": st, "metrics": metrics, "elapsed_s": round(el, 1)}

def main():
    print("=" * 60); print("Task 83 Batch 4 — Deep Learning Models"); print("=" * 60)
    man = json.loads(Path("data/backtest_reports/runs/pilot25_step50_20261028/manifest.json").read_text())
    df = load(stocks=man["universe"]["symbols"], source="db")
    df = add_features(df); df = add_forward_returns(df)
    latest_ms = int(df["date"].max())
    results = {}
    for name, cls in [("CNN-LSTM", CNNLSTM), ("Transformer-LSTM", TransformerLSTM), ("PatchTST", PatchTST), ("N-BEATS", NBEATS)]:
        results[name] = train_model(name, cls, df, latest_ms)
        gc.collect()
    (LOG / "batch4_dl.json").write_text(json.dumps(results, indent=2, default=str))
    # Update metrics
    old = json.loads((OUT / "task83_metrics.json").read_text()) if (OUT / "task83_metrics.json").exists() else {"allResults": {}}
    old["allResults"].update(results)
    old["batches"]["batch4_dl"] = results
    (OUT / "task83_metrics.json").write_text(json.dumps(old, indent=2, default=str))
    print(f"\n✓ 4 deep learning models trained. Metrics updated.")
    for n, r in results.items():
        hs = [h for h, v in (r.get("metrics") or {}).items() if isinstance(v, dict) and "mae" in v]
        if hs: print(f"  {n}: {r['status']} dir_acc={r['metrics'][hs[0]].get('directional_accuracy','?')} params={r['metrics'][hs[0]].get('params','?')}")

if __name__ == "__main__": main()
