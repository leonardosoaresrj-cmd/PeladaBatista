// ============================================================
// Supabase Edge Function: recover-password (v6 — fix query email)
//
// CAMINHO NO GITHUB:
//   supabase/functions/recover-password/index.ts
//
// VARIÁVEIS NECESSÁRIAS (Edge Functions → Manage secrets):
//   RESEND_API_KEY = re_xxxxxxxxxxxx
//
// DEPLOY: automático via GitHub Actions ao fazer commit
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

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

  console.log('[recover-password] v6 — requisição recebida');

  try {
    const RESEND_API_KEY   = Deno.env.get('RESEND_API_KEY');
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    console.log('[recover-password] Vars:', {
      temResend:     !!RESEND_API_KEY,
      temSupabase:   !!SUPABASE_URL,
      temServiceKey: !!SUPABASE_SERVICE,
    });

    if (!RESEND_API_KEY) {
      return jsonResp({ error: 'RESEND_API_KEY não configurada.' }, 500);
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE) {
      return jsonResp({ error: 'Variáveis do Supabase ausentes.' }, 500);
    }

    // ── Lê o email do body ────────────────────────────────────────────────────
    const body       = await req.json();
    const emailInput = (body.email || body.recoveryEmail || '').toString().toLowerCase().trim();

    console.log('[recover-password] Email recebido:', emailInput || '(vazio)');

    if (!emailInput) {
      return jsonResp({ error: 'E-mail é obrigatório.' }, 400);
    }

    // ── Busca jogador no Supabase via REST (sem SDK) ──────────────────────────
    // FIX v6: usa eq. sem encodeURIComponent — o @ no email
    // causava bug com ilike + encodeURIComponent na v5
    const queryUrl = `${SUPABASE_URL}/rest/v1/jogadores` +
      `?select=nome,sobrenome,email,senha` +
      `&email=eq.${emailInput}` +
      `&limit=1`;

    console.log('[recover-password] Consultando:', queryUrl);

    const dbResp = await fetch(queryUrl, {
      headers: {
        'apikey':        SUPABASE_SERVICE,
        'Authorization': `Bearer ${SUPABASE_SERVICE}`,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
    });

    const dbStatus = dbResp.status;
    const dbText   = await dbResp.text();
    console.log('[recover-password] Supabase HTTP:', dbStatus);
    console.log('[recover-password] Supabase resposta:', dbText.substring(0, 300));

    if (!dbResp.ok) {
      return jsonResp({ error: 'Erro ao consultar o banco.', details: dbText }, 500);
    }

    let jogadores: any[] = [];
    try { jogadores = JSON.parse(dbText); } catch { jogadores = []; }

    // Fallback: tenta com email em maiúsculas (caso o banco tenha capitalização diferente)
    if (!jogadores || jogadores.length === 0) {
      console.log('[recover-password] Não encontrado com eq. — tentando email original...');
      const emailOriginal = (body.email || body.recoveryEmail || '').toString().trim();
      const queryUrl2 = `${SUPABASE_URL}/rest/v1/jogadores` +
        `?select=nome,sobrenome,email,senha` +
        `&email=eq.${emailOriginal}` +
        `&limit=1`;

      const dbResp2 = await fetch(queryUrl2, {
        headers: {
          'apikey':        SUPABASE_SERVICE,
          'Authorization': `Bearer ${SUPABASE_SERVICE}`,
          'Content-Type':  'application/json',
          'Accept':        'application/json',
        },
      });
      const dbText2 = await dbResp2.text();
      console.log('[recover-password] Fallback resposta:', dbText2.substring(0, 300));
      try { jogadores = JSON.parse(dbText2); } catch { jogadores = []; }
    }

    console.log('[recover-password] Jogadores encontrados:', jogadores?.length ?? 0);

    // Mesmo sem encontrar retorna sucesso (segurança — não revela se email existe)
    if (!jogadores || jogadores.length === 0) {
      console.log('[recover-password] Email não encontrado no banco.');
      return jsonResp({ success: true, message: 'E-mail enviado com sucesso' });
    }

    const jogador      = jogadores[0];
    const nomeCompleto = `${jogador.nome || ''} ${jogador.sobrenome || ''}`.trim() || 'Atleta';
    const textoSenha   = jogador.senha
      ? String(jogador.senha)
      : '(PIN não cadastrado — contate o administrador)';

    console.log('[recover-password] Enviando e-mail para:', jogador.email);

    // ── Envia via Resend ──────────────────────────────────────────────────────
    const resendResp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from:    'Pelada Batista <onboarding@resend.dev>',
        to:      [jogador.email],
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

    const resendStatus = resendResp.status;
    const resendText   = await resendResp.text();
    console.log('[recover-password] Resend HTTP:', resendStatus);

    if (!resendResp.ok) {
      console.error('[recover-password] Erro Resend:', resendText);
      return jsonResp({ error: 'Falha ao enviar o e-mail.', details: resendText }, 500);
    }

    console.log('[recover-password] ✅ E-mail enviado com sucesso para', jogador.email);
    return jsonResp({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro interno:', String(err));
    return jsonResp({ error: 'Erro interno.', details: String(err) }, 500);
  }
});
