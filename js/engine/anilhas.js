export function calcularAnilhas(pesoAlvo, pesoBarra, anilhasDisponiveis) {
  const pesoPorLado = (pesoAlvo - pesoBarra) / 2;

  if (pesoPorLado <= 0) {
    return { anilhasPorLado: [], pesoPorLado: 0, restante: 0, atingivel: pesoAlvo === pesoBarra };
  }

  const ordenadas = [...anilhasDisponiveis].sort((a, b) => b - a);
  let restante = pesoPorLado;
  const anilhasPorLado = [];

  for (const anilha of ordenadas) {
    while (restante >= anilha - 1e-9) {
      anilhasPorLado.push(anilha);
      restante -= anilha;
    }
  }

  const restanteArredondado = Math.round(restante * 100) / 100;
  return {
    anilhasPorLado,
    pesoPorLado,
    restante: restanteArredondado,
    atingivel: restanteArredondado < 0.01,
  };
}
