import catalogData from "../data/road-catalog.json";
import type { City, Point, RoutePlan, RouteSegment } from "./model";

// Catálogo gerado por scripts/build-road-catalog.mjs a partir do SNV (DNIT) e do IBGE.
// Uso exclusivo no servidor: o arquivo tem cerca de 2 MB.

type RawEdge = { a: number; b: number; k: number; p: number; s: string; r: string; u: string; c?: string; f: string; t: string; i: number; e: number; g: number[] };
type RawCity = { c: number; n: string; u: string; v: number; x: number; y: number; pop: number };
type Catalog = { version: string; generated_at: string; sources: Record<string, string>; nodes: number[]; edges: RawEdge[]; cities: RawCity[] };

const catalog = catalogData as Catalog;
/** Conexões criadas pelo script onde a malha federal não tem continuação (vias estaduais/urbanas). */
const isConnector = (edge: RawEdge) => edge.s.startsWith("CX");

/** Velocidade média de referência para veículos de carga, incluindo paradas. Regra ilustrativa do MVP. */
export const AVERAGE_SPEED_KMH = 60;
const MAX_CHECKPOINT_MINUTES = 2880;

export const catalogSource = { version: catalog.version, generated_at: catalog.generated_at, sources: catalog.sources };

const cityByCode = new Map(catalog.cities.map(city => [city.c, city]));
const adjacency: { edge: number; to: number }[][] = Array.from({ length: catalog.nodes.length / 2 }, () => []);
catalog.edges.forEach((edge, index) => {
  adjacency[edge.a].push({ edge: index, to: edge.b });
  adjacency[edge.b].push({ edge: index, to: edge.a });
});

export function cities(): City[] {
  return catalog.cities.map(city => ({ code: city.c, name: city.n, uf: city.u, population: city.pop }));
}

export function cityLabel(code: number) {
  const city = cityByCode.get(code);
  return city ? `${city.n}/${city.u}` : null;
}

