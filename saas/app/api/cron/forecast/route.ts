import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { fetchForecast } from "../../../../lib/weather";

function authorized(value: string | null, secret: string) {
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(value ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export async function POST(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const secret = process.env.LOGSTER_CRON_SECRET;
  if (!url || !key || !secret || process.env.LOGSTER_DEMO_MODE === "1") {
    return Response.json({ error: "Atualização de previsões indisponível." }, { status: 503 });
  }

  if (!authorized(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: routes, error } = await db.from("routes").select("id, latitude, longitude").order("id");
  if (error || !routes) return Response.json({ error: "Não foi possível consultar as rotas." }, { status: 502 });

  let updated = 0;
  let failed = 0;
  for (let offset = 0; offset < routes.length; offset += 6) {
    const batch = await Promise.allSettled(routes.slice(offset, offset + 6).map(async route => {
      const forecast = await fetchForecast(route);
      const result = await db.from("forecasts").upsert(forecast, { onConflict: "route_id" });
      if (result.error) throw result.error;
    }));
    for (const result of batch) {
      if (result.status === "fulfilled") updated += 1;
      else failed += 1;
    }
  }

  return Response.json({ updated, failed }, { status: failed ? 502 : 200 });
}
