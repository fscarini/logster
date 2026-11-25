"use client";

import { Activity, Bell, ClipboardList, Clock3, MapPin, Plus, RefreshCw, Route, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { riskLabels } from "../lib/model";
import type { Operations } from "../lib/model";
import { DeliveryDetail, dateTime, money } from "./DeliveryDetail";
import { Editors } from "./Editors";
import type { Editor } from "./Editors";

const tabs = { deliveries: "Entregas", alerts: "Alertas", routes: "Rotas" } as const;
type Tab = keyof typeof tabs;

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
  const [tab, setTab] = useState<Tab>("deliveries");
  const [selected, setSelected] = useState<string>();
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
        setPhase("login");
        return;
      }
      if (!response.ok) throw new Error("Não foi possível carregar a operação.");
      setData(await response.json());
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
        setPhase("login");
        setError("Sua sessão expirou. Entre para continuar.");
        return false;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setData(result);
      if (payload.action === "delivery") {
        setSelected(String(payload.id));
        setTab("deliveries");
      }
      if (payload.action === "route") setTab("routes");
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
  const high = alerts.filter(item => item.assessment.level === "high").length;

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
            <h1>Painel de operações</h1>
            <p>Monitore os trechos das suas entregas e registre ações preventivas.</p>
          </div>
          <button type="button" className="button primary" onClick={() => open("delivery")}><Plus size={19} /> Nova entrega</button>
        </div>

        <dl className="metrics">
          <div><dt><Route size={18} /> Rotas monitoradas</dt><dd>{routes.length}</dd></div>
          <div><dt><Truck size={18} /> Entregas registradas</dt><dd>{deliveries.length}</dd></div>
          <div><dt><Bell size={18} /> Risco alto em aberto</dt><dd>{high}</dd></div>
          <div><dt><Clock3 size={18} /> Janela de análise</dt><dd>72 h</dd></div>
        </dl>

        <nav className="view-tabs" aria-label="Seções do painel">
          {(Object.keys(tabs) as Tab[]).map(value => {
            const Icon = value === "deliveries" ? ClipboardList : value === "alerts" ? Bell : Route;
            return <button type="button" key={value} aria-pressed={tab === value} onClick={() => changeTab(value)}>
              <Icon size={17} /> {tabs[value]} {value === "alerts" && <span>{alerts.length}</span>}
            </button>;
          })}
        </nav>

        {error && !editor && <p role="alert" className="feedback error">{error}</p>}
        <div role="status" className={notice ? "feedback success" : "sr-only"}>{notice}</div>

        {tab === "routes" ? <section className="panel routes" aria-labelledby="routes-title">
          <div className="panel-title"><h2 id="routes-title">Rotas monitoradas</h2>
            <button type="button" className="button primary" onClick={() => open("route")}><Plus size={18} /> Nova rota</button></div>
          <ul>
            {routes.map(route => <li key={route.id}><div><strong>{route.origin} / {route.destination}</strong>
              <span><MapPin size={16} /> {route.checkpoint} · {route.checkpoint_minutes} min após a saída</span></div><b>{route.code}</b></li>)}
          </ul>
        </section> : <div className="operation-grid">
          <section className="panel shipment-list" aria-labelledby="list-title">
            <div className="panel-title"><h2 id="list-title">{tab === "alerts" ? "Alertas em aberto" : "Entregas planejadas"}</h2></div>
            {items.length ? <ul>{items.map(item => {
              const route = routes.find(candidate => candidate.id === item.route_id);
              return <li key={item.id}><button type="button" aria-pressed={current?.id === item.id} onClick={() => setSelected(item.id)}>
                <span className="item-heading"><strong>{item.reference}</strong><span className="risk" data-level={item.assessment.level}>{riskLabels[item.assessment.level]}</span></span>
                <span className="item-route">{route?.origin} / {route?.destination}</span>
                <span className="item-meta">{dateTime(item.departure_at)} {item.assessment.cost_cents !== null && `· ${money(item.assessment.cost_cents)}`}</span>
              </button></li>;
            })}</ul> : <p className="empty">{tab === "alerts" ? "Nenhum alerta aguarda decisão." : "Cadastre sua primeira entrega para iniciar a análise."}</p>}
          </section>
          {current && currentRoute && <DeliveryDetail key={current.id} delivery={current} route={currentRoute} simulated={data.mode === "demo"} busy={busy} save={save} />}
        </div>}

        {editor && <Editors key={editor.id} editor={editor} routes={routes} busy={busy} error={error} save={save} close={() => { setEditor(null); setError(""); }} />}
      </>}
    </main>
  </>;
}
