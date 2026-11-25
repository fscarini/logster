"use client";

import { Activity, Bell, ClipboardList, LayoutDashboard, MapPin, Plus, RefreshCw, Route } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { riskLabels } from "../lib/model";
import type { DeliveryView, Operations, RouteView } from "../lib/model";
import { bucketOf } from "../lib/dashboard";
import type { RiskBucket } from "../lib/dashboard";
import { BrazilMap } from "./BrazilMap";
import type { MapRoute } from "./BrazilMap";
import { Dashboard } from "./Dashboard";
import { DeliveryDetail, dateTime, money } from "./DeliveryDetail";
import { Editors } from "./Editors";
import { hazardSummary } from "./Weather";
import type { Editor } from "./Editors";

// Quando configurada, a tela de login da landing page é a porta de entrada do SaaS.
const landing = process.env.NEXT_PUBLIC_LOGSTER_LANDING_URL;
function goToLanding(reason: "entrar" | "expirada" | "saiu") {
  if (!landing) return false;
  const target = new URL("/", landing);
  if (reason !== "saiu") {
    target.searchParams.set("login", reason);
    target.hash = "entrar";
  }
  window.location.replace(target);
  return true;
}

const tabs = { dashboard: "Visão geral", deliveries: "Entregas", alerts: "Alertas", routes: "Rotas" } as const;
const tabIcons = { dashboard: LayoutDashboard, deliveries: ClipboardList, alerts: Bell, routes: Route } as const;
type Tab = keyof typeof tabs;

const severity: RiskBucket[] = ["high", "moderate", "low", "none"];
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function toMapRoute(route: RouteView, deliveries: DeliveryView[] = []): MapRoute {
  const levels = deliveries.map(item => bucketOf(item.assessment.level));
  const level = severity.find(value => levels.includes(value)) ?? "none";
  const detail = [
    route.distance_km !== null ? `${route.distance_km.toLocaleString("pt-BR")} km · ${route.highways.join(", ")}` : `${route.code} · traçado manual`,
    `Ponto monitorado: ${route.checkpoint}`,
  ];
  if (deliveries.length) detail.push(plural(deliveries.length, "entrega", "entregas"));
  const worst = deliveries.find(item => item.assessment.hazards?.length);
  const summary = worst && hazardSummary(worst.assessment.hazards);
  if (summary) detail.push(summary);
  return {
    id: route.id,
    title: `${route.origin} → ${route.destination}`,
    detail,
    path: route.path,
    checkpoint: [route.longitude, route.latitude],
    origin: route.origin,
    destination: route.destination,
    level,
  };
}

async function api(path: string, payload?: Record<string, unknown>) {
  return fetch(path, payload ? {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  } : { cache: "no-store" });
}

