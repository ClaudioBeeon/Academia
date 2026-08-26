# Planos de animação — auditoria via `improve-animations`

Gerado em cima do commit `3bb8a0a`. Nenhum código foi alterado ao escrever
estes planos — auditoria somente-leitura, execução é um passo separado
(`improve-animations execute <plan>` ou qualquer agente).

| # | Título | Severidade | Status | Depende de |
| --- | --- | --- | --- | --- |
| [001](001-sheet-entrance-animation.md) | Folhas inferiores aparecem sem deslizar | HIGH | DONE | — |
| [002](002-press-feedback-curve.md) | Curva de toque exagerada/bouncy no app inteiro | HIGH | DONE | — |
| [003](003-pr-toast-animation.md) | Toast de recorde pessoal sem nenhuma animação | MEDIUM | DONE | 002 (token `--ease-out`) |
| [004](004-reduced-motion-screen-transitions.md) | Troca de tela ignora `prefers-reduced-motion` | MEDIUM | DONE | — |
| [005](005-accordion-expand-collapse.md) | Acordeões (`<details>`) abrem/fecham sem transição | MEDIUM | DONE | 002 (token `--ease-out`) |
| [006](006-ferramentas-panel-reveal.md) | Painel "Ferramentas" aparece sem transição | LOW | DONE | 002 (token `--ease-out`) |
| [007](007-duration-tokens-consolidation.md) | Sem tokens de duração — valores quase-duplicados espalhados | LOW | DONE | 002 (mesmo arquivo `tokens.css`) |

Todos os 7 aplicados diretamente nesta sessão (não via subagente/worktree
isolado — o contexto completo do código já estava disponível). Duas
pequenas correções feitas durante a aplicação, além do que cada plano já
previa:

- **006**: `.sets` é reaproveitada em dezenas de telas do app pra listas
  genéricas — os planos já previam esse risco como limite explícito.
  Em vez de mexer em `.sets` direto, o painel ganhou uma classe própria
  (`.ferramentas-painel`) só com as novas regras.
- **005**: o helper `animarDetails` só definia a opacidade final no
  `requestAnimationFrame`, nunca a inicial — a entrada não desbotava de
  verdade na primeira execução. Corrigido pra espelhar o mesmo padrão
  já usado pra `height` (define o estado inicial, força um reflow, só
  depois muda pro estado alvo).

## Ordem recomendada

1. **002** primeiro — introduz o token `--ease-out` em `css/tokens.css`
   que 003, 005, 006 e 007 reaproveitam. Também é, sozinho, a correção
   de maior alcance (uma linha de CSS conserta o toque em todo elemento
   do app).
2. **001** — pode rodar em paralelo com 002 (arquivos diferentes, sem
   conflito), mas é o outro item HIGH — o maior salto de sensação
   percebida (quatro folhas que hoje só "aparecem" passam a deslizar).
3. **004** — independente de tudo, mexe só em `js/lib/spring.js`.
   Prioridade por ser acessibilidade, não por esforço.
4. **003, 005, 006** — em qualquer ordem entre si, todos pequenos e
   todos dependem só do token de 002.
5. **007** por último — é só consolidação/polish, e evita conflito de
   merge em `tokens.css` esperando 002 já ter adicionado sua linha lá.

## Achados considerados e descartados

Durante a varredura, isto foi visto e conscientemente **não** virou
achado:

- `.exec-cronometro` (caixa flutuante de trabalho/descanso) e o telão de
  série (`js/screens/telaSerieCheia.js`) — construídos nesta mesma sessão
  já seguindo os princípios do Emil Kowalski (transform/opacity, sem
  `scale(0)`, `prefers-reduced-motion` nos dois primeiros; a onda em si é
  funcional — mostra o ritmo real da cadência — não decorativa, então fica
  isenta da recomendação "menos é mais" que se aplica a decoração).
- `transform-origin` em popovers/dropdowns — não se aplica: este app não
  tem nenhum padrão de popover/dropdown ancorado, só folhas inferiores
  (que corretamente ficam centralizadas/ancoradas embaixo).
- Atraso de tooltip/popover "instantâneo após o primeiro" — não se
  aplica: o app não usa tooltips.

## Achado NÃO incluído (fora do escopo de "somente-leitura")

O toque em `#tab-bar button.active { color: var(--accent) }` e o
outline de foco (`css/styles.css:61-62`) foram revisados e estão
corretos — sem finding.
