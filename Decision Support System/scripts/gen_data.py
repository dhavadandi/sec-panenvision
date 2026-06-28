# -*- coding: utf-8 -*-
"""
AUTO data generator for PANENVISION.
Reads the real artefak_milp CSVs + Jawa Tengah GeoJSON and emits TypeScript
data modules. NO values are invented here: every number is copied from source.

Usage:
    python scripts/gen_data.py
"""
import json, csv, math, os, sys

# ---- paths -------------------------------------------------------------
SEC = r"C:\Users\ACER\Downloads\SEC-20260623T052939Z-3-001\SEC\artefak_milp"
GEOJSON_ALL = r"C:\Users\ACER\AppData\Local\Temp\all_kab.json"  # downloaded earlier
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src", "data")
os.makedirs(OUT_DIR, exist_ok=True)


def read_csv(name):
    path = os.path.join(SEC, name)
    with open(path, encoding="utf-8-sig", newline="") as fh:
        return list(csv.DictReader(fh))


def num(v):
    """Parse a CSV cell to number; keep ints int, else float; '' -> None."""
    if v is None or v == "":
        return None
    try:
        f = float(v)
        return int(f) if f == int(f) else round(f, 2)
    except ValueError:
        return v


def jnum(v):
    """JSON literal for a number/None."""
    return "null" if v is None else (repr(v) if isinstance(v, float) else str(v))


def jstr(s):
    return json.dumps(s, ensure_ascii=False)


# ---- 1. dashboard_data -------------------------------------------------
dd = read_csv("dashboard_data.csv")
district_rows = []
for r in dd:
    district_rows.append([
        r["kabupaten_kota"], r["komoditas"], r["tanggal"],
        num(r["produksi_ramalan_ton"]), num(r["produksi_p10"]), num(r["produksi_p90"]),
        num(r["konsumsi_ton"]), num(r["surplus_p50"]), num(r["surplus_p10"]),
        num(r["surplus_p90"]), r["status_neraca"], num(r["defisit_robust_ton"]),
        num(r["surplus_aman_ton"]), num(r["kirim_keluar_ton"]), num(r["terima_ton"]),
    ])

# ---- 2. dashboard_rekomendasi -----------------------------------------
rk = read_csv("dashboard_rekomendasi.csv")
rec_rows = []
for r in rk:
    rec_rows.append([
        r["komoditas"], r["tanggal"], r["asal"], r["tujuan"],
        num(r["jarak_km"]), num(r["kirim_ton"]), num(r["biaya_rp"]),
    ])

# ---- 3. dashboard_ringkasan -------------------------------------------
rs = read_csv("dashboard_ringkasan.csv")
sum_rows = []
for r in rs:
    sum_rows.append([
        r["komoditas"], r["tanggal"], r["status"],
        num(r["supply_aman_ton"]), num(r["demand_robust_ton"]), num(r["dikirim_lokal_ton"]),
        num(r["impor_luar_ton"]), num(r["biaya_total_rp"]), num(r["n_rute"]),
        num(r["pemenuhan_lokal_pct"]),
    ])

# ---- 4. centroids ------------------------------------------------------
ct = read_csv("centroids.csv")
centroids = {r["kabupaten_kota"]: (float(r["lon"]), float(r["lat"])) for r in ct}

# ---- derived dimension lists ------------------------------------------
commodities = sorted({r[1] for r in district_rows})
months = sorted({r[2] for r in district_rows})
districts = sorted({r[0] for r in district_rows})

# ---- 5. GeoJSON -> projected SVG paths --------------------------------
geo = json.load(open(GEOJSON_ALL, encoding="utf-8"))
jt = [f for f in geo["features"] if f["properties"].get("WADMPR") == "Jawa Tengah"]
assert len(jt) == 35, f"expected 35 JT features, got {len(jt)}"

# Karimunjawa islands (part of Jepara) sit ~80 km north and stretch the frame.
# They carry no separate data, so we drop island rings that lie entirely
# north of this latitude to keep a clean landscape map of the mainland.
NORTH_CLIP = -6.25

def keep_ring(ring):
    return min(y for _, y in ring) <= NORTH_CLIP

