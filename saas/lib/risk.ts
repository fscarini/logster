import { HOUR, initialRoutes } from "./model";
import type { Alternative, Assessment, Delivery, Forecast, ForecastHour, FreightRoute, Hazard } from "./model";

// Limites ilustrativos do MVP, inspirados nos níveis de aviso usados por serviços meteorológicos.
export const THRESHOLDS = {
  rain: { moderate: 5, high: 15 }, // mm/h
  wind: { moderate: 50, high: 75 }, // rajada em km/h
  visibility: { moderate: 1000, high: 200 }, // metros (quanto menor, pior)
} as const;
const STORM_CODES = new Set([95, 96, 99]); // trovoada; 96 e 99 com granizo
const FOG_CODES = new Set([45, 48]);
const DELAY_MINUTES = { low: 0, moderate: 45, high: 120 } as const;
const SHIFTS = [-2, 2, -4, 4];
const WINDOW_HOURS = 72;
const MAX_FORECAST_AGE = 3 * HOUR;

type Level = "low" | "moderate" | "high";
const rank: Record<Level, number> = { low: 0, moderate: 1, high: 2 };

/** Classifica uma hora de previsão pelos perigos presentes. */
export function hourHazards(hour: ForecastHour): { level: Level; hazards: Hazard[]; score: number } {
  const hazards: Hazard[] = [];
  const rain = hour.rain_mm;
  if (rain >= THRESHOLDS.rain.high) hazards.push({ kind: "rain", level: "high", value: rain });
  else if (rain >= THRESHOLDS.rain.moderate) hazards.push({ kind: "rain", level: "moderate", value: rain });

  if (hour.code != null && STORM_CODES.has(hour.code)) hazards.push({ kind: "storm", level: hour.code === 95 ? "moderate" : "high", value: hour.code });

  const gust = hour.gust_kmh;
  if (gust != null && gust >= THRESHOLDS.wind.high) hazards.push({ kind: "wind", level: "high", value: gust });
  else if (gust != null && gust >= THRESHOLDS.wind.moderate) hazards.push({ kind: "wind", level: "moderate", value: gust });

  const visibility = hour.visibility_m;
  if (visibility != null && visibility < THRESHOLDS.visibility.high) hazards.push({ kind: "visibility", level: "high", value: visibility });
  else if (visibility != null && visibility < THRESHOLDS.visibility.moderate) hazards.push({ kind: "visibility", level: "moderate", value: visibility });
  else if (visibility == null && hour.code != null && FOG_CODES.has(hour.code)) hazards.push({ kind: "visibility", level: "moderate", value: 1000 });

  const level: Level = hazards.some(item => item.level === "high") ? "high" : hazards.length ? "moderate" : "low";
  // Pontuação contínua para desempatar janelas de mesmo nível.
  const score = rank[level] * 100
    + rain / THRESHOLDS.rain.high * 10
    + (gust ?? 0) / THRESHOLDS.wind.high * 10
    + (visibility != null ? Math.max(0, 1 - visibility / 5000) * 10 : 0);
  hazards.sort((a, b) => rank[b.level] - rank[a.level]);
  return { level, hazards, score };
}

