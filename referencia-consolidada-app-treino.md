# Documento de Referência Consolidado — App de Treino e Nutrição

**Este arquivo é a fonte de verdade acumulada.** Junta a base científica original, todas as correções feitas durante o desenvolvimento, e a estrutura de treino final. Deve ser consultado pelo Claude Code sempre que houver dúvida sobre por que uma regra existe.

> **Atualização de 23/08/2026:** a divisão de 5 dias descrita na seção 4 abaixo foi substituída por uma ficha prescrita (`data/ficha.json`), depois de uma auditoria encontrar prioridade invertida e desequilíbrio empurra-puxa no gerador. Ver `atualizacao-2026-08-23-auditoria-e-ficha-prescrita.md` pro pacote completo — o que mudou, por quê, e o que a literatura mais recente trouxe de novo. Este arquivo continua valendo como histórico de decisões e princípios; a estrutura de dias em números está desatualizada.

---

## 1. Perfil e objetivos

- 1,70m / 71kg / ~20% de gordura corporal
- +2 anos de treino, mas histórico pouco consistente — mais cardio que musculação até aqui
- 45-60 min por sessão em dias normais, mais tempo disponível nos dias 4 e 5 (fim de semana)
- **Prioridade 1:** perder gordura abdominal ("pochete") — resolvido pela dieta, não pelo treino
- **Prioridade 2:** hipertrofia de peito
- **Prioridade 3:** hipertrofia de bíceps
- Demais músculos (costas, tríceps, ombro, pernas): volume de manutenção/secundário

**Regra permanente, não-negociável:** não existe perda de gordura localizada. Nenhuma quantidade de exercício de abdômen ou frequência de treino "manda" o corpo perder gordura numa região específica. A pochete responde só ao déficit calórico sustentado — em homens costuma ser a última área a ceder. O treino serve pra construir músculo e proteger massa magra enquanto isso acontece, não para "queimar" a barriga diretamente.

---

## 2. Princípios científicos que sustentam o app (resumo da pesquisa original)

Fonte: meta-análises, revisões sistemáticas e posicionamentos ACSM. Nível de confiança indicado em cada item.

| Princípio | Evidência | Implicação prática |
|---|---|---|
| Volume semanal é o principal driver de hipertrofia e força | Alta — meta-regressão Pelland 2026, 67 estudos, 100% de probabilidade de efeito positivo do volume | Séries semanais por músculo é a variável central do protocolo, não frequência nem número de exercícios |
| Frequência por músculo tem efeito ~nulo na hipertrofia quando volume é igual | Alta | Frequência serve pra **distribuir** volume com qualidade (menos fadiga acumulada por sessão), não é estímulo extra por si só |
| Carga (%1RM) não muda hipertrofia entre faixas altas e baixas (ex: acima/abaixo de 60% 1RM) | Alta — efeito ~0,03 | 10-15 repetições com esforço real entrega resultado equivalente a cargas pesadas — coerente com preferência do usuário por não pegar muito pesado |
| Proximidade da falha (RIR baixo) aumenta hipertrofia; força se mantém estável numa faixa ampla de RIR | Alta | Zona de 1-2 RIR captura quase todo o benefício, sem precisar de falha total |
| Máquinas não são inferiores a pesos livres para hipertrofia | Alta — nenhuma diferença detectada | Escolha de equipamento é preferência, não fator limitante |
| Ordem dos exercícios não muda hipertrofia, mas muda força — exercício feito primeiro ganha mais força | Alta (Nunes 2021) | Peito (prioridade) sempre entra primeiro na sessão, com o músculo mais fresco. Quando um músculo tem 2+ exercícios no mesmo dia, agrupar (não intercalar com outro grupo muscular) |
| Cardio concorrente não reduz força máxima nem hipertrofia de forma relevante; reduz mais a força explosiva (~28%), sobretudo na mesma sessão | Moderada — Schumann 2022, 43 estudos | Bike/caminhada interferem menos que corrida; separar cardio intenso do treino de força quando possível |
| Exercício de abdômen segmentado não reduz gordura abdominal localizada | Alta — meta-análise 2022, >1.000 participantes; estudo clássico 2011 (7 exercícios, 5x/semana, 6 semanas: sem mudança em gordura abdominal, circunferência ou gordura total) | Nunca alocar um dia inteiro só de abdômen; abdômen entra como volume de manutenção dentro de outro dia |
| Recomposição corporal (crescer músculo + perder gordura ao mesmo tempo) é viável sob certas condições | Moderada | Favorecida por: % de gordura mais alto (usuário tem 20%, ajuda), histórico de treino pouco consistente (mais "ganho fácil" disponível), déficit **moderado** (não agressivo), proteína adequada. Déficit muito agressivo tende a sacrificar massa magra em vez de só gordura |

