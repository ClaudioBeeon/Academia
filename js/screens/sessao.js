// js/screens/sessao.js
import { getAll } from "../data/db.js";
import { getEquipamento } from "../data/equipamento.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { montarTelaFila } from "./fila.js";
import { montarTelaExecucao } from "./execucao.js";
import { montarTelaRelatorio } from "./relatorio.js";

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarFluxoSessao(db, { onVoltarParaHoje, onAbrirHistorico } = {}) {
  const hoje = obterDataLocal();
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const [todasAsSeries, ultimoDiaRegistrado] = await Promise.all([
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
  ]);

  const diaDaSessao = determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  let diaPersistido = Boolean(ultimoDiaRegistrado && ultimoDiaRegistrado.data === hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);

  const { exerciciosHoje } = prepararSessaoDoDia({ todosExercicios, protocolo, todasAsSeries, hoje, diaInfo });

  const root = document.createElement("div");
  let estadoAtual = "fila";
  let indiceExercicioAtual = 0;
  let explicacaoJaMostrada = false;
  let telaAtual = null;
  const prsDaSessao = [];

  const persistirDiaSeNecessario = async () => {
    if (!diaPersistido) {
      await registrarDiaDaSessao(db, diaDaSessao, hoje);
      diaPersistido = true;
    }
  };

  async function renderizar() {
    if (telaAtual && telaAtual._dispose) {
      telaAtual._dispose();
    }
    root.innerHTML = "";
    let tela;
    if (estadoAtual === "fila") {
      tela = await montarTelaFila(db, { diaInfo, exerciciosHoje, hoje }, {
        onExecutar: async (indice) => {
          indiceExercicioAtual = indice;
          estadoAtual = "execucao";
          await renderizar();
        },
        onFinalizarSessao: async () => {
          estadoAtual = "relatorio";
          await renderizar();
        },
        onVoltar: onVoltarParaHoje,
      });
    } else if (estadoAtual === "execucao") {
      const exercicio = exerciciosHoje[indiceExercicioAtual];
      const mostrarExplicacaoAberta = !explicacaoJaMostrada && Boolean(exercicio.observacoesExecucao);
      if (exercicio.observacoesExecucao) {
        explicacaoJaMostrada = true;
      }
      tela = await montarTelaExecucao(db, {
        exercicio,
        indice: indiceExercicioAtual + 1,
        total: exerciciosHoje.length,
        todosExercicios,
        protocolo,
        equipamento,
        hoje,
        mostrarExplicacaoAberta,
      }, {
        onFechar: async () => {
          estadoAtual = "fila";
          await renderizar();
        },
        onProximoExercicio: async () => {
          if (indiceExercicioAtual < exerciciosHoje.length - 1) {
            indiceExercicioAtual++;
            await renderizar();
          } else {
            estadoAtual = "relatorio";
            await renderizar();
          }
        },
        onAbrirHistorico,
        onSerieRegistrada: persistirDiaSeNecessario,
        onPrsDetectados: (prs) => { prsDaSessao.push(...prs); },
      });
    } else {
      await registrarDiaDaSessao(db, diaDaSessao, hoje, true);
      diaPersistido = true;
      tela = await montarTelaRelatorio(db, { hoje, prsDaSessao }, {
        onConcluir: onVoltarParaHoje,
      });
    }
    root.appendChild(tela);
    telaAtual = tela;
  }

  await renderizar();
  return root;
}
