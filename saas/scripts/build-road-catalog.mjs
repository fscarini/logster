// Gera o catálogo rodoviário da Logster a partir de dados públicos:
// - DNIT, Sistema Nacional de Viação (SNV), camada vgeo:vw_snv_rod do GeoServer do DNIT;
// - IBGE, centroides e nomes de municípios, população do Censo 2022 e malha das UFs.
//
// Uso (a partir de saas/): node scripts/build-road-catalog.mjs [--refresh]
// Os downloads ficam em .cache/road-data/ e são reaproveitados, exceto com --refresh.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const cacheDir = resolve(root, ".cache/road-data");
const refresh = process.argv.includes("--refresh");
mkdirSync(cacheDir, { recursive: true });

const WFS = "https://servicos.dnit.gov.br/dnitgeo/geoserver/wfs";
const MIN_POPULATION = 100_000;
const CITY_MAX_ACCESS_KM = 30;
const CONNECTOR_MAX_KM = 12;
const SNAP_DEGREES = 0.005; // ~500 m: junta extremidades de trechos que se encontram
const ROUTE_TOLERANCE = 0.002; // ~200 m: geometria usada no traçado das rotas
const BASE_TOLERANCE = 0.012; // ~1,3 km: malha de fundo do mapa
const SURFACE_PENALTY = { DUP: 0.92, PAV: 1, IMP: 1.8 }; // PLA (planejada), LEN e TRV ficam de fora

const ufByCode = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB", 26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };

