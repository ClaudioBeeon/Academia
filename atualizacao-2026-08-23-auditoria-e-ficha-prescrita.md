# Atualização de 23/08/2026 — Auditoria, Ficha Prescrita e Novas Funcionalidades

**Este documento é o pacote de atualização completo dessa sessão.** Reúne a auditoria do gerador de treino, o que a literatura mais recente trouxe de novo, e todas as funcionalidades adicionadas ao app — pra ser lido de uma vez quando quiser relembrar o que mudou e por quê, sem precisar reconstruir a conversa inteira.

Relatório visual original da auditoria (gráficos, comparações lado a lado): https://claude.ai/code/artifact/1e996a18-231f-434f-a389-b652b622af14

---

## 1. Por que essa auditoria aconteceu

O sintoma que disparou tudo: o Dia 1 do treino (“Peito + Tríceps”) só tinha **3 exercícios**, quando a especificação original (`referencia-consolidada-app-treino.md` §4) definia 6. Rodando o gerador de verdade (não estimando) sobre os cinco dias do ciclo, apareceram três problemas de fundo, não só o Dia 1 vazio:

1. **Prioridade invertida no `protocolo.json`.** O bíceps estava marcado como o único músculo priorizado; peito, apesar de ser prioridade 2 declarada, estava em "recomposição" — um degrau abaixo. Resultado medido: **tríceps com 20,5 séries semanais contra 12 do peito**, um acessório recebendo 71% mais volume que uma prioridade.
2. **Desequilíbrio empurra-puxa.** O treino somava **21 séries de empurrar contra 6 de puxar**, e **zero** séries de deltoide posterior — nenhum exercício desse músculo sequer existia no catálogo, apesar da spec original já citar "face pull / deltoide posterior" no Dia 1.
3. **Faixas de volume declaradas errado.** Glúteo, panturrilha e abdômen estavam na faixa "padrão" (10–16 séries/semana) do protocolo, quando deveriam estar em manutenção — o app os tratava como deficientes sem que ninguém tivesse decidido isso.

Contexto que só apareceu durante a conversa e mudou o diagnóstico: você reportou **ombros e pescoço pra frente** (padrão *upper crossed syndrome*) e que **pernas/bunda não são prioridade** (histórico de vôlei e futebol já deu base de coxa e panturrilha). Isso re-classificou vários dos "erros" do item 3 — várias faixas realmente estavam erradas, mas outras eram só a faixa declarada não bater com o que você quer, não bug de treino.

---

## 2. O que a literatura mais recente trouxe (que a base científica original não tinha)

A `base-cientifica-hipertrofia-forca.md` está sólida — as citações que ela já tinha conferem. Três achados novos, checados nesta sessão:

**Volume por sessão é mais generoso do que o protocolo assumia.**
Remmert, Pelland, Robinson, Hinson & Zourdos (2025), *Is There Too Much of a Good Thing? Meta-Regressions of the Effect of Per-Session Volume on Hypertrophy and Strength*, SportRxiv — mediu volume *por sessão* (não semanal) e achou o ponto de retorno indetectável em **~11 séries fracionadas por sessão** pra hipertrofia (e ~2 séries diretas pra força). O teto antigo de 5–8 séries diretas por sessão do `protocolo.json` era conservador — dar 5 séries de peito por sessão (em vez de 4) está bem dentro da margem.

**Rotação de ângulo do peito é mais sólida do que a base marcava.**
A base original classificava a hipertrofia regional do peito como **[FRACO]**, apoiada só num estudo de 2021 em iniciantes. Evidência de 2025 é mais direta: após supino reto a porção esternal cresceu ~11% mais que a clavicular; após inclinado, a clavicular cresceu ~11% mais que a esternal. A rotação inclinado → horizontal → alongado que o app já fazia estava certa — só devia ser classificada como **[MODERADO]**, não [FRACO].

**Postura de ombros/pescoço pra frente responde a exercício corretivo.**
Não estava em nenhum documento do projeto até agora, porque não era um objetivo declarado. Duas referências:
- Revisão sistemática com meta-análise sobre exercícios terapêuticos em *forward head posture*, ombro protraído e hipercifose — *BMC Musculoskeletal Disorders* (2024).
- Ensaio randomizado de exercício corretivo em *upper crossed syndrome* — *BMC Sports Science, Medicine and Rehabilitation* (2025).

Achado prático: pra quem já tem ombro protraído, a orientação é **puxar igual ou mais que empurrar** durante a fase de correção — o oposto da proporção que o app tinha.

