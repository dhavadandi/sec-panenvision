import React, { useState, useMemo, useCallback } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Bar, Cell,
} from "recharts";
import {
  Activity, AlertTriangle, ArrowRight, Bell, Bookmark, Compass,
  Cpu, Database, Download, FileText, Gauge, Layers, Map as MapIcon, Moon, Network,
  Search, Share2, Shield, Sliders, Sprout, Sun, TrendingDown, TrendingUp, Truck, X,
} from "lucide-react";

import { C, COMMODITY_COLOR, FONT, statusColor, applyTheme, type ThemeMode } from "./theme";
import {
  COMMODITIES, MONTHS, DISTRICT, CENTROIDS,
  type DistrictRow,
} from "../data/generated";
import { JATENG_SHAPES, MAP_W, MAP_H } from "../data/geo";
import {
  districtViews, recViews, kpis, prevMonth, monthlyTrend,
  networkSummary, distanceInsight, scenarioBalance,
  fmtTon, fmtTonFull, fmtRp, fmtPct, fmtKm, NA, isNum, monthLabel, monthShort,
  regionalBalance, commoditiesWithRoutes,
  type Scenario, type DistrictView, type RecView, type RegionBalance,
} from "../data/selectors";

// ════════════════════════════════════════════════════════════════════
// GLOBAL STYLE
// ════════════════════════════════════════════════════════════════════
function GlobalStyle() {
  return (
    <style>{`
      *{box-sizing:border-box}
      body{margin:0;background:${C.bg};color:${C.text};font-family:${FONT.body};
        -webkit-font-smoothing:antialiased;}
      ::selection{background:${C.teal}40}
      ::-webkit-scrollbar{width:9px;height:9px}
      ::-webkit-scrollbar-track{background:${C.bg}}
      ::-webkit-scrollbar-thumb{background:${C.border};border-radius:6px}
      ::-webkit-scrollbar-thumb:hover{background:#2a3a54}
      select,input,button{font-family:inherit}
      select{appearance:none;-webkit-appearance:none}
      .pv-select{background:${C.surface2};border:1px solid ${C.border};color:${C.text};
        border-radius:6px;padding:7px 30px 7px 11px;font-size:12px;font-family:${FONT.mono};
        cursor:pointer;outline:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>");
        background-repeat:no-repeat;background-position:right 9px center}
      .pv-select:hover{border-color:${C.teal}66}
      .pv-tab{cursor:pointer;padding:7px 14px;border-radius:7px;font-size:12.5px;
        font-family:${FONT.head};font-weight:500;color:${C.textSec};transition:.15s}
      .pv-tab:hover{color:${C.text};background:${C.surface2}}
      .pv-tab.active{color:${C.bg};background:${C.teal}}
      .pv-card{background:${C.surface};border:1px solid ${C.border};border-radius:10px}
      .pv-ico{cursor:pointer;color:${C.textSec};transition:.15s}
      .pv-ico:hover{color:${C.teal}}
      .pv-row:hover{background:${C.surface2}}
      @keyframes pvpulse{0%,100%{opacity:.55}50%{opacity:1}}
      @keyframes pvdash{to{stroke-dashoffset:-16}}
      .pv-flow{stroke-dasharray:5 4;animation:pvdash 1.1s linear infinite}
      .pv-blink{animation:pvpulse 1.8s ease-in-out infinite}
      .pv-seg{cursor:pointer;padding:5px 12px;font-size:11.5px;font-family:${FONT.mono};
        transition:.15s;border:none}
    `}</style>
  );
}

// ════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════
const mono = (size: number, weight = 500): React.CSSProperties =>
  ({ fontFamily: FONT.mono, fontSize: size, fontWeight: weight });
const head = (size: number, weight = 600): React.CSSProperties =>
  ({ fontFamily: FONT.head, fontSize: size, fontWeight: weight });

function Label({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <p style={{ ...mono(10, 500), color: C.muted, letterSpacing: "0.14em",
      textTransform: "uppercase", margin: 0, ...style }}>{children}</p>
  );
}

