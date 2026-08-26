import { test } from "node:test";
import assert from "node:assert/strict";
import {
  interpretarTempo, totalDaRepeticao, validarCadencia, normalizarCadencia,
  cadenciaDoExercicio, textoDaCadencia, fasesDaCadencia,
  TOTAL_MAXIMO_SEGUNDOS, CADENCIA_PADRAO,
} from "./cadencia.js";

test("interpretarTempo lê o formato simples da ficha", () => {
  assert.deepEqual(interpretarTempo("2s subindo · 3s descendo"), {
    concentrica: 2, pausaTopo: 0, excentrica: 3, pausaBase: 0,
    verboSubida: "subindo", verboDescida: "descendo",
  });
});

test("interpretarTempo identifica a fase pela ordem, não pelo verbo", () => {
  // "abrindo" é subida aqui...
  const abre = interpretarTempo("1s abrindo · 2s voltando");
  assert.equal(abre.concentrica, 1);
  assert.equal(abre.verboSubida, "abrindo");
  // ...e descida aqui. Verbo sozinho seria ambíguo.
  const fecha = interpretarTempo("1s fechando · 3s abrindo · 1s de aperto no fim");
  assert.equal(fecha.concentrica, 1);
  assert.equal(fecha.excentrica, 3);
  assert.equal(fecha.verboDescida, "abrindo");
});

test("interpretarTempo separa aperto no topo de pausa embaixo", () => {
  assert.equal(interpretarTempo("1s subindo · 3s descendo · 1s de aperto no topo").pausaTopo, 1);
  assert.equal(interpretarTempo("1s subindo · 3s descendo · 1s de aperto no topo").pausaBase, 0);

  assert.equal(interpretarTempo("1s subindo · 3s descendo · 2s de pausa embaixo").pausaBase, 2);
  assert.equal(interpretarTempo("1s subindo · 3s descendo · 2s de pausa embaixo").pausaTopo, 0);
});

test("interpretarTempo devolve null pra isometria e pra texto fora do formato", () => {
  assert.equal(interpretarTempo("isometria — segure parado"), null);
  assert.equal(interpretarTempo("devagar e sempre"), null);
  assert.equal(interpretarTempo("2s subindo"), null, "só uma fase não é cadência");
  assert.equal(interpretarTempo(undefined), null);
});

test("interpretarTempo cobre as 16 formas de tempo que existem na ficha", () => {
  const daFicha = [
    "1s subindo · 3s descendo",
    "1s puxando · 3s voltando",
    "1s puxando · 2s voltando · 1s de aperto no fim",
    "1s abrindo · 2s voltando",
    "1s empurrando · 2s voltando",
    "1s puxando · 2s voltando · 1s de aperto",
    "1s empurrando · 3s voltando",
    "1s flexionando · 2s voltando",
    "1s empurrando · 3s descendo",
    "1s subindo · 3s descendo · 1s de aperto no topo",
    "1s flexionando · 3s voltando",
    "1s abrindo · 2s voltando · 1s de aperto",
    "1s subindo · 3s descendo · 2s de pausa embaixo",
    "1s fechando · 3s abrindo · 1s de aperto no fim",
    "1s subindo · 2s descendo",
  ];
  for (const texto of daFicha) {
    const c = interpretarTempo(texto);
    assert.ok(c, `não interpretou: ${texto}`);
    assert.ok(c.concentrica > 0 && c.excentrica > 0, `fases zeradas em: ${texto}`);
    assert.ok(validarCadencia(c).valida, `ficou inválida: ${texto}`);
  }
});

test("totalDaRepeticao soma as quatro fases", () => {
  assert.equal(totalDaRepeticao({ concentrica: 2, pausaTopo: 1, excentrica: 3, pausaBase: 2 }), 8);
  assert.equal(totalDaRepeticao(null), 0);
});

test("validarCadencia recusa passar do teto de 8s e explica por quê", () => {
  const r = validarCadencia({ concentrica: 4, pausaTopo: 1, excentrica: 4, pausaBase: 0 });
  assert.equal(r.valida, false);
  assert.match(r.motivo, /9s/);
  assert.match(r.motivo, new RegExp(`${TOTAL_MAXIMO_SEGUNDOS}s`));
});

test("validarCadencia aceita exatamente 8s", () => {
  assert.equal(validarCadencia({ concentrica: 3, pausaTopo: 1, excentrica: 3, pausaBase: 1 }).valida, true);
});

test("validarCadencia exige um mínimo em cada fase de movimento", () => {
  assert.equal(validarCadencia({ concentrica: 0, excentrica: 3 }).valida, false);
  assert.equal(validarCadencia({ concentrica: 2, excentrica: 0 }).valida, false);
  assert.equal(validarCadencia({ concentrica: 0.5, excentrica: 0.5 }).valida, true);
});

test("normalizarCadencia corta o excesso começando pelas pausas", () => {
  const c = normalizarCadencia({ concentrica: 3, pausaTopo: 2, excentrica: 3, pausaBase: 2 }); // 10s
  assert.equal(totalDaRepeticao(c), TOTAL_MAXIMO_SEGUNDOS);
  assert.equal(c.concentrica, 3, "fases de movimento são preservadas antes das pausas");
  assert.equal(c.excentrica, 3);
  assert.equal(c.pausaBase, 0, "corta primeiro a pausa de baixo");
  assert.equal(c.pausaTopo, 2);
});

