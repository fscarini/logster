"use client";

import { CloudRain, Pause, Play, ScanLine, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

const steps = [
  ["Cruze os dados", "Relacione previsão do tempo e alertas aos trechos da rota."],
  ["Estime o impacto", "Identifique a entrega afetada e estime atraso e custo."],
  ["Compare opções", "Considere antecipar, adiar ou desviar antes do despacho."],
];

const particles = Array.from({ length: 28 }, (_, index) => ({
  top: `${(index * 37 + 7) % 98}%`,
  "--spark-x": `${((index * 29) % 77) - 38}px`,
  "--spark-y": `${((index * 13) % 41) - 20}px`,
  "--spark-time": `${0.75 + (index % 9) * 0.13}s`,
  "--spark-delay": `-${(index * 17) % 23 / 10}s`,
}) as CSSProperties);

const estimatedCost = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function HowItWorks() {
  const [position, setPosition] = useState(46);
  const [play, setPlay] = useState(false);
  const [inView, setInView] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const currentPosition = useRef(46);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setPlay(!media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!play || !inView) return;
    const initial = currentPosition.current;
    const phase = Math.acos(1 - (initial - 8) / 42);
    let start: number | undefined;
    let frame: number;

    function animate(time: number) {
      start ??= time;
      const progress = 8 + 42 * (1 - Math.cos(phase + (time - start) / 1900));
      currentPosition.current = progress;
      setPosition(progress);
      frame = requestAnimationFrame(animate);
    }

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [play, inView]);

  function scrub(value: number) {
    const next = Math.min(92, Math.max(8, value));
    setPlay(false);
    currentPosition.current = next;
    setPosition(next);
  }

  return <section className="section shell workflow" id="como-funciona" aria-labelledby="workflow-heading">
    <div className="section-heading reveal">
      <p className="eyebrow">Como funciona</p>
      <h2 id="workflow-heading">O que muda com a previsão?</h2>
      <p>Explore um cenário simulado na BR-116 para ver como a previsão se traduz em uma decisão de transporte.</p>
    </div>
    <div className="scan-card" data-playing={play && inView}>
      <div className="scan-header">
        <span><ScanLine size={17} /> Análise de rota · BR-116</span>
        <span className="scan-cost">Impacto estimado <strong>{estimatedCost.format(Math.round(4850 * (position - 8) / 84))}</strong></span>
        <button className="icon-button" type="button" aria-label={play ? "Pausar animação" : "Reproduzir animação"} onClick={() => setPlay(!play)}>
          {play ? <Pause size={18} /> : <Play size={18} />}
        </button>
      </div>
      <div className="scan-stage" ref={stageRef} style={{ "--scan": `${position}%` } as CSSProperties}
        onPointerDown={event => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const bounds = event.currentTarget.getBoundingClientRect();
          scrub((event.clientX - bounds.left) / bounds.width * 100);
        }}
        onPointerMove={event => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          scrub((event.clientX - bounds.left) / bounds.width * 100);
        }}>
        <div className="scan-layer scan-input" aria-hidden="true">
          <div><CloudRain size={26} /><p>Previsão do tempo</p><strong>Chuva intensa</strong><small>Serra do Cafezal · Próximas 12 h</small></div>
        </div>
        <div className="scan-layer scan-output" aria-hidden="true">
          <div><Zap size={26} /><p>Recomendação operacional</p><strong>Antecipar saída</strong><small>Saia 4 h antes da janela de chuva.</small></div>
        </div>
        <div className="scanner" aria-hidden="true">{particles.map((style, index) => <i key={index} style={style} />)}</div>
      </div>
      <p className="sr-only">A previsão indica chuva intensa na Serra do Cafezal nas próximas 12 horas. Neste cenário, o impacto pode chegar a R$ 4.850 e a ação sugerida é antecipar a saída em 4 horas.</p>
      <div className="scan-control">
        <label htmlFor="route-scan">Explorar análise</label>
        <input id="route-scan" type="range" min={8} max={92} step={1} value={Math.round(position)} onChange={event => scrub(Number(event.target.value))} />
      </div>
    </div>
    <ol className="steps-grid">
      {steps.map(([title, copy], index) => <li className="reveal" key={title}>
        <span className="step-number">{index + 1}</span><div><h3>{title}</h3><p>{copy}</p></div>
      </li>)}
    </ol>
  </section>;
}
