# Atualização de 24/09/2026 — Auditoria científica e correções do motor de treino

**Resumo:** a ficha prescrita em 23/08 estava boa, mas o app não executava o que ela mandava. Esta atualização corrige o motor e faz ajustes pontuais na ficha. Também registra erratas de afirmações anteriores que a literatura não sustenta. O relatório completo da auditoria (20 seções, com DOI/PMID) foi entregue à parte.

## 1. O que o app fazia de errado (confirmado nos dados reais do Supabase)

| Problema | Onde estava | Correção |
|---|---|---|
| A semana do bloco travava em 5: deload permanente depois do 28º dia (em 24/09 já estava assim) | `fichaFixa.calcularSemanaDoBloco` | Bloco de 7 semanas (6 de treino + 1 de deload) que recomeça sozinho. Em Config > Bloco de treino dá pra recomeçar ou antecipar o deload |
| Sugestão de carga com sinal invertido. Na prática virava a média das últimas 5 séries, e uma série leve puxava a carga pra baixo (remada baixa 25→20 kg, puxada 30→22,5 kg, pulley 23→19 kg) | `engine/cargas.js` (removido) | Dupla progressão de verdade (`engine/progressao.js`). Base = maior carga de trabalho da última sessão; sobe quando todas as séries chegam ao topo da faixa |
| Reps e RIR pré-preenchidos e gravados sem edição: 100% dos RIR iguais ao alvo, 96% das reps no topo da faixa | `screens/execucao.js` | Folha "Como foi a série?". O RIR vem vazio e é tocar nele que registra. "Foi aquecimento" grava a série à parte |
| Progressão, alertas, validação de RIR e deload reativo existiam só nos testes | `engine/*` sem uso | Card "Sinais do treino" na Início, deload sugerido e série extra suspensa quando há queda de desempenho |
| RIR semanal (3/2/2/1/4) e RIR do deload nunca aplicados. No deload, a tela pedia RIR 0 na extensora | `fichaFixa` + `execucao` | Um só RIR por exercício; semana 1 com +1 e sem falha; deload com +2 (mínimo 3) e sem falha |
| Deload cortava 60–67% das séries (`floor`), não 50% | `fichaFixa` | `ceil` |
| Cobertura comparava séries diretas com faixas em séries fracionadas: bíceps, deltoide posterior e tríceps "abaixo do alvo" por construção | `engine/cobertura.js` | Contagem fracionada calculada pelo catálogo; categoria "secundário" no protocolo |
| Readiness descontava por dia de descanso e por creatina de um dia só | `engine/readiness.js` | Os dois saíram do score |

## 2. Erratas (afirmações anteriores que a literatura não sustenta)

- **"Remmert 2025: ~11 séries fracionadas por sessão".** É preprint (SportRxiv), sem revisão por pares. Os próprios autores dizem que esse ponto **não é um teto**: é onde o ganho extra fica difícil de detectar. O limite de 8 séries diretas por sessão é heurística de tempo e fadiga, não limite fisiológico.
- **"Evidência de 2025: supino reto +11% na porção esternal, inclinado +11% na clavicular".** Não localizada no PubMed, no Europe PMC nem no SportRxiv. O que existe é Chaves 2020 (iniciantes, diferença em 1 de 3 pontos) e dados agudos. A rotação de ângulos continua sensata, mas a evidência é **limitada**.
- **"Puxar ≥ empurrar, proporção 1:1,8", "desenvolvimento piora a postura" e "a diferença aparece na posição do ombro em 6 a 8 semanas".** Nenhuma tem estudo por trás. Exercício muda o ângulo crânio-vertebral de forma modesta, com certeza baixa a muito baixa (Sheikhhoseini 2018; Carrasco-Uribarren 2026). A relação entre postura e dor é fraca. Tirar o desenvolvimento continua defensável, mas por gestão de volume: o supino já faz o deltoide anterior crescer.
- **"RIR subindo com a mesma carga → deload".** Está invertido: é sinal de que você ficou mais forte. Fadiga é reps ou RIR **caindo** com a mesma carga.
- **"A descida controlada é onde está a maior parte do estímulo; soltar o peso joga fora metade da série".** Alongar a excêntrica não aumenta a hipertrofia (Schoenfeld 2015; Amdi & King 2025). Controlar a descida é técnica e segurança.

## 3. O que mudou na ficha

| Dia | Mudança | Por quê |
|---|---|---|
| 1 | Crucifixo inverso → dia 3; sem cardio | Repetia a função do face pull logo em seguida; sessão em ~55 min |
| 2 | Remada curvada → puxada pegada fechada; face pull saiu; serrote e puxada com RIR 1 | Duas remadas seguidas com carga lombar; tração vertical dobra (3→6); face pull estava em dias seguidos |
| 3 | + crucifixo inverso; prancha opcional (2 séries); sem cardio | Deltoide posterior em D1 e D3, com 48 h entre eles; prancha não faz o abdômen crescer |
| 4 | Ordem hack → stiff → leg press → flexora → extensora → panturrilha; mesa flexora → **cadeira flexora sentada**; abdutora opcional (2 séries); extensora com encosto reclinado; stiff com RIR 2; sem cardio | Exercícios técnicos com você descansado; sentada +14% contra deitada +9% (Maeo 2021); reto femoral (Larsen 2025) |
| 5 | 2ª rosca martelo → **rosca inclinada supinada**; rosca de punho opcional (2 séries); cardio 15 min | Mais específica pro bíceps (Coratella 2023) |
| Todos | Ordem de corte na fila; peito e bíceps nunca são cortados | O corte "de baixo pra cima" deixou 16 dias sem série direta de bíceps |

**Volume por ciclo:** 89 → 77 séries (+6 opcionais). Peito e bíceps não mudaram.

**Catálogo:**
- leg press e agachamento não contam como posterior de coxa (Kubo 2019);
- remadas contam como deltoide posterior;
- desenvolvimento e elevação frontal contam como deltoide anterior;
- a mesa flexora deixou de ser marcada como "alongada";
- entraram a cadeira flexora sentada e a rosca inclinada.

## 4. Para quem já tem o app instalado

- A migração `migrarRevisaoAuditoria20260924` (`js/data/seed.js`) troca a ficha e o protocolo do banco pela revisão, e roda uma única vez.
- Ela só atua quando a ficha no banco é a versão anterior deste mesmo bloco, reconhecida pelo nome. Nunca mexe na ficha de outro perfil.
- Os ajustes de cadência feitos por você ficam guardados à parte e continuam valendo.
- **Pendência sua:** remedir a cintura. Os 62 cm do perfil não batem com 170 cm e 71 kg, e o app agora avisa isso em Evolução.
