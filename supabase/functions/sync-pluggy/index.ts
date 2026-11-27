import { createClient } from "jsr:@supabase/supabase-js@2";

// Unico usuario autorizado (sandbox Open Finance).
const DONO = "84591a7c-ebfc-4330-9d74-c09301009d11";
const API = "https://api.pluggy.ai";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ erro: "metodo" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u, error: eu } = await service.auth.getUser(token);
  if (eu || !u?.user || u.user.id !== DONO) return json({ erro: "proibido" }, 403);

  const cid = Deno.env.get("PLUGGY_CLIENT_ID"), sec = Deno.env.get("PLUGGY_CLIENT_SECRET"),
        item = Deno.env.get("PLUGGY_ITEM_ID");
  if (!cid || !sec || !item) return json({ erro: "secrets da Pluggy ausentes" }, 500);

  try {
    const a = await fetch(API + "/auth", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: cid, clientSecret: sec }) });
    if (!a.ok) return json({ erro: "auth Pluggy falhou (" + a.status + ")" }, 502);
    const { apiKey } = await a.json();
    const H = { "X-API-KEY": apiKey };

    const ac = await fetch(API + "/accounts?itemId=" + encodeURIComponent(item), { headers: H });
    if (!ac.ok) return json({ erro: "contas Pluggy falhou (" + ac.status + ")" }, 502);
    const contas = (await ac.json()).results || [];

    const desde = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
    let total = 0;
    for (const c of contas) {
      for (let p = 1; ; p++) {
        const r = await fetch(API + "/transactions?accountId=" + c.id + "&from=" + desde +
          "&pageSize=500&page=" + p, { headers: H });
        if (!r.ok) return json({ erro: "transacoes Pluggy falhou (" + r.status + ")" }, 502);
        const j = await r.json();
        const linhas = (j.results || []).map((t: any) => ({
          pluggy_id: t.id, user_id: DONO, conta_pluggy: c.id, conta_nome: c.name, conta_tipo: c.type,
          data: String(t.date).slice(0, 10), descricao: t.description, valor: t.amount,
          parcela_num: t.creditCardMetadata?.installmentNumber ?? null,
          parcelas_total: t.creditCardMetadata?.totalInstallments ?? null,
          status: t.status, categoria: t.category, payload: t, sincronizado_em: new Date().toISOString(),
        }));
        if (linhas.length) {
          const { error } = await service.from("pluggy_transacao").upsert(linhas, { onConflict: "pluggy_id" });
          if (error) return json({ erro: error.message }, 500);
          total += linhas.length;
        }
        if (p >= (j.totalPages || 1)) break;
      }
    }
    return json({ ok: true, contas: contas.length, transacoes: total });
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});
