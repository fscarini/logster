"use client";

import { Activity, Clock3, CloudRain, Crosshair, Gauge, MapPin, Route, TriangleAlert, Truck, Zap } from "lucide-react";
import { useState } from "react";

const scenarios = [
  {
    label: "BR-116", route: "São Paulo · Curitiba", event: "Chuva intensa", timing: "Nas próximas 12 h",
    risk: "Alto", delay: "3 h", cost: "R$ 4.850", recommendation: "Antecipar saída em 4 h",
    detail: "A saída antecipada evita a janela de chuva mais intensa na Serra do Cafezal.",
    x: "46%", y: "63%",
  },
  {
    label: "BR-101", route: "Curitiba · Joinville", event: "Risco de alagamento", timing: "Nas próximas 24 h",
    risk: "Moderado", delay: "1 h 30 min", cost: "R$ 2.100", recommendation: "Adiar saída em 2 h",
    detail: "Aguardar a passagem da chuva reduz a exposição nos trechos mais baixos.",
    x: "40%", y: "83%",
  },
  {
    label: "BR-381", route: "Belo Horizonte · São Paulo", event: "Risco de interdição", timing: "Nas próximas 36 h",
    risk: "Moderado", delay: "2 h", cost: "R$ 3.200", recommendation: "Avaliar rota alternativa",
    detail: "Compare o custo do desvio com o de aguardar a liberação da rodovia.",
    x: "64%", y: "41%",
  },
];

export function DashboardPreview() {
  const [active, setActive] = useState(0);
  const scenario = scenarios[active];

  return <figure id="plataforma" className="dashboard" aria-label="Prévia interativa do painel Logster">
    <div className="dashboard-bar">
      <div className="dashboard-title"><Activity size={17} /> Painel de operações</div>
      <figcaption><span className="signal-dot" /> Dados simulados</figcaption>
    </div>
    <div className="dashboard-content">
      <div className="dashboard-metrics">
        <div><Truck size={17} /><span>Rotas monitoradas</span><strong>03</strong></div>
        <div><TriangleAlert size={17} /><span>Alertas por trecho</span><strong>03</strong></div>
        <div><Gauge size={17} /><span>Custo estimado <span className="metric-extra">na rota</span></span><strong>{scenario.cost}</strong></div>
        <div><Clock3 size={17} /><span>Janela de previsão</span><strong>72 h</strong></div>
      </div>
      <div className="dashboard-main">
        <div className="route-map">
          <div className="map-caption"><Crosshair size={16} /> Mapa de risco</div>
          <span className="map-north" aria-hidden="true">N<br />▴</span>
          <div className="map-point" aria-hidden="true" style={{ left: scenario.x, top: scenario.y }}><span /></div>
          <div className="route-options" role="group" aria-label="Selecionar rota simulada">
            {scenarios.map(({ label }, index) => <button key={label} type="button" aria-pressed={index === active} onClick={() => setActive(index)}>{label}</button>)}
          </div>
        </div>
        <div className="route-detail" aria-live="polite">
          <div className="detail-place"><MapPin size={15} /> {scenario.route}</div>
          <div className="weather"><CloudRain size={24} /><div><strong>{scenario.event}</strong><span>{scenario.timing}</span></div></div>
          <div className="impact-line"><span>Risco <b>{scenario.risk}</b></span><span>Atraso <b>{scenario.delay}</b></span></div>
          <div className="recommendation"><Zap size={17} /><div><span>Ação sugerida</span><strong>{scenario.recommendation}</strong></div></div>
          <p>{scenario.detail}</p>
        </div>
      </div>
    </div>
    <div className="dashboard-foot"><Route size={14} /> Cenário demonstrativo · Sudeste e Sul do Brasil</div>
  </figure>;
}
