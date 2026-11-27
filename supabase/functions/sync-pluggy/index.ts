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

// O Nubank data as parcelas 2+ como 00:00 (BRT) do último dia do mês anterior
// à fatura (ex.: 2026-10-31T03:00:00.000Z para a fatura de novembro).
// Essas vão para o dia 1 do mês seguinte; o original fica no payload.
function dataFatura(t: any): string {
  const raw = String(t.date), d = raw.slice(0, 10);
  const n = t.creditCardMetadata?.installmentNumber;
  if (!(n >= 2) || !raw.endsWith("T03:00:00.000Z")) return d;
  const x = new Date(d + "T12:00:00Z");
  const amanha = new Date(x.getTime() + 864e5);
  if (amanha.getUTCDate() !== 1) return d;
  return amanha.toISOString().slice(0, 10);
}

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
      // v2: paginação por cursor; segue "next" (URL ou cursor) até vir nulo.
      let prox: string | null = API + "/v2/transactions?accountId=" + encodeURIComponent(c.id) +
        "&dateFrom=" + desde;
      for (let volta = 0; prox && volta < 200; volta++) {
        const r = await fetch(prox, { headers: H });
        if (!r.ok) return json({ erro: "transacoes Pluggy falhou (" + r.status + "): " +
          (await r.text()).slice(0, 300) }, 502);
        const j = await r.json();
        const n = j.next ?? j.nextCursor ?? j.cursor?.next ?? null;
        // "next" pode vir como URL/querystring; extrai só o valor do cursor.
        const m = n ? String(n).match(/[?&]?after=([^&]+)/) : null;
        const cursor = m ? decodeURIComponent(m[1]) : n;
        prox = !cursor ? null
          : API + "/v2/transactions?accountId=" + encodeURIComponent(c.id) + "&dateFrom=" + desde +
            "&after=" + encodeURIComponent(cursor);
        const linhas = (j.results || j.data || []).map((t: any) => ({
          pluggy_id: t.id, user_id: DONO, conta_pluggy: c.id, conta_nome: c.name, conta_tipo: c.type,
          data: dataFatura(t), descricao: t.description, valor: t.amount,
          parcela_num: t.creditCardMetadata?.installmentNumber ?? null,
          parcelas_total: t.creditCardMetadata?.totalInstallments ?? null,
          status: t.status, categoria: t.category, payload: t, sincronizado_em: new Date().toISOString(),
        }));
        if (linhas.length) {
          const { error } = await service.from("pluggy_transacao").upsert(linhas, { onConflict: "pluggy_id" });
          if (error) return json({ erro: error.message }, 500);
          total += linhas.length;
        }
      }
    }
    return json({ ok: true, contas: contas.length, transacoes: total });
  } catch (e) {
    return json({ erro: String(e) }, 500);
  }
});
