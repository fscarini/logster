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

## Conectar o Supabase

1. Aplique `supabase/migrations/202611240001_mvp.sql` no projeto Supabase. A migração cria as tabelas, popula as rotas iniciais e restringe o acesso com políticas de segurança por linha.
2. Crie uma conta de teste em **Authentication → Users** no projeto Supabase.
3. Copie `.env.example` para `.env.local` dentro de `saas/`. Mantenha `LOGSTER_DEMO_MODE=0` e preencha a URL do Supabase e a chave publicável. Use a conta de teste na tela **Entrar**.
4. Para atualizar previsões, configure no servidor `SUPABASE_SERVICE_ROLE_KEY` e `LOGSTER_CRON_SECRET`. Use um segredo aleatório exclusivo. O endpoint `POST /api/cron/forecast` exige esse segredo como bearer token. A chave de serviço fica no servidor.
5. Após hospedar o app, ative `pg_cron` e `pg_net` no Supabase. No Vault, crie `logster_app_url` com a URL do app e `logster_cron_secret` com o mesmo segredo do servidor. Execute `supabase/schedule.sql` para a atualização a cada hora. Execute o primeiro job antes de testar as previsões no painel.

Em produção, o modo padrão exige Supabase. Execute `npm run build` e `npm start` no diretório `saas/` em uma hospedagem compatível com Next.js e Node.js. Cada conta tem sua própria operação. As três rotas iniciais ficam disponíveis para todos os usuários autenticados.

## Regras deste MVP

O painel avalia a chuva na hora prevista de passagem pelo ponto de referência, em uma janela de 72 horas. A análise exige uma previsão consultada nas últimas três horas. Novas rotas precisam da primeira atualização do agendamento para aparecer com uma previsão.

Como regra ilustrativa do MVP, 5 a menos de 15 mm/h correspondem a risco moderado com 45 minutos de atraso, e 15 mm/h ou mais a risco alto com duas horas de atraso. O custo estimado é o tempo de espera multiplicado pelo valor por hora cadastrado. A recomendação compara a chuva prevista com duas horas antes e duas horas depois, quando aplicável. A decisão registrada guarda uma cópia da avaliação exibida no momento do registro.
