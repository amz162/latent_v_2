#!/usr/bin/env python3
"""Task 99 — Reference RNN-LSTM trading architectures (PSX adaptation), PyTorch.

Architecture attribution: https://github.com/jiewwantan/RNN_LSTM_trading_model
(rnn_modelling.py, Models.build_rnn_model / Models.build_cnn_model).

Licensing: the reference repository ships NO LICENSE file (verified via the
repo file listing on 2026-11-01). Default copyright applies, so this module is
an INDEPENDENT implementation of the disclosed architecture using Latent.pk's
existing PyTorch stack. No reference source code, .h5 weights or CSV datasets
are copied or rehosted. This is a PSX adaptation, not a byte-for-byte port.

Reference architectures (exact, from the audited source):
  LSTM:     LSTM(256, return_sequences=True) -> Dropout(0.25)
            -> LSTM(64) -> Dropout(0.25) -> Dense(1)
            RMSprop(lr=0.01, rho=0.9, eps=1e-8, decay=0.0002), loss=MAE,
            batch_size=4, epochs<=500, EarlyStopping(patience=40, val_loss)
  CNN-LSTM: Conv1D(256, k=8, linear) -> Conv1D(256, k=6, linear)
            -> Dropout(0.25) -> MaxPool1D(3) -> LSTM(128) -> Dropout(0.25)
            -> Dense(1); Adagrad(lr=0.01, eps=1e-8, decay=0.0002), loss=MAE,
            batch_size=8.

Documented deviations (PSX adaptation), each recorded in the training config:
  1. Dense output_dim=3 (5d/10d/21d forward-return regression) for the primary
     Latent.pk adaptation; output_dim=1 with the original next-day close-price
     target is kept as a separately-labelled reproduction experiment.
  2. The reference feeds the CNN with (samples, n_features, 1) — i.e. the
     FEATURE axis as the convolution time axis — and the LSTM with a single
     timestep (samples, 1, n_features). The PSX adaptation uses a genuine
     30-step time axis (SEQ=30) of the same feature vector, which satisfies
     the valid-convolution length requirement of kernels 8/6 + pool 3.
  3. Max epochs 500 -> bounded to 14 (bounded CPU profile; ~73s/epoch for the
     full LSTM at the reference batch size), EarlyStopping patience 40 -> 8,
     to fit the sandbox CPU/150s-execution profile. Best checkpoint by val MAE.
  4. reference_full_config keeps the exact layer widths; reference_cpu_compact
     scales widths to 96/32 (LSTM) and 96/96/64 (CNN-LSTM) when needed.
"""
from __future__ import annotations
import json
import math
from dataclasses import dataclass, asdict, field

import torch
import torch.nn as nn

SEQ = 30  # PSX adaptation sequence length (Latent.pk convention; reference used feature-axis convs)
HORIZONS = [5, 10, 21]
OUTPUT_DIM = len(HORIZONS)

REFERENCE_URL = "https://github.com/jiewwantan/RNN_LSTM_trading_model"


@dataclass
class ModelConfig:
    kind: str                 # "lstm" | "cnn_lstm"
    config_name: str          # "reference_full_config" | "reference_cpu_compact"
    lstm_hidden_1: int
    lstm_hidden_2: int        # 0 for cnn_lstm (single LSTM layer)
    conv_filters_1: int
    conv_kernel_1: int
    conv_filters_2: int
    conv_kernel_2: int
    pool_size: int
    dropout: float
    output_dim: int
    optimizer: str            # "rmsprop" | "adagrad" (faithful to reference)
    lr: float
    optimizer_eps: float
    optimizer_decay: float    # rmsprop weight_decay / adagrad lr_decay
    loss: str = "mae"
    seq_len: int = SEQ
    batch_size: int = 4       # reference LSTM 4 / CNN 8
    max_epochs: int = 14     # deviation: 500 -> bounded CPU profile (documented)
    early_stopping_patience: int = 8  # deviation: 40 -> 8 (documented)
    grad_clip: float = 1.0
    seed: int = 42
    extra: dict = field(default_factory=dict)


