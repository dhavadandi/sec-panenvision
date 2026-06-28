// PANENVISION design tokens — government-tech / supply-chain control tower.
// Two palettes (dark / light). `C` is a live, mutable token object that the
// app swaps at runtime via applyTheme(); every component reads `C.*` at render
// time, so a single mutation + re-render re-skins the whole UI. This keeps the
// pervasive `${C.teal}40` hex+alpha pattern working (vs. CSS variables).

export type ThemeMode = "dark" | "light";

export interface Palette {
  bg: string; surface: string; surface2: string; surface3: string;
  border: string; borderSoft: string;
  teal: string; emerald: string; sky: string; amber: string; coral: string;
  critical: string; violet: string;
  text: string; textSec: string; muted: string;
  mapRoute: string; mapSupply: string; mapDeficit: string; mapWatch: string;
  glass: string; sea: string; tooltip: string; overlay: string;
}

export const DARK: Palette = {
  bg: "#070B14", surface: "#0D1321", surface2: "#121A2B", surface3: "#16203400",
  border: "#1E2A3E", borderSoft: "#16203A",
  teal: "#2DD4BF", emerald: "#10B981", sky: "#38BDF8", amber: "#F59E0B", coral: "#FB7185",
  critical: "#EF4444", violet: "#A78BFA",
  text: "#F8FAFC", textSec: "#94A3B8", muted: "#64748B",
  mapRoute: "#4FD1C5", mapSupply: "#22C55E", mapDeficit: "#F43F5E", mapWatch: "#FBBF24",
  glass: "rgba(7,11,20,.88)", sea: "#0B1426", tooltip: "#0A1124", overlay: "rgba(3,6,12,.6)",
};

export const LIGHT: Palette = {
  bg: "#EEF2F8", surface: "#FFFFFF", surface2: "#F1F5FA", surface3: "#FFFFFF00",
  border: "#D8E0EC", borderSoft: "#E7ECF3",
  teal: "#0D9488", emerald: "#059669", sky: "#0284C7", amber: "#D97706", coral: "#E11D48",
  critical: "#DC2626", violet: "#7C3AED",
  text: "#0B1524", textSec: "#475569", muted: "#7A8AA0",
  mapRoute: "#0D9488", mapSupply: "#16A34A", mapDeficit: "#E11D48", mapWatch: "#D97706",
  glass: "rgba(244,246,251,.85)", sea: "#DCE6F2", tooltip: "#FFFFFF", overlay: "rgba(15,23,42,.35)",
};

// live token object (starts dark; mutated by applyTheme)
export const C: Palette = { ...DARK };

export function applyTheme(mode: ThemeMode): void {
  Object.assign(C, mode === "light" ? LIGHT : DARK);
}

export const COMMODITY_COLOR: Record<string, string> = {
  Padi: "#22C55E",
  Jagung: "#F59E0B",
  Kedelai: "#EF4444",
  "Kacang Hijau": "#10B981",
  "Kacang Tanah": "#A78BFA",
  "Ubi Kayu": "#38BDF8",
  "Ubi Jalar": "#FB923C",
};

export const FONT = {
  head: "'IBM Plex Sans', system-ui, sans-serif",
  body: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const statusColor = (s: "surplus" | "deficit" | "watchlist"): string =>
  s === "surplus" ? C.mapSupply : s === "deficit" ? C.mapDeficit : C.mapWatch;