**Faixas de volume semanal por músculo (referência):**
- Manutenção: 6-9 séries/semana
- Recomposição (déficit moderado, crescimento parcial): 9-15 séries/semana
- Hipertrofia plena: 15-20 séries/semana

---

## 3. Bugs e correções já feitas (não repetir)

1. **Bug de volume de peito:** o sistema tinha uma tag de "manutenção" que nunca restringia nada de fato — gerava 2 exercícios de peito/dia (18 séries/semana), volume de hipertrofia disfarçado de manutenção. **Correção:** número de exercícios/séries por músculo deve ser calculado a partir da faixa-alvo de volume da fase ativa no protocolo.json (fórmula: volume-alvo ÷ frequência ÷ séries-por-exercício), nunca um número fixo hardcoded no código.
2. **Bug de repetição de ângulo:** os 3 dias de peito estavam repetindo o mesmo exercício (ex: crucifixo no cabo nos 3 dias), sem rotacionar pelos 3 ângulos (inclinado/horizontal/alongado). **Correção:** contador único e sincronizado entre os 3 dias de peito, aplicado na ordem em que os dias aparecem na semana.
3. **Bug de ordenação:** exercícios de peito e tríceps intercalados (peito-tríceps-peito-tríceps) em vez de agrupados. **Correção:** quando um músculo prioritário tem 2+ exercícios no mesmo dia com um secundário, a ordem correta é todos os do prioritário primeiro, depois o secundário — nunca intercalado. Base: o estudo que embasa "ordem não importa" (Nunes 2021) é sobre hipertrofia; o mesmo estudo mostra que força é sensível a ordem, e foi esse achado que motivou a regra.
4. **Teto por sessão (P3) coexiste com a fórmula de volume, não compete com ela:** máximo de ~2 exercícios por músculo por sessão é um limite de qualidade (a pesquisa mostra queda de qualidade depois disso), independente de quanto volume semanal ainda falta bater. Se um músculo precisar de mais séries do que cabe com qualidade numa sessão, a resposta é replanejar frequência (mais dias), não estourar o teto por sessão.

---

## 4. Estrutura semanal de treino — versão final (5 dias)

**Fase atual: Recomposição corporal** (déficit calórico moderado + peito em volume intermediário)

| Dia | Foco | Nº exercícios | Cardio do dia |
|---|---|---|---|
| 1 | Peito (inclinado) + Tríceps + acessórios | 6 | Moderado 15-20min (bike/esteira) |
| 2 | Costas + **Bíceps (foco)** + Ombro | 6 | Moderado 15-20min (escada/bike) |
| 3 | Peito (horizontal) + Tríceps + Ombro | 6 | Moderado 15-20min (esteira) |
| 4 | Pernas + Abdômen | 7 | Leve/opcional (poupar pernas) |
| 5 | Peito (alongado) + **Bíceps (foco)** + Ombro | 6 | Moderado 20-25min (mais tempo disponível) |
| 6/7 (descanso) | — | — | Caminhada livre, sem restrição |

### Regras fixas da estrutura
- Peito: 3x/semana, **1 exercício por dia** (não aumenta o número de exercícios — aumenta séries por exercício conforme a fase), sempre primeiro na sessão, ≥48h entre sessões
- Peito, fase recomposição: **9-15 séries/semana** → ~4-5 séries por exercício (era 6-9 séries/semana / ~3 séries na fase de manutenção pura, antes do ajuste de dieta)
- Bíceps: prioridade 2, ~15 séries/semana, 2 dias de foco direto (dia 2 com 3 exercícios, dia 5 com 2), bem espaçados
- Tríceps: ~15 séries/semana somando indireto (peito) + direto — reduzir se sinal de fadiga
- Ombro: ~9 séries/semana, direto, sem competir com peito/bíceps
- Costas e pernas: manutenção, 1x/semana cada
- Sem dia isolado de abdômen — sempre embutido em outro dia (preferencialmente pernas, que tem mais folga)
- Mínimo 6 exercícios/dia é **piso prático** (tempo + prioridades), não regra com comprovação científica própria — a variável que a pesquisa sustenta é volume semanal por músculo, não contagem de exercícios. Não forçar 6 se o volume-alvo de um músculo já foi coberto com menos.

