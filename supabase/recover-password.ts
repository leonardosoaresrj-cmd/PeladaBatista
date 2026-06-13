// ============================================================
// Supabase Edge Function: recover-password  (v2 — usa Resend)
//
// COMO FAZER O REDEPLOY:
//   Supabase → Edge Functions → recover-password → Edit → 
//   apagar tudo → colar este código → Deploy
//
// VARIÁVEL NECESSÁRIA:
//   Supabase → Edge Functions → Manage secrets → New secret:
//   Nome: RESEND_API_KEY
//   Valor: re_xxxxxxxxxxxx  (da sua conta resend.com)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  try {
    // ── Lê a variável RESEND_API_KEY ──────────────────────────────────────────
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error('[recover-password] RESEND_API_KEY ausente nas variáveis da Edge Function');
      return json({
        error: 'Serviço de e-mail não configurado. Configure RESEND_API_KEY nas variáveis da Edge Function.',
      }, 500);
    }

    // ── Valida o body ─────────────────────────────────────────────────────────
    const { email, nome, senha } = await req.json();

    if (!email || !nome || !senha) {
      return json({ error: 'Dados incompletos (email, nome e senha são obrigatórios).' }, 400);
    }

    console.log(`[recover-password] Enviando para: ${email}`);

    // ── Envia via Resend API (HTTP — funciona em Deno) ────────────────────────
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pelada Batista <onboarding@resend.dev>',
        to: [email],
        subject: 'Recuperação de Acesso (PIN) — Pelada Batista',
        html: `
          <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
            <div style="max-width:500px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1)">
              <h2 style="color:#064e3b;text-align:center;font-size:24px;margin-bottom:20px;">⚽ Pelada Batista</h2>
              <p style="color:#333;font-size:16px;">Olá <b>${nome}</b>,</p>
              <p style="color:#333;font-size:16px;">Você solicitou a recuperação do seu PIN de acesso ao portal.</p>
              <div style="background:#ecfdf5;border:1px dashed #10b981;padding:15px;text-align:center;margin:25px 0;">
                <p style="color:#064e3b;font-size:14px;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Sua Senha / PIN é:</p>
                <p style="color:#047857;font-size:32px;font-weight:bold;font-family:monospace;letter-spacing:5px;margin:0;">${senha}</p>
              </div>
              <p style="color:#666;font-size:14px;">Se você não solicitou esta recuperação, ignore este e-mail.</p>
              <br/>
              <p style="color:#666;font-size:14px;">Um abraço,<br/>Equipe Pelada Batista</p>
            </div>
          </div>
        `,
      }),
    });

    if (!resendResp.ok) {
      const err = await resendResp.json().catch(() => ({}));
      console.error('[recover-password] Erro Resend:', JSON.stringify(err));
      return json({
        error: 'Falha ao enviar o e-mail via Resend.',
        details: JSON.stringify(err),
      }, 500);
    }

    console.log(`[recover-password] ✅ E-mail enviado com sucesso para ${email}`);
    return json({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro interno:', err);
    return json({ error: 'Erro interno', details: String(err) }, 500);
  }
});
