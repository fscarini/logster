# Logster — README funcional

Este documento descreve o que o Logster faz, para quem é, como cada tela se comporta e quais regras orientam os alertas e as recomendações. Detalhes de implementação e de integração estão no [README técnico](README-tecnico.md).

## Sumário

1. [O que é o Logster](#1-o-que-é-o-logster)
2. [Conceitos](#2-conceitos)
3. [Acesso](#3-acesso)
4. [Telas](#4-telas)
5. [Fluxos de uso](#5-fluxos-de-uso)
6. [Regras de negócio](#6-regras-de-negócio)
7. [Indicadores](#7-indicadores)
8. [Modo demonstração](#8-modo-demonstração)
9. [Limites desta versão](#9-limites-desta-versão)
10. [Perguntas frequentes](#10-perguntas-frequentes)

---

## 1. O que é o Logster

O Logster ajuda quem planeja entregas rodoviárias a antecipar problemas causados pelo clima. Para cada entrega, o sistema estima quando o caminhão vai passar por um trecho crítico da rota, consulta a previsão do tempo para aquele ponto e aquela hora e responde três perguntas:

- **Qual é o risco?** Baixo, moderado ou alto, conforme chuva, vento, visibilidade e tempestades previstas.
- **Quanto pode custar?** Uma estimativa de atraso e do custo de espera.
- **O que fazer?** Antecipar a saída, adiá-la ou avaliar um desvio, com a janela de horário que reduz o risco e a economia esperada.

A equipe registra a decisão tomada, e o painel gerencial acompanha os riscos, os custos e a resposta da operação.

**Para quem:** planejadores e coordenadores de transporte, gestores de operação logística e transportadoras que trabalham com rotas federais no Brasil.

## 2. Conceitos

| Termo | Significado |
|---|---|
| **Rota** | Percurso entre duas cidades pela malha rodoviária federal, com um ponto monitorado. |
| **Ponto monitorado** | Trecho oficial da rodovia (cadastro do DNIT) onde o clima é avaliado. Normalmente o trecho mais sensível do percurso, como uma serra. |
| **Entrega** | Uma viagem planejada numa rota, com horário de saída e custo de espera por hora. |
| **Passagem** | Momento estimado em que a entrega cruza o ponto monitorado: horário de saída + tempo até o trecho. |
| **Janela de análise** | As próximas 72 horas. Só passagens dentro dela são avaliadas. |
| **Alerta** | Entrega com risco moderado ou alto que ainda não recebeu decisão. |
| **Alternativa** | Outro horário de saída, 2 ou 4 horas antes ou depois, que reduz o risco na passagem. |
| **Decisão** | A ação escolhida pela equipe para um alerta: antecipar, adiar ou avaliar desvio. |

## 3. Acesso

### Entrar

1. No site do Logster, clique em **Entrar** no topo da página.
2. Informe e-mail e senha da conta da operação e clique em **Entrar**.
3. O painel de operações abre na tela **Visão geral**.

Mensagens possíveis no login:

| Situação | Mensagem |
|---|---|
| E-mail ou senha incorretos | "E-mail ou senha incorretos. Confira e tente novamente." |
| Campo vazio | "Preencha e-mail e senha para entrar." |
| Serviço indisponível | "Não foi possível acessar a conta agora. Tente novamente em instantes." |
| Sessão expirada | "Sua sessão expirou. Entre novamente para continuar." |
| Acesso ao painel sem estar conectado | "Entre com sua conta para acessar o painel de operações." |

Quem tenta abrir o painel sem estar conectado é levado ao login do site. O botão **Sair** encerra a sessão e volta ao site.

### Contas

Nesta versão não há cadastro aberto nem recuperação de senha. As contas são criadas pela administração. Cada conta tem a própria operação: rotas, entregas e decisões de uma conta não aparecem para outra. As três rotas iniciais (São Paulo–Curitiba, Curitiba–Joinville e Belo Horizonte–São Paulo) estão disponíveis para todas as contas.

## 4. Telas

O painel tem quatro abas: **Visão geral**, **Entregas**, **Alertas** e **Rotas**. O botão **Nova entrega** fica sempre visível, e o botão de atualizar, no topo, recarrega os dados e a previsão.

### 4.1 Visão geral (painel gerencial)

Tela inicial, com a situação da operação nas próximas 72 horas.

- **Indicadores principais:** entregas na janela, alertas sem decisão (com destaque quando há risco alto), custo em risco, custo evitável, taxa de resposta e cobertura de previsão. As definições estão na [seção 7](#7-indicadores).
- **Distribuição de risco:** proporção de passagens por nível (alto, moderado, baixo, sem previsão).
- **Passagens pelo trecho monitorado:** quantas passagens acontecem em cada bloco de 6 horas, coloridas por risco. Ao passar o mouse, aparece o detalhe do bloco.
- **Prioridades da operação:** os cinco alertas de maior custo, com o motivo climático. O botão **Analisar** abre a entrega na aba Alertas.
- **Clima nas passagens:** quantas passagens são afetadas por chuva, tempestade, rajadas de vento e baixa visibilidade, separando risco alto e moderado, e a maior probabilidade de chuva prevista.
- **Exposição por rota:** custo em risco, alertas e entregas de cada rota.
- **Decisões registradas:** quantas vezes cada ação foi escolhida e o impacto tratado.

Sem entregas cadastradas, a tela convida a cadastrar a primeira.

### 4.2 Entregas

- **Mapa do Brasil** com as rotas das entregas desenhadas sobre a malha federal. O ponto monitorado de cada rota aparece colorido pelo risco mais grave entre suas entregas.
  - Arraste para mover; use a roda do mouse, o gesto de pinça ou os botões **+** e **−** para aproximar.
  - O botão de enquadrar centraliza a rota selecionada; o de expandir mostra o Brasil inteiro.
  - Pelo teclado: setas movem o mapa, **+** e **−** aproximam, **Tab** percorre as rotas e **Enter** seleciona.
  - Ao passar o mouse sobre uma rota, aparecem distância, rodovias, ponto monitorado, número de entregas e o principal perigo climático.
  - Clicar numa rota seleciona a primeira entrega dela na lista.
- **Lista de entregas**, em ordem de saída, com referência, nível de risco, rota, motivo climático (quando houver), horário de saída e custo estimado.
- **Detalhe da entrega selecionada**, descrito em 4.4.

### 4.3 Alertas

Mesma estrutura da aba Entregas, mostrando apenas os alertas: entregas com risco moderado ou alto ainda sem decisão. O número ao lado do nome da aba indica quantos alertas estão em aberto.

### 4.4 Detalhe da entrega

- **Cabeçalho:** referência, rodovias, distância, cidades e nível de risco.
- **Ponto monitorado** e horário estimado da passagem.
- **Condições na passagem:** selos com cada perigo detectado, por exemplo "Chuva forte · 18 mm/h", "Trovoadas" ou "Visibilidade reduzida · 450 m".
- **Números da passagem:** chuva na hora, probabilidade de chuva, rajadas, visibilidade, atraso estimado e custo estimado.
- **Gráfico de previsão:** chuva hora a hora no ponto monitorado nas próximas 72 horas. Cada barra tem a cor do risco daquela hora; linhas tracejadas marcam 5 e 15 mm/h; marcas indicam a **passagem** e a **alternativa** sugerida. Ao passar o mouse, aparecem chuva, probabilidade, rajadas, visibilidade e perigos da hora.
- **Origem da previsão:** horário da consulta e se os dados são simulados.
- **Ação sugerida** (quando há alerta) e o formulário para **registrar a decisão**. Depois do registro, a tela mostra a ação escolhida, a data e a observação.

Mensagens quando não há avaliação:

- "A passagem está fora da janela de análise das próximas 72 horas."
- "Não há uma previsão horária recente para este trecho."

### 4.5 Rotas

- **Mapa das rotas** com todas as rotas da conta. Clicar numa rota, no mapa ou na lista, destaca o traçado e mostra origem e destino.
- **Lista de rotas** com cidades, código das rodovias, distância, rodovias percorridas, ponto monitorado e tempo até ele.
- Botão **Nova rota**.

## 5. Fluxos de uso

### 5.1 Cadastrar uma rota

1. Na aba **Rotas**, clique em **Nova rota**.
2. Escolha a **origem** e o **destino**. A lista traz as cidades com 100 mil habitantes ou mais ligadas à malha federal, agrupadas por estado. O botão entre os campos inverte origem e destino.
3. O sistema traça o percurso e mostra a distância, o tempo estimado a 60 km/h, as rodovias percorridas e uma prévia no mapa.
4. Escolha o **trecho monitorado**. A lista traz os trechos oficiais da rota, agrupados por rodovia e estado, com a quilometragem a partir da origem. O sistema sugere o trecho do meio do percurso; escolha o trecho mais sensível ao clima. Abaixo, aparece o tempo estimado até a passagem.
5. Clique em **Salvar rota**. A rota aparece selecionada no mapa e na lista.

Se não houver ligação pela malha federal entre as cidades, o sistema avisa: "Não há ligação pela malha rodoviária federal entre essas cidades."

### 5.2 Cadastrar uma entrega

1. Clique em **Nova entrega**.
2. Informe a **referência** (até 60 caracteres), a **rota**, a **saída prevista** e o **custo de espera por hora** em reais.
3. Clique em **Salvar entrega**. A entrega aparece selecionada na aba Entregas, já avaliada.

Regras: a saída precisa ser futura e estar dentro dos próximos 30 dias. O horário usa o fuso do dispositivo.

### 5.3 Analisar um alerta e decidir

1. Abra a aba **Alertas** ou clique em **Analisar** nas prioridades do painel.
2. Leia as condições previstas, o gráfico e a ação sugerida. Exemplo: "Adiar a saída em 4 h leva a passagem para 10:32, com 0,8 mm/h e risco baixo. Economia estimada: R$ 157,50."
3. Em **Decisão da operação**, mantenha a sugestão ou escolha outra ação. Adicione uma observação, se quiser.
4. Clique em **Registrar decisão**. O alerta sai da lista de alertas e passa a contar nos indicadores de decisão.

Cada entrega aceita uma única decisão. O registro guarda as condições previstas no momento da decisão, para consulta posterior.

> O Logster registra a decisão, mas não altera o horário da entrega. Se a equipe decidir adiar ou antecipar, ajuste o planejamento com a transportadora e, se necessário, cadastre a entrega com o novo horário.

## 6. Regras de negócio

As regras abaixo são ilustrativas desta versão e devem ser calibradas com a experiência da operação.

### 6.1 Quando uma entrega é avaliada

- A passagem precisa acontecer nas **próximas 72 horas**.
- A previsão do ponto monitorado precisa ter sido consultada nas **últimas 3 horas**. O sistema atualiza a previsão automaticamente a cada hora e também quando o painel é aberto e a previsão tem mais de 1 hora.

### 6.2 Níveis de risco

O sistema verifica quatro perigos na hora da passagem. O nível da entrega é o mais grave entre eles.

| Perigo | Risco moderado | Risco alto |
|---|---|---|
| Chuva | de 5 a menos de 15 mm por hora | 15 mm por hora ou mais |
| Rajadas de vento | de 50 a menos de 75 km/h | 75 km/h ou mais |
| Visibilidade (neblina) | menos de 1 km | menos de 200 m |
| Tempestade | trovoada | trovoada com granizo |

Sem nenhum desses perigos, o risco é **baixo**.

### 6.3 Atraso e custo

| Risco | Atraso estimado | Custo estimado |
|---|---|---|
| Baixo | sem atraso | R$ 0 |
| Moderado | 45 minutos | 0,75 × custo de espera por hora |
| Alto | 2 horas | 2 × custo de espera por hora |

### 6.4 Recomendações

O sistema compara a saída planejada com saídas **2 e 4 horas antes e depois**. Ficam de fora horários que já passaram e passagens que caem fora da janela de 72 horas. A melhor opção vira a alternativa quando reduz o nível de risco ou reduz bastante a intensidade do clima.

| Situação | Ação sugerida |
|---|---|
| A melhor alternativa é sair mais cedo | **Antecipar saída** |
| A melhor alternativa é sair mais tarde | **Adiar saída** |
| Nenhum horário próximo reduz o risco | **Avaliar desvio** |
| Risco baixo | Sem recomendação (não gera alerta) |

### 6.5 Rotas e ponto monitorado

- As rotas seguem a **malha rodoviária federal** cadastrada pelo DNIT, pelo menor percurso entre as cidades, com preferência por pistas duplicadas e penalidade para trechos sem pavimento.
- Onde a malha federal não tem continuação, como nos acessos urbanos de algumas capitais, o sistema faz uma ligação curta até a rodovia mais próxima. Essas ligações não podem ser escolhidas como ponto monitorado.
- O tempo até o ponto monitorado considera **60 km/h de média**, incluindo paradas.

## 7. Indicadores

| Indicador | O que mostra |
|---|---|
| **Entregas em 72 h** | Entregas com passagem dentro da janela de análise. |
| **Alertas sem decisão** | Entregas com risco moderado ou alto que ainda aguardam decisão. Destacado quando há risco alto. |
| **Custo em risco** | Soma do custo estimado dos alertas sem decisão, com o tempo total de espera. |
| **Custo evitável** | Quanto se economizaria adotando as janelas alternativas sugeridas nos alertas em aberto. |
| **Taxa de resposta** | Parcela dos alertas que já recebeu decisão. |
| **Cobertura de previsão** | Parcela das entregas da janela que tem previsão recente. Valores baixos indicam problema na atualização da previsão. |
| **Clima nas passagens** | Passagens afetadas por chuva, tempestade, rajadas e baixa visibilidade, por nível. |
| **Exposição por rota** | Onde se concentra o custo em risco. |
| **Impacto tratado** | Custo estimado, no momento da decisão, dos alertas que receberam decisão. |

## 8. Modo demonstração

Sem conta configurada, o Logster pode rodar em **modo demonstração**, identificado pelo selo "Dados simulados" no topo.

- Não pede login.
- Já vem com três entregas nas rotas iniciais, cada uma com um cenário: chuva forte na BR-116 (risco alto), chuva com trovoadas e rajadas na BR-101 (moderado) e neblina na BR-381 (moderado).
- A previsão é simulada e acompanha o relógio. Rotas novas recebem clima simulado próprio.
- Os cadastros ficam vinculados ao navegador usado por 7 dias; outro navegador começa uma demonstração nova.

## 9. Limites desta versão

- Só rodovias federais. Percursos que dependem de rodovias estaduais podem aparecer mais longos que os reais.
- Manaus, Boa Vista e Macapá não estão disponíveis, por não terem ligação rodoviária pavimentada com o restante da malha.
- O clima é avaliado em um único ponto por rota.
- Registros não podem ser editados nem excluídos pela tela.
- Não há cadastro aberto, recuperação de senha nem perfis de acesso.
- Os limites de risco, atrasos e custos são estimativas ilustrativas.

## 10. Perguntas frequentes

**Por que minha entrega aparece como "Sem previsão"?**
A previsão daquele ponto não foi consultada nas últimas 3 horas. Use o botão de atualizar no topo. Se continuar, a atualização automática da previsão pode estar desconfigurada.

**Por que minha entrega aparece como "Fora da janela"?**
A passagem pelo ponto monitorado está a mais de 72 horas, ou já passou. A avaliação começa quando a passagem entra na janela.

**Posso mudar a decisão registrada?**
Não nesta versão. Cada entrega aceita uma única decisão.

**De onde vêm os dados?**
Rodovias: Sistema Nacional de Viação, do DNIT. Cidades e mapas: IBGE. Previsão do tempo: Open-Meteo.

**A previsão cobre todo o percurso?**
Não. O clima é avaliado no ponto monitorado escolhido no cadastro da rota. Escolha o trecho mais crítico do percurso.
