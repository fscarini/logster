import { authenticatedStore, isDemoMode } from "./supabase";
import { HOUR, choices } from "./model";
import type { Choice, Forecast, FreightRoute, Operations, RouteView } from "./model";
import { assess } from "./risk";
import { InputError, readNumber, readText, uuid } from "./inputs";
import { cityLabel, planRoute } from "./roads";
import { fetchForecast } from "./weather";

const REFRESH_AFTER = HOUR;

/** Atualiza sob demanda as previsões ausentes ou com mais de uma hora, sem depender do agendamento. */
async function refreshForecasts(store: Store, routes: FreightRoute[], forecasts: Forecast[], now: number) {
  if (!store.saveForecasts) return forecasts;
  const byRoute = new Map(forecasts.map(item => [item.route_id, item]));
  const stale = routes.filter(route => {
    const current = byRoute.get(route.id);
    return !current || now - Date.parse(current.fetched_at) > REFRESH_AFTER;
  }).slice(0, 12);
  if (!stale.length) return forecasts;
  const fresh: Forecast[] = [];
  for (let offset = 0; offset < stale.length; offset += 4) {
    const batch = await Promise.allSettled(stale.slice(offset, offset + 4).map(route => fetchForecast(route)));
    batch.forEach(result => { if (result.status === "fulfilled") fresh.push(result.value); });
  }
  if (!fresh.length) return forecasts;
  try {
    await store.saveForecasts(fresh);
  } catch (error) {
    console.error("Falha ao gravar previsões Logster", error);
  }
  fresh.forEach(item => byRoute.set(item.route_id, item));
  return [...byRoute.values()];
}
import type { Store } from "./store";

export async function getStore() {
  if (isDemoMode()) {
    const { demoStore } = await import("./demo");
    return demoStore();
  }
  return authenticatedStore();
}

function toView(route: FreightRoute, forecast: Forecast | undefined, simulated: boolean, now: number): RouteView {
  const plan = route.origin_code && route.destination_code ? planRoute(route.origin_code, route.destination_code) : null;
  const from = Math.floor(now / HOUR) * HOUR - HOUR;
  const until = now + 72 * HOUR;
  return {
    ...route,
    distance_km: plan?.distance_km ?? null,
    highways: plan?.highways ?? [],
    path: plan?.path ?? null,
    forecast: forecast ? {
      fetched_at: forecast.fetched_at,
      simulated,
      hours: forecast.hours.filter(hour => {
        const time = Date.parse(hour.time);
        return time >= from && time <= until;
      }),
    } : null,
  };
}

function readCity(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || !cityLabel(value)) throw new InputError(`Selecione ${label} no catálogo de municípios.`);
  return value;
}

export async function operations(store: Store): Promise<Operations> {
  const { routes, deliveries, decisions, forecasts: stored } = await store.load();
  const now = Date.now();
  const routeById = new Map(routes.map(route => [route.id, route]));
  // Só vale atualizar rotas com passagem prevista na janela de 72 horas.
  const active = routes.filter(route => deliveries.some(delivery => {
    if (delivery.route_id !== route.id) return false;
    const crossing = Date.parse(delivery.departure_at) + route.checkpoint_minutes * 60_000;
    return crossing >= now - HOUR && crossing <= now + 72 * HOUR;
  }));
  const forecasts = await refreshForecasts(store, active, stored, now);
  const forecastByRoute = new Map(forecasts.map(forecast => [forecast.route_id, forecast]));
  const decisionByDelivery = new Map(decisions.map(decision => [decision.delivery_id, decision]));

  return {
    mode: store.mode,
    routes: routes.map(route => toView(route, forecastByRoute.get(route.id), store.mode === "demo", now)),
    deliveries: deliveries.flatMap(delivery => {
      const route = routeById.get(delivery.route_id);
      if (!route) return [];
      return [{
        ...delivery,
        assessment: assess(delivery, route, forecastByRoute.get(route.id), now),
        decision: decisionByDelivery.get(delivery.id) ?? null,
      }];
    }).sort((a, b) => Date.parse(a.departure_at) - Date.parse(b.departure_at)),
  };
}

function inputId(input: unknown) {
  if (typeof input !== "string" || !uuid.test(input)) throw new InputError("Identificador inválido.");
  return input.toLowerCase();
}

export async function applyOperation(store: Store, input: Record<string, unknown>) {
  const id = inputId(input.id);

  if (input.action === "route") {
    // A rota é sempre derivada do catálogo no servidor: o cliente envia apenas os códigos escolhidos.
    const originCode = readCity(input.originCode, "a origem");
    const destinationCode = readCity(input.destinationCode, "o destino");
    if (originCode === destinationCode) throw new InputError("Escolha cidades diferentes para origem e destino.");
    const plan = planRoute(originCode, destinationCode);
    if (!plan) throw new InputError("Não há ligação pela malha rodoviária federal entre essas cidades.");
    const segment = plan.segments.find(item => item.snv === input.checkpointSnv);
    if (!segment) throw new InputError("Selecione um trecho monitorado da rota.");

    const highways = plan.highways.map(code => code.replace("BR-", ""));
    let code = "BR-";
    for (const [index, highway] of highways.entries()) {
      const next = `${code}${index ? "/" : ""}${highway}`;
      if (next.length > 24) break;
      code = next;
    }
    const checkpoint = segment.label.length > 90 ? `${segment.label.slice(0, 89)}…` : segment.label;
    await store.addRoute({
      id,
      code,
      origin: `${plan.origin.name}/${plan.origin.uf}`,
      destination: `${plan.destination.name}/${plan.destination.uf}`,
      checkpoint,
      latitude: segment.latitude,
      longitude: segment.longitude,
      checkpoint_minutes: segment.minutes_from_origin,
      origin_code: originCode,
      destination_code: destinationCode,
      checkpoint_snv: segment.snv,
    });
    return;
  }

  const current = await operations(store);

  if (input.action === "delivery") {
    if (current.deliveries.some(delivery => delivery.id === id)) return;
    const routeId = inputId(input.routeId);
    if (!current.routes.some(route => route.id === routeId)) throw new InputError("Selecione uma rota válida.");

    const date = typeof input.departureAt === "string" ? Date.parse(input.departureAt) : NaN;
    const now = Date.now();
    if (!Number.isFinite(date) || date < now - 60_000 || date > now + 720 * HOUR) {
      throw new InputError("Escolha uma saída futura, dentro dos próximos 30 dias.");
    }

    await store.addDelivery({
      id,
      route_id: routeId,
      reference: readText(input.reference, "a referência", 60),
      departure_at: new Date(date).toISOString(),
      hour_cost_cents: Math.round(100 * readNumber(input.hourCost, "o custo por hora", 0, 100000)),
    });
    return;
  }

  if (input.action === "decision") {
    const delivery = current.deliveries.find(item => item.id === id);
    const choice = input.choice;
    if (!delivery) throw new InputError("Entrega não encontrada.");
    if (delivery.decision) return;
    if (!delivery.assessment.recommendation) throw new InputError("A entrega precisa ter um alerta ativo para registrar uma ação.");
    if (typeof choice !== "string" || !Object.hasOwn(choices, choice)) throw new InputError("Selecione uma ação válida.");

    await store.recordDecision({
      delivery_id: id,
      choice: choice as Choice,
      note: readText(input.note, "a observação", 350, true),
      recorded_at: new Date().toISOString(),
      assessment: delivery.assessment,
    });
    return;
  }
  throw new InputError("Operação inválida.");
}
