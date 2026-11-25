"use client";

import { AlertTriangle, ArrowRight, Bell, CheckCircle2, CloudRain, PiggyBank, Plus, Route, Truck, Wallet } from "lucide-react";
import { useMemo } from "react";
import { HOUR, riskLabels } from "../lib/model";
import type { Operations } from "../lib/model";
import { bucketLabels, buildDashboard } from "../lib/dashboard";
import type { RiskBucket } from "../lib/dashboard";
import { dateTime, delayText, money } from "./DeliveryDetail";
import { hazardIcons, hazardSummary } from "./Weather";

const buckets: RiskBucket[] = ["high", "moderate", "low", "none"];
const percent = (value: number | null) => value === null ? "—" : `${Math.round(value * 100)}%`;
const slotFormatter = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit" });
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export function Dashboard({ data, now, openDelivery, newDelivery }: {
  data: Operations;
  now: number;
  openDelivery: (id: string) => void;
  newDelivery: () => void;
}) {
  const view = useMemo(() => buildDashboard(data, now), [data, now]);
  const routeById = new Map(data.routes.map(route => [route.id, route]));
  const maxSlot = Math.max(1, ...view.timeline.map(slot => buckets.reduce((sum, key) => sum + slot.counts[key], 0)));
  const maxRouteCost = Math.max(1, ...view.routes.map(route => route.costCents));
  const maxChoice = Math.max(1, ...view.choices.map(item => item.count));

  if (!data.deliveries.length) {
    return <section className="panel dash-empty">
      <Truck size={28} />
      <h2>Nenhuma entrega cadastrada</h2>
      <p>Cadastre a primeira entrega para acompanhar risco, custo e decisões da operação.</p>
      <button type="button" className="button primary" onClick={newDelivery}><Plus size={18} /> Nova entrega</button>
    </section>;
  }

  return <div className="dashboard">
    <dl className="kpis">
      <div><dt><Truck size={18} /> Entregas em 72 h</dt><dd>{view.inWindow}</dd>
        <p>{plural(data.deliveries.length, "entrega registrada", "entregas registradas")}</p></div>
      <div data-alert={view.openHigh > 0 || undefined}><dt><Bell size={18} /> Alertas sem decisão</dt><dd>{view.openAlerts.length}</dd>
        <p>{view.openHigh ? `${view.openHigh} de risco alto` : "Nenhum de risco alto"}</p></div>
      <div><dt><Wallet size={18} /> Custo em risco</dt><dd>{money(view.costAtRiskCents)}</dd>
        <p>{view.delayAtRiskMinutes ? `${delayText(view.delayAtRiskMinutes)} de espera estimada` : "Sem espera prevista"}</p></div>
      <div><dt><PiggyBank size={18} /> Custo evitável</dt><dd>{money(view.avoidableCents)}</dd>
        <p>{view.withAlternative ? `Adotando ${plural(view.withAlternative, "janela sugerida", "janelas sugeridas")}` : "Sem janela alternativa melhor"}</p></div>
      <div><dt><CheckCircle2 size={18} /> Taxa de resposta</dt><dd>{percent(view.responseRate)}</dd>
        <p>{plural(view.decisions, "decisão registrada", "decisões registradas")}</p></div>
      <div><dt><CloudRain size={18} /> Cobertura de previsão</dt><dd>{percent(view.forecastCoverage)}</dd>
        <p>Entregas da janela com previsão</p></div>
    </dl>

    <div className="dash-grid">
      <section className="panel dash-card" aria-labelledby="risk-title">
        <div className="panel-title"><h2 id="risk-title">Distribuição de risco</h2><span className="metadata">Próximas 72 h</span></div>
        <div className="dash-body">
          {view.inWindow ? <>
            <div className="stack-bar" role="img" aria-label={buckets.map(key => `${bucketLabels[key]}: ${view.risk[key]}`).join(", ")}>
              {buckets.filter(key => view.risk[key]).map(key => <span key={key} data-bucket={key} style={{ flexGrow: view.risk[key] }} />)}
            </div>
            <ul className="legend">
              {buckets.map(key => <li key={key}>
                <span className="swatch" data-bucket={key} /> {bucketLabels[key]}
                <strong>{view.risk[key]}</strong>
                <span className="metadata">{percent(view.risk[key] / view.inWindow)}</span>
              </li>)}
            </ul>
          </> : <p className="empty">Nenhuma passagem prevista nas próximas 72 horas.</p>}
        </div>
      </section>

      <section className="panel dash-card" aria-labelledby="timeline-title">
        <div className="panel-title"><h2 id="timeline-title">Passagens pelo trecho monitorado</h2><span className="metadata">Blocos de 6 h</span></div>
        <div className="dash-body">
          <div className="columns" role="list">
            {view.timeline.map(slot => {
              const total = buckets.reduce((sum, key) => sum + slot.counts[key], 0);
              const detail = buckets.filter(key => slot.counts[key]).map(key => `${bucketLabels[key]}: ${slot.counts[key]}`).join(" · ");
              const label = `${slotFormatter.format(slot.start)}h a ${slotFormatter.format(slot.start + 6 * HOUR)}h — ${total ? `${plural(total, "passagem", "passagens")} (${detail})` : "sem passagens"}`;
              return <div key={slot.start} className="column" role="listitem" tabIndex={0} aria-label={label} data-tip={label}>
                <div className="column-bar" style={{ height: `${(total / maxSlot) * 100}%` }}>
                  {buckets.filter(key => slot.counts[key]).map(key => <span key={key} data-bucket={key} style={{ flexGrow: slot.counts[key] }} />)}
                </div>
              </div>;
            })}
          </div>
          <div className="columns-axis" aria-hidden="true">
            <span>Agora</span><span>+24 h</span><span>+48 h</span><span>+72 h</span>
          </div>
        </div>
      </section>

      <section className="panel dash-card dash-wide" aria-labelledby="priority-title">
        <div className="panel-title"><h2 id="priority-title">Prioridades da operação</h2><span className="metadata">Por custo estimado</span></div>
        {view.openAlerts.length ? <ul className="priorities">
          {view.openAlerts.slice(0, 5).map(item => {
            const route = routeById.get(item.route_id);
            return <li key={item.id}>
              <div>
                <span className="item-heading"><strong>{item.reference}</strong><span className="risk" data-level={item.assessment.level}>{riskLabels[item.assessment.level]}</span></span>
                <span className="item-meta">{route?.code} · {route?.checkpoint} · {dateTime(item.assessment.checkpoint_at)}</span>
                {hazardSummary(item.assessment.hazards) && <span className="item-hazard">{hazardSummary(item.assessment.hazards)}</span>}
              </div>
              <div className="priority-cost">
                <strong>{item.assessment.cost_cents !== null ? money(item.assessment.cost_cents) : "—"}</strong>
                <span className="item-meta">{item.assessment.delay_minutes ? delayText(item.assessment.delay_minutes) : ""}</span>
              </div>
              <button type="button" className="button secondary" onClick={() => openDelivery(item.id)}>Analisar <ArrowRight size={16} /></button>
            </li>;
          })}
        </ul> : <p className="empty"><CheckCircle2 size={18} /> Nenhum alerta aguarda decisão.</p>}
        {view.openAlerts.length > 5 && <p className="metadata dash-more">Mais {view.openAlerts.length - 5} na aba Alertas.</p>}
      </section>

      <section className="panel dash-card" aria-labelledby="weather-title">
        <div className="panel-title"><h2 id="weather-title">Clima nas passagens</h2><span className="metadata">Próximas 72 h</span></div>
        <div className="dash-body">
          <table className="bars weather-bars">
            <thead className="sr-only"><tr><th>Condição</th><th>Passagens afetadas</th></tr></thead>
            <tbody>
              {view.hazards.map(item => {
                const Icon = hazardIcons[item.kind];
                const total = item.high + item.moderate;
                return <tr key={item.kind}>
                  <th scope="row"><span className="hazard-name"><Icon size={16} /> {item.label}</span></th>
                  <td>
                    <span className="bar-track" role="img" aria-label={`${item.high} de risco alto e ${item.moderate} de risco moderado`}>
                      {item.high > 0 && <span className="bar-seg" data-bucket="high" style={{ width: `${(item.high / Math.max(1, view.inWindow)) * 100}%` }} />}
                      {item.moderate > 0 && <span className="bar-seg" data-bucket="moderate" style={{ width: `${(item.moderate / Math.max(1, view.inWindow)) * 100}%` }} />}
                    </span>
                    <span className="bar-value">{total}</span>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
          <p className="dash-note"><CloudRain size={17} /> <span>{view.maxProbability !== null
            ? <>Maior probabilidade de chuva numa passagem: <strong>{Math.round(view.maxProbability)}%</strong>. As barras somam passagens de risco alto e moderado.</>
            : "As previsões ainda não trazem probabilidade de chuva."}</span></p>
        </div>
      </section>

      <section className="panel dash-card" aria-labelledby="routes-exposure-title">
        <div className="panel-title"><h2 id="routes-exposure-title">Exposição por rota</h2><span className="metadata">Custo em risco</span></div>
        <table className="bars">
          <thead className="sr-only"><tr><th>Rota</th><th>Custo em risco</th><th>Alertas</th><th>Entregas</th></tr></thead>
          <tbody>
            {view.routes.map(route => <tr key={route.id}>
              <th scope="row"><strong>{route.code}</strong><span className="metadata">{route.name}</span></th>
              <td>
                <span className="bar-track"><span className="bar-fill" style={{ width: `${(route.costCents / maxRouteCost) * 100}%` }} /></span>
                <span className="bar-value">{money(route.costCents)}</span>
              </td>
              <td className="metadata"><AlertTriangle size={14} /> {route.openAlerts}</td>
              <td className="metadata"><Truck size={14} /> {route.deliveries}</td>
            </tr>)}
          </tbody>
        </table>
      </section>

      <section className="panel dash-card dash-wide" aria-labelledby="decisions-title">
        <div className="panel-title"><h2 id="decisions-title">Decisões registradas</h2><span className="metadata">{plural(view.decisions, "ação", "ações")}</span></div>
        <div className="dash-body">
          <table className="bars">
            <thead className="sr-only"><tr><th>Ação</th><th>Quantidade</th></tr></thead>
            <tbody>
              {view.choices.map(item => <tr key={item.choice}>
                <th scope="row">{item.label}</th>
                <td>
                  <span className="bar-track"><span className="bar-fill" style={{ width: `${(item.count / maxChoice) * 100}%` }} /></span>
                  <span className="bar-value">{item.count}</span>
                </td>
              </tr>)}
            </tbody>
          </table>
          <p className="dash-note"><Route size={17} /> <span>{view.decisions
            ? <>Impacto tratado: <strong>{money(view.handledCostCents)}</strong> em custo estimado no momento das decisões.</>
            : "Registre decisões nos alertas para acompanhar o impacto tratado."}</span></p>
        </div>
      </section>
    </div>
  </div>;
}
