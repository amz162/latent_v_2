#!/usr/bin/env python3
"""Generate a PDF report of all 65 individual model backtest results + all 13
ensemble backtest results (with the names of all models in each ensemble)."""
import json, os, sys
from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, cm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, Image, KeepTogether
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# Paths
PROJECT_DIR = Path(__file__).parent.parent
JSON_PATH = PROJECT_DIR / "data" / "ml_predictions_multi.json"
OUT_PDF = PROJECT_DIR / "data" / "backtest_report.pdf"

# Load the JSON
d = json.loads(JSON_PATH.read_text())
bt = d.get("backtesting", {})
ebt = d.get("ensemble_backtesting", {})

# Ensemble composition (from src/lib/latent/ensemble.ts + the route)
ENSEMBLE_COMPOSITION = [
    {
        "name": "majority_vote", "label": "A. Majority Vote",
        "description": "Each model casts a vote (BUY/SELL/HOLD). The signal with the most votes wins.",
        "models": "ALL 56 trained models (each model votes BUY/SELL/HOLD; majority wins)",
    },
    {
        "name": "probability_weighted", "label": "B. Probability-Weighted",
        "description": "Weighted by avgReturn across all models. Signal = BUY if avg > 0.01, SELL if < -0.01.",
        "models": "ALL 56 trained models (weighted by avgReturn)",
    },
    {
        "name": "tier_weighted", "label": "C. Tier-Weighted",
        "description": "Weighted by tier (TIER_1 0.30, TIER_2 0.20, TIER_3 0.25, TIER_4 0.10, CL 0.15, CL_2 0.20, PI 0.20, GM 0.20, CG 0.20, X 0.20, GIAN 0.20).",
        "models": "ALL 56 trained models (weighted by tier)",
    },
    {
        "name": "cl_ensemble", "label": "D. CL-Ensemble (LGB70+Log30)",
        "description": "LightGBM (CL) 70% weight + Logistic (CL-2) 30% weight. Calibrated classifier ensemble.",
        "models": "LightGBM (CL), Logistic (CL-2)",
    },
    {
        "name": "cl_extender", "label": "E. CL-Extender (8-model weighted)",
        "description": "8-model weighted ensemble from the CL tier (classical/linear models).",
        "models": "ARIMA, Holt-Winters, GARCH, Ridge Regression, Prophet, Kalman Filter, XGBoost (CL), LightGBM (CL), Random Forest (CL)",
    },
    {
        "name": "cl2_ensemble", "label": "F. CL-2 Ensemble (7 classifiers)",
        "description": "7 calibrated classifiers from the CL-2 tier. Triple-barrier target (TP1-before-SL in 5 days).",
        "models": "LightGBM-A (CL-2), LightGBM-B (CL-2), HistGBM (CL-2), ExtraTrees (CL-2), RandomForest (CL-2), Logistic (CL-2), MLP (CL-2)",
    },
    {
        "name": "pi_ensemble", "label": "G. PI-Ensemble (4 models)",
        "description": "4 pattern & indicator models from the PI tier. Same support/ATR SL rule + TP1-before-SL target.",
        "models": "Linear Regression (PI), Logistic Regression (PI), Pattern Matcher KNN (PI), Neural Network (PI)",
    },
    {
        "name": "gm_model", "label": "H. GM-Model (4-Pillar)",
        "description": "4-Pillar Weighted Framework: Technical 35% + Announcements 30% + Fundamental 20% + Macro 15%.",
        "models": "Technical Engine (GM), Announcements Engine (GM), Fundamental Engine (GM), Macro Engine (GM)",
    },
    {
        "name": "cg_ensemble", "label": "I. CG-Ensemble (swing-trader)",
        "description": "Probability averaging of 2 swing-trading classifiers + decile calibration. Triple-barrier, 10-day horizon, TP1=1R.",
        "models": "LightGBM (CG), XGBoost (CG)",
    },
    {
        "name": "x_ensemble", "label": "J. X-Ensemble (10-strategy meta)",
        "description": "10 complementary strategies + LightGBM meta-labeling. 3-way split, purge+embargo, Platt+isotonic calibration.",
        "models": "Trend Multi-TF (X), Breakout RelVol (X), Trend Pullback (X), RSI Divergence (X), BB Mean Reversion (X), Vol Contraction (X), Relative Strength (X), Market Regime (X), Meta-Label CG (X), Triple Barrier Dyn (X)",
    },
    {
        "name": "gian_ensemble", "label": "K. Gian-Ensemble (S/R)",
        "description": "Square-root support/resistance with odd-number rule. BUY near S1/S2/S3, SELL near R1/R2/R3.",
        "models": "Gian-Ensemble (GIAN) — rule-based (square-root S/R)",
    },
    {
        "name": "gian_extender", "label": "L. Gian-Extender (GANN grid)",
        "description": "Fixed GANN square-of-9 levels (1, 9, 25, 49, 81, 121, 169, 225, 289, 361, ...). BUY below, SELL above.",
        "models": "Gian-Extender (GIAN-EXT) — rule-based (GANN square-of-9)",
    },
    {
        "name": "m_ensemble", "label": "M. M-Ensemble (price-touch S/R)",
        "description": "Historical price-touch S/R with ATR clustering. Scan all highs/lows, cluster within 1×ATR, pick top 3.",
        "models": "M-Ensemble (M) — rule-based (historical price-touch S/R)",
    },
]

