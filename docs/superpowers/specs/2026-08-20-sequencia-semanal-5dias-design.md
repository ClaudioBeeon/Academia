# Sequência Semanal de 5 Dias — Substituição do Superior/Inferior

## 1. Contexto e objetivo

O usuário forneceu `sequenciasemanaltreino.md`: uma divisão de 5 dias
nomeados, cada um com uma combinação fixa de músculos, substituindo a
divisão binária Superior/Inferior atual (`js/engine/divisao.js`).

| Dia | Músculos | Título |
|---|---|---|
| 1 | peito, triceps | Peito + Tríceps |
| 2 | costas, biceps | Costas + Bíceps |
| 3 | peito, ombro | Peito + Ombro |
| 4 | quadriceps, posterior_coxa, gluteo, panturrilha, abdomen | Pernas |
| 5 | peito, triceps | Peito + Tríceps |

Peito aparece nos dias 1, 3 e 5 (3x/semana, prioridade de frequência,
não de volume — `protocolo.json` continua definindo peito como
`musculoEmManutencao` na fase atual, isso não muda aqui). Abdômen entra
só no dia 4, como reforço de baixo volume, sem dia próprio — sem
alegação de perda de gordura localizada.

## 2. Por que dias 1 e 5 são idênticos (e por que isso importa pro código)

Dias 1 e 5 têm exatamente o mesmo conjunto de músculos. Isso significa
que **não dá pra descobrir "qual dia foi treinado" só olhando o músculo
das séries** — ao contrário do sistema binário antigo, onde "peito"
sempre significava "superior" sem ambiguidade. A rotação precisa de um
estado explícito (qual número de dia foi decidido), não só inferência
por músculo.

## 3. Arquitetura

### 3.1 Motor puro — `js/engine/sequenciaSemanal.js` (novo)

- `DIAS_SEQUENCIA`: array exportado com os 5 dias (`{ numero, titulo,
  musculos }`), na ordem da tabela acima.
- `obterDiaPorNumero(numero)`: retorna o objeto do dia (fallback pro dia
  1 se o número for inválido — nunca deveria acontecer, mas evita
  `undefined` se um dado corrompido aparecer).
- `obterMusculosDoDia(numero)`: atalho pra `obterDiaPorNumero(numero).musculos`.
- `proximoDia(numeroAtual)`: `(numeroAtual % 5) + 1` — 5 vira 1.
- `determinarDiaDaSessao(ultimoRegistro, hoje)`: `ultimoRegistro` é
  `{ dia, data } | null`. Se não houver registro, começa no dia 1. Se o
  registro já é de hoje, retorna o mesmo dia (estável o dia inteiro,
  mesma garantia que a fatia da Divisão Superior/Inferior já tinha). Se
  o registro é de outro dia, avança pro próximo da sequência.
- `obterDiaPeloMusculo(musculo)`: pra rotular histórico — retorna o
  **primeiro** dia da sequência cujo array de músculos contém esse
  músculo (dias 1 antes de 3 antes de 5), ou `null` se não mapeado.
  Aproximado por natureza (um músculo só pode apontar pra um dia, então
  "peito" sempre aponta pro dia 1 mesmo quando o treino real foi o dia 3
  ou 5) — aceitável porque essa função serve só pra rotular uma lista de
  sessões passadas, não pra decidir o que mostrar hoje.

### 3.2 Dados — `js/data/sequenciaSemanal.js` (novo, substitui `grupoForcado.js`)

- `getUltimoDiaRegistrado(db)`: lê `config["sequenciaSemanal"]`, retorna
  `{ dia, data } | null`.
- `registrarDiaDaSessao(db, dia, data)`: grava
  `{ chave: "sequenciaSemanal", dia, data }`. Mesma store `config`, sem
  mudança de schema — só uma chave nova substituindo a antiga
  `"grupoForcado"`.

### 3.3 Filtragem de exercícios (mesmo guarda-corpo de antes)

Um exercício customizado (Biblioteca, texto livre) cujo músculo não
aparece em **nenhum** dia da sequência nunca é escondido — aparece todo
dia. `TODOS_MUSCULOS_MAPEADOS` é o conjunto de todos os músculos de
todos os dias; um exercício só é filtrado pelo dia se seu músculo
estiver nesse conjunto E não estiver no dia de hoje.

### 3.4 Telas afetadas

- `js/screens/treino.js`: troca `grupoDeHoje`/`tituloGrupo` por
  `diaDaSessao`/`diaInfo` (`{numero, titulo, musculos}`). O seletor
  manual de "trocar" vira um `<select>` com os 5 títulos (não faz mais
  sentido um botão binário "trocar pro oposto" com 5 estados).
- `js/screens/divisao.js`: card "Hoje" mostra o título do dia; histórico
  usa `obterDiaPeloMusculo` pro rótulo aproximado; a checagem de cardio
  (`avaliarCardio`) passa a informar se hoje é o dia de pernas, não mais
  um grupo binário.
- `js/engine/cardio.js`: `avaliarCardio({ modalidade, grupoDoDia })` vira
  `avaliarCardio({ modalidade, ehDiaDePernas })` — mais direto, sem
  reintroduzir o conceito "inferior" que não existe mais.

### 3.5 Novo: card de plano inteiro clicável

Card "Treino de hoje" (`js/screens/treino.js`) — hoje só o botão
"Começar treino" rola até o primeiro exercício. Ruling do usuário: o
card inteiro deve ser clicável, igual ao protótipo Emon (cartão inteiro
como afordance, não só um botão pequeno dentro dele). O listener de
clique migra do botão pro card (`planoCard`) inteiro; o botão continua
existindo visualmente (rótulo "Começar treino"), mas o clique nele já
propaga (bubble) pro handler do card — não precisa de dois listeners
duplicados.

## 4. O que fica igual

- `js/engine/sessaoGerada.js` não muda — continua recebendo
  `exerciciosDoGrupo` (agora filtrado pelo dia, não mais pelo
  grupo binário) e gerando a sessão via round-robin, sem saber nada
  sobre dias/grupos.
- `protocolo.json` não muda — a priorização/manutenção de peito
  continua vindo de `volumeSemanalPorFase.definicao`, só a frequência
  (quantos dias por semana peito aparece) muda, e isso é uma decisão de
  sequenciamento, não de volume-alvo.

## 5. Fora de escopo

- Qualquer edição da sequência pelo usuário além do seletor manual do
  dia (reordenar os 5 dias, mudar quais músculos entram em cada um) —
  a sequência em si é fixa no código, refletindo o documento fornecido.
- Vincular os 5 dias a dias da semana do calendário — a rotação continua
  por sessão, não por data fixa (mesmo princípio já usado no sistema
  binário).
