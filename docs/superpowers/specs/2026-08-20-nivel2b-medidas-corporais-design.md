# Nível 2b (fatia 2) — Medidas Corporais — Design

Data: 2026-08-20
Status: aprovado pelo usuário em chat ("pode seguir com todos já")

## 1. Contexto e objetivo

Segunda fatia independente do Nível 2b (ver
`docs/superpowers/specs/2026-08-20-nivel2b-graficos-progressao-design.md`
seção 1 para o contexto das quatro fatias). Esta cobre **medidas
corporais**: peso, cintura e % de gordura (bioimpedância) ao longo do
tempo, com uma forma de o usuário registrar novos pontos e ver a tendência.

O perfil original (`data/perfil.json`) já modela isso parcialmente:
`composicaoCorporal.historico` (array de `{data, percentualGordura, origem,
confianca, obs}`) e `medidas.cintura_cm.historico` (mesmo formato, campo
`valor`) já existem como séries temporais com um ponto inicial cada
(2026-08-19). Peso (`dadosBasicos.peso_kg`) é hoje um valor único, sem
histórico. Esta fatia dá ao usuário uma forma de acrescentar pontos novos a
essas três métricas e visualizar a tendência — sem tocar no mecanismo de
seed/reseed do perfil (ver seção 3, é o risco central deste design).

## 2. Escopo

Dentro desta fatia:

- Registrar um novo ponto de medida (data + peso opcional + cintura
  opcional + % gordura opcional, pelo menos um preenchido) a partir da
  tela.
- Ver a tendência de cada métrica (peso, cintura, % gordura) como um
  gráfico de linha, reaproveitando o padrão de gráfico já construído na
  fatia 1 (Evolução → progressão de carga).
- Preservar os pontos iniciais que já existem em `perfil.json` como o
  primeiro ponto de cada série.

Fora de escopo:

- Fotos de progresso (mencionadas no prompt original como possibilidade,
  não pedidas explicitamente para esta fatia).
