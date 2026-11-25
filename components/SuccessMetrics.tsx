"use client";

import { Activity, ChevronLeft, ChevronRight, CircleCheck, Clock3, MapPin, Route, TrendingDown, Truck } from "lucide-react";
import { useState } from "react";
import styles from "./SuccessMetrics.module.css";

const metrics = [
  {
    icon: MapPin,
    title: "Eventos identificados e mapeados",
    value: "18",
    summary: "Eventos registrados",
    detail: "O painel relaciona ocorrências de chuva intensa, alagamento, deslizamento e interdição aos trechos monitorados.",
    breakdown: [["7", "Chuvas intensas"], ["5", "Alagamentos"], ["3", "Deslizamentos"], ["3", "Interdições"]],
  },
  {
    icon: Route,
    title: "Cobertura e precisão dos alertas",
    value: "83%",
    summary: "Alertas confirmados",
    detail: "A precisão é a proporção de alertas emitidos que corresponderam a uma ocorrência confirmada no trecho e na janela previstos.",
    breakdown: [["15 de 18", "Alertas confirmados"], ["12", "Rotas rodoviárias"], ["3", "Estados · SP, PR e SC"]],
  },
  {
    icon: Clock3,
    title: "Tempo de antecipação",
    value: "36 h",
    summary: "De antecedência mediana",
    detail: "Tempo entre o envio do alerta e o início da ocorrência, calculado sobre os alertas confirmados.",
    breakdown: [["15", "Alertas na análise"], ["72 h", "Janela de previsão do painel"]],
  },
  {
    icon: TrendingDown,
    title: "Impactos ambientais e logísticos",
    value: "−30%",
    summary: "Nas horas de atraso",
    detail: "Comparação entre o cenário de referência e um cenário com replanejamento. As emissões de CO₂ são estimadas.",
    breakdown: [["30 → 21 h", "Atrasos acumulados"], ["8 → 5", "Interrupções"], ["1,6 → 1,4 t", "Emissões de CO₂"]],
  },
  {
    icon: CircleCheck,
    title: "Ações preventivas e continuidade",
    value: "67%",
    summary: "Dos riscos com ação registrada",
    detail: "Acompanhe quais riscos motivaram replanejamento e como essas medidas podem afetar o custo e a continuidade do abastecimento.",
    breakdown: [["12 de 18", "Riscos com ação"], ["R$ 8.400", "Prejuízo evitado estimado"], ["9 de 12", "Entregas do cenário mantidas no prazo"]],
  },
];

export function SuccessMetrics() {
  const [selected, setSelected] = useState(0);
  const metric = metrics[selected];
  const MetricIcon = metric.icon;

  function move(offset: number) {
    setSelected(current => (current + offset + metrics.length) % metrics.length);
  }

  return (
    <section className={styles.section} id="indicadores" aria-labelledby="metrics-title">
      <div className="shell">
        <header className={styles.intro}>
          <p className="eyebrow"><Activity size={16} aria-hidden="true" /> Indicadores de sucesso</p>
          <h2 id="metrics-title">Do risco mapeado à <em>entrega protegida.</em></h2>
          <p>Veja como uma operação rodoviária poderia medir a cobertura dos alertas, a antecedência das decisões e os efeitos do replanejamento.</p>
        </header>

        <div className={styles.showcase}>
          <div className={styles.stage}>
            <div className={styles.phone} aria-label="Prévia interativa do painel Logster no celular">
              <div className={styles.phoneNotch} aria-hidden="true" />
              <div className={styles.phoneTop}>
                <img src="/logster-mark.svg" alt="" width="29" height="18" />
                <span>Logster</span>
                <Truck size={17} aria-hidden="true" /><small>Simulação</small>
              </div>
              <div className={styles.map} aria-hidden="true">
                <svg viewBox="0 0 320 136" preserveAspectRatio="none" fill="none">
                  <path className={styles.route} pathLength="1" d="M267 34c-35-2-41 23-72 25s-44 24-68 27-45 17-64 25" />
                  <path className={styles.route} pathLength="1" d="M195 59c19 12 22 33 7 47s-31 18-38 23" />
                  <circle cx="267" cy="34" r="4" /><circle cx="195" cy="59" r="5" />
                  <circle cx="127" cy="86" r="4" /><circle cx="63" cy="111" r="4" />
                </svg>
                <span><MapPin size={14} /> Corredores Sul e Sudeste</span>
              </div>
              <div className={styles.phoneContent} id="metric-reading" aria-live="polite" aria-atomic="true">
                <div className={styles.phoneLabel}><MetricIcon size={17} aria-hidden="true" /> {metric.title}</div>
                <p className={styles.phoneValue}>{metric.value}</p>
                <p className={styles.phoneSummary}>{metric.summary}</p>
                <dl className={styles.breakdown}>
                  {metric.breakdown.map(([value, label]) => (
                    <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
                  ))}
                </dl>
              </div>
              <div className={styles.phoneControls}>
                <button type="button" aria-label="Indicador anterior" aria-controls="metric-reading" onClick={() => move(-1)}><ChevronLeft size={20} aria-hidden="true" /></button>
                <span>{selected + 1} de {metrics.length}</span>
                <button type="button" aria-label="Próximo indicador" aria-controls="metric-reading" onClick={() => move(1)}><ChevronRight size={20} aria-hidden="true" /></button>
              </div>
            </div>
          </div>

          <div className={styles.readings}>
            <p className={styles.scenario}>Cenário simulado · 30 dias</p>
            <div className={styles.selectors} role="group" aria-label="Selecionar indicador">
              {metrics.map(({ icon: Icon, title, value, detail }, index) => (
                <div className={styles.item} key={title}>
                  <button type="button" aria-pressed={index === selected} aria-controls="metric-reading" onClick={() => setSelected(index)}>
                    <span className={styles.itemIcon}><Icon size={20} aria-hidden="true" /></span>
                    <span>{title}</span>
                    <strong>{value}</strong>
                  </button>
                  {index === selected && <p>{detail}</p>}
                </div>
              ))}
            </div>
            <p className={styles.note}>Os valores ilustram como medir cada indicador. Em uma operação real, os resultados dependem dos dados coletados e da comparação com uma referência.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
