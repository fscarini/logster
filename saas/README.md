# Logster SaaS

MVP de planejamento rodoviário, com Next.js 16, TypeScript e Supabase. A aplicação fica em `saas/` e a landing page estática fica na raiz do repositório.

## Rodar a demonstração

Com Node.js 22.13 ou superior, execute a partir da raiz:

```sh
npm --prefix saas ci
npm --prefix saas run dev
```

Abra http://localhost:3000. Sem credenciais, o servidor de desenvolvimento usa a demonstração. Ela inclui três rotas, três entregas e previsões simuladas. Cadastros e decisões ficam em um arquivo SQLite local, em `saas/.data/`, e são separados pela sessão do navegador. Use referências fictícias durante a demonstração.

Para avaliar o fluxo completo, selecione a BR-116, cadastre uma entrega com o horário sugerido pelo formulário e registre uma decisão no detalhe. A janela de previsão simulada acompanha o relógio da demonstração.

Na aba **Rotas**, cadastre uma rota escolhendo origem e destino no catálogo de cidades. O sistema traça o percurso pela malha federal, mostra a prévia no mapa e oferece os trechos do SNV como ponto monitorado.

## Conectar o Supabase

1. Aplique, em ordem, `supabase/migrations/202611240001_mvp.sql` e `supabase/migrations/202611250001_road_catalog.sql` no projeto Supabase. A migração cria as tabelas, popula as rotas iniciais e restringe o acesso com políticas de segurança por linha.
2. Crie uma conta de teste em **Authentication → Users** no projeto Supabase.
3. Copie `.env.example` para `.env.local` dentro de `saas/`. Mantenha `LOGSTER_DEMO_MODE=0` e preencha a URL do Supabase e a chave publicável. Use a conta de teste na tela **Entrar**.
4. Para atualizar previsões, configure no servidor `SUPABASE_SERVICE_ROLE_KEY` e `LOGSTER_CRON_SECRET`. Use um segredo aleatório exclusivo. O endpoint `POST /api/cron/forecast` exige esse segredo como bearer token. A chave de serviço fica no servidor.
5. Após hospedar o app, ative `pg_cron` e `pg_net` no Supabase. No Vault, crie `logster_app_url` com a URL do app e `logster_cron_secret` com o mesmo segredo do servidor. Execute `supabase/schedule.sql` para a atualização a cada hora. Execute o primeiro job antes de testar as previsões no painel.

Em produção, o modo padrão exige Supabase. Execute `npm run build` e `npm start` no diretório `saas/` em uma hospedagem compatível com Next.js e Node.js. Cada conta tem sua própria operação. As três rotas iniciais ficam disponíveis para todos os usuários autenticados.

## Deploy (Vercel)

São dois projetos na Vercel, no time *Fernando Carini's projects*:

| Projeto | Diretório raiz | Produção |
|---|---|---|
| `logster` (landing) | `.` | https://logster-pi.vercel.app |
| `logster-app` (SaaS) | `saas` | https://logster-app.vercel.app |

Cada diretório tem um `vercel.json` que fixa o framework Next.js. Variáveis de produção:

- `logster-app`: `LOGSTER_DEMO_MODE=0`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `LOGSTER_CRON_SECRET` e `NEXT_PUBLIC_LOGSTER_LANDING_URL=https://logster-pi.vercel.app`.
- `logster`: `NEXT_PUBLIC_LOGSTER_APP_URL=https://logster-app.vercel.app`.

As variáveis `NEXT_PUBLIC_` são gravadas no build: ao mudar um domínio, atualize a variável e faça um novo deploy do projeto que a usa. Os dois projetos estão conectados ao repositório no GitHub: cada push na `main` publica os dois em produção, e outros branches geram deploys de preview. O `logster-app` usa **Root Directory** `saas`. Deploy manual, se necessário: `vercel deploy --prod` na raiz (landing) ou em `saas/` (SaaS).

A previsão é atualizada de hora em hora pelo job `logster-forecast-hourly` (pg_cron) no Supabase, que chama `https://logster-app.vercel.app/api/cron/forecast` com o segredo guardado no Vault.

## Documentação

- [README funcional](docs/README-funcional.md): o que o produto faz, telas, fluxos, regras de negócio e indicadores.
- [README técnico](docs/README-tecnico.md): arquitetura, configuração, autenticação, referência das APIs e modelo de dados.

## Login pela landing page

A landing page (raiz do repositório) é a porta de entrada. Para rodar as duas localmente, em terminais separados:

```sh
npm run dev -- --port 3000            # landing, na raiz
npm --prefix saas run dev -- --port 3001   # SaaS
```

Na landing, `.env.local` com `NEXT_PUBLIC_LOGSTER_APP_URL=http://localhost:3001`. No SaaS, `NEXT_PUBLIC_LOGSTER_LANDING_URL=http://localhost:3000`. Ajuste as portas se alguma estiver ocupada.

