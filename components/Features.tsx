import { ChartNoAxesCombined, CloudRain, Route } from "lucide-react";

const features = [
  { icon: CloudRain, title: "Alertas por trecho", copy: "Veja onde e quando chuva intensa, alagamento ou deslizamento podem interferir no trajeto." },
  { icon: ChartNoAxesCombined, title: "Impacto em horas e reais", copy: "Estime quanto um atraso pode custar e priorize as entregas mais expostas." },
  { icon: Route, title: "Alternativas de operação", copy: "Compare antecipar, adiar ou desviar uma entrega conforme o cenário da rota." },
];

export function Features() {
  return <section className="section resources" id="recursos" aria-labelledby="features-heading">
    <div className="shell">
      <div className="section-heading reveal">
        <p className="eyebrow">Recursos</p>
        <h2 id="features-heading">Do alerta à decisão.</h2>
      </div>
      <div className="feature-grid">
        {features.map(({ icon: Icon, title, copy }) => <article key={title} className="feature-card reveal">
          <span className="icon-box"><Icon size={25} /></span>
          <h3>{title}</h3>
          <p>{copy}</p>
        </article>)}
      </div>
    </div>
  </section>;
}
