export const HOUR = 3_600_000;

export type FreightRoute = {
  id: string;
  code: string;
  origin: string;
  destination: string;
  checkpoint: string;
  latitude: number;
  longitude: number;
  checkpoint_minutes: number;
  /** Municípios do catálogo rodoviário (código IBGE). Nulos em rotas cadastradas manualmente. */
  origin_code: number | null;
  destination_code: number | null;
  /** Código do trecho do SNV usado como ponto de referência. */
  checkpoint_snv: string | null;
};

export type Point = [longitude: number, latitude: number];

export type City = { code: number; name: string; uf: string; population: number };

export type RouteSegment = {
  snv: string;
  highway: string;
  uf: string;
  label: string;
  km_from_origin: number;
  minutes_from_origin: number;
  latitude: number;
  longitude: number;
};

export type RoutePlan = {
  origin: { code: number; name: string; uf: string };
  destination: { code: number; name: string; uf: string };
  distance_km: number;
  duration_minutes: number;
  highways: string[];
  path: Point[];
  segments: RouteSegment[];
};

/** Rota com o traçado calculado a partir do catálogo rodoviário e a previsão no ponto monitorado. */
export type RouteView = FreightRoute & {
  distance_km: number | null;
  highways: string[];
  path: Point[] | null;
  forecast: { fetched_at: string; simulated: boolean; hours: ForecastHour[] } | null;
};

export type Delivery = {
  id: string;
  route_id: string;
  reference: string;
  departure_at: string;
  hour_cost_cents: number;
};

export const choices = {
  advance: "Antecipar saída",
  postpone: "Adiar saída",
  reroute: "Avaliar desvio",
} as const;

export type Choice = keyof typeof choices;

export type Decision = {
  delivery_id: string;
  choice: Choice;
  note: string;
  recorded_at: string;
  assessment: Assessment;
};

/** Hora de previsão no ponto monitorado. Campos além da chuva são opcionais (previsões antigas só têm chuva). */
export type ForecastHour = {
  time: string;
  rain_mm: number;
  probability?: number | null;
  gust_kmh?: number | null;
  visibility_m?: number | null;
  code?: number | null;
  temp_c?: number | null;
};

export type Forecast = {
  route_id: string;
  fetched_at: string;
  hours: ForecastHour[];
};

export type HazardKind = "rain" | "storm" | "wind" | "visibility";

export type Hazard = { kind: HazardKind; level: "moderate" | "high"; value: number };

export const hazardLabels: Record<HazardKind, string> = {
  rain: "Chuva",
  storm: "Tempestade",
  wind: "Rajadas de vento",
  visibility: "Baixa visibilidade",
};

export type Alternative = {
  shift_hours: number;
  checkpoint_at: string;
  level: "low" | "moderate" | "high";
  rain_mm: number;
  cost_cents: number;
};

export type Assessment = {
  level: "low" | "moderate" | "high" | "unavailable" | "outside";
  checkpoint_at: string;
  rain_mm: number | null;
  forecast_at: string | null;
  delay_minutes: number | null;
  cost_cents: number | null;
  recommendation: Choice | null;
  /** Campos climáticos adicionais; ausentes em decisões registradas antes desta versão. */
  hazards?: Hazard[];
  probability?: number | null;
  gust_kmh?: number | null;
  visibility_m?: number | null;
  weather_code?: number | null;
  alternative?: Alternative | null;
};

export type DeliveryView = Delivery & {
  assessment: Assessment;
  decision: Decision | null;
};

export type Operations = {
  mode: "demo" | "supabase";
  routes: RouteView[];
  deliveries: DeliveryView[];
};

export const riskLabels: Record<Assessment["level"], string> = {
  high: "Alto",
  moderate: "Moderado",
  low: "Baixo",
  unavailable: "Sem previsão",
  outside: "Fora da janela",
};

export const initialRoutes: FreightRoute[] = [
  { id: "00000000-0000-4000-8000-000000000116", code: "BR-116", origin: "São Paulo", destination: "Curitiba", checkpoint: "Serra do Cafezal", latitude: -23.975, longitude: -47.155, checkpoint_minutes: 120, origin_code: 3550308, destination_code: 4106902, checkpoint_snv: null },
  { id: "00000000-0000-4000-8000-000000000101", code: "BR-101", origin: "Curitiba", destination: "Joinville", checkpoint: "Garuva", latitude: -26.034, longitude: -48.851, checkpoint_minutes: 90, origin_code: 4106902, destination_code: 4209102, checkpoint_snv: null },
  { id: "00000000-0000-4000-8000-000000000381", code: "BR-381", origin: "Belo Horizonte", destination: "São Paulo", checkpoint: "Cambuí", latitude: -22.612, longitude: -46.058, checkpoint_minutes: 300, origin_code: 3106200, destination_code: 3550308, checkpoint_snv: null },
];
