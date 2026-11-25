"use client";

import { Maximize2, Minus, Plus, ScanSearch } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import type { Point } from "../lib/model";
import type { RiskBucket } from "../lib/dashboard";
import { bucketLabels } from "../lib/dashboard";

export type MapRoute = {
  id: string;
  title: string;
  detail: string[];
  path: Point[] | null;
  checkpoint: Point;
  origin?: string;
  destination?: string;
  level: RiskBucket;
};

type Base = { version: string; ufs: { uf: string; rings: number[][] }[]; network: number[][] };
type View = { x: number; y: number; w: number; h: number };
type Tip = { x: number; y: number; route: MapRoute };

// Projeção equirretangular com correção da longitude na latitude média do Brasil.
const K = Math.cos((15 * Math.PI) / 180);
const project = ([lon, lat]: Point): [number, number] => [lon * K, -lat];
const BRAZIL: View = { x: -74.2 * K, y: -5.6, w: 40.6 * K, h: 39.6 };
const MIN_WIDTH = 0.25;

let basePromise: Promise<Base> | null = null;
function loadBase() {
  basePromise ??= fetch("/data/brasil-base.json").then(response => {
    if (!response.ok) throw new Error("Mapa indisponível");
    return response.json() as Promise<Base>;
  }).catch(error => { basePromise = null; throw error; });
  return basePromise;
}

function flatPath(rings: number[][], close: boolean) {
  return rings.map(ring => {
    let d = "";
    for (let i = 0; i < ring.length; i += 2) d += `${i ? "L" : "M"}${(ring[i] * K).toFixed(3)} ${(-ring[i + 1]).toFixed(3)}`;
    return close ? `${d}Z` : d;
  }).join("");
}

function linePath(points: Point[]) {
  return points.map((point, i) => {
    const [x, y] = project(point);
    return `${i ? "L" : "M"}${x.toFixed(4)} ${y.toFixed(4)}`;
  }).join("");
}

