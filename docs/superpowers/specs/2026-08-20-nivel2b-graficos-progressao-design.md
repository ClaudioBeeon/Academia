# Nível 2b (fatia 1) — Gráficos de Progressão — Design

Data: 2026-08-20
Status: aprovado pelo usuário em chat

## 1. Contexto e objetivo

O Nível 2b do plano original agrupa quatro capacidades independentes: gráficos de
progressão, medidas corporais, calendário e estatísticas de sessão (ver
`docs/superpowers/plans/2026-08-20-nivel2a-anilhas-aquecimento-recordes.md`, linha
5, que já apontava essas quatro como "fora de escopo" do Nível 2a). São
subsistemas sem dependência forte entre si; este documento cobre apenas a
primeira fatia — **gráficos de progressão** — escolhida pelo usuário para ser
especificada e implementada primeiro. As outras três fatias (medidas corporais,
calendário, estatísticas de sessão) terão seus próprios ciclos spec → plano →
implementação depois.

A aba **Evolução** já existe no rodapé de navegação do app (`index.html`,
`#tab-bar`) e já está ligada em `js/app.js`, mas cai no branch genérico
`content.textContent = 'Tela "evolucao" ainda não implementada'`. Este é o
destino natural da funcionalidade.

## 2. Escopo

Dentro desta fatia:

- **Progressão de carga/1RM por exercício** — gráfico de linha mostrando a
  evolução do 1RM estimado ao longo do tempo, para um exercício escolhido pelo
  usuário.
- **Volume semanal por músculo** — gráfico de barras mostrando o volume de
  séries (métrica já usada no app: soma de `contribuicao`) por grupo muscular,
  nas últimas semanas.

Fora de escopo (fatias futuras do Nível 2b, não deste documento):

- Medidas corporais (peso, cintura, bioimpedância) e seus próprios gráficos.
- Calendário de sessões.
- Estatísticas de sessão (resumo pós-treino).
- Qualquer interatividade avançada de gráfico (zoom, pan, tooltip on hover) —
  fica para uma iteração futura se o usuário sentir falta depois de usar a v1.

## 3. Arquitetura

Mesma disciplina de todo o app: módulos de motor (`js/engine/`) puros e
testáveis com `node --test`, sem DOM/IndexedDB/fetch; módulos de tela
(`js/screens/`) que buscam dados, chamam o motor, e desenham.

```
historicoSeries (IndexedDB)
        │
        ▼
js/engine/graficos.js  (puro — agrega, não desenha)
        │
        ▼
js/screens/evolucao.js  (busca dados, chama o motor, desenha SVG)
        │
        ▼
js/app.js  (novo case "evolucao" em renderTab, substitui o placeholder)
```

Nenhuma mudança de schema do IndexedDB é necessária — a tela só lê
`historicoSeries` e `exercicios`, ambas já existentes e já populadas pelo app
hoje.

## 4. `js/engine/graficos.js` (motor puro)

Duas funções exportadas, cada uma com sua própria seção de testes.

### `calcularProgressao1RM(seriesDoExercicio)`

- Entrada: array de séries de UM exercício (mesmo formato de
  `getHistoricoCompletoDoExercicio`), em qualquer ordem.
- Ignora séries com `tipoSerie === "aquecimento"` (mesmo critério já usado em
  `calcularVolumeSemanal`).
- Agrupa por `data`; para cada dia, calcula o 1RM estimado de cada série com a
  mesma fórmula de Epley já usada em `js/engine/recordes.js`
  (`carga * (1 + reps / 30)`) e guarda o maior valor do dia.
- Retorna um array ordenado por data ascendente:
  `[{ data: "2026-08-01", carga1RM: 82.5 }, ...]`.
- Array vazio se `seriesDoExercicio` estiver vazio ou só tiver séries de
  aquecimento.
- A fórmula de 1RM é duplicada localmente (função interna não exportada, como
  já é o padrão em `recordes.js`) em vez de importada de lá — `recordes.js` não
  a exporta hoje, e criar um módulo de utilitário compartilhado só por causa de
  uma função de uma linha vai contra o YAGNI já aplicado no resto do projeto.

### `calcularVolumeSemanalPorMusculo(todasAsSeries, semanas = 8)`

- Entrada: array de séries de QUALQUER exercício (todo o `historicoSeries`).
- Ignora séries com `tipoSerie === "aquecimento"`.
- Agrupa cada série em uma semana ISO (`YYYY-'W'WW`, segunda-feira como início
  da semana — mesma convenção ISO 8601 usada por bibliotecas de calendário
  padrão) a partir do campo `data` (`YYYY-MM-DD`).
- Para cada semana, soma `contribuicao` por `musculo` (mesma lógica de
  `calcularVolumeSemanal`, aplicada por semana em vez de para o array inteiro).
- Considera apenas as últimas `semanas` semanas com dados (contadas a partir da
  semana mais recente presente nos dados, não a partir de "hoje" — evita que o
  gráfico fique vazio numa semana sem treino registrado ainda).
- Retorna um objeto `{ [musculo]: [{ semana: "2026-W33", volume: 12.5 }, ...] }`,
  cada array ordenado por semana ascendente. Músculos sem nenhuma série no
  período não aparecem nas chaves do objeto.
- Objeto vazio (`{}`) se não houver séries.

