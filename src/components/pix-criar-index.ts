// ============================================================
// Supabase Edge Function: pix-criar (v2 — fix validação MP)
// CAMINHO: supabase/functions/pix-criar/index.ts
//
// CORREÇÕES v2:
//   - Email do pagador: usa Gmail real (peladabatista.tijuca@gmail.com)
//   - last_name: nunca vazio (fallback "Batista")
//   - identification: CPF genérico aceito pelo MP em modo produção
//   - Logs detalhados do erro completo do MP
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_TOKEN) {
      console.error('[pix-criar] MP_ACCESS_TOKEN ausente');
      return json({ error: 'MP_ACCESS_TOKEN não configurado.' }, 503);
    }

    const { jogadorId, jogadorNome, valorTotal, debitos } = await req.json();

    if (!jogadorId || !valorTotal || valorTotal <= 0) {
      return json({ error: 'jogadorId e valorTotal são obrigatórios.' }, 400);
    }

    // Monta nome/sobrenome com fallbacks seguros
    const partes     = (jogadorNome || 'Pelada Batista').trim().split(' ');
    const firstName  = partes[0] || 'Pelada';
    const lastName   = partes.slice(1).join(' ').trim() || 'Batista';

    const expiracao = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const payload = {
      transaction_amount: Number(valorTotal),
      description:        `Pelada Batista — ${jogadorNome || 'Jogador'}`,
      payment_method_id:  'pix',
      payer: {
        // Email real da conta — aceito pelo MP em produção
        email:      'peladabatista.tijuca@gmail.com',
        first_name: firstName,
        last_name:  lastName,
        identification: {
          // CPF do responsável pela conta MP (necessário em produção no Brasil)
          // Substitua pelo CPF real do titular da conta Mercado Pago
          type:   'CPF',
          number: Deno.env.get('MP_CPF_TITULAR') || '00000000000',
        },
      },
      date_of_expiration: expiracao,
      notification_url:   'https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-webhook',
      metadata: {
        jogador_id: jogadorId,
        debitos:    JSON.stringify(debitos || []),
      },
    };

    console.log('[pix-criar] enviando para MP:', JSON.stringify({
      amount: payload.transaction_amount,
      email:  payload.payer.email,
      nome:   `${firstName} ${lastName}`,
    }));

    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization':     `Bearer ${MP_TOKEN}`,
        'Content-Type':      'application/json',
        'X-Idempotency-Key': `pelada-${jogadorId}-${Date.now()}`,
      },
      body: JSON.stringify(payload),
    });

    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      // Log do erro COMPLETO do MP para diagnóstico
      console.error('[pix-criar] erro MP completo:', JSON.stringify(mpData));
      return json({
        error:   'Erro ao criar cobrança no Mercado Pago.',
        details: mpData,
        cause:   mpData?.cause || mpData?.message || mpData?.error,
      }, 502);
    }

    const pixData = mpData.point_of_interaction?.transaction_data;

    console.log('[pix-criar] ✅ payment criado:', mpData.id, '| status:', mpData.status);

    return json({
      success:      true,
      paymentId:    mpData.id,
      status:       mpData.status,
      qrCodeBase64: pixData?.qr_code_base64 || null,
      qrCodeText:   pixData?.qr_code        || null,
      expiresAt:    expiracao,
    });

  } catch (err) {
    console.error('[pix-criar] erro interno:', String(err));
    return json({ error: 'Erro interno.', details: String(err) }, 500);
  }
});
