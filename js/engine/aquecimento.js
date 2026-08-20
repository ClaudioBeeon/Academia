function arredondarMeioKg(peso) {
  return Math.round(peso * 2) / 2;
}

export function gerarEscadaAquecimento(pesoTrabalho, pesoBarra = 20) {
  const passos = [
    { percentual: 0, peso: pesoBarra, reps: 10 },
    { percentual: 50, peso: pesoTrabalho * 0.5, reps: 8 },
    { percentual: 65, peso: pesoTrabalho * 0.65, reps: 5 },
    { percentual: 80, peso: pesoTrabalho * 0.8, reps: 3 },
  ];

  return passos
    .map((p) => ({ ...p, peso: arredondarMeioKg(p.peso) }))
    .filter((p) => p.peso >= pesoBarra && p.peso <= pesoTrabalho);
}