function fit(points: Point[], aspect: number, padding = 0.18): View {
  if (!points.length) return withAspect(BRAZIL, aspect);
  const xs = points.map(point => project(point)[0]);
  const ys = points.map(point => project(point)[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = Math.max(maxX - minX, 1.2) * (1 + 2 * padding);
  const h = Math.max(maxY - minY, 1.2) * (1 + 2 * padding);
  return withAspect({ x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h }, aspect);
}

function withAspect(view: View, aspect: number): View {
  const cx = view.x + view.w / 2;
  const cy = view.y + view.h / 2;
  let { w, h } = view;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

function clampView(view: View): View {
  const w = Math.min(Math.max(view.w, MIN_WIDTH), BRAZIL.w * 2.2);
  const h = view.h * (w / view.w);
  const cx = Math.min(Math.max(view.x + view.w / 2, BRAZIL.x), BRAZIL.x + BRAZIL.w);
  const cy = Math.min(Math.max(view.y + view.h / 2, BRAZIL.y), BRAZIL.y + BRAZIL.h);
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function BrazilMap({ routes, selectedId, onSelect, label, className = "", fitKey, pointLabel }: {
  routes: MapRoute[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  label: string;
  className?: string;
  /** Substitui a legenda de risco por um único rótulo para o ponto (ex.: prévia de cadastro). */
  pointLabel?: string;
  /** Quando muda, o mapa reenquadra na rota selecionada (ou em todas). */
  fitKey?: string;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [base, setBase] = useState<Base | null>(null);
  const [failed, setFailed] = useState(false);
  const [size, setSize] = useState({ width: 800, height: 420 });
  const [view, setView] = useState<View>(() => withAspect(BRAZIL, 800 / 420));
  const [tip, setTip] = useState<Tip | null>(null);
  const drag = useRef<{ pointers: Map<number, { x: number; y: number }>; moved: boolean; start?: View; distance?: number }>({ pointers: new Map(), moved: false });

  useEffect(() => {
    let active = true;
    loadBase().then(data => { if (active) setBase(data); }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const aspect = size.width / size.height;
  const selected = routes.find(route => route.id === selectedId);

  const frameRoutes = useCallback((only?: MapRoute) => {
    const list = only ? [only] : routes;
    const points = list.flatMap(route => route.path ?? [route.checkpoint]);
    const next = fit(points, aspect, only ? 0.22 : 0.12);
    // Desloca o enquadramento para o traçado não ficar sob a legenda, na base do mapa.
    const legend = Math.min(56, size.height * 0.15) / size.height * next.h;
    setView({ ...next, y: next.y + legend / 2, h: next.h });
  }, [routes, aspect, size.height]);

  // Reenquadra quando a seleção muda (fitKey) ou quando o tamanho do mapa muda.
  useEffect(() => { frameRoutes(selected); }, [fitKey, aspect]); // eslint-disable-line react-hooks/exhaustive-deps -- reenquadra só por fitKey/tamanho

  const unitsPerPixel = Math.max(view.w / size.width, view.h / size.height);
  const px = (value: number) => value * unitsPerPixel;

  const ufPath = useMemo(() => base ? base.ufs.map(uf => ({ uf: uf.uf, d: flatPath(uf.rings, true) })) : [], [base]);
  const networkPath = useMemo(() => base ? flatPath(base.network, false) : "", [base]);
  const routePaths = useMemo(() => routes.map(route => ({ route, d: route.path ? linePath(route.path) : "" })), [routes]);

  function toSvg(clientX: number, clientY: number) {
    const rect = svg.current!.getBoundingClientRect();
    const scale = unitsPerPixel;
    const offsetX = (rect.width * scale - view.w) / 2;
    const offsetY = (rect.height * scale - view.h) / 2;
    return { x: view.x - offsetX + (clientX - rect.left) * scale, y: view.y - offsetY + (clientY - rect.top) * scale };
  }

  function zoom(factor: number, center?: { x: number; y: number }) {
    setView(current => {
      const cx = center?.x ?? current.x + current.w / 2;
      const cy = center?.y ?? current.y + current.h / 2;
      const w = current.w * factor;
      if (w < MIN_WIDTH && factor < 1) return current;
      return clampView({ x: cx - (cx - current.x) * factor, y: cy - (cy - current.y) * factor, w, h: current.h * factor });
    });
  }

  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = toSvg(event.clientX, event.clientY);
      zoom(event.deltaY > 0 ? 1.18 : 1 / 1.18, point);
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  });

  function pointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    const state = drag.current;
    state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    state.moved = false;
    state.start = view;
    if (state.pointers.size === 2) {
      const [a, b] = [...state.pointers.values()];
      state.distance = Math.hypot(a.x - b.x, a.y - b.y);
    }
  }

  function pointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const state = drag.current;
    const previous = state.pointers.get(event.pointerId);
    if (!previous || !state.start) return;
    if (state.pointers.size === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      if (!state.moved && Math.hypot(dx, dy) < 4) return;
      if (!state.moved) svg.current?.setPointerCapture(event.pointerId);
      state.moved = true;
      setTip(null);
      setView(current => clampView({ ...current, x: current.x - dx * unitsPerPixel, y: current.y - dy * unitsPerPixel }));
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    } else if (state.pointers.size === 2 && state.distance) {
      state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const [a, b] = [...state.pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      state.moved = true;
      zoom(state.distance / distance, toSvg((a.x + b.x) / 2, (a.y + b.y) / 2));
      state.distance = distance;
    }
  }

  function pointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    drag.current.pointers.delete(event.pointerId);
    if (drag.current.pointers.size < 2) drag.current.distance = undefined;
  }

  function keyDown(event: KeyboardEvent<HTMLDivElement>) {
    if ((event.target as Element).closest("button")) return;
    const step = view.w * 0.12;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[event.key]) {
      event.preventDefault();
      const [dx, dy] = moves[event.key];
      setView(current => clampView({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (event.key === "+" || event.key === "=") { event.preventDefault(); zoom(1 / 1.3); }
    else if (event.key === "-") { event.preventDefault(); zoom(1.3); }
  }

  function showTip(route: MapRoute, clientX?: number, clientY?: number) {
    const rect = frame.current!.getBoundingClientRect();
    if (clientX !== undefined && clientY !== undefined) {
      setTip({ route, x: clientX - rect.left, y: clientY - rect.top });
      return;
    }
    const [x, y] = project(route.checkpoint);
    const svgRect = svg.current!.getBoundingClientRect();
    const offsetX = (svgRect.width * unitsPerPixel - view.w) / 2;
    const offsetY = (svgRect.height * unitsPerPixel - view.h) / 2;
    setTip({ route, x: (x - view.x + offsetX) / unitsPerPixel, y: (y - view.y + offsetY) / unitsPerPixel });
  }

  function choose(route: MapRoute) {
    if (drag.current.moved) return;
    onSelect?.(route.id);
  }

  const ordered = [...routePaths].sort((a, b) => Number(a.route.id === selectedId) - Number(b.route.id === selectedId));
  const levels = (["high", "moderate", "low", "none"] as RiskBucket[]).filter(level => routes.some(route => route.level === level));

  return <div className={`brazil-map ${className}`} ref={frame} onKeyDown={keyDown}>
    <svg ref={svg} role="group" aria-label={label} tabIndex={0}
      viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} preserveAspectRatio="xMidYMid meet"
      onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}
      onPointerLeave={() => setTip(null)}>
      <title>{label}</title>
      <g className="map-ufs">{ufPath.map(item => <path key={item.uf} d={item.d} vectorEffect="non-scaling-stroke" />)}</g>
      {base && unitsPerPixel < 0.03 && <g className="map-uf-labels" aria-hidden="true">
        {base.ufs.map(uf => {
          const ring = uf.rings.reduce((a, b) => (b.length > a.length ? b : a), []);
          let sx = 0, sy = 0;
          for (let i = 0; i < ring.length; i += 2) { sx += ring[i]; sy += ring[i + 1]; }
          const n = ring.length / 2;
          return <text key={uf.uf} x={(sx / n) * K} y={-sy / n} fontSize={px(11)}>{uf.uf}</text>;
        })}
      </g>}
      <path className="map-network" d={networkPath} vectorEffect="non-scaling-stroke" />
      {ordered.map(({ route, d }) => {
        const active = route.id === selectedId;
        const [cx, cy] = project(route.checkpoint);
        const ends = route.path ? [route.path[0], route.path[route.path.length - 1]].map(project) : [];
        return <g key={route.id} className="map-route" data-active={active || undefined} data-level={route.level}
          role={onSelect ? "button" : undefined} tabIndex={onSelect ? 0 : undefined}
          aria-label={`${route.title}. ${route.detail.join(". ")}`} aria-pressed={onSelect ? active : undefined}
          onPointerEnter={event => showTip(route, event.clientX, event.clientY)}
          onPointerMove={event => { if (!drag.current.moved) showTip(route, event.clientX, event.clientY); }}
          onPointerLeave={() => setTip(null)}
          onFocus={() => showTip(route)} onBlur={() => setTip(null)}
          onClick={() => choose(route)}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect?.(route.id); } }}>
          {d && <>
            <path className="map-route-hit" d={d} vectorEffect="non-scaling-stroke" />
            <path className="map-route-casing" d={d} vectorEffect="non-scaling-stroke" />
            <path className="map-route-line" d={d} vectorEffect="non-scaling-stroke" />
          </>}
          {active && ends.map(([x, y], index) => <circle key={index} className="map-end" cx={x} cy={y} r={px(4.5)} />)}
          <circle className="map-checkpoint" data-bucket={route.level} cx={cx} cy={cy} r={px(active ? 7 : 5.5)} />
          {active && route.origin && ends[0] && <text className="map-label" x={ends[0][0] + px(8)} y={ends[0][1] + px(4)} fontSize={px(12)}>{route.origin}</text>}
          {active && route.destination && ends[1] && <text className="map-label" x={ends[1][0] + px(8)} y={ends[1][1] + px(4)} fontSize={px(12)}>{route.destination}</text>}
        </g>;
      })}
    </svg>

    {tip && <div className="map-tip" role="presentation" style={{ left: tip.x, top: tip.y }} data-flip={tip.x > size.width - 230 || undefined}>
      <strong>{tip.route.title}</strong>
      {tip.route.detail.map(line => <span key={line}>{line}</span>)}
    </div>}

    <div className="map-controls">
      <button type="button" className="icon-button" aria-label="Aproximar" onClick={() => zoom(1 / 1.4)}><Plus size={17} /></button>
      <button type="button" className="icon-button" aria-label="Afastar" onClick={() => zoom(1.4)}><Minus size={17} /></button>
      <button type="button" className="icon-button" aria-label={selected ? "Enquadrar rota selecionada" : "Enquadrar rotas"} onClick={() => frameRoutes(selected)}><ScanSearch size={17} /></button>
      <button type="button" className="icon-button" aria-label="Ver o Brasil inteiro" onClick={() => setView(withAspect(BRAZIL, aspect))}><Maximize2 size={16} /></button>
    </div>

    {routes.length > 0 && <ul className="map-legend" aria-label="Legenda">
      {pointLabel ? <>
        <li><span className="swatch round" data-bucket="none" /> {pointLabel}</li>
        <li><span className="legend-line active" /> Traçado</li>
      </> : <>
        {levels.map(level => <li key={level}><span className="swatch round" data-bucket={level} /> {bucketLabels[level]}</li>)}
        <li><span className="legend-line" /> Rota</li>
        {selectedId && <li><span className="legend-line active" /> Selecionada</li>}
      </>}
    </ul>}
    <p className="map-credit">{failed ? "Mapa base indisponível" : base ? `Malha: DNIT/SNV ${base.version} · Limites: IBGE` : "Carregando mapa…"}</p>
  </div>;
}
