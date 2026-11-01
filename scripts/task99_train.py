#!/usr/bin/env python3
"""Task 99 — resumable trainer for the reference LSTM / CNN-LSTM (PSX data).

Executed by task99_runner.py under a 150-second wall budget. Each invocation:
  - loads the dataset npz (cached),
  - resumes from the last checkpoint if present (epoch, optimizer state, RNG),
  - trains until --time-budget or --max-epochs, evaluating val MAE each epoch
    (reference val_loss = MAE), early stopping with patience (see config),
  - checkpoints model+optimizer+epoch after EVERY completed epoch,
  - when training is finished, runs inference on val+test and saves
    predictions (pred, truth, symbol, decision date) — persisted immediately.

Reference-faithful details: MAE loss; RMSprop for LSTM / Adagrad for CNN-LSTM
(lr 0.01, eps 1e-8, decay 0.0002); batch sizes 4 (LSTM) / 8 (CNN) for the full
config; shuffled train batches WITHIN the training partition only (reference
shuffled the whole pipeline — that defect is not reproduced; val/test are
chronological and untouched).
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
import time
from pathlib import Path

import numpy as np
import torch

import sys
sys.path.insert(0, str(Path(__file__).resolve().parent))
from task99_jw_models import (CONFIGS, build_model, cpu_threads,  # noqa: E402
                              make_optimizer)

BASE = Path("data/backtest_reports/task99")
CKPT_DIR = BASE / "checkpoints"
PRED_DIR = BASE / "predictions"
MODELS_DIR = BASE / "models"
CKPT_DIR.mkdir(parents=True, exist_ok=True)
PRED_DIR.mkdir(parents=True, exist_ok=True)


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def run(model_id: str, config_name: str, dataset_tag: str, time_budget: float,
        min_epochs: int = 1) -> dict:
    cpu_threads(2)
    torch.manual_seed(42)
    np.random.seed(42)
    cfg = CONFIGS[model_id][config_name]
    npz = MODELS_DIR / f"dataset_{dataset_tag}.npz"
    meta = json.loads((MODELS_DIR / f"dataset_{dataset_tag}.json").read_text())
    z = np.load(npz)
    Xtr, ytr = z["Xtr"], z["ytr"]
    Xva, yva = z["Xva"], z["yva"]
    Xte, yte = z["Xte"], z["yte"]
    n_features = Xtr.shape[2]
    assert n_features == meta["n_features"]

    name = f"{model_id}__{config_name}__{dataset_tag}"
    ckpt_path = CKPT_DIR / f"{name}.pt"
    side_path = CKPT_DIR / f"{name}.json"

    model = build_model(cfg, n_features)
    opt = make_optimizer(cfg, model)
    epoch = 0
    best_val, best_epoch = math.inf, -1
    history: list[dict] = []
    side = {}
    if ckpt_path.exists():
        ck = torch.load(ckpt_path, map_location="cpu", weights_only=False)
        model.load_state_dict(ck["model"])
        opt.load_state_dict(ck["optimizer"])
        epoch = ck["epoch"]
        best_val, best_epoch = ck["best_val"], ck["best_epoch"]
        history = ck["history"]
        rng_state = ck.get("torch_rng")
        if rng_state is not None:
            torch.set_rng_state(rng_state)
        side = json.loads(side_path.read_text())
        print(f"resumed {name} at epoch {epoch} (best_val={best_val:.6f})")

    xt = torch.tensor(Xtr, dtype=torch.float32)
    yt = torch.tensor(ytr, dtype=torch.float32)
    xv = torch.tensor(Xva, dtype=torch.float32) if len(Xva) else None
    yv = torch.tensor(yva, dtype=torch.float32) if len(yva) else None

    def eval_val() -> float:
        model.eval()
        with torch.no_grad():
            preds = []
            for i in range(0, len(xv), 4096):
                preds.append(model(xv[i:i + 4096]))
            pv = torch.cat(preds)
            return float(torch.mean(torch.abs(pv - yv)))

    deadline = time.time() + time_budget
    done_reason = "max_epochs"
    bs = cfg.batch_size
    n = len(xt)
    g = torch.Generator().manual_seed(cfg.seed + epoch)
    while epoch < cfg.max_epochs:
        if time.time() > deadline and epoch >= min_epochs:
            done_reason = "time_budget"
            break
        model.train()
        perm = torch.randperm(n, generator=g)
        ep_loss, nb = 0.0, 0
        for i in range(0, n, bs):
            idx = perm[i:i + bs]
            opt.zero_grad()
            out = model(xt[idx])
            loss = torch.mean(torch.abs(out - yt[idx]))
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), cfg.grad_clip)
            opt.step()
            ep_loss += float(loss)
            nb += 1
            if time.time() > deadline and nb > 0:
                break
        epoch += 1
        val_mae = eval_val() if xv is not None else float("nan")
        history.append({"epoch": epoch, "train_mae": ep_loss / max(nb, 1),
                        "val_mae": val_mae})
        if val_mae < best_val:
            best_val, best_epoch = val_mae, epoch
        # checkpoint after every completed epoch (resumable without restart)
        torch.save({"model": model.state_dict(), "optimizer": opt.state_dict(),
                    "epoch": epoch, "best_val": best_val, "best_epoch": best_epoch,
                    "history": history, "torch_rng": torch.get_rng_state()}, ckpt_path)
        if epoch - best_epoch >= cfg.early_stopping_patience:
            done_reason = f"early_stopping(patience={cfg.early_stopping_patience})"
            break
        if time.time() > deadline:
            done_reason = "time_budget"
            break

    # reload BEST checkpoint weights for inference (ModelCheckpoint best_val_loss)
    ck = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    model.load_state_dict(ck["model"])
    finished = done_reason != "time_budget" or epoch >= cfg.max_epochs

    side.update({
        "model_id": model_id, "config_name": config_name, "config": {k: v for k, v in vars(cfg).items()},
        "dataset_tag": dataset_tag, "dataset_sha16": sha(npz),
        "n_features": n_features, "seq_len": cfg.seq_len,
        "epoch": epoch, "best_val_mae": best_val, "best_epoch": best_epoch,
        "finished": bool(finished and done_reason != "time_budget"),
        "stop_reason": done_reason,
        "param_count": model.count_params(),
        "counts": {"train": int(len(ytr)), "val": int(len(yva)), "test": int(len(yte))},
        "training_only_preprocessing": ["StandardScaler", "feature_selection"],
        "loss": "mae", "checkpoint_sha16": None, "history_tail": history[-5:],
    })
    ckpt_sha = sha(ckpt_path)
    side["checkpoint_sha16"] = ckpt_sha
    side_path.write_text(json.dumps(side, indent=2))

    if finished:
        PRED_DIR.mkdir(parents=True, exist_ok=True)
        model.eval()
        with torch.no_grad():
            def pred(a):
                out = []
                for i in range(0, len(a), 4096):
                    out.append(model(torch.tensor(a[i:i + 4096], dtype=torch.float32)))
                return torch.cat(out).numpy().astype(np.float32)
            pv, pt = pred(Xte), pred(Xva)
        np.savez_compressed(PRED_DIR / f"preds_{name}.npz",
                            test_pred=pv, test_y=yte, test_sym=z["ste"], test_date=z["dte"],
                            val_pred=pt, val_y=yva, val_sym=z["sva"], val_date=z["dva"])
        (PRED_DIR / f"preds_{name}.json").write_text(json.dumps(
            {"n_test": int(len(pv)), "n_val": int(len(pt)), "best_epoch": best_epoch,
             "best_val_mae": best_val, "checkpoint_sha16": ckpt_sha}, indent=2))
        print(f"FINISHED {name}: epochs={epoch} best_val_mae={best_val:.6f} "
              f"(epoch {best_epoch}) predictions saved")
    else:
        print(f"CHUNK {name}: epochs={epoch} val_mae={history[-1]['val_mae']:.6f} "
              f"resumable (stop: {done_reason})")
    return side


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=["jw_reference_lstm", "jw_reference_cnn_lstm"])
    ap.add_argument("--config", default="reference_full_config")
    ap.add_argument("--dataset", required=True)
    ap.add_argument("--time-budget", type=float, default=110.0)
    ap.add_argument("--min-epochs", type=int, default=1)
    a = ap.parse_args()
    run(a.model, a.config, a.dataset, a.time_budget, a.min_epochs)
