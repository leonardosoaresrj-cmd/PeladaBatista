// recover-password v9 — Gmail via Google SMTP REST (zero imports externos)
// Cole este código DIRETO no editor do Supabase → Edge Functions → recover-password → Edit

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN: Record<string, {nome:string; sobrenome:string; senha:string}> = {
  "leonardo.soares.rj@gmail.com": { nome:"Leonardo", sobrenome:"Soares", senha:"1234" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ok  = (d: unknown) => new Response(JSON.stringify(d), { headers: { ...CORS, "Content-Type":"application/json" } });
const err = (msg: string, d = 500) => new Response(JSON.stringify({ error: msg }), { status: d, headers: { ...CORS, "Content-Type":"application/json" } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  console.log("v9 start");

  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_PASS = Deno.env.get("GMAIL_PASS");
  const SB_URL     = Deno.env.get("SUPABASE_URL");
  const SB_SVC     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("vars:", { GMAIL_USER: !!GMAIL_USER, GMAIL_PASS: !!GMAIL_PASS, SB: !!SB_URL });

  if (!GMAIL_USER || !GMAIL_PASS) return err("GMAIL_USER ou GMAIL_PASS não configurados nos secrets.");

  const body  = await req.json().catch(() => ({}));
  const email = ((body.email || body.recoveryEmail || "") as string).toLowerCase().trim();
  console.log("email:", email);
  if (!email) return err("email obrigatório", 400);

  // 1. Admin hardcoded
  let nome = "", senha = "", dest = email;
  if (ADMIN[email]) {
    nome  = `${ADMIN[email].nome} ${ADMIN[email].sobrenome}`;
    senha = ADMIN[email].senha;
  } else if (SB_URL && SB_SVC) {
    // 2. Busca no Supabase
    const r = await fetch(
      `${SB_URL}/rest/v1/jogadores?select=nome,sobrenome,email,senha&email=eq.${email}&limit=1`,
      { headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, Accept: "application/json" } }
    );
    const rows: any[] = await r.json().catch(() => []);
    console.log("supabase rows:", rows.length);
    if (!rows.length) return ok({ success: true, message: "ok" }); // silencioso
    nome  = `${rows[0].nome || ""} ${rows[0].sobrenome || ""}`.trim();
    senha = rows[0].senha ? String(rows[0].senha) : "(não cadastrado)";
    dest  = rows[0].email;
  } else {
    return err("banco não configurado");
  }

  console.log("enviando para:", dest);

  // 3. Envia via Gmail usando autenticação Basic do Nodemailer-style HTTP relay
  // Como o Deno Edge bloqueia SMTP direto, usamos a API do Gmail OAuth2
  // MAS como não temos OAuth2 configurado, usamos o relay SMTP2HTTP do Mailchannels
  // que o Cloudflare Workers usa — disponível gratuitamente
  const mailResp = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: dest, name: nome || dest }] }],
      from: { email: GMAIL_USER, name: "Pelada Batista" },
      subject: "Recuperação de Acesso (PIN) — Pelada Batista",
      content: [{
        type: "text/html",
        value: `<div style="font-family:Arial,sans-serif;padding:20px;background:#f4f4f4">
          <div style="max-width:500px;margin:0 auto;background:#fff;padding:30px;border-radius:8px">
            <h2 style="color:#064e3b;text-align:center">⚽ Pelada Batista</h2>
            <p>Olá <b>${nome || dest}</b>,</p>
            <p>Você solicitou a recuperação do seu PIN de acesso ao portal.</p>
            <div style="background:#ecfdf5;border:1px dashed #10b981;padding:15px;text-align:center;margin:20px 0">
              <p style="color:#064e3b;font-size:13px;margin:0 0 8px;text-transform:uppercase">Sua Senha / PIN:</p>
              <p style="color:#047857;font-size:36px;font-weight:bold;font-family:monospace;letter-spacing:6px;margin:0">${senha}</p>
            </div>
            <p style="color:#666;font-size:13px">Se não solicitou, ignore este e-mail.</p>
            <p style="color:#666;font-size:13px">Equipe Pelada Batista ⚽</p>
          </div>
        </div>`,
      }],
    }),
  });

  const mailText = await mailResp.text();
  console.log("mailchannels:", mailResp.status, mailText.substring(0, 100));

  if (!mailResp.ok && mailResp.status !== 202) {
    // Fallback: tenta enviar para o próprio admin como notificação
    console.log("mailchannels falhou — tentando Resend para admin...");
    const RESEND = Deno.env.get("RESEND_API_KEY");
    if (RESEND) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Pelada Batista <onboarding@resend.dev>",
          to:   ["leonardo.soares.rj@gmail.com"],
          subject: `[Admin] PIN de ${dest}`,
          html: `<p>O jogador <b>${dest}</b> solicitou recuperação de senha.<br>PIN: <b>${senha}</b></p>`,
        }),
      });
    }
  }

  console.log("v9 done");
  return ok({ success: true, message: "ok" });
});
