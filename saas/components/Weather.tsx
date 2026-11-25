"use client";

import { CloudFog, CloudLightning, CloudRain, Wind } from "lucide-react";
import { useState } from "react";
import { HOUR, hazardLabels } from "../lib/model";
import type { Alternative, ForecastHour, Hazard, HazardKind } from "../lib/model";
import { THRESHOLDS, hourHazards } from "../lib/risk";

export const hazardIcons: Record<HazardKind, typeof CloudRain> = { rain: CloudRain, storm: CloudLightning, wind: Wind, visibility: CloudFog };
const number = (value: number, digits = 0) => value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

export function hazardText(hazard: Hazard) {
  const strong = hazard.level === "high";
  if (hazard.kind === "rain") return `${strong ? "Chuva forte" : "Chuva moderada"} · ${number(hazard.value, 1)} mm/h`;
  if (hazard.kind === "wind") return `${strong ? "Rajadas fortes" : "Rajadas"} · ${number(hazard.value)} km/h`;
  if (hazard.kind === "visibility") return `${strong ? "Neblina densa" : "Visibilidade reduzida"} · ${hazard.value >= 1000 ? `${number(hazard.value / 1000, 1)} km` : `${number(hazard.value)} m`}`;
  return hazard.level === "high" ? "Tempestade com granizo" : "Trovoadas";
}

export function HazardChips({ hazards }: { hazards: Hazard[] }) {
  if (!hazards.length) return null;
  return <ul className="hazards" aria-label="Condições na passagem">
    {hazards.map(hazard => {
      const Icon = hazardIcons[hazard.kind];
      return <li key={hazard.kind} data-level={hazard.level}><Icon size={15} /> {hazardText(hazard)}</li>;
    })}
  </ul>;
}

/** Resumo curto para listas: o perigo mais grave e quantos outros há. */
export function hazardSummary(hazards: Hazard[] | undefined) {
  if (!hazards?.length) return null;
  const [first, ...rest] = hazards;
  return `${hazardText(first)}${rest.length ? ` +${rest.length}` : ""}`;
}

const hourFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit", minute: "2-digit" });
const tickFormat = new Intl.DateTimeFormat("pt-BR", { weekday: "short", hour: "2-digit" });

/**
 * Chuva horária prevista no ponto monitorado (barras), coloridas pelo nível de risco da hora,
 * com as faixas de 5 e 15 mm/h e marcadores da passagem prevista e da alternativa sugerida.
 */
export function ForecastChart({ hours, crossingAt, alternative }: { hours: ForecastHour[]; crossingAt: string; alternative?: Alternative | null }) {
  const [hover, setHover] = useState<number | null>(null);
  if (hours.length < 2) return null;
  const width = 720;
  const height = 170;
  const pad = { top: 14, right: 10, bottom: 26, left: 34 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(THRESHOLDS.rain.high * 1.25, ...hours.map(hour => hour.rain_mm));
  const step = plotW / hours.length;
  const start = Date.parse(hours[0].time);
  const x = (time: number) => pad.left + ((time - start) / HOUR) * step;
  const y = (value: number) => pad.top + plotH - (value / max) * plotH;
  const crossing = Math.floor(Date.parse(crossingAt) / HOUR) * HOUR;
  const alt = alternative ? Math.floor(Date.parse(alternative.checkpoint_at) / HOUR) * HOUR : null;
  const ticks = hours.filter(hour => new Date(hour.time).getHours() % 12 === 0);
  const focus = hover !== null ? hours[hover] : null;
  const focusLevel = focus ? hourHazards(focus) : null;

  return <figure className="forecast-chart">
    <figcaption>
      <strong>Chuva prevista no ponto monitorado</strong>
      <span className="metadata">mm/h nas próximas {Math.round(hours.length)} horas · a cor indica o risco de cada hora</span>
    </figcaption>
    <div className="forecast-plot" onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`Previsão horária: chuva máxima de ${number(Math.max(...hours.map(hour => hour.rain_mm)), 1)} mm/h. Passagem prevista em ${hourFormat.format(crossing)}.`}>
        {[THRESHOLDS.rain.moderate, THRESHOLDS.rain.high].map(value => <g key={value} className="threshold">
          <line x1={pad.left} x2={width - pad.right} y1={y(value)} y2={y(value)} />
          <text x={pad.left - 6} y={y(value) + 3}>{value}</text>
        </g>)}
        <line className="baseline" x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} />
        <text className="axis-unit" x={pad.left - 6} y={y(0) + 3}>0</text>
        {hours.map((hour, index) => {
          const time = Date.parse(hour.time);
          const level = hourHazards(hour).level;
          const top = y(hour.rain_mm);
          return <g key={hour.time}>
            <rect className="bar" data-bucket={level} x={x(time) + 1} width={Math.max(1, step - 2)} y={Math.min(top, y(0) - 1)} height={Math.max(1, y(0) - top)} rx={Math.min(2, step / 3)} opacity={hover === null || hover === index ? 1 : .55} />
            <rect className="hit" x={x(time)} width={step} y={pad.top} height={plotH} onPointerEnter={() => setHover(index)} />
          </g>;
        })}
        {/* Os rótulos se afastam um do outro para não se sobreporem quando as horas são próximas. */}
        {alt !== null && <g className="marker alt"><line x1={x(alt) + step / 2} x2={x(alt) + step / 2} y1={pad.top - 6} y2={y(0)} />
          <text x={x(alt) + step / 2 + (alt > crossing ? 4 : -4)} y={pad.top - 8} textAnchor={alt > crossing ? "start" : "end"}>Alternativa</text></g>}
        <g className="marker"><line x1={x(crossing) + step / 2} x2={x(crossing) + step / 2} y1={pad.top - 6} y2={y(0)} />
          <text x={x(crossing) + step / 2 + (alt === null ? 0 : alt > crossing ? -4 : 4)} y={pad.top - 8} textAnchor={alt === null ? "middle" : alt > crossing ? "end" : "start"}>Passagem</text></g>
        {ticks.map(hour => <text key={hour.time} className="tick" x={x(Date.parse(hour.time))} y={height - 8}>{tickFormat.format(new Date(hour.time))}h</text>)}
      </svg>
      {focus && hover !== null && <div className="chart-tip" style={{ left: `${((x(Date.parse(focus.time)) + step / 2) / width) * 100}%` }} data-flip={hover > hours.length * 0.6 || undefined}>
        <strong>{hourFormat.format(new Date(focus.time))}</strong>
        <span>Chuva: {number(focus.rain_mm, 1)} mm/h{focus.probability != null && ` · ${number(focus.probability)}%`}</span>
        {focus.gust_kmh != null && <span>Rajadas: {number(focus.gust_kmh)} km/h</span>}
        {focus.visibility_m != null && <span>Visibilidade: {focus.visibility_m >= 1000 ? `${number(focus.visibility_m / 1000, 1)} km` : `${number(focus.visibility_m)} m`}</span>}
        {focusLevel && focusLevel.hazards.length > 0 && <span>{focusLevel.hazards.map(item => hazardLabels[item.kind]).join(", ")}</span>}
      </div>}
    </div>
    <ul className="chart-legend" aria-label="Legenda">
      <li><span className="swatch" data-bucket="low" /> Baixo</li>
      <li><span className="swatch" data-bucket="moderate" /> Moderado</li>
      <li><span className="swatch" data-bucket="high" /> Alto</li>
      <li><span className="legend-mark" /> Passagem</li>
      {alt !== null && <li><span className="legend-mark alt" /> Alternativa</li>}
    </ul>
  </figure>;
}
