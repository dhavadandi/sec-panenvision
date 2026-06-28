// ════════════════════════════════════════════════════════════════════
// Pure selectors over the AUTO-GENERATED dataset. No value is invented:
// every figure returned here is read or aggregated from generated.ts.
// Anything not present in the data resolves to `null` -> rendered "N/A".
// ════════════════════════════════════════════════════════════════════
import {
  DISTRICT, RECS, SUMMARY, CENTROIDS,
  type DistrictRow, type RecRow, type SummaryRow,
} from "./generated";

export type Scenario = "P10" | "P50" | "P90";

// ---- column accessors (tuple indices) ---------------------------------
const D = {
  kab: 0, kom: 1, tgl: 2, prod: 3, prodP10: 4, prodP90: 5, kons: 6,
  sP50: 7, sP10: 8, sP90: 9, status: 10, defRobust: 11, surAman: 12,
  kirim: 13, terima: 14,
} as const;

const R = { kom: 0, tgl: 1, asal: 2, tujuan: 3, jarak: 4, kirim: 5, biaya: 6 } as const;
const S = {
  kom: 0, tgl: 1, status: 2, supply: 3, demand: 4, lokal: 5,
  impor: 6, biaya: 7, nRute: 8, pemenuhan: 9,
} as const;

// ---- view types -------------------------------------------------------
export interface DistrictView {
  kab: string;
  produksi: number; prodP10: number; prodP90: number; // raw forecast (Padi = gabah)
  // production expressed in CONSUMPTION-equivalent units (beras), so it is
  // directly comparable to konsumsi & surplus. By the dataset identity
  // surplus = produksi×rendemen − konsumsi, this equals surplus + konsumsi
  // EXACTLY (Padi ×0.571, palawija ×1.0). No invented values.
  produksiSetara: number; produksiSetaraP10: number; produksiSetaraP90: number;
  konsumsi: number;
  sP10: number; sP50: number; sP90: number;
  status: string; defisitRobust: number; surplusAman: number;
  kirim: number; terima: number;
}

export interface RecView {
  asal: string; tujuan: string; jarakKm: number;
  kirimTon: number; biayaRp: number;
  priority: "HIGH" | "MEDIUM" | "LOW";
  coveragePct: number | null;
}

// ---- helpers ----------------------------------------------------------
export const scenarioBalance = (v: DistrictView, sc: Scenario): number =>
  sc === "P10" ? v.sP10 : sc === "P90" ? v.sP90 : v.sP50;

const toView = (r: DistrictRow): DistrictView => {
  const kons = r[D.kons] as number;
  const sP10 = r[D.sP10] as number, sP50 = r[D.sP50] as number, sP90 = r[D.sP90] as number;
  return {
    kab: r[D.kab] as string,
    produksi: r[D.prod] as number,
    prodP10: r[D.prodP10] as number,
    prodP90: r[D.prodP90] as number,
    produksiSetara: sP50 + kons,        // = produksi × rendemen (beras)
    produksiSetaraP10: sP10 + kons,
    produksiSetaraP90: sP90 + kons,
    konsumsi: kons,
    sP10, sP50, sP90,
    status: r[D.status] as string,
    defisitRobust: r[D.defRobust] as number,
    surplusAman: r[D.surAman] as number,
    kirim: r[D.kirim] as number,
    terima: r[D.terima] as number,
  };
};

// ---- core selectors ---------------------------------------------------
export function districtViews(commodity: string, month: string): DistrictView[] {
  return DISTRICT
    .filter(r => r[D.kom] === commodity && r[D.tgl] === month)
    .map(toView)
    .sort((a, b) => b.sP50 - a.sP50);
}

export function summaryFor(commodity: string, month: string): SummaryRow | null {
  return SUMMARY.find(r => r[S.kom] === commodity && r[S.tgl] === month) ?? null;
}

export function recViews(commodity: string, month: string): RecView[] {
  const raw = RECS.filter(r => r[R.kom] === commodity && r[R.tgl] === month);
  if (!raw.length) return [];
  // demand per destination district (for coverage impact) from the same slice
  const views = districtViews(commodity, month);
  const demandByKab = new Map<string, number>();
  views.forEach(v => demandByKab.set(v.kab, v.defisitRobust || Math.max(0, -v.sP50)));
  const tons = raw.map(r => r[R.kirim] as number).sort((a, b) => a - b);
  const hi = tons[Math.floor(tons.length * 0.66)] ?? 0;
  const lo = tons[Math.floor(tons.length * 0.33)] ?? 0;
  return raw
    .map(r => {
      const kirim = r[R.kirim] as number;
      const dest = r[R.tujuan] as string;
      const demand = demandByKab.get(dest) ?? 0;
      const coverage = demand > 0 ? Math.min(100, (kirim / demand) * 100) : null;
      const priority: RecView["priority"] = kirim >= hi ? "HIGH" : kirim >= lo ? "MEDIUM" : "LOW";
      return {
        asal: r[R.asal] as string,
        tujuan: dest,
        jarakKm: r[R.jarak] as number,
        kirimTon: kirim,
        biayaRp: r[R.biaya] as number,
        priority,
        coveragePct: coverage,
      };
    })
    .sort((a, b) => b.kirimTon - a.kirimTon);
}

