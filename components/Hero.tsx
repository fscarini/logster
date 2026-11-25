import { ChevronDown, Play, Radar } from "lucide-react";
import { DashboardPreview } from "./DashboardPreview";

export function Hero() {
  return <section className="hero" id="inicio" aria-labelledby="hero-heading">
    <div className="hero-terrain" aria-hidden="true" />
    <div className="shell hero-inner">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow"><Radar size={16} /> Inteligência climática para fretes rodoviários</p>
        <h1 id="hero-heading">Antecipe o risco.<br /><em>Proteja a entrega.</em></h1>
        <p className="hero-summary">Veja quais rotas podem ser afetadas pelo clima nas próximas 72 horas, estime o impacto e decida antes de sair.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#plataforma"><Play size={15} fill="currentColor" /> Ver demonstração</a>
          <a className="button button-secondary" href="#como-funciona">Como funciona <ChevronDown size={17} /></a>
        </div>
      </div>
      <DashboardPreview />
    </div>
  </section>;
}