export function assess(delivery: Delivery, route: FreightRoute, forecast: Forecast | undefined, now: number): Assessment {
  const departure = Date.parse(delivery.departure_at);
  const crossing = departure + route.checkpoint_minutes * 60_000;
  const base = {
    checkpoint_at: new Date(crossing).toISOString(),
    rain_mm: null,
    forecast_at: null,
    delay_minutes: null,
    cost_cents: null,
    recommendation: null,
    hazards: [] as Hazard[],
    probability: null,
    gust_kmh: null,
    visibility_m: null,
    weather_code: null,
    alternative: null,
  } as const;

  if (crossing < now || crossing > now + WINDOW_HOURS * HOUR) return { ...base, level: "outside" };
  if (!forecast || now - Date.parse(forecast.fetched_at) > MAX_FORECAST_AGE) return { ...base, level: "unavailable" };

  const byHour = new Map(forecast.hours.map(hour => [Date.parse(hour.time), hour]));
  const crossingHour = Math.floor(crossing / HOUR) * HOUR;
  const hour = byHour.get(crossingHour);
  if (!hour) return { ...base, level: "unavailable" };

  const current = hourHazards(hour);
  const cost = (level: Level) => Math.round(delivery.hour_cost_cents * DELAY_MINUTES[level] / 60);

  // Compara saídas antecipadas e adiadas em 2 e 4 horas, dentro da janela e sem partir no passado.
  let best: (Alternative & { score: number }) | null = null;
  for (const shift of SHIFTS) {
    const newDeparture = departure + shift * HOUR;
    const newCrossing = crossing + shift * HOUR;
    if (newDeparture < now || newCrossing > now + WINDOW_HOURS * HOUR) continue;
    const candidate = byHour.get(crossingHour + shift * HOUR);
    if (!candidate) continue;
    const result = hourHazards(candidate);
    const option = { shift_hours: shift, checkpoint_at: new Date(newCrossing).toISOString(), level: result.level, rain_mm: candidate.rain_mm, cost_cents: cost(result.level), score: result.score };
    if (!best || option.score < best.score - 0.01) best = option;
  }
  const improves = best !== null && (rank[best.level] < rank[current.level] || best.score < current.score * 0.7);
  const alternative = best && improves ? (({ score: _score, ...rest }) => rest)(best) : null;

  return {
    ...base,
    level: current.level,
    rain_mm: hour.rain_mm,
    forecast_at: forecast.fetched_at,
    delay_minutes: DELAY_MINUTES[current.level],
    cost_cents: cost(current.level),
    hazards: current.hazards,
    probability: hour.probability ?? null,
    gust_kmh: hour.gust_kmh ?? null,
    visibility_m: hour.visibility_m ?? null,
    weather_code: hour.code ?? null,
    alternative: current.level === "low" ? null : alternative,
    recommendation: current.level === "low" ? null : alternative ? (alternative.shift_hours < 0 ? "advance" : "postpone") : "reroute",
  };
}

// --- Previsão simulada da demonstração ------------------------------------------------------

function seeded(text: string) {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return () => {
    hash = Math.imul(hash ^ (hash >>> 15), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return ((hash ^= hash >>> 16) >>> 0) / 4294967296;
  };
}

/** Cenários fixos para as rotas iniciais e clima pseudoaleatório estável para rotas novas. */
export function demoForecast(route: FreightRoute, now: number): Forecast {
  const passedHour = Math.floor(now / HOUR) * HOUR;
  const random = seeded(route.id);
  const burstStart = 6 + Math.floor(random() * 40);
  const burstKind = random();
  const hours = Array.from({ length: WINDOW_HOURS + 1 }, (_, offset) => {
    const hour: ForecastHour = {
      time: new Date(passedHour + offset * HOUR).toISOString(),
      rain_mm: Math.round(random() * 1.5 * 10) / 10,
      probability: Math.round(10 + random() * 20),
      gust_kmh: Math.round(18 + random() * 14),
      visibility_m: 10000,
      code: 2,
      temp_c: Math.round(18 + 6 * Math.sin((offset / 24) * 2 * Math.PI)),
    };
    const inside = (from: number, to: number) => offset >= from && offset <= to;
    if (route.id === initialRoutes[0].id && inside(4, 9)) Object.assign(hour, { rain_mm: 18, probability: 85, gust_kmh: 42, code: 65, visibility_m: 3000 });
    else if (route.id === initialRoutes[1].id && inside(4, 8)) Object.assign(hour, { rain_mm: 8, probability: 70, gust_kmh: inside(5, 7) ? 58 : 38, code: inside(5, 6) ? 95 : 63 });
    else if (route.id === initialRoutes[2].id && inside(15, 19)) Object.assign(hour, { rain_mm: 0.4, probability: 30, visibility_m: inside(16, 18) ? 450 : 900, code: 45 });
    else if (!initialRoutes.some(item => item.id === route.id) && inside(burstStart, burstStart + 4)) {
      if (burstKind < 0.5) Object.assign(hour, { rain_mm: 7 + Math.round(random() * 12), probability: 75, code: 63 });
      else if (burstKind < 0.75) Object.assign(hour, { gust_kmh: 55 + Math.round(random() * 25), code: 3 });
      else Object.assign(hour, { visibility_m: 300 + Math.round(random() * 500), code: 45 });
    }
    return hour;
  });
  return { route_id: route.id, fetched_at: new Date(now).toISOString(), hours };
}
