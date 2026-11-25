import type { Forecast, FreightRoute } from "./model";

type Location = Pick<FreightRoute, "id" | "latitude" | "longitude">;

export async function fetchForecast(route: Location): Promise<Forecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(route.latitude),
    longitude: String(route.longitude),
    hourly: "precipitation",
    timeformat: "unixtime",
    timezone: "GMT",
    forecast_days: "4",
  }).toString();

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  const data: { hourly?: { time?: unknown; precipitation?: unknown } } = await response.json();
  const times = data.hourly?.time;
  const rain = data.hourly?.precipitation;
  if (!Array.isArray(times) || !Array.isArray(rain) || times.length !== rain.length || times.length === 0) {
    throw new Error("Previsão inválida.");
  }

  const hours = times.flatMap((seconds: unknown, index) => {
    const mm: unknown = rain[index];
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || typeof mm !== "number" || !Number.isFinite(mm) || mm < 0) return [];
    return [{ time: new Date(seconds * 1000).toISOString(), rain_mm: mm }];
  });

  if (hours.length === 0) throw new Error("Previsão sem chuva horária disponível.");
  return { route_id: route.id, fetched_at: new Date().toISOString(), hours };
}
