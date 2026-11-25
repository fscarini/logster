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

export type Forecast = {
  route_id: string;
  fetched_at: string;
  hours: { time: string; rain_mm: number }[];
};

export type Assessment = {
  level: "low" | "moderate" | "high" | "unavailable" | "outside";
  checkpoint_at: string;
  rain_mm: number | null;
  forecast_at: string | null;
  delay_minutes: number | null;
  cost_cents: number | null;
  recommendation: Choice | null;
};

export type DeliveryView = Delivery & {
  assessment: Assessment;
  decision: Decision | null;
};

export type Operations = {
  mode: "demo" | "supabase";
  routes: FreightRoute[];
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
  { id: "00000000-0000-4000-8000-000000000116", code: "BR-116", origin: "São Paulo", destination: "Curitiba", checkpoint: "Serra do Cafezal", latitude: -23.975, longitude: -47.155, checkpoint_minutes: 120 },
  { id: "00000000-0000-4000-8000-000000000101", code: "BR-101", origin: "Curitiba", destination: "Joinville", checkpoint: "Garuva", latitude: -26.034, longitude: -48.851, checkpoint_minutes: 90 },
  { id: "00000000-0000-4000-8000-000000000381", code: "BR-381", origin: "Belo Horizonte", destination: "São Paulo", checkpoint: "Cambuí", latitude: -22.612, longitude: -46.058, checkpoint_minutes: 300 },
];
