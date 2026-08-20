# Redesign — Direção escolhida: "1 · Emon"

## Decisão

Entre as 3 versões de `prototypes/redesign-v4.html` (rodada 4, cada uma
reproduzindo a estrutura de uma referência visual enviada pelo usuário), a
direção aprovada foi a **1 · Emon**: saudação no topo, card de plano em
destaque (cor de destaque do app, não branco), grade 2×2 de estatísticas,
fila de exercícios com miniatura + check circular, anel de progresso na
tela de execução.

A paleta lima-sobre-quase-preto da referência já é, essencialmente, a
paleta que `css/tokens.css` já usava antes deste redesign (`--accent:
oklch(89% 0.21 128)` é lima; `--paper: oklch(13% 0.012 145)` é
quase-preto). Não houve necessidade de trocar tokens de cor — só de
estrutura e componentes.

## O que foi implementado nesta fatia

- **`js/engine/sessaoGerada.js`** (novo, puro, testado): corrige o bug
  identificado nesta mesma sessão — a tela de Treino despejava o catálogo
  inteiro do grupo (16 exercícios/48 séries) em vez de uma sessão
  prescrita. Agora gera 6-7 exercícios por sessão, round-robin por
  músculo (garante que todo músculo do grupo apareça, mesmo os em
  manutenção), no máximo 2 exercícios por músculo (6 séries diretas,
  dentro do limite de 8 de `protocolo.json`), com rotação determinística
  entre sessões consecutivas via `sessoesAnterioresDoGrupo`. Rulings
  documentados como comentário no topo do arquivo.
- **`js/screens/treino.js`**: cabeçalho vira saudação por horário do dia
  (sem nome — `perfil.json` não tem campo de nome, então não foi
  inventado); novo card `.plano-hero` no topo (grupo do dia, N
  exercícios, N séries, minutos estimados, botão "Começar treino" que
  rola até o primeiro exercício); "Resumo da sessão" virou uma grade
  2×2 de tiles (séries, volume, exercícios, músculos) em vez de texto
  corrido.
- **`css/styles.css`**: classes `.plano-hero`, `.stats-grid`, `.stat-tile`,
  reaproveitando os tokens `--accent`/`--accent-ink`/`--card-2`/`--line`
  já existentes.
- **`sw.js`**: `sessaoGerada.js` no `APP_SHELL`, cache `v12` → `v13`.

## O que ficou fora desta fatia (deferido)

A referência "Emon" também tem uma tela de **execução separada** (não
inline como hoje) com anel de progresso circular grande, cronômetro de
descanso em tela cheia e navegação Fila → Execução → próximo exercício —
isso é uma mudança de modelo de navegação (nova tela, novo estado de
sessão em andamento), não um ajuste incremental. Fica para uma fatia
própria, com seu spec e plano, seguindo a convenção do repo — implementar
isso junto do resto sem planejamento dedicado arriscaria misturar UI nova
com uma reestruturação de navegação, o tipo de mudança que pede seu
próprio ciclo de design→plano→execução.

O modelo atual (cards de exercício inline, um por vez na página, com
descanso embutido) já cobre a mesma funcionalidade — play/pause,
descanso contando, PR toast, validação de RIR — só que sem a tela
dedicada em tela cheia.
