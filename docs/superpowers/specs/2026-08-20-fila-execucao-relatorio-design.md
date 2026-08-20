# Fila do Dia → Execução → Relatório

## 1. Contexto e objetivo

Última peça grande do protótipo "Emon" aprovado: hoje, clicar em
"Começar treino" só rola a página até os cards de exercício empilhados
inline. O protótipo mostra um fluxo de 3 telas — Fila do Dia (visão
geral com anel de progresso), Execução (um exercício por vez, tela
cheia), Relatório (resumo ao final) — com navegação empilhada (push), não
abas.

Esta fatia constrói as 3 telas e troca "Começar treino" pra navegar pra
Fila em vez de rolar a página.

## 2. Decisões de escopo (rulings)

- **Reaproveitar a lógica de registrar série, não reinventar.** O
  protótipo desenha uma "máquina de estados PLAY/série em
  andamento/descanso" pro botão de cada série (cronômetro de execução em
  si, não só de descanso). Isso é enriquecimento visual do protótipo, não
  algo que os dados do app precisam — a forma atual (digitar carga/reps/RIR,
  tocar no anel numerado pra registrar) já é testada, correta, e cobre
  recorde pessoal + validação de RIR + progressão. Ruling: a tela de
  Execução usa exatamente essa mesma UI de série (portada de
  `montarCardExercicio`), só que **um exercício por vez em tela cheia**
  em vez de todos empilhados. O cronômetro de descanso entre séries já
  existe (`criarCronometro`) e continua igual.
- **Sem comparação com sessão anterior nem volume semanal no Relatório.**
  O protótipo pede isso, mas nenhum motor do app calcula "volume desta
  sessão vs. sessão anterior do mesmo dia" ainda — construir isso do zero
  infla bastante esta fatia. Ruling: Relatório mostra os stats da própria
  sessão (séries, volume, exercícios, músculos — via `sessao.js`, já
  existe) e os PRs da sessão. Comparação histórica fica pra uma fatia
  futura se o usuário pedir.
- **Sem tela DIA DETALHE nem faixa de dias da semana.** Isso depende de
  uma Home com strip de dias que não foi construída (decisão já tomada
  na fatia da Home) — continua fora de escopo.
- **`observacoesExecucao` do `exercicios.json` entra**, como bloco
  colapsável na tela de Execução — o dado já existe, custo baixo, valor
  real (instrução de execução por exercício).

## 3. Navegação

Sem router, mesmo padrão do resto do app: um módulo orquestrador novo,
`js/screens/sessao.js`, dono de um mini-estado interno (`"fila" |
"execucao" | "relatorio"`, índice do exercício atual, lista de PRs
acumulados na sessão). `js/app.js` ganha UM ponto de entrada:
`onComecarTreino` passado pra `montarTelaTreino`, que troca o conteúdo
de `#tab-content` pelo fluxo de sessão inteiro (mesmo padrão já usado
por `onAbrirHistorico`). Terminar a sessão (Relatório → Concluir) chama
`renderTab("hoje")` de volta.

```
Hoje ──[Começar treino / clicar no card]──▶ Fila do Dia
Fila do Dia ──[clicar exercício]──▶ Execução (desse exercício)
Fila do Dia ──[Finalizar sessão]──▶ Relatório
Execução ──[X fecha]──▶ Fila do Dia
Execução ──[Concluir exercício, não é o último]──▶ Execução (próximo)
Execução ──[Concluir exercício, é o último]──▶ Relatório
Relatório ──[Concluir]──▶ Hoje
```

## 4. Fila do Dia (`js/screens/fila.js`)

- Header: dia da sequência (título), progresso `X/Y exercícios`, total
  de séries feitas/previstas.
- Lista de cards compactos (não os cards de log completos) — um por
  exercício de `exerciciosHoje` (a mesma lista já gerada por
  `gerarSessaoDoDia`, recomputada aqui do zero a partir do `db`, mesmo
  padrão de toda tela deste app: cada tela busca seus próprios dados,
  sem passar estado computado entre módulos por closure). Cada card
  mostra: nome, músculo, faixa de reps/RIR-alvo, e estado visual:
  - `pendente` — nenhuma série registrada hoje pra esse exercício.
  - `em andamento` — 1 ou 2 de 3 séries registradas.
  - `concluído` — 3 de 3 séries registradas.