class Heap {
  private items: [number, number][] = [];
  get size() { return this.items.length; }
  push(item: [number, number]) {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (items[up][0] <= items[i][0]) break;
      [items[up], items[i]] = [items[i], items[up]];
      i = up;
    }
  }
  pop() {
    const items = this.items;
    const top = items[0];
    const last = items.pop()!;
    if (items.length) {
      items[0] = last;
      let i = 0;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
        if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

function shortestPath(from: number, to: number) {
  const cost = new Float64Array(adjacency.length).fill(Infinity);
  const via = new Int32Array(adjacency.length).fill(-1);
  const heap = new Heap();
  cost[from] = 0;
  heap.push([0, from]);
  while (heap.size) {
    const [current, node] = heap.pop();
    if (node === to) break;
    if (current > cost[node]) continue;
    for (const { edge, to: next } of adjacency[node]) {
      const raw = catalog.edges[edge];
      const candidate = current + raw.k * raw.p;
      if (candidate < cost[next]) {
        cost[next] = candidate;
        via[next] = edge;
        heap.push([candidate, next]);
      }
    }
  }
  if (!Number.isFinite(cost[to])) return null;
  const steps: { edge: number; forward: boolean }[] = [];
  for (let node = to; node !== from;) {
    const edge = via[node];
    const raw = catalog.edges[edge];
    const forward = raw.b === node;
    steps.push({ edge, forward });
    node = forward ? raw.a : raw.b;
  }
  return steps.reverse();
}

function points(edge: RawEdge, forward: boolean): Point[] {
  const list: Point[] = [];
  for (let i = 0; i < edge.g.length; i += 2) list.push([edge.g[i], edge.g[i + 1]]);
  return forward ? list : list.reverse();
}

function pointAtHalf(line: Point[]): Point {
  const lengths = line.slice(1).map((point, i) => Math.hypot(point[0] - line[i][0], point[1] - line[i][1]));
  let remaining = lengths.reduce((sum, value) => sum + value, 0) / 2;
  for (let i = 0; i < lengths.length; i++) {
    if (remaining <= lengths[i]) {
      const t = lengths[i] ? remaining / lengths[i] : 0;
      return [line[i][0] + t * (line[i + 1][0] - line[i][0]), line[i][1] + t * (line[i + 1][1] - line[i][1])];
    }
    remaining -= lengths[i];
  }
  return line[line.length - 1];
}

function simplify(line: Point[], tolerance: number): Point[] {
  if (line.length < 3) return line;
  const keep = new Uint8Array(line.length);
  keep[0] = keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = line[first];
    const [bx, by] = line[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const t = length ? Math.max(0, Math.min(1, ((line[i][0] - ax) * dx + (line[i][1] - ay) * dy) / length)) : 0;
      const distance = Math.hypot(line[i][0] - (ax + t * dx), line[i][1] - (ay + t * dy));
      if (distance > worst) { worst = distance; index = i; }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

const round4 = (value: number) => Math.round(value * 1e4) / 1e4;
const kmText = (value: number) => Math.round(value).toLocaleString("pt-BR");

function segmentLabel(edge: RawEdge, forward: boolean) {
  const start = forward ? edge.f : edge.t;
  const end = forward ? edge.t : edge.f;
  const [low, high] = [Math.min(edge.i, edge.e), Math.max(edge.i, edge.e)];
  return `${edge.r}/${edge.u}${edge.c ? ` (${edge.c})` : ""} km ${kmText(low)}–${kmText(high)} · ${start} → ${end}`;
}

const cache = new Map<string, RoutePlan | null>();

/** Planeja a rota rodoviária federal entre dois municípios do catálogo. */
export function planRoute(originCode: number, destinationCode: number): RoutePlan | null {
  const key = `${originCode}:${destinationCode}`;
  if (cache.has(key)) return cache.get(key)!;
  const origin = cityByCode.get(originCode);
  const destination = cityByCode.get(destinationCode);
  if (!origin || !destination || origin.c === destination.c) return null;

  const steps = shortestPath(origin.v, destination.v);
  let plan: RoutePlan | null = null;
  if (steps?.length) {
    let traveled = 0;
    const line: Point[] = [];
    const segments: RouteSegment[] = steps.flatMap(({ edge: index, forward }) => {
      const edge = catalog.edges[index];
      const geometry = points(edge, forward);
      line.push(...(line.length ? geometry.slice(1) : geometry));
      if (isConnector(edge)) {
        traveled += edge.k;
        return [];
      }
      const midpoint = pointAtHalf(geometry);
      const segment: RouteSegment = {
        snv: edge.s,
        highway: edge.r,
        uf: edge.u,
        label: segmentLabel(edge, forward),
        km_from_origin: Math.round(traveled + edge.k / 2),
        minutes_from_origin: Math.round(((traveled + edge.k / 2) / AVERAGE_SPEED_KMH) * 60),
        latitude: round4(midpoint[1]),
        longitude: round4(midpoint[0]),
      };
      traveled += edge.k;
      return [segment];
    });
    // Rodovias na ordem do percurso, ignorando pequenos trechos urbanos de outras BRs.
    const kmByHighway = new Map<string, number>();
    steps.forEach(({ edge: index }) => {
      const edge = catalog.edges[index];
      if (!isConnector(edge)) kmByHighway.set(edge.r, (kmByHighway.get(edge.r) ?? 0) + edge.k);
    });
    const minimum = Math.max(5, traveled * 0.02);
    const highways = [...kmByHighway.entries()].filter(([, km]) => km >= minimum).map(([code]) => code);
    if (!highways.length && kmByHighway.size) highways.push([...kmByHighway.entries()].sort((a, b) => b[1] - a[1])[0][0]);
    plan = {
      origin: { code: origin.c, name: origin.n, uf: origin.u },
      destination: { code: destination.c, name: destination.n, uf: destination.u },
      distance_km: Math.round(traveled),
      duration_minutes: Math.round((traveled / AVERAGE_SPEED_KMH) * 60),
      highways,
      path: simplify(line, 0.004).map(([lon, lat]) => [round4(lon), round4(lat)] as Point),
      segments: segments.filter(segment => segment.minutes_from_origin <= MAX_CHECKPOINT_MINUTES),
    };
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, plan);
  return plan;
}
