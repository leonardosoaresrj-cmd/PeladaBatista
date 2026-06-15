// ============================================================
// Supabase Edge Function: recover-password (v8 — Gmail SMTP)
//
// MUDANÇA v8:
//   Substitui Resend (que exige domínio verificado para enviar
//   a outros destinatários) pelo Gmail SMTP com Senha de App.
//   Usa o SmtpClient nativo do Deno — sem esm.sh, sem crash.
//
// VARIÁVEIS NECESSÁRIAS (Supabase → Edge Functions → Secrets):
//   GMAIL_USER = peladabatista.tijuca@gmail.com
//   GMAIL_PASS = xxxx xxxx xxxx xxxx  (Senha de App do Google — 16 caracteres)
//
// COMO GERAR A SENHA DE APP DO GMAIL:
//   Veja o passo a passo no guia abaixo.
// ============================================================

import { serve }      from 'https://deno.land/std@0.168.0/http/server.ts';
import { SmtpClient } from 'https://deno.land/x/smtp@v0.7.0/smtp.ts';

const ADMIN_HARDCODED: Record<string, { nome: string; sobrenome: string; senha: string }> = {
  'leonardo.soares.rj@gmail.com': {
    nome:      'Leonardo',
    sobrenome: 'Soares',
    senha:     '1234',
  },
};

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonResp = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  console.log('[recover-password] v8 — Gmail SMTP');

  try {
    const GMAIL_USER     = Deno.env.get('GMAIL_USER');
    const GMAIL_PASS     = Deno.env.get('GMAIL_PASS');
    const SUPABASE_URL   = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SVC   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('[recover-password] Vars:', {
      temGmail:   !!GMAIL_USER,
      temPass:    !!GMAIL_PASS,
      temSupabase:!!SUPABASE_URL,
    });

    if (!GMAIL_USER || !GMAIL_PASS) {
      return jsonResp({ error: 'GMAIL_USER ou GMAIL_PASS não configurados nos secrets.' }, 500);
    }

    const body       = await req.json();
    const emailInput = (body.email || body.recoveryEmail || '').toString().toLowerCase().trim();

    console.log('[recover-password] Email recebido:', emailInput || '(vazio)');

    if (!emailInput) {
      return jsonResp({ error: 'E-mail é obrigatório.' }, 400);
    }

    // ── 1. Admin hardcoded ────────────────────────────────────────────────────
    let nomeCompleto: string;
    let textoSenha:   string;
    let emailEnvio:   string;

    const adminData = ADMIN_HARDCODED[emailInput];

    if (adminData) {
      console.log('[recover-password] Admin hardcoded:', emailInput);
      nomeCompleto = `${adminData.nome} ${adminData.sobrenome}`;
      textoSenha   = adminData.senha;
      emailEnvio   = emailInput;

    } else if (SUPABASE_URL && SUPABASE_SVC) {
      // ── 2. Busca no Supabase ──────────────────────────────────────────────
      console.log('[recover-password] Buscando no Supabase...');

      const dbResp = await fetch(
        `${SUPABASE_URL}/rest/v1/jogadores?select=nome,sobrenome,email,senha&email=eq.${emailInput}&limit=1`,
        {
          headers: {
            'apikey':        SUPABASE_SVC,
            'Authorization': `Bearer ${SUPABASE_SVC}`,
            'Accept':        'application/json',
          },
        }
      );

      const dbText = await dbResp.text();
      console.log('[recover-password] Supabase HTTP:', dbResp.status, '|', dbText.substring(0, 150));

      let jogadores: any[] = [];
      try { jogadores = JSON.parse(dbText); } catch { jogadores = []; }

      if (!jogadores?.length) {
        console.log('[recover-password] Email não encontrado — retorno silencioso.');
        return jsonResp({ success: true, message: 'E-mail enviado com sucesso' });
      }

      const jog  = jogadores[0];
      nomeCompleto = `${jog.nome || ''} ${jog.sobrenome || ''}`.trim() || 'Atleta';
      textoSenha   = jog.senha ? String(jog.senha) : '(PIN não cadastrado)';
      emailEnvio   = jog.email;

    } else {
      return jsonResp({ error: 'Configuração do banco ausente.' }, 500);
    }

    console.log('[recover-password] Enviando e-mail para:', emailEnvio);

    // ── Envia via Gmail SMTP ──────────────────────────────────────────────────
    const client = new SmtpClient();

    await client.connectTLS({
      hostname: 'smtp.gmail.com',
      port:     465,
      username: GMAIL_USER,
      password: GMAIL_PASS,
    });

    await client.send({
      from:    GMAIL_USER,
      to:      emailEnvio,
      subject: 'Recuperação de Acesso (PIN) — Pelada Batista',
      html: `
        <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
          <div style="max-width:500px;margin:0 auto;background:#fff;padding:30px;
                      border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1)">
            <h2 style="color:#064e3b;text-align:center;font-size:24px;margin-bottom:20px;">
              ⚽ Pelada Batista
            </h2>
            <p style="color:#333;font-size:16px;">Olá <b>${nomeCompleto}</b>,</p>
            <p style="color:#333;font-size:16px;">
              Você solicitou a recuperação do seu PIN de acesso ao portal.
            </p>
            <div style="background:#ecfdf5;border:1px dashed #10b981;
                        padding:15px;text-align:center;margin:25px 0;">
              <p style="color:#064e3b;font-size:14px;margin:0 0 5px;
                         text-transform:uppercase;letter-spacing:1px;">
                Sua Senha / PIN é:
              </p>
              <p style="color:#047857;font-size:32px;font-weight:bold;
                         font-family:monospace;letter-spacing:5px;margin:0;">
                ${textoSenha}
              </p>
            </div>
            <p style="color:#666;font-size:14px;">
              Se você não solicitou esta recuperação, ignore este e-mail.
            </p>
            <br/>
            <p style="color:#666;font-size:14px;">
              Um abraço,<br/>Equipe Pelada Batista
            </p>
          </div>
        </div>
      `,
    });

    await client.close();

    console.log('[recover-password] ✅ E-mail enviado via Gmail para', emailEnvio);
    return jsonResp({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro:', String(err));
    return jsonResp({ error: 'Erro ao enviar o e-mail.', details: String(err) }, 500);
  }
});
