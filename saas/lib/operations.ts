import { authenticatedStore, isDemoMode } from "./supabase";
import { HOUR, choices } from "./model";
import type { Choice, Operations } from "./model";
import { assess } from "./risk";
import { InputError, readNumber, readText, uuid } from "./inputs";
import type { Store } from "./store";

export async function getStore() {
  if (isDemoMode()) {
    const { demoStore } = await import("./demo");
    return demoStore();
  }
  return authenticatedStore();
}

export async function operations(store: Store): Promise<Operations> {
  const { routes, deliveries, decisions, forecasts } = await store.load();
  const routeById = new Map(routes.map(route => [route.id, route]));
  const forecastByRoute = new Map(forecasts.map(forecast => [forecast.route_id, forecast]));
  const decisionByDelivery = new Map(decisions.map(decision => [decision.delivery_id, decision]));
  const now = Date.now();

  return {
    mode: store.mode,
    routes,
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
    await store.addRoute({
      id,
      code: readText(input.code, "o código da rodovia", 24).toUpperCase(),
      origin: readText(input.origin, "a origem", 80),
      destination: readText(input.destination, "o destino", 80),
      checkpoint: readText(input.checkpoint, "o trecho monitorado", 90),
      latitude: readNumber(input.latitude, "a latitude", -90, 90),
      longitude: readNumber(input.longitude, "a longitude", -180, 180),
      checkpoint_minutes: Math.round(readNumber(input.checkpointMinutes, "os minutos até o trecho", 0, 2880)),
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
