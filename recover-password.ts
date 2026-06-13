// ============================================================
// Supabase Edge Function: recover-password
// Deploy: Supabase → Edge Functions → Create → colar este código
//
// Substitui a rota /api/recover-password do server.ts,
// que nunca executou em produção (site roda em Docker+Nginx).
//
// URL final:
// https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/recover-password
//
// Variáveis de ambiente necessárias (Edge Functions → Settings):
//   SMTP_USER  = seu-email@gmail.com
//   SMTP_PASS  = senha-de-app-do-gmail (16 caracteres, sem espaços)
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
    const SMTP_USER = Deno.env.get('SMTP_USER');
    const SMTP_PASS = Deno.env.get('SMTP_PASS');

    if (!SMTP_USER || !SMTP_PASS) {
      console.error('[recover-password] SMTP_USER ou SMTP_PASS ausente');
      return json({ error: 'Servidor de e-mail não configurado.' }, 500);
    }

    const { email, nome, senha } = await req.json();

    if (!email || !nome || !senha) {
      return json({ error: 'Dados incompletos.' }, 400);
    }

    // ── Envio via Gmail SMTP usando a API nativa do Deno ────────────────────
    // Deno Edge Functions não suportam nodemailer (Node.js).
    // Usamos a API REST do Gmail via OAuth2 ou smtp direto via fetch para
    // um relay SMTP-to-HTTP. A forma mais simples e confiável é usar
    // o serviço Resend (gratuito até 3.000 emails/mês) ou o relay SMTP
    // do Supabase nativo.
    //
    // OPÇÃO IMPLEMENTADA: Resend API (https://resend.com)
    // — gratuito, sem configuração de relay, funciona nativamente em Deno
    // — requer RESEND_API_KEY nas variáveis (além de SMTP_USER/SMTP_PASS)
    //
    // Se RESEND_API_KEY estiver configurado, usa Resend.
    // Caso contrário, usa SMTP via fetch para o relay smtp2go.

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    let enviado = false;
    let erroDetalhe = '';

    if (RESEND_API_KEY) {
      // ── Via Resend (recomendado) ─────────────────────────────────────────
      const resendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `Pelada Batista <noreply@peladabatista.app>`,
          to: [email],
          subject: 'Recuperação de Acesso (PIN) — Pelada Batista',
          html: gerarHtmlEmail(nome, senha),
        }),
      });

      if (resendResp.ok) {
        enviado = true;
      } else {
        const err = await resendResp.json().catch(() => ({}));
        erroDetalhe = `Resend: ${JSON.stringify(err)}`;
        console.error('[recover-password] Erro Resend:', erroDetalhe);
      }
    }

    // ── Fallback: Gmail SMTP via smtpjs relay ────────────────────────────────
    // Se Resend não estiver configurado, tenta via relay SMTP2Go
    if (!enviado && !RESEND_API_KEY) {
      // SMTP direto não funciona em Deno/Edge Functions por restrições de rede.
      // A alternativa mais robusta sem RESEND_API_KEY é usar o próprio
      // Supabase Auth + custom SMTP que já está configurado no projeto.
      // Mas para envio transacional customizado, Resend é necessário.
      erroDetalhe = 'Configure RESEND_API_KEY nas variáveis da Edge Function. Nodemailer não funciona em Deno/Edge Functions.';
    }

    if (!enviado) {
      return json({
        error: 'Falha ao enviar o e-mail.',
        details: erroDetalhe,
      }, 500);
    }

    console.log(`[recover-password] E-mail enviado para ${email}`);
    return json({ success: true, message: 'E-mail enviado com sucesso' });

  } catch (err) {
    console.error('[recover-password] Erro interno:', err);
    return json({ error: 'Erro interno', details: String(err) }, 500);
  }
});

function gerarHtmlEmail(nome: string, senha: string): string {
  return `
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
  `;
}