async function cached(name, url) {
  const file = resolve(cacheDir, name);
  if (!refresh && existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  console.log(`Baixando ${name}…`);
  const response = await fetch(url, { signal: AbortSignal.timeout(600_000) });
  if (!response.ok) throw new Error(`${url} respondeu HTTP ${response.status}`);
  const text = await response.text();
  writeFileSync(file, text);
  return JSON.parse(text);
}

function wfs(params) {
  const url = new URL(WFS);
  url.search = new URLSearchParams({ service: "WFS", version: "2.0.0", request: "GetFeature", typeNames: "vgeo:vw_snv_rod", outputFormat: "application/json", ...params }).toString();
  return url;
}

// --- Geometria -------------------------------------------------------------------------------

const KM_PER_DEGREE = 111.32;
function distanceKm([lon1, lat1], [lon2, lat2]) {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  return Math.hypot(x, lat2 - lat1) * KM_PER_DEGREE;
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const length = dx * dx + dy * dy;
    let worst = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const [px, py] = points[i];
      const t = length ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / length)) : 0;
      const distance = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (distance > worst) { worst = distance; index = i; }
    }
    if (worst > tolerance) {
      keep[index] = 1;
      stack.push([first, index], [index, last]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const round = (value, digits) => Math.round(value * 10 ** digits) / 10 ** digits;
const flat = (points, digits) => points.flatMap(([lon, lat]) => [round(lon, digits), round(lat, digits)]);

// --- Texto -----------------------------------------------------------------------------------

const lowerWords = new Set(["DE", "DA", "DO", "DAS", "DOS", "E", "EM", "NA", "NO", "NAS", "NOS", "AO", "COM", "A"]);
// Siglas mantidas em maiúsculas: UFs, tipos de via e órgãos.
const keepUpper = new Set([...Object.values(ufByCode), "BR", "KM", "PRF", "DNIT", "RFFSA", "DER", "II", "III", "IV", "VI"]);
function titleCase(text) {
  const clean = (text ?? "").trim().replace(/\s+/g, " ");
  let first = true;
  return clean.replace(/\p{L}+/gu, run => {
    const upper = run.toUpperCase();
    const atStart = first;
    first = false;
    if (!atStart && lowerWords.has(upper)) return run.toLowerCase();
    if (run.length === 1 || keepUpper.has(upper)) return upper;
    return upper[0] + run.slice(1).toLowerCase();
  });
}

// --- Dados -----------------------------------------------------------------------------------

const latest = await cached("snv-version.json", wfs({ propertyName: "Versao_SNV", sortBy: "Versao_SNV D", count: "1" }));
const version = latest.features[0].properties.Versao_SNV;
console.log(`Versão do SNV: ${version}`);

const snv = await cached(`snv-${version}.json`, wfs({
  cql_filter: `Versao_SNV='${version}'`,
  propertyName: "geom,Codigo_BR,Unidade_Federacao,Sigla_Tipo_Trecho,Codigo_SNV,Local_Inicio,Local_Fim,Quilometragem_Inicio,Quilometragem_Fim,Extensao,Superficie_Federal,Estadual_Coincidente,Superficie_Estadual_Coincidente",
}));
const centroids = await cached("ibge-centroides.json", "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR/metadados?intrarregiao=municipio");
const population = await cached("ibge-populacao-2022.json", "https://apisidra.ibge.gov.br/values/t/4709/n6/all/v/93/p/2022");
const municipalities = await cached("ibge-municipios.json", "https://servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado");
const states = await cached("ibge-ufs.json", "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&intrarregiao=UF&qualidade=minima");

// --- Grafo -----------------------------------------------------------------------------------

const nodeIndex = new Map();
const nodes = [];
function nodeFor([lon, lat]) {
  const key = `${Math.round(lon / SNAP_DEGREES)}:${Math.round(lat / SNAP_DEGREES)}`;
  let index = nodeIndex.get(key);
  if (index === undefined) {
    index = nodes.length;
    nodeIndex.set(key, index);
    nodes.push([lon, lat]);
  }
  return index;
}

let rawEdges = [];
for (const feature of snv.features) {
  const p = feature.properties;
  // Trechos federais planejados que coincidem com rodovia estadual existente usam a superfície estadual.
  const surface = p.Superficie_Federal === "PLA" && p.Estadual_Coincidente ? p.Superficie_Estadual_Coincidente : p.Superficie_Federal;
  const penalty = SURFACE_PENALTY[surface];
  if (!penalty || !feature.geometry) continue;
  const lines = feature.geometry.type === "MultiLineString" ? feature.geometry.coordinates : [feature.geometry.coordinates];
  const points = lines.flat();
  if (points.length < 2) continue;
  const measured = points.slice(1).reduce((sum, point, i) => sum + distanceKm(points[i], point), 0);
  rawEdges.push({
    a: nodeFor(points[0]),
    b: nodeFor(points[points.length - 1]),
    km: p.Extensao > 0 ? p.Extensao : measured,
    penalty,
    snv: p.Codigo_SNV,
    br: `BR-${String(p.Codigo_BR).padStart(3, "0")}`,
    state: surface === p.Superficie_Federal ? null : String(p.Estadual_Coincidente).trim(),
    uf: p.Unidade_Federacao,
    from: titleCase(p.Local_Inicio),
    to: titleCase(p.Local_Fim),
    kmStart: p.Quilometragem_Inicio,
    kmEnd: p.Quilometragem_Fim,
    points,
  });
}
rawEdges = rawEdges.filter(edge => edge.a !== edge.b);

// O SNV cobre só a malha federal. Onde um trecho termina sem continuação (ex.: a BR-116 na divisa
// São Paulo/Taboão, ligada à Dutra pelas Marginais e pelo Rodoanel, que são estaduais), criamos uma
// conexão explícita até o nó mais próximo, com penalidade. Conexões nunca viram ponto monitorado.
const degree = new Map();
for (const edge of rawEdges) for (const node of [edge.a, edge.b]) degree.set(node, (degree.get(node) ?? 0) + 1);
const grid = new Map();
const cell = ([lon, lat]) => `${Math.floor(lon / 0.1)}:${Math.floor(lat / 0.1)}`;
for (const node of degree.keys()) {
  const key = cell(nodes[node]);
  if (!grid.has(key)) grid.set(key, []);
  grid.get(key).push(node);
}
const neighbors = new Map();
for (const edge of rawEdges) {
  if (!neighbors.has(edge.a)) neighbors.set(edge.a, new Set());
  if (!neighbors.has(edge.b)) neighbors.set(edge.b, new Set());
  neighbors.get(edge.a).add(edge.b);
  neighbors.get(edge.b).add(edge.a);
}
let connectors = 0;
for (const [node, count] of degree) {
  if (count !== 1) continue;
  const [lon, lat] = nodes[node];
  let best = -1;
  let bestKm = CONNECTOR_MAX_KM;
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
    for (const other of grid.get(`${Math.floor(lon / 0.1) + dx}:${Math.floor(lat / 0.1) + dy}`) ?? []) {
      if (other === node || neighbors.get(node).has(other)) continue;
      const km = distanceKm(nodes[node], nodes[other]);
      if (km < bestKm) { bestKm = km; best = other; }
    }
  }
  if (best < 0) continue;
  connectors += 1;
  neighbors.get(node).add(best);
  neighbors.get(best).add(node);
  rawEdges.push({
    a: node, b: best, km: bestKm * 1.3, penalty: 1.5, snv: `CX${connectors}`, br: "", state: null, uf: "",
    from: "", to: "", kmStart: 0, kmEnd: 0, points: [nodes[node], nodes[best]],
  });
}
console.log(`Conexões fora do SNV: ${connectors}`);

// Mantém apenas o maior componente conectado, o único útil para roteamento.
const parent = nodes.map((_, i) => i);
const find = x => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
for (const edge of rawEdges) parent[find(edge.a)] = find(edge.b);
const componentKm = new Map();
for (const edge of rawEdges) componentKm.set(find(edge.a), (componentKm.get(find(edge.a)) ?? 0) + edge.km);
const mainComponent = [...componentKm.entries()].sort((x, y) => y[1] - x[1])[0][0];
const usedEdges = rawEdges.filter(edge => find(edge.a) === mainComponent);

const remap = new Map();
const compactNodes = [];
const useNode = index => {
  if (!remap.has(index)) { remap.set(index, compactNodes.length); compactNodes.push(nodes[index]); }
  return remap.get(index);
};
const edges = usedEdges.map(edge => ({
  a: useNode(edge.a),
  b: useNode(edge.b),
  k: round(edge.km, 1),
  p: edge.penalty,
  s: edge.snv,
  r: edge.br,
  u: edge.uf,
  ...(edge.state ? { c: edge.state } : {}),
  f: edge.from,
  t: edge.to,
  i: edge.kmStart,
  e: edge.kmEnd,
  g: flat(simplify(edge.points, ROUTE_TOLERANCE), 4),
}));

// --- Cidades ---------------------------------------------------------------------------------

const populationByCode = new Map(population.slice(1).map(row => [Number(row.D1C), Number(row.V)]));
const centroidByCode = new Map(centroids.map(item => [Number(item.id), [item.centroide.longitude, item.centroide.latitude]]));
// O centroide do polígono municipal pode ficar longe da sede em municípios extensos. Por isso,
// a cidade é ancorada primeiro nos trechos do SNV cuja descrição cita o município na mesma UF.
const fold = text => text.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
const nodesByPlace = new Map();
for (const edge of edges) {
  for (const text of [edge.f, edge.t]) {
    const key = `${edge.u}:${fold(text)}`;
    if (!nodesByPlace.has(key)) nodesByPlace.set(key, new Set());
    nodesByPlace.get(key).add(edge.a).add(edge.b);
  }
}
const cities = [];
for (const item of municipalities) {
  const code = item["municipio-id"];
  const people = populationByCode.get(code) ?? 0;
  const point = centroidByCode.get(code);
  if (people < MIN_POPULATION || !point) continue;
  const name = new RegExp(`(^|[^A-Z])${fold(item["municipio-nome"]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Z]|$)`);
  const named = new Set();
  for (const [key, set] of nodesByPlace) if (key.startsWith(`${item["UF-sigla"]}:`) && name.test(key.slice(3))) set.forEach(index => named.add(index));
  const nearest = (candidates, target) => {
    let best = -1;
    let bestKm = Infinity;
    for (const index of candidates) {
      const km = distanceKm(target, compactNodes[index]);
      if (km < bestKm) { bestKm = km; best = index; }
    }
    return { best, bestKm };
  };
  // Entre os nós citados, usa o mais próximo do centro deles (a área urbana atravessada pelas rodovias).
  const local = [...named].filter(index => distanceKm(point, compactNodes[index]) <= 4 * CITY_MAX_ACCESS_KM);
  const center = local.length ? [0, 1].map(axis => local.reduce((sum, index) => sum + compactNodes[index][axis], 0) / local.length) : point;
  let { best, bestKm } = nearest(local, center);
  if (best < 0) ({ best, bestKm } = nearest(compactNodes.keys(), point));
  else bestKm = 0;
  if (best < 0 || (bestKm > CITY_MAX_ACCESS_KM && !named.has(best))) continue;
  const [x, y] = compactNodes[best];
  cities.push({ c: code, n: item["municipio-nome"], u: item["UF-sigla"], v: best, x: round(x, 4), y: round(y, 4), pop: people });
}
cities.sort((x, y) => x.u.localeCompare(y.u) || x.n.localeCompare(y.n, "pt-BR"));

// --- Saídas ----------------------------------------------------------------------------------

const generatedAt = new Date().toISOString().slice(0, 10);
const sources = {
  snv: `DNIT, Sistema Nacional de Viação, versão ${version} (camada vgeo:vw_snv_rod)`,
  ibge: "IBGE, malhas territoriais, localidades e Censo Demográfico 2022 (tabela 4709)",
};

mkdirSync(resolve(root, "data"), { recursive: true });
writeFileSync(resolve(root, "data/road-catalog.json"), JSON.stringify({
  version, generated_at: generatedAt, sources,
  nodes: flat(compactNodes, 4),
  edges,
  cities,
}));

const ufs = states.features.map(feature => {
  const polygons = feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates : [feature.geometry.coordinates];
  return {
    uf: ufByCode[Number(feature.properties.codarea)],
    rings: polygons.flatMap(polygon => polygon.map(ring => flat(simplify(ring, 0.01), 3))).filter(ring => ring.length >= 8),
  };
});
writeFileSync(resolve(root, "public/data/brasil-base.json"), JSON.stringify({
  version, sources,
  ufs,
  network: edges.filter(edge => !edge.s.startsWith("CX")).map(edge => {
    const points = [];
    for (let i = 0; i < edge.g.length; i += 2) points.push([edge.g[i], edge.g[i + 1]]);
    return flat(simplify(points, BASE_TOLERANCE), 3);
  }),
}));

const totalKm = edges.reduce((sum, edge) => sum + edge.k, 0);
console.log(`Trechos: ${edges.length} · nós: ${compactNodes.length} · ${Math.round(totalKm).toLocaleString("pt-BR")} km · cidades: ${cities.length}`);
