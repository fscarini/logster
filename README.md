# Logster

Landing page em Next.js 14, TypeScript, Tailwind CSS e Lucide React. Os cenários da prévia são simulados e carregam localmente.

## Desenvolvimento

Execute `npm ci` e `npm run dev`. A página fica em http://localhost:3000. `npm run build` gera a exportação estática em `out/`.

## Configuração opcional

Em `.env.local`, defina `NEXT_PUBLIC_LOGSTER_APP_URL` com o endereço do SaaS (por exemplo `http://localhost:3001`). O botão Entrar passa a abrir o formulário de login: as credenciais vão direto para o SaaS em `/api/session/form`, que cria a sessão na própria origem e abre o painel. Em caso de erro, o SaaS devolve o usuário para cá com o diálogo aberto e a mensagem correspondente. Sem a variável, o botão abre um aviso. No SaaS, defina `NEXT_PUBLIC_LOGSTER_LANDING_URL` com o endereço desta página: ele só aceita o formulário vindo dessa origem e envia para cá quem não tem sessão. Defina `NEXT_PUBLIC_LOGSTER_CONTACT_EMAIL` para exibir o link de contato. Gere novamente a exportação para aplicar edições nesses valores.

## Referências visuais

As animações de entrada, elevação, brilho e pulso foram adaptadas da [coleção de animações CSS do Não Codei](https://naocodei.com/free-code-css/). O fundo cartográfico do painel usa contornos estaduais do [Click That 'Hood](https://github.com/codeforamerica/click_that_hood/blob/master/public/data/brazil-states.geojson), com trajetos ilustrativos. As licenças das fontes estão em `public/licenses/`.

## Protótipo SaaS

O painel de operações e a API ficam em [`saas/`](saas/README.md) e têm um modo de demonstração local. A documentação está em [README funcional](saas/docs/README-funcional.md) e [README técnico](saas/docs/README-tecnico.md).
