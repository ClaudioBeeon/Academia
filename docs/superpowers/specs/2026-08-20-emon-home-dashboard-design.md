# Emon — Home Dashboard Completa ("Hoje")

## 1. Contexto e objetivo

O protótipo aprovado (`prototypes/redesign-v4.html`, direção "1 · Emon")
tem 3 telas: Início, Fila do dia, Execução. A fatia anterior
(`bed1335`) implementou só uma versão reduzida do topo da tela Início —
saudação + card de plano + grade de stats da SESSÃO. Não tem: o
carrossel com o segundo card (Cardio), nem a seção "Minha atividade"
(treinos no mês, séries na semana, tempo ativo, sequência de dias).

Esta fatia completa a tela Início (renomeada de "Treino" pra "Hoje" na
aba, já que ela deixa de ser só a lista de exercícios e vira um painel).
As telas "Fila do dia" e "Execução" (que exigem reestruturar a
navegação — empurrar telas em vez de abas) ficam para uma fatia
própria, decisão já registrada em `2026-08-20-redesign-direcao-escolhida.md`
e reafirmada aqui: misturar UI nova com mudança de modelo de navegação
no mesmo lote é o tipo de risco que vale isolar.

## 2. O que muda

### 2.1 Aba renomeada

`index.html`: `<button data-tab="treino">Treino</button>` vira
`<button data-tab="hoje">Hoje</button>`. `js/app.js`: a branch
`tabName === "treino"` vira `tabName === "hoje"`, chamando a mesma
`montarTelaTreino` (o nome da função/arquivo interno não muda — só o
nome da aba e a rota — evita renomear `js/screens/treino.js` inteiro
por causa de uma aba, o arquivo continua sendo "a tela de treino do
dia", coerente com seu conteúdo real).

### 2.2 Carrossel Plano + Cardio

Onde hoje existe só o card `.plano-hero`, ele passa a fazer parte de um
carrossel horizontal com **dois** cards do mesmo tamanho — Plano de
hoje (já existe, mantém texto/dados) e **Cardio** (novo):

- **Sem cardio essa semana ainda**: `<u>Cardio</u><h3>Nenhum registro<br>essa semana</h3>` +
  botão "Registrar" que rola até a seção de cardio (que já existe hoje
  na aba Divisão — este card não duplica o formulário, só atalha pra
  ele. Ruling: navegar pra Divisão via `onIrParaCardio` callback,
  passado de `app.js`, mesmo padrão de `onAbrirHistorico`).
- **Com cardio essa semana**: mostra a modalidade e duração do último
  registro (`<h3>${modalidade}<br>${duracaoMin} min</h3>`), botão
  "Ver mais" com o mesmo atalho.
- Nunca inventa uma recomendação de modalidade/intensidade — não existe
  motor pra isso (`avaliarCardio` só valida uma escolha já feita, não
  sugere uma). Mostrar um "Zona 2" ou "Leve" fixo seria inventar dado,
  proibido pelos guarda-corpos do projeto.

### 2.3 Minha atividade (novo)

Seção com cabeçalho "Minha atividade" e grade 2×2 de tiles, usando
dados reais via um motor novo `js/engine/atividade.js`:

- **Treinos este mês**: número de datas distintas com pelo menos uma
  série (`tipoSerie !== "aquecimento"`) em `historicoSeries` cujo mês/ano
  bate com o mês/ano de hoje.
- **Séries esta semana**: contagem de séries (mesma exclusão de
  aquecimento) na semana ISO atual (mesma convenção `AAAA-Www` já usada
  em `graficos.js`).
- **Tempo ativo esta semana**: estimativa, não medição — não existe
  timestamp de início/fim de sessão no schema. Ruling: reaproveitar a
  heurística já usada no card de plano
  (`MINUTOS_ESTIMADOS_POR_EXERCICIO = 7`, já em `treino.js`) aplicada ao
  número de exercícios distintos treinados na semana ISO atual. Rotulado
  como estimativa no motor (campo `estimado: true` no retorno), não
  escondido do usuário — é consistente com o disclaimer que os créditos
  do protocolo já usam para outras estimativas do app.
- **Dias seguidos**: maior sequência de dias corridos e consecutivos,
  contando pra trás a partir de hoje, em que houve pelo menos uma série
  registrada. Para no primeiro dia sem registro. Se hoje ainda não tem
  nenhuma série, a sequência considera a partir de ontem (não zera só
  porque ainda não treinou hoje).

## 3. Arquitetura

- `js/engine/atividade.js` (novo, motor puro): `calcularAtividadeMensal(todasAsSeries, hoje)`
  retorna `{ treinosEsteMes, seriesEstaSemana, minutosAtivosEstaSemana, diasSeguidos }`.
  Recebe `todasAsSeries` já carregado (a tela já busca isso hoje via
  `getAll(db, "historicoSeries")`, não precisa de nova consulta).
- `js/data/cardio.js` (existe, modificado se necessário): precisa de uma
  forma de pegar "o registro de cardio mais recente desta semana" — se
  `getCardioRecente` já cobre isso (verificar a assinatura atual antes
  de mudar), reutilizar; senão adicionar uma função pequena.
- `js/screens/treino.js` (modificado): o carrossel substitui o
  `.plano-hero` isolado; nova seção "Minha atividade" logo abaixo,
  antes do check-in.
- `js/app.js` + `index.html` (modificados): renomeação da aba `treino`
  → `hoje`.
- `css/styles.css` (modificado): classes pro carrossel horizontal
  (`.carrossel-plano`, cards com `scroll-snap`) e pra grade "Minha
  atividade" (reaproveita `.stats-grid`/`.stat-tile` já existentes do
  redesign anterior, ou estende se o layout 2×2 com ícone pedir algo a
  mais).

## 4. Casos de borda

- **App novo, zero séries registradas**: `treinosEsteMes = 0`,
  `seriesEstaSemana = 0`, `minutosAtivosEstaSemana = 0`,
  `diasSeguidos = 0`. Grid mostra zeros, não esconde a seção (consistente
  com outras seções do app que preferem mostrar "0" a esconder,
  vs. seções que escondem quando não há dado nenhum pra mostrar — aqui
  há sempre 4 números pra mostrar, mesmo que zerados).
- **Virada de mês/semana no meio do uso**: os cálculos usam `hoje`
  (data local) recomputado a cada render da tela — sem estado
  persistido, sem risco de ficar desatualizado.

## 5. Fora de escopo

- Fila do Dia, Execução, Relatório (fatia própria, futura).
- Renomear `js/screens/treino.js` para `hoje.js` ou similar — cosmético,
  não vale o custo de tocar em todos os imports por uma questão de nome
  de arquivo.
- Qualquer recomendação de modalidade/intensidade de cardio — não
  existe motor pra isso ainda.