LSTM_FULL = ModelConfig(
    kind="lstm", config_name="reference_full_config",
    lstm_hidden_1=256, lstm_hidden_2=64, conv_filters_1=0, conv_kernel_1=0,
    conv_filters_2=0, conv_kernel_2=0, pool_size=0, dropout=0.25,
    output_dim=OUTPUT_DIM, optimizer="rmsprop", lr=0.01, optimizer_eps=1e-8,
    optimizer_decay=0.0002, batch_size=4,
)
LSTM_COMPACT = ModelConfig(
    kind="lstm", config_name="reference_cpu_compact",
    lstm_hidden_1=96, lstm_hidden_2=32, conv_filters_1=0, conv_kernel_1=0,
    conv_filters_2=0, conv_kernel_2=0, pool_size=0, dropout=0.25,
    output_dim=OUTPUT_DIM, optimizer="rmsprop", lr=0.01, optimizer_eps=1e-8,
    optimizer_decay=0.0002, batch_size=32,
)
CNN_FULL = ModelConfig(
    kind="cnn_lstm", config_name="reference_full_config",
    lstm_hidden_1=128, lstm_hidden_2=0, conv_filters_1=256, conv_kernel_1=8,
    conv_filters_2=256, conv_kernel_2=6, pool_size=3, dropout=0.25,
    output_dim=OUTPUT_DIM, optimizer="adagrad", lr=0.01, optimizer_eps=1e-8,
    optimizer_decay=0.0002, batch_size=8,
)
CNN_COMPACT = ModelConfig(
    kind="cnn_lstm", config_name="reference_cpu_compact",
    lstm_hidden_1=64, lstm_hidden_2=0, conv_filters_1=96, conv_kernel_1=8,
    conv_filters_2=96, conv_kernel_2=6, pool_size=3, dropout=0.25,
    output_dim=OUTPUT_DIM, optimizer="adagrad", lr=0.01, optimizer_eps=1e-8,
    optimizer_decay=0.0002, batch_size=32,
)

CONFIGS = {
    "jw_reference_lstm": {"reference_full_config": LSTM_FULL, "reference_cpu_compact": LSTM_COMPACT},
    "jw_reference_cnn_lstm": {"reference_full_config": CNN_FULL, "reference_cpu_compact": CNN_COMPACT},
}


def build_model(cfg: ModelConfig, n_features: int) -> nn.Module:
    """Faithful PyTorch equivalent of the reference architecture.

    Input tensor: (batch, time_steps, n_features). For the LSTM the reference
    stacked design is preserved (256 return_sequences -> 64). For the CNN-LSTM
    the two Conv1d layers use 'valid' padding exactly like Keras Conv1D, then
    MaxPool1d(3), then the LSTM reads the pooled time axis.
    """
    torch.manual_seed(cfg.seed)
    if cfg.kind == "lstm":
        layers: list[nn.Module] = [
            nn.LSTM(n_features, cfg.lstm_hidden_1, batch_first=True),
            nn.Dropout(cfg.dropout),
            nn.LSTM(cfg.lstm_hidden_1, cfg.lstm_hidden_2, batch_first=True),
            nn.Dropout(cfg.dropout),
            nn.Linear(cfg.lstm_hidden_2, cfg.output_dim),
        ]
        return JwStackedLSTM(cfg, nn.Sequential(*layers))
    if cfg.kind == "cnn_lstm":
        conv = nn.Sequential(
            nn.Conv1d(n_features, cfg.conv_filters_1, kernel_size=cfg.conv_kernel_1),
            nn.Conv1d(cfg.conv_filters_1, cfg.conv_filters_2, kernel_size=cfg.conv_kernel_2),
            nn.Dropout(cfg.dropout),
            nn.MaxPool1d(cfg.pool_size),
        )
        return JwConvLSTM(cfg, conv)
    raise ValueError(cfg.kind)