function Card({ title, right, children, pad = 16, style, titleIcon }:
  { title?: string; right?: React.ReactNode; children: React.ReactNode;
    pad?: number; style?: React.CSSProperties; titleIcon?: React.ReactNode }) {
  return (
    <div className="pv-card" style={{ display: "flex", flexDirection: "column", ...style }}>
      {title && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "11px 16px", borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {titleIcon}
            <Label>{title}</Label>
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: pad, flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Badge({ status }: { status: "surplus" | "deficit" | "watchlist" }) {
  const color = statusColor(status);
  const label = status === "surplus" ? "Surplus" : status === "deficit" ? "Defisit" : "Watchlist";
  return (
    <span style={{ ...mono(10, 600), color, background: `${color}1f`,
      border: `1px solid ${color}40`, padding: "2px 8px", borderRadius: 5,
      whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{label}</span>
  );
}

function PriorityTag({ p }: { p: RecView["priority"] }) {
  const color = p === "HIGH" ? C.coral : p === "MEDIUM" ? C.amber : C.muted;
  return (
    <span style={{ ...mono(9.5, 700), color, background: `${color}1c`,
      border: `1px solid ${color}40`, padding: "2px 7px", borderRadius: 4 }}>{p}</span>
  );
}

function classify(balance: number, band: number): "surplus" | "deficit" | "watchlist" {
  if (balance > band) return "surplus";
  if (balance < -band) return "deficit";
  return "watchlist";
}

/**
 * Operational status used for map colour. The MILP distribution is computed on
 * the ROBUST neraca (surplus_aman / defisit_robust), so a city that the plan
 * SUPPLIES (terima>0 / defisit_robust>0) is a deficit point even if its median
 * (P50) balance is positive. Colouring by role keeps arrows consistent with
 * node colours (no "surplus city" ever receives an arrow).
 */
function nodeStatus(v: DistrictView, scenario: Scenario, band: number): "surplus" | "deficit" | "watchlist" {
  if (v.terima > 0) return "deficit";   // operationally supplied -> deficit point (robust)
  if (v.kirim > 0) return "surplus";    // active supplier in the MILP plan
  return classify(scenarioBalance(v, scenario), band); // others follow the quantile view
}

function Row({ k, val, c }: { k: string; val: string; c?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ ...mono(10.5), color: C.textSec }}>{k}</span>
      <span style={{ ...mono(10.5, 600), color: c ?? C.text, textAlign: "right" }}>{val}</span>
    </div>
  );
}

function Mini({ k, v, c }: { k: string; v: string; c?: string }) {
  return (
    <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "9px 11px" }}>
      <p style={{ ...mono(9, 500), color: C.muted, margin: 0, textTransform: "uppercase", letterSpacing: ".06em" }}>{k}</p>
      <p style={{ ...mono(13.5, 600), color: c ?? C.text, margin: "4px 0 0" }}>{v}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════════════
function KpiCard({ label, value, unit, sub, trend, color, tip, confidence }:
  { label: string; value: string; unit?: string; sub?: string;
    trend?: "up" | "down" | null; color?: string; tip?: string; confidence?: number | null }) {
  return (
    <div className="pv-card" style={{ padding: "13px 15px", display: "flex",
      flexDirection: "column", gap: 6, position: "relative", overflow: "hidden", minWidth: 0 }} title={tip}>
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%",
        background: color ?? C.teal, opacity: 0.85 }} />
      <Label style={{ fontSize: 9.5 }}>{label}</Label>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <span style={{ ...mono(20, 700), color: color ?? C.text, lineHeight: 1,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
        {unit && <span style={{ ...mono(10.5), color: C.muted }}>{unit}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ ...mono(9.5), color: C.textSec, display: "flex", alignItems: "center", gap: 4 }}>
          {trend === "up" && <TrendingUp size={11} color={C.emerald} />}
          {trend === "down" && <TrendingDown size={11} color={C.coral} />}
          {sub}
        </span>
        {isNum(confidence) && (
          <span style={{ display: "flex", gap: 2, flexShrink: 0 }} title={`Confidence ${confidence}/5`}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{ width: 4, height: 9, borderRadius: 2,
                background: i <= (confidence as number) ? (color ?? C.teal) : C.border }} />
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CONTROL TOWER MAP
// ════════════════════════════════════════════════════════════════════
interface TT { x: number; y: number; node: React.ReactNode }

function ControlTowerMap({ commodity, scenario, views, recs, onSelect }:
  { commodity: string; scenario: Scenario; views: DistrictView[]; recs: RecView[]; onSelect: (k: string) => void }) {
  const [tt, setTt] = useState<TT | null>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  const nodeCoord = useMemo(() => {
    const m: Record<string, { x: number; y: number }> = {};
    JATENG_SHAPES.forEach(s => { m[s.kab] = { x: s.cx, y: s.cy }; });
    return m;
  }, []);

  const balByKab = useMemo(() => {
    const m = new Map<string, DistrictView>();
    views.forEach(v => m.set(v.kab, v));
    return m;
  }, [views]);

  const maxAbs = useMemo(() =>
    Math.max(1, ...views.map(v => Math.abs(scenarioBalance(v, scenario)))), [views, scenario]);
  const band = Math.max(5, maxAbs * 0.012);
  // node size reflects the larger of the quantile balance or its distribution role
  const maxMag = useMemo(() =>
    Math.max(1, ...views.map(v => Math.max(Math.abs(scenarioBalance(v, scenario)), v.kirim, v.terima))), [views, scenario]);
  const maxTon = useMemo(() => Math.max(1, ...recs.map(r => r.kirimTon)), [recs]);

  const place = (e: React.MouseEvent, node: React.ReactNode) => {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTt({ x: ((e.clientX - rect.left) / rect.width) * MAP_W,
      y: ((e.clientY - rect.top) / rect.height) * MAP_H, node });
  };

  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}
      onMouseLeave={() => setTt(null)}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} style={{ width: "100%", display: "block" }}>
        <defs>
          <marker id="pv-arrow" markerWidth="7" markerHeight="7" refX="5.5" refY="3"
            orient="auto" markerUnits="userSpaceOnUse">
            <path d="M0,0 L6,3 L0,6 Z" fill={C.mapRoute} />
          </marker>
          <radialGradient id="pv-sea" cx="50%" cy="0%" r="120%">
            <stop offset="0%" stopColor={C.sea} />
            <stop offset="100%" stopColor={C.bg} />
          </radialGradient>
        </defs>
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="url(#pv-sea)" />

        {/* kabupaten polygons */}
        {JATENG_SHAPES.map(s => {
          const v = balByKab.get(s.kab);
          const bal = v ? scenarioBalance(v, scenario) : 0;
          const st = v ? nodeStatus(v, scenario, band) : "watchlist";
          const col = statusColor(st);
          if (!s.d) return null;
          return (
            <path key={s.kab} d={s.d} fill={col} fillOpacity={0.16}
              stroke={col} strokeOpacity={0.5} strokeWidth={0.8}
              style={{ cursor: "pointer", transition: "fill-opacity .15s" }}
              onClick={() => onSelect(s.kab)}
              onMouseMove={(e) => place(e, <NodeTip v={v} bal={bal} st={st} commodity={commodity} />)}
              onMouseEnter={(e) => { e.currentTarget.style.fillOpacity = "0.34"; }}
              onMouseOut={(e) => { e.currentTarget.style.fillOpacity = "0.16"; }}
            />
          );
        })}

        {/* distribution routes */}
        {recs.map((r, i) => {
          const a = nodeCoord[r.asal], b = nodeCoord[r.tujuan];
          if (!a || !b) return null;
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const mx = (a.x + b.x) / 2 - (dy / len) * len * 0.16;
          const my = (a.y + b.y) / 2 + (dx / len) * len * 0.16;
          const w = 0.8 + 5 * (r.kirimTon / maxTon);
          return (
            <path key={i} d={`M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`}
              fill="none" stroke={C.mapRoute} strokeWidth={w} strokeOpacity={0.7}
              className="pv-flow" markerEnd="url(#pv-arrow)" style={{ cursor: "pointer" }}
              onMouseMove={(e) => place(e, <RouteTip r={r} />)} />
          );
        })}

        {/* nodes */}
        {JATENG_SHAPES.map(s => {
          const v = balByKab.get(s.kab);
          if (!v) return null;
          const bal = scenarioBalance(v, scenario);
          const st = nodeStatus(v, scenario, band);
          const col = statusColor(st);
          const mag = Math.max(Math.abs(bal), v.kirim, v.terima);
          const rad = 3.5 + 16 * Math.sqrt(mag / maxMag);
          return (
            <g key={s.kab} style={{ cursor: "pointer" }} onClick={() => onSelect(s.kab)}
              onMouseMove={(e) => place(e, <NodeTip v={v} bal={bal} st={st} commodity={commodity} />)}>
              <circle cx={s.cx} cy={s.cy} r={rad + 2.5} fill={col} fillOpacity={0.14} />
              <circle cx={s.cx} cy={s.cy} r={rad} fill={col} fillOpacity={0.9}
                stroke={C.bg} strokeWidth={0.8} />
            </g>
          );
        })}

        <text x={MAP_W / 2} y={18} textAnchor="middle" style={{ ...mono(11), fill: "#33415c" }}>LAUT JAWA</text>
        <text x={MAP_W / 2} y={MAP_H - 8} textAnchor="middle" style={{ ...mono(11), fill: "#33415c" }}>SAMUDERA HINDIA</text>
      </svg>

      {tt && (
        <div style={{ position: "absolute", left: `${Math.min((tt.x / MAP_W) * 100, 72)}%`,
          top: `${(tt.y / MAP_H) * 100}%`, transform: "translateY(10px)", pointerEvents: "none", zIndex: 20,
          background: C.tooltip, border: `1px solid ${C.border}`, borderRadius: 8,
          padding: "9px 11px", boxShadow: "0 12px 30px rgba(0,0,0,.5)", maxWidth: 240 }}>
          {tt.node}
        </div>
      )}
    </div>
  );
}

function NodeTip({ v, bal, st, commodity }:
  { v: DistrictView | undefined; bal: number; st: "surplus" | "deficit" | "watchlist"; commodity: string }) {
  if (!v) return <span style={{ ...mono(11), color: C.muted }}>{NA}</span>;
  const robustSupplied = v.terima > 0 && v.sP50 >= 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 2 }}>
        <span style={{ ...head(13), color: C.text }}>{v.kab}</span>
        <Badge status={st} />
      </div>
      <Row k="Surplus P10" val={fmtTon(v.sP10, true)} c={v.sP10 >= 0 ? C.emerald : C.coral} />
      <Row k="Surplus P50" val={fmtTon(v.sP50, true)} c={v.sP50 >= 0 ? C.emerald : C.coral} />
      <Row k="Surplus P90" val={fmtTon(v.sP90, true)} c={v.sP90 >= 0 ? C.emerald : C.coral} />
      <div style={{ height: 1, background: C.borderSoft, margin: "3px 0" }} />
      <Row k={commodity === "Padi" ? "Produksi setara (beras)" : "Produksi (setara)"} val={fmtTonFull(v.produksiSetara)} />
      <Row k="Konsumsi" val={fmtTonFull(v.konsumsi)} />
      {v.surplusAman > 0 && <Row k="Surplus aman (robust)" val={fmtTonFull(v.surplusAman)} c={C.emerald} />}
      {v.defisitRobust > 0 && <Row k="Defisit robust" val={fmtTonFull(v.defisitRobust)} c={C.coral} />}
      {v.kirim > 0 && <Row k="Kirim keluar" val={fmtTonFull(v.kirim)} c={C.sky} />}
      {v.terima > 0 && <Row k="Terima (disuplai)" val={fmtTonFull(v.terima)} c={C.violet} />}
      {robustSupplied && (
        <span style={{ ...mono(9), color: C.amber, marginTop: 3, lineHeight: 1.4, maxWidth: 210, display: "block" }}>
          Surplus pada median (P50) namun defisit pada skenario robust → tetap dipasok MILP.
        </span>
      )}
      <span style={{ ...mono(9), color: C.muted, marginTop: 2 }}>Klik untuk detail →</span>
    </div>
  );
}

function RouteTip({ r }: { r: RecView }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ ...head(12), color: C.text }}>{r.asal}</span>
        <ArrowRight size={12} color={C.mapRoute} />
        <span style={{ ...head(12), color: C.text }}>{r.tujuan}</span>
      </div>
      <Row k="Tonase" val={`${fmtTonFull(r.kirimTon)} ton`} c={C.mapRoute} />
      <Row k="Jarak" val={fmtKm(r.jarakKm)} />
      <Row k="Biaya distribusi" val={fmtRp(r.biayaRp)} />
      <Row k="Pemenuhan" val={r.coveragePct === null ? NA : fmtPct(r.coveragePct, 0)} />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// REGIONAL DETAIL DRAWER
