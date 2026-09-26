// js/data/programaVolei.js
//
// Programa de levantamento (toque e direção) pra fazer em casa com bola de
// vôlei de areia — 6 semanas, 3–4 sessões de 20–25 min. Montado a partir
// de pesquisa em 24/09/2026: biomecânica do toque (Ozawa 2019), prática
// variada/aleatória (meta-análise Czyż 2024), teste de toque com alvo
// validado (Đolo 2023) e exercícios de treinadores (USA Volleyball, Better
// at Beach). Conteúdo fixo: fica no código (não é dado pessoal) e funciona
// offline.
//
// Contagem: cada exercício tem `tentativas` (total previsto na sessão) e
// `meta` em acertos; a tela registra acertos/tentativas e calcula a taxa.

export const MONTAGEM_VOLEI = [
  "Parede sem janela, quadro ou luminária por perto — de preferência não compartilhada com vizinho.",
  "Alvo de fita: 3 círculos de 30, 50 e 80 cm, centro a ~2,2 m do chão (valem 3, 2 e 1 ponto).",
  "Faixa de altura: duas fitas horizontais a 2,2 m e 2,4 m.",
  "Marcas no chão a 2,5 m e 3,5 m da parede. Opcional: cesto de roupa, elástico pros dedos, celular pra filmar.",
];

export const PRINCIPIOS_VOLEI = [
  "Chegue antes da bola e pare — levantar em movimento muda a direção.",
  "Umbigo e quadril apontados pro alvo: a direção sai do corpo, não das mãos.",
  "Mãos prontas antes da bola chegar; polegares apontando pros olhos.",
  "Mesmo ponto de contato sempre: acima da testa, um pouco à frente.",
  "Receber e devolver num movimento só — o punho é uma mola, não um tapa.",
  "Bola girando pro lado = uma mão dominando. Termine congelado apontando pro alvo.",
  "Com a bola de areia, mantenha o ponto de contato de quadra (não deixe ela te ensinar a tocar mais baixo).",
];

export const EXERCICIOS_VOLEI = {
  aquecimento: {
    nome: "Aquecimento",
    como: "Círculos de punho, abrir os dedos contra o elástico (2 × 15), rotação externa de ombro com elástico (1 × 15) e 20 toques deitado.",
    dose: "4 min",
    semContagem: true,
  },
  semGiro: {
    nome: "Toque sem girar (fita na bola)",
    como: "Passe uma volta de fita isolante bem visível em volta da bola. Toques verticais contínuos, ~1 m acima da testa, olhando a fita: ela tem que subir parada. Girou = uma mão soltou antes ou com mais força (veja o desenho 4 do guia).",
    dose: "3 × 30",
    tentativas: 90,
    meta: "30 seguidos com a fita parada",
    contaSequencia: true,
  },
  deitado: {
    nome: "Toque deitado",
    como: "De costas no chão, levante na vertical ~1 m acima das mãos. A bola deve voltar sozinha pro mesmo lugar, sem você mover as mãos.",
    dose: "3 × 40 toques",
    tentativas: 120,
    meta: "40 seguidos sem mover as mãos mais que um palmo",
    contaSequencia: true,
  },
  joelhos: {
    nome: "Sentado ou de joelhos na parede",
    como: "A 1,5–2 m da parede, toques contínuos no círculo de 50 cm. Tira as pernas e isola punho e dedos.",
    dose: "3 × 30",
    tentativas: 90,
    meta: "≥ 25 de 30 no círculo de 50 cm",
    taxaMeta: 0.83,
  },
  paredeFixa: {
    nome: "Parede com pés parados",
    como: "A 2,5–3 m da parede, toques contínuos no alvo, sem mexer os pés.",
    dose: "4 × 20",
    tentativas: 80,
    meta: "≥ 14 de 20 no círculo de 50 cm",
    taxaMeta: 0.7,
  },
  sorteado: {
    nome: "Alvo sorteado ⭐",
    como: "3 alturas (1,8 / 2,2 / 2,6 m) e 2 distâncias. Sorteie antes de cada toque (use o botão Sortear), jogue a bola pra você e levante. É o exercício mais importante pra direção.",
    dose: "3 × 12",
    tentativas: 36,
    meta: "média ≥ 2 pontos por toque (conte como acerto o círculo de 50 cm)",
    taxaMeta: 0.67,
    sorteio: true,
  },
  deslocar: {
    nome: "Deslocar e parar",
    como: "Jogue a bola na parede com ângulo pra ela voltar em lugares diferentes. Desloque-se, PARE e levante no alvo.",
    dose: "3 × 10",
    tentativas: 30,
    meta: "≥ 7 de 10 no círculo, com os pés parados no contato",
    taxaMeta: 0.7,
  },
  passeRuim: {
    nome: "Passe ruim simulado",
    como: "Faça uma manchete propositalmente imperfeita pra cima e depois o toque no alvo.",
    dose: "3 × 10",
    tentativas: 30,
    meta: "≥ 6 de 10 no alvo",
    taxaMeta: 0.6,
  },
  costas: {
    nome: "Levantamento de costas",
    como: "De costas pra parede, a 1,5–2,5 m, jogue a bola pra você e levante pra trás no alvo. Mesma posição inicial do de frente. Filme pra conferir.",
    dose: "3 × 10",
    tentativas: 30,
    meta: "≥ 6 de 10 no círculo de 80 cm, depois no de 50 cm",
    taxaMeta: 0.6,
  },
  umaMao: {
    nome: "Uma mão só",
    como: "Toques verticais baixos (30–50 cm) com uma mão, depois alternando. Corrige assimetria.",
    dose: "2 × 20 cada mão",
    tentativas: 80,
    meta: "20 seguidos com cada mão",
    contaSequencia: true,
  },
  cesto: {
    nome: "Cesto",
    como: "Cesto de roupa a 3 m e a 4,5 m (sorteie a distância). Direção e distância em parábola.",
    dose: "2 × 10",
    tentativas: 20,
    meta: "≥ 5 de 10 dentro",
    taxaMeta: 0.5,
  },
  faixa: {
    nome: "Faixa de altura",
    como: "Em pé junto da parede, toques verticais contínuos com o ponto mais alto da bola entre as duas fitas.",
    dose: "3 × 30",
    tentativas: 90,
    meta: "≥ 24 de 30 na faixa",
    taxaMeta: 0.8,
  },
  desafioSequencia: {
    nome: "Desafio: 10 seguidos",
    como: "A sessão só termina com 10 acertos seguidos no círculo de 50 cm, a 3 m. Registre a maior sequência.",
    dose: "até conseguir",
    tentativas: 0,
    meta: "10 seguidos",
    contaSequencia: true,
  },
  reforco: {
    nome: "Reforço de dedos e punho (2x/semana)",
    como: "Abrir os dedos contra elástico (2–3 × 20), pinça com anilha (3 × 20–30 s), extensão de punho e flexão lenta na descida (2 × 12), rotação externa de ombro (2 × 12).",
    dose: "8–10 min",
    semContagem: true,
  },
};

