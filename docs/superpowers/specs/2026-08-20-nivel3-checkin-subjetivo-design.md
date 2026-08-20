# Nível 3 (fatia 2) — Check-in Subjetivo por Sessão

## 1. Contexto e objetivo

`protocolo.json` já define, desde o início do projeto, guarda-corpos que
dependem de dados subjetivos que o app nunca coletou:

- `alertas.condicoes`: `"sequência de sessões com qualidade percebida <= 2"`
- `gatilhosDeloadReativo.condicoes`: `"dor articular ou tendínea
  persistente"`, `"queda de motivação, sono ruim ou irritabilidade
  sustentada"`, `"dor muscular ainda presente na sessão seguinte do mesmo
  músculo"`

Esta fatia constrói a coleta desses dados — um check-in rápido, opcional,
uma vez por dia de treino. A fatia seguinte (detecção de estagnação)
consome esses dados junto com `historicoSeries` para acionar os alertas
definidos em `protocolo.json`; esta fatia é só a coleta e o
armazenamento, sem nenhuma lógica de alerta ainda.

## 2. Campos do check-in

Um registro por dia (reaproveitando a store `registrosDiarios`, já
provisionada no schema desde a fundação do projeto, chave `data`, nunca
usada até agora):

- `qualidadePercebida` (número 1–5): "Como foi a sessão hoje, no geral?"
  — mapeia direto para o texto de `alertas` ("qualidade percebida <= 2").
- `bemEstarBaixo` (booleano): "Sono ruim, motivação baixa ou irritação
  sustentada hoje?" — um único campo combinado, porque
  `gatilhosDeloadReativo` já trata essas três coisas como uma condição
  OR única (`"queda de motivação, sono ruim ou irritabilidade
  sustentada"` é um item da lista, não três) — perguntar as três
  separadamente adicionaria atrito sem ganho de precisão que o próprio
  guarda-corpo já pede.
- `dorArticularOuTendinea` (booleano): "Alguma dor articular ou de
  tendão persistente?" — mapeia direto para
  `gatilhosDeloadReativo`.
- `domsPersistente` (booleano): "Ainda com dor muscular do treino
  anterior?" — mapeia direto para `gatilhosDeloadReativo`. Esta fatia
  não distingue QUAL músculo está dolorido (isso exigiria um seletor de
  músculos e uma correlação com a divisão do dia) — fica como um sinal
  de nível-dia, simplificação deliberada documentada aqui para a fatia
  de detecção de estagnação decidir se precisa de mais precisão.

Nenhum campo é obrigatório para logar séries de treino — o check-in é
puramente informativo, nunca bloqueia nem condiciona o resto do app
(guarda-corpo geral: nunca adicionar fricção ao registro básico de
treino).

## 3. Onde aparece na UI

Um card **"Check-in de hoje"** no topo da tela Treino, acima da lista de
exercícios (antes do primeiro card de exercício, não depois do resumo de
sessão que já fica no final).

- Se ainda não há check-in hoje: mostra o formulário compacto (seletor
  1–5, três checkboxes, botão Salvar).
- Se já há check-in hoje: mostra um resumo em uma linha (ex.: "Qualidade:
  4/5 · Sem dores relatadas") com um botão "Editar" que reabre o
  formulário com os valores atuais preenchidos.

## 4. Arquitetura

- `js/data/checkin.js` (novo):
  - `registrarCheckin(db, data, campos)`: lê o registro existente de
    `registrosDiarios` para `data` (via `get`, já exportado por
    `db.js`), mescla `campos` por cima dos valores existentes (nunca
    sobrescreve o registro inteiro), grava com `put`. A leitura-mesclagem
    é obrigatória porque `registrosDiarios` é uma store genérica de
    "um registro por dia" que outras fatias futuras (nutrição adaptativa)
    também vão usar — um `put` direto apagaria campos de outra fatia
    gravados no mesmo dia.
  - `getCheckin(db, data)`: retorna o registro do dia (via `get`) ou
    `undefined`.

- `js/screens/treino.js` (modificado): novo card + formulário no topo de
  `montarTelaTreino`, chamando `getCheckin`/`registrarCheckin`.

## 5. Casos de borda

- **Primeiro uso do app** (nenhum `registrosDiarios` ainda): `getCheckin`
  retorna `undefined`, formulário aparece vazio, normal.
- **Editar depois de já ter registrado**: `registrarCheckin` faz
  merge, então reabrir e salvar de novo apenas atualiza os campos do
  check-in, sem afetar outros campos que uma fatia futura (dieta) possa
  ter gravado no mesmo `registrosDiarios[data]`.
- **`qualidadePercebida` fora de 1–5**: o formulário usa um `<select>`
  com as 5 opções fixas, não um campo livre — não há como submeter um
  valor fora da faixa pela UI.

## 6. Fora de escopo

- Qualquer lógica de alerta/estagnação consumindo esses dados — fatia
  seguinte.
- Histórico visual dos check-ins ao longo do tempo — pode entrar na
  fatia de estagnação, que já vai precisar ler o histórico de qualquer
  forma para os cálculos.
- Distinguir dor muscular por músculo específico — ver nota no campo
  `domsPersistente` acima.
