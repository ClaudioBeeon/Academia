# Divisão Semanal (Superior/Inferior) — Design

## 1. Contexto e objetivo

Hoje a tela Treino está travada em "Peito" (`exerciciosHoje =
todosExercicios.filter(e => e.musculoPrimario === "peito")`,
`js/screens/treino.js`), embora `data/exercicios.json` já tenha exercícios
cadastrados para costas, ombro, bíceps, tríceps, quadríceps, posterior de
coxa, glúteo, panturrilha e abdômen. A aba "Divisão" existe no menu mas
não tem tela implementada.

Este design cobre: (1) uma divisão real de treino que alterna entre grupos
musculares a cada sessão, substituindo o hardcode de "peito", e (2) o
conteúdo da aba Divisão — o grupo de hoje e um histórico visual de sessões
recentes.

## 2. Estrutura da divisão

**Superior/Inferior, rotação por sessão (não por dia calendário), 5x por
semana de disponibilidade.**

Baseado no princípio P2 da pesquisa (`base-cientifica-hipertrofia-forca.md`,
seção 2 e linha 373): frequência de ~2x/semana por músculo é o alvo padrão;
frequência é ferramenta de distribuição de volume, não estímulo em si. Com
15 dos 19 exercícios cadastrados sendo de membros superiores/core e apenas
4 de pernas, uma rotação Superior-Inferior-Superior-Inferior-Superior dá ao
superior ~3 sessões e às pernas ~2 sessões por ciclo de 5 — compatível com
o perfil (prioridade 1 é déficit calórico via dieta, não frequência de
pernas; prioridade 2 é peito, que está no grupo superior).

**Mapeamento músculo → grupo** (fixo, definido em código, não no JSON de
exercícios — evita mudança de schema):

```
superior: peito, costas, ombro, biceps, triceps, abdomen
inferior: quadriceps, posterior_coxa, gluteo, panturrilha
```

**Alternância:** sem estado novo no IndexedDB. O "próximo grupo" é
derivado da série mais recente já registrada em `historicoSeries`
(qualquer exercício, qualquer data): se o músculo dessa série pertence ao
grupo superior, a próxima sessão é inferior, e vice-versa. Sem nenhuma
série registrada ainda, a primeira sessão é superior. Isso evita duplicar
estado (nada pra ficar dessincronizado) e funciona exatamente com o modelo
"rotação por sessão" pedido pelo usuário — faltar um dia não quebra a
alternância, porque ela não depende do calendário.

## 3. Arquitetura

- `js/engine/divisao.js` (novo, motor puro — sem DOM/IndexedDB/fetch):
  - `GRUPO_POR_MUSCULO`: objeto de mapeamento músculo → grupo (constante
    exportada, para a tela também poder rotular exercícios se precisar).
  - `obterGrupoDoMusculo(musculo)`: retorna `"superior"`, `"inferior"` ou
    `null` para um `musculoPrimario` não mapeado. Retorna `null` em vez de
    lançar erro porque `musculoPrimario` é texto livre no formulário da
    Biblioteca (`js/screens/biblioteca.js`, campo `musculo`) — um
    exercício customizado pode ter qualquer valor, e a tela de Treino não
    pode quebrar nem esconder silenciosamente um exercício que o usuário
    cadastrou de propósito.
  - `determinarProximoGrupo(ultimaSerie)`: recebe o registro mais recente
    de `historicoSeries` (ou `null`/`undefined` se não houver nenhum) e
    retorna o grupo da próxima sessão (`"superior"` se `ultimaSerie` for
    nulo OU se o músculo da última série não estiver mapeado, senão o
    oposto do grupo de `ultimaSerie.musculo`).

- `js/data/historico.js` (modificado): nova função
  `getUltimaSerieGeral(db)` — busca todos os registros de
  `historicoSeries` e retorna o mais recente por `data` desc, com `id`
  desc como desempate (mesmo padrão de desempate de
  `getUltimaSerieAnterior`, já existente no arquivo). Retorna `undefined`
  se a loja estiver vazia.

- `js/screens/treino.js` (modificado):
  - Troca a chamada hardcoded por: buscar `getUltimaSerieGeral(db)`,
    calcular `grupoDeHoje = determinarProximoGrupo(ultimaSerieGeral)`,
    filtrar `todosExercicios` mantendo um exercício quando seu grupo (via
    `obterGrupoDoMusculo`) é igual a `grupoDeHoje` OU é `null`
    (exercício customizado com músculo não mapeado sempre aparece, em
    qualquer sessão, em vez de nunca aparecer).
  - O título do cabeçalho (`<div class="day-title">`) passa a mostrar
    "Superior" ou "Inferior" em vez do hardcode "Peito".

- `js/screens/divisao.js` (novo — implementa a aba "Divisão"):
  - Mostra um card com o grupo de hoje (mesma lógica de
    `determinarProximoGrupo`) e uma frase curta explicando o padrão
    (rotação por sessão, não por dia fixo).
  - Mostra um histórico das últimas sessões: agrupa `historicoSeries` por
    `data`, pega o grupo de cada dia (via o músculo da primeira série
    daquele dia), lista as datas mais recentes primeiro (limite razoável,
    ex. últimos 14 dias com registro — não é um calendário mensal cheio de
    células vazias, é uma lista das sessões que de fato aconteceram).

- `js/app.js` (modificado): roteia a aba `"divisao"` para
  `montarTelaDivisao`, mesmo padrão das outras abas.

- `sw.js`: adiciona `js/engine/divisao.js` e `js/screens/divisao.js` ao
  `APP_SHELL`, bump de versão de cache.

## 4. Casos de borda

- **Nenhuma série registrada ainda** (app novo): `determinarProximoGrupo`
  retorna `"superior"`; a aba Divisão mostra "Hoje: Superior" e histórico
  vazio ("Nenhuma sessão registrada ainda").
- **Duas sessões no mesmo dia** (ex. o usuário treina superior de manhã e,
  por engano, abre o app de novo à noite): a lógica olha a série mais
  recente por `data`+`id`, então dentro do mesmo dia o grupo não muda
  meio da sessão — está tudo bem, porque o filtro da tela de Treino só é
  recalculado quando a tela é montada (raro trocar de tela no meio de uma
  sessão), e mesmo que troque, mostrar o mesmo grupo de novo no mesmo dia
  é o comportamento correto (é a mesma sessão).
- **Divisão nunca é decidida automaticamente sem um treino de fato** — não
  há "pular grupo" manual nesta versão; alternar é sempre consequência de
  ter registrado uma série. Consistente com o guarda-corpo geral do
  projeto de nunca forçar progressão automática sem dado real.
- **Exercício customizado com músculo não mapeado** (cadastrado via
  Biblioteca, campo de texto livre): `obterGrupoDoMusculo` retorna `null`
  em vez de lançar erro. Na tela de Treino, esse exercício aparece em
  todas as sessões (nunca é escondido). No histórico da aba Divisão, o dia
  em que só houve séries desse tipo é rotulado "Grupo não identificado" em
  vez de quebrar a listagem.

## 5. Fora de escopo (YAGNI, não construir agora)

- Edição manual da divisão pelo usuário (trocar a ordem, adicionar um
  terceiro grupo, pular um grupo manualmente) — pode virar uma fatia
  futura se o usuário pedir.
- Qualquer vínculo com dia da semana / calendário real (feriados, "só
  treino segunda/quarta/sexta") — o pedido explícito foi rotação por
  sessão, não por data.
- Alterar `protocolo.json` ou `exercicios.json` — o mapeamento
  músculo→grupo fica só no código do engine.
