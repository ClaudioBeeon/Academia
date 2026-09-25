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

// Aquecimento pra compostos que não usam barra (auditoria 2026-09-24):
// supino com halteres, supino/remada na máquina, hack, leg press. Duas
// séries de aproximação curtas e leves — é ensaio técnico e segurança
// (consenso prático), sem pretensão de somar estímulo: por isso poucas reps.
export function gerarAquecimentoComposto(pesoTrabalho, incremento = 1) {
  if (!(pesoTrabalho > 0)) return [];
  const passo = incremento > 0 ? incremento : 0.5;
  const arredondar = (peso) => Math.round(Math.round(peso / passo) * passo * 100) / 100;
  const passos = [
    { percentual: 50, peso: arredondar(pesoTrabalho * 0.5), reps: 8 },
    { percentual: 70, peso: arredondar(pesoTrabalho * 0.7), reps: 4 },
  ];
  const vistos = new Set();
  return passos.filter((p) => {
    if (!(p.peso > 0) || p.peso >= pesoTrabalho || vistos.has(p.peso)) return false;
    vistos.add(p.peso);
    return true;
  });
}

// Multiarticular = composto no catálogo, ou máquina que também trabalha
// músculos secundários (supino e remada na máquina). Isoladores não
// precisam de rampa: a primeira série já é leve o bastante pra aquecer.
export function precisaDeAquecimento(exercicio) {
  if (!exercicio) return false;
  if (exercicio.tipo?.startsWith("composto")) return true;
  return exercicio.tipo === "maquina" && (exercicio.musculosSecundarios?.length ?? 0) > 0;
}
