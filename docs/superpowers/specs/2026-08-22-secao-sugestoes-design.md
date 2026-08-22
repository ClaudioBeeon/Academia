# Adendo — Seção "Sugestões" em Configurações

Nova seção dentro de Configurações, com duas partes: **itens interativos** (com check/registro) e **conteúdo informativo** (leitura, sem ação).

---

## Parte 1 — Itens interativos (o que ainda não entrava no app)

### Registro diário rápido (visível no dashboard/home, todo dia — inclusive dias de descanso)
Não fica escondido dentro da sessão de treino, porque esses hábitos acontecem em qualquer dia, não só em dia de treino.

- **Creatina hoje** — toggle simples (tomei / não tomei). Usuário já usa, quer lembrete — o app deve notificar/lembrar diariamente até o toggle ser marcado. Não precisa de dose ou horário, só o check binário.
- **Álcool hoje** — toggle simples (bebi / não bebi). Uso casual, sem julgamento no texto do app — é só dado, não é alerta de comportamento.
- **Sono de ontem** — escala simples de 3 níveis (bom / médio / ruim), não numérico, pra ser rápido de responder.

### Checklist de início de sessão (só em dias de treino)
- **Aquecimento feito** — checkbox simples antes do primeiro exercício composto do dia (1-2 séries leves antes de carregar de verdade). Não conta como exercício no volume, é só registro de hábito.

### Registro periódico (fora do fluxo diário)
- **Fotos + medidas (cintura)** — lembrete a cada 2 semanas pra tirar foto e medir cintura com fita métrica. Mais confiável que bioimpedância isolada pra acompanhar a pochete especificamente (ver seção informativa).

### Campo de reavaliação de fase (novo campo real, com lembrete)
- **Data de reavaliação da fase de recomposição** — campo de data em `perfil.json`, sugestão automática de **6-8 semanas a partir do início da fase atual**, editável pelo usuário.
- Quando a data chegar: notificação/lembrete pedindo pra revisar a tendência de bioimpedância + fotos das últimas semanas e decidir (manter fase, ajustar volume, trocar de fase). Nunca decide sozinho — só avisa e traz os dados prontos pra decisão.

---

## Parte 2 — Conexão com autorregulação (os checks precisam alimentar a lógica existente, não só ficar registrados)

A lógica de autorregulação já existente ("aderência boa + desempenho caindo → app aponta motivo provável, geralmente déficit") precisa considerar também os registros diários antes de apontar déficit como causa:

- **Desempenho caiu + sono marcado como "ruim" nos dias anteriores** → o app deve indicar sono como explicação provável, não déficit — evita o usuário achar que precisa comer mais ou menos quando o problema é outro.
- **Desempenho caiu + álcool registrado no dia anterior ou no mesmo dia** → mesma lógica, apontar como fator provável.
- **Vários dias seguidos sem creatina registrada + estagnação em força** (não hipertrofia — o efeito de creatina é mais sobre desempenho/força que sobre estética direta) → o app pode mencionar isso como fator possível, sem exagerar a importância (é auxiliar, não determinante).
- **Prioridade de causa quando há mais de um fator marcado no mesmo período:** sono e álcool devem ser mencionados antes de déficit, porque são mais fáceis de corrigir rápido e não exigem reavaliar a dieta toda. Só apontar déficit como causa principal se não houver nenhum desses fatores registrados no período.

Esses registros diários devem ficar num arquivo próprio (ex: `habitos.json`, indexado por data), separado de `dieta.json` e `cargas.json`, pra manter a mesma lógica de responsabilidade única já usada no resto do protocolo.

---

## Parte 3 — Conteúdo informativo da seção (leitura, sem check — mas deve estar acessível dentro do mesmo lugar em Configurações)

Incluir como texto de referência, sem interatividade:

- **Curiosidades contra-intuitivas** da pesquisa (frequência não é "mais estímulo", carga não precisa ser pesada, máquina não é inferior, abdômen isolado não define barriga, falha total não é comprovadamente melhor que quase-falha)
- **Raciocínio por trás das escolhas principais** do app (por que déficit moderado, por que peito em volume intermediário, por que bíceps virou prioridade 2, por que IA só interpreta e não decide, por que PWA, por que abdômen nunca vira dia isolado)
- **Expectativa de tempo realista**: mudanças visíveis costumam levar 8-12 semanas; força sobe mais rápido que estética no início (adaptação neural); bioimpedância oscila por água, só tendência de 3-4 semanas conta; manter rotina por 4 semanas seguidas já é resultado mensurável, dado o histórico de pouca consistência do usuário

Esse conteúdo pode ser estático (texto fixo), não precisa vir do protocolo.json — é explicativo, não é regra que muda o comportamento do app.

---

## Resumo pro Claude Code
- Nova seção "Sugestões" dentro de Configurações
- Registro diário rápido no dashboard (creatina, álcool, sono) — todo dia, não só em treino
- Checklist de aquecimento só em dia de treino
- Lembrete periódico de fotos/medidas (2 em 2 semanas)
- Campo real de data de reavaliação de fase, com lembrete automático
- Novos registros (`habitos.json`) devem alimentar a autorregulação existente, com prioridade: sono/álcool antes de déficit como explicação de queda de desempenho
- Conteúdo informativo (curiosidades, raciocínio, expectativa de tempo) fica na mesma seção, só como leitura
