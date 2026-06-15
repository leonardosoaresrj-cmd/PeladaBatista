// ============================================================
// Supabase Edge Function: recover-password  (v3)
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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!RESEND_API_KEY) {
      console.error('[recover-password] RESEND_API_KEY ausente');
      return json({ error: 'Serviço de e-mail não configurado. Configure RESEND_API_KEY.' }, 500);
    }

    // Lê o body e loga o que chegou (para diagnóstico)
    const body = await req.json();
    console.log('[recover-password] Body recebido:', JSON.stringify({
      email: body.email,
      nome: body.nome,
      temSenha: body.senha !== undefined,
      senhaVazia: body.senha === '' || body.senha === null,
    }));

    const email = body.email?.toString().trim();
    const nome  = body.nome?.toString().trim();
    const senha = body.senha?.toString().trim();

    // Valida apenas email (obrigatório para envio)
    if (!email) {
      return json({ error: 'E-mail é obrigatório.' }, 400);
    }

    // Monta o texto da senha para o email
    const textoSenha = senha
      ? senha
      : '(não cadastrada — contate o administrador para redefinir)';

    const nomeExibir = nome || 'Atleta';

    console.log(`[recover-password] Enviando para: ${email}`);

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
              <p style="color:#333;font-size:16px;">Olá <b>${nomeExibir}</b>,</p>
              <p style="color:#333;font-size:16px;">Você solicitou a recuperação do seu PIN de acesso ao portal.</p>
              <div style="background:#ecfdf5;border:1px dashed #10b981;padding:15px;text-align:center;margin:25px 0;">
                <p style="color:#064e3b;font-size:14px;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Sua Senha / PIN é:</p>
                <p style="color:#047857;font-size:32px;font-weight:bold;font-family:monospace;letter-spacing:5px;margin:0;">${textoSenha}</p>
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
      return json({ error: 'Falha ao enviar o e-mail.', details: JSON.stringify(err) }, 500);
    }

    console.log(`[recover-password] ✅ E-mail enviado para ${email}`);
    return json({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro interno:', err);
    return json({ error: 'Erro interno', details: String(err) }, 500);
  }
});
