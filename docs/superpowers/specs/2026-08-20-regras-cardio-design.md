# Regras de Cardio — Ampliação

## 1. Contexto

O usuário forneceu `regrascardio.md` com regras baseadas em evidência
(interferência é real só pra potência/explosão, corrida interfere mais
que bike/elíptico, sem redução localizada de gordura). O app já tem um
registro básico de cardio (modalidade, duração, intensidade percebida) e
um único aviso (`avaliarCardio`: corrida em dia de pernas). Esta fatia
amplia pra cobrir as regras concretas e checáveis do documento.

## 2. Regras que viram checagem no app

| Regra do documento | Checável com os dados que já temos? | Como fica |
|---|---|---|
| Caminhada/leve: sem restrição | Sim (ausência de alerta é o comportamento) | Não gera alerta nunca |
| Moderado/intenso: 3-4x/semana | Sim, contando registros com `intensidadePercebida >= 3` nos últimos 7 dias | Novo alerta: 5ª sessão intensa na semana |
| Evitar intenso no dia de pernas | Sim | Amplia o alerta já existente (que só cobria corrida) pra qualquer modalidade com intensidade >= 3 |
| Corrida especificamente (mais dano que bike/elíptico) | Sim | Mantém o alerta específico de corrida em dia de pernas, mesmo com intensidade baixa reportada — o problema é o impacto da corrida em si, não a percepção de esforço |
| Musculação primeiro / separar por horas | **Não** — `historicoSeries`/`registrosCardio` só têm data, sem hora | Fora de escopo, documentado como limitação já existente no código |
| Espalhar ao longo da semana | Parcial, mas subjetivo demais pra virar regra automática sem inventar um limiar arbitrário adicional | Fora de escopo desta fatia |
| Nunca sugerir cardio como compensação / nunca falar de queima localizada | Guarda-corpo de redação, não uma checagem de dado | Confirmar que nenhum texto do app já viola isso (auditoria rápida, não uma feature nova) |

## 3. Mudanças

### 3.1 Registro — `mesmoDiaDeTreino` (novo campo, calculado, não perguntado)

O documento pede registrar "se foi no mesmo dia de um treino de
musculação". Isso não deve ser uma pergunta pro usuário (o app já sabe
a resposta) — `js/screens/divisao.js`, ao chamar `registrarCardio`,
passa `mesmoDiaDeTreino: seriesDeHoje.length > 0` (o dado já é buscado
pra outros fins nessa mesma tela). Guarda pra uso futuro por um motor de
autorregulação; não gera nenhum alerta nesta fatia.

### 3.2 `avaliarCardio` — assinatura muda de "um aviso" pra "lista de avisos"

```
avaliarCardio({ modalidade, intensidadePercebida, ehDiaDePernas, cardiosIntensosUltimos7Dias })
  => Array<{ tipo, mensagem, principio }>
```

- Corrida em dia de pernas → sempre avisa (mantém a regra já existente,
  agora explicitamente independente da intensidade percebida — o
  argumento do documento é o dano por impacto da corrida em si).
- Qualquer outra modalidade com `intensidadePercebida >= 3` em dia de
  pernas → novo aviso ("cardio moderado/intenso pode competir pela
  recuperação do único dia de pernas da semana").
- `cardiosIntensosUltimos7Dias >= 4` (contando o registro que acabou de
  ser feito, se ele mesmo for intenso) → novo aviso sugerindo reduzir
  frequência, sem forçar nada.

Retorna `[]` quando nada dispara — nunca `null` (mudança de contrato,
ajustar a tela que consome).

### 3.3 Dados — `getCardioDesde(db, dataCorte)`

Nova função em `js/data/cardio.js`, mesmo padrão de
`getSeriesDesde`/`getUltimasSessoesPorExercicio` já usados em outros
motores de alerta: retorna todos os registros de `registrosCardio` com
`data >= dataCorte`.

### 3.4 Tela — `js/screens/divisao.js`

- `renderizarCardio` passa a calcular `cardiosIntensosUltimos7Dias` a
  partir de `getCardioDesde(db, seteDiasAtras)` (filtrando
  `intensidadePercebida >= 3`) antes de chamar `avaliarCardio`.
- `registrarCardio` grava `mesmoDiaDeTreino: seriesDeHoje.length > 0`
  (o `seriesDeHoje` já é buscado no topo de `montarTelaDivisao`).
- A UI passa a renderizar **uma lista** de avisos (0 ou mais), não mais
  um único aviso condicional.

## 4. Auditoria de redação (guarda-corpo, não feature)

Confirmar, antes de fechar esta fatia, que nenhum texto já escrito no
app (cardio, dieta, evolução) sugere cardio como "compensação" de dieta
ou fala em queima de gordura localizada. Se algo for encontrado, corrige
como parte desta mesma fatia; se nada for encontrado, só registra que a
auditoria foi feita.

## 5. Fora de escopo

- Qualquer checagem de horário/ordem musculação-antes-de-cardio (sem
  dado de hora no schema).
- Alerta de "cardio concentrado" vs. "espalhado" — subjetivo demais pra
  codificar sem inventar um limiar que o documento não deu.
- Mudar a UI de registro de cardio pra pedir mais campos do usuário —
  `mesmoDiaDeTreino` é sempre calculado, nunca perguntado.
