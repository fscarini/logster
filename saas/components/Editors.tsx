"use client";

import { ArrowLeftRight, Route as RouteIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { City, RoutePlan, RouteView } from "../lib/model";
import { BrazilMap } from "./BrazilMap";
import { delayText } from "./DeliveryDetail";

export type Editor = { kind: "delivery" | "route"; id: string };
export type Save = (payload: Record<string, unknown>) => Promise<boolean>;

function localInputTime(hours: number) {
  const time = new Date(Date.now() + hours * 3_600_000);
  const local = new Date(time.getTime() - time.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

type Catalog = { version: string; cities: City[] };
type RouteChoice = { origin: number; destination: number; checkpoint: string };

let catalogPromise: Promise<Catalog> | null = null;
function loadCatalog() {
  catalogPromise ??= fetch("/api/catalog").then(response => {
    if (!response.ok) throw new Error("Catálogo indisponível");
    return response.json() as Promise<Catalog>;
  }).catch(error => { catalogPromise = null; throw error; });
  return catalogPromise;
}

function RouteFields({ onChange }: { onChange: (value: RouteChoice | null) => void }) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [plan, setPlan] = useState<RoutePlan | null>(null);
  const [checkpoint, setCheckpoint] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadCatalog().then(setCatalog).catch(() => { setStatus("error"); setMessage("Não foi possível carregar o catálogo de cidades."); });
  }, []);

  useEffect(() => {
    setPlan(null);
    setCheckpoint("");
    if (!origin || !destination) { setStatus("idle"); setMessage(""); return; }
    if (origin === destination) { setStatus("error"); setMessage("Escolha cidades diferentes para origem e destino."); return; }
    const controller = new AbortController();
    setStatus("loading");
    setMessage("");
    fetch(`/api/catalog/route?from=${origin}&to=${destination}`, { signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error);
        const next = result as RoutePlan;
        setPlan(next);
        // Sugere o trecho no meio do percurso; o usuário escolhe o ponto crítico.
        const half = next.distance_km / 2;
        const middle = next.segments.reduce((best, item) => Math.abs(item.km_from_origin - half) < Math.abs(best.km_from_origin - half) ? item : best, next.segments[0]);
        setCheckpoint(middle?.snv ?? "");
        setStatus("idle");
      })
      .catch(failure => {
        if (controller.signal.aborted) return;
        setStatus("error");
        setMessage(failure instanceof Error && failure.message ? failure.message : "Não foi possível traçar a rota.");
      });
    return () => controller.abort();
  }, [origin, destination]);

  useEffect(() => {
    onChange(plan && checkpoint ? { origin: plan.origin.code, destination: plan.destination.code, checkpoint } : null);
  }, [plan, checkpoint, onChange]);

  const byUf = new Map<string, City[]>();
  catalog?.cities.forEach(city => byUf.set(city.uf, [...(byUf.get(city.uf) ?? []), city]));
  const options = [...byUf.entries()].map(([uf, list]) => <optgroup key={uf} label={uf}>
    {list.map(city => <option key={city.code} value={city.code}>{city.name}/{city.uf}</option>)}
  </optgroup>);
  const segment = plan?.segments.find(item => item.snv === checkpoint);
  const groups = new Map<string, RoutePlan["segments"]>();
  plan?.segments.forEach(item => {
    const key = `${item.highway}/${item.uf}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  return <>
    <div className="route-cities">
      <label>Origem <select value={origin} onChange={event => setOrigin(event.target.value)} required autoFocus disabled={!catalog}>
        <option value="" disabled>{catalog ? "Selecione a cidade" : "Carregando cidades…"}</option>{options}
      </select></label>
      <button type="button" className="icon-button" aria-label="Inverter origem e destino" disabled={!origin && !destination}
        onClick={() => { setOrigin(destination); setDestination(origin); }}><ArrowLeftRight size={17} /></button>
      <label>Destino <select value={destination} onChange={event => setDestination(event.target.value)} required disabled={!catalog}>
        <option value="" disabled>{catalog ? "Selecione a cidade" : "Carregando cidades…"}</option>{options}
      </select></label>
    </div>
    {status === "loading" && <p className="feedback" role="status">Traçando a rota pela malha federal…</p>}
    {status === "error" && <p className="feedback error" role="alert">{message}</p>}
    {plan && <>
      <div className="route-summary">
        <RouteIcon size={18} />
        <p><strong>{plan.distance_km.toLocaleString("pt-BR")} km</strong> · cerca de {delayText(plan.duration_minutes)} a 60 km/h<br />
          <span className="metadata">{plan.highways.join(" → ")}</span></p>
      </div>
      <BrazilMap className="compact" pointLabel="Ponto monitorado" label={`Prévia da rota de ${plan.origin.name} a ${plan.destination.name}`} selectedId="preview"
        fitKey={`${plan.origin.code}:${plan.destination.code}`}
        routes={[{
          id: "preview",
          title: `${plan.origin.name}/${plan.origin.uf} → ${plan.destination.name}/${plan.destination.uf}`,
          detail: segment ? [`Ponto monitorado: ${segment.label}`] : [],
          path: plan.path,
          checkpoint: segment ? [segment.longitude, segment.latitude] : plan.path[Math.floor(plan.path.length / 2)],
          origin: plan.origin.name,
          destination: plan.destination.name,
          level: "none",
        }]} />
      <label>Trecho monitorado (SNV) <select value={checkpoint} onChange={event => setCheckpoint(event.target.value)} required>
        {[...groups.entries()].map(([key, list]) => <optgroup key={key} label={key}>
          {list.map(item => <option key={item.snv} value={item.snv}>km {item.km_from_origin.toLocaleString("pt-BR")} da rota · {item.label.split(" · ").slice(1).join(" · ")}</option>)}
        </optgroup>)}
      </select></label>
      {segment && <small>Passagem estimada {delayText(segment.minutes_from_origin)} após a saída. A previsão do tempo usa o ponto médio do trecho {segment.snv}.</small>}
    </>}
  </>;
}

export function Editors({ editor, routes, busy, error, save, close }: {
  editor: Editor;
  routes: RouteView[];
  busy: boolean;
  error: string;
  save: Save;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);

  const isRoute = editor.kind === "route";
  const [routeChoice, setRouteChoice] = useState<RouteChoice | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { action: editor.kind, id: editor.id };
    if (isRoute) {
      if (!routeChoice) return;
      payload.originCode = routeChoice.origin;
      payload.destinationCode = routeChoice.destination;
      payload.checkpointSnv = routeChoice.checkpoint;
    } else {
      payload.routeId = fields.get("routeId");
      payload.reference = fields.get("reference");
      payload.hourCost = Number(fields.get("hourCost"));
      const departure = new Date(String(fields.get("departureAt")));
      if (!Number.isFinite(departure.valueOf())) return;
      payload.departureAt = departure.toISOString();
    }
    if (await save(payload)) dialog.current?.close();
  }

  return <dialog ref={dialog} className={`editor${isRoute ? " wide" : ""}`} aria-labelledby="editor-title" onClose={close}
    onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="editor-heading">
      <div>
        <h2 id="editor-title">{isRoute ? "Nova rota" : "Nova entrega"}</h2>
        <p>{isRoute ? "Escolha cidades atendidas pela malha federal. O traçado segue as rodovias do SNV/DNIT." : "Vincule a entrega a uma rota monitorada."}</p>
      </div>
      <button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={() => dialog.current?.close()}><X size={20} /></button>
    </div>
    <form className="editor-body" onSubmit={submit}>
      {isRoute ? <>
        <RouteFields onChange={setRouteChoice} />
      </> : <>
        <label>Referência <input name="reference" placeholder="Ex.: CARGA-104" maxLength={60} required autoFocus /></label>
        <label>Rota <select name="routeId" required>
          {routes.map(route => <option key={route.id} value={route.id}>{route.code} · {route.origin} / {route.destination}</option>)}
        </select></label>
        <div className="form-grid">
          <label>Saída prevista <input name="departureAt" type="datetime-local" defaultValue={localInputTime(4)} required /></label>
          <label>Custo de espera por hora (R$) <input name="hourCost" type="number" min={0} max={100000} step=".01" defaultValue="250" required /></label>
        </div>
        <small>A hora de saída usa o fuso do seu dispositivo.</small>
      </>}
      {error && <p className="feedback error" role="alert">{error}</p>}
      <div className="editor-actions">
        <button type="button" className="button secondary" onClick={() => dialog.current?.close()} disabled={busy}>Cancelar</button>
        <button type="submit" className="button primary" disabled={busy || (isRoute && !routeChoice)}>{busy ? "Salvando…" : isRoute ? "Salvar rota" : "Salvar entrega"}</button>
      </div>
    </form>
  </dialog>;
}
