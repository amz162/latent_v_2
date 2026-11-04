"use client";

// Task 110 — minimal dependency-free SVG line chart used by the Golden Cross
// and Volatility dashboards. Multi-series with optional buy/sell markers.

export interface Series {
  label: string;
  color: string;
  points: (number | null)[];
  dash?: boolean;
}

export interface Marker {
  x: number;
  price: number;
  kind: "BUY" | "SELL";
}

export function Task110Chart({
  dates,
  series,
  markers = [],
  height = 260,
  yLabel,
}: {
  dates: string[];
  series: Series[];
  markers?: Marker[];
  height?: number;
  yLabel?: string;
}) {
  const W = 960;
  const H = height;
  const padL = 54;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const n = Math.max(dates.length, 1);
  const all: number[] = [];
  for (const s of series) for (const v of s.points) if (v != null && Number.isFinite(v)) all.push(v);
  for (const m of markers) all.push(m.price);
  if (all.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
        no data in range
      </div>
    );
  }
  let min = Math.min(...all);
  let max = Math.max(...all);
  if (max - min < 1e-9) {
    max += 1;
    min -= 1;
  }
  const pad = (max - min) * 0.05;
  min -= pad;
  max += pad;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, n - 1);
  const y = (v: number) => padT + ((max - v) * (H - padT - padB)) / (max - min);
  const path = (pts: (number | null)[]) => {
    let d = "";
    let pen = false;
    pts.forEach((v, i) => {
      if (v == null || !Number.isFinite(v)) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => min + f * (max - min));
  const xt = [0, Math.floor(n / 2), n - 1].filter((i) => i >= 0 && i < n);
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[560px]" role="img" aria-label={yLabel || "chart"}>
        {ticks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} />
            <text x={padL - 6} y={y(v) + 3.5} textAnchor="end" fontSize={10} fill="currentColor" fillOpacity={0.6}>
              {formatTick(v)}
            </text>
          </g>
        ))}
        {xt.map((i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.6}>
            {dates[i]}
          </text>
        ))}
        {series.map((s, si) => (
          <path key={si} d={path(s.points)} fill="none" stroke={s.color} strokeWidth={1.6} strokeDasharray={s.dash ? "4 3" : undefined} />
        ))}
        {markers.map((m, mi) => (
          <g key={mi}>
            <path
              d={m.kind === "BUY" ? "M0,-5 L5,3 L-5,3 Z" : "M0,5 L5,-3 L-5,-3 Z"}
              transform={`translate(${x(m.x)},${y(m.price)})`}
              fill={m.kind === "BUY" ? "#16a34a" : "#dc2626"}
            />
          </g>
        ))}
        {series.length > 1 && (
          <g>
            {series.map((s, si) => (
              <g key={si} transform={`translate(${padL + 8 + si * 150},${padT + 12})`}>
                <rect width={10} height={3} y={-3} fill={s.color} />
                <text x={14} y={2} fontSize={10.5} fill="currentColor" fillOpacity={0.8}>
                  {s.label}
                </text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}

function formatTick(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + "M";
  if (a >= 1e3) return (v / 1e3).toFixed(1) + "k";
  if (a >= 10) return v.toFixed(0);
  return v.toFixed(2);
}
