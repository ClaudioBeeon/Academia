function arredondarMeioKg(carga) {
  return Math.round(carga * 2) / 2;
}

export function sugerirCarga(amostras, rirAlvo) {
  if (!amostras || amostras.length === 0) {
    return { cargaSugerida: null, confianca: "nenhuma", principio: "cargas", secao: "prompt-original" };
  }

  if (amostras.length === 1) {
    const amostra = amostras[0];
    const diffRir = rirAlvo - amostra.rir_relatado;
    const carga = amostra.carga * (1 + diffRir * 0.05);
    return {
      cargaSugerida: arredondarMeioKg(carga),
      confianca: "baixa",
      principio: "cargas",
      secao: "prompt-original",
    };
  }

  const n = amostras.length;
  const mediaCarga = amostras.reduce((soma, a) => soma + a.carga, 0) / n;
  const mediaRir = amostras.reduce((soma, a) => soma + a.rir_relatado, 0) / n;

  let numerador = 0;
  let denominador = 0;
  for (const a of amostras) {
    numerador += (a.carga - mediaCarga) * (a.rir_relatado - mediaRir);
    denominador += (a.carga - mediaCarga) ** 2;
  }

  const confianca = n >= 4 ? "alta" : "media";

  if (denominador === 0) {
    return { cargaSugerida: arredondarMeioKg(mediaCarga), confianca, principio: "cargas", secao: "prompt-original" };
  }

  const inclinacao = numerador / denominador;
  const intercepto = mediaRir - inclinacao * mediaCarga;
  const carga = (rirAlvo - intercepto) / inclinacao;

  return { cargaSugerida: arredondarMeioKg(carga), confianca, principio: "cargas", secao: "prompt-original" };
}