**Recomposição em déficit — seu perfil é favorável.**
Um estudo de 2026 com 304 adultos em déficit moderado (~500 kcal) mostrou homens perdendo gordura *e* ganhando massa magra ao mesmo tempo com treino de força. Seus 20% de gordura corporal e o histórico pouco consistente de treino jogam a favor de recomposição funcionar. Reforça o ponto mais importante do documento de referência original: **o obstáculo ao peito não é o treino, é o tamanho do déficit calórico.**

---

## 3. A ficha prescrita — o que mudou na prática

A partir desta sessão, o app **não gera mais a sessão por fórmula** — ela vem de uma ficha fixa (`data/ficha.json`), escrita exercício por exercício, com o gerador antigo mantido só como reserva pra qualquer dia que a ficha não cubra.

### Estrutura dos 5 dias

| Dia | Treino | Exercícios | Séries |
|---|---|---|---|
| 1 | Peito (inclinado) + Costas + Deltoide posterior | 6 | 20 |
| 2 | Costas + Bíceps | 5 | 15 |
| 3 | Peito (horizontal) + Ombro + Tríceps + Abdômen | 5 | 17 |
| 4 | Pernas | 7 | 20 |
| 5 | Peito (alongado) + Bíceps + Ombro + Antebraço | 5 | 17 |

O Dia 1, que tinha 3 exercícios e nenhum trabalho de puxar, agora carrega metade do volume de correção postural da semana.

### Volume semanal — antes e depois

| Músculo | Antes | Depois | Motivo |
|---|---|---|---|
| Peito | 12 | 15 | Prioridade — sobe pro topo da própria faixa (9–15) |
| Bíceps | 15 | 18 | Prioridade confirmada, mantém volume, perde a posição de único priorizado |
| Costas | 6 | 16,5 | Puxar precisa igualar/superar empurrar pra postura |
| Deltoide posterior | 0 | 10,5 | Não existia no catálogo — maior lacuna encontrada |
| Tríceps | 20,5 (acima do teto) | 11 | Já recebia ~5 séries indiretas dos supinos; o volume direto extra era redundante |
| Ombro (anterior/desenvolvimento) | 18 | 3–6 | Desenvolvimento é press — reforça o lado já dominante da postura, cortado |
| Quadríceps | 6 | 8 | Você quis melhorar as coxas, sem virar prioridade |
| Posterior de coxa | 4,5 | 7,5 | Só 1 exercício existia no catálogo — 2ª vaga ficava vazia |
| Glúteo, panturrilha, abdômen | 3–6 (marcados como deficientes) | mesmo volume, faixa corrigida pra manutenção | Não eram erro de treino — eram erro de meta declarada |

**Balanço empurrar : puxar:** saiu de **21:6 (3,5:1 a favor de empurrar)** para **15:27 (≈1:1,8 a favor de puxar)** — sem tirar nenhuma série de peito.

### Catálogo de exercícios — 7 adicionados

`data/exercicios.json` ganhou: face pull na polia, crucifixo inverso na máquina, remada serrote (unilateral — ajuda a comparar força entre os lados), rosca martelo, rosca de punho (antebraço), agachamento hack, stiff/RDL. Todos já estavam citados na spec original e nunca tinham sido cadastrados.

### O que cada exercício mostra agora

Faixa de repetições, RIR-alvo, descanso, cadência ("1s subindo · 3s descendo"), se pode ir à falha — tudo visível sem abrir nada. Abaixo, um guia com **como executar**, **quando subir a carga**, **atenção** e **por que este exercício está aqui**.

### Mesociclo de 5 semanas

| Semana | RIR-alvo | Volume |
|---|---|---|
| 1 | 3 | Base da ficha — semana de achar as cargas |
| 2 | 2 | Base da ficha |
| 3 | 2 | +1 série em peito e bíceps |
| 4 | 1 | Mantém o da semana 3 — semana mais exigente |
| 5 | 4 | 50% do volume, mesma carga — deload |

O app calcula a semana sozinho pela data de início do bloco — sem precisar marcar nada manualmente.

### Quando trocar a ficha

**Não semanalmente.** Trocar exercício impede medir progressão, porque a comparação de carga/repetições só existe se for o mesmo exercício. Recomendação: manter 8–12 semanas, rodar o mesmo bloco de novo após o deload da semana 5 com as cargas conquistadas, e só trocar exercícios de fato na terceira rodada (~semana 12). Trocar antes disso só por: dor articular persistente num exercício específico, 4+ semanas sem progressão nenhuma, ou equipamento indisponível.