// ---- KPI block --------------------------------------------------------
export interface KPIs {
  totalSurplus: number;
  totalDeficit: number;          // positive magnitude
  localFulfillmentPct: number | null;
  externalSupply: number | null; // impor luar (ton)
  criticalCommodity: { name: string; deficit: number } | null;
  criticalRegion: { name: string; balance: number } | null;
  nSurplus: number;
  nDeficit: number;
}

export function kpis(commodity: string, month: string, sc: Scenario): KPIs {
  const views = districtViews(commodity, month);
  let totalSurplus = 0, totalDeficit = 0, nSurplus = 0, nDeficit = 0;
  let worst: { name: string; balance: number } | null = null;
  for (const v of views) {
    const b = scenarioBalance(v, sc);
    if (b >= 0) { totalSurplus += b; nSurplus++; }
    else {
      totalDeficit += -b; nDeficit++;
      if (!worst || b < worst.balance) worst = { name: v.kab, balance: b };
    }
  }
  const sum = summaryFor(commodity, month);
  // most critical commodity across all commodities for this month
  let critCom: { name: string; deficit: number } | null = null;
  const byCom = new Map<string, number>();
  for (const r of DISTRICT) {
    if (r[D.tgl] !== month) continue;
    const b = sc === "P10" ? (r[D.sP10] as number) : sc === "P90" ? (r[D.sP90] as number) : (r[D.sP50] as number);
    if (b < 0) byCom.set(r[D.kom] as string, (byCom.get(r[D.kom] as string) ?? 0) + -b);
  }
  byCom.forEach((def, name) => { if (!critCom || def > critCom.deficit) critCom = { name, deficit: def }; });

  return {
    totalSurplus,
    totalDeficit,
    localFulfillmentPct: sum ? (sum[S.pemenuhan] as number) : null,
    externalSupply: sum ? (sum[S.impor] as number) : null,
    criticalCommodity: critCom,
    criticalRegion: worst,
    nSurplus,
    nDeficit,
  };
}

// previous month helper for trend arrows
export function prevMonth(month: string, months: string[]): string | null {
  const i = months.indexOf(month);
  return i > 0 ? months[i - 1] : null;
}

