// js/engine/perguntasDiarias.js
//
// Define as perguntas diárias de hábito (sono, creatina, hidratação, álcool)
// e a lógica pura de quais ainda estão pendentes — usada pelo popup que
// aparece ao abrir o app (js/screens/perguntasDiarias.js) e reaproveitável
// por qualquer outra tela que precise saber "o que falta responder hoje".
//
// Cada pergunta aponta pro mesmo campo já usado no card "Hábitos de hoje"
// (js/screens/treino.js) — o popup e o card leem/escrevem o mesmo registro
// em habitos, então responder num lugar atualiza o outro.

export const QUESTOES_DIARIAS = [
  {
    id: "sono",
    campo: "sonoOntem",
    pergunta: "Como foi seu sono de ontem?",
    opcoes: [
      { valor: "bom", rotulo: "Bom" },
      { valor: "medio", rotulo: "Médio" },
      { valor: "ruim", rotulo: "Ruim" },
    ],
  },
  {
    id: "creatina",
    campo: "creatina",
    pergunta: "Tomou creatina hoje?",
    opcoes: [
      { valor: true, rotulo: "Sim" },
      { valor: false, rotulo: "Ainda não" },
    ],
  },
  {
    id: "hidratacao",
    campo: "hidratacao",
    pergunta: "Como está a cor da sua urina hoje?",
    opcoes: [
      { valor: "clara", rotulo: "Clara" },
      { valor: "media", rotulo: "Amarela" },
      { valor: "escura", rotulo: "Escura" },
    ],
  },
  {
    id: "alcool",
    campo: "alcool",
    pergunta: "Bebeu álcool hoje?",
    opcoes: [
      { valor: true, rotulo: "Sim" },
      { valor: false, rotulo: "Não" },
    ],
  },
];

// Uma pergunta está pendente quando o campo correspondente nunca foi
// respondido hoje (undefined/null) — false e "" já são respostas válidas
// (ex.: "ainda não tomei creatina"), então não contam como pendentes.
export function obterPerguntasPendentes(habitoHoje, questoes = QUESTOES_DIARIAS) {
  return questoes.filter((q) => (habitoHoje?.[q.campo] ?? null) === null);
}

// Perguntas do check-in de sessão (antes em card próprio na tela inicial,
// js/screens/treino.js) — agora fazem parte do mesmo popup de abertura,
// junto das perguntas de hábito. Vivem em outro registro (registrosDiarios,
// via js/data/checkin.js), por isso um array separado em vez de entrar em
// QUESTOES_DIARIAS.
export const QUESTOES_CHECKIN = [
  {
    id: "qualidade",
    campo: "qualidadePercebida",
    pergunta: "Como foi a sessão de treino de hoje, no geral?",
    opcoes: [1, 2, 3, 4, 5].map((n) => ({ valor: n, rotulo: String(n) })),
  },
  {
    id: "bemEstar",
    campo: "bemEstarBaixo",
    pergunta: "Sono ruim, motivação baixa ou irritação sustentada hoje?",
    opcoes: [
      { valor: true, rotulo: "Sim" },
      { valor: false, rotulo: "Não" },
    ],
  },
  {
    id: "dorArticular",
    campo: "dorArticularOuTendinea",
    pergunta: "Alguma dor articular ou de tendão persistente?",
    opcoes: [
      { valor: true, rotulo: "Sim" },
      { valor: false, rotulo: "Não" },
    ],
  },
  {
    id: "doms",
    campo: "domsPersistente",
    pergunta: "Ainda com dor muscular do treino anterior?",
    opcoes: [
      { valor: true, rotulo: "Sim" },
      { valor: false, rotulo: "Não" },
    ],
  },
];

// O check-in é preenchido de uma vez só (as 4 perguntas em sequência), então
// a pendência é tudo-ou-nada: se a nota geral (qualidadePercebida) ainda não
// foi respondida hoje, as 4 entram na fila; se já foi, nenhuma entra —
// mesmo critério que o card antigo usava pra decidir "já respondido".
export function obterPerguntasCheckinPendentes(checkinHoje) {
  return checkinHoje?.qualidadePercebida !== undefined ? [] : QUESTOES_CHECKIN;
}
