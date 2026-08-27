// scripts/supabase-login.mjs
//
// Rode isto UMA VEZ, no seu próprio terminal (nunca peça pro Claude rodar
// este script — a senha é digitada aqui, não deve aparecer em nenhuma
// conversa). Faz login no mesmo projeto Supabase que o app usa e salva a
// sessão em .supabase-session.json (local, fora do git — ver .gitignore),
// pra scripts/relatorio-treino.mjs conseguir ler seus dados sem pedir login
// de novo toda vez.
//
//   node scripts/supabase-login.mjs
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { criarClient, salvarSessao, ARQUIVO_SESSAO } from "./_supabaseSessao.mjs";

const TECLA_ENTER = new Set([String.fromCharCode(13), String.fromCharCode(10)]);
const TECLA_CTRL_C = String.fromCharCode(3);
const TECLA_BACKSPACE = new Set([String.fromCharCode(127), String.fromCharCode(8)]);

// readline não tem modo "senha" embutido. Em vez de depender de API interna
// (que muda entre versões do Node), lê teclado por teclado em modo raw e
// ecoa "*" — técnica padrão, só funciona com um terminal de verdade (TTY).
function perguntarSenha(pergunta) {
  return new Promise((resolve, reject) => {
    stdout.write(pergunta);

    if (!stdin.isTTY) {
      // Sem TTY (ex.: rodando via pipe) não tem como mascarar — cai pro
      // prompt normal do readline em vez de travar sem eco nenhum.
      const rl = createInterface({ input: stdin, output: stdout });
      rl.question("").then((resposta) => { rl.close(); resolve(resposta); });
      return;
    }

    let senha = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");

    function finalizar() {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", aoDigitar);
    }

    function aoDigitar(char) {
      if (TECLA_ENTER.has(char)) {
        finalizar();
        stdout.write("\n");
        resolve(senha);
        return;
      }
      if (char === TECLA_CTRL_C) {
        finalizar();
        stdout.write("\n");
        reject(new Error("Cancelado."));
        return;
      }
      if (TECLA_BACKSPACE.has(char)) {
        if (senha.length > 0) {
          senha = senha.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }
      senha += char;
      stdout.write("*");
    }

    stdin.on("data", aoDigitar);
  });
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const email = await rl.question("E-mail (o mesmo do app, em Configurações → Sincronização): ");
  rl.close();
  const senha = await perguntarSenha("Senha: ");

  const client = criarClient();
  const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password: senha });

  if (error) {
    console.error(`\nFalha no login: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  await salvarSessao({ access_token: data.session.access_token, refresh_token: data.session.refresh_token });
  console.log(`\nLogin salvo em ${ARQUIVO_SESSAO}. Já dá pra pedir "olha o relatório de hoje" — o Claude roda scripts/relatorio-treino.mjs sozinho a partir daqui.`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