// ---- monthly trend (for selected commodity, all months) ---------------
export interface TrendPoint {
  month: string; label: string;
  produksi: number; konsumsi: number;
  sP10: number; sP50: number; sP90: number;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const monthLabel = (iso: string): string => {
  const m = parseInt(iso.slice(5, 7), 10);
  return `${MONTH_LABELS[m - 1]} ${iso.slice(0, 4)}`;
};
export const monthShort = (iso: string): string => MONTH_LABELS[parseInt(iso.slice(5, 7), 10) - 1];

export function monthlyTrend(commodity: string, months: string[]): TrendPoint[] {
  return months.map(m => {
    const vs = districtViews(commodity, m);
    const acc = vs.reduce(
      (a, v) => {
        a.produksi += v.produksiSetara; a.konsumsi += v.konsumsi; // setara → comparable
        a.sP10 += v.sP10; a.sP50 += v.sP50; a.sP90 += v.sP90;
        return a;
      },
      { produksi: 0, konsumsi: 0, sP10: 0, sP50: 0, sP90: 0 },
    );
    return { month: m, label: monthShort(m), ...acc };
  });
}

// ---- distribution network summary -------------------------------------
export interface NetworkSummary {
  totalRoutes: number;
  avgDistanceKm: number | null;
  totalVolumeTon: number;
  totalCostRp: number;
  localFulfillmentPct: number | null;
  externalFulfillmentPct: number | null;
}

export function networkSummary(commodity: string, month: string): NetworkSummary {
  const recs = RECS.filter(r => r[R.kom] === commodity && r[R.tgl] === month);
  const sum = summaryFor(commodity, month);
  const totalVolume = recs.reduce((a, r) => a + (r[R.kirim] as number), 0);
  const totalCost = recs.reduce((a, r) => a + (r[R.biaya] as number), 0);
  const avgDist = recs.length ? recs.reduce((a, r) => a + (r[R.jarak] as number), 0) / recs.length : null;
  let extPct: number | null = null;
  if (sum) {
    const lokal = sum[S.lokal] as number, impor = sum[S.impor] as number;
    const tot = lokal + impor;
    extPct = tot > 0 ? (impor / tot) * 100 : 0;
  }
  return {
    totalRoutes: recs.length,
    avgDistanceKm: avgDist,
    totalVolumeTon: totalVolume,
    totalCostRp: totalCost,
    localFulfillmentPct: sum ? (sum[S.pemenuhan] as number) : null,
    externalFulfillmentPct: extPct,
  };
}

// ---- distance optimisation insight ------------------------------------
const haversine = (a: [number, number], b: [number, number]): number => {
  const R0 = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const la1 = a[1] * rad, la2 = b[1] * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R0 * Math.asin(Math.sqrt(h));
};

export interface DistanceInsight {
  destination: string;
  nearest: { source: string; distanceKm: number } | null;
  alternative: { source: string; distanceKm: number } | null;
  efficiency: "High" | "Medium" | "Low" | null;
  extraCostPct: number | null;
}

/** For the worst-deficit destination of a commodity-month, find nearest &
 *  alternative surplus sources using the dataset's own centroids. */
export function distanceInsight(commodity: string, month: string): DistanceInsight | null {
  const views = districtViews(commodity, month);
  const deficits = views.filter(v => v.sP50 < 0).sort((a, b) => a.sP50 - b.sP50);
  const surplus = views.filter(v => v.surplusAman > 0);
  if (!deficits.length || surplus.length < 1) return null;
  const dest = deficits[0];
  const dc = CENTROIDS[dest.kab];
  if (!dc) return null;
  const ranked = surplus
    .map(s => ({ source: s.kab, distanceKm: CENTROIDS[s.kab] ? haversine(dc, CENTROIDS[s.kab]) : Infinity }))
    .filter(x => isFinite(x.distanceKm))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .map(x => ({ source: x.source, distanceKm: Math.round(x.distanceKm * 10) / 10 }));
  if (!ranked.length) return null;
  const nearest = ranked[0];
  const alternative = ranked[1] ?? null;
  const allDist = ranked.map(r => r.distanceKm);
  const median = allDist[Math.floor(allDist.length / 2)];
  const efficiency = nearest.distanceKm <= median * 0.66 ? "High" : nearest.distanceKm <= median ? "Medium" : "Low";
  const extraCostPct = alternative
    ? Math.round(((alternative.distanceKm - nearest.distanceKm) / nearest.distanceKm) * 100)
    : null;
  return { destination: dest.kab, nearest, alternative, efficiency, extraCostPct };
}

// ---- formatters -------------------------------------------------------
export const NA = "N/A";
export const isNum = (n: unknown): n is number => typeof n === "number" && isFinite(n);

export const fmtTon = (n: number | null | undefined, sign = false): string => {
  if (!isNum(n)) return NA;
  const s = sign && n > 0 ? "+" : "";
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${s}${(n / 1_000_000).toFixed(2)} jt`;
  if (a >= 1_000) return `${s}${(n / 1_000).toFixed(1)}rb`;
  return `${s}${Math.round(n).toLocaleString("id-ID")}`;
};
export const fmtTonFull = (n: number | null | undefined): string =>
  isNum(n) ? Math.round(n).toLocaleString("id-ID") : NA;

export const fmtRp = (n: number | null | undefined): string => {
  if (!isNum(n)) return NA;
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(2)} M`;
  if (a >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`;
  if (a >= 1_000) return `Rp ${(n / 1_000).toFixed(0)}rb`;
  return `Rp ${Math.round(n).toLocaleString("id-ID")}`;
};

export const fmtPct = (n: number | null | undefined, dp = 1): string =>
  isNum(n) ? `${n.toFixed(dp)}%` : NA;

export const fmtKm = (n: number | null | undefined): string =>
  isNum(n) ? `${n.toFixed(1)} km` : NA;

// ---- regional risk: per-kab balance aggregated across commodities -----
export interface RegionBalance { kab: string; balance: number; surplus: number; deficit: number; }

/** For a given month + scenario, sum each kab's balance across ALL commodities. */
export function regionalBalance(month: string, sc: Scenario): RegionBalance[] {
  const m = new Map<string, RegionBalance>();
  for (const r of DISTRICT) {
    if (r[D.tgl] !== month) continue;
    const kab = r[D.kab] as string;
    const b = sc === "P10" ? (r[D.sP10] as number) : sc === "P90" ? (r[D.sP90] as number) : (r[D.sP50] as number);
    const cur = m.get(kab) ?? { kab, balance: 0, surplus: 0, deficit: 0 };
    cur.balance += b;
    if (b >= 0) cur.surplus += b; else cur.deficit += -b;
    m.set(kab, cur);
  }
  return [...m.values()].sort((a, b) => b.balance - a.balance);
}

/** Commodities that actually have optimal distribution routes in the dataset. */
export function commoditiesWithRoutes(): string[] {
  const s = new Set<string>();
  RECS.forEach(r => s.add(r[R.kom] as string));
  return [...s].sort();
}
