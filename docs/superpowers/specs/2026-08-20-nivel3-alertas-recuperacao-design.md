# Nível 3 (fatia 3) — Alertas de Recuperação (Gatilhos de Deload Reativo)

## 1. Contexto e objetivo

Com o check-in subjetivo (fatia 2) já coletando dados, esta fatia
implementa a primeira metade dos guarda-corpos de `protocolo.json` que
dependiam desses dados: `gatilhosDeloadReativo` (quando sugerir um
deload) mais o item de `alertas` sobre qualidade percebida em sequência.

**Escopo deliberadamente menor que "todos os alertas de protocolo.json".**
`protocolo.json.alertas` tem 5 condições; só uma delas
("sequência de sessões com qualidade percebida <= 2") depende só do
check-in. As outras quatro (volume fora da faixa, mais de 8 séries por
sessão, ausência de progressão em 4+ semanas) dependem de agregações
sobre `historicoSeries` que ainda não existem (volume semanal comparado
contra faixa-alvo, contagem de séries diretas por sessão, tendência de
carga ao longo de várias semanas) — cada uma é seu próprio pedaço de
trabalho não-trivial. Ficam para uma fatia futura ("alertas de
desempenho/programação"), citada explicitamente aqui para não se perder.

Esta fatia cobre as 4 condições de `gatilhosDeloadReativo` que já têm
todos os dados necessários prontos (check-in, fatia 2):

- `"dor articular ou tendínea persistente"`
- `"dor muscular ainda presente na sessão seguinte do mesmo músculo"`
- `"queda de motivação, sono ruim ou irritabilidade sustentada"`
- (mais o item de `alertas`) `"sequência de sessões com qualidade
  percebida <= 2"`

As outras duas condições de `gatilhosDeloadReativo` (`"desempenho caindo
em 2+ sessões consecutivas com o mesmo peso"`, `"RIR percebido subindo
sem mudança de carga"`) dependem de comparação de sessões em
`historicoSeries` por exercício — mesma categoria de trabalho da fatia
futura de alertas de desempenho, citadas aqui e adiadas junto.

## 2. Regras e limiares (rulings explícitos, onde protocolo.json não dá um número exato)

- **Dor articular/tendínea, DOMS persistente**: disparam a partir do
  check-in mais recente (hoje), sem exigir sequência — `protocolo.json`
  já usa a palavra "persistente" no próprio nome do campo do check-in
  (`dorArticularOuTendinea`, `domsPersistente`), então um "sim" já
  representa a condição relatada pelo usuário como persistente.
- **"Sono ruim, motivação baixa ou irritabilidade sustentada"**:
  `protocolo.json` usa "sustentada", que pede mais que um único dia, mas
  não dá um número. Ruling: 3 check-ins mais recentes consecutivos, todos
  com `bemEstarBaixo = true`. Custo se errado: um limiar arbitrário —
  fácil de ajustar depois se o usuário achar 3 dias cedo ou tarde demais.
- **"Sequência de sessões com qualidade percebida <= 2"**: "sequência"
  no plural pede pelo menos 2. Ruling: 2 check-ins mais recentes
  consecutivos, ambos com `qualidadePercebida <= 2` — mesmo padrão que
  `progressao.js` já usa para "abaixo do mínimo em 2 sessões
  consecutivas".

## 3. Arquitetura

- `js/data/checkin.js` (modificado): nova função
  `getCheckinsRecentes(db, limite = 14)` — retorna os registros de
  `registrosDiarios` que representam check-ins de verdade (têm
  `qualidadePercebida !== undefined`, distinguindo de um registro
  gravado por uma fatia futura não relacionada, mesmo padrão de
  discriminação já usado na correção final da fatia 2), ordenados por
  data decrescente, limitados a `limite`.

- `js/engine/alertasRecuperacao.js` (novo, motor puro): 
  `avaliarAlertasRecuperacao(checkinsRecentes)` — recebe o array já
  ordenado (mais recente primeiro) e retorna uma lista de alertas
  `{ tipo, mensagem, principio }`. Vazio quando nenhuma condição dispara.
  Nunca sugere uma ação automática — só descreve a condição encontrada,
  em texto educativo, consistente com o guarda-corpo "IA nunca decide
  séries, carga, RIR ou deload".

- `js/screens/divisao.js` (modificado): nova seção "Alertas" no topo da
  tela (acima do card "Hoje: Superior/Inferior"), mostrando cada alerta
  retornado por `avaliarAlertasRecuperacao`. Quando a lista vem vazia,
  a seção inteira não é renderizada (sem "tudo certo, sem alertas" — seguindo
  o padrão já estabelecido em outras telas do projeto de omitir seções sem
  dado, em vez de mostrar reforço positivo desnecessário).

## 4. Casos de borda

- **Menos de 2 ou 3 check-ins no histórico**: as condições que exigem
  sequência (bem-estar sustentado, qualidade em sequência) simplesmente
  não disparam — não há dado suficiente, e o motor trata isso como "sem
  alerta", não como erro.
- **Check-ins não consecutivos no tempo** (ex.: usuário pulou um dia sem
  treinar): `checkinsRecentes` só contém dias em que houve check-in — um
  "hiato" de dias sem check-in não quebra a lógica de sequência, porque a
  sequência é sobre os check-ins mais recentes por ORDEM, não por
  data-consecutiva-no-calendário. Isso é uma simplificação deliberada
  (documentada aqui): dois check-ins com 5 dias de intervalo entre eles
  ainda contam como "2 consecutivos" para o motor, mesmo não sendo dias
  seguidos. Aceitável porque o app já assume 1 sessão ≈ 1 check-in por
  dia de treino, não por dia corrido.

## 5. Fora de escopo

- As duas condições de `gatilhosDeloadReativo` baseadas em
  `historicoSeries` (desempenho caindo, RIR subindo sem mudança de
  carga) — fatia futura.
- As 4 condições de `alertas` baseadas em volume/programação — fatia
  futura.
- Qualquer ação automática (aplicar deload, reduzir volume) — os
  alertas são sempre só informativos.
