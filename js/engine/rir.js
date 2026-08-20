export function validarRir({ rirDeclarado, repsSerieAtual, repsSerieSeguinte, cargaIgual }) {
  const suspeitaSuperestimado =
    rirDeclarado <= 2 && cargaIgual && repsSerieSeguinte > repsSerieAtual;

  return {
    suspeitaSuperestimado,
    mensagem: suspeitaSuperestimado
      ? "Você conseguiu mais repetições na série seguinte com a mesma carga — o RIR real provavelmente era maior do que o declarado."
      : null,
    principio: "P4",
    secao: "22.5",
  };
}