# Color palette (dark theme to match the app)
C_BG = colors.HexColor("#0A0E1A")
C_FG = colors.HexColor("#F4F7FB")
C_MUTED = colors.HexColor("#94A3B8")
C_GREEN = colors.HexColor("#00E676")
C_RED = colors.HexColor("#FF5C5C")
C_AMBER = colors.HexColor("#FBBF24")
C_CARD = colors.HexColor("#131829")
C_BORDER = colors.HexColor("#1E293B")

# Styles
styles = getSampleStyleSheet()
H1 = ParagraphStyle("H1", parent=styles["Heading1"], textColor=C_FG, fontSize=20, spaceAfter=12, alignment=TA_LEFT, fontName="Helvetica-Bold")
H2 = ParagraphStyle("H2", parent=styles["Heading2"], textColor=C_GREEN, fontSize=14, spaceAfter=8, spaceBefore=16, alignment=TA_LEFT, fontName="Helvetica-Bold")
H3 = ParagraphStyle("H3", parent=styles["Heading3"], textColor=C_AMBER, fontSize=11, spaceAfter=6, spaceBefore=10, alignment=TA_LEFT, fontName="Helvetica-Bold")
BODY = ParagraphStyle("Body", parent=styles["BodyText"], textColor=C_FG, fontSize=9, spaceAfter=4, alignment=TA_LEFT, fontName="Helvetica")
SMALL = ParagraphStyle("Small", parent=BODY, fontSize=8, textColor=C_MUTED)
SMALL_MONO = ParagraphStyle("SmallMono", parent=BODY, fontSize=7.5, textColor=C_MUTED, fontName="Courier")
TBL_HDR = ParagraphStyle("TblHdr", parent=BODY, fontSize=8, textColor=colors.white, fontName="Helvetica-Bold", alignment=TA_CENTER)
TBL_CELL = ParagraphStyle("TblCell", parent=BODY, fontSize=8, textColor=C_FG, alignment=TA_CENTER, fontName="Helvetica")
TBL_CELL_L = ParagraphStyle("TblCellL", parent=TBL_CELL, alignment=TA_LEFT)
TBL_CELL_GREEN = ParagraphStyle("TblCellGreen", parent=TBL_CELL, textColor=C_GREEN, fontName="Helvetica-Bold")
TBL_CELL_RED = ParagraphStyle("TblCellRed", parent=TBL_CELL, textColor=C_RED, fontName="Helvetica-Bold")

def fmt(v, suffix=""):
    if v is None: return "—"
    if isinstance(v, float):
        return f"{v:.2f}{suffix}"
    return f"{v}{suffix}"

def stars_str(n):
    # Use filled stars + "-" for empty (avoids the ☆ glyph that Helvetica
    # doesn't have, which renders as a black box).
    return "★" * (n or 0) + "·" * (5 - (n or 0))

def metric_color(val, threshold=0, green_if_gt=True):
    if green_if_gt:
        return TBL_CELL_GREEN if val > threshold else (TBL_CELL_RED if val < threshold else TBL_CELL)
    return TBL_CELL_RED if val > threshold else (TBL_CELL_GREEN if val < threshold else TBL_CELL)