# collect all coords for bbox
lons, lats = [], []
def each_ring(geom):
    if geom["type"] == "Polygon":
        for ring in geom["coordinates"]:
            yield ring
    elif geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            for ring in poly:
                yield ring

for f in jt:
    if f["geometry"] is None:
        continue
    for ring in each_ring(f["geometry"]):
        if not keep_ring(ring):
            continue
        for x, y in ring:
            lons.append(x); lats.append(y)
# include dataset centroids in bbox so nodes never fall outside
for lon, lat in centroids.values():
    lons.append(lon); lats.append(lat)

lon_min, lon_max = min(lons), max(lons)
lat_min, lat_max = min(lats), max(lats)
mean_lat = (lat_min + lat_max) / 2
kx = math.cos(math.radians(mean_lat))

PAD = 16
MAP_W = 1000.0
span_x = (lon_max - lon_min) * kx
span_y = (lat_max - lat_min)
scale = (MAP_W - 2 * PAD) / span_x
MAP_H = round(span_y * scale + 2 * PAD, 1)

def project(lon, lat):
    x = PAD + (lon - lon_min) * kx * scale
    y = PAD + (lat_max - lat) * scale  # invert: north up
    return round(x, 1), round(y, 1)

def ring_to_points(ring):
    pts = []
    last = None
    for lon, lat in ring:
        p = project(lon, lat)
        if p != last:        # drop consecutive duplicates after quantization
            pts.append(p); last = p
    return pts

