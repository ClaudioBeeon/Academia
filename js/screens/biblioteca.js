// js/screens/biblioteca.js
import { getAll, put } from "../data/db.js";
import { criarIconeExercicio } from "./iconeExercicio.js";
import { subirImagemExercicio } from "../data/supabaseClient.js";

export async function montarTelaBiblioteca(db, { aoVoltar } = {}) {
  const root = document.createElement("div");
  root.className = "tela-biblioteca";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div><div class="date-label">Config</div><div class="day-title">Biblioteca de exercícios</div></div>`;
  root.appendChild(header);

  if (aoVoltar) {
    const voltar = document.createElement("button");
    voltar.type = "button";
    voltar.className = "swap-pill";
    voltar.style.margin = "12px 0 0";
    voltar.textContent = "← Voltar";
    voltar.addEventListener("click", aoVoltar);
    root.appendChild(voltar);
  }

  const main = document.createElement("main");
  root.appendChild(main);

  const exercicios = await getAll(db, "exercicios");
  exercicios.sort((a, b) => a.nome.localeCompare(b.nome));
  for (const exercicio of exercicios) {
    main.appendChild(criarLinhaExercicio(db, exercicio));
  }

  main.appendChild(criarFormNovoExercicio(db, main));

  return root;
}

function criarLinhaExercicio(db, exercicio) {
  const card = document.createElement("section");
  card.className = "exercise-card";

  const head = document.createElement("div");
  head.className = "exercise-head";
  head.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <div>
        <div class="exercise-name"></div>
        <div class="exercise-meta"></div>
      </div>
    </div>
    <button class="swap-pill editar-pill" type="button">Editar</button>
  `;
  let icone = criarIconeExercicio(exercicio.id, 48, exercicio.imagemUrl);
  head.querySelector("div").prepend(icone);
  head.querySelector(".exercise-name").textContent = exercicio.nome;
  head.querySelector(".exercise-meta").textContent = `${exercicio.musculoPrimario} · ${exercicio.tipo}`;
  card.appendChild(head);

  const obsForm = document.createElement("form");
  obsForm.className = "sets";
  obsForm.style.display = "none";
  obsForm.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Imagem do exercício<input name="imagem" type="file" accept="image/*" style="width:100%;" /></label>
      <div class="prev-hint imagem-status" style="margin-top:4px;"></div>
    </div>
    <div class="set-field" style="grid-column:1/-1;">
      <label>Observações de execução<textarea name="obs" rows="2" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></textarea></label>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
  `;
  obsForm.querySelector("textarea").value = exercicio.observacoesExecucao ?? "";
  card.appendChild(obsForm);

  head.querySelector(".editar-pill").addEventListener("click", () => {
    obsForm.style.display = obsForm.style.display === "none" ? "flex" : "none";
  });

  const imagemStatus = obsForm.querySelector(".imagem-status");

  obsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const arquivo = obsForm.imagem.files?.[0];
    if (arquivo) {
      const botao = obsForm.querySelector("button[type=submit]");
      botao.disabled = true;
      imagemStatus.textContent = "Subindo imagem...";
      try {
        exercicio.imagemUrl = await subirImagemExercicio(exercicio.id, arquivo);
        icone.replaceWith(criarIconeExercicio(exercicio.id, 48, exercicio.imagemUrl));
        icone = head.querySelector(".icone-exercicio");
        imagemStatus.textContent = "Imagem salva.";
      } catch (err) {
        imagemStatus.textContent = err.message || "Falha ao subir a imagem.";
        botao.disabled = false;
        return;
      }
      botao.disabled = false;
    }
    exercicio.observacoesExecucao = obsForm.querySelector("textarea").value;
    await put(db, "exercicios", exercicio);
    obsForm.style.display = "none";
    obsForm.imagem.value = "";
  });

  return card;
}

function criarFormNovoExercicio(db, main) {
  const card = document.createElement("section");
  card.className = "exercise-card";
  card.innerHTML = `<div class="exercise-head"><div class="exercise-name">Novo exercício</div></div>`;

  const form = document.createElement("form");
  form.className = "sets";
  form.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;"><label>Nome<input name="nome" required style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></label></div>
    <div class="set-field"><label>Músculo primário<input name="musculo" required placeholder="peito" style="width:100%;" /></label></div>
    <div class="set-field"><label>Tipo<input name="tipo" required placeholder="isolador" style="width:100%;" /></label></div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Adicionar</button>
  `;
  card.appendChild(form);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const nome = form.nome.value.trim();
    const musculo = form.musculo.value.trim();
    const tipo = form.tipo.value.trim();
    if (!nome || !musculo || !tipo) return;

    const novo = {
      id: `custom_${Date.now()}`,
      nome,
      musculoPrimario: musculo,
      musculosSecundarios: [],
      tipo,
      equipamento: "",
      cargaAlongada: false,
      incrementoMinimo_kg: 1,
      observacoesExecucao: "",
    };
    await put(db, "exercicios", novo);
    form.reset();
    main.insertBefore(criarLinhaExercicio(db, novo), card);
  });

  return card;
}
