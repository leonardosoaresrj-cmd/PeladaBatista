// ============================================================
// Supabase Edge Function: pix-criar
// CAMINHO: supabase/functions/pix-criar/index.ts
//
// Frontend → esta função → Mercado Pago API → retorna QR Code
// URL: https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-criar
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
    if (!MP_TOKEN) return json({ error: 'MP_ACCESS_TOKEN não configurado.' }, 503);

    const { jogadorId, jogadorNome, valorTotal, debitos } = await req.json();

    if (!jogadorId || !valorTotal || valorTotal <= 0) {
      return json({ error: 'jogadorId e valorTotal são obrigatórios.' }, 400);
    }

    const expiracao = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const mpResp = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization':     `Bearer ${MP_TOKEN}`,
        'Content-Type':      'application/json',
        'X-Idempotency-Key': `pelada-${jogadorId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(valorTotal),
        description:        `Pelada Batista — ${jogadorNome || jogadorId}`,
        payment_method_id:  'pix',
        payer: {
          email:      `jogador.${jogadorId.substring(0, 8)}@peladabatista.app`,
          first_name: (jogadorNome || 'Jogador').split(' ')[0],
          last_name:  (jogadorNome || 'Pelada').split(' ').slice(1).join(' ') || 'Pelada',
        },
        date_of_expiration: expiracao,
        notification_url:   'https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-webhook',
        metadata: {
          jogador_id: jogadorId,
          debitos:    JSON.stringify(debitos || []),
        },
      }),
    });

    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      console.error('[pix-criar] erro MP:', JSON.stringify(mpData));
      return json({ error: 'Erro ao criar cobrança no Mercado Pago.', details: mpData }, 502);
    }

    const pixData = mpData.point_of_interaction?.transaction_data;

    console.log('[pix-criar] ✅ payment criado:', mpData.id, '| status:', mpData.status);

    return json({
      success:       true,
      paymentId:     mpData.id,
      status:        mpData.status,
      qrCodeBase64:  pixData?.qr_code_base64 || null,
      qrCodeText:    pixData?.qr_code || null,
      expiresAt:     expiracao,
    });

  } catch (err) {
    console.error('[pix-criar] erro interno:', String(err));
    return json({ error: 'Erro interno.', details: String(err) }, 500);
  }
});
