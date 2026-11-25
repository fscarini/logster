import { HOUR, choices, hazardLabels } from "./model";
import type { Assessment, Choice, DeliveryView, HazardKind, Operations } from "./model";

export type RiskBucket = "high" | "moderate" | "low" | "none";

export const bucketLabels: Record<RiskBucket, string> = {
  high: "Alto",
  moderate: "Moderado",
  low: "Baixo",
  none: "Sem previsão",
};

export function bucketOf(level: Assessment["level"]): RiskBucket {
  return level === "high" || level === "moderate" || level === "low" ? level : "none";
}

export type RouteExposure = {
  id: string;
  code: string;
  name: string;
  deliveries: number;
  openAlerts: number;
  costCents: number;
};

export type TimeSlot = {
  start: number;
  counts: Record<RiskBucket, number>;
};

export type Dashboard = {
  inWindow: number;
  openAlerts: DeliveryView[];
  openHigh: number;
  costAtRiskCents: number;
  delayAtRiskMinutes: number;
  decisions: number;
  responseRate: number | null;
  handledCostCents: number;
  forecastCoverage: number | null;
  risk: Record<RiskBucket, number>;
  routes: RouteExposure[];
  timeline: TimeSlot[];
  choices: { choice: Choice; label: string; count: number }[];
  /** Diferença de custo se as alternativas sugeridas forem adotadas nos alertas em aberto. */
  avoidableCents: number;
  withAlternative: number;
  hazards: { kind: HazardKind; label: string; high: number; moderate: number }[];
  maxProbability: number | null;
};

const SLOT_HOURS = 6;
const WINDOW_HOURS = 72;

export function buildDashboard(data: Operations, now: number): Dashboard {
  const inWindow = data.deliveries.filter(item => item.assessment.level !== "outside");
  const openAlerts = data.deliveries
    .filter(item => item.assessment.recommendation !== null && !item.decision)
    .sort((a, b) => (b.assessment.cost_cents ?? 0) - (a.assessment.cost_cents ?? 0)
      || Date.parse(a.assessment.checkpoint_at) - Date.parse(b.assessment.checkpoint_at));
  const decided = data.deliveries.filter(item => item.decision);

  const risk: Record<RiskBucket, number> = { high: 0, moderate: 0, low: 0, none: 0 };
  inWindow.forEach(item => { risk[bucketOf(item.assessment.level)] += 1; });

  const start = Math.floor(now / HOUR) * HOUR;
  const timeline: TimeSlot[] = Array.from({ length: WINDOW_HOURS / SLOT_HOURS }, (_, index) => ({
    start: start + index * SLOT_HOURS * HOUR,
    counts: { high: 0, moderate: 0, low: 0, none: 0 },
  }));
  inWindow.forEach(item => {
    const index = Math.floor((Date.parse(item.assessment.checkpoint_at) - start) / (SLOT_HOURS * HOUR));
    const slot = timeline[Math.min(Math.max(index, 0), timeline.length - 1)];
    slot.counts[bucketOf(item.assessment.level)] += 1;
  });

  const routes = data.routes.map(route => {
    const items = data.deliveries.filter(item => item.route_id === route.id);
    const alerts = openAlerts.filter(item => item.route_id === route.id);
    return {
      id: route.id,
      code: route.code,
      name: `${route.origin} / ${route.destination}`,
      deliveries: items.length,
      openAlerts: alerts.length,
      costCents: alerts.reduce((sum, item) => sum + (item.assessment.cost_cents ?? 0), 0),
    };
  }).sort((a, b) => b.costCents - a.costCents || b.openAlerts - a.openAlerts || b.deliveries - a.deliveries);

  const assessed = inWindow.filter(item => item.assessment.level !== "unavailable").length;

  return {
    inWindow: inWindow.length,
    openAlerts,
    openHigh: openAlerts.filter(item => item.assessment.level === "high").length,
    costAtRiskCents: openAlerts.reduce((sum, item) => sum + (item.assessment.cost_cents ?? 0), 0),
    delayAtRiskMinutes: openAlerts.reduce((sum, item) => sum + (item.assessment.delay_minutes ?? 0), 0),
    decisions: decided.length,
    responseRate: decided.length + openAlerts.length ? decided.length / (decided.length + openAlerts.length) : null,
    handledCostCents: decided.reduce((sum, item) => sum + (item.decision?.assessment.cost_cents ?? 0), 0),
    forecastCoverage: inWindow.length ? assessed / inWindow.length : null,
    risk,
    routes,
    timeline,
    avoidableCents: openAlerts.reduce((sum, item) => {
      const alternative = item.assessment.alternative;
      return alternative ? sum + Math.max(0, (item.assessment.cost_cents ?? 0) - alternative.cost_cents) : sum;
    }, 0),
    withAlternative: openAlerts.filter(item => item.assessment.alternative).length,
    hazards: (Object.keys(hazardLabels) as HazardKind[]).map(kind => {
      const found = inWindow.flatMap(item => (item.assessment.hazards ?? []).filter(hazard => hazard.kind === kind));
      return { kind, label: hazardLabels[kind], high: found.filter(item => item.level === "high").length, moderate: found.filter(item => item.level === "moderate").length };
    }),
    maxProbability: inWindow.reduce<number | null>((max, item) => {
      const value = item.assessment.probability;
      return value == null ? max : Math.max(max ?? 0, value);
    }, null),
    choices: (Object.keys(choices) as Choice[]).map(choice => ({
      choice,
      label: choices[choice],
      count: decided.filter(item => item.decision?.choice === choice).length,
    })),
  };
}
