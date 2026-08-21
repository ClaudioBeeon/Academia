// js/screens/biblioteca.js
import { getAll, put } from "../data/db.js";
import { criarIconeExercicio } from "./iconeExercicio.js";

export async function montarTelaBiblioteca(db, { aoVoltar } = {}) {
  const root = document.createElement("div");
  root.className = "tela-biblioteca";

  const header = document.createElement("header");
  header.className = "top";
  header.innerHTML = `<div class="date-label">Config</div><div class="day-title">Biblioteca de exercícios</div>`;
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
  head.querySelector("div").prepend(criarIconeExercicio(exercicio.id, 48));
  head.querySelector(".exercise-name").textContent = exercicio.nome;
  head.querySelector(".exercise-meta").textContent = `${exercicio.musculoPrimario} · ${exercicio.tipo}`;
  card.appendChild(head);

  const obsForm = document.createElement("form");
  obsForm.className = "sets";
  obsForm.style.display = "none";
  obsForm.innerHTML = `
    <div class="set-field" style="grid-column:1/-1;">
      <label>Observações de execução</label>
      <textarea name="obs" rows="2" style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;"></textarea>
    </div>
    <button type="submit" class="swap-pill" style="grid-column:1/-1;">Salvar</button>
  `;
  obsForm.querySelector("textarea").value = exercicio.observacoesExecucao ?? "";
  card.appendChild(obsForm);

  head.querySelector(".editar-pill").addEventListener("click", () => {
    obsForm.style.display = obsForm.style.display === "none" ? "flex" : "none";
  });

  obsForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    exercicio.observacoesExecucao = obsForm.querySelector("textarea").value;
    await put(db, "exercicios", exercicio);
    obsForm.style.display = "none";
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
    <div class="set-field" style="grid-column:1/-1;"><label>Nome</label><input name="nome" required style="width:100%; background:var(--card-2); border:1px solid var(--line); color:var(--ink); border-radius:10px; padding:8px; font:inherit;" /></div>
    <div class="set-field"><label>Músculo primário</label><input name="musculo" required placeholder="peito" style="width:100%;" /></div>
    <div class="set-field"><label>Tipo</label><input name="tipo" required placeholder="isolador" style="width:100%;" /></div>
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