test("normalizarCadencia encolhe subida e descida juntas, mantendo a proporção", () => {
  const c = normalizarCadencia({ concentrica: 4, pausaTopo: 0, excentrica: 6, pausaBase: 0 }); // 10s
  assert.equal(totalDaRepeticao(c), TOTAL_MAXIMO_SEGUNDOS);
  // 4:6 vira 3,2:4,8 — mesma proporção de 2:3, agora dentro do teto.
  assert.equal(c.concentrica, 3.2);
  assert.equal(c.excentrica, 4.8);
});

test("normalizarCadencia fecha a conta mesmo com um exagero grande dos dois lados", () => {
  // Caso que quebrava quando o corte saía de uma fase só: ela travava no
  // mínimo e o total continuava acima do teto.
  const c = normalizarCadencia({ concentrica: 8, pausaTopo: 0, excentrica: 8, pausaBase: 0 }); // 16s
  assert.equal(totalDaRepeticao(c), TOTAL_MAXIMO_SEGUNDOS);
  assert.equal(c.concentrica, 4);
  assert.equal(c.excentrica, 4);
});

test("normalizarCadencia preenche buracos com o padrão", () => {
  const c = normalizarCadencia({});
  assert.equal(c.concentrica, CADENCIA_PADRAO.concentrica);
  assert.equal(c.excentrica, CADENCIA_PADRAO.excentrica);
});

test("cadenciaDoExercicio prefere o campo estruturado à prosa", () => {
  const exercicio = {
    cadencia: { concentrica: 2, excentrica: 4, pausaTopo: 0, pausaBase: 0, verboSubida: "subindo", verboDescida: "descendo" },
    tempo: "1s subindo · 3s descendo",
  };
  assert.equal(cadenciaDoExercicio(exercicio).concentrica, 2);
  assert.equal(cadenciaDoExercicio(exercicio).excentrica, 4);
});

test("cadenciaDoExercicio cai na prosa quando não há campo estruturado", () => {
  assert.equal(cadenciaDoExercicio({ tempo: "1s puxando · 3s voltando" }).concentrica, 1);
});

test("cadenciaDoExercicio lê o tempo de dentro de prescricao", () => {
  // é assim que o exercício chega na tela de execução (fichaFixa monta
  // { ...exercicio, prescricao })
  assert.equal(cadenciaDoExercicio({ prescricao: { tempo: "1s puxando · 2s voltando" } }).excentrica, 2);
});

test("cadenciaDoExercicio aplica o ajuste do usuário por cima da ficha", () => {
  const exercicio = { tempo: "2s subindo · 3s descendo" };
  const c = cadenciaDoExercicio(exercicio, { concentrica: 3, excentrica: 3 });
  assert.equal(c.concentrica, 3);
  assert.equal(c.excentrica, 3);
});

test("cadenciaDoExercicio nunca deixa o ajuste do usuário passar do teto", () => {
  const c = cadenciaDoExercicio({ tempo: "2s subindo · 3s descendo" }, { concentrica: 8, excentrica: 8 });
  assert.ok(totalDaRepeticao(c) <= TOTAL_MAXIMO_SEGUNDOS);
});

test("cadenciaDoExercicio usa o padrão pra isometria, que não tem cadência", () => {
  const c = cadenciaDoExercicio({ tempo: "isometria — segure parado" });
  assert.equal(c.concentrica, CADENCIA_PADRAO.concentrica);
});

test("textoDaCadencia regenera a prosa a partir dos números", () => {
  assert.equal(
    textoDaCadencia({ concentrica: 2, excentrica: 3, pausaTopo: 0, pausaBase: 0, verboSubida: "puxando", verboDescida: "voltando" }),
    "2s puxando · 3s voltando"
  );
  assert.equal(
    textoDaCadencia({ concentrica: 2, excentrica: 3, pausaTopo: 1, pausaBase: 0, verboSubida: "subindo", verboDescida: "descendo" }),
    "2s subindo · 3s descendo · 1s de aperto no topo"
  );
});

test("textoDaCadencia usa vírgula decimal", () => {
  const t = textoDaCadencia({ concentrica: 1.5, excentrica: 3, pausaTopo: 0, pausaBase: 0, verboSubida: "subindo", verboDescida: "descendo" });
  assert.equal(t, "1,5s subindo · 3s descendo");
});

test("fasesDaCadencia devolve a ordem cronológica, com o aperto entre subir e descer", () => {
  const fases = fasesDaCadencia({
    concentrica: 2, pausaTopo: 1, excentrica: 3, pausaBase: 0,
    verboSubida: "subindo", verboDescida: "descendo",
  });
  assert.deepEqual(fases.map((f) => f.chave), ["concentrica", "pausaTopo", "excentrica"]);
  assert.deepEqual(fases.map((f) => f.segundos), [2, 1, 3]);
  assert.equal(fases[1].rotulo, "Segure");
});

test("fasesDaCadencia omite pausas de zero segundo", () => {
  const fases = fasesDaCadencia({ concentrica: 2, pausaTopo: 0, excentrica: 3, pausaBase: 0 });
  assert.deepEqual(fases.map((f) => f.chave), ["concentrica", "excentrica"]);
});

test("fasesDaCadencia inclui a pausa embaixo no fim do ciclo", () => {
  const fases = fasesDaCadencia({ concentrica: 2, pausaTopo: 0, excentrica: 3, pausaBase: 2 });
  assert.deepEqual(fases.map((f) => f.chave), ["concentrica", "excentrica", "pausaBase"]);
});