### Detalhamento por dia

**Dia 1 — Peito + Tríceps**
1. Peito — inclinado (4-5 séries)
2. Tríceps — isolador 1
3. Tríceps — isolador 2
4. Face pull / deltoide posterior
5. Antebraço/pegada
6. Abdômen — manutenção

**Dia 2 — Costas + Bíceps (foco)**
1. Costas — puxada
2. Costas — remada
3. Bíceps — rosca direta
4. Bíceps — rosca alternada ou martelo
5. Bíceps — rosca scott ou concentrada
6. Ombro — deltoide posterior

**Dia 3 — Peito + Tríceps + Ombro**
1. Peito — horizontal/reto (4-5 séries)
2. Tríceps — isolador 1
3. Tríceps — isolador 2
4. Ombro — lateral
5. Ombro — frontal
6. Abdômen — manutenção

**Dia 4 — Pernas + Abdômen** (fim de semana, mais tempo)
1. Quadríceps — composto
2. Posterior — composto (RDL)
3. Glúteo
4. Quadríceps — isolador
5. Posterior — isolador/flexora
6. Panturrilha
7. Abdômen — manutenção

**Dia 5 — Peito + Bíceps (foco) + Ombro** (fim de semana, mais tempo)
1. Peito — alongado, ex: crucifixo no cabo (4-5 séries)
2. Bíceps — composto
3. Bíceps — isolador
4. Tríceps — isolador
5. Ombro — lateral
6. Abdômen — manutenção

### Autorregulação do volume de peito (dentro de 9-15 séries/semana)
- Desempenho subindo + aderência boa → aproxima de 15
- Desempenho estagnando/caindo mesmo com aderência boa → aproxima de 9 (déficit competindo com recuperação)
- Bioimpedância: gordura abdominal caindo + massa magra estável/subindo → fase funcionando, manter ou subir
- Massa magra caindo junto com gordura → alerta, reavaliar dieta antes de reavaliar treino

### Ponto de atenção
Histórico de pouca consistência + 5 dias de treino + cardio quase diário + bíceps em volume alto: risco de carga total (treino + cardio + déficit) pesada demais pra manter consistência. Se fadiga acumular, reduzir cardio antes de reduzir treino.

---

## 5. Descanso entre séries, dias de descanso e proximidade da falha (RIR)

### Dias de descanso na semana
2 dias livres (dia 6 e 7) são suficientes — não é preciso mais. Cada músculo prioritário (peito, bíceps) já tem ≥48h de intervalo entre sessões dentro da própria semana de treino, que é a janela mínima sustentada pela literatura para recuperação entre estímulos do mesmo músculo. Recuperação é por músculo, não por "descanso geral do corpo" — o espaçamento da divisão já cobre isso.

### Tempo de descanso entre séries (app deve aplicar por tipo de exercício)
- **Exercícios compostos** (agachamento, supino, remada, puxada, RDL, leg press): **2-3 minutos**. Descanso mais longo sustenta mais qualidade nas séries seguintes, permitindo mais volume total de qualidade na sessão.
- **Exercícios isoladores** (rosca, elevação lateral, tríceps pulley, cadeira extensora, panturrilha): **60-90 segundos**. Fadiga sistêmica menor, recuperação mais rápida entre séries.
- Cada exercício no protocolo.json deve ter uma tag `tipo: composto | isolador` que define automaticamente o tempo de descanso padrão sugerido pelo cronômetro — o usuário pode ajustar manualmente, mas o padrão já vem certo sem precisar configurar toda vez.