// ════════════════════════════════════════════════════════════════════
function RegionalDrawer({ kab, commodity, month, scenario, onClose }:
  { kab: string; commodity: string; month: string; scenario: Scenario; onClose: () => void }) {
  const series = useMemo(() =>
    MONTHS.map(m => {
      const row = DISTRICT.find(r => r[0] === kab && r[1] === commodity && r[2] === m) as DistrictRow | undefined;
      return { label: monthShort(m), p50: row ? (row[7] as number) : 0 };
    }), [kab, commodity]);

  const cur = useMemo(() =>
    districtViews(commodity, month).find(v => v.kab === kab) ?? null, [kab, commodity, month]);
  const bal = cur ? scenarioBalance(cur, scenario) : null;

  const partner = useMemo(() => {
    const rel = recViews(commodity, month).filter(r => r.asal === kab || r.tujuan === kab)
      .sort((a, b) => b.kirimTon - a.kirimTon);
    return rel[0] ?? null;
  }, [kab, commodity, month]);

  const nearest = useMemo(() => {
    const c0 = CENTROIDS[kab];
    if (!c0) return { sup: null as { kab: string; d: number } | null, rec: null as { kab: string; d: number } | null };
    const views = districtViews(commodity, month);
    const hv = (b: readonly [number, number]) => {
      const R0 = 6371, rad = Math.PI / 180;
      const dLat = (b[1] - c0[1]) * rad, dLon = (b[0] - c0[0]) * rad;
      const h = Math.sin(dLat / 2) ** 2 + Math.cos(c0[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
      return 2 * R0 * Math.asin(Math.sqrt(h));
    };
    const sup = views.filter(v => v.kab !== kab && v.surplusAman > 0 && CENTROIDS[v.kab])
      .map(v => ({ kab: v.kab, d: hv(CENTROIDS[v.kab]) })).sort((a, b) => a.d - b.d);
    const rec = views.filter(v => v.kab !== kab && v.sP50 < 0 && CENTROIDS[v.kab])
      .map(v => ({ kab: v.kab, d: hv(CENTROIDS[v.kab]) })).sort((a, b) => a.d - b.d);
    return { sup: sup[0] ?? null, rec: rec[0] ?? null };
  }, [kab, commodity, month]);

  const st = bal === null ? "watchlist" : classify(bal, 5);
  const isSupplier = !!cur && cur.kirim > 0;
  const isReceiver = !!cur && cur.terima > 0;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: C.overlay, backdropFilter: "blur(2px)" }} />
      <div style={{ position: "relative", width: 420, maxWidth: "92vw", height: "100%",
        background: C.surface, borderLeft: `1px solid ${C.border}`, overflowY: "auto",
        boxShadow: "-20px 0 50px rgba(0,0,0,.5)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 18px", borderBottom: `1px solid ${C.border}`, position: "sticky", top: 0,
          background: C.surface, zIndex: 2 }}>
          <div>
            <Label>Regional Detail · {commodity} · {monthLabel(month)}</Label>
            <p style={{ ...head(19, 700), color: C.text, margin: "5px 0 0" }}>{kab}</p>
          </div>
          <X size={20} className="pv-ico" onClick={onClose} />
        </div>

        {!cur ? (
          <div style={{ padding: 20, ...mono(13), color: C.muted }}>Data Not Available</div>
        ) : (
          <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Badge status={st} />
              <span style={{ ...mono(14, 700), color: (bal as number) >= 0 ? C.emerald : C.coral }}>
                {fmtTon(bal, true)} ton</span>
              <span style={{ ...mono(10), color: C.muted }}>neraca {scenario}</span>
            </div>

            {/* Forecast per quantile — distinct P10/P50/P90. Synced to dashboard_data.csv */}
            <div>
              <Label style={{ marginBottom: 8 }}>Forecast per Kuantil · {monthLabel(month)} · {commodity === "Padi" ? "satuan beras (gabah × 0.571)" : "satuan setara konsumsi"}</Label>
              <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Kuantil", commodity === "Padi" ? "Produksi (beras)" : "Produksi (setara)", "Surplus"].map((h, i) => (
                        <th key={h} style={{ ...mono(9, 600), color: C.muted, textTransform: "uppercase",
                          letterSpacing: ".06em", textAlign: i === 0 ? "left" : "right",
                          padding: "7px 11px", borderBottom: `1px solid ${C.border}` }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {([["P10", cur.produksiSetaraP10, cur.sP10],
                       ["P50", cur.produksiSetara, cur.sP50],
                       ["P90", cur.produksiSetaraP90, cur.sP90]] as [string, number, number][]).map(([q, prod, sur]) => (
                      <tr key={q} style={{ background: q === scenario ? `${C.teal}14` : "transparent",
                        borderTop: q !== "P10" ? `1px solid ${C.borderSoft}` : "none" }}>
                        <td style={{ ...mono(11, q === scenario ? 700 : 500), color: q === scenario ? C.teal : C.textSec, padding: "7px 11px" }}>
                          {q}{q === scenario ? " ◂" : ""}</td>
                        <td style={{ ...mono(11.5, 600), color: C.text, textAlign: "right", padding: "7px 11px" }}>{fmtTonFull(prod)}</td>
                        <td style={{ ...mono(11.5, 600), color: sur >= 0 ? C.emerald : C.coral, textAlign: "right", padding: "7px 11px" }}>{fmtTon(sur, true)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <Mini k="Forecast Konsumsi" v={`${fmtTonFull(cur.konsumsi)} t`} />
              {Math.abs(cur.produksi - cur.produksiSetara) > 1
                ? <Mini k="Produksi Gabah (asli)" v={`${fmtTonFull(cur.produksi)} t`} />
                : <Mini k="Rendemen" v="1.0 (palawija)" />}
              <Mini k="Surplus Aman (robust)" v={`${fmtTonFull(cur.surplusAman)} t`} c={C.emerald} />
              <Mini k="Defisit Robust (robust)" v={`${fmtTonFull(cur.defisitRobust)} t`} c={C.coral} />
              <Mini k="Kirim Keluar" v={cur.kirim > 0 ? `${fmtTonFull(cur.kirim)} t` : NA} c={C.sky} />
              <Mini k="Terima" v={cur.terima > 0 ? `${fmtTonFull(cur.terima)} t` : NA} c={C.violet} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <RoleChip on={isSupplier} label="Supplier" color={C.sky} />
              <RoleChip on={isReceiver} label="Receiver" color={C.violet} />
              <RoleChip on={!isSupplier && !isReceiver} label="Self-sufficient" color={C.muted} />
            </div>

            <div>
              <Label style={{ marginBottom: 8 }}>Historical Forecast Trend (Surplus P50)</Label>
              <div style={{ height: 90 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                    <ReferenceLine y={0} stroke={C.border} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: C.muted, fontFamily: FONT.mono } as object} axisLine={false} tickLine={false} />
                    <Bar dataKey="p50" radius={[2, 2, 0, 0]}>
                      {series.map((d, i) => (
                        <Cell key={i} fill={d.p50 >= 0 ? C.emerald : C.coral} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Label>Distribution & Distance</Label>
              <Row k="Top Distribution Partner" c={C.text}
                val={partner ? `${partner.asal} → ${partner.tujuan}` : NA} />
              {partner && <Row k="Partner Volume / Distance"
                val={`${fmtTonFull(partner.kirimTon)} t · ${fmtKm(partner.jarakKm)}`} />}
              <Row k="Closest Surplus Source"
                val={nearest.sup ? `${nearest.sup.kab} (${nearest.sup.d.toFixed(1)} km)` : NA} c={C.emerald} />
              <Row k="Closest Deficit Receiver"
                val={nearest.rec ? `${nearest.rec.kab} (${nearest.rec.d.toFixed(1)} km)` : NA} c={C.coral} />
            </div>

            <div style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 8, padding: 12 }}>
              <Label style={{ marginBottom: 6 }}>Recommendation</Label>
              <p style={{ ...mono(11.5), color: C.textSec, lineHeight: 1.6, margin: 0 }}>
                {recommendationText(cur, bal as number, isSupplier, isReceiver, nearest)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function recommendationText(v: DistrictView, bal: number, sup: boolean, rec: boolean,
  nearest: { sup: { kab: string; d: number } | null; rec: { kab: string; d: number } | null }): string {
  if (bal >= 0 && sup)
    return `${v.kab} surplus ${fmtTonFull(bal)} ton — alokasikan ${fmtTonFull(v.kirim)} ton ke wilayah defisit terdekat${nearest.rec ? ` (mis. ${nearest.rec.kab}, ${nearest.rec.d.toFixed(0)} km)` : ""}.`;
  if (bal >= 0)
    return `${v.kab} surplus ${fmtTonFull(bal)} ton namun belum terhubung rute optimal — siapkan sebagai cadangan penyangga regional.`;
  if (rec)
    return `${v.kab} defisit ${fmtTonFull(-bal)} ton — transfer masuk ${fmtTonFull(v.terima)} ton sudah direkomendasikan${nearest.sup ? ` dari sumber terdekat ${nearest.sup.kab} (${nearest.sup.d.toFixed(0)} km)` : ""}.`;
  return `${v.kab} defisit ${fmtTonFull(-bal)} ton — aktifkan transfer dari ${nearest.sup ? `${nearest.sup.kab} (${nearest.sup.d.toFixed(0)} km)` : "sumber surplus terdekat"} atau siapkan pasokan luar provinsi.`;
}

function RoleChip({ on, label, color }: { on: boolean; label: string; color: string }) {
  return (
    <span style={{ ...mono(10, 600), padding: "4px 10px", borderRadius: 6,
      color: on ? color : C.muted, background: on ? `${color}18` : "transparent",
      border: `1px solid ${on ? color + "40" : C.border}`, opacity: on ? 1 : 0.5 }}>{label}</span>
  );
}

// ════════════════════════════════════════════════════════════════════
// COMMAND CENTER
// ════════════════════════════════════════════════════════════════════
function CommandCenter({ commodity, month, scenario, exec, onSelectKab }:
  { commodity: string; month: string; scenario: Scenario; exec: boolean;
    onSelectKab: (k: string) => void }) {
  const views = useMemo(() => districtViews(commodity, month), [commodity, month]);
  const recs = useMemo(() => recViews(commodity, month), [commodity, month]);
  const k = useMemo(() => kpis(commodity, month, scenario), [commodity, month, scenario]);
  const net = useMemo(() => networkSummary(commodity, month), [commodity, month]);
  const dist = useMemo(() => distanceInsight(commodity, month), [commodity, month]);
  const trend = useMemo(() => monthlyTrend(commodity, MONTHS), [commodity]);

  const pm = prevMonth(month, MONTHS);
  const kPrev = useMemo(() => pm ? kpis(commodity, pm, scenario) : null, [commodity, pm, scenario]);
  const surplusTrend = kPrev ? (k.totalSurplus >= kPrev.totalSurplus ? "up" : "down") : null;
  const deficitTrend = kPrev ? (k.totalDeficit <= kPrev.totalDeficit ? "up" : "down") : null;

  const externalNeeded = isNum(k.externalSupply) && (k.externalSupply as number) > 0;
  const deficitExceeds = k.totalDeficit > k.totalSurplus;

  const conf = useMemo(() => {
    const tot = views.reduce((a, v) => {
      a.p50 += Math.abs(v.sP50); a.band += Math.abs(v.sP90 - v.sP10); return a;
    }, { p50: 0, band: 0 });
    if (tot.p50 === 0) return 3;
    const ratio = tot.band / (tot.p50 * 2);
    return Math.max(1, Math.min(5, Math.round(5 - ratio * 3)));
  }, [views]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 12 }}>
        <KpiCard label="Total Surplus" value={fmtTon(k.totalSurplus)} unit="ton"
          sub={`${k.nSurplus} kab surplus`} trend={surplusTrend} color={C.emerald}
          confidence={conf} tip={`Σ neraca positif ${scenario} (${monthLabel(month)})`} />
        <KpiCard label="Total Deficit" value={fmtTon(k.totalDeficit)} unit="ton"
          sub={`${k.nDeficit} kab defisit`} trend={deficitTrend} color={C.coral}
          confidence={conf} tip={`Σ neraca negatif ${scenario}`} />
        <KpiCard label="Local Fulfillment" value={fmtPct(k.localFulfillmentPct, 0)}
          sub="pemenuhan lokal MILP" color={C.teal} tip="dashboard_ringkasan.pemenuhan_lokal_pct" />
        <KpiCard label="External Supply Req." value={fmtTon(k.externalSupply)} unit="ton"
          sub={externalNeeded ? "impor luar provinsi" : "tidak diperlukan"}
          color={externalNeeded ? C.amber : C.muted} tip="impor_luar_ton (MILP)" />
        <KpiCard label="Critical Commodity" value={k.criticalCommodity?.name ?? NA}
          sub={k.criticalCommodity ? `defisit ${fmtTon(k.criticalCommodity.deficit)} t` : ""}
          color={C.coral} tip={`Komoditas defisit terbesar · ${monthLabel(month)}`} />
        <KpiCard label="Critical Region" value={k.criticalRegion?.name ?? NA}
          sub={k.criticalRegion ? `${fmtTon(k.criticalRegion.balance, true)} t` : ""}
          color={C.coral} tip={`${commodity} · neraca terburuk ${scenario}`} />
      </div>

      {/* MAP + RIGHT RAIL */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.95fr) minmax(0,1fr)", gap: 14 }}>
        <Card titleIcon={<MapIcon size={13} color={C.teal} />}
          title="Central Java Food Security Control Tower" right={<MapLegend />} pad={10}>
          <p style={{ ...mono(10), color: C.muted, margin: "0 0 2px 6px" }}>
            Forecast {commodity} · {monthLabel(month)} · Skenario {scenario} — Neraca Pasokan & Jaringan Distribusi
          </p>
          <p style={{ ...mono(9), color: C.muted, margin: "0 0 6px 6px", opacity: 0.8 }}>
            Warna node = peran distribusi robust MILP (merah = penerima pasokan / defisit robust, hijau = pemasok). Ukuran ∝ besaran neraca.
          </p>
          <ControlTowerMap commodity={commodity} scenario={scenario} views={views} recs={recs} onSelect={onSelectKab} />
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(externalNeeded || deficitExceeds) && (
            <div className="pv-card" style={{ borderColor: `${C.critical}66`, background: `${C.critical}0d`, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <AlertTriangle size={16} color={C.critical} className="pv-blink" />
                <span style={{ ...head(13, 700), color: C.critical }}>External Supply Required</span>
              </div>
              <p style={{ ...mono(11), color: C.textSec, lineHeight: 1.6, margin: "0 0 8px" }}>
                Pasokan lokal tidak cukup memenuhi proyeksi permintaan {commodity}.
              </p>
              <Row k="Remaining Deficit" c={C.critical}
                val={externalNeeded ? `${fmtTonFull(k.externalSupply)} ton`
                  : `${fmtTonFull(k.totalDeficit - k.totalSurplus)} ton`} />
              <Row k="Affected Commodity" val={commodity} />
              <Row k="Recommended Action" val="Impor luar provinsi" c={C.amber} />
              <Row k="Priority" val="Critical" c={C.critical} />
            </div>
          )}

          <Card titleIcon={<Truck size={13} color={C.teal} />} title="Recommended Supply Transfers"
            pad={0} style={{ maxHeight: 330 }}>
            <div style={{ overflowY: "auto", maxHeight: 290 }}>
              {recs.length === 0 ? (
                <p style={{ ...mono(11), color: C.muted, padding: 16 }}>
                  Data Not Available — tidak ada rute distribusi untuk {commodity} {monthLabel(month)}.
                </p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>
                    {["#", "Origin → Destination", "Dist", "Volume", "Cover"].map(h => (
                      <th key={h} style={{ ...mono(9, 500), color: C.muted, textAlign: "left",
                        padding: "8px 10px", borderBottom: `1px solid ${C.border}`,
                        textTransform: "uppercase", position: "sticky", top: 0, background: C.surface }}>{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {recs.slice(0, 12).map((r, i) => (
                      <tr key={i} className="pv-row" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                        <td style={{ padding: "7px 10px" }}><PriorityTag p={r.priority} /></td>
                        <td style={{ padding: "7px 10px", ...mono(10.5), color: C.text }}>
                          {r.asal} <span style={{ color: C.mapRoute }}>→</span> {r.tujuan}</td>
                        <td style={{ padding: "7px 10px", ...mono(10), color: C.textSec }}>{fmtKm(r.jarakKm)}</td>
                        <td style={{ padding: "7px 10px", ...mono(10.5, 600), color: C.mapRoute }}>{fmtTonFull(r.kirimTon)}</td>
                        <td style={{ padding: "7px 10px", ...mono(10), color: C.textSec }}>
                          {r.coveragePct === null ? NA : fmtPct(r.coveragePct, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {!exec && <AIInsight commodity={commodity} month={month} k={k} net={net} conf={conf} />}
        </div>
      </div>

      {!exec && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <DistanceInsightCard d={dist} commodity={commodity} />
          <NetworkSummaryCard net={net} />
        </div>
      )}

      {exec && <AIInsight commodity={commodity} month={month} k={k} net={net} conf={conf} />}

      <ForecastTrend commodity={commodity} trend={trend} />
    </div>
  );
}

function MapLegend() {
  const items: [string, string][] = [["Surplus", C.mapSupply], ["Defisit", C.mapDeficit],
    ["Watchlist", C.mapWatch], ["Rute", C.mapRoute]];
  return (
    <div style={{ display: "flex", gap: 12 }}>
      {items.map(([l, c]) => (
        <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, ...mono(9.5), color: C.textSec }}>
          <span style={{ width: 8, height: 8, borderRadius: 99, background: c }} />{l}
        </span>
      ))}
    </div>
  );
}

function AIInsight({ commodity, month, k, net, conf }:
  { commodity: string; month: string; k: ReturnType<typeof kpis>;
    net: ReturnType<typeof networkSummary>; conf: number }) {
  const localOnly = isNum(net.localFulfillmentPct);
  const ext = isNum(k.externalSupply) && (k.externalSupply as number) > 0;
  const finding = ext
    ? `Defisit ${commodity} terdeteksi pada ${k.nDeficit} kab/kota; total defisit ${fmtTon(k.totalDeficit)} ton (${monthLabel(month)}).`
    : `${commodity} berstatus aman pada ${monthLabel(month)}: ${k.nSurplus} kab surplus, ${k.nDeficit} kab defisit, tertutup redistribusi lokal.`;
  const impact = localOnly
    ? `Redistribusi lokal memenuhi ${fmtPct(net.localFulfillmentPct, 0)} kebutuhan via ${net.totalRoutes} rute (rata-rata ${fmtKm(net.avgDistanceKm)}).`
    : `Ringkasan optimasi MILP tidak tersedia untuk slice ini.`;
  const action = ext
    ? `Aktifkan transfer nearest-neighbor & siapkan procurement luar provinsi ${fmtTon(k.externalSupply)} ton.`
    : `Pertahankan rute aktif; jadikan surplus${k.criticalRegion ? " (jauh dari " + k.criticalRegion.name + ")" : ""} cadangan penyangga.`;
  return (
    <Card titleIcon={<Cpu size={13} color={C.teal} />} title="AI Insight Engine">
      <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
        <Insight tag="Key Finding" color={C.amber} text={finding} />
        <Insight tag="Business Impact" color={C.sky} text={impact} />
        <Insight tag="Recommended Action" color={C.emerald} text={action} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
          borderTop: `1px solid ${C.border}`, paddingTop: 9 }}>
          <Label>Confidence Level</Label>
          <span style={{ display: "flex", gap: 3, alignItems: "center" }}>
            {[1, 2, 3, 4, 5].map(i => (
              <span key={i} style={{ width: 14, height: 5, borderRadius: 3,
                background: i <= conf ? C.emerald : C.border }} />
            ))}
            <span style={{ ...mono(10, 600), color: C.emerald, marginLeft: 4 }}>{conf}/5</span>
          </span>
        </div>
      </div>
    </Card>
  );
}

function Insight({ tag, color, text }: { tag: string; color: string; text: string }) {
  return (
    <div>
      <p style={{ ...mono(9.5, 600), color, textTransform: "uppercase", letterSpacing: ".12em", margin: "0 0 4px" }}>{tag}</p>
      <p style={{ ...mono(11.5), color: C.text, lineHeight: 1.6, margin: 0 }}>{text}</p>
    </div>
  );
}

function DistanceInsightCard({ d, commodity }: { d: ReturnType<typeof distanceInsight>; commodity: string }) {
  return (
    <Card titleIcon={<Compass size={13} color={C.teal} />} title="Distance Optimization Insight">
      {!d ? (
        <p style={{ ...mono(11.5), color: C.muted }}>Data Not Available — tidak ada pasangan surplus/defisit {commodity} untuk dianalisis.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p style={{ ...mono(11), color: C.textSec, margin: 0 }}>
            Wilayah defisit prioritas: <span style={{ color: C.coral, fontWeight: 600 }}>{d.destination}</span>
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Mini k="Nearest Surplus Source" v={d.nearest?.source ?? NA} c={C.emerald} />
            <Mini k="Distance" v={d.nearest ? fmtKm(d.nearest.distanceKm) : NA} />
            <Mini k="Transport Efficiency" v={d.efficiency ?? NA}
              c={d.efficiency === "High" ? C.emerald : d.efficiency === "Low" ? C.coral : C.amber} />
            <Mini k="Alternative Route" v={d.alternative?.source ?? NA} />
            <Mini k="Alt. Distance" v={d.alternative ? fmtKm(d.alternative.distanceKm) : NA} />
            <Mini k="Expected Add. Cost" v={isNum(d.extraCostPct) ? `+${d.extraCostPct}%` : NA} c={C.amber} />
          </div>
        </div>
      )}
    </Card>
  );
}

function NetworkSummaryCard({ net }: { net: ReturnType<typeof networkSummary> }) {
  return (
    <Card titleIcon={<Network size={13} color={C.teal} />} title="Supply Network Performance">
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <Mini k="Total Routes" v={isNum(net.totalRoutes) ? String(net.totalRoutes) : NA} c={C.teal} />
        <Mini k="Avg Distance" v={fmtKm(net.avgDistanceKm)} />
        <Mini k="Volume Distributed" v={`${fmtTon(net.totalVolumeTon)} t`} c={C.mapRoute} />
        <Mini k="Transport Cost" v={fmtRp(net.totalCostRp)} c={C.amber} />
        <Mini k="Local Fulfillment" v={fmtPct(net.localFulfillmentPct, 0)} c={C.emerald} />
        <Mini k="External Fulfillment" v={fmtPct(net.externalFulfillmentPct, 0)}
          c={isNum(net.externalFulfillmentPct) && (net.externalFulfillmentPct as number) > 0 ? C.coral : C.muted} />
      </div>
    </Card>
  );
}

function ForecastTrend({ commodity, trend }: { commodity: string; trend: ReturnType<typeof monthlyTrend> }) {
  return (
    <Card titleIcon={<Activity size={13} color={C.teal} />}
      title={`Forecast Trend — ${commodity} · Provincial Aggregate (Jan–Jun 2026)`}>
      <div style={{ height: 230 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trend} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gProd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.emerald} stopOpacity={0.35} />
                <stop offset="100%" stopColor={C.emerald} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={C.teal} stopOpacity={0.22} />
                <stop offset="100%" stopColor={C.teal} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: C.muted, fontFamily: FONT.mono } as object} axisLine={{ stroke: C.border }} tickLine={false} />
            <YAxis tick={{ fontSize: 9.5, fill: C.muted, fontFamily: FONT.mono } as object} axisLine={false} tickLine={false}
              tickFormatter={(v: number) => fmtTon(v)} width={48} />
            <RTooltip content={<ChartTip />} />
            <ReferenceLine y={0} stroke={C.muted} strokeDasharray="2 2" />
            <Area type="monotone" dataKey="sP90" stroke="none" fill="url(#gBand)" name="Surplus P90" />
            <Area type="monotone" dataKey="sP10" stroke="none" fill={C.bg} name="Surplus P10" />
            <Area type="monotone" dataKey="produksi" stroke={C.emerald} strokeWidth={2}
              fill="url(#gProd)" name="Produksi setara" dot={false} />
            <Line type="monotone" dataKey="konsumsi" stroke={C.amber} strokeWidth={2}
              strokeDasharray="5 3" dot={false} name="Konsumsi" />
            <Line type="monotone" dataKey="sP50" stroke={C.teal} strokeWidth={2.5}
              dot={{ r: 2.5, fill: C.teal }} name="Surplus P50" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8 }}>
        {([["Produksi setara", C.emerald], ["Konsumsi", C.amber], ["Surplus P50", C.teal], ["Pita P10–P90", C.teal]] as [string, string][]).map(([l, c]) => (
          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, ...mono(10), color: C.textSec }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: c }} />{l}
          </span>
        ))}
      </div>
      <p style={{ ...mono(9), color: C.muted, marginTop: 8, lineHeight: 1.5 }}>
        Produksi disetarakan ke unit konsumsi (beras) via rendemen — Padi ×0.571, palawija ×1.0 — sehingga produksi, konsumsi, dan surplus berada pada satuan yang sama (identitas: surplus = produksi setara − konsumsi).
      </p>
    </Card>
  );
}

function ChartTip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number; color?: string; stroke?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: C.tooltip, border: `1px solid ${C.border}`, borderRadius: 8, padding: "9px 11px" }}>
      <p style={{ ...mono(10), color: C.muted, margin: "0 0 5px" }}>{label}</p>
      {payload.filter(p => p.value !== undefined).map((p, i) => (
        <p key={i} style={{ ...mono(10.5), color: p.color ?? p.stroke ?? C.text, margin: "2px 0" }}>
          {p.name}: {fmtTonFull(p.value)} t</p>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SCENARIO SIMULATION
// ════════════════════════════════════════════════════════════════════
function ScenarioPage({ commodity, month }: { commodity: string; month: string }) {
  const [demand, setDemand] = useState(0);
  const [shock, setShock] = useState(0);
  const [cost, setCost] = useState(0);
  const [radius, setRadius] = useState(300);
  const [safety, setSafety] = useState(0);

  const base = useMemo(() => districtViews(commodity, month), [commodity, month]);
  const recs = useMemo(() => recViews(commodity, month), [commodity, month]);

  const cur = useMemo(() => {
    let sur = 0, def = 0;
    base.forEach(v => { if (v.sP50 >= 0) sur += v.sP50; else def += -v.sP50; });
    return { sur, def };
  }, [base]);

  const proj = useMemo(() => {
    let sur = 0, def = 0;
    base.forEach(v => {
      const r = v.produksi > 0 ? (v.sP50 + v.konsumsi) / v.produksi : 1;
      const newProd = v.produksi * (1 + shock / 100);
      const newKons = v.konsumsi * (1 + demand / 100) * (1 + safety / 100);
      const b = r * newProd - newKons;
      if (b >= 0) sur += b; else def += -b;
    });
    return { sur, def };
  }, [base, shock, demand, safety]);

  const feasibleRecs = recs.filter(r => r.jarakKm <= radius);
  const baseCost = recs.reduce((a, r) => a + r.biayaRp, 0);
  const projCost = feasibleRecs.reduce((a, r) => a + r.biayaRp, 0) * (1 + cost / 100);

  const sliders: Array<[string, number, (n: number) => void, number, number, number, string]> = [
    ["Demand Growth", demand, setDemand, -20, 50, 1, "%"],
    ["Production Shock", shock, setShock, -50, 50, 1, "%"],
    ["Transportation Cost", cost, setCost, -50, 100, 5, "%"],
    ["Max Distribution Radius", radius, setRadius, 20, 300, 10, " km"],
    ["Safety Stock", safety, setSafety, 0, 30, 1, "%"],
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "360px minmax(0,1fr)", gap: 14 }}>
      <Card titleIcon={<Sliders size={13} color={C.teal} />} title="Scenario Levers">
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {sliders.map(([l, val, set, min, max, step, suffix]) => (
            <div key={l}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                <span style={{ ...mono(11), color: C.textSec }}>{l}</span>
                <span style={{ ...mono(11.5, 600), color: C.teal }}>
                  {val > 0 && suffix === "%" ? "+" : ""}{val}{suffix}</span>
              </div>
              <input type="range" min={min} max={max} step={step} value={val}
                onChange={e => set(Number(e.target.value))}
                style={{ width: "100%", accentColor: C.teal }} />
            </div>
          ))}
          <p style={{ ...mono(9.5), color: C.muted, lineHeight: 1.6, margin: 0 }}>
            Simulasi diterapkan pada baseline {commodity} · {monthLabel(month)} (rendemen efektif
            diturunkan per kab dari dataset). Hasil bertanda <em>simulated</em>, bukan nilai dataset.
          </p>
        </div>
      </Card>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0,1fr))", gap: 14 }}>
          <ScenCol title="Current (dataset)" sur={cur.sur} def={cur.def} cost={baseCost} routes={recs.length} accent={C.textSec} />
          <ScenCol title="Δ Intervention" sur={proj.sur - cur.sur} def={proj.def - cur.def}
            cost={projCost - baseCost} routes={feasibleRecs.length - recs.length} accent={C.amber} delta />
          <ScenCol title="Projected (simulated)" sur={proj.sur} def={proj.def} cost={projCost} routes={feasibleRecs.length} accent={C.teal} />
        </div>
        <Card titleIcon={<Gauge size={13} color={C.teal} />} title="Scenario Interpretation">
          <p style={{ ...mono(12), color: C.text, lineHeight: 1.7, margin: 0 }}>
            Dengan demand <b style={{ color: C.teal }}>{demand > 0 ? "+" : ""}{demand}%</b>,
            production shock <b style={{ color: C.teal }}>{shock > 0 ? "+" : ""}{shock}%</b>, dan safety stock <b style={{ color: C.teal }}>{safety}%</b>,
            proyeksi surplus berubah {fmtTon(cur.sur)} → <b style={{ color: proj.sur >= cur.sur ? C.emerald : C.coral }}>{fmtTon(proj.sur)} ton</b> dan
            defisit {fmtTon(cur.def)} → <b style={{ color: proj.def <= cur.def ? C.emerald : C.coral }}>{fmtTon(proj.def)} ton</b>.
            Dengan radius maks <b style={{ color: C.teal }}>{radius} km</b>, {feasibleRecs.length} dari {recs.length} rute tetap layak.
          </p>
        </Card>
      </div>
    </div>
  );
}

function ScenCol({ title, sur, def, cost, routes, accent, delta }:
  { title: string; sur: number; def: number; cost: number; routes: number; accent: string; delta?: boolean }) {
  const sign = (n: number) => (delta && n > 0 ? "+" : "");
  return (
    <Card title={title} pad={14}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Big k="Surplus" v={`${sign(sur)}${fmtTon(sur)} t`} c={delta ? (sur >= 0 ? C.emerald : C.coral) : C.emerald} />
        <Big k="Defisit" v={`${sign(def)}${fmtTon(def)} t`} c={delta ? (def <= 0 ? C.emerald : C.coral) : C.coral} />
        <Big k="Transport Cost" v={`${sign(cost)}${fmtRp(cost)}`} c={accent} />
        <Big k="Active Routes" v={`${sign(routes)}${routes}`} c={accent} />
      </div>
    </Card>
  );
}
function Big({ k, v, c }: { k: string; v: string; c: string }) {
  return (
    <div>
      <p style={{ ...mono(9.5, 500), color: C.muted, margin: 0, textTransform: "uppercase", letterSpacing: ".08em" }}>{k}</p>
      <p style={{ ...mono(18, 700), color: c, margin: "3px 0 0" }}>{v}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// DATA EXPLORER
// ════════════════════════════════════════════════════════════════════
const EXP_COLS = [
  { key: "kab", label: "Kabupaten/Kota", idx: 0, num: false },
  { key: "kom", label: "Komoditas", idx: 1, num: false },
  { key: "tgl", label: "Bulan", idx: 2, num: false },
  { key: "prod", label: "Produksi setara (t)", idx: 3, num: true },
  { key: "kons", label: "Konsumsi (t)", idx: 6, num: true },
  { key: "sP10", label: "Surplus P10", idx: 8, num: true },
  { key: "sP50", label: "Surplus P50", idx: 7, num: true },
  { key: "sP90", label: "Surplus P90", idx: 9, num: true },
  { key: "def", label: "Defisit Robust", idx: 11, num: true },
  { key: "sur", label: "Surplus Aman", idx: 12, num: true },
  { key: "kirim", label: "Kirim", idx: 13, num: true },
  { key: "terima", label: "Terima", idx: 14, num: true },
] as const;

function DataExplorer() {
  const [q, setQ] = useState("");
  const [fc, setFc] = useState("All");
  const [fm, setFm] = useState("All");
  const [fs, setFs] = useState("All");
  const [sortIdx, setSortIdx] = useState(7);
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const pageSize = 25;

  const rows = useMemo(() => {
    const r = DISTRICT.filter(row => {
      if (fc !== "All" && row[1] !== fc) return false;
      if (fm !== "All" && row[2] !== fm) return false;
      if (fs !== "All" && row[10] !== fs) return false;
      if (q && !(row[0] as string).toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
    return [...r].sort((a, b) => {
      const av = a[sortIdx], bv = b[sortIdx];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sortDir;
      return String(av).localeCompare(String(bv)) * sortDir;
    });
  }, [q, fc, fm, fs, sortIdx, sortDir]);

  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const view = rows.slice(page * pageSize, page * pageSize + pageSize);
  const cols = EXP_COLS.filter(c => !hidden.has(c.key));

  const exportCsv = useCallback(() => {
    const header = EXP_COLS.map(c => c.label).join(",");
    const body = rows.map(r => EXP_COLS.map(c => {
      // production exported in consumption-equivalent (beras) = surplus_p50 + konsumsi
      if (c.key === "prod") return Math.round(((r[7] as number) + (r[6] as number)) * 10) / 10;
      const v = r[c.idx]; return typeof v === "string" && v.includes(",") ? `"${v}"` : v;
    }).join(",")).join("\n");
    const blob = new Blob(["﻿" + header + "\n" + body], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `panenvision_export_${fc}_${fm}.csv`;
    a.click();
  }, [rows, fc, fm]);

  const setSort = (idx: number) => {
    if (sortIdx === idx) setSortDir(d => (d === 1 ? -1 : 1));
    else { setSortIdx(idx); setSortDir(-1); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="pv-card" style={{ padding: "10px 12px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 200,
          background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 10px" }}>
          <Search size={14} color={C.muted} />
          <input value={q} onChange={e => { setQ(e.target.value); setPage(0); }}
            placeholder="Cari kabupaten/kota…"
            style={{ background: "transparent", border: "none", outline: "none", color: C.text, ...mono(12), width: "100%" }} />
        </div>
        <select className="pv-select" value={fc} onChange={e => { setFc(e.target.value); setPage(0); }}>
          <option value="All">Semua Komoditas</option>
          {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="pv-select" value={fm} onChange={e => { setFm(e.target.value); setPage(0); }}>
          <option value="All">Semua Bulan</option>
          {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
        <select className="pv-select" value={fs} onChange={e => { setFs(e.target.value); setPage(0); }}>
          <option value="All">Semua Status</option>
          <option value="surplus">Surplus</option>
          <option value="defisit">Defisit</option>
        </select>
        <span style={{ ...mono(10.5), color: C.muted }}>{rows.length} baris</span>
        <button onClick={exportCsv} style={{ ...mono(11, 600), color: C.bg, background: C.teal,
          border: "none", borderRadius: 7, padding: "7px 13px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6 }}>
          <Download size={13} /> Export CSV
        </button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Label style={{ marginRight: 4 }}>Kolom:</Label>
        {EXP_COLS.map(c => (
          <button key={c.key} onClick={() => setHidden(h => {
            const n = new Set(h); if (n.has(c.key)) n.delete(c.key); else n.add(c.key); return n;
          })} style={{ ...mono(9.5), padding: "3px 8px", borderRadius: 5, cursor: "pointer",
            border: `1px solid ${C.border}`, background: hidden.has(c.key) ? "transparent" : `${C.teal}18`,
            color: hidden.has(c.key) ? C.muted : C.teal }}>{c.label}</button>
        ))}
      </div>

      <div className="pv-card" style={{ overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {cols.map(c => (
                  <th key={c.key} onClick={() => setSort(c.idx)}
                    style={{ ...mono(9.5, 600), color: sortIdx === c.idx ? C.teal : C.muted,
                      textAlign: c.num ? "right" : "left", padding: "10px 12px",
                      borderBottom: `1px solid ${C.border}`, textTransform: "uppercase",
                      cursor: "pointer", whiteSpace: "nowrap", letterSpacing: ".05em",
                      position: "sticky", top: 0, background: C.surface }}>
                    {c.label}{sortIdx === c.idx ? (sortDir === 1 ? " ↑" : " ↓") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {view.length === 0 && (
                <tr><td colSpan={cols.length} style={{ ...mono(12), color: C.muted, textAlign: "center", padding: 40 }}>
                  Data Not Available untuk filter ini.</td></tr>
              )}
              {view.map((r, i) => (
                <tr key={i} className="pv-row" style={{ borderBottom: `1px solid ${C.borderSoft}` }}>
                  {cols.map(c => {
                    const v = r[c.idx];
                    if (c.key === "tgl") return <td key={c.key} style={cell(false)}>{monthLabel(v as string)}</td>;
                    if (c.key === "kom") return (
                      <td key={c.key} style={cell(false)}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 7, height: 7, borderRadius: 99, background: COMMODITY_COLOR[v as string] ?? C.muted }} />
                          {v}</span></td>);
                    if (c.num) {
                      // production shown in consumption-equivalent (beras) = surplus_p50 + konsumsi
                      const n = c.key === "prod" ? (r[7] as number) + (r[6] as number) : (v as number);
                      const col = (c.key === "sP50" || c.key === "sP10" || c.key === "sP90")
                        ? (n >= 0 ? C.emerald : C.coral) : C.textSec;
                      return <td key={c.key} style={{ ...cell(true), color: col, fontWeight: 500 }}>{fmtTonFull(n)}</td>;
                    }
                    return <td key={c.key} style={{ ...cell(false), color: C.text, fontWeight: 500 }}>{v}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 14px", borderTop: `1px solid ${C.border}` }}>
          <span style={{ ...mono(10.5), color: C.muted }}>
            {rows.length === 0 ? 0 : page * pageSize + 1}–{Math.min((page + 1) * pageSize, rows.length)} dari {rows.length}
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <PgBtn onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>← Prev</PgBtn>
            <span style={{ ...mono(10.5), color: C.textSec }}>{page + 1}/{pages}</span>
            <PgBtn onClick={() => setPage(p => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}>Next →</PgBtn>
          </div>
        </div>
      </div>
    </div>
  );
}
const cell = (num: boolean): React.CSSProperties =>
  ({ ...mono(10.5), color: C.textSec, padding: "7px 12px", textAlign: num ? "right" : "left", whiteSpace: "nowrap" });
function PgBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...mono(10.5), color: C.text,
      background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 6, padding: "5px 11px",
      cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.35 : 1 }}>{children}</button>
  );
}

// ════════════════════════════════════════════════════════════════════
// ABOUT
// ════════════════════════════════════════════════════════════════════
function About() {
  const rows: [string, string][] = [
    ["Platform", "PANENVISION — Predictive & Prescriptive Food Security Platform"],
    ["Wilayah", "35 kabupaten/kota Provinsi Jawa Tengah"],
    ["Komoditas", COMMODITIES.join(", ")],
    ["Horizon Forecast", `${monthLabel(MONTHS[0])} – ${monthLabel(MONTHS[MONTHS.length - 1])} (${MONTHS.length} bulan)`],
    ["Model Titik", "LightGBM (direct multi-horizon, MASE < 1)"],
    ["Model Interval", "Conformal Prediction (distribution-free, P10/P50/P90)"],
    ["Optimasi Distribusi", "Robust MILP subsidi-silang (PuLP, jarak haversine antar-centroid)"],
    ["Satuan", "Produksi disetarakan ke konsumsi (beras) via rendemen — Padi ×0.571, palawija ×1.0 — agar sebanding dengan konsumsi & surplus"],
    ["Sumber Data", "dashboard_data.csv · dashboard_rekomendasi.csv · dashboard_ringkasan.csv · centroids.csv"],
    ["Peta", "Batas kab/kota BIG/BPS (ardian28/GeoJson-Indonesia-38-Provinsi, CC-BY)"],
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card titleIcon={<Shield size={13} color={C.teal} />} title="About PANENVISION">
        <div style={{ display: "flex", flexDirection: "column" }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 14, padding: "9px 0", borderBottom: `1px solid ${C.borderSoft}` }}>
              <span style={{ ...mono(10.5), color: C.muted, width: 150, flexShrink: 0 }}>{k}</span>
              <span style={{ ...mono(11), color: C.text, lineHeight: 1.5 }}>{v}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card titleIcon={<Database size={13} color={C.teal} />} title="Data Integrity">
        <p style={{ ...mono(11.5), color: C.textSec, lineHeight: 1.8, margin: 0 }}>
          Seluruh angka pada platform ini — neraca surplus/defisit, hasil forecast (P10/P50/P90),
          jarak antar wilayah, biaya, dan rekomendasi distribusi — dibaca <b style={{ color: C.teal }}>verbatim</b> dari
          dataset hasil pipeline Agri-GotongRoyong (forecast + Robust MILP). Tidak ada angka yang
          dibuat-buat; bila suatu nilai tidak tersedia di dataset, platform menampilkan <b style={{ color: C.amber }}>“{NA}”</b>.
          Modul data di-generate ulang via <code style={{ color: C.sky }}>scripts/gen_data.py</code> setiap dataset diperbarui.
          <br /><br />
          <b style={{ color: C.teal }}>Satuan setara.</b> Produksi pada dataset disimpan dalam unit panen (Padi = gabah),
          sedangkan konsumsi & surplus dalam unit konsumsi (beras). Agar tidak salah baca, dashboard menampilkan
          <b style={{ color: C.text }}> produksi setara konsumsi</b> = produksi × rendemen, yang menurut identitas dataset
          (<i>surplus = produksi×rendemen − konsumsi</i>) sama persis dengan <code style={{ color: C.sky }}>surplus + konsumsi</code> —
          turunan eksak, bukan angka baru.
        </p>
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// REGIONAL RISK ASSESSMENT
// ════════════════════════════════════════════════════════════════════
function RegionalRisk({ month, scenario, commodity, onSelectKab }:
  { month: string; scenario: Scenario; commodity: string; onSelectKab: (k: string) => void }) {
  const ranked = useMemo(() => regionalBalance(month, scenario), [month, scenario]);
  const surplus = ranked.filter(r => r.balance > 0).slice(0, 10);
  const deficit = [...ranked].filter(r => r.balance < 0).sort((a, b) => a.balance - b.balance).slice(0, 10);
  const maxSur = Math.max(1, ...surplus.map(r => r.balance));
  const maxDef = Math.max(1, ...deficit.map(r => -r.balance));

  const nSur = ranked.filter(r => r.balance >= 0).length;
  const nDef = ranked.filter(r => r.balance < 0).length;
  const totSur = ranked.reduce((a, r) => a + r.surplus, 0);
  const totDef = ranked.reduce((a, r) => a + r.deficit, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0,1fr))", gap: 12 }}>
        <KpiCard label="Kab/Kota Surplus" value={String(nSur)} unit={`/ ${ranked.length}`}
          sub={`Σ +${fmtTon(totSur)} ton`} color={C.emerald} />
        <KpiCard label="Kab/Kota Defisit" value={String(nDef)} unit={`/ ${ranked.length}`}
          sub={`Σ −${fmtTon(totDef)} ton`} color={C.coral} />
        <KpiCard label="Top Surplus Region" value={surplus[0]?.kab ?? NA}
          sub={surplus[0] ? `+${fmtTon(surplus[0].balance)} ton` : ""} color={C.emerald} />
        <KpiCard label="Top Deficit Region" value={deficit[0]?.kab ?? NA}
          sub={deficit[0] ? `${fmtTon(deficit[0].balance, true)} ton` : ""} color={C.coral} />
      </div>

      <p style={{ ...mono(10.5), color: C.muted, margin: 0 }}>
        Agregat seluruh komoditas · {monthLabel(month)} · Skenario {scenario}. Klik baris untuk detail (komoditas aktif: {commodity}).
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <Card titleIcon={<TrendingUp size={13} color={C.emerald} />} title="Top 10 Surplus Regions">
          <RankList rows={surplus} max={maxSur} color={C.emerald} sign="+" onSelectKab={onSelectKab} />
        </Card>
        <Card titleIcon={<TrendingDown size={13} color={C.coral} />} title="Top 10 Deficit Regions">
          <RankList rows={deficit} max={maxDef} color={C.coral} sign="" onSelectKab={onSelectKab} />
        </Card>
      </div>

      <Card titleIcon={<AlertTriangle size={13} color={C.coral} />} title="Deficit Magnitude — Top 10 Regions (ton)">
        <div style={{ height: 240 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={deficit.map(d => ({ name: d.kab, deficit: Math.round(-d.balance) }))}
              layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.borderSoft} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9.5, fill: C.muted, fontFamily: FONT.mono } as object}
                axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtTon(v)} />
              <YAxis type="category" dataKey="name" width={104}
                tick={{ fontSize: 10, fill: C.textSec, fontFamily: FONT.mono } as object} axisLine={false} tickLine={false} />
              <RTooltip content={<ChartTip />} />
              <Bar dataKey="deficit" name="Defisit" fill={C.coral} fillOpacity={0.85} radius={[0, 3, 3, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

function RankList({ rows, max, color, sign, onSelectKab }:
  { rows: RegionBalance[]; max: number; color: string; sign: string; onSelectKab: (k: string) => void }) {
  if (!rows.length) return <p style={{ ...mono(11.5), color: C.muted }}>Data Not Available.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {rows.map((r, i) => (
        <div key={r.kab} onClick={() => onSelectKab(r.kab)} className="pv-row"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px",
            borderRadius: 7, cursor: "pointer" }}>
          <span style={{ ...mono(10, 600), color: C.muted, width: 18 }}>{i + 1}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ ...mono(11.5), color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.kab}</span>
              <span style={{ ...mono(11.5, 600), color }}>{sign}{fmtTon(r.balance)} t</span>
            </div>
            <div style={{ height: 4, background: C.surface2, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${(Math.abs(r.balance) / max) * 100}%`, background: color, borderRadius: 3 }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// POLICY RECOMMENDATION (qualitative conclusions; evidence from data)
// ════════════════════════════════════════════════════════════════════
function PolicyPage() {
  const routed = useMemo(() => commoditiesWithRoutes(), []);
  const structural = useMemo(() => COMMODITIES.filter(c => !routed.includes(c)), [routed]);

  type Rec = { priority: string; color: string; cat: string; title: string;
    action: string; impact: string; timeline: string; status: string; evidence?: string };
  const recs: Rec[] = [
    {
      priority: "CRITICAL", color: C.critical, cat: "Emergency Supply",
      title: `Pengadaan Eksternal — ${structural.join(", ") || "komoditas defisit struktural"}`,
      action: "Impor dari luar Provinsi Jawa Tengah untuk komoditas yang defisit di hampir seluruh kab/kota dan tidak memiliki rute redistribusi lokal yang layak. Koordinasi Bulog / Bapanas.",
      impact: "Mencegah kelangkaan struktural; menstabilkan harga komoditas yang tidak dapat dipenuhi dari dalam provinsi.",
      timeline: "Segera (< 1 bulan)", status: "Urgent",
      evidence: `Komoditas tanpa rute lokal pada dataset: ${structural.length ? structural.join(", ") : "—"}.`,
    },
    {
      priority: "HIGH", color: C.amber, cat: "Immediate Action",
      title: "Aktivasi Rute Redistribusi MILP — Padi & Ubi Kayu",
      action: "Jalankan rute optimal hasil Robust MILP dari kabupaten lumbung (mis. Wonogiri, Cilacap, Grobogan, Blora, Jepara) menuju kota-kota defisit (Kota Semarang, Surakarta, Tegal, Pekalongan). Manfaatkan rute jarak-terpendek lebih dulu.",
      impact: "Menutup defisit perkotaan tanpa impor luar provinsi; menurunkan biaya logistik via prioritas jarak terdekat.",
      timeline: "1–3 bulan", status: "Ready",
      evidence: `Komoditas dengan rute distribusi siap: ${routed.join(", ")}.`,
    },
    {
      priority: "HIGH", color: C.amber, cat: "Buffer Stock",
      title: "Cadangan Pangan Pra-Panen — Padi (awal tahun)",
      action: "Siapkan cadangan pangan pemerintah untuk bulan-bulan sebelum puncak panen, ketika sebagian besar kabupaten masih defisit padi. Lepas cadangan saat harga naik.",
      impact: "Meredam lonjakan harga beras musiman; menjaga keterjangkauan di periode rawan.",
      timeline: "3–6 bulan", status: "Planning",
    },
    {
      priority: "MEDIUM", color: C.sky, cat: "Medium-Term",
      title: "Intensifikasi Produksi di Kabupaten Defisit Tipis",
      action: "Program subsidi benih, perluasan luas tanam, dan penyuluhan di kabupaten yang defisitnya kecil agar berbalik menjadi surplus/swasembada, mengurangi beban redistribusi.",
      impact: "Menurunkan ketergantungan transfer antar-wilayah jangka menengah.",
      timeline: "6–12 bulan", status: "Planning",
    },
    {
      priority: "LOW", color: C.violet, cat: "Long-Term",
      title: "Diversifikasi & Urban Farming Kota-Kota",
      action: "Dorong urban farming, hidroponik, dan diversifikasi komoditas di kota-kota yang defisit struktural untuk meningkatkan self-sufficiency lokal.",
      impact: "Ketahanan pangan urban jangka panjang; mengurangi beban distribusi permanen.",
      timeline: "1–2 tahun", status: "Research",
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Card titleIcon={<FileText size={13} color={C.teal} />} title="Executive Summary — Kesimpulan & Arah Kebijakan">
        <p style={{ ...mono(12), color: C.text, lineHeight: 1.8, margin: 0 }}>
          Neraca pangan Jawa Tengah bersifat <b style={{ color: C.teal }}>heterogen secara spasial</b>: kabupaten lumbung
          mencatat surplus besar sementara kota-kota mengalami defisit. Sebagian komoditas dapat diseimbangkan melalui
          <b style={{ color: C.emerald }}> redistribusi antar-kabupaten</b> ({routed.join(", ") || NA}), namun komoditas
          <b style={{ color: C.coral }}> defisit struktural</b> ({structural.join(", ") || NA}) tidak memiliki sumber surplus
          lokal yang memadai sehingga membutuhkan <b style={{ color: C.amber }}>pasokan luar provinsi</b>. Rekomendasi disusun
          dari hasil forecast (P10/P50/P90) dan optimasi Robust MILP.
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(330px, 1fr))", gap: 14 }}>
        {recs.map((r, i) => (
          <div key={i} className="pv-card" style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "9px 14px", background: `${r.color}14`, borderBottom: `1px solid ${r.color}33` }}>
              <span style={{ ...mono(10, 700), color: r.color, letterSpacing: ".08em" }}>{r.priority}</span>
              <span style={{ ...mono(9.5, 600), color: r.color, border: `1px solid ${r.color}40`,
                background: `${r.color}14`, padding: "2px 8px", borderRadius: 5 }}>{r.cat}</span>
            </div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
              <p style={{ ...head(13.5, 600), color: C.text, margin: 0, lineHeight: 1.4 }}>{r.title}</p>
              <p style={{ ...mono(11), color: C.textSec, lineHeight: 1.65, margin: 0 }}>{r.action}</p>
              {r.evidence && (
                <p style={{ ...mono(10), color: C.teal, lineHeight: 1.55, margin: 0,
                  borderLeft: `2px solid ${C.teal}55`, paddingLeft: 8 }}>{r.evidence}</p>
              )}
              <div style={{ borderTop: `1px solid ${C.borderSoft}`, paddingTop: 9 }}>
                <p style={{ ...mono(9.5, 600), color: C.muted, textTransform: "uppercase", letterSpacing: ".1em", margin: "0 0 4px" }}>Dampak</p>
                <p style={{ ...mono(10.5), color: C.text, lineHeight: 1.6, margin: 0 }}>{r.impact}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ ...mono(10), color: C.muted }}>Timeline: <span style={{ color: C.text }}>{r.timeline}</span></span>
                <span style={{ ...mono(9.5, 600), color: r.color, border: `1px solid ${r.color}40`, padding: "2px 8px", borderRadius: 5 }}>{r.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SHELL
// ════════════════════════════════════════════════════════════════════
type Tab = "command" | "risk" | "policy" | "scenario" | "explorer" | "about";

function initialMode(): ThemeMode {
  if (typeof localStorage !== "undefined") {
    const m = localStorage.getItem("pv-theme");
    if (m === "light" || m === "dark") return m;
  }
  return "dark";
}

export default function App() {
  const [commodity, setCommodity] = useState("Padi");
  const [month, setMonth] = useState(MONTHS[0]);
  const [scenario, setScenario] = useState<Scenario>("P50");
  const [exec, setExec] = useState(false);
  const [tab, setTab] = useState<Tab>("command");
  const [selKab, setSelKab] = useState<string | null>(null);
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  // mutate live palette before children read it this render
  applyTheme(mode);
  const toggleMode = () => setMode(m => {
    const next = m === "dark" ? "light" : "dark";
    try { localStorage.setItem("pv-theme", next); } catch { /* ignore */ }
    return next;
  });

  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ["command", "Command Center", <Layers size={13} key="a" />],
    ["risk", "Regional Risk", <AlertTriangle size={13} key="b" />],
    ["policy", "Policy", <FileText size={13} key="c" />],
    ["scenario", "Scenario", <Sliders size={13} key="d" />],
    ["explorer", "Data Explorer", <Database size={13} key="e" />],
    ["about", "About", <Shield size={13} key="f" />],
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg }}>
      <GlobalStyle />

      <header style={{ position: "sticky", top: 0, zIndex: 50, background: C.glass,
        backdropFilter: "blur(10px)", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 1880, margin: "0 auto", padding: "11px 28px", display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9,
              background: `linear-gradient(135deg, ${C.teal}, ${C.emerald})`,
              display: "grid", placeItems: "center", boxShadow: `0 0 18px ${C.teal}55` }}>
              <Sprout size={19} color={C.bg} />
            </div>
            <div>
              <p style={{ ...head(17, 700), color: C.text, margin: 0, letterSpacing: "-.01em" }}>
                PANEN<span style={{ color: C.teal }}>VISION</span></p>
              <p style={{ ...mono(8.5), color: C.muted, margin: 0, letterSpacing: ".08em" }}>
                FORECAST • BALANCE • DISTRIBUTE • SECURE</p>
            </div>
          </div>

          <nav style={{ display: "flex", gap: 4, marginLeft: 14 }}>
            {tabs.map(([t, l, ic]) => (
              <div key={t} className={`pv-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}
                style={{ display: "flex", alignItems: "center", gap: 6 }}>{ic}{l}</div>
            ))}
          </nav>

          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
            <Search size={16} className="pv-ico" />
            <div style={{ position: "relative" }}>
              <Bell size={16} className="pv-ico" />
              <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, borderRadius: 99, background: C.coral }} />
            </div>
            <Bookmark size={16} className="pv-ico" />
            <Share2 size={16} className="pv-ico" />
            <button onClick={toggleMode} title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface2,
                border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 10px", cursor: "pointer",
                color: C.textSec }}>
              {mode === "dark" ? <Sun size={14} color={C.amber} /> : <Moon size={14} color={C.sky} />}
              <span style={{ ...mono(10.5, 600), color: C.text }}>{mode === "dark" ? "Light" : "Dark"}</span>
            </button>
            <button style={{ ...mono(11, 600), color: C.bg, background: C.teal, border: "none",
              borderRadius: 7, padding: "7px 12px", cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
              <Download size={13} /> Report</button>
            <div style={{ width: 30, height: 30, borderRadius: 99, background: C.surface2,
              border: `1px solid ${C.border}`, display: "grid", placeItems: "center", ...mono(11, 700), color: C.teal }}>AG</div>
          </div>
        </div>

        {/* GLOBAL FILTER BAR */}
        <div style={{ borderTop: `1px solid ${C.borderSoft}`, background: C.surface }}>
          <div style={{ maxWidth: 1880, margin: "0 auto", padding: "9px 28px",
            display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
            <FilterGroup label="Komoditas">
              <select className="pv-select" value={commodity} onChange={e => setCommodity(e.target.value)}>
                {COMMODITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FilterGroup>
            <FilterGroup label="Forecast Horizon">
              <select className="pv-select" value={month} onChange={e => setMonth(e.target.value)}>
                {MONTHS.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </FilterGroup>
            <FilterGroup label="Scenario">
              <Segmented value={scenario} options={["P10", "P50", "P90"]} onChange={(v) => setScenario(v as Scenario)} />
            </FilterGroup>
            <FilterGroup label="View">
              <Segmented value={exec ? "Executive" : "Operational"} options={["Operational", "Executive"]}
                onChange={(v) => setExec(v === "Executive")} />
            </FilterGroup>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 7, ...mono(10), color: C.muted }}>
              <span className="pv-blink" style={{ width: 7, height: 7, borderRadius: 99, background: C.emerald }} />
              LIVE · {monthLabel(month)} · {scenario}
            </div>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1880, margin: "0 auto", padding: "18px 28px 40px" }}>
        {tab === "command" && (
          <CommandCenter commodity={commodity} month={month} scenario={scenario} exec={exec} onSelectKab={setSelKab} />
        )}
        {tab === "risk" && (
          <RegionalRisk month={month} scenario={scenario} commodity={commodity} onSelectKab={setSelKab} />
        )}
        {tab === "policy" && <PolicyPage />}
        {tab === "scenario" && <ScenarioPage commodity={commodity} month={month} />}
        {tab === "explorer" && <DataExplorer />}
        {tab === "about" && <About />}
      </main>

      <footer style={{ borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <div style={{ maxWidth: 1880, margin: "0 auto", padding: "16px 28px",
          display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <span style={{ ...mono(10), color: C.muted }}>
            Source: Forecast Dataset + Distribution Optimization Dataset (Agri-GotongRoyong / Satria Data 2026)
          </span>
          <span style={{ ...mono(10), color: C.muted }}>
            PANENVISION v1.0 · Auto-generated from latest uploaded forecast dataset · {MONTHS.length} bln × {COMMODITIES.length} komoditas × 35 kab
          </span>
        </div>
      </footer>

      {selKab && (
        <RegionalDrawer kab={selKab} commodity={commodity} month={month} scenario={scenario} onClose={() => setSelKab(null)} />
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ ...mono(9.5), color: C.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>{label}</span>
      {children}
    </div>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 7, overflow: "hidden" }}>
      {options.map(o => (
        <button key={o} className="pv-seg" onClick={() => onChange(o)}
          style={{ background: value === o ? C.teal : "transparent", color: value === o ? C.bg : C.textSec,
            fontWeight: value === o ? 600 : 500 }}>{o}</button>
      ))}
    </div>
  );
}