class _Base(nn.Module):
    def __init__(self, cfg: ModelConfig):
        super().__init__()
        self.cfg = cfg

    def count_params(self) -> int:
        return sum(p.numel() for p in self.parameters())


class JwStackedLSTM(_Base):
    """Reference stacked LSTM: LSTM(256, seq) -> Drop -> LSTM(64) -> Drop -> Dense."""

    def __init__(self, cfg: ModelConfig, body: nn.Sequential):
        super().__init__(cfg)
        self.body = body

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        out, _ = self.body[0](x)                    # LSTM 256, returns sequences
        out = self.body[1](out)                     # Dropout 0.25
        out, _ = self.body[2](out)                  # LSTM 64
        out = out[:, -1, :]                         # return_sequences=False -> last timestep
        out = self.body[3](out)                     # Dropout 0.25
        return self.body[4](out)                    # Dense -> (B, output_dim)


class JwConvLSTM(_Base):
    """Reference CNN-LSTM: Conv(256,k8) -> Conv(256,k6) -> Drop -> MaxPool(3)
    -> LSTM(128) -> Drop -> Dense, over a true time axis of length SEQ."""

    def __init__(self, cfg: ModelConfig, conv: nn.Sequential):
        super().__init__(cfg)
        self.conv = conv
        self.lstm = nn.LSTM(cfg.conv_filters_2, cfg.lstm_hidden_1, batch_first=True)
        self.drop = nn.Dropout(cfg.dropout)
        self.head = nn.Linear(cfg.lstm_hidden_1, cfg.output_dim)

    def pooled_len(self, seq_len: int) -> int:
        """Valid convolutions then pooling; validates minimum length."""
        k1, k2, p = self.cfg.conv_kernel_1, self.cfg.conv_kernel_2, self.cfg.pool_size
        if seq_len < k1 + k2 + (p - 1) + 1:
            raise ValueError(
                f"sequence length {seq_len} too short for valid conv(k={k1})+conv(k={k2})+pool({p})")
        t = seq_len - k1 + 1
        t = t - k2 + 1
        return t // p

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Conv1d over the time axis needs (B, C, T): channels = features.
        c = self.conv(x.permute(0, 2, 1))
        out, _ = self.lstm(c.permute(0, 2, 1))
        out = self.drop(out[:, -1, :])
        return self.head(out)


def make_optimizer(cfg: ModelConfig, model: nn.Module) -> torch.optim.Optimizer:
    if cfg.optimizer == "rmsprop":
        # Keras RMSprop(lr, rho, eps, decay) ~= torch RMSprop(lr, alpha, eps, weight_decay)
        return torch.optim.RMSprop(model.parameters(), lr=cfg.lr, alpha=0.9,
                                   eps=cfg.optimizer_eps, weight_decay=cfg.optimizer_decay)
    if cfg.optimizer == "adagrad":
        # Keras Adagrad(lr, eps, decay) -> torch Adagrad(lr_decay=decay)
        return torch.optim.Adagrad(model.parameters(), lr=cfg.lr, eps=cfg.optimizer_eps,
                                   lr_decay=cfg.optimizer_decay)
    raise ValueError(cfg.optimizer)


def param_count(cfg: ModelConfig, n_features: int) -> int:
    return build_model(cfg, n_features).count_params()


def cpu_threads(n: int = 2) -> None:
    torch.set_num_threads(n)


if __name__ == "__main__":
    cpu_threads(2)
    n = 40
    for name in ("jw_reference_lstm", "jw_reference_cnn_lstm"):
        for cn, cfg in CONFIGS[name].items():
            m = build_model(cfg, n)
            x = torch.randn(4, cfg.seq_len, n)
            y = m(x)
            assert y.shape == (4, cfg.output_dim), y.shape
            print(name, cn, "params", m.count_params(), "out", tuple(y.shape))
    print("OK")
