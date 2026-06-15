// recover-password v10 — Gmail SMTP nativo via Deno TCP
// Sem imports externos além do deno std

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADMIN: Record<string, {nome:string; sobrenome:string; senha:string}> = {
  "leonardo.soares.rj@gmail.com": { nome:"Leonardo", sobrenome:"Soares", senha:"1234" },
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const jsonOk  = (d: unknown) => new Response(JSON.stringify(d), { headers:{...CORS,"Content-Type":"application/json"} });
const jsonErr = (msg: string, s=500) => new Response(JSON.stringify({error:msg}), { status:s, headers:{...CORS,"Content-Type":"application/json"} });

// Codifica base64 para autenticação SMTP
function b64(s: string): string {
  return btoa(unescape(encodeURIComponent(s)));
}

// Constrói email MIME com HTML
function buildMime(from: string, to: string, subject: string, html: string): string {
  const boundary = "----=_Part_" + Math.random().toString(36).slice(2);
  return [
    `From: Pelada Batista <${from}>`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${b64(subject)}?=`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset=UTF-8`,
    `Content-Transfer-Encoding: base64`,
    ``,
    b64(html),
    `--${boundary}--`,
  ].join("\r\n");
}

// Envia email via Gmail SMTP usando TLS nativo do Deno
async function sendGmail(user: string, pass: string, to: string, subject: string, html: string): Promise<void> {
  // Conecta ao Gmail SMTP port 465 (SSL)
  const conn = await Deno.connectTls({
    hostname: "smtp.gmail.com",
    port: 465,
  });

  const enc = new TextEncoder();
  const dec = new TextDecoder();

  async function read(): Promise<string> {
    const buf = new Uint8Array(4096);
    const n = await conn.read(buf);
    const line = dec.decode(buf.subarray(0, n ?? 0));
    console.log("SMTP ←", line.trim().substring(0, 80));
    return line;
  }

  async function write(cmd: string): Promise<void> {
    console.log("SMTP →", cmd.trim().substring(0, 80));
    await conn.write(enc.encode(cmd + "\r\n"));
  }

  // Handshake SMTP
  await read(); // 220 smtp.gmail.com ready
  await write("EHLO peladabatista");
  // Lê todas as linhas do EHLO
  let line = "";
  do { line = await read(); } while (line.startsWith("250-"));

  // Login
  await write("AUTH LOGIN");
  await read(); // 334 VXNlcm5hbWU6
  await write(b64(user));
  await read(); // 334 UGFzc3dvcmQ6
  await write(b64(pass));
  const authResp = await read();
  if (!authResp.startsWith("235")) {
    conn.close();
    throw new Error("Autenticação Gmail falhou: " + authResp.trim());
  }

  // Envelope
  await write(`MAIL FROM:<${user}>`);
  await read(); // 250

  await write(`RCPT TO:<${to}>`);
  await read(); // 250

  await write("DATA");
  await read(); // 354

  // Corpo do email
  const mime = buildMime(user, to, subject, html);
  await write(mime + "\r\n.");
  const dataResp = await read(); // 250
  if (!dataResp.startsWith("250")) {
    conn.close();
    throw new Error("Falha no envio: " + dataResp.trim());
  }

  await write("QUIT");
  conn.close();
}

// ─── Handler principal ───────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  console.log("v10 start");

  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_PASS = Deno.env.get("GMAIL_PASS");
  const SB_URL     = Deno.env.get("SUPABASE_URL");
  const SB_SVC     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("vars:", { gmail: !!GMAIL_USER, pass: !!GMAIL_PASS, sb: !!SB_URL });

  if (!GMAIL_USER || !GMAIL_PASS) {
    return jsonErr("GMAIL_USER ou GMAIL_PASS não configurados.");
  }

  const body  = await req.json().catch(() => ({}));
  const email = ((body.email || body.recoveryEmail || "") as string).toLowerCase().trim();

  console.log("email:", email);
  if (!email) return jsonErr("email obrigatório", 400);

  // 1. Admin hardcoded
  let nomeCompleto = "";
  let textoSenha   = "";
  let destEmail    = email;

  if (ADMIN[email]) {
    nomeCompleto = `${ADMIN[email].nome} ${ADMIN[email].sobrenome}`;
    textoSenha   = ADMIN[email].senha;
    console.log("admin hardcoded:", email);
  } else if (SB_URL && SB_SVC) {
    // 2. Busca no Supabase
    const r = await fetch(
      `${SB_URL}/rest/v1/jogadores?select=nome,sobrenome,email,senha&email=eq.${email}&limit=1`,
      { headers: { apikey: SB_SVC, Authorization: `Bearer ${SB_SVC}`, Accept: "application/json" } }
    );
    const rows: any[] = await r.json().catch(() => []);
    console.log("supabase rows:", rows.length);

    if (!rows.length) {
      console.log("não encontrado — retorno silencioso");
      return jsonOk({ success: true, message: "ok" });
    }
    nomeCompleto = `${rows[0].nome || ""} ${rows[0].sobrenome || ""}`.trim() || "Atleta";
    textoSenha   = rows[0].senha ? String(rows[0].senha) : "(não cadastrado)";
    destEmail    = rows[0].email;
  } else {
    return jsonErr("banco não configurado");
  }

  const html = `
    <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
      <div style="max-width:500px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1)">
        <h2 style="color:#064e3b;text-align:center">⚽ Pelada Batista</h2>
        <p style="color:#333">Olá <b>${nomeCompleto || destEmail}</b>,</p>
        <p style="color:#333">Você solicitou a recuperação do seu PIN de acesso ao portal.</p>
        <div style="background:#ecfdf5;border:1px dashed #10b981;padding:15px;text-align:center;margin:20px 0">
          <p style="color:#064e3b;font-size:13px;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Sua Senha / PIN:</p>
          <p style="color:#047857;font-size:36px;font-weight:bold;font-family:monospace;letter-spacing:6px;margin:0">${textoSenha}</p>
        </div>
        <p style="color:#666;font-size:13px">Se não solicitou, ignore este e-mail.</p>
        <p style="color:#666;font-size:13px">Equipe Pelada Batista ⚽</p>
      </div>
    </div>`;

  console.log("enviando para:", destEmail);

  try {
    await sendGmail(
      GMAIL_USER,
      GMAIL_PASS,
      destEmail,
      "Recuperação de Acesso (PIN) — Pelada Batista",
      html
    );
    console.log("✅ email enviado para", destEmail);
    return jsonOk({ success: true, message: "E-mail enviado com sucesso" });
  } catch (e) {
    console.error("Erro Gmail:", String(e));
    return jsonErr("Falha ao enviar: " + String(e));
  }
});