// Testes com pontuação — sempre com o mesmo aquecimento, lugar e bola.
export const TESTES_VOLEI = {
  T1: { nome: "T1 — Precisão", como: "20 toques a 3 m. Antes de cada um, segure a bola e jogue ~1 m pra cima. Alvo 30/50/80 cm = 3/2/1 ponto.", maximo: 60, unidade: "pontos" },
  T2: { nome: "T2 — Altura", como: "30 toques contínuos com o ponto mais alto da bola na faixa. Conte os acertos.", maximo: 30, unidade: "acertos" },
  T3: { nome: "T3 — Distância", como: "Cesto a 3 m e a 4,5 m, 5 toques em cada, em ordem sorteada. Conte os acertos.", maximo: 10, unidade: "acertos" },
  T4: { nome: "T4 — Sem rotação", como: "Filme 10 toques em câmera lenta e conte quantos saem sem girar.", maximo: 10, unidade: "de 10" },
};

// Semanas: foco, lista de exercícios da sessão (na ordem) e testes do dia.
export const SEMANAS_VOLEI = [
  { semana: 1, foco: "Linha de base", nota: "Faça os testes T1, T2 e T3 na primeira sessão da semana.", blocos: ["aquecimento", "semGiro", "deitado", "joelhos", "paredeFixa", "faixa"], testes: ["T1", "T2", "T3"] },
  { semana: 2, foco: "Direção", nota: "Entra o alvo sorteado, só com 2 alturas. Olhe o placar a cada 10 toques, não a cada toque.", blocos: ["aquecimento", "semGiro", "joelhos", "sorteado", "paredeFixa", "reforco"], testes: [] },
  { semana: 3, foco: "Direção + distância", nota: "Alvo sorteado com 3 alturas e 2 distâncias. Entra o cesto.", blocos: ["aquecimento", "semGiro", "paredeFixa", "sorteado", "cesto", "reforco"], testes: [] },
  { semana: 4, foco: "Costas", nota: "Levantamento de costas sorteado com o de frente (metade/metade). Refaça o T1 numa sessão.", blocos: ["aquecimento", "semGiro", "joelhos", "sorteado", "costas", "umaMao"], testes: ["T1"] },
  { semana: 5, foco: "Bola ruim + pressão", nota: "A sessão só termina com 10 seguidos no círculo de 50 cm.", blocos: ["aquecimento", "semGiro", "paredeFixa", "deslocar", "passeRuim", "desafioSequencia", "reforco"], testes: [] },
  { semana: 6, foco: "Reteste", nota: "Repita T1, T2 e T3. Depois de 3–4 dias sem treinar, faça o T1 de novo: mostra o que ficou aprendido de verdade.", blocos: ["aquecimento", "semGiro", "sorteado", "costas", "deslocar"], testes: ["T1", "T2", "T3", "T4"] },
];

// Opções do sorteio do "alvo sorteado".
export const ALTURAS_SORTEIO = ["baixo (1,8 m)", "médio (2,2 m)", "alto (2,6 m)"];
export const DISTANCIAS_SORTEIO = ["perto (2,5 m)", "longe (3,5 m)"];
export const TIPOS_SORTEIO = ["de frente", "de costas"];
