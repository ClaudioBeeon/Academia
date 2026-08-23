-- Schema de sincronização — rode isto uma vez no SQL Editor do seu projeto
-- Supabase (Project → SQL Editor → New query → colar tudo → Run).
--
-- Uma única tabela genérica (sync_records) espelha todas as "gavetas" do
-- IndexedDB local (perfil, historicoSeries, habitos, fotosPostura, etc.) em
-- vez de uma tabela por gaveta — é o que deixa js/data/sync.js simples e
-- capaz de sincronizar qualquer store novo sem exigir uma migração de banco
-- toda vez que o app ganha uma funcionalidade.

create table if not exists sync_records (
  user_id      uuid not null references auth.users(id) on delete cascade,
  store_name   text not null,
  record_key   text not null,
  data         jsonb not null default '{}'::jsonb,
  storage_path text,            -- só preenchido pra fotos de postura
  deleted      boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (user_id, store_name, record_key)
);

-- RLS: cada pessoa só enxerga e escreve os próprios registros. Com a chave
-- anon (pública) exposta no app, é essa política que garante que ninguém
-- lê os dados de outra conta.
alter table sync_records enable row level security;

create policy "select own records" on sync_records
  for select using (auth.uid() = user_id);

create policy "insert own records" on sync_records
  for insert with check (auth.uid() = user_id);

create policy "update own records" on sync_records
  for update using (auth.uid() = user_id);

create policy "delete own records" on sync_records
  for delete using (auth.uid() = user_id);

-- Bucket privado pras fotos de postura. O metadado (data, observação) vai em
-- sync_records.data; o arquivo em si fica aqui, referenciado por storage_path.
insert into storage.buckets (id, name, public)
values ('fotos-postura', 'fotos-postura', false)
on conflict (id) do nothing;

-- Caminho salvo pelo app é "{user_id}/{id}.jpg" — a política usa a primeira
-- pasta do caminho pra checar que é dono do arquivo.
create policy "select own photos" on storage.objects
  for select using (
    bucket_id = 'fotos-postura'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "insert own photos" on storage.objects
  for insert with check (
    bucket_id = 'fotos-postura'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "update own photos" on storage.objects
  for update using (
    bucket_id = 'fotos-postura'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "delete own photos" on storage.objects
  for delete using (
    bucket_id = 'fotos-postura'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
