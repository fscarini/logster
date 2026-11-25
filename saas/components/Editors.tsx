"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FormEvent } from "react";
import type { FreightRoute } from "../lib/model";

export type Editor = { kind: "delivery" | "route"; id: string };
export type Save = (payload: Record<string, unknown>) => Promise<boolean>;

function localInputTime(hours: number) {
  const time = new Date(Date.now() + hours * 3_600_000);
  const local = new Date(time.getTime() - time.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function Editors({ editor, routes, busy, error, save, close }: {
  editor: Editor;
  routes: FreightRoute[];
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = { action: editor.kind, id: editor.id };
    if (isRoute) {
      for (const key of ["code", "origin", "destination", "checkpoint"]) payload[key] = fields.get(key);
      for (const key of ["latitude", "longitude", "checkpointMinutes"]) payload[key] = Number(fields.get(key));
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

  return <dialog ref={dialog} className="editor" aria-labelledby="editor-title" onClose={close}
    onCancel={event => { if (busy) event.preventDefault(); }}>
    <div className="editor-heading">
      <div>
        <h2 id="editor-title">{isRoute ? "Nova rota" : "Nova entrega"}</h2>
        <p>{isRoute ? "Defina um ponto de referência para a previsão." : "Vincule a entrega a uma rota monitorada."}</p>
      </div>
      <button type="button" className="icon-button" aria-label="Fechar" disabled={busy} onClick={() => dialog.current?.close()}><X size={20} /></button>
    </div>
    <form className="editor-body" onSubmit={submit}>
      {isRoute ? <>
        <div className="form-grid">
          <label>Rodovia <input name="code" placeholder="BR-116" maxLength={24} required autoFocus /></label>
          <label>Minutos até o trecho <input name="checkpointMinutes" type="number" min={0} max={2880} required /></label>
          <label>Origem <input name="origin" maxLength={80} required /></label>
          <label>Destino <input name="destination" maxLength={80} required /></label>
        </div>
        <label>Trecho monitorado <input name="checkpoint" maxLength={90} required /></label>
        <div className="form-grid">
          <label>Latitude <input name="latitude" type="number" step="any" min={-90} max={90} placeholder="-23,975" required /></label>
          <label>Longitude <input name="longitude" type="number" step="any" min={-180} max={180} placeholder="-47,155" required /></label>
        </div>
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
        <button type="submit" className="button primary" disabled={busy}>{busy ? "Salvando…" : isRoute ? "Salvar rota" : "Salvar entrega"}</button>
      </div>
    </form>
  </dialog>;
}
