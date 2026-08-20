# Nível 2b (fatia 3) — Estatísticas de Sessão — Design

Data: 2026-08-20
Status: aprovado pelo usuário em chat ("pode seguir com todos já")

## 1. Contexto e objetivo

Terceira fatia independente do Nível 2b (ver spec da fatia 1 para o
contexto das quatro fatias). Esta cobre um resumo da sessão de treino do
dia — quantas séries, quanto volume, quantos exercícios e quais músculos
foram trabalhados hoje — mostrado ao vivo na própria tela de Treino,
atualizado a cada série registrada.

## 2. Escopo

Dentro desta fatia:

- Um card de resumo no final da tela de Treino: total de séries
  registradas hoje (excluindo aquecimento), volume total (soma de
  `carga × reps` das séries não-aquecimento), número de exercícios
  distintos treinados, lista de músculos distintos treinados.
- Atualização ao vivo: o resumo recalcula e redesenha depois de cada
  série registrada na mesma tela, sem precisar recarregar a página.

Fora de escopo:

- **Duração da sessão.** `historicoSeries` guarda só a data (`"YYYY-MM-DD"`),
  não um horário — não há como calcular duração sem adicionar timestamp
  por série, e isso não foi pedido explicitamente. Registrar isso como
  item em aberto (seção 7) em vez de inventar um mecanismo de
  início/fim de sessão sem necessidade clara.
- **Comparação com a sessão anterior** (mesmo dia da divisão, semana
  passada). A tela de Treino já mostra "Última vez: X kg × Y" por
  exercício individualmente (`js/screens/treino.js:124-131`) — um resumo
  agregado comparativo é uma escada a mais que não foi pedida; YAGNI por
  agora.
- Estatísticas históricas/agregadas por semana ou mês — isso é o que a
  fatia 1 (Evolução → volume semanal por músculo) já cobre por outro
  ângulo; esta fatia é sobre a sessão de HOJE, especificamente.

## 3. Arquitetura

```
historicoSeries (IndexedDB, filtrado pela data de hoje)
        │
        ▼
js/engine/sessao.js  (puro — agrega)
  - calcularEstatisticasSessao(seriesDoDia) → {totalSeries, volumeTotal, exerciciosTreinados, musculosTreinados}
        │
        ▼
js/screens/treino.js  (novo card no rodapé + callback de atualização)
```

Nenhuma mudança de schema do IndexedDB — a nova store não é necessária,
só uma leitura adicional pelo índice `"data"` já existente em
`historicoSeries`.

### `js/data/historico.js` (uma função nova)

- `getSeriesDoDia(db, data)` — `getAllByIndex(db, "historicoSeries",
  "data", data)`, mesmo padrão de uma linha das outras funções deste
  arquivo (reaproveita o índice `"data"` já criado em
  `js/data/db.js` desde a v2).

### `js/engine/sessao.js` (motor puro, um export)

- `calcularEstatisticasSessao(seriesDoDia)` — recebe o array bruto de
  séries do dia (qualquer exercício), filtra `tipoSerie !==
  "aquecimento"` (mesmo critério de `volume.js`/`graficos.js`), retorna:
  ```js
  {
    totalSeries: number,               // contagem de séries não-aquecimento
    volumeTotal: number,               // soma de carga * reps
    exerciciosTreinados: number,       // Set de exercicioId distintos, .size
    musculosTreinados: string[],       // Set de musculo distintos, ordenado
  }
  ```
  Array vazio → `{totalSeries: 0, volumeTotal: 0, exerciciosTreinados: 0,
  musculosTreinados: []}` (nunca lança erro, nunca retorna `NaN` —
  mesma disciplina defensiva de `calcularVolumeSemanal`).

### `js/screens/treino.js` (card novo + callback de atualização)

- No fim de `montarTelaTreino`, depois do loop de cards de exercício,
  acrescentar um card "Resumo da sessão" (mesmo padrão visual
  `.exercise-card`/`.prev-hint` já usado em toda a tela).
- `montarTelaTreino` busca `getSeriesDoDia(db, hoje)`, calcula as
  estatísticas, desenha o card inicial.
- Uma função `atualizarResumo()` (fecha sobre `db`, `hoje`, e o elemento
  do card) refaz a busca + recálculo + redesenho. É passada como um novo
  callback `aoRegistrarSerie` para `montarCardExercicio` — cada card de
  exercício já tem um listener de `submit` em `setsContainer`
  (`js/screens/treino.js:134-178`); no fim desse listener (depois de
  `registrarSerie` e do toast de PR), chama `aoRegistrarSerie()` para
  que o resumo se atualize sem precisar recarregar a tela inteira.
- Texto do card: `"X séries · Y kg de volume total"` mais uma linha
  `"Músculos: peito, tríceps"` (nomes de músculo já aparecem crus em
  outros lugares do app, ex. `biblioteca.js` — consistente, não é
  regressão desta fatia introduzir isso).

## 4. Tratamento de erros e casos vazios

- Nenhuma série registrada hoje ainda: card mostra `"0 séries · 0 kg de
  volume total"` e nenhuma linha de músculos (ou uma linha
  `"Nenhum músculo treinado ainda hoje."`) — nunca omite o card inteiro,
  ao contrário das seções de Evolução; aqui faz sentido sempre mostrar o
  placeholder porque a tela é sobre o treino de HOJE especificamente, não
  histórico acumulado.

## 5. Testes

- `js/engine/sessao.test.js`: array vazio retorna os quatro campos
  zerados; exclui séries de aquecimento de todas as quatro métricas;
  conta exercícios/músculos distintos corretamente (duas séries do mesmo
  exercício contam como 1 exercício); soma volume corretamente
  (`carga × reps`, não soma de `contribuicao`, diferente de
  `volume.js` — este é volume "de sessão" bruto, não volume ponderado por
  contribuição direta/indireta); lista de músculos vem ordenada
  (determinístico para exibição).
- Sem teste de tela para `treino.js` (nenhuma tela deste projeto tem
  teste dedicado, verificação é manual no navegador).

## 6. Guarda-corpos (herdados)

- Sem build step, sem dependência nova.
- `js/engine/sessao.js` puro — sem DOM/IndexedDB/fetch.
- Nenhuma mudança de schema do IndexedDB.

## 7. Itens em aberto

- Duração da sessão: precisaria de timestamp por série (campo novo em
  `historicoSeries`, hoje só tem `data` no nível de dia) — fora de
  escopo, decidir se vale a pena numa fatia futura.
- Comparação com sessão(ões) anteriores: fora de escopo (seção 2).
