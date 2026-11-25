# Logster SaaS — README técnico

Referência para quem desenvolve, integra ou opera o Logster: arquitetura, configuração, autenticação, APIs HTTP, modelo de dados e regras de cálculo. O comportamento do produto do ponto de vista do usuário está no [README funcional](README-funcional.md).

## Sumário

1. [Visão geral da arquitetura](#1-visão-geral-da-arquitetura)
2. [Estrutura do repositório](#2-estrutura-do-repositório)
3. [Configuração e execução](#3-configuração-e-execução)
4. [Autenticação e sessão](#4-autenticação-e-sessão)
5. [Referência das APIs](#5-referência-das-apis)
6. [Modelo de dados](#6-modelo-de-dados)
7. [Regras de cálculo](#7-regras-de-cálculo)
8. [Catálogo rodoviário](#8-catálogo-rodoviário)
9. [Previsão do tempo](#9-previsão-do-tempo)
10. [Segurança](#10-segurança)
11. [Limitações conhecidas](#11-limitações-conhecidas)

---

## 1. Visão geral da arquitetura

```
┌────────────────────┐   POST de formulário    ┌──────────────────────────────┐
│  Landing page      │ ──────────────────────▶ │  SaaS (Next.js 16)           │
│  Next 14, estática │ ◀────── 303 erro ────── │  app/api/*  (route handlers) │
│  (raiz do repo)    │                         │  componentes React (cliente) │
└────────────────────┘                         └──────┬───────────┬───────────┘
                                                       │           │
                                   supabase-js (RLS)   │           │ fetch
                                                       ▼           ▼
                                        ┌─────────────────┐  ┌───────────────┐
                                        │ Supabase        │  │ Open-Meteo    │
                                        │ Auth + Postgres │  │ previsão      │
                                        └─────────────────┘  └───────────────┘
                                                ▲
                       pg_cron + pg_net, a cada hora: POST /api/cron/forecast
```

- **Landing page** (`/`, raiz do repositório): site estático exportado (`output: "export"`). Contém o formulário de login que envia as credenciais ao SaaS.
- **SaaS** (`saas/`): Next.js 16 com App Router. A interface é uma única página cliente (`components/Workspace.tsx`) que consome as APIs internas. Toda regra de negócio roda no servidor (`lib/`).
- **Supabase**: autenticação por e-mail e senha e banco Postgres com Row Level Security (RLS). Cada usuário enxerga apenas a própria operação, exceto as três rotas iniciais, que são compartilhadas.
- **Open-Meteo**: previsão horária no ponto monitorado de cada rota.
- **Catálogo rodoviário**: arquivo gerado (`data/road-catalog.json`) a partir do SNV/DNIT e do IBGE, usado no servidor para traçar rotas. Ver a [seção 8](#8-catálogo-rodoviário).

### Modos de execução

| Modo | Quando | Persistência | Previsão |
|---|---|---|---|
| `demo` | `LOGSTER_DEMO_MODE=1`, ou em desenvolvimento sem credenciais Supabase | SQLite local em `saas/.data/demo.sqlite`, separado por cookie de navegador (7 dias) | Simulada e determinística (`demoForecast`) |
| `supabase` | Padrão em produção; `LOGSTER_DEMO_MODE=0` força o modo | Postgres no Supabase, com RLS | Open-Meteo, pelo agendamento e sob demanda |

A seleção acontece em `lib/supabase.ts` (`isDemoMode`) e `lib/operations.ts` (`getStore`). As duas implementações seguem a interface `Store` (`lib/store.ts`).

## 2. Estrutura do repositório

```
saas/
├── app/
│   ├── page.tsx                  Página única (Workspace)
│   └── api/
│       ├── operations/route.ts   Leitura e escrita da operação
│       ├── session/route.ts      Login/logout JSON (tela de login própria)
│       ├── session/form/route.ts Login por formulário vindo da landing
│       ├── catalog/route.ts      Cidades do catálogo
│       ├── catalog/route/route.ts Planejamento de rota entre cidades
│       └── cron/forecast/route.ts Atualização agendada de previsões
├── components/                   Interface (React, cliente)
│   ├── Workspace.tsx  Dashboard.tsx  DeliveryDetail.tsx  Editors.tsx
│   ├── BrazilMap.tsx  Weather.tsx
├── lib/
│   ├── model.ts       Tipos de domínio e constantes
│   ├── operations.ts  Montagem da operação e validação das escritas
│   ├── risk.ts        Classificação de risco e alternativas
│   ├── weather.ts     Cliente Open-Meteo
│   ├── roads.ts       Catálogo e roteamento (somente servidor)
│   ├── dashboard.ts   Indicadores do painel gerencial
│   ├── supabase.ts    Store Supabase e cliente SSR
│   ├── demo.ts        Store da demonstração (SQLite)
│   ├── store.ts       Interface Store
│   └── inputs.ts      Leitura e validação de entrada
├── data/road-catalog.json        Grafo rodoviário gerado (~2 MB, servidor)
├── public/data/brasil-base.json  Mapa base gerado (~340 KB, cliente)
├── scripts/build-road-catalog.mjs Gerador do catálogo
└── supabase/
    ├── migrations/               Esquema do banco, em ordem
    └── schedule.sql              Agendamento horário (pg_cron)
```

## 3. Configuração e execução

### Requisitos

- Node.js 22.13 ou superior (usa `node:sqlite` no modo demonstração).
- Para o modo Supabase: um projeto Supabase com as migrações aplicadas.

### Variáveis de ambiente do SaaS (`saas/.env.local`)

| Variável | Onde é usada | Obrigatória | Descrição |
|---|---|---|---|
| `LOGSTER_DEMO_MODE` | servidor | não | `1` força a demonstração; `0` exige Supabase. Sem valor: demonstração em desenvolvimento sem credenciais. |
| `NEXT_PUBLIC_SUPABASE_URL` | servidor e cliente | modo Supabase | URL do projeto, ex.: `https://<ref>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | servidor | modo Supabase | Chave publicável (`sb_publishable_…`). |
| `SUPABASE_SERVICE_ROLE_KEY` | somente servidor | modo Supabase | Única credencial com permissão para gravar previsões, tanto no agendamento quanto na atualização sob demanda. Sem ela, as entregas ficam com "Sem previsão". |
| `LOGSTER_CRON_SECRET` | somente servidor | para o agendamento | Segredo do bearer token de `/api/cron/forecast`. |
| `NEXT_PUBLIC_LOGSTER_LANDING_URL` | servidor e cliente | não | Origem da landing. Habilita o login pela landing e os redirecionamentos para ela. |
| `SUPABASE_DB_PASSWORD` | CLI | não | Senha do banco, usada apenas pela CLI do Supabase. |

### Variáveis da landing (`.env.local` na raiz)

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_LOGSTER_APP_URL` | Endereço do SaaS. Ativa o formulário de login. Por ser um site estático, gere a exportação de novo após alterar. |
| `NEXT_PUBLIC_LOGSTER_CONTACT_EMAIL` | Opcional. Exibe o link de contato. |

### Comandos

```sh
# SaaS
npm --prefix saas ci
npm --prefix saas run dev -- --port 3001   # desenvolvimento
npm --prefix saas run typecheck
npm --prefix saas run build && npm --prefix saas start
npm --prefix saas run catalog -- --refresh  # regenera o catálogo rodoviário

# Landing
npm ci
npm run dev -- --port 3000
npm run build                               # exporta para out/
```

### Banco de dados

Aplique as migrações em ordem, pela CLI (`supabase db push --remote`) ou pelo editor SQL:

1. `supabase/migrations/202611240001_mvp.sql` — tabelas, índices, RLS e as três rotas iniciais.
2. `supabase/migrations/202611250001_road_catalog.sql` — colunas do catálogo rodoviário em `routes`.

Para o agendamento horário: ative `pg_cron` e `pg_net`, crie no Vault `logster_app_url` (URL pública do SaaS) e `logster_cron_secret` (igual a `LOGSTER_CRON_SECRET`) e execute `supabase/schedule.sql`.

## 4. Autenticação e sessão

A sessão é a do Supabase Auth, guardada em cookies `httpOnly` na origem do SaaS por `@supabase/ssr`. Toda chamada às APIs de dados lê o usuário a partir desses cookies (`authenticatedStore`). No modo demonstração não há login: a operação é identificada pelo cookie `logster_demo_session`.

### Login pela landing (fluxo principal)

```
Usuário            Landing                        SaaS                         Supabase
   │  clica Entrar    │                              │                              │
   │ ───────────────▶ │ abre o diálogo               │                              │
   │  envia e-mail    │                              │                              │
   │  e senha         │ POST /api/session/form ────▶ │ confere Origin               │
   │                  │ (navegação, form-urlencoded) │ signInWithPassword ────────▶ │
   │                  │                              │ ◀──────────── sessão ─────── │
   │ ◀──────────────────────── 303 Location: / + Set-Cookie ─────────────────────── │
   │                  │                              │                              │
   │        em erro:  │ ◀── 303 /?login=erro#entrar ─│                              │
```

- O envio é um POST de navegação, não `fetch`. O cookie de sessão nasce como cookie primário da origem do SaaS, sem CORS nem cookies de terceiros.
- O SaaS só aceita o formulário quando o cabeçalho `Origin` é a própria origem ou a de `NEXT_PUBLIC_LOGSTER_LANDING_URL`. Isso impede login CSRF.
- Ao abrir o SaaS sem sessão, ou quando uma escrita retorna 401, o cliente redireciona para `<landing>/?login=entrar#entrar` (ou `?login=expirada`). Ao sair, redireciona para a landing.
- Sem `NEXT_PUBLIC_LOGSTER_LANDING_URL`, o SaaS exibe a própria tela de login, que usa `POST /api/session`.

### Contas

Não há cadastro público. Crie usuários em **Authentication → Users** no painel do Supabase.

## 5. Referência das APIs

Convenções:

- Base: a origem do SaaS (ex.: `http://localhost:3001`).
- As APIs de dados exigem a sessão por cookie; não há tokens de API para terceiros.
- Corpo JSON com `Content-Type: application/json`, até 10 KB.
- Erros de validação retornam `400` com `{ "error": "<mensagem em português>" }`. As mensagens são pensadas para exibição direta ao usuário.
- Respostas de dados usam `Cache-Control: private, no-store`.

### Resumo

| Método | Caminho | Autenticação | Finalidade |
|---|---|---|---|
| `GET` | `/api/operations` | sessão | Operação completa: rotas, entregas, avaliações e decisões |
| `POST` | `/api/operations` | sessão | Cadastrar rota, cadastrar entrega ou registrar decisão |
| `GET` | `/api/catalog` | sessão | Cidades do catálogo rodoviário |
| `GET` | `/api/catalog/route` | sessão | Planejar rota entre duas cidades |
| `POST` | `/api/session/form` | `Origin` permitido | Login por formulário (landing) |
| `POST` | `/api/session` | — | Login/logout em JSON (tela própria) |
| `POST` | `/api/cron/forecast` | bearer secret | Atualizar previsões de todas as rotas |

---

### `GET /api/operations`

Retorna a operação do usuário já avaliada. Antes de responder, o servidor atualiza sob demanda as previsões das rotas com passagem nas próximas 72 horas, quando ausentes ou com mais de 1 hora (no máximo 12 rotas por chamada; ver a [seção 9](#9-previsão-do-tempo)).

**Respostas**

| Status | Corpo |
|---|---|
| `200` | `Operations` |
| `401` | `{ "error": "Entre para acessar sua operação." }` |
| `500` | `{ "error": "Não foi possível carregar a operação. Tente novamente." }` |

**Exemplo de `200` (resumido)**

```json
{
  "mode": "supabase",
  "routes": [
    {
      "id": "00000000-0000-4000-8000-000000000116",
      "code": "BR-116",
      "origin": "São Paulo",
      "destination": "Curitiba",
      "checkpoint": "Serra do Cafezal",
      "latitude": -23.975,
      "longitude": -47.155,
      "checkpoint_minutes": 120,
      "origin_code": 3550308,
      "destination_code": 4106902,
      "checkpoint_snv": null,
      "distance_km": 420,
      "highways": ["BR-116", "BR-101"],
      "path": [[-46.7266, -23.5143], [-46.81, -23.6195], "…"],
      "forecast": {
        "fetched_at": "2026-11-25T03:00:12.000Z",
        "simulated": false,
        "hours": [
          { "time": "2026-11-25T03:00:00.000Z", "rain_mm": 0.1, "probability": 35, "gust_kmh": 18.4, "visibility_m": 23300, "code": 51, "temp_c": 23.1 }
        ]
      }
    }
  ],
  "deliveries": [
    {
      "id": "6f1c…",
      "route_id": "00000000-0000-4000-8000-000000000116",
      "reference": "CARGA-104",
      "departure_at": "2026-11-25T07:00:00.000Z",
      "hour_cost_cents": 25000,
      "assessment": {
        "level": "high",
        "checkpoint_at": "2026-11-25T09:00:00.000Z",
        "rain_mm": 18,
        "probability": 85,
        "gust_kmh": 42,
        "visibility_m": 3000,
        "weather_code": 65,
        "hazards": [{ "kind": "rain", "level": "high", "value": 18 }],
        "forecast_at": "2026-11-25T03:00:12.000Z",
        "delay_minutes": 120,
        "cost_cents": 50000,
        "recommendation": "postpone",
        "alternative": { "shift_hours": 4, "checkpoint_at": "2026-11-25T13:00:00.000Z", "level": "low", "rain_mm": 0.8, "cost_cents": 0 }
      },
      "decision": null
    }
  ]
}
```

Notas:

- `path` é o traçado simplificado `[longitude, latitude][]`, ou `null` em rotas sem catálogo.
- `forecast.hours` cobre de 1 hora atrás até 72 horas à frente.
- `deliveries` vem ordenado por `departure_at`.
- Os campos de `assessment` estão descritos na [seção 6](#tipo-assessment).

---

### `POST /api/operations`

Executa uma escrita e devolve a operação atualizada (mesmo corpo do `GET`). O campo `action` define a operação. O campo `id` (UUID v4 gerado pelo cliente) torna a chamada idempotente: repetir o mesmo `id` não duplica o registro.

#### `action: "route"` — cadastrar rota do catálogo

```json
{
  "action": "route",
  "id": "2b0f9a1e-4c39-4d5e-9b0a-6c8f1e2d3a4b",
  "originCode": 4314902,
  "destinationCode": 2304400,
  "checkpointSnv": "381BMG0170"
}
```

| Campo | Regra |
|---|---|
| `originCode`, `destinationCode` | Códigos IBGE de municípios do catálogo (`GET /api/catalog`), diferentes entre si. |
| `checkpointSnv` | Código SNV de um trecho presente em `segments` do plano dessa rota (`GET /api/catalog/route`). |

O servidor recalcula a rota e deriva todos os campos gravados (código das rodovias, nomes, coordenadas, minutos até o trecho). O cliente não envia traçado nem coordenadas.

Erros `400`: `"Selecione a origem no catálogo de municípios."`, `"Escolha cidades diferentes para origem e destino."`, `"Não há ligação pela malha rodoviária federal entre essas cidades."`, `"Selecione um trecho monitorado da rota."`.

#### `action: "delivery"` — cadastrar entrega

```json
{
  "action": "delivery",
  "id": "8c1d…",
  "routeId": "00000000-0000-4000-8000-000000000116",
  "reference": "CARGA-104",
  "departureAt": "2026-11-25T07:00:00.000Z",
  "hourCost": 250
}
```

| Campo | Regra |
|---|---|
| `routeId` | UUID de uma rota visível ao usuário. |
| `reference` | Texto de 1 a 60 caracteres. |
| `departureAt` | ISO 8601. Entre agora (tolerância de 1 minuto) e 30 dias à frente. |
| `hourCost` | Custo de espera por hora, em reais, de 0 a 100.000. Gravado em centavos. |

#### `action: "decision"` — registrar decisão sobre um alerta

```json
{
  "action": "decision",
  "id": "8c1d…",
  "choice": "postpone",
  "note": "Horário revisado com a transportadora"
}
```

| Campo | Regra |
|---|---|
| `id` | UUID da entrega. |
| `choice` | `advance` (antecipar), `postpone` (adiar) ou `reroute` (avaliar desvio). |
| `note` | Opcional, até 350 caracteres. |

A entrega precisa ter alerta ativo (`assessment.recommendation` não nulo). Cada entrega aceita uma única decisão; uma segunda chamada é ignorada. A decisão guarda uma cópia da avaliação exibida naquele momento.

**Respostas comuns:** `200` operação atualizada · `400` validação · `401` sessão ausente ou expirada · `500` falha inesperada.

---

### `GET /api/catalog`

Lista as cidades do catálogo e a versão dos dados.

```json
{
  "version": "202610A",
  "generated_at": "2026-11-25",
  "sources": { "snv": "DNIT, Sistema Nacional de Viação, versão 202610A (camada vgeo:vw_snv_rod)", "ibge": "IBGE, malhas territoriais, localidades e Censo Demográfico 2022 (tabela 4709)" },
  "cities": [{ "code": 3550308, "name": "São Paulo", "uf": "SP", "population": 11451999 }]
}
```

`401` sem sessão. Resposta com `Cache-Control: private, max-age=3600`.

---

### `GET /api/catalog/route?from=<código IBGE>&to=<código IBGE>`

Calcula o menor percurso pela malha federal e lista os trechos candidatos a ponto monitorado.

```json
{
  "origin": { "code": 3550308, "name": "São Paulo", "uf": "SP" },
  "destination": { "code": 4106902, "name": "Curitiba", "uf": "PR" },
  "distance_km": 420,
  "duration_minutes": 420,
  "highways": ["BR-116", "BR-101"],
  "path": [[-46.7266, -23.5143], "…"],
  "segments": [
    {
      "snv": "116BSP2580",
      "highway": "BR-116",
      "uf": "SP",
      "label": "BR-116/SP km 272–281 · Entr SP-234 → Entr SP-228",
      "km_from_origin": 27,
      "minutes_from_origin": 27,
      "latitude": -23.6703,
      "longitude": -46.8997
    }
  ]
}
```

| Status | Quando |
|---|---|
| `200` | Rota encontrada |
| `400` | Parâmetros ausentes, não numéricos ou iguais |
| `401` | Sem sessão |
| `404` | Sem ligação pela malha federal (ou cidade fora do catálogo) |

`segments` traz apenas trechos com passagem em até 48 horas da saída (limite de `checkpoint_minutes`) e nunca inclui conexões fora do SNV.

---

### `POST /api/session/form`

Login por formulário HTML, usado pela landing. Corpo `application/x-www-form-urlencoded` (ou `multipart/form-data`) com `email` e `password`.

| Situação | Resposta |
|---|---|
| `Origin` ausente ou não permitido | `403` `{ "error": "Origem não autorizada." }` |
| Modo demonstração | `303` para `/` |
| Campos vazios ou acima do limite (e-mail 254, senha 128) | `303` para `<landing>/?login=invalido#entrar` |
| Credenciais recusadas | `303` para `<landing>/?login=erro#entrar` |
| Supabase indisponível ou não configurado | `303` para `<landing>/?login=indisponivel#entrar` |
| Sucesso | `303` para `/` com os cookies de sessão |

Sem `NEXT_PUBLIC_LOGSTER_LANDING_URL`, os redirecionamentos de erro vão para `/?login=<motivo>` no próprio SaaS.

### `POST /api/session`

Login e logout em JSON, usado pela tela de login própria do SaaS.

```json
{ "action": "login", "email": "operacao@empresa.com", "password": "••••••" }
{ "action": "logout" }
```

| Status | Corpo |
|---|---|
| `200` | `{ "ok": true }` |
| `400` | Validação (`"Informe a senha da conta."`, `"Operação inválida."`) |
| `401` | `{ "error": "Confira o e-mail e a senha e tente novamente." }` |
| `409` | Modo demonstração dispensa login |
| `502` / `503` | Falha ou ausência de configuração do Supabase |

### `POST /api/cron/forecast`

Atualiza a previsão de todas as rotas, em lotes de 6. Chamado pelo `pg_cron` a cada hora.

```
Authorization: Bearer <LOGSTER_CRON_SECRET>
```

| Status | Corpo |
|---|---|
| `200` | `{ "updated": 4, "failed": 0 }` |
| `401` | Segredo ausente ou incorreto (comparação em tempo constante) |
| `502` | Alguma rota falhou (`failed > 0`) ou erro ao ler as rotas |
| `503` | Agendamento não configurado ou modo demonstração |

## 6. Modelo de dados

### Tabelas (Postgres)

| Tabela | Colunas principais | Acesso (RLS) |
|---|---|---|
| `routes` | `id`, `owner_id` (nulo = rota inicial compartilhada), `code`, `origin`, `destination`, `checkpoint`, `latitude`, `longitude`, `checkpoint_minutes` (0–2880), `origin_code`, `destination_code`, `checkpoint_snv` | Leitura: rotas compartilhadas e próprias. Inserção: próprias. |
| `deliveries` | `id`, `owner_id`, `route_id`, `reference`, `departure_at`, `hour_cost_cents` | Leitura e inserção: próprias, em rota visível. |
| `forecasts` | `route_id` (PK), `fetched_at`, `hours` (jsonb) | Leitura: de rotas visíveis. Escrita: só `service_role`. |
| `decisions` | `delivery_id` (PK), `owner_id`, `choice`, `note`, `recorded_at`, `assessment` (jsonb) | Leitura e inserção: próprias. |

Não há `update` nem `delete` para usuários: registros são imutáveis no MVP. A restrição `routes_catalog_pair` exige `origin_code` e `destination_code` ambos nulos (rota manual antiga) ou ambos preenchidos e diferentes.

### Tipo `Assessment`

Avaliação calculada a cada leitura (não é gravada, exceto como cópia dentro de `decisions.assessment`).

| Campo | Tipo | Descrição |
|---|---|---|
| `level` | `low` · `moderate` · `high` · `unavailable` · `outside` | Nível de risco. `unavailable`: sem previsão recente. `outside`: passagem fora da janela de 72 h. |
| `checkpoint_at` | ISO 8601 | Hora estimada de passagem: saída + `checkpoint_minutes`. |
| `rain_mm`, `probability`, `gust_kmh`, `visibility_m`, `weather_code` | número ou `null` | Condições previstas na hora da passagem. |
| `hazards` | `Hazard[]` | Perigos detectados, do mais grave ao menos grave: `{ kind: "rain" \| "storm" \| "wind" \| "visibility", level: "moderate" \| "high", value }`. |
| `delay_minutes`, `cost_cents` | número ou `null` | Atraso e custo estimados. |
| `recommendation` | `advance` · `postpone` · `reroute` · `null` | Ação sugerida; não nula indica alerta. |
| `alternative` | objeto ou `null` | Melhor janela encontrada: `shift_hours`, `checkpoint_at`, `level`, `rain_mm`, `cost_cents`. |
| `forecast_at` | ISO 8601 ou `null` | Momento da consulta da previsão usada. |

Decisões registradas antes da versão com perigos climáticos não têm `hazards`, `alternative` e afins; o cliente trata esses campos como opcionais.

## 7. Regras de cálculo

Implementadas em `lib/risk.ts` (avaliação) e `lib/dashboard.ts` (indicadores). Os limites são ilustrativos do MVP.

### Classificação da hora de passagem

| Perigo | Moderado | Alto | Variável Open-Meteo |
|---|---|---|---|
| Chuva | ≥ 5 mm/h | ≥ 15 mm/h | `precipitation` |
| Rajadas | ≥ 50 km/h | ≥ 75 km/h | `wind_gusts_10m` |
| Visibilidade | < 1.000 m | < 200 m | `visibility` (sem ela, códigos 45/48 de neblina contam como moderado) |
| Tempestade | código 95 | códigos 96 e 99 (granizo) | `weather_code` |

O nível da hora é o mais grave entre os perigos; sem perigo, `low`. Uma pontuação contínua (nível × 100 + intensidades normalizadas) desempata horas do mesmo nível.

### Pré-condições

- A passagem precisa estar entre agora e 72 horas à frente; caso contrário, `outside`.
- A previsão precisa ter sido consultada há no máximo 3 horas e conter a hora da passagem; caso contrário, `unavailable`.

### Atraso, custo e recomendação

- Atraso: 0 min (baixo), 45 min (moderado), 120 min (alto).
- Custo: `hour_cost_cents × atraso / 60`.
- Alternativas: saídas deslocadas em −2, +2, −4 e +4 horas, desde que a nova saída não esteja no passado e a nova passagem fique dentro da janela. Escolhe-se a de menor pontuação.
- A alternativa só é sugerida quando reduz o nível de risco ou reduz a pontuação em pelo menos 30%. Com alternativa, a recomendação é `advance` (deslocamento negativo) ou `postpone` (positivo); sem alternativa útil, `reroute`. Risco baixo não gera recomendação.

### Indicadores do painel

| Indicador | Cálculo |
|---|---|
| Entregas em 72 h | Entregas com `level` diferente de `outside` |
| Alertas sem decisão | `recommendation` não nula e sem decisão |
| Custo em risco | Soma de `cost_cents` dos alertas sem decisão |
| Custo evitável | Soma de `cost_cents − alternative.cost_cents` dos alertas com alternativa |
| Taxa de resposta | decisões ÷ (decisões + alertas sem decisão) |
| Cobertura de previsão | entregas na janela com previsão ÷ entregas na janela |
| Clima nas passagens | Contagem, por perigo e nível, das entregas na janela |
| Impacto tratado | Soma do `cost_cents` copiado em cada decisão |

## 8. Catálogo rodoviário

Gerado por `scripts/build-road-catalog.mjs` (`npm run catalog -- --refresh`). Os downloads ficam em `.cache/road-data/`, fora do controle de versão.

**Fontes**

- DNIT, SNV — GeoServer `https://servicos.dnit.gov.br/dnitgeo/geoserver/wfs`, camada `vgeo:vw_snv_rod`, edição mais recente (`Versao_SNV`).
- IBGE — centroides de municípios (API de malhas), nomes (API de localidades), população do Censo 2022 (SIDRA, tabela 4709) e malha das UFs.

**Processamento**

1. Mantém trechos com superfície `PAV`, `DUP` e `IMP`. Trechos `PLA` (planejados) coincidentes com rodovia estadual pavimentada entram com a superfície estadual. `LEN` e `TRV` ficam de fora.
2. Liga as extremidades dos trechos numa grade de ~500 m para formar o grafo.
3. Onde um trecho termina sem continuação, cria uma conexão de até 12 km até o nó mais próximo (código `CX…`), com distância × 1,3 e custo × 1,5. Representa vias estaduais ou urbanas fora do SNV.
4. Mantém o maior componente conectado.
5. Seleciona municípios com 100 mil habitantes ou mais e os ancora nos nós dos trechos cuja descrição cita o município na mesma UF; na falta, no nó mais próximo do centroide (até 30 km).
6. Simplifica as geometrias (~200 m para o traçado; ~1,3 km para o mapa base).

**Roteamento** (`lib/roads.ts`): Dijkstra sobre o grafo, com custo = km × fator de superfície (pista dupla 0,92; pavimentada 1; leito implantado 1,8). A passagem por um trecho usa velocidade média de 60 km/h. Os planos são memorizados em processo (até 500 pares).

O banco guarda apenas os códigos IBGE e o código SNV; o traçado é recalculado a cada leitura. Uma nova edição do catálogo pode, portanto, alterar o traçado exibido de rotas já cadastradas, mas não as coordenadas do ponto monitorado, que ficam gravadas.

## 9. Previsão do tempo

- **Fonte:** `https://api.open-meteo.com/v1/forecast`, variáveis `precipitation`, `precipitation_probability`, `wind_gusts_10m`, `visibility`, `weather_code`, `temperature_2m`; 4 dias, horário em UTC, timeout de 8 s.
- **Agendamento:** `pg_cron` chama `POST /api/cron/forecast` a cada hora e atualiza todas as rotas.
- **Sob demanda:** `GET /api/operations` atualiza até 12 rotas com passagem nas próximas 72 h cuja previsão esteja ausente ou tenha mais de 1 hora. Requer `SUPABASE_SERVICE_ROLE_KEY`. Falhas de rede mantêm a previsão anterior.
- **Demonstração:** cenários fixos para as três rotas iniciais (chuva forte na BR-116, chuva com trovoada e rajadas na BR-101, neblina na BR-381) e clima pseudoaleatório estável por rota nas demais.
- **Licença:** o plano gratuito do Open-Meteo é para uso não comercial. Para uso comercial, contrate a API e ajuste a URL em `lib/weather.ts`.

## 10. Segurança

- RLS em todas as tabelas; o papel `anon` não tem acesso. Usuários só leem e inserem os próprios registros.
- `SUPABASE_SERVICE_ROLE_KEY` e `LOGSTER_CRON_SECRET` são usados apenas no servidor e nunca chegam ao navegador.
- Login por formulário aceita somente origens permitidas (`Origin`), contra login CSRF.
- Cookies de sessão `httpOnly`, `SameSite=Lax`.
- Rotas são derivadas do catálogo no servidor: o cliente não consegue gravar coordenadas ou traçados arbitrários.
- Entradas validadas no servidor (`lib/inputs.ts`), com limites de tamanho e corpo JSON de até 10 KB.

## 11. Limitações conhecidas

- O catálogo cobre apenas a malha federal. Ligações que dependem de rodovias estaduais podem resultar em percursos mais longos que os reais.
- Manaus, Boa Vista e Macapá não estão no catálogo (sem ligação pavimentada com o componente principal da malha).
- A previsão considera um único ponto por rota (o ponto monitorado).
- Atraso, custo e limites de risco são regras ilustrativas, não calibradas com dados históricos.
- Registros não podem ser editados nem excluídos pela interface.
- Não há cadastro, recuperação de senha nem perfis de acesso; contas são criadas no painel do Supabase.