def build_individual_models_table():
    """Build a table of all 65 individual model backtest results."""
    # Sort by winRate desc
    rows = sorted(bt.items(), key=lambda x: -x[1].get("winRate", 0))
    header = [
        Paragraph("#", TBL_HDR),
        Paragraph("Model", TBL_HDR),
        Paragraph("Trades", TBL_HDR),
        Paragraph("Win%", TBL_HDR),
        Paragraph("Avg Ret%", TBL_HDR),
        Paragraph("PF", TBL_HDR),
        Paragraph("Sharpe", TBL_HDR),
        Paragraph("Sortino", TBL_HDR),
        Paragraph("Max DD%", TBL_HDR),
        Paragraph("★", TBL_HDR),
    ]
    data = [header]
    for i, (name, m) in enumerate(rows, 1):
        wr = m.get("winRate", 0)
        ar = m.get("avgReturnPct", 0)
        pf = m.get("profitFactor", 0)
        sh = m.get("sharpe", 0)
        so = m.get("sortino", 0)
        mdd = m.get("maxDrawdownPct", 0)
        st = m.get("stars", 0)
        # Color the win rate cell
        wr_style = TBL_CELL_GREEN if wr >= 50 else (TBL_CELL_RED if wr < 35 else TBL_CELL)
        data.append([
            Paragraph(str(i), TBL_CELL),
            Paragraph(name, TBL_CELL_L),
            Paragraph(str(m.get("totalTrades", 0)), TBL_CELL),
            Paragraph(f"{wr}", wr_style),
            Paragraph(fmt(ar), TBL_CELL_GREEN if ar > 0 else (TBL_CELL_RED if ar < 0 else TBL_CELL)),
            Paragraph(fmt(pf), TBL_CELL_GREEN if pf >= 1.3 else (TBL_CELL_RED if pf < 1.0 else TBL_CELL)),
            Paragraph(fmt(sh), TBL_CELL_GREEN if sh > 0 else (TBL_CELL_RED if sh < 0 else TBL_CELL)),
            Paragraph(fmt(so), TBL_CELL_GREEN if so > 0 else (TBL_CELL_RED if so < 0 else TBL_CELL)),
            Paragraph(fmt(mdd), TBL_CELL_RED if mdd > 50 else TBL_CELL),
            Paragraph(stars_str(st), TBL_CELL),
        ])
    col_widths = [8*mm, 55*mm, 14*mm, 14*mm, 18*mm, 12*mm, 16*mm, 16*mm, 18*mm, 22*mm]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_GREEN),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 0), (1, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_CARD, C_BG]),
        ("GRID", (0, 0), (-1, -1), 0.25, C_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

def build_ensemble_table():
    """Build a table of all 13 ensemble backtest results + composition."""
    # Sort by winRate desc
    rows = sorted(ebt.items(), key=lambda x: -x[1].get("winRate", 0))
    # Map name -> composition
    comp_map = {c["name"]: c for c in ENSEMBLE_COMPOSITION}
    header = [
        Paragraph("#", TBL_HDR),
        Paragraph("Ensemble", TBL_HDR),
        Paragraph("Models in Ensemble", TBL_HDR),
        Paragraph("Trades", TBL_HDR),
        Paragraph("Win%", TBL_HDR),
        Paragraph("PF", TBL_HDR),
        Paragraph("Sharpe", TBL_HDR),
        Paragraph("★", TBL_HDR),
    ]
    data = [header]
    for i, (name, m) in enumerate(rows, 1):
        wr = m.get("winRate", 0)
        pf = m.get("profitFactor", 0)
        sh = m.get("sharpe", 0)
        st = m.get("stars", 0)
        comp = comp_map.get(name, {})
        label = comp.get("label", name)
        models = comp.get("models", "—")
        wr_style = TBL_CELL_GREEN if wr >= 50 else (TBL_CELL_RED if wr < 35 else TBL_CELL)
        data.append([
            Paragraph(str(i), TBL_CELL),
            Paragraph(label, TBL_CELL_L),
            Paragraph(models, TBL_CELL_L),
            Paragraph(str(m.get("totalTrades", 0)), TBL_CELL),
            Paragraph(f"{wr}", wr_style),
            Paragraph(fmt(pf), TBL_CELL_GREEN if pf >= 1.3 else (TBL_CELL_RED if pf < 1.0 else TBL_CELL)),
            Paragraph(fmt(sh), TBL_CELL_GREEN if sh > 0 else (TBL_CELL_RED if sh < 0 else TBL_CELL)),
            Paragraph(stars_str(st), TBL_CELL),
        ])
    col_widths = [8*mm, 45*mm, 80*mm, 14*mm, 14*mm, 12*mm, 16*mm, 22*mm]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), C_AMBER),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("ALIGN", (1, 0), (2, -1), "LEFT"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTSIZE", (0, 0), (-1, 0), 8),
        ("FONTSIZE", (0, 1), (-1, -1), 7.5),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [C_CARD, C_BG]),
        ("GRID", (0, 0), (-1, -1), 0.25, C_BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

def build_ensemble_detail_sections():
    """Build one detail section per ensemble (label + description + models + stats)."""
    flowables = []
    for comp in ENSEMBLE_COMPOSITION:
        name = comp["name"]
        m = ebt.get(name, {})
        if not m:
            continue
        # Section heading
        flowables.append(Paragraph(comp["label"], H3))
        # Description
        flowables.append(Paragraph(f"<b>Description:</b> {comp['description']}", SMALL))
        # Models in the ensemble
        flowables.append(Paragraph(f"<b>Models in this ensemble:</b> {comp['models']}", SMALL))
        # Stats
        wr = m.get("winRate", 0)
        pf = m.get("profitFactor", 0)
        sh = m.get("sharpe", 0)
        so = m.get("sortino", 0)
        mdd = m.get("maxDrawdownPct", 0)
        st = m.get("stars", 0)
        tt = m.get("totalTrades", 0)
        ar = m.get("avgReturnPct", 0)
        stats_table = Table([[
            Paragraph(f"<b>Trades</b><br/>{tt}", TBL_CELL),
            Paragraph(f"<b>Win Rate</b><br/>{wr}%", TBL_CELL_GREEN if wr >= 50 else TBL_CELL),
            Paragraph(f"<b>Avg Return</b><br/>{ar}%", TBL_CELL_GREEN if ar > 0 else TBL_CELL_RED),
            Paragraph(f"<b>Profit Factor</b><br/>{pf}", TBL_CELL_GREEN if pf >= 1.3 else TBL_CELL),
            Paragraph(f"<b>Sharpe</b><br/>{sh}", TBL_CELL_GREEN if sh > 0 else TBL_CELL),
            Paragraph(f"<b>Sortino</b><br/>{so}", TBL_CELL_GREEN if so > 0 else TBL_CELL),
            Paragraph(f"<b>Max DD</b><br/>{mdd}%", TBL_CELL_RED if mdd > 50 else TBL_CELL),
            Paragraph(f"<b>Rating</b><br/>{stars_str(st)}", TBL_CELL),
        ]], colWidths=[22*mm]*8)
        stats_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), C_CARD),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.25, C_BORDER),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        flowables.append(stats_table)
        flowables.append(Spacer(1, 6))
    return flowables

