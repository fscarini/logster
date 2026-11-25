import { HOUR, initialRoutes } from "./model";
import type { Assessment, Delivery, Forecast, FreightRoute } from "./model";

export function assess(delivery: Delivery, route: FreightRoute, forecast: Forecast | undefined, now: number): Assessment {
  const crossing = Date.parse(delivery.departure_at) + route.checkpoint_minutes * 60_000;
  const base = {
    checkpoint_at: new Date(crossing).toISOString(),
    rain_mm: null,
    forecast_at: null,
    delay_minutes: null,
    cost_cents: null,
    recommendation: null,
  } as const;

  if (crossing < now || crossing > now + 72 * HOUR) return { ...base, level: "outside" };
  if (!forecast || now - Date.parse(forecast.fetched_at) > 3 * HOUR) return { ...base, level: "unavailable" };

  const crossingHour = Math.floor(crossing / HOUR) * HOUR;
  const rain = forecast.hours.find(hour => Date.parse(hour.time) === crossingHour)?.rain_mm;
  if (rain === undefined) return { ...base, level: "unavailable" };

  const level = rain >= 15 ? "high" : rain >= 5 ? "moderate" : "low";
  const delay = level === "high" ? 120 : level === "moderate" ? 45 : 0;
  const futureHour = forecast.hours.find(hour => Date.parse(hour.time) === crossingHour + 2 * HOUR);
  const earlierHour = forecast.hours.find(hour => Date.parse(hour.time) === crossingHour - 2 * HOUR);
  const canAdvance = Date.parse(delivery.departure_at) - 2 * HOUR >= now && earlierHour && earlierHour.rain_mm < rain;
  const canPostpone = crossing + 2 * HOUR <= now + 72 * HOUR && futureHour && futureHour.rain_mm < rain;

  return {
    ...base,
    level,
    rain_mm: rain,
    forecast_at: forecast.fetched_at,
    delay_minutes: delay,
    cost_cents: Math.round(delivery.hour_cost_cents * delay / 60),
    recommendation: level === "low" ? null : canAdvance ? "advance" : canPostpone ? "postpone" : "reroute",
  };
}

export function demoForecast(route: FreightRoute, now: number): Forecast {
  const passedHour = Math.floor(now / HOUR) * HOUR;
  const typicalRain = route.id === initialRoutes[0].id ? 18 : route.id === initialRoutes[1].id ? 8 : 1;
  return {
    route_id: route.id,
    fetched_at: new Date(now).toISOString(),
    hours: Array.from({ length: 73 }, (_, offset) => ({
      time: new Date(passedHour + offset * HOUR).toISOString(),
      rain_mm: offset >= 4 && offset <= 9 ? typicalRain : 1,
    })),
  };
}
