// ============================================================
// Supabase Edge Function: pix-criar
// Deploy: supabase functions deploy pix-criar
//
// Responsabilidade:
//   1. Recebe jogadorId, valorTotal, debitos do frontend
//   2. Cria cobrança PIX real na API do Mercado Pago
//   3. Retorna qrCodeBase64, qrCodeText e paymentId
//
// URL final: https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-criar
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'MP_ACCESS_TOKEN não configurado no servidor' }),
        { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const { jogadorId, jogadorNome, valorTotal, debitos } = await req.json();

    if (!jogadorId || !valorTotal || valorTotal <= 0) {
      return new Response(
        JSON.stringify({ error: 'jogadorId e valorTotal são obrigatórios' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    // Expiração: 10 minutos a partir de agora
    const expiracao = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Chamada real à API do Mercado Pago v1
    const mpResponse = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `pelada-${jogadorId}-${Date.now()}`,
      },
      body: JSON.stringify({
        transaction_amount: Number(valorTotal),
        description: `Pelada Batista — ${jogadorNome || jogadorId} — ${debitos?.length || 1} débito(s)`,
        payment_method_id: 'pix',
        payer: {
          email: `jogador.${jogadorId.substring(0, 8)}@peladabatista.app`,
          first_name: (jogadorNome || 'Jogador').split(' ')[0],
          last_name: (jogadorNome || 'Pelada').split(' ').slice(1).join(' ') || 'Pelada',
        },
        date_of_expiration: expiracao,
        // Webhook: MP avisa esta URL quando o PIX for pago
        notification_url: `https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-webhook`,
        metadata: {
          jogador_id: jogadorId,
          debitos: JSON.stringify(debitos || []),
        },
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error('[pix-criar] Erro MP:', JSON.stringify(mpData));
      return new Response(
        JSON.stringify({ error: 'Erro ao criar cobrança no Mercado Pago', details: mpData }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const pixData = mpData.point_of_interaction?.transaction_data;

    return new Response(
      JSON.stringify({
        success: true,
        paymentId: mpData.id,
        status: mpData.status,
        qrCodeBase64: pixData?.qr_code_base64 || null,
        qrCodeText: pixData?.qr_code || null,
        expiresAt: expiracao,
      }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[pix-criar] Erro interno:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
