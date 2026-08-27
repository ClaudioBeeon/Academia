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
    pergunta: "Como está a cor da sua urina agora?",
    opcoes: [
      { valor: "clara", rotulo: "Clara" },
      { valor: "media", rotulo: "Amarela" },
      { valor: "escura", rotulo: "Escura" },
    ],
    // Diferente das outras (um fato do dia, respondido uma vez), hidratação
    // muda ao longo do dia — faz sentido perguntar de novo periodicamente,
    // não só na primeira abertura do app.
    recorrenciaHoras: 3,
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

// Uma pergunta comum está pendente quando o campo correspondente nunca foi
// respondido hoje (undefined/null) — false e "" já são respostas válidas
// (ex.: "ainda não tomei creatina"), então não contam como pendentes.
//
// Uma pergunta com `recorrenciaHoras` (hidratação) usa outro critério: fica
// pendente de novo depois que aquele tanto de horas passa desde a última
// resposta, gravada em `${campo}RespondidaEm` (epoch ms) — não daria pra
// usar o valor em si porque "clara" respondido há 6 horas não é diferente,
// pro filtro, de "clara" respondido agora.
export function obterPerguntasPendentes(habitoHoje, questoes = QUESTOES_DIARIAS, agora = Date.now()) {
  return questoes.filter((q) => {
    if (q.recorrenciaHoras) {
      const respondidaEm = habitoHoje?.[`${q.campo}RespondidaEm`];
      if (!respondidaEm) return true;
      return agora - respondidaEm >= q.recorrenciaHoras * 60 * 60 * 1000;
    }
    return (habitoHoje?.[q.campo] ?? null) === null;
  });
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

// O check-in é sobre a sessão de treino de hoje — perguntar antes de treinar
// não faz sentido (ex.: "como foi o treino de hoje" pra quem só treina à
// noite, ainda de manhã) e nunca tem resposta de verdade. `treinouHoje` é a
// mesma checagem usada em outros lugares do app: existe ao menos uma série
// registrada hoje. Sem isso, as 4 perguntas só entram na fila depois que a
// pessoa já treinou; a pendência continua tudo-ou-nada entre elas (mesmo
// critério de antes: se a nota geral já foi respondida hoje, nenhuma volta).
export function obterPerguntasCheckinPendentes(checkinHoje, treinouHoje = true) {
  if (!treinouHoje) return [];
  return checkinHoje?.qualidadePercebida !== undefined ? [] : QUESTOES_CHECKIN;
}
