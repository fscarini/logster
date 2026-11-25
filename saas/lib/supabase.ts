import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Decision, Delivery, Forecast, FreightRoute } from "./model";
import type { Store } from "./store";

export function isDemoMode() {
  if (process.env.LOGSTER_DEMO_MODE === "1") return true;
  if (process.env.LOGSTER_DEMO_MODE === "0" || process.env.NODE_ENV !== "development") return false;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
}

export async function supabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  const jar = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: updates => updates.forEach(({ name, value, options }) => jar.set(name, value, { ...options, httpOnly: true })),
    },
  });
}

export async function authenticatedStore(): Promise<Store | null> {
  const db = await supabaseClient();
  if (!db) return null;
  const { data, error } = await db.auth.getUser();
  if (error || !data.user) return null;
  const user = data.user.id;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return {
    mode: "supabase",
    async load() {
      const [routes, deliveries, decisions, forecasts] = await Promise.all([
        db.from("routes").select("id, code, origin, destination, checkpoint, latitude, longitude, checkpoint_minutes, origin_code, destination_code, checkpoint_snv").order("code"),
        db.from("deliveries").select("id, route_id, reference, departure_at, hour_cost_cents").order("departure_at"),
        db.from("decisions").select("delivery_id, choice, note, recorded_at, assessment"),
        db.from("forecasts").select("route_id, fetched_at, hours"),
      ]);
      const failure = routes.error || deliveries.error || decisions.error || forecasts.error;
      if (failure) throw failure;
      return {
        routes: routes.data as FreightRoute[],
        deliveries: deliveries.data as Delivery[],
        decisions: decisions.data as Decision[],
        forecasts: forecasts.data as Forecast[],
      };
    },
    async addRoute(route) {
      const result = await db.from("routes").upsert({ ...route, owner_id: user }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    },
    async addDelivery(delivery) {
      const result = await db.from("deliveries").upsert({ ...delivery, owner_id: user }, { onConflict: "id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    },
    async recordDecision(decision) {
      const result = await db.from("decisions").upsert({ ...decision, owner_id: user }, { onConflict: "delivery_id", ignoreDuplicates: true });
      if (result.error) throw result.error;
    },
    // A tabela forecasts só aceita escrita do service_role; a chave nunca sai do servidor.
    saveForecasts: serviceKey ? async forecasts => {
      const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
      const result = await admin.from("forecasts").upsert(forecasts, { onConflict: "route_id" });
      if (result.error) throw result.error;
    } : undefined,
  };
}
