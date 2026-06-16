// ============================================================
// Supabase Edge Function: pix-webhook
// Deploy: supabase functions deploy pix-webhook
//
// Responsabilidade:
//   Recebe notificação do Mercado Pago quando PIX é pago,
//   confirma com a API do MP, grava no Supabase e dispara
//   o robô de WhatsApp para enviar a mensagem de quitação.
//
// Configurar no painel do MP:
//   mercadopago.com.br → Seu negócio → Configurações →
//   Webhooks → URL: https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/pix-webhook
//   Eventos: Pagamentos (payment)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // MP faz POST — responder sempre 200 para evitar retentativas
  try {
    const MP_ACCESS_TOKEN  = Deno.env.get('MP_ACCESS_TOKEN');
    const SUPABASE_URL     = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const BOT_URL          = Deno.env.get('BOT_URL');      // https://futebolbot.onrender.com/teste
    const BOT_SECRET       = Deno.env.get('BOT_SECRET');   // WEBHOOK_SECRET do bot

    if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE) {
      console.error('[pix-webhook] Variáveis de ambiente ausentes');
      return new Response('ok', { status: 200 });
    }

    const body = await req.json();
    console.log('[pix-webhook] Recebido:', JSON.stringify(body));

    // Só processa notificações de pagamento
    if (body.type !== 'payment' || !body.data?.id) {
      return new Response('ok', { status: 200 });
    }

    const paymentId = String(body.data.id);

    // Confirma o status diretamente na API do MP (não confiar no payload do webhook)
    const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${MP_ACCESS_TOKEN}` },
    });
    const mpData = await mpResponse.json();

    console.log(`[pix-webhook] Payment ${paymentId} status: ${mpData.status}`);

    // Só processa se aprovado
    if (mpData.status !== 'approved') {
      return new Response('ok', { status: 200 });
    }

    const jogadorId  = mpData.metadata?.jogador_id;
    const debitosRaw = mpData.metadata?.debitos;
    const debitos: Array<{ mesRef: string; valor: number; partidaId?: string }> =
      debitosRaw ? JSON.parse(debitosRaw) : [];

    if (!jogadorId || !debitos.length) {
      console.warn('[pix-webhook] metadata incompleto');
      return new Response('ok', { status: 200 });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const hoje = new Date().toISOString().split('T')[0];

    // Grava cada débito como pago no Supabase
    for (const deb of debitos) {
      const { error } = await supabase
        .from('pagamentos')
        .upsert({
          jogador_id:      jogadorId,
          mes_ref:         deb.mesRef,
          status:          'pago',
          data_pagamento:  hoje,
          valor:           deb.valor,
          partida_id:      deb.partidaId || null,
          mp_payment_id:   paymentId,
        }, { onConflict: 'jogador_id,mes_ref' });

      if (error) {
        console.error('[pix-webhook] Erro ao gravar pagamento:', error);
      }
    }

    console.log(`[pix-webhook] ✅ ${debitos.length} débito(s) quitado(s) para jogador ${jogadorId}`);

    // Dispara o robô de WhatsApp se configurado
    // O webhook do Supabase na tabela pagamentos também vai disparar,
    // mas chamamos diretamente aqui como garantia dupla
    if (BOT_URL && BOT_SECRET) {
      try {
        // Busca nome do jogador para montar mensagem
        const { data: jogador } = await supabase
          .from('jogadores')
          .select('nome, sobrenome, posicao, is_gold')
          .eq('id', jogadorId)
          .maybeSingle();

        if (jogador) {
          const mesFormatado = debitos[0].mesRef.split('-').reverse().join('/');
          const medalha = jogador.is_gold ? ' 🏅' : '';
          const valorTotal = debitos.reduce((s, d) => s + d.valor, 0);

          const mensagem =
            `💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA SÁBADO* 💰\n\n` +
            `Atleta: *${jogador.nome} ${jogador.sobrenome}* (${jogador.posicao})${medalha}\n` +
            `Referência: *${mesFormatado}*\n` +
            `Valor: *R$ ${valorTotal.toFixed(2)}*\n` +
            `Pagamento: *PIX via Mercado Pago* ✅\n\n` +
            `Muito obrigado pelo compromisso! 🤝⚽`;

          await fetch(BOT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-webhook-secret': BOT_SECRET,
            },
            body: JSON.stringify({ mensagem }),
          });

          console.log('[pix-webhook] Robô notificado com sucesso');
        }
      } catch (botErr) {
        // Não falha o webhook por erro no bot
        console.warn('[pix-webhook] Falha ao notificar robô:', botErr);
      }
    }

    return new Response('ok', { status: 200 });

  } catch (err) {
    console.error('[pix-webhook] Erro geral:', err);
    // Sempre retorna 200 para o MP não retentar
    return new Response('ok', { status: 200 });
  }
});
