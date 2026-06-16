// ============================================================
// Supabase Edge Function: pix-status
// Deploy: supabase functions deploy pix-status
//
// Responsabilidade:
//   Polling do frontend a cada 5s para verificar se o PIX foi pago
//
// URL: https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-status?id=PAYMENT_ID
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const MP_ACCESS_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_ACCESS_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'MP_ACCESS_TOKEN não configurado' }),
        { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const paymentId = url.searchParams.get('id');

    if (!paymentId) {
      return new Response(
        JSON.stringify({ error: 'Parâmetro id obrigatório' }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'Erro ao consultar pagamento', details: mpData }),
        { status: 502, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        paymentId: mpData.id,
        status: mpData.status,              // "approved" | "pending" | "rejected"
        statusDetail: mpData.status_detail,
        pago: mpData.status === 'approved',
        jogadorId: mpData.metadata?.jogador_id,
        debitos: mpData.metadata?.debitos
          ? JSON.parse(mpData.metadata.debitos)
          : [],
      }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );

  } catch (err) {
    console.error('[pix-status] Erro:', err);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