- Qualquer sugestão automática de mudança de fase a partir da tendência
  (o perfil já documenta que isso é "sempre uma sugestão... nunca uma
  troca automática" — matéria da camada de IA, não desta fatia).
- Edição ou exclusão de um ponto já registrado (só adicionar; se o
  usuário errar um valor, decide depois se quer isso — não pedido agora).

## 3. Risco central: não reusar o mecanismo de seed do perfil

`js/data/seed.js:23` faz `await put(db, "perfil", perfil)` **sempre que a
função de seed decide re-semear** (guarda: `protocolo.versao` mudou desde
a última vez — ver `seed.js:18-21`). Isso sobrescreve o documento inteiro
de `perfil`. Diferente de `exercicios`, que já tem lógica de merge
(`seed.js:26-33`, preserva `observacoesExecucao` do usuário), `perfil` não
tem merge nenhum. Se esta fatia acrescentasse os pontos novos dentro do
próprio documento `perfil` (nos arrays `historico`), qualquer reseed futuro
disparado por uma mudança de protocolo **apagaria silenciosamente todo
histórico de medidas que o usuário registrou**.

**Decisão:** os pontos registrados pelo usuário vivem numa store nova e
independente do IndexedDB, `medidasCorporais`, nunca dentro do documento
`perfil`. Isso segue o mesmo princípio já usado em `js/data/equipamento.js`
(dados editáveis pelo usuário ficam fora do que o seed sobrescreve) e evita
tocar em `seed.js` — terreno frágil, um bug ali afeta todo o app.

## 4. Arquitetura

```
data/perfil.json (semente, só leitura — ponto inicial de cada métrica)
        │  (lido uma única vez, no bootstrap da store nova)
        ▼
js/data/medidas.js
  - getMedidas(db) → array de linhas já mescladas (semente + registradas)
  - registrarMedida(db, {data, peso_kg?, cintura_cm?, percentualGordura?})
        │
        ▼
js/engine/medidas.js  (puro — extrai uma série por métrica)
  - prepararSerieTemporal(linhas, campo) → Array<{data, valor}>
        │
        ▼
js/screens/evolucao.js  (ganha uma 3ª seção, reaproveita o line-chart)
```

Nova store no IndexedDB: `medidasCorporais`, `keyPath: "id"`,
`autoIncrement: true`, índice em `"data"` (mesmo padrão de
`historicoSeries`). Bump de `DB_VERSION` em `js/data/db.js` (2 → 3), mesmo
mecanismo não-destrutivo já usado para adicionar stores em versões
anteriores (`db.js:22-34` já lida com "loja não existe → cria").

### `js/data/medidas.js`

- `getMedidas(db)` — lê todas as linhas de `medidasCorporais` via
  `getAll`. Na primeira chamada em que a store está vazia, faz um
  bootstrap único: lê o documento `perfil` já salvo (`get(db, "perfil",
  "1.0")` — **nota de implementação:** confirmar a chave real do
  `perfil` store durante o plano, ver `js/data/db.js:5` (`perfil:
  "versao"`) — a chave é o valor do campo `versao` do documento, hoje
  `"1.0"`), monta UMA linha combinando o ponto inicial de cada métrica
  (`dadosBasicos.peso_kg`, `composicaoCorporal.historico[0]`,
  `medidas.cintura_cm.historico[0]`, todos datados
  `perfil.dataAtualizacao` já que compartilham a mesma data na semente
  atual) e grava essa linha em `medidasCorporais` antes de retornar.
  Chamadas seguintes só leem o que já está na store (o bootstrap não se
  repete — a store deixa de estar vazia após a primeira chamada).
- `registrarMedida(db, { data, peso_kg, cintura_cm, percentualGordura })`
  — grava uma nova linha via `put`. Campos ausentes ficam `undefined`
  (não gravar `null`, `undefined` não aparece na linha resultante do
  IndexedDB — mesma convenção livre de `historicoSeries`, onde nem toda
  linha tem todo campo).

### `js/engine/medidas.js` (motor puro)

- `prepararSerieTemporal(linhas, campo)` — filtra linhas onde
  `linha[campo] != null`, mapeia para `{ data: linha.data, valor:
  linha[campo] }`, ordena por `data` ascendente (mesmo `localeCompare` já
  usado em `calcularProgressao1RM`). Uma função genérica, reaproveitada
  para as três métricas (`peso_kg`, `cintura_cm`, `percentualGordura`) —
  evita triplicar a mesma lógica de filtro+ordenação.

### `js/screens/evolucao.js` (seção nova + refactor pequeno)

- Nova seção "Medidas corporais", abaixo das duas seções já existentes
  (progressão de carga, volume semanal):
  - Um formulário: campo de data (padrão hoje), três campos numéricos
    opcionais (peso kg, cintura cm, % gordura), botão "Registrar". Mesmo
    padrão visual de `.set-field` já usado no formulário de equipamento
    em `config.js`. Validação mínima: pelo menos um dos três campos
    precisa ter valor (senão não há o que gravar) — mensagem inline,
    mesmo padrão de `.equipamento-status`/`.import-status` já usado em
    `config.js`.
  - Três mini-cards de gráfico de linha (Peso, Cintura, % Gordura), cada
    um usando `prepararSerieTemporal` + o helper de gráfico de linha já
    existente. Card omitido se a métrica não tiver nenhum ponto (não
    deveria acontecer após o bootstrap, mas é o mesmo padrão defensivo
    das outras seções desta tela).
- **Refactor pequeno, dentro desta fatia:** a função `criarSvgLinha`
  criada na fatia 1 é hoje amarrada ao campo `carga1RM`
  (`js/screens/evolucao.js`, ver `p.carga1RM` na função atual). Ela
  precisa aceitar pontos genéricos `{data, valor}` para ser reaproveitada
  aqui — mudança de assinatura (`p.carga1RM` → `p.valor`) e um ajuste no
  chamador da seção de progressão de carga (mapear `carga1RM` para
  `valor` antes de passar, ou renomear o campo já na saída de
  `calcularProgressao1RM`... **decisão:** mapear no chamador
  (`pontos.map(p => ({data: p.data, valor: p.carga1RM}))`), não mudar o
  contrato de `calcularProgressao1RM` — evita reabrir uma função já
  revisada e aprovada na fatia 1 só por causa de nomenclatura). Isto é
  uma melhoria pontual no arquivo que esta fatia já está tocando, não uma
  refatoração não relacionada.

## 5. Tratamento de erros e casos vazios

- Bootstrap: se o documento `perfil` ainda não existir por algum motivo
  (banco recém-criado, seed ainda não rodou), `getMedidas` retorna array
  vazio sem gravar nada — o app já garante em `app.js`/`bootstrap()` que
  `seedIfNeeded` roda antes de qualquer tela ser montada, então este caso
  não deveria ocorrer na prática, mas a função não deve lançar erro se
  ocorrer.
- Formulário sem nenhum campo preenchido: mensagem inline, não grava.
- Métrica sem nenhum ponto (não deveria acontecer pós-bootstrap): card
  omitido, mesmo padrão das outras seções.

## 6. Testes

- `js/engine/medidas.test.js`: `prepararSerieTemporal` — filtra linhas
  sem o campo, ordena por data ascendente, funciona igualmente para os
  três nomes de campo, array vazio retorna array vazio.
- `js/data/medidas.test.js` (mesmo padrão de `equipamento.test.js`/
  `historico.test.js`, usando `fake-indexeddb`): bootstrap cria a linha
  inicial a partir do `perfil` salvo na primeira chamada e não duplica em
  chamadas seguintes; `registrarMedida` grava e `getMedidas` reflete a
  nova linha; registrar duas vezes no mesmo dia mantém as duas linhas
  (não sobrescreve — o usuário pode medir de manhã e à noite).

## 7. Guarda-corpos (herdados)

- Sem build step, sem dependência nova.
- `js/engine/medidas.js` puro — sem DOM/IndexedDB/fetch.
- Nomes/strings de origem externa em `innerHTML` via `.textContent`
  (não há string de usuário livre nesta fatia — só números e datas, mas
  o padrão vale para qualquer texto futuro).
- Migração de schema do IndexedDB não-destrutiva — `medidasCorporais` é
  uma store nova, nenhuma store existente é alterada.

## 8. Backup/restore

`js/data/exportImport.js:3-6` mantém `STORES_EXPORTAVEIS`, uma lista plana
de nomes de store, consumida genericamente por `exportarTudo`/
`importarTudo` (`getAll`/`put`/`clearStore` por nome, sem lógica
específica por store). `medidasCorporais` é dado do usuário — precisa
entrar nessa lista, é uma mudança de uma linha (`js/data/exportImport.js:5`)
sem impacto em mais nada do arquivo.

## 9. Itens em aberto

- Editar/excluir um ponto registrado: adiado (ver seção 2, fora de
  escopo).