def _perp(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    seg = math.hypot(dx, dy) or 1e-9
    return abs((px - ax) * dy - (py - ay) * dx) / seg

def _dp_open(pts, tol):
    """Douglas-Peucker on an OPEN polyline; returns kept indices incl. ends."""
    if len(pts) < 3:
        return list(range(len(pts)))
    def rec(lo, hi):
        if hi <= lo + 1:
            return []
        a, b = pts[lo], pts[hi]
        idx, dmax = -1, 0.0
        for i in range(lo + 1, hi):
            d = _perp(pts[i], a, b)
            if d > dmax:
                dmax, idx = d, i
        if dmax > tol and idx != -1:
            return rec(lo, idx) + [idx] + rec(idx, hi)
        return []
    return [0] + rec(0, len(pts) - 1) + [len(pts) - 1]

def simplify(pts, tol=1.0):
    """
    Simplify a CLOSED ring. DP between identical endpoints is degenerate, so we
    drop the repeated closing vertex, split the loop at its two extreme points,
    and run open-polyline DP on each arc.
    """
    sys.setrecursionlimit(20000)
    if pts and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n < 6:
        return pts
    # anchor 0 and the point farthest from it -> two arcs around the loop
    far = max(range(n), key=lambda i: (pts[i][0] - pts[0][0]) ** 2 + (pts[i][1] - pts[0][1]) ** 2)
    arc1 = pts[0:far + 1]
    arc2 = pts[far:] + [pts[0]]
    k1 = _dp_open(arc1, tol)
    k2 = _dp_open(arc2, tol)
    out = [arc1[i] for i in k1[:-1]] + [arc2[i] for i in k2[:-1]]
    return out

def path_for(feature):
    parts = []
    geom = feature["geometry"]
    if geom is None:
        return ""  # e.g. Kota Magelang enclave: no boundary in source -> node only
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    for poly in polys:
        ring = poly[0]  # exterior ring only
        if not keep_ring(ring):
            continue   # skip Karimunjawa island parts
        pts = simplify(ring_to_points(ring))
        if len(pts) < 3:
            continue
        d = "M" + " ".join(f"{x},{y}" for x, y in pts) + "Z"
        parts.append(d)
    return "".join(parts)

shapes = []
for f in jt:
    name = f["properties"]["WADMKK"]
    d = path_for(f)
    lon, lat = centroids[name]
    cx, cy = project(lon, lat)
    shapes.append({"kab": name, "d": d, "cx": cx, "cy": cy})
shapes.sort(key=lambda s: s["kab"])

# ---- emit generated.ts -------------------------------------------------
def arr_lit(rows):
    out = []
    for row in rows:
        cells = []
        for c in row:
            if isinstance(c, str):
                cells.append(jstr(c))
            else:
                cells.append(jnum(c))
        out.append("[" + ",".join(cells) + "]")
    return ",\n  ".join(out)

gen_ts = f"""// ════════════════════════════════════════════════════════════════════
// AUTO-GENERATED by scripts/gen_data.py — DO NOT EDIT BY HAND.
// Source: artefak_milp/*.csv (forecast + Robust MILP, Agri-GotongRoyong).
// Every value below is copied verbatim from the uploaded dataset.
// Regenerate:  python scripts/gen_data.py
// ════════════════════════════════════════════════════════════════════

export type DistrictRow = [
  kab: string, komoditas: string, tanggal: string,
  produksi: number, prodP10: number, prodP90: number,
  konsumsi: number, surplusP50: number, surplusP10: number, surplusP90: number,
  status: string, defisitRobust: number, surplusAman: number,
  kirimKeluar: number, terima: number
];

/** dashboard_data.csv — 35 kab × 7 komoditas × 6 bulan (Jan–Jun 2026). */
export const DISTRICT: DistrictRow[] = [
  {arr_lit(district_rows)}
];

export type RecRow = [
  komoditas: string, tanggal: string, asal: string, tujuan: string,
  jarakKm: number, kirimTon: number, biayaRp: number
];

/** dashboard_rekomendasi.csv — optimal MILP transfer routes (future horizon). */
export const RECS: RecRow[] = [
  {arr_lit(rec_rows)}
];

export type SummaryRow = [
  komoditas: string, tanggal: string, status: string,
  supplyAman: number, demandRobust: number, dikirimLokal: number,
  imporLuar: number, biayaTotal: number, nRute: number, pemenuhanPct: number
];

/** dashboard_ringkasan.csv — balance & cost per commodity-month. */
export const SUMMARY: SummaryRow[] = [
  {arr_lit(sum_rows)}
];

/** centroids.csv — kab/kota centroid lon/lat (used by MILP haversine). */
export const CENTROIDS: Record<string, [lon: number, lat: number]> = {{
  {",\n  ".join(f"{jstr(k)}: [{v[0]}, {v[1]}]" for k, v in sorted(centroids.items()))}
}};

export const COMMODITIES: string[] = {json.dumps(commodities, ensure_ascii=False)};
export const MONTHS: string[] = {json.dumps(months, ensure_ascii=False)};
export const DISTRICTS: string[] = {json.dumps(districts, ensure_ascii=False)};
"""

# ---- emit geo.ts -------------------------------------------------------
geo_ts = f"""// ════════════════════════════════════════════════════════════════════
// AUTO-GENERATED by scripts/gen_data.py — DO NOT EDIT BY HAND.
// Jawa Tengah kabupaten/kota boundaries (35), projected to an SVG viewBox.
// Source: ardian28/GeoJson-Indonesia-38-Provinsi (BIG / BPS, CC-BY).
// Node coords (cx,cy) come from the dataset's own centroids.csv.
// ════════════════════════════════════════════════════════════════════

export const MAP_W = {MAP_W};
export const MAP_H = {MAP_H};

export interface GeoShape {{ kab: string; d: string; cx: number; cy: number; }}

export const JATENG_SHAPES: GeoShape[] = [
  {",\n  ".join("{ kab: " + jstr(s["kab"]) + ", cx: " + str(s["cx"]) + ", cy: " + str(s["cy"]) + ", d: " + jstr(s["d"]) + " }" for s in shapes)}
];
"""

with open(os.path.join(OUT_DIR, "generated.ts"), "w", encoding="utf-8") as fh:
    fh.write(gen_ts)
with open(os.path.join(OUT_DIR, "geo.ts"), "w", encoding="utf-8") as fh:
    fh.write(geo_ts)

print("OK")
print(f"  district rows : {len(district_rows)}")
print(f"  rec rows      : {len(rec_rows)}")
print(f"  summary rows  : {len(sum_rows)}")
print(f"  centroids     : {len(centroids)}")
print(f"  shapes        : {len(shapes)}")
print(f"  commodities   : {commodities}")
print(f"  months        : {months}")
print(f"  MAP_W x MAP_H : {MAP_W} x {MAP_H}")
print(f"  out dir       : {OUT_DIR}")
