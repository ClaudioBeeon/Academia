# Sincronização com Supabase

O app funciona 100% sem isso — o IndexedDB local é sempre a fonte principal.
Isto aqui é opcional: guarda uma cópia na nuvem e mantém o app igual em mais
de um aparelho.

## Passo a passo (uma vez só)

1. Crie uma conta grátis em [supabase.com](https://supabase.com) e um novo
   projeto (escolha uma senha de banco forte — não precisa lembrar, só é
   usada internamente).
2. No painel do projeto, vá em **SQL Editor → New query**, cole o conteúdo
   de [`schema.sql`](./schema.sql) e clique em **Run**. Isso cria a tabela,
   as políticas de segurança (RLS) e o espaço pras fotos de postura.
3. Vá em **Project Settings → API**. Copie:
   - **Project URL** (algo como `https://xxxxx.supabase.co`)
   - **anon public key** (a chave pública — é seguro deixar ela no app,
     as políticas do passo 2 são o que protege os dados de verdade)
4. Abra o app → **Config → Sincronização (Supabase)** → cole os dois valores
   → **Salvar credenciais**.
5. Ainda na mesma seção, **Criar conta** com um e-mail e senha (só seus,
   não precisam ser os mesmos de nenhum outro serviço).
   - Se o projeto pedir confirmação por e-mail (padrão do Supabase), confirme
     antes de tentar entrar. Pra desligar essa exigência: **Authentication →
     Providers → Email → Confirm email → desligar**.
6. **Entrar** com o mesmo e-mail e senha.

A partir daí, toda gravação no app (série registrada, hábito marcado, foto de
postura) entra numa fila local e sobe sozinha assim que houver internet — sem
precisar abrir esta tela de novo. Com sinal instável (o caso comum de
academia), o que não sobe na hora fica na fila e tenta de novo automaticamente.

## Um segundo aparelho

Repita só os passos 4-6 (não o schema.sql — a tabela já existe), entrando com
o mesmo e-mail e senha. No primeiro login o app traz tudo que já está no
servidor antes de começar a mandar dados novos.

## O que NÃO fazer

- Não crie tabelas ou buckets extras — a tabela genérica cobre qualquer
  funcionalidade nova do app automaticamente, sem migração.
- Não delete o bucket `fotos-postura` nem a tabela `sync_records` com dados
  dentro — normal só se você quiser mesmo apagar tudo do zero.