- Clicar um card → Execução daquele exercício.
- Botão "Finalizar sessão" (sempre visível, mesmo com exercícios
  pendentes — sem julgamento, sem confirmação) → Relatório.

## 5. Execução (`js/screens/execucao.js`)

- Header: nome do exercício, `Exercício N de M`, botão [X] → volta pra
  Fila.
- Bloco colapsável (fechado por padrão, exceto na primeira vez que
  QUALQUER exercício é aberto numa sessão — usa uma flag em memória no
  orquestrador, não persistida): `observacoesExecucao`.
- Sugestão de carga (`cargas.js`) + anilhas (`anilhas.js`, só pra
  exercícios de barra, igual já funciona) + dica de progressão
  (`progressao.js`) — portados de `montarCardExercicio` sem mudança de
  lógica.
- As 3 linhas de série (carga/reps/RIR + anel numerado pra registrar) —
  mesmo componente `criarLinhaSerie` já existe, reaproveitado sem
  mudança.
- Toast de recorde pessoal e de calibração de RIR — mesmas funções já
  existentes (`mostrarToastPR`, `mostrarToastRir`), reaproveitadas. A
  detecção de PR aqui TAMBÉM empilha no array de PRs da sessão que o
  orquestrador mantém, pro Relatório mostrar depois.
- Rodapé fixo: [Histórico deste exercício] · [Trocar exercício] ·
  [Concluir exercício → próximo]. "Trocar" mantém o `alert()` simples já
  existente (não vira um bottom sheet nesta fatia — outra simplificação
  de escopo).
- "Concluir exercício" está sempre disponível, mesmo com menos de 3
  séries feitas — navega pro próximo exercício da fila, ou pro Relatório
  se for o último.

## 6. Relatório (`js/screens/relatorio.js`)

- Título + stats grandes: séries, volume (kg), exercícios, músculos —
  via `calcularEstatisticasSessao` (já existe, sem mudança).
- PRs da sessão: lista dos PRs acumulados durante a Execução (passados
  pelo orquestrador, não recalculados aqui).
- Check-in embutido: mesmo componente de formulário já usado no card de
  check-in da Home (`renderizarFormularioCheckin`/
  `renderizarResumoCheckin` de `treino.js`) — extraído pra um módulo
  compartilhado nesta fatia, já que agora tem 2 consumidores (Home e
  Relatório) em vez de 1.
- Botão "Concluir" → volta pra Hoje.

## 7. Mudança na Home (`js/screens/treino.js`)

- O card de plano ("Treino de hoje") não rola mais a página — chama
  `onComecarTreino()`.
- Os cards de exercício empilhados inline, o card de resumo de sessão, e
  o seletor de trocar-dia continuam existindo na Home? **Não** — a Home
  vira só o painel (saudação, carrossel plano+cardio, atividade,
  check-in). A lista de exercícios em si e o resumo de sessão migram pra
  Fila/Execução/Relatório. O seletor de trocar-dia (`<select>` com os 5
  dias) continua na Home, porque a decisão de qual dia é hoje precisa
  acontecer ANTES de entrar na Fila.
- `montarTelaTreino` fica bem mais simples depois dessa migração —
  perde `montarCardExercicio`, `criarLinhaSerie`,
  `montarCardResumoSessao`, `mostrarToastPR`, `mostrarToastRir`,
  `criarPlaceholderDescanso`, `iniciarDescanso`, que migram pra
  `js/screens/execucao.js` (a maioria) e `js/screens/fila.js`/
  `js/screens/relatorio.js` (o resumo).

## 8. Fora de escopo

- Cronômetro de execução da série em si (só o de descanso continua).
- Comparação com sessão anterior / volume semanal no Relatório.
- Bottom sheet de substitutos (continua `alert()`).
- Tela DIA DETALHE / strip de dias na Home.
- Editar `observacoesExecucao` pela Biblioteca — só leitura por enquanto.
