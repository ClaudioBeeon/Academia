# Redesign — Mapa de Telas e Fluxo Clicável

## 0. Problema que motiva o redesign

A tela Treino atual (`js/screens/treino.js:49`) filtra a biblioteca inteira
pelo grupo do dia e renderiza **todos** os exercícios encontrados — 16 no
Superior. Isso não é uma sessão prescrita, é um despejo de catálogo.

Além de desanimador, viola o próprio `protocolo.json`:
`limiteSeriesDiretas.porMusculoPorSessao = { min: 5, max: 8 }`. Com 16
exercícios × 3 séries = 48 séries numa sessão, o alerta
`series_excessivas_sessao` dispararia para praticamente todo músculo.

### Ruling científico: sessão de 6–7 exercícios

Baseado em `base-cientifica-hipertrofia-forca.md`:

- **P3 / seção 13:** qualidade cai claramente após ~5–8 séries diretas
  por músculo por sessão. Acima disso, "distribua em mais dias em vez de
  empilhar".
- **Seção 2:** com volume semanal igualado, frequência tem efeito
  desprezível sobre hipertrofia — distribuir em mais dias não custa
  resultado.
- **Seção 9:** ordem não afeta hipertrofia; ordenar por prioridade.
- **Seção 8:** 2–3 exercícios por músculo grande é justificável
  (hipertrofia regional), evidência [FRACO] — não é obrigatório.

**Decisão:** a sessão passa a ser **gerada**, com alvo de 6–7 exercícios
(~18–21 séries), respeitando: máx. 8 séries diretas por músculo na
sessão, prioridade primeiro (peito na frente), e rotação de exercícios
entre sessões para cobrir a biblioteca ao longo do mesociclo.

---

## 1. Mapa de telas

```
┌─ HOME (Hoje) ──────────────────── tab 1
│   ├─ strip de dias (Seg…Dom) → [clicar em dia] → DIA DETALHE
│   ├─ card "Treino de hoje"  → [Começar]        → FILA DO DIA
│   ├─ card de alertas        → [clicar]         → ALERTA DETALHE
│   ├─ card check-in          → [Responder]      → CHECK-IN (bottom sheet)
│   ├─ gráficos (volume/semana, tendência, streak)
│   └─ card cardio            → [Registrar]      → CARDIO (bottom sheet)
│
├─ FILA DO DIA ──────────────────── push de Home
│   ├─ progresso da sessão (3/7)
│   ├─ lista de 6–7 cards de exercício
│   │     └─ [clicar card] → EXECUÇÃO
│   ├─ [Trocar exercício]  → SUBSTITUTOS (bottom sheet)
│   └─ [Finalizar sessão]  → RELATÓRIO
│
├─ EXECUÇÃO ─────────────────────── push de Fila
│   ├─ explicação gerada do exercício (colapsável)
│   ├─ carga sugerida + anilhas
│   ├─ lista de séries (check ao concluir)
│   ├─ [PLAY] → série em andamento → [Concluir série] → descanso
│   ├─ [Concluir exercício] (sempre disponível)
│   ├─ [Histórico]   → HISTÓRICO DO EXERCÍCIO (bottom sheet)
│   └─ [→ próximo]   → EXECUÇÃO do próximo da fila
│
├─ RELATÓRIO ────────────────────── push de Fila (peak-end)
│   ├─ stats da sessão + comparação com anterior
│   ├─ PRs celebrados
│   ├─ check-in subjetivo
│   └─ [Concluir] → volta pra HOME
│
├─ EVOLUÇÃO ─────────────────────── tab 2
├─ BIBLIOTECA ───────────────────── tab 3
└─ PERFIL / CONFIG ──────────────── tab 4
```

---

## 2. Telas em detalhe

### 2.1 HOME — "Hoje"

**Objetivo do usuário:** saber em 2 segundos o que treinar hoje e como
está indo a semana.

| Elemento | Conteúdo | Ação ao clicar |
|---|---|---|
| Header | Saudação + data por extenso | — |
| Strip de dias | Seg–Dom, hoje destacado; cada dia mostra ponto colorido se houve treino | Abre DIA DETALHE daquele dia |
| Card "Treino de hoje" | Grupo (Superior/Inferior), N exercícios, duração estimada, N séries | [Começar] → FILA DO DIA |
| Card de alertas | Alertas ativos dos 3 engines (recuperação/desempenho/volume) | Expande explicação + princípio |
| Anel/barra de volume | Volume semanal por músculo vs. faixa-alvo do protocolo | → EVOLUÇÃO |
| Gráfico de tendência | Volume total por sessão, últimas 8 sessões | → EVOLUÇÃO |
| Stats rápidos | Séries na semana · streak · PRs do mês | — |
| Card check-in | Só aparece se ainda não respondeu hoje | Abre bottom sheet |
| Card cardio | Últimas sessões + registrar | Abre bottom sheet |

**Estados:** primeiro acesso (sem histórico → onboarding suave); dia de
descanso (card vira "Descanso" com sugestão de cardio leve); deload
(banner do mesociclo).

### 2.2 DIA DETALHE

Ao clicar num dia do strip:
- **Dia passado com treino:** resumo daquela sessão (exercícios, séries,
  volume, PRs) — read-only.
