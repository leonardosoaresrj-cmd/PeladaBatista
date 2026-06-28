// ============================================================
// Supabase Edge Function: send-email
// CAMINHO: supabase/functions/send-email/index.ts
//
// Centraliza TODOS os envios de e-mail do sistema via
// denomailer + Gmail SMTP — mesma abordagem da recuperação
// de senha que funciona perfeitamente.
//
// O server.ts (Render/Node.js) chama esta função para
// evitar o bloqueio de portas SMTP do Render.
//
// VARIÁVEIS (Supabase → Edge Functions → Manage secrets):
//   GMAIL_USER = peladabatista.tijuca@gmail.com
//   GMAIL_PASS = xxxx xxxx xxxx xxxx (Senha de App — 16 chars)
// ============================================================

import { serve }      from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), {
      status: s,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  try {
    const GMAIL_USER = Deno.env.get("GMAIL_USER");
    const GMAIL_PASS = Deno.env.get("GMAIL_PASS");

    console.log("[send-email] vars:", { gmail: !!GMAIL_USER, pass: !!GMAIL_PASS });

    if (!GMAIL_USER || !GMAIL_PASS) {
      console.error("[send-email] GMAIL_USER ou GMAIL_PASS ausentes nos secrets");
      return json({ error: "GMAIL_USER ou GMAIL_PASS não configurados." }, 500);
    }

    const { to, subject, html } = await req.json();

    if (!to || !subject || !html) {
      return json({ error: "Campos obrigatórios ausentes: to, subject, html" }, 400);
    }

    console.log(`[send-email] enviando para: ${to} | assunto: ${subject.substring(0, 50)}`);

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: GMAIL_USER,
          password: GMAIL_PASS,
        },
      },
    });

    await client.send({
      from:    `"Pelada Batista" <${GMAIL_USER}>`,
      to,
      subject,
      html,
    });

    await client.close();

    console.log(`[send-email] ✅ e-mail enviado para ${to}`);
    return json({ success: true, message: "E-mail enviado com sucesso via Gmail." });

  } catch (err) {
    console.error("[send-email] erro:", String(err));
    return json({ error: "Falha ao enviar o e-mail.", details: String(err) }, 500);
  }
});
