// ============================================================
// Supabase Edge Function: recover-password (v4 — self-contained)
//
// Mudança principal vs v3:
//   Não depende mais dos dados enviados pelo frontend.
//   Recebe apenas o EMAIL, busca o jogador diretamente
//   no Supabase e envia o PIN correto.
//   Isso elimina o problema de campos undefined no payload.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL      = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY) {
      console.error('[recover-password] RESEND_API_KEY ausente');
      return json({ error: 'Serviço de e-mail não configurado.' }, 500);
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE) {
      console.error('[recover-password] Variáveis Supabase ausentes');
      return json({ error: 'Configuração do banco ausente.' }, 500);
    }

    // Lê apenas o email do body
    const body = await req.json();
    const emailInput = (body.email || body.recoveryEmail || '').toString().toLowerCase().trim();

    console.log('[recover-password] Email recebido:', emailInput || '(vazio)');

    if (!emailInput) {
      return json({ error: 'E-mail é obrigatório.' }, 400);
    }

    // Busca o jogador diretamente no Supabase pelo email
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { data: jogador, error: dbError } = await supabase
      .from('jogadores')
      .select('nome, sobrenome, email, senha')
      .ilike('email', emailInput)
      .maybeSingle();

    if (dbError) {
      console.error('[recover-password] Erro DB:', dbError.message);
      return json({ error: 'Erro ao consultar o banco de dados.' }, 500);
    }

    if (!jogador) {
      console.log('[recover-password] Email não encontrado:', emailInput);
      // Por segurança, retorna sucesso mesmo assim (não revela se email existe)
      return json({ success: true, message: 'E-mail enviado com sucesso' });
    }

    console.log('[recover-password] Jogador encontrado:', jogador.nome, '| tem senha:', !!jogador.senha);

    const nomeCompleto = `${jogador.nome} ${jogador.sobrenome}`.trim();
    const textoSenha   = jogador.senha
      ? jogador.senha
      : '(PIN não cadastrado — contate o administrador)';

    // Envia via Resend
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Pelada Batista <onboarding@resend.dev>',
        to: [jogador.email],
        subject: 'Recuperação de Acesso (PIN) — Pelada Batista',
        html: `
          <div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px;">
            <div style="max-width:500px;margin:0 auto;background:#fff;padding:30px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,.1)">
              <h2 style="color:#064e3b;text-align:center;font-size:24px;margin-bottom:20px;">⚽ Pelada Batista</h2>
              <p style="color:#333;font-size:16px;">Olá <b>${nomeCompleto}</b>,</p>
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

    console.log(`[recover-password] ✅ E-mail enviado para ${jogador.email}`);
    return json({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro interno:', err);
    return json({ error: 'Erro interno', details: String(err) }, 500);
  }
});
