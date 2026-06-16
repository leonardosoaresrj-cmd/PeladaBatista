// ============================================================
// Supabase Edge Function: pix-status
// CAMINHO: supabase/functions/pix-status/index.ts
//
// Frontend consulta a cada 5s para verificar se o PIX foi pago
// URL: https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-status?id=PAYMENT_ID
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  try {
    const MP_TOKEN = Deno.env.get('MP_ACCESS_TOKEN');
    if (!MP_TOKEN) return json({ error: 'MP_ACCESS_TOKEN não configurado.' }, 503);

    const url       = new URL(req.url);
    const paymentId = url.searchParams.get('id');
    if (!paymentId) return json({ error: 'Parâmetro id obrigatório.' }, 400);

    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_TOKEN}` },
    });
    const mpData = await mpResp.json();

    if (!mpResp.ok) {
      return json({ error: 'Erro ao consultar pagamento.', details: mpData }, 502);
    }

    return json({
      paymentId:    mpData.id,
      status:       mpData.status,
      statusDetail: mpData.status_detail,
      pago:         mpData.status === 'approved',
      jogadorId:    mpData.metadata?.jogador_id,
      debitos:      mpData.metadata?.debitos ? JSON.parse(mpData.metadata.debitos) : [],
    });

  } catch (err) {
    console.error('[pix-status] erro:', String(err));
    return json({ error: 'Erro interno.', details: String(err) }, 500);
  }
});
