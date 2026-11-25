import type { Decision, Delivery, Forecast, FreightRoute } from "./model";

export type Store = {
  mode: "demo" | "supabase";
  load: () => Promise<{ routes: FreightRoute[]; deliveries: Delivery[]; decisions: Decision[]; forecasts: Forecast[] }>;
  addRoute: (route: FreightRoute) => Promise<void>;
  addDelivery: (delivery: Delivery) => Promise<void>;
  recordDecision: (decision: Decision) => Promise<void>;
};