O formulário da landing faz um POST de navegação para `/api/session/form`. O SaaS confere o cabeçalho `Origin` (só aceita a landing e a própria origem), autentica no Supabase, grava o cookie de sessão e redireciona para o painel. Em caso de erro, redireciona de volta para a landing com `?login=erro`, `invalido` ou `indisponivel`. Quem abre o SaaS sem sessão, ou tem a sessão expirada, é enviado ao login da landing; o botão Sair também volta para ela. Sem `NEXT_PUBLIC_LOGSTER_LANDING_URL`, o SaaS usa a própria tela de login.

## Previsão do tempo

A previsão vem do [Open-Meteo](https://open-meteo.com/) para o ponto monitorado de cada rota: chuva, probabilidade de chuva, rajadas de vento a 10 m, visibilidade, código do tipo de tempo e temperatura, hora a hora por quatro dias. O agendamento (`/api/cron/forecast`) atualiza todas as rotas a cada hora. Além disso, ao carregar o painel, o servidor atualiza sob demanda as rotas com passagem nas próximas 72 horas cuja previsão esteja ausente ou tenha mais de uma hora; a gravação usa a chave de serviço, que fica só no servidor. O plano gratuito do Open-Meteo é para uso não comercial; para uso comercial, contrate a API e ajuste a URL em `lib/weather.ts`.

## Regras deste MVP

O painel avalia a chuva na hora prevista de passagem pelo ponto de referência, em uma janela de 72 horas. A análise exige uma previsão consultada nas últimas três horas. Novas rotas precisam da primeira atualização do agendamento para aparecer com uma previsão.

Como regras ilustrativas do MVP, a hora de passagem é classificada por quatro perigos, e o nível final é o mais grave entre eles:

| Perigo | Moderado | Alto |
|---|---|---|
| Chuva | 5 a menos de 15 mm/h | 15 mm/h ou mais |
| Rajadas de vento | 50 a menos de 75 km/h | 75 km/h ou mais |
| Visibilidade | menos de 1 km | menos de 200 m |
| Tempestade | trovoada (código 95) | trovoada com granizo (96 e 99) |

Risco moderado corresponde a 45 minutos de atraso e risco alto a duas horas. O custo estimado é o tempo de espera multiplicado pelo valor por hora cadastrado. A recomendação compara saídas 2 e 4 horas antes e depois, sem partir no passado e dentro da janela: sugere antecipar ou adiar quando alguma reduz o nível de risco (ou reduz bastante a intensidade), e avaliar desvio quando nenhuma ajuda. O painel soma o custo evitável ao adotar essas janelas, conta as passagens afetadas por perigo e mostra, no detalhe da entrega, o gráfico horário da previsão no ponto monitorado. A decisão registrada guarda uma cópia da avaliação exibida no momento do registro.

## Catálogo rodoviário e mapa

As rotas são pré-estabelecidas a partir de dados públicos, processados por `scripts/build-road-catalog.mjs`:

- **DNIT, Sistema Nacional de Viação (SNV)**: camada `vgeo:vw_snv_rod` do GeoServer do DNIT, na edição mais recente (hoje 202610A). Cada trecho traz rodovia, UF, quilometragem, descrição de início e fim, superfície e geometria.
- **IBGE**: centroides e nomes dos municípios, população do Censo 2022 (tabela 4709) e malha das UFs.

O script monta um grafo com os trechos pavimentados, duplicados e em leito implantado. Trechos federais planejados que coincidem com uma rodovia estadual pavimentada entram com a superfície estadual. Onde a malha federal termina sem continuação, como a BR-116 na divisa entre São Paulo e Taboão da Serra, uma conexão de até 12 km liga o trecho ao nó mais próximo, com penalidade. Essas conexões representam vias estaduais ou urbanas fora do SNV e nunca viram ponto monitorado. O catálogo inclui os municípios com 100 mil habitantes ou mais ligados ao maior componente da malha. Manaus, Boa Vista e Macapá ficam de fora porque não têm ligação pavimentada com esse componente.

O servidor calcula o menor percurso (Dijkstra) entre as cidades escolhidas. Pista dupla tem custo um pouco menor e leito implantado, maior. A passagem pelo trecho monitorado considera 60 km/h de média, como regra ilustrativa do MVP. O banco guarda apenas os códigos IBGE de origem e destino e o código SNV do trecho; o traçado é recalculado pelo servidor.

O mapa é desenhado em SVG com os limites do IBGE e a malha do SNV, sem serviço de mapas externo nem chave de API. Arraste para mover, use a roda do mouse, o gesto de pinça ou os botões para aproximar, e as setas e `+`/`-` pelo teclado.

Para atualizar o catálogo com uma nova edição do SNV, execute a partir de `saas/`:

```sh
npm run catalog -- --refresh
```

O script gera `data/road-catalog.json` (uso no servidor) e `public/data/brasil-base.json` (mapa base). Os downloads ficam em `.cache/road-data/`, fora do controle de versão.
