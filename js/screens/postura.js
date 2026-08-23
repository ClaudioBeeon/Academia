// js/screens/postura.js
//
// Card de acompanhamento postural: foto de perfil a cada 4 semanas, com a
// primeira e a mais recente lado a lado. Sem análise automática de ângulo —
// isso exigiria pontos anatômicos marcados à mão e daria um número com
// precisão falsa. A comparação visual honesta entrega mais.

import {
  getFotosPostura,
  registrarFotoPostura,
  excluirFotoPostura,
  primeiraEUltima,
  diasAteProximaFoto,
} from "../data/postura.js";

const COMO_TIRAR = [
  "De perfil (de lado), corpo inteiro ou da cintura pra cima.",
  "Mesma parede lisa, mesma distância, mesma altura de câmera.",
  "Sem camisa ou com roupa justa — camisa larga esconde a posição do ombro.",
  "Postura NORMAL, relaxada. Não corrija na hora da foto: o objetivo é registrar como você fica sem pensar, não como consegue ficar quando lembra.",
  "Olhando pra frente, braços soltos ao lado do corpo.",
];

function formatarData(iso) {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export async function montarCardPostura(db, hoje, aoAtualizar) {
  const fotos = await getFotosPostura(db);
  const { primeira, ultima, semanasEntre } = primeiraEUltima(fotos);
  const diasRestantes = diasAteProximaFoto(fotos, hoje);

  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `
    <div class="exercise-head">
      <div>
        <div class="exercise-name">Postura</div>
        <div class="exercise-meta">ombros e pescoço pra frente</div>
      </div>
    </div>
  `;

  const corpo = document.createElement("div");
  corpo.style.cssText = "padding:0 18px 18px;";
  card.appendChild(corpo);

  if (fotos.length === 0) {
    const vazio = document.createElement("p");
    vazio.className = "prev-hint";
    vazio.textContent =
      "Nenhuma foto ainda. Tire a primeira hoje — sem um ponto de partida não tem como saber, daqui a 8 semanas, se o trabalho de deltoide posterior mudou alguma coisa.";
    corpo.appendChild(vazio);
  } else {
    const grade = document.createElement("div");
    grade.className = "postura-grade";

    const coluna = (foto, rotulo) => {
      const div = document.createElement("div");
      div.className = "postura-col";
      const img = document.createElement("img");
      img.alt = `Foto de postura de ${formatarData(foto.data)}`;
      img.src = URL.createObjectURL(foto.blob);
      img.addEventListener("load", () => URL.revokeObjectURL(img.src), { once: true });
      const cap = document.createElement("div");
      cap.className = "postura-cap";
      cap.innerHTML = `<b></b><span></span>`;
      cap.querySelector("b").textContent = rotulo;
      cap.querySelector("span").textContent = formatarData(foto.data);
      div.append(img, cap);
      return div;
    };

    grade.appendChild(coluna(primeira, "Primeira"));
    if (ultima) grade.appendChild(coluna(ultima, "Mais recente"));
    corpo.appendChild(grade);

    const resumo = document.createElement("p");
    resumo.className = "prev-hint";
    resumo.style.marginTop = "10px";
    if (ultima && semanasEntre > 0) {
      resumo.textContent = `${semanasEntre} semana${semanasEntre > 1 ? "s" : ""} entre as duas · ${fotos.length} fotos no total. Mudança de postura aparece a partir de 6-8 semanas — antes disso não espere ver diferença.`;
    } else {
      resumo.textContent = "Só uma foto até agora. A comparação começa a valer na segunda, daqui a 4 semanas.";
    }
    corpo.appendChild(resumo);
  }

  const status = document.createElement("p");
  status.className = "prev-hint";
  status.style.cssText = "margin-top:8px; color:var(--accent);";
  if (fotos.length === 0) {
    status.textContent = "Próxima foto: hoje";
  } else if (diasRestantes === 0) {
    status.textContent = "Já dá pra tirar a próxima foto";
  } else {
    status.textContent = `Próxima foto em ${diasRestantes} dia${diasRestantes > 1 ? "s" : ""}`;
  }
  corpo.appendChild(status);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";
  input.style.display = "none";
  input.addEventListener("change", async () => {
    const arquivo = input.files?.[0];
    if (!arquivo) return;
    await registrarFotoPostura(db, { data: hoje, blob: arquivo });
    input.value = "";
    if (aoAtualizar) await aoAtualizar();
  });

  const botao = document.createElement("button");
  botao.type = "button";
  botao.className = "swap-pill";
  botao.style.cssText = "width:100%; margin-top:12px; background:var(--accent); color:var(--accent-ink);";
  botao.textContent = fotos.length === 0 ? "Tirar a primeira foto" : "Adicionar foto de hoje";
  botao.addEventListener("click", () => input.click());
  corpo.append(input, botao);

  const comoTirar = document.createElement("details");
  comoTirar.className = "explicacao-execucao";
  comoTirar.style.marginTop = "12px";
  const sum = document.createElement("summary");
  sum.textContent = "Como tirar pra comparação valer";
  comoTirar.appendChild(sum);
  for (const linha of COMO_TIRAR) {
    const p = document.createElement("p");
    p.textContent = linha;
    comoTirar.appendChild(p);
  }
  const privacidade = document.createElement("p");
  privacidade.style.cssText = "color:var(--ink-faint); margin-top:10px;";
  privacidade.textContent = "As fotos ficam só neste aparelho, no armazenamento do próprio app. Nada é enviado pra lugar nenhum.";
  comoTirar.appendChild(privacidade);
  corpo.appendChild(comoTirar);

  if (fotos.length > 0) {
    const apagar = document.createElement("button");
    apagar.type = "button";
    apagar.className = "pular-treino-btn";
    apagar.style.cssText = "margin:10px auto 0; display:block; color:var(--ink-faint);";
    apagar.textContent = "Apagar a foto mais recente";
    apagar.addEventListener("click", async () => {
      const alvo = fotos[fotos.length - 1];
      if (!confirm(`Apagar a foto de ${formatarData(alvo.data)}?`)) return;
      await excluirFotoPostura(db, alvo.id);
      if (aoAtualizar) await aoAtualizar();
    });
    corpo.appendChild(apagar);
  }

  return card;
}