### Carga vs. esforço — não são a mesma variável
- **Carga (quanto peso):** pode ser sempre moderada. Confirmado pela pesquisa — hipertrofia é equivalente entre cargas altas e baixas quando o esforço da série é real. Compatível com preferência do usuário por não pegar pesado.
- **Esforço (proximidade da falha):** aqui não tem contorno — precisa ser real em toda série de trabalho. Série feita "sobrando muito" (RIR 4+) reduz hipertrofia de forma consistente na literatura, independente da carga usada.
- **Regra prática para o app:** série de trabalho deve terminar em **RIR 1-2** (sobrando 1-3 repetições). Não precisa contagem rigorosa — o app pode perguntar "quanto sobrava?" como campo simples (0, 1-2, 3-4, 5+) em vez de RIR numérico exato, mais fácil de reportar no dia a dia.

### Falha total — o que a evidência sustenta e o que não sustenta
- **Bem estabelecido:** treinar perto da falha (RIR 0-2) aumenta hipertrofia comparado a treinar longe dela (RIR 4+).
- **Não bem estabelecido:** que falha total (RIR 0, literalmente sem conseguir mais uma repetição) seja superior a "quase falha" (RIR 1-2). A diferença é pequena ou nula nos estudos, e o custo de fadiga da falha total é maior — compromete recuperação pra sessão seguinte.
- **Regra prática:** falha total (RIR 0), quando usada, fica restrita à **última série do exercício**, e preferencialmente em **isoladores** (menor risco técnico). Em compostos pesados (agachamento, supino, remada), evitar falha literal — o risco técnico não compensa o ganho marginal sobre "quase falha".
- O app não deve pedir ou incentivar falha total como padrão em toda sessão — é exceção pontual, não regra geral.

## 6. Regras de cardio

- Caminhada / intensidade baixa: diária, sem restrição, inclusive em dias de treino
- Cardio moderado/intenso: 3-4x/semana (na prática, 4 dos 5 dias de treino têm cardio moderado embutido — ver tabela da seção 4), priorizando bike/elíptico/escada sobre corrida (menos dano muscular, menos interferência)
- Evitar cardio intenso no dia de pernas (único dia de recuperação daquele grupo) — leve ou opcional nesse dia
- Se cardio e musculação no mesmo dia: musculação primeiro
- Espalhar cardio ao longo da semana é melhor que concentrar num dia só — tanto pra sustentar o déficit quanto pra não acumular fadiga de uma vez

---

## 7. Dieta

### Dieta original registrada (referência histórica — não é a atual)
- Café da manhã: 2 bananas e 4 morangos médios
- Almoço: 3 bifes de frango
- Café da tarde: whey ou 1 banana e 3 morangos
- Janta: 3 ovos cozidos ou omelete, ou 1 pão e 2 ovos mexidos/fritos
- Estimativa: ~1.100-1.400 kcal/dia — déficit de ~40-50% sobre o gasto estimado (~2.200-2.400 kcal), sem gordura relevante e sem fibra/vegetais

### Ajuste em andamento
Usuário migrando para **déficit moderado**, com adições: batata-doce, salada, fibras. Ainda sem os números finais definidos — recomendação permanece de validar quantidades com nutricionista.

### Regras para o módulo de dieta do app
- Modelo de registro por exceção: dieta-base é assumida cumprida por padrão; usuário só marca o que fugiu (desmarca o que não comeu, adiciona o que comeu a mais)
- Checagem em 3 eixos, sempre como sinalização explicada — nunca como reescrita automática da dieta: (1) calorias vs. meta, (2) gordura mínima, (3) fibra/variedade
- App não prescreve dieta nova, só sinaliza e sugere direções gerais
- Déficit muito agressivo prejudica preservação de massa magra e sustentabilidade — sinalizar isso quando detectado, com explicação, não como bloqueio
- Piso calórico de segurança obrigatório no protocolo — o app deve alertar antes de aceitar qualquer número abaixo dele
- Conexão treino ↔ dieta é indireta, via capacidade de recuperação, nunca direta:
  - Aderência boa + desempenho subindo → libera aumento de volume
  - Déficit consistente + desempenho caindo → não aumenta volume, e o app explica que o motivo provável é o déficit, não falta de esforço
  - Proteína abaixo da meta com frequência → alerta (em déficit, é o que mais custa massa magra)
- Nunca sugerir "compensar" comida com cardio extra
- Nunca tratar um dia acima da meta como falha — o dado que importa é a tendência de semanas, não um dia isolado
- MacroFactor como referência conceitual: estimar gasto energético real a partir da tendência de peso cruzada com ingestão, recalibrando a meta semanalmente — não fórmula fixa que nunca muda

---

## 8. Arquitetura do app

