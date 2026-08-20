# Nível 3 (fatia 1) — Progressão Dupla + Validação de RIR na tela de Treino

## 1. Contexto e objetivo

Desde o plano de fundação (Nível 1), dois motores puros já existem, já são
testados, e nunca foram conectados a nenhuma tela:

- `js/engine/progressao.js` — `avaliarProgressao({ faixaMin, faixaMax,
  rirAlvo, sessaoAtual, sessaoAnterior })`: decide `"aumentar_carga"`,
  `"reduzir_carga"` ou `"manter"`, implementando a regra de progressão
  dupla de `protocolo.json` (seção `regraProgressaoDupla`).
- `js/engine/rir.js` — `validarRir({ rirDeclarado, repsSerieAtual,
  repsSerieSeguinte, cargaIgual })`: sinaliza quando um RIR declarado
  provavelmente foi superestimado, implementando
  `protocolo.json.validacaoRir`.

Esta fatia conecta os dois na tela de Treino — sem mudar nenhum dos dois
motores, que já estão corretos e testados.

## 2. Progressão dupla — onde e como aparece

Em `montarCardExercicio`, ao lado do hint já existente ("Última vez: X kg
× Y, RIR Z. Sugestão de hoje: W kg"), um segundo hint mostra o veredito de
`avaliarProgressao`:

- `sessaoAtual`: as séries já registradas hoje para este exercício
  (já disponível como `seriesHoje` na função).
- `sessaoAnterior`: as séries da sessão anterior mais recente **completa**
  para este exercício — não apenas o último set (que `getUltimaSerieAnterior`
  já traz), mas todos os sets daquela sessão, porque a regra "abaixo do
  mínimo por 2 sessões consecutivas" precisa examinar toda a sessão
  anterior, não uma única série.
- `faixaMin`/`faixaMax`/`rirAlvo`: já vêm de `obterConfigExercicio` (`cfg`).

**Textos exibidos** (mapeando `acao` → texto, sem inventar redação nova
além da já existente no motor — o motor já traz `motivo` em português,
usar ele diretamente):

- `"aumentar_carga"` → `📈 ${motivo}`
- `"reduzir_carga"` → `📉 ${motivo}`
- `"manter"` → não mostra hint extra (evita ruído visual toda sessão —
  "manter" é o estado neutro mais comum, mostrar um hint pra ele em toda
  sessão contradiz o guarda-corpo "nunca exigir aumento de carga a cada
  sessão", que já está formulado no motor mas reforça aqui não adicionar
  pressão visual desnecessária).

O hint é recalculado a cada série registrada neste exercício (mesmo
padrão já usado pelo card de resumo de sessão: uma função `atualizar*`
local, chamada uma vez no mount e de novo dentro do submit handler),
porque `sessaoAtual` muda a cada série logada — sem isso, o hint ficaria
parado mostrando o veredito de antes da sessão começar.

## 3. Validação de RIR — onde e como aparece

Regra (`protocolo.json.validacaoRir`, também citada em `rir.js`): se o
RIR declarado numa série foi <= 2, e a série seguinte (mesma carga)
conseguiu MAIS repetições, o RIR declarado provavelmente foi
superestimado.

Isso é checado **dentro do handler de submit**, logo depois de registrar
uma série numerada N (N >= 2): busca a série N-1 já registrada hoje para
o mesmo exercício (via `getSeriesDoExercicioNaData`, já importado). Se
existir e tiver a mesma carga da série N, chama `validarRir({
rirDeclarado: serieAnterior.rir, repsSerieAtual: serieAnterior.reps,
repsSerieSeguinte: repsDaSerieRecemLogada, cargaIgual: true })`. Se
`suspeitaSuperestimado`, mostra a `mensagem` do motor num toast
educativo — mesmo padrão visual do toast de recorde pessoal já existente
(`mostrarToastPR`), mas com um rótulo próprio para não se confundir com
recorde ("💡 Calibração de RIR" em vez de "🏆 Recorde pessoal").

Isso **nunca bloqueia nem corrige** a série logada — é feedback educativo
apenas, consistente com o guarda-corpo "nunca tratar RIR declarado como
número exato — aplicar validação cruzada" (que já é sobre mostrar, não
sobre reescrever dados do usuário).

## 4. Nova função de dados

`js/data/historico.js`: `getSeriesDaUltimaSessaoAnterior(db, exercicioId,
dataAtual)` — encontra a data mais recente estritamente anterior a
`dataAtual` em que este exercício tem séries registradas, e retorna TODAS
as séries daquela data (não apenas a mais recente). Retorna `[]` se não
houver sessão anterior.

## 5. Casos de borda

- **Primeira sessão de um exercício** (sem sessão anterior):
  `avaliarProgressao` já trata `sessaoAnterior` vazio/undefined
  corretamente (a condição "abaixo do mínimo em 2 sessões consecutivas"
  precisa das duas, então nunca dispara com uma só) — nenhuma mudança
  necessária no motor.
- **Primeira série da sessão** (N=1): não há série N-1 pra validar RIR
  contra — pula a checagem, sem erro.
- **Séries com cargas diferentes entre si**: `validarRir` já recebe
  `cargaIgual` calculado no código da tela (não no motor), então a
  checagem de RIR só dispara quando as cargas realmente batem.
- **Sequência de aquecimento**: os cards de exercício atuais não geram
  séries de aquecimento via este fluxo (isso é só o painel de Ferramentas,
  que não grava no banco) — não há necessidade de filtrar `tipoSerie`
  aqui.

## 6. Fora de escopo

- Mudar qualquer coisa dentro de `progressao.js` ou `rir.js` — ambos já
  corretos e testados, esta fatia é só de conexão.
- Aplicar a sugestão de progressão automaticamente na carga sugerida
  (`sugestao.cargaSugerida`, de `cargas.js`) — os dois motores continuam
  independentes; a IA/regra nunca decide, só sugere (guarda-corpo do
  projeto).
