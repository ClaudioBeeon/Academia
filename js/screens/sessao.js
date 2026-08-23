// js/screens/sessao.js
import { getAll } from "../data/db.js";
import { getEquipamento } from "../data/equipamento.js";
import { excluirSeriesDoDia } from "../data/historico.js";
import { getUltimoDiaRegistrado, registrarDiaDaSessao } from "../data/sequenciaSemanal.js";
import { obterDiaPorNumero, determinarDiaDaSessao } from "../engine/sequenciaSemanal.js";
import { prepararSessaoDoDia } from "../engine/contextoSessao.js";
import { getFicha, getInicioDoBloco, definirInicioDoBloco } from "../data/ficha.js";
import { calcularSemanaDoBloco } from "../engine/fichaFixa.js";
import { montarTelaFila } from "./fila.js";
import { montarTelaExecucao } from "./execucao.js";
import { montarTelaRelatorio } from "./relatorio.js";
import { montarTelaHistorico } from "./historico.js";
import { trocarConteudo } from "./transicaoTela.js";

function obterDataLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export async function montarFluxoSessao(db, { onVoltarParaHoje, diaForcado } = {}) {
  const hoje = obterDataLocal();
  const modoPreview = diaForcado != null;
  const todosExercicios = await getAll(db, "exercicios");
  const protocolos = await getAll(db, "protocolo");
  const protocolo = protocolos[0] ?? null;
  const equipamento = await getEquipamento(db);
  const [todasAsSeries, ultimoDiaRegistrado, ficha] = await Promise.all([
    getAll(db, "historicoSeries"),
    getUltimoDiaRegistrado(db),
    getFicha(db),
  ]);

  // O bloco começa no primeiro treino aberto e a partir daí a semana do
  // mesociclo é derivada da data — o usuário não precisa marcar nada.
  let inicioDoBloco = await getInicioDoBloco(db);
  if (!inicioDoBloco && !modoPreview) {
    inicioDoBloco = hoje;
    await definirInicioDoBloco(db, hoje);
  }
  const semanaDoBloco = calcularSemanaDoBloco(inicioDoBloco, hoje);

  // No modo preview (abrindo o card de um dia futuro pra só olhar/testar a
  // fila), a sessão nunca grava o ponteiro de rotação — abrir ou até
  // registrar séries aqui não pode mudar qual dia é "hoje" pro app.
  const diaDaSessao = modoPreview ? diaForcado : determinarDiaDaSessao(ultimoDiaRegistrado, hoje);
  let diaPersistido = modoPreview || Boolean(ultimoDiaRegistrado && ultimoDiaRegistrado.data === hoje);
  const diaInfo = obterDiaPorNumero(diaDaSessao);

  const { exerciciosHoje, diaDaFicha } = prepararSessaoDoDia({
    todosExercicios, protocolo, todasAsSeries, hoje, diaInfo, ficha, semanaDoBloco,
  });

  const root = document.createElement("div");
  let estadoAtual = "fila";
  let estadoAntesDoHistorico = "fila";
  let indiceExercicioAtual = 0;
  let explicacaoJaMostrada = false;
  let telaAtual = null;
  let historicoExercicio = null;
  const prsDaSessao = [];

  const persistirDiaSeNecessario = async () => {
    if (!diaPersistido) {
      await registrarDiaDaSessao(db, diaDaSessao, hoje);
      diaPersistido = true;
    }
  };

  async function renderizar(direcao = "trocarAba") {
    if (telaAtual && telaAtual._dispose) {
      telaAtual._dispose();
    }

    telaAtual = await trocarConteudo(root, async () => {
      if (estadoAtual === "fila") {
        return montarTelaFila(db, { diaInfo, exerciciosHoje, hoje, diaDaFicha, ficha, semanaDoBloco }, {
          onExecutar: async (indice) => {
            indiceExercicioAtual = indice;
            estadoAtual = "execucao";
            await renderizar("avancar");
          },
          onFinalizarSessao: async () => {
            estadoAtual = "relatorio";
            await renderizar("avancar");
          },
          onVoltar: onVoltarParaHoje,
          onPular: modoPreview ? null : async () => {
            await registrarDiaDaSessao(db, diaDaSessao, hoje, true);
            if (onVoltarParaHoje) onVoltarParaHoje();
          },
          onReiniciar: async () => {
            await excluirSeriesDoDia(db, exerciciosHoje.map((e) => e.id), hoje);
            await renderizar("trocarAba");
          },
        });
      }

      if (estadoAtual === "execucao") {
        const exercicio = exerciciosHoje[indiceExercicioAtual];
        const mostrarExplicacaoAberta = !explicacaoJaMostrada && Boolean(exercicio.observacoesExecucao);
        if (exercicio.observacoesExecucao) {
          explicacaoJaMostrada = true;
        }
        return montarTelaExecucao(db, {
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
            await renderizar("voltar");
          },
          onProximoExercicio: async () => {
            if (indiceExercicioAtual < exerciciosHoje.length - 1) {
              indiceExercicioAtual++;
            } else {
              estadoAtual = "relatorio";
            }
            await renderizar("avancar");
          },
          onAbrirHistorico: async (exercicio) => {
            historicoExercicio = exercicio;
            estadoAntesDoHistorico = estadoAtual;
            estadoAtual = "historico";
            await renderizar("avancar");
          },
          onSerieRegistrada: persistirDiaSeNecessario,
          onPrsDetectados: (prs) => { prsDaSessao.push(...prs); },
        });
      }

      if (estadoAtual === "historico") {
        return montarTelaHistorico(db, historicoExercicio, async () => {
          estadoAtual = estadoAntesDoHistorico;
          await renderizar("voltar");
        });
      }

      if (!modoPreview) {
        await registrarDiaDaSessao(db, diaDaSessao, hoje, true);
        diaPersistido = true;
      }
      return montarTelaRelatorio(db, { hoje, prsDaSessao }, {
        onConcluir: onVoltarParaHoje,
      });
    }, { direcao });
  }

  await renderizar();
  return root;
}