export function Workspace() {
  const [data, setData] = useState<Operations | null>(null);
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "error">("loading");
  const [tab, setTab] = useState<Tab>("dashboard");
  const [loadedAt, setLoadedAt] = useState(0);
  const [selected, setSelected] = useState<string>();
  const [selectedRoute, setSelectedRoute] = useState<string>();
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => { void load(); }, []);

  async function load() {
    setError("");
    try {
      const response = await api("/api/operations");
      if (response.status === 401) {
        setData(null);
        if (goToLanding("entrar")) return;
        setPhase("login");
        return;
      }
      if (!response.ok) throw new Error("Não foi possível carregar a operação.");
      setData(await response.json());
      setLoadedAt(Date.now());
      setPhase("ready");
    } catch {
      setError("Não foi possível carregar a operação. Tente novamente.");
      setPhase("error");
    }
  }

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api("/api/operations", payload);
      if (response.status === 401) {
        setData(null);
        setEditor(null);
        if (goToLanding("expirada")) return false;
        setPhase("login");
        setError("Sua sessão expirou. Entre para continuar.");
        return false;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      setLoadedAt(Date.now());
      if (payload.action === "delivery") {
        setSelected(String(payload.id));
        setTab("deliveries");
      }
      if (payload.action === "route") {
        setSelectedRoute(String(payload.id));
        setTab("routes");
      }
      setNotice(payload.action === "decision" ? "Decisão registrada." : payload.action === "route" ? "Rota cadastrada." : "Entrega cadastrada.");
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível salvar.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function session(action: "login" | "logout", event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const form = event ? new FormData(event.currentTarget) : null;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await api("/api/session", { action, email: form?.get("email"), password: form?.get("password") });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (action === "logout" && goToLanding("saiu")) return;
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Não foi possível acessar a conta.");
    } finally {
      setBusy(false);
    }
  }

  function open(kind: Editor["kind"]) {
    setError("");
    setNotice("");
    setEditor({ kind, id: crypto.randomUUID() });
  }

  function changeTab(value: Tab) {
    setError("");
    setNotice("");
    setTab(value);
  }

  const routes = data?.routes ?? [];
  const deliveries = data?.deliveries ?? [];
  const alerts = deliveries.filter(item => item.assessment.recommendation !== null && !item.decision);
  const items = tab === "alerts" ? alerts : deliveries;
  const current = items.find(item => item.id === selected) ?? items[0];
  const currentRoute = routes.find(route => route.id === current?.route_id);
  const shownRoutes = routes.filter(route => items.some(item => item.route_id === route.id));
  const deliveryMap = (shownRoutes.length ? shownRoutes : routes).map(route => toMapRoute(route, items.filter(item => item.route_id === route.id)));
  const routeMap = routes.map(route => toMapRoute(route, deliveries.filter(item => item.route_id === route.id)));
  const activeRoute = routes.find(route => route.id === selectedRoute) ?? routes[0];

  function selectRouteOnMap(routeId: string) {
    const first = items.find(item => item.route_id === routeId);
    if (first) setSelected(first.id);
  }

  function openDelivery(id: string) {
    setError("");
    setNotice("");
    setSelected(id);
    setTab("alerts");
  }

  return <>
    <a className="skip" href="#conteudo">Ir para o conteúdo</a>
    <header className="topbar">
      <div className="shell topbar-inner">
        <a className="brand" href="/" aria-label="Logster, início"><img width="43" height="26" src="/logster-mark.svg" alt="" /> Logster</a>
        {data && <div className="top-actions">
          {data.mode === "demo" && <span className="mode">Dados simulados</span>}
          <button type="button" className="icon-button" aria-label="Atualizar painel" disabled={busy} onClick={async () => {
            setBusy(true);
            try { await load(); } finally { setBusy(false); }
          }}><RefreshCw size={19} /></button>
          {data.mode === "supabase" && <button type="button" className="button secondary" disabled={busy} onClick={() => void session("logout")}>Sair</button>}
        </div>}
      </div>
    </header>

    <main id="conteudo" className="shell main">
      {phase === "loading" && <p className="feedback" role="status">Carregando painel…</p>}
      {phase === "error" && <div className="feedback error" role="alert">{error} <button className="button secondary" onClick={() => void load()}>Tentar novamente</button></div>}
      {phase === "login" && <section className="panel login" aria-labelledby="login-title">
        <div className="eyebrow"><Activity size={16} /> Painel de operações</div>
        <h1 id="login-title">Entre na Logster.</h1>
        <form onSubmit={event => void session("login", event)}>
          <label>E-mail <input name="email" type="email" autoComplete="username" required /></label>
          <label>Senha <input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <p role="alert" className="feedback error">{error}</p>}
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        </form>
      </section>}
      {phase === "ready" && data && <>
        <div className="overview">
          <div>
            <p className="eyebrow"><Activity size={16} /> Planejamento rodoviário</p>
            <h1>{tab === "dashboard" ? "Painel gerencial" : "Painel de operações"}</h1>
            <p>{tab === "dashboard"
              ? `${routes.length} ${routes.length === 1 ? "rota monitorada" : "rotas monitoradas"} · janela de análise de 72 h · atualizado às ${new Date(loadedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`
              : "Monitore os trechos das suas entregas e registre ações preventivas."}</p>
          </div>
          <button type="button" className="button primary" onClick={() => open("delivery")}><Plus size={19} /> Nova entrega</button>
        </div>

        <nav className="view-tabs" aria-label="Seções do painel">
          {(Object.keys(tabs) as Tab[]).map(value => {
            const Icon = tabIcons[value];
            return <button type="button" key={value} aria-pressed={tab === value} onClick={() => changeTab(value)}>
              <Icon size={17} /> {tabs[value]} {value === "alerts" && <span>{alerts.length}</span>}
            </button>;
          })}
        </nav>

        {error && !editor && <p role="alert" className="feedback error">{error}</p>}
        <div role="status" className={notice ? "feedback success" : "sr-only"}>{notice}</div>

        {tab === "dashboard" ? <Dashboard data={data} now={loadedAt} openDelivery={openDelivery} newDelivery={() => open("delivery")} />
        : tab === "routes" ? <div className="map-layout">
          <section className="panel map-panel" aria-labelledby="routes-map-title">
            <div className="panel-title"><h2 id="routes-map-title">Mapa das rotas</h2><span className="metadata">Malha rodoviária federal</span></div>
            <BrazilMap routes={routeMap} selectedId={activeRoute?.id} onSelect={setSelectedRoute} fitKey={activeRoute?.id}
              label="Mapa do Brasil com as rotas monitoradas. Use as setas para mover e + ou − para aproximar." />
          </section>
          <section className="panel routes" aria-labelledby="routes-title">
            <div className="panel-title"><h2 id="routes-title">Rotas monitoradas</h2>
              <button type="button" className="button primary" onClick={() => open("route")}><Plus size={18} /> Nova rota</button></div>
            <ul>
              {routes.map(route => <li key={route.id}><button type="button" aria-pressed={activeRoute?.id === route.id} onClick={() => setSelectedRoute(route.id)}>
                <span className="item-heading"><strong>{route.origin} → {route.destination}</strong><b>{route.code}</b></span>
                {route.distance_km !== null && <span className="item-meta">{route.distance_km.toLocaleString("pt-BR")} km · {route.highways.join(", ")}</span>}
                <span className="item-meta"><MapPin size={15} /> {route.checkpoint} · {route.checkpoint_minutes} min após a saída</span>
              </button></li>)}
            </ul>
          </section>
        </div> : <>
        <section className="panel map-panel deliveries-map" aria-labelledby="deliveries-map-title">
          <div className="panel-title"><h2 id="deliveries-map-title">{tab === "alerts" ? "Alertas no mapa" : "Entregas no mapa"}</h2>
            <span className="metadata">Clique em uma rota para ver a entrega</span></div>
          <BrazilMap routes={deliveryMap} selectedId={currentRoute?.id} onSelect={selectRouteOnMap} fitKey={`${tab}:${currentRoute?.id ?? ""}`}
            label="Mapa do Brasil com as rotas das entregas e o risco no ponto monitorado. Use as setas para mover e + ou − para aproximar." />
        </section>
        <div className="operation-grid">
          <section className="panel shipment-list" aria-labelledby="list-title">
            <div className="panel-title"><h2 id="list-title">{tab === "alerts" ? "Alertas em aberto" : "Entregas planejadas"}</h2></div>
            {items.length ? <ul>{items.map(item => {
              const route = routes.find(candidate => candidate.id === item.route_id);
              return <li key={item.id}><button type="button" aria-pressed={current?.id === item.id} onClick={() => setSelected(item.id)}>
                <span className="item-heading"><strong>{item.reference}</strong><span className="risk" data-level={item.assessment.level}>{riskLabels[item.assessment.level]}</span></span>
                <span className="item-route">{route?.origin} / {route?.destination}</span>
                {hazardSummary(item.assessment.hazards) && <span className="item-hazard">{hazardSummary(item.assessment.hazards)}</span>}
                <span className="item-meta">{dateTime(item.departure_at)} {item.assessment.cost_cents !== null && `· ${money(item.assessment.cost_cents)}`}</span>
              </button></li>;
            })}</ul> : <p className="empty">{tab === "alerts" ? "Nenhum alerta aguarda decisão." : "Cadastre sua primeira entrega para iniciar a análise."}</p>}
          </section>
          {current && currentRoute && <DeliveryDetail key={current.id} delivery={current} route={currentRoute} simulated={data.mode === "demo"} busy={busy} save={save} />}
        </div>
        </>}

        {editor && <Editors key={editor.id} editor={editor} routes={routes} busy={busy} error={error} save={save} close={() => { setEditor(null); setError(""); }} />}
      </>}
    </main>
  </>;
}