---

## 4. Funcionalidades novas adicionadas

### Aquecimento postural (5 min, todo dia)
Gato-camelo, chin tuck (queixo pra dentro — único trabalho direto pro pescoço pra frente), abertura torácica, face pull leve. Aparece antes de todo treino.

### Pausas posturais no expediente
Você trabalha 9h–18h em frente ao computador; o corpo pratica a postura da cadeira muito mais do que a do treino. O app planeja **4 pausas de 2 minutos** ao longo do dia (pulando o horário de almoço), com chin tuck, retração escapular, extensão torácica na cadeira e levantar/andar. Card na home mostra quantas já foram feitas e quantas estão pendentes.
Limitação honesta: um PWA não acorda sozinho com o app fechado — funciona como plano do dia e contador, não como alarme.

### Acompanhamento de postura (aba Evolução)
Foto de perfil a cada 4 semanas, comparando **primeira vs. mais recente** (não a anterior — mudança postural só aparece comparando com o início). Sem análise automática de ângulo — exigiria marcar pontos anatômicos à mão e devolveria um número com precisão falsa. Fotos ficam só no aparelho (Blob no IndexedDB), nunca saem sem sua ação.

### Meta de proteína (aba Dieta)
Faixa de **128–156 g/dia** (71 kg × 1,8–2,2 g/kg em déficit). Barra própria, visível todo dia — não é mais um alerta que só aparece quando falha.

### Hidratação por cor da urina
Nos hábitos diários, em vez de meta fixa de litros (evidência fraca pra isso) — clara/média/escura é o marcador que dá pra checar várias vezes por dia sem contar nada.

### Perguntas diárias como popup
Sono, creatina, hidratação e álcool agora aparecem como popup ao abrir o app — uma pergunta de cada vez, "Responder mais tarde" pra pular (volta na próxima abertura), reseta sozinho à meia-noite. O card "Hábitos de hoje" na home continua existindo pra rever/editar depois.

### Sincronização automática com Supabase (opcional)
IndexedDB local continua sendo a fonte principal — o app segue funcionando 100% sem sinal. Quem configurar (`supabase/LEIA-ME.md` tem o passo a passo) ganha backup na nuvem e uso em mais de um aparelho: toda gravação entra numa fila local e sobe sozinha assim que há conexão, com nova tentativa automática se a rede cair no meio.

### Correção de cache offline
O service worker estava sem 6 arquivos no cache, incluindo a ficha inteira — funcionava online (busca da rede), mas falharia numa abertura fria sem sinal, exatamente o cenário da academia. Corrigido e versão do cache subida.

### Correção de bug visual — cardio "sumido" na home
O card de Cardio existia e funcionava, mas ficava invisível: um `<select>` sem largura fixa empurrava o primeiro cartão do carrossel além da tela, comendo a "espiadinha" que indicaria que havia mais conteúdo pra rolar. Corrigido com `width: 100%` no seletor e uma proteção `min-width: 0` no CSS do carrossel.

---

## 5. Avisos permanentes (deste documento em diante)

- **O obstáculo ao peito não é o treino, é o déficit calórico.** Se a dieta ficar muito agressiva, nenhum ajuste de volume compensa.
- **Postura tratada aqui é o padrão simétrico** (ombros e pescoço pra frente). Assimetria real entre os lados pede avaliação de fisioterapeuta — o app não diagnostica isso.
- Este material é estrutura e lógica, não supervisão profissional — não substitui nutricionista nem personal trainer.
- `perfil.json.prioridades` é dado descritivo, não executável — a fonte de verdade pro motor é `protocolo.json.volumeSemanalPorFase`.

---

## 6. Rastreabilidade — commits desta sessão

1. `f998bbb` — Exercícios novos no catálogo + correção das faixas de volume mal declaradas
2. `513bb24` — A ficha prescrita de 4 semanas (`data/ficha.json`)
3. `4aa0326` — Ficha ligada nas telas de sessão/execução/fila
4. `9937dc2` — Postura, proteína e hidratação
5. `5401902` — Correção do cache offline do service worker
6. `f0a1b16` — Sincronização automática com Supabase
7. `b144414` — Perguntas diárias como popup

Cada um foi um Pull Request revisável (#2 a #5) antes de entrar no `main`.
