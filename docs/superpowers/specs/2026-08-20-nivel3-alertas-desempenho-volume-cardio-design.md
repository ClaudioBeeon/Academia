# Nível 3/4 — Alertas de Desempenho, Alertas de Volume/Programação, Registro de Cardio

## 1. Contexto

Fecha o que ficou de fora, explicitamente, do spec/plano de
`2026-08-20-nivel3-alertas-recuperacao`:

- As 2 condições de `gatilhosDeloadReativo` baseadas em `historicoSeries`
  ("desempenho caindo em 2+ sessões consecutivas com o mesmo peso", "RIR
  percebido subindo sem mudança de carga").
- As 4 condições de `protocolo.json.alertas` baseadas em volume/programação.
- Registro de cardio (`protocolo.json.regrasCardio`), fatia 4 do roadmap
  original, nunca especificada até agora.

Três engines novos, puros, cada um consumido pela tela Divisão (as duas
fatias de alerta) ou por uma tela nova/seção nova (cardio). Todos os
alertas continuam só informativos — nenhum aplica ação automática.

## 2. Fatia A — Alertas de desempenho (`js/engine/alertasDesempenho.js`)

**Dado necessário**: para cada exercício, as últimas sessões (grupos de
séries não-aquecimento por `exercicioId` + `data`), mais recente primeiro.

**Novo helper de dados** — `js/data/historico.js`:
`getUltimasSessoesPorExercicio(db, limitePorExercicio = 10)` — agrupa todas
as séries de `historicoSeries` (excluindo `tipoSerie === "aquecimento"`)
por `exercicioId`, depois por `data`; para cada exercício retorna até
`limitePorExercicio` sessões (`{ data, series }`), ordenadas da mais
recente pra mais antiga.

**Engine** — `avaliarAlertasDesempenho(sessoesPorExercicio)`:
para cada exercício com >= 2 sessões, compara a mais recente (`[0]`) com a
anterior (`[1]`):
- `cargaMedia` = média de `carga` das séries da sessão.
- `repsTotal` = soma de `reps`.
- `rirMedio` = média de `rir`.

Ruling (protocolo.json não dá threshold exato pra "mesmo peso" ou
"queda"): só compara quando `cargaMedia` das duas sessões é **igual**
(mesmo peso, condição literal do protocolo). Com peso igual:
- `repsTotal[0] < repsTotal[1]` → alerta `desempenho_caindo`.
- `rirMedio[0] > rirMedio[1]` → alerta `rir_subindo_sem_carga`.

Cada alerta carrega `{ tipo, exercicioId, mensagem, principio:
"gatilhosDeloadReativo" }`. Mensagem é um template fixo (sem interpolar
nome do exercício no engine — isso é responsabilidade da tela, que tem
acesso a `exercicios`).

## 3. Fatia B — Alertas de volume/programação (`js/engine/alertasVolume.js`)

As 4 condições de `protocolo.json.alertas.condicoes`, com os números
**literais já dados no próprio texto** (não são rulings inventados):

1. "volume abaixo do mínimo efetivo (< 4 séries diretas/semana) em algum
   músculo" → por músculo, conta séries com `tipoSerie !== "aquecimento"`
   nos últimos 7 dias; se `< 4` → alerta `volume_abaixo_minimo` `{
   musculo }`.
2. "volume acima de 22 séries/semana com desempenho em queda" → por
   músculo, mesma contagem de 7 dias; se `> 22` **e** o músculo aparece
   entre os músculos com `desempenho_caindo` ou `rir_subindo_sem_carga`
   detectados pela Fatia A → alerta `volume_excessivo_com_queda` `{
   musculo }`. (Cruza com a Fatia A: a tela passa o conjunto de músculos
   já sinalizados por `avaliarAlertasDesempenho`, mantendo os dois
   engines independentes e puros — nenhum importa o outro.)
3. "mais de 8 séries diretas do mesmo músculo em uma sessão" → por
   músculo, conta séries de hoje (`tipoSerie !== "aquecimento"`); se `>
   8` → alerta `series_excessivas_sessao` `{ musculo }`.
4. "ausência de progressão em um exercício por 4+ semanas" → ruling
   (protocolo não detalha a mecânica exata): usa as sessões de
   `getUltimasSessoesPorExercicio` (mesmo helper da Fatia A, chamado com
   limite maior, 10). Para cada exercício, pega a sessão mais antiga
   disponível na janela retornada; se essa sessão for de **28+ dias
   atrás** (`hoje - data >= 28 dias`, comparando `Date` — suficiente
   histórico pra avaliar) e a `cargaMedia` da sessão mais recente **não
   for maior** que a da mais antiga considerada, dispara
   `sem_progressao_exercicio` `{ exercicioId }`. Menos de 28 dias de
   histórico → sem alerta (dado insuficiente, não é erro).

Assinatura: `avaliarAlertasVolume({ seriesUltimos7Dias, seriesHoje,
sessoesPorExercicio, musculosComDesempenhoCaindo, hoje })`. `hoje` é
string ISO passada explicitamente pela tela (nunca `new Date()` sem
argumento dentro do engine — mantém a função pura/determinística).

## 4. Fatia C — Registro de cardio

**Schema**: novo object store `registrosCardio` (`{ keyPath: "id",
autoIncrement: true }`, índice `data`), em `js/data/db.js`. Bump
`DB_VERSION` de 3 para 4 — schema novo, adição pura de store, sem migrar
dado existente.

**Dado** — `js/data/cardio.js`:
- `registrarCardio(db, registro)` — grava `{ data, modalidade,
  duracaoMinutos, intensidadePercebida }`.
- `getCardioDoDia(db, data)` — via índice `data`.
- `getCardioRecente(db, limite = 14)` — todos os registros, mais recente
  primeiro, limitados.

**Engine** — `js/engine/cardio.js`:
`avaliarCardio({ modalidade, grupoDoDia })` — usa só
`regrasCardio.modalidadeEvitarSeForemPernasFoco` (`"corrida"`). Ruling:
sem hora-do-dia registrada em `historicoSeries` (só `data`), não dá pra
calcular `separacaoTemporalHoras` (6h) com precisão — **fora de escopo
por falta de dado**, documentado aqui. Verifica só: se
`modalidade === "corrida"` e `grupoDoDia === "inferior"`, retorna um
aviso (nunca bloqueia o registro) — `{ tipo: "modalidade_nao_recomendada",
mensagem: "Corrida pode interferir na recuperação de pernas hoje;
bicicleta, elíptico ou escada são as opções preferidas.", principio:
"regrasCardio" }`. Caso contrário, `null`.

**Tela**: novo card "Cardio" em `js/screens/divisao.js`, abaixo do card
"Hoje" — formulário simples (select de modalidade, input de duração em
minutos, select de intensidade percebida 1-5, botão "Registrar") e lista
das últimas sessões de cardio (mesmo padrão visual de "Sessões
recentes"). Ao salvar, roda `avaliarCardio` com o `grupoDeHoje` já
calculado na tela e mostra o aviso (se houver) como uma linha extra,
sem bloquear o registro.

## 5. Casos de borda (todas as fatias)

- Sem histórico suficiente (menos de 2 sessões, menos de 28 dias) → sem
  alerta, não erro.
- `cargaMedia` comparada com `===`: funciona porque o app já assume carga
  constante dentro de uma sessão de um exercício (padrão observado em
  `treino.js`); sessões com carga variável dentro delas mesmas são um
  caso não coberto, aceito como simplificação.
- Todo texto de alerta/aviso é um template fixo interpolado só com dados
  não-vindos-do-usuário (nome de músculo, nome de exercício) — sempre via
  `.textContent` na tela, nunca `innerHTML`.

## 6. Fora de escopo (permanece)

- Qualquer ação automática (deload, redução de volume, bloqueio de
  registro) — todos os alertas/avisos são só informativos.
- Cálculo de `separacaoTemporalHoras` (6h) por falta de hora-do-dia nos
  registros — precisaria de um campo de horário que não existe hoje em
  nenhuma tela do app.