def build_pdf():
    # Use landscape A4 for wider tables
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=landscape(A4),
        rightMargin=15*mm, leftMargin=15*mm,
        topMargin=15*mm, bottomMargin=15*mm,
        title="Latent.pk — Backtest Report (All Models + Ensembles)",
        author="Latent.pk",
        subject="AI Model + Ensemble Backtest Results",
        creator="Latent.pk PDF Generator",
    )
    story = []
    # Title
    story.append(Paragraph("Latent.pk — Backtest Report", H1))
    story.append(Paragraph("All 65 individual models + all 13 ensemble methods (A→M) with their model composition + comprehensive backtest stats.", BODY))
    story.append(Spacer(1, 6))
    trained_at = d.get("trained_at", "—")
    story.append(Paragraph(f"<b>Generated:</b> {trained_at}  |  <b>Trainable stocks:</b> 673 (60+ bars with volume&gt;0)  |  <b>DB stocks:</b> 908  |  <b>Models:</b> 65  |  <b>Ensembles:</b> 13", SMALL))
    story.append(Spacer(1, 10))

    # Section 1: Ensemble backtest results (table)
    story.append(Paragraph("Section 1 — Ensemble Backtest Results (13 methods, ranked by win rate)", H2))
    story.append(Paragraph("Each ensemble is a combination of one or more models. The 'Models in Ensemble' column lists all models that contribute to each ensemble's signal.", SMALL))
    story.append(Spacer(1, 4))
    story.append(build_ensemble_table())
    story.append(Spacer(1, 10))

    # Section 2: Ensemble detail (one per ensemble)
    story.append(PageBreak())
    story.append(Paragraph("Section 2 — Ensemble Composition + Detailed Stats", H2))
    story.append(Paragraph("Per-ensemble breakdown: description, the models that compose it, and the backtest stats.", SMALL))
    story.append(Spacer(1, 6))
    story.extend(build_ensemble_detail_sections())

    # Section 3: Individual model backtest results
    story.append(PageBreak())
    story.append(Paragraph("Section 3 — Individual Model Backtest Results (65 models, ranked by win rate)", H2))
    story.append(Paragraph("All 65 models trained on all 673 trainable stocks (60+ bars with volume&gt;0). Models that fail to train on a specific stock get a technical fallback signal (EMA/RSI/ATR) so every stock has all 65 model predictions.", SMALL))
    story.append(Spacer(1, 4))
    story.append(build_individual_models_table())

    # Build
    doc.build(story)
    print(f"✅ PDF generated: {OUT_PDF}")
    print(f"   Size: {OUT_PDF.stat().st_size / 1024:.1f} KB")

if __name__ == "__main__":
    build_pdf()