- **PWA no GitHub Pages** (não app nativo) — decisão fechada. App nativo exigiria Mac + Xcode + conta de desenvolvedor Apple (US$99/ano), sem ganho relevante pro caso de uso pessoal
- Três camadas: pesquisa (`base-cientifica-hipertrofia-forca.md`, o porquê) → protocolo (`protocolo.json`, as regras em números, versionado) → código (só executa o que o protocolo manda)
- Arquivos de estado: `perfil.json` (fase ativa, dados pessoais), `protocolo.json` (regras de treino), `cargas.json` (memória de carga por exercício), `dieta.json` (dieta base e exceções)
- Mesociclo de 5 semanas: volume subindo e RIR descendo da semana 1 à 4, deload na 5. Deload reativo tem prioridade sobre o calendário se desempenho cair antes
- Cada regra do protocolo deve apontar pra seção da pesquisa que a justifica — nada sem explicação rastreável
- Construção em 3 níveis (essencial → diferencial → autorregulação e nutrição adaptativa), inspirado em padrões de mercado (Hevy, Strong, RP Hypertrophy, MacroFactor) mas com lógica auditável — nunca caixa-preta
- Memória de carga por exercício: cada relato de peso+dificuldade vira ponto numa curva esforço×carga pessoal; sugestões pra exercícios novos usam semelhança de padrão de movimento/grupo muscular, sempre marcadas com nível de confiança (baixa/média/alta), nunca como número definitivo
- **Camada de IA — só interface, nunca decisão:** interpretar comida em texto livre, escrever revisão semanal, sugerir substituição de exercício, responder perguntas sobre histórico, ajudar a cadastrar dieta. Decisões de volume/progressão/deload/meta calórica continuam 100% determinísticas no protocolo.json — auditáveis e reproduzíveis. Alimentos confirmados uma vez viram entrada salva localmente, reduzindo dependência de IA ao longo do tempo
- App precisa funcionar 100% sem IA (sem sinal, API fora do ar, chave expirada não podem impedir registro de treino)
- Chave de API do usuário fica salva só no navegador (localStorage), nunca no repositório — `.gitignore` desde o primeiro commit, já que o app é estático (sem servidor pra esconder chave)
- Cronômetro: contagem regressiva na tela, alerta sonoro, vibração, Wake Lock pra manter tela ligada durante descanso. Notificação correndo na tela bloqueada (Live Activity) não é possível em PWA — limitação aceita, não é requisito
- Cronômetro de descanso deve iniciar automaticamente ao concluir uma série, com duração padrão definida pelo tipo do exercício (composto: 2-3min · isolador: 60-90s — ver seção 5), sem exigir configuração manual a cada série. Usuário pode ajustar o tempo padrão por exercício, e o ajuste fica salvo pra próxima vez
- Relatório de sessão (100% determinístico, sem IA): timestamps de início/fim, cada descanso comparado ao prescrito (sem travar o usuário, só registra a diferença), pergunta de intensidade percebida (1-5) no final alimentando a autorregulação, resumo final com duração total, tempo execução vs. descanso, descansos que passaram do tempo, volume, PRs
- Export em JSON do histórico é necessário como backup — iOS pode descartar dados de apps web sem uso prolongado
- Funcionalidades citadas como padrão de mercado a incluir: log rápido com valores da sessão anterior pré-preenchidos (prioridade máxima — é o que mais gera abandono quando ausente), cronômetro de descanso configurável por exercício, calculadora de anilhas, gerador de aquecimento, notificação de PR na hora
- Fora do escopo, deliberadamente: rede social, gamificação, streaks, contagem obsessiva de comida
- Ideia registrada, ainda não implementada: vídeo (YouTube/TikTok) de execução do exercício, bem avaliado, anexado por exercício — pesquisar viabilidade depois

---

## 9. Avisos permanentes (repetir sempre que relevante)
- Este material não substitui acompanhamento de nutricionista ou personal trainer — é estrutura e lógica, não supervisão profissional
- Déficit calórico agressivo não acelera perda de gordura além de certo ponto — acelera perda de peso (água + massa magra junto com gordura), o oposto do que preserva o objetivo de peito
- Dieta muito restritiva tende a ter baixa adesão a longo prazo e risco de efeito rebote — moderada e sustentável entrega mais resultado real que severa e abandonada
