// ============================================================
// Supabase Edge Function: recover-password (v7)
//
// CORREÇÃO v7:
//   O admin Leonardo existe apenas no código frontend (data.ts),
//   não no banco Supabase. A função agora trata dois casos:
//   1. Jogadores no Supabase → busca pelo banco
//   2. Admin hardcoded → retorna dados do código
//
// CAMINHO: supabase/functions/recover-password/index.ts
// VARIÁVEL: RESEND_API_KEY (Edge Functions → Manage secrets)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

// Admin hardcoded — existe apenas no frontend, não no Supabase
const ADMIN_HARDCODED: Record<string, { nome: string; sobrenome: string; senha: string }> = {
  'leonardo.soares.rj@gmail.com': {
    nome:      'Leonardo',
    sobrenome: 'Soares',
    senha:     '1234',
  },
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
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

  console.log('[recover-password] v7 — requisição recebida');

  try {
    const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!RESEND_API_KEY) {
      return jsonResp({ error: 'RESEND_API_KEY não configurada.' }, 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE) {
      return jsonResp({ error: 'Variáveis do Supabase ausentes.' }, 500);
    }

    const body       = await req.json();
    const emailInput = (body.email || body.recoveryEmail || '').toString().toLowerCase().trim();

    console.log('[recover-password] Email recebido:', emailInput || '(vazio)');

    if (!emailInput) {
      return jsonResp({ error: 'E-mail é obrigatório.' }, 400);
    }

    // ── 1. Verifica se é o admin hardcoded ───────────────────────────────────
    let nomeCompleto: string;
    let textoSenha:   string;
    let emailEnvio:   string;

    const adminData = ADMIN_HARDCODED[emailInput];

    if (adminData) {
      console.log('[recover-password] Admin hardcoded encontrado:', emailInput);
      nomeCompleto = `${adminData.nome} ${adminData.sobrenome}`;
      textoSenha   = adminData.senha;
      emailEnvio   = emailInput;

    } else {
      // ── 2. Busca no Supabase ─────────────────────────────────────────────
      console.log('[recover-password] Buscando no Supabase...');

      const dbResp = await fetch(
        `${SUPABASE_URL}/rest/v1/jogadores?select=nome,sobrenome,email,senha&email=eq.${emailInput}&limit=1`,
        {
          headers: {
            'apikey':        SUPABASE_SERVICE,
            'Authorization': `Bearer ${SUPABASE_SERVICE}`,
            'Content-Type':  'application/json',
            'Accept':        'application/json',
          },
        }
      );

      const dbText = await dbResp.text();
      console.log('[recover-password] Supabase HTTP:', dbResp.status, '| resposta:', dbText.substring(0, 200));

      let jogadores: any[] = [];
      try { jogadores = JSON.parse(dbText); } catch { jogadores = []; }

      if (!jogadores || jogadores.length === 0) {
        console.log('[recover-password] Email não encontrado — retorno silencioso.');
        // Retorna sucesso sem revelar que o email não existe
        return jsonResp({ success: true, message: 'E-mail enviado com sucesso' });
      }

      const jogador = jogadores[0];
      nomeCompleto  = `${jogador.nome || ''} ${jogador.sobrenome || ''}`.trim() || 'Atleta';
      textoSenha    = jogador.senha ? String(jogador.senha) : '(PIN não cadastrado — contate o administrador)';
      emailEnvio    = jogador.email;
    }

    console.log('[recover-password] Enviando e-mail para:', emailEnvio);

    // ── Envia via Resend ──────────────────────────────────────────────────────
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'Pelada Batista <onboarding@resend.dev>',
        to:      [emailEnvio],
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
      }),
    });

    const resendText = await resendResp.text();
    console.log('[recover-password] Resend HTTP:', resendResp.status);

    if (!resendResp.ok) {
      console.error('[recover-password] Erro Resend:', resendText);
      return jsonResp({ error: 'Falha ao enviar o e-mail.', details: resendText }, 500);
    }

    console.log('[recover-password] ✅ E-mail enviado com sucesso para', emailEnvio);
    return jsonResp({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro interno:', String(err));
    return jsonResp({ error: 'Erro interno.', details: String(err) }, 500);
  }
});
