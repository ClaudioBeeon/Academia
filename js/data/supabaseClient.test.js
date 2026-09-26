import { test } from "node:test";
import assert from "node:assert/strict";
import { lerLinkDoEmail } from "./supabaseClient.js";

test("lê o link do e-mail do Supabase (token + tipo)", () => {
  const r = lerLinkDoEmail("Toque aqui: https://ydlzdxqtjxbocwuzurzv.supabase.co/auth/v1/verify?token=abc123&type=recovery&redirect_to=http://localhost:3000");
  assert.deepEqual(r, { formato: "token", token: "abc123", tipo: "recovery" });
});

test("lê o endereço onde o link caiu (localhost com a sessão no #)", () => {
  const r = lerLinkDoEmail("http://localhost:3000/#access_token=AT&expires_in=3600&refresh_token=RT&token_type=bearer&type=recovery");
  assert.deepEqual(r, { formato: "sessao", accessToken: "AT", refreshToken: "RT", tipo: "recovery" });
});

test("texto sem link do Supabase não é aceito", () => {
  assert.equal(lerLinkDoEmail("oi"), null);
  assert.equal(lerLinkDoEmail("https://google.com"), null);
  assert.equal(lerLinkDoEmail(""), null);
});
