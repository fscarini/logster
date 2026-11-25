import type { Forecast, ForecastHour, FreightRoute } from "./model";

type Location = Pick<FreightRoute, "id" | "latitude" | "longitude">;

const VARIABLES = ["precipitation", "precipitation_probability", "wind_gusts_10m", "visibility", "weather_code", "temperature_2m"] as const;

function numberAt(list: unknown, index: number, min = -Infinity) {
  const value: unknown = Array.isArray(list) ? list[index] : undefined;
  return typeof value === "number" && Number.isFinite(value) && value >= min ? value : null;
}

/** Previsão horária no ponto monitorado (Open-Meteo): chuva, probabilidade, rajadas, visibilidade e tipo de tempo. */
export async function fetchForecast(route: Location): Promise<Forecast> {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.search = new URLSearchParams({
    latitude: String(route.latitude),
    longitude: String(route.longitude),
    hourly: VARIABLES.join(","),
    wind_speed_unit: "kmh",
    timeformat: "unixtime",
    timezone: "GMT",
    forecast_days: "4",
  }).toString();

  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!response.ok) throw new Error(`Open-Meteo HTTP ${response.status}`);
  const data: { hourly?: Record<string, unknown> } = await response.json();
  const hourly = data.hourly ?? {};
  const times = hourly.time;
  if (!Array.isArray(times) || times.length === 0) throw new Error("Previsão inválida.");

  const hours = times.flatMap((seconds: unknown, index): ForecastHour[] => {
    const rain = numberAt(hourly.precipitation, index, 0);
    if (typeof seconds !== "number" || !Number.isFinite(seconds) || rain === null) return [];
    return [{
      time: new Date(seconds * 1000).toISOString(),
      rain_mm: rain,
      probability: numberAt(hourly.precipitation_probability, index, 0),
      gust_kmh: numberAt(hourly.wind_gusts_10m, index, 0),
      visibility_m: numberAt(hourly.visibility, index, 0),
      code: numberAt(hourly.weather_code, index, 0),
      temp_c: numberAt(hourly.temperature_2m, index),
    }];
  });

  if (hours.length === 0) throw new Error("Previsão sem chuva horária disponível.");
  return { route_id: route.id, fetched_at: new Date().toISOString(), hours };
}