## 5. `js/screens/evolucao.js` (tela)

- `montarTelaEvolucao(db, todosExercicios)` — mesma assinatura em espírito de
  `montarTelaTreino`/`montarTelaHistorico` (recebe `db` já aberto e a lista de
  exercícios, que `app.js` já carrega hoje via `getAll(db, "exercicios")` para
  outras telas).
- **Seletor de exercício:** um `<select>` nativo, populado só com exercícios
  que têm pelo menos uma série registrada (evita listar 40 exercícios vazios).
  Se não houver nenhum histórico no app inteiro, a seção de progressão mostra
  `"Sem treinos registrados ainda."` e o `<select>` nem aparece.
- **Gráfico de linha (1RM):** SVG inline gerado em JS. `viewBox` fixo, eixo Y
  escalado ao mínimo/máximo dos dados (com uma margem de 10%), pontos plotados
  como `<circle>`, conectados por `<polyline>` na cor `var(--accent)`. Rótulos
  de data no eixo X (formato curto `DD/MM`, no máximo ~6 rótulos mesmo com mais
  pontos, pra não poluir em telas de celular).
- **Gráficos de volume semanal:** um card por músculo (mesmo padrão visual de
  `.exercise-card` usado em Treino/Histórico), cada um com um mini gráfico de
  barras SVG (`<rect>` por semana, altura proporcional ao volume, cor
  `var(--accent)`). Card omitido para músculos sem dados no período.
- Nenhuma biblioteca externa — SVG é construído com `document.createElementNS`
  ou `innerHTML` com strings interpoladas (seguindo o padrão de
  `js/screens/treino.js`; como os valores interpolados aqui são todos
  numéricos/calculados, não texto vindo do usuário ou do IndexedDB sem
  validação, a regra de hardening do Nível 1b — `.textContent` para strings de
  origem externa — não se aplica aos números de coordenada SVG, mas ainda se
  aplica ao nome do exercício exibido no rótulo do seletor).

## 6. `js/app.js`

- Import `montarTelaEvolucao` de `./screens/evolucao.js`.
- Novo branch em `renderTab`:
  ```js
  if (tabName === "evolucao") {
    content.textContent = "";
    const exercicios = await getAll(db, "exercicios"); // ou lista já carregada, ver nota abaixo
    content.appendChild(await montarTelaEvolucao(db, exercicios));
    return;
  }
  ```
  Nota de implementação: checar durante o plano se `app.js` já mantém uma lista
  de exercícios em memória (ela é buscada em `montarTelaTreino` para os
  botões de substituição) e reaproveitar em vez de buscar de novo — decisão de
  detalhe, não de arquitetura.

## 7. Tratamento de erros e casos vazios

- Sem nenhum histórico no app: mensagem única `"Sem treinos registrados
  ainda."`, sem seletor nem gráficos — mesmo padrão de vazio já usado em
  `montarTelaHistorico`.
- Exercício selecionado sem 1RM calculável (nunca deveria acontecer se ele está
  na lista do `<select>`, mas por segurança): tratar como lista vazia, mostrar
  `"Sem dados suficientes para este exercício."` no lugar do SVG.
- Erros de leitura do IndexedDB seguem o padrão já existente em `app.js`
  (try/catch em `renderTab`, mensagem genérica de erro) — nenhum tratamento
  extra necessário nesta tela.

## 8. Testes

- `js/engine/graficos.test.js`, cobrindo pelo menos:
  - `calcularProgressao1RM`: agrupamento por dia (duas séries no mesmo dia →
    mantém a maior), exclusão de séries de aquecimento, array vazio, ordenação
    ascendente por data, valor de 1RM consistente com a fórmula de
    `recordes.js`.
  - `calcularVolumeSemanalPorMusculo`: bucketing ISO-semana correto incluindo
    virada de ano (ex.: 30/dez e 02/jan em semanas diferentes), soma de
    `contribuicao` por músculo, exclusão de aquecimento, limite de `semanas`
    respeitado, músculo sem dados não aparece nas chaves.
- Sem testes de tela (`evolucao.js`) além dos que a suíte de testes já não
  cobre em nenhuma outra tela existente — verificação de UI é manual via
  browser, mesmo padrão de todo o resto do projeto.

## 9. Guarda-corpos (herdados dos planos anteriores)

- Sem build step — todo JS roda direto via `<script type="module">`.
- `js/engine/graficos.js` fica puro — nada de DOM, IndexedDB ou `fetch`.
- Nomes de exercício e qualquer string de origem externa interpolada em
  `innerHTML` passam por `.textContent`, nunca concatenação direta.
- Nenhuma dependência nova (sem CDN, sem npm de runtime) — o app precisa
  continuar funcionando 100% offline via `sw.js`.

## 10. Itens em aberto (não bloqueiam o início)

- Paleta do app é monocromática (só `--accent` como cor forte); se no futuro
  fizer sentido comparar vários músculos num único gráfico sobreposto (em vez
  de um card por músculo), vai ser necessário decidir uma paleta categórica —
  decisão adiada, os cards separados evitam o problema por agora.
- Se o histórico crescer muito (anos de dados), o gráfico de 1RM pode precisar
  de um filtro de período (ex.: "últimos 3 meses") — não implementado nesta
  fatia, considerar se o usuário sentir necessidade depois de usar.