- **Hoje:** atalho pra FILA DO DIA.
- **Dia futuro:** preview do grupo previsto pela rotação + exercícios
  candidatos.
- **Dia passado sem treino:** estado vazio com o que estava previsto.

### 2.3 FILA DO DIA

**Objetivo:** ver a sessão inteira de relance e escolher por onde começar.

- Header com grupo, progresso `3/7`, barra de progresso, tempo decorrido.
- 6–7 cards de exercício, cada um com: nome, músculo, `3 × 8–12`, RIR
  alvo, carga sugerida, e **estado visual**:
  - `pendente` — card neutro
  - `em andamento` — card com borda accent + série atual
  - `concluído` — card com check, opacidade reduzida
- Ordem: prioridade primeiro (peito), depois compostos, depois
  isoladores — conforme seção 9.
- Ações: [clicar card] → EXECUÇÃO · [Trocar] → substitutos ·
  [Finalizar sessão] → RELATÓRIO.

### 2.4 EXECUÇÃO — a tela central

**Objetivo:** executar uma série sem pensar em nada além do movimento.

**Blocos, de cima pra baixo:**

1. **Header:** nome do exercício, `Exercício 3 de 7`, [X] fecha pra fila.
2. **Explicação gerada** (colapsável, aberta na 1ª vez): como executar,
   dica de amplitude/posição alongada, músculo primário + secundários.
   Vem de `observacoesExecucao` do `exercicios.json`.
3. **Carga sugerida:** valor + montagem de anilhas (engine `anilhas.js`),
   com dica de progressão do engine `progressao.js`.
4. **Lista de séries** — o coração da tela. Cada linha:
   - `1` · carga · reps · RIR · **check**
   - Check aparece **automaticamente** quando a série é concluída e o
     descanso começa.
   - Linhas já feitas ficam com check verde; a atual fica destacada.
5. **Zona de ação (thumb zone, fixa no rodapé):**

**Máquina de estados do botão:**

```
   [▶ PLAY]  ──clica──▶  SÉRIE EM ANDAMENTO
                          (cronômetro sobe, botão vira "Concluir série")
                                    │
                              clica │
                                    ▼
                          série marcada ✓ na lista
                          DESCANSO inicia (regressivo, ex. 90s)
                                    │
                          ┌─────────┴─────────┐
                    zera  │                   │ usuário clica PLAY antes
                          ▼                   ▼
                 conta em POSITIVO      próxima série começa
                 (+12s, +13s… "excedente")
                          │
                    clica PLAY
                          ▼
                 próxima série começa
```

- O descanso **nunca bloqueia** — é informativo. Ao zerar, vira contador
  crescente em cor de atenção, mostrando quanto passou do alvo.
- **[Concluir exercício]** sempre visível — o usuário pode fazer só 2 das
  3 séries e seguir. Sem julgamento, sem modal de confirmação.
- Ao concluir o último exercício → vai direto pro RELATÓRIO.

6. **Rodapé secundário:** [Histórico deste exercício] · [Trocar exercício]
   · [→ Próximo exercício].

**Detalhes de comportamento:**
- Cada série concluída grava em `historicoSeries` na hora (já existe).
- PR detectado (`recordes.js`) → micro-celebração inline na linha da série.
- RIR suspeito (`rir.js`) → toast de calibração (já existe).
- Descanso alvo vem de `tiposDeExercicio[tipo].descansoSegundos.min`.

### 2.5 RELATÓRIO DE SESSÃO (momento peak-end)

- Título celebrativo + tempo total.
- Stats grandes: séries · volume (kg) · exercícios · músculos.
- **Comparação com a sessão anterior do mesmo grupo** (↑/↓ volume).
- **PRs da sessão** com destaque visual.
- Volume da semana atualizado vs. faixa-alvo.
- Check-in subjetivo embutido (qualidade 1–5 + 3 flags).
- [Concluir] → HOME.

### 2.6 Telas já existentes (mantidas, re-skinadas)

- **EVOLUÇÃO:** gráficos de carga/volume por exercício e medidas
  corporais.
- **BIBLIOTECA:** catálogo dos 19 exercícios, busca, detalhe.
- **PERFIL/CONFIG:** equipamento disponível, export/import, protocolo.

---

## 3. O que precisa ser construído no backend

| Peça | Estado | Nota |
|---|---|---|
| `engine/sessaoGerada.js` | **novo** | Seleciona 6–7 exercícios respeitando P3, prioridade e rotação |
| `data/sessoes.js` | **novo** | Persiste a sessão gerada do dia (pra fila ser estável) |
| Estado de execução (série atual, descanso) | **novo** | Em memória na tela + `historicoSeries` como fonte da verdade |
| `engine/graficos.js` | existe | Alimenta os gráficos da Home |
| `engine/sessao.js` | existe | Stats do relatório |
| `engine/alertas*.js` (3) | existe | Card de alertas da Home |
| `engine/anilhas.js`, `cargas.js`, `progressao.js`, `rir.js`, `recordes.js` | existe | Tela de Execução |
| `data/cardio.js`, `checkin.js` | existe | Cards da Home |

---

## 4. Fora de escopo desta etapa

- Implementação real das telas (esta etapa entrega **plano + 3
  protótipos visuais** para aprovação).
- Vídeos/animações demonstrativas dos exercícios.
- Sincronização em nuvem.
