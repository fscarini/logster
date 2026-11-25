"use client";

import { CheckCircle2, CloudRain, MapPin, Zap } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { choices, riskLabels } from "../lib/model";
import type { Assessment, Choice, DeliveryView, RouteView } from "../lib/model";
import type { Save } from "./Editors";
import { ForecastChart, HazardChips } from "./Weather";

const moneyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
export const money = (cents: number) => moneyFormatter.format(cents / 100);
export const dateTime = (date: string) => dateFormatter.format(new Date(date));
export const delayText = (minutes: number) => minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ""}`;

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const levelWord = { low: "baixo", moderate: "moderado", high: "alto" } as const;

function recommendationText(assessment: Assessment) {
  const alternative = assessment.alternative;
  if (!alternative) {
    return "Nenhuma saída 2 ou 4 horas antes ou depois reduz o risco no ponto monitorado. Avalie um desvio ou reprograme a entrega.";
  }
  const hours = Math.abs(alternative.shift_hours);
  const verb = alternative.shift_hours < 0 ? "Antecipar" : "Adiar";
  const saving = (assessment.cost_cents ?? 0) - alternative.cost_cents;
  return `${verb} a saída em ${hours} h leva a passagem para ${timeFormatter.format(new Date(alternative.checkpoint_at))}, com ${alternative.rain_mm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mm/h e risco ${levelWord[alternative.level]}.${saving > 0 ? ` Economia estimada: ${money(saving)}.` : ""}`;
}

export function DeliveryDetail({ delivery, route, simulated, busy, save }: {
  delivery: DeliveryView;
  route: RouteView;
  simulated: boolean;
  busy: boolean;
  save: Save;
}) {
  const { assessment, decision } = delivery;
  const [choice, setChoice] = useState<Choice | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await save({ action: "decision", id: delivery.id, choice: choice ?? assessment.recommendation, note: data.get("note") });
  }

  return <section className="panel detail" aria-labelledby="detail-title">
    <div className="detail-body">
      <div className="detail-heading">
        <div><p className="metadata">{delivery.reference} · {route.code}{route.distance_km !== null && ` · ${route.distance_km.toLocaleString("pt-BR")} km`}</p>
          <h2 id="detail-title">{route.origin} / {route.destination}</h2></div>
        <span className="risk" data-level={assessment.level}>{riskLabels[assessment.level]}</span>
      </div>
      <p className="checkpoint"><MapPin size={17} /> {route.checkpoint} · {dateTime(assessment.checkpoint_at)}</p>

      {assessment.rain_mm !== null && assessment.cost_cents !== null && assessment.delay_minutes !== null ? <>
        <HazardChips hazards={assessment.hazards ?? []} />
        <dl className="impact">
          <div><dt>Chuva na hora</dt><dd>{assessment.rain_mm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mm</dd></div>
          {assessment.probability != null && <div><dt>Probabilidade</dt><dd>{Math.round(assessment.probability)}%</dd></div>}
          {assessment.gust_kmh != null && <div><dt>Rajadas</dt><dd>{Math.round(assessment.gust_kmh)} km/h</dd></div>}
          {assessment.visibility_m != null && <div><dt>Visibilidade</dt><dd>{assessment.visibility_m >= 1000 ? `${(assessment.visibility_m / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km` : `${Math.round(assessment.visibility_m)} m`}</dd></div>}
          <div><dt>Atraso estimado</dt><dd>{delayText(assessment.delay_minutes)}</dd></div>
          <div><dt>Custo estimado</dt><dd>{money(assessment.cost_cents)}</dd></div>
        </dl>
        {route.forecast && <ForecastChart hours={route.forecast.hours} crossingAt={assessment.checkpoint_at} alternative={decision ? null : assessment.alternative} />}
        <p className="metadata formula">Estimativa de espera: {delayText(assessment.delay_minutes)} a {money(delivery.hour_cost_cents)} por hora.</p>
        {assessment.forecast_at && <p className="metadata">{simulated ? "Previsão simulada em" : "Previsão consultada em"} {dateTime(assessment.forecast_at)}.{!simulated && <> <a className="weather-credit" href="https://open-meteo.com/">Open-Meteo</a></>}</p>}
      </> : <p className="feedback"><CloudRain size={18} /> {assessment.level === "outside"
        ? "A passagem está fora da janela de análise das próximas 72 horas."
        : "Não há uma previsão horária recente para este trecho."}</p>}

      {decision ? <div className="recommendation">
        <CheckCircle2 size={20} />
        <div><p>Ação registrada em {dateTime(decision.recorded_at)}</p><strong>{choices[decision.choice]}</strong>
          {decision.note && <p className="decision-note">{decision.note}</p>}</div>
      </div> : assessment.recommendation && <>
        <div className="recommendation">
          <Zap size={20} />
          <div><p>Ação sugerida</p><strong>{choices[assessment.recommendation]}</strong>
            <p>{recommendationText(assessment)}</p></div>
        </div>
        <form onSubmit={submit} className="decision-form">
          <label>Decisão da operação <select value={choice ?? assessment.recommendation} onChange={event => setChoice(event.target.value as Choice)}>
            {Object.entries(choices).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select></label>
          <label>Observação (opcional) <textarea name="note" placeholder="Ex.: horário revisado com a transportadora" maxLength={350} rows={2} /></label>
          <button type="submit" className="button primary" disabled={busy}>{busy ? "Salvando…" : "Registrar decisão"}</button>
        </form>
      </>}
    </div>
  </section>;
}
