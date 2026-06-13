/**
 * ⚽ ROBÔ PELADA BATISTA — WhatsApp Bot v2.1
 *
 * REGRAS IMPLEMENTADAS:
 * ─────────────────────────────────────────────────────────────
 * REGRA 1 — Abertura de período de renovação de mensalidade
 *   Dispara automaticamente no 1º dia após o último sábado do mês.
 *   A cada pagamento de mensalidade, reenvia a lista com 💰 atualizado.
 *   Novo mensalista: incluído no fim da lista.
 *   Motor: cron diário às 08:00 + webhook de pagamentos.
 *
 * REGRA 2 — Lista de confirmações (Terça 00:00 → Sexta 23:59)
 *   A cada confirmação/recusa de presença, reenvia a lista A/B/C/D/E
 *   atualizada, no formato exato solicitado.
 *
 * REGRA 3 — Cancelamento de jogo
 *   Quando partida.cancelada muda para true, envia mensagem no
 *   formato exato solicitado (com data dd/MM/YYYY).
 *
 * ARQUITETURA:
 * ─────────────────────────────────────────────────────────────
 * MODO 1 — DIRETO: Frontend → POST /teste → bot envia ao grupo
 * MODO 2 — WEBHOOK: Supabase → POST /webhook → bot envia
 * MODO 3 — CRON: bot verifica diariamente e dispara sozinho
 *
 * ANTI-LOGOUT (Render Free):
 *   - Sessão persistida no Supabase Storage
 *   - Self-ping a cada 9 min
 *   - Reconnect com backoff exponencial
 *   - Cache de JID resolvido
 * ─────────────────────────────────────────────────────────────
 */

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');

const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const qrcode  = require('qrcode');
const pino    = require('pino');
const fs      = require('fs');
const path    = require('path');

// ─── Configuração ─────────────────────────────────────────────────────────────
const CONFIG = {
  SUPABASE_URL:       process.env.SUPABASE_URL,
  SUPABASE_KEY:       process.env.SUPABASE_SERVICE_KEY,
  SUPABASE_BUCKET:    process.env.SUPABASE_BUCKET    || 'whatsapp-session',
  WEBHOOK_SECRET:     process.env.WEBHOOK_SECRET,
  PORT:               process.env.PORT               || 3000,
  SELF_URL:           process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 3000}`,
  DEFAULT_GROUP_ID:   process.env.WHATSAPP_GROUP_ID,
  PORTAL_URL:         process.env.PORTAL_URL          || 'https://peladabatista.onrender.com',
  SESSION_LOCAL_PATH: '/tmp/baileys-session',
  PING_INTERVAL_MS:   9 * 60 * 1000,
  RECONNECT_BASE_MS:  3000,
  RECONNECT_MAX_MS:   60000,
};

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

// ─── Logger silencioso ────────────────────────────────────────────────────────
const logger = pino({ level: 'silent' });

// ─── Estado global ────────────────────────────────────────────────────────────
let sock              = null;
let currentQR         = null;
let isConnected       = false;
let reconnectAttempts = 0;
let pingInterval      = null;
let cronInterval      = null;

// Cache de JID resolvido
const jidCache = new Map();

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORS — permite chamadas do frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── GET / ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app:                  '⚽ Robô Pelada Batista v2.1',
    status:               isConnected ? '✅ Conectado' : '⏳ Aguardando QR',
    qr_disponivel:        !isConnected && !!currentQR,
    tentativas_reconexao: reconnectAttempts,
    uptime_segundos:      Math.floor(process.uptime()),
    grupo_padrao:         CONFIG.DEFAULT_GROUP_ID ? '✅ configurado' : '⚠️ não configurado',
    regras_ativas:        ['REGRA1-Renovação(cron)', 'REGRA2-Presença(webhook)', 'REGRA3-Cancelamento(webhook)'],
  });
});

// ── GET /qr ───────────────────────────────────────────────────────────────────
app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#e8f5e9">
        <h1 style="color:#2e7d32">✅ WhatsApp Conectado!</h1>
        <p>Robô Pelada Batista v2.1 ativo — 3 regras operacionais.</p>
        <a href="/">Ver status</a>
      </body></html>`);
  }
  if (!currentQR) {
    return res.send(`
      <html><head><meta http-equiv="refresh" content="5"></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;background:#fff8e1">
        <h1>⏳ Gerando QR Code...</h1>
        <p>Recarrega em 5 segundos.</p>
      </body></html>`);
  }
  const qrImg = await qrcode.toDataURL(currentQR, { width: 300, margin: 2 });
  res.send(`
    <html><head><meta http-equiv="refresh" content="30">
    <style>
      body{font-family:sans-serif;text-align:center;padding:40px;background:#f1f8e9}
      .card{display:inline-block;background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.1)}
      img{border:4px solid #4CAF50;border-radius:8px} h1{color:#2e7d32}
      ol{text-align:left;background:#e8f5e9;border-radius:8px;padding:16px 24px;margin-top:16px}
    </style></head>
    <body><div class="card">
      <h1>⚽ Pelada Batista — Robô WhatsApp</h1>
      <p>Escaneie o QR Code com seu WhatsApp:</p>
      <img src="${qrImg}" alt="QR Code"/>
      <ol>
        <li>Abra o WhatsApp no celular</li>
        <li>Toque nos <strong>3 pontinhos</strong> → <strong>Aparelhos conectados</strong></li>
        <li>Toque em <strong>Conectar um aparelho</strong></li>
        <li>Aponte a câmera para o QR Code acima</li>
      </ol>
      <p style="color:#888;font-size:12px">Recarrega em 30s · QR expira em ~60s</p>
    </div></body></html>`);
});

// ── POST /teste — chamada direta do frontend ──────────────────────────────────
app.post('/teste', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET) {
    console.warn('⚠️  /teste rejeitado: secret inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isConnected) {
    return res.status(503).json({
      error: 'WhatsApp não conectado. Acesse /qr para conectar.',
      qr_url: `${CONFIG.SELF_URL}/qr`
    });
  }
  const { mensagem, grupo_id } = req.body;
  if (!mensagem) return res.status(400).json({ error: 'Campo "mensagem" obrigatório' });

  const grupoAlvo = grupo_id || CONFIG.DEFAULT_GROUP_ID;
  if (!grupoAlvo) return res.status(400).json({ error: 'grupo_id não informado' });

  try {
    const jid = await resolverJID(grupoAlvo);
    await sock.sendMessage(jid, { text: mensagem });
    console.log(`📤 [/teste] → ${jid} | ${mensagem.substring(0, 60).replace(/\n/g, ' ')}...`);
    supabase.from('bot_logs').insert({
      evento: 'DIRETO', tabela: 'frontend',
      mensagem: mensagem.substring(0, 500), enviado_em: new Date().toISOString(),
    }).catch(() => {});
    res.json({ success: true, jid });
  } catch (err) {
    console.error('❌ /teste erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhook — eventos automáticos do Supabase ───────────────────────────
app.post('/webhook', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  if (!isConnected)
    return res.status(503).json({ error: 'WhatsApp não conectado' });

  const { type, table, record, old_record } = req.body;
  console.log(`📥 [/webhook] ${type} em "${table}"`);

  try {
    await processarEventoWebhook(type, table, record, old_record);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ webhook erro:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON DIÁRIO — verifica às 08:00 se é o 1º dia do período de renovação
// Implementa a REGRA 1
// ─────────────────────────────────────────────────────────────────────────────
function iniciarCronDiario() {
  if (cronInterval) clearInterval(cronInterval);

  // Verifica a cada 1 hora se chegou na janela de disparo
  cronInterval = setInterval(async () => {
    const agora = new Date();
    const hora  = agora.getHours();
    const min   = agora.getMinutes();

    // Dispara entre 08:00 e 08:59 (janela de 1h para não depender do segundo exato)
    if (hora !== 8) return;

    // Verifica se hoje é o 1º dia após o último sábado do mês anterior
    if (ehPrimeiroDiaPosUltimoSabadoMesAnterior(agora)) {
      console.log('📅 [CRON] REGRA 1 — Abertura de renovação detectada. Enviando lista...');
      await dispararAberturaMensalidade(agora);
    }
  }, 60 * 60 * 1000); // a cada 1 hora

  // Verifica imediatamente ao iniciar (para não perder se o servidor reiniciou no horário)
  setTimeout(async () => {
    const agora = new Date();
    if (agora.getHours() === 8 && ehPrimeiroDiaPosUltimoSabadoMesAnterior(agora)) {
      console.log('📅 [CRON INIT] REGRA 1 — Detectado no boot. Enviando lista...');
      await dispararAberturaMensalidade(agora);
    }
  }, 5000);

  console.log('📅 Cron diário ativo (verifica abertura de renovação às 08h)');
}

/**
 * Retorna true se "hoje" é o 1º domingo após o último sábado do mês anterior.
 * (O enunciado diz "primeiro dia após o último sábado do mês" — ou seja, o domingo)
 */
function ehPrimeiroDiaPosUltimoSabadoMesAnterior(hoje) {
  const dia     = hoje.getDate();
  const mes     = hoje.getMonth();     // 0-indexed
  const ano     = hoje.getFullYear();

  // Último sábado do mês anterior
  const ultimoDiaMesAnterior = new Date(ano, mes, 0); // dia 0 do mês atual = último do anterior
  const ultimoSabadoAnt = new Date(ultimoDiaMesAnterior);
  while (ultimoSabadoAnt.getDay() !== 6) {
    ultimoSabadoAnt.setDate(ultimoSabadoAnt.getDate() - 1);
  }

  // O dia seguinte ao último sábado do mês anterior
  const primeiroDiaPeriodo = new Date(ultimoSabadoAnt);
  primeiroDiaPeriodo.setDate(ultimoSabadoAnt.getDate() + 1);

  return (
    hoje.getFullYear() === primeiroDiaPeriodo.getFullYear() &&
    hoje.getMonth()    === primeiroDiaPeriodo.getMonth()    &&
    hoje.getDate()     === primeiroDiaPeriodo.getDate()
  );
}

/**
 * Busca lista de mensalistas e dispara a mensagem de abertura de renovação.
 * REGRA 1 — disparo automático no 1º dia do período.
 */
async function dispararAberturaMensalidade(hoje) {
  try {
    if (!isConnected) {
      console.warn('⚠️  [REGRA1] WhatsApp não conectado — disparo adiado');
      return;
    }

    // Mês de referência: mês atual (é para ESTE mês que estamos abrindo a renovação)
    const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;

    const { data: jogadores } = await supabase
      .from('jogadores')
      .select('id,nome,sobrenome,posicao,membro_status,is_gold')
      .eq('status', 'ativo')
      .eq('membro_status', 'mensalista')
      .order('nome');

    const { data: pagamentos } = await supabase
      .from('pagamentos')
      .select('jogador_id,mes_ref,status')
      .eq('mes_ref', mesRef)
      .eq('status', 'pago');

    const mensagem = msgAberturaMensalidade(mesRef, jogadores || [], pagamentos || []);
    await enviarParaGrupo(mensagem);

    supabase.from('bot_logs').insert({
      evento: 'CRON_REGRA1', tabela: 'pagamentos',
      mensagem: mensagem.substring(0, 500), enviado_em: new Date().toISOString(),
    }).catch(() => {});

    console.log(`✅ [REGRA1] Mensagem de abertura enviada para ${mesRef}`);
  } catch (err) {
    console.error('❌ [REGRA1] Erro ao disparar abertura:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSADOR DE EVENTOS WEBHOOK
// ─────────────────────────────────────────────────────────────────────────────
async function processarEventoWebhook(tipo, tabela, rec, recAntigo) {
  let mensagem = null;

  // ── REGRA 3 — Cancelamento de jogo ────────────────────────────────────────
  if (tabela === 'partidas') {
    if (tipo === 'INSERT' && !rec.cancelada) {
      mensagem = msgNovaPartida(rec);
    }
    if (tipo === 'UPDATE') {
      const foiCancelada  = !recAntigo?.cancelada && rec.cancelada;
      const foiReativada  = recAntigo?.cancelada  && !rec.cancelada;
      if (foiCancelada) mensagem = msgPartidaCancelada(rec);     // REGRA 3
      if (foiReativada) mensagem = msgPartidaReativada(rec);
    }
  }

  // ── REGRA 2 — Confirmação/recusa de presença ──────────────────────────────
  if (tabela === 'presencas' && (tipo === 'INSERT' || tipo === 'UPDATE')) {
    const [jogRes, parRes] = await Promise.all([
      supabase.from('jogadores').select('nome,sobrenome,posicao,membro_status,is_gold').eq('id', rec.jogador_id).maybeSingle(),
      supabase.from('partidas').select('titulo,data,horario,local').eq('id', rec.partida_id).maybeSingle(),
    ]);
    if (jogRes.data && parRes.data) {
      const nomeCompleto = `${jogRes.data.nome} ${jogRes.data.sobrenome}`;
      if (rec.confirmado === true) {
        mensagem = msgConfirmacaoPresenca(nomeCompleto, parRes.data);
        // 3s de delay → envia lista completa atualizada (REGRA 2)
        setTimeout(async () => {
          try {
            const lista = await gerarListaCompletaPartida(rec.partida_id);
            if (lista) await enviarParaGrupo(lista);
          } catch (e) { console.error('❌ Lista completa:', e.message); }
        }, 3000);
      } else if (rec.confirmado === false) {
        mensagem = msgRecusaPresenca(nomeCompleto, parRes.data);
        setTimeout(async () => {
          try {
            const lista = await gerarListaCompletaPartida(rec.partida_id);
            if (lista) await enviarParaGrupo(lista);
          } catch (e) { console.error('❌ Lista completa:', e.message); }
        }, 3000);
      }
    }
  }

  // ── REGRA 1 — Pagamento de mensalidade → atualiza lista com 💰 ────────────
  if (tabela === 'pagamentos') {
    const ficouPago = rec.status === 'pago' && recAntigo?.status !== 'pago';
    if ((tipo === 'INSERT' && rec.status === 'pago') || (tipo === 'UPDATE' && ficouPago)) {
      // 1. Mensagem individual de quitação
      const { data: jog } = await supabase
        .from('jogadores').select('nome,sobrenome,posicao,is_gold,membro_status').eq('id', rec.jogador_id).maybeSingle();

      if (jog) {
        const { count } = await supabase.from('pagamentos')
          .select('*', { count: 'exact', head: true })
          .eq('mes_ref', rec.mes_ref).eq('status', 'pago');
        mensagem = msgQuitacaoMensalidade(jog, rec.mes_ref, rec.valor, count || 1);
      }

      // 2. Após 3s, envia lista de renovação atualizada com 💰 no nome de quem pagou
      setTimeout(async () => {
        try {
          const { data: jogadores } = await supabase
            .from('jogadores')
            .select('id,nome,sobrenome,posicao,membro_status,is_gold')
            .eq('status', 'ativo')
            .eq('membro_status', 'mensalista')
            .order('nome');

          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('jogador_id,mes_ref,status')
            .eq('mes_ref', rec.mes_ref)
            .eq('status', 'pago');

          const listaAtualizada = msgListaMensalidadeAtualizada(rec.mes_ref, jogadores || [], pagamentos || []);
          await enviarParaGrupo(listaAtualizada);
        } catch (e) { console.error('❌ Lista mensalidade atualizada:', e.message); }
      }, 3000);
    }
  }

  // ── Novo jogador aprovado ──────────────────────────────────────────────────
  if (tabela === 'jogadores' && tipo === 'UPDATE'
      && recAntigo?.status === 'pendente_aprovacao' && rec.status === 'ativo') {
    mensagem = msgNovoJogadorAprovado(rec);
  }

  // ── Novo mensalista adicionado → inclui no fim da lista de renovação ───────
  if (tabela === 'jogadores' && tipo === 'UPDATE'
      && rec.membro_status === 'mensalista'
      && recAntigo?.membro_status !== 'mensalista'
      && rec.status === 'ativo') {
    // Verifica se estamos dentro do período de renovação
    const periodoAtivo = estaNoPeriodoRenovacao(new Date());
    if (periodoAtivo) {
      setTimeout(async () => {
        try {
          const mesRef = getMesRefAtual();
          const { data: jogadores } = await supabase
            .from('jogadores')
            .select('id,nome,sobrenome,posicao,membro_status,is_gold')
            .eq('status', 'ativo').eq('membro_status', 'mensalista').order('nome');

          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('jogador_id,mes_ref,status')
            .eq('mes_ref', mesRef).eq('status', 'pago');

          const lista = msgListaMensalidadeAtualizada(mesRef, jogadores || [], pagamentos || []);
          await enviarParaGrupo(lista);
          console.log(`✅ [REGRA1] Novo mensalista ${rec.nome} incluído na lista de renovação`);
        } catch (e) { console.error('❌ Novo mensalista na lista:', e.message); }
      }, 3000);
    }
  }

  if (mensagem) {
    await enviarParaGrupo(mensagem);
    supabase.from('bot_logs').insert({
      evento: tipo, tabela, mensagem: mensagem.substring(0, 500),
      enviado_em: new Date().toISOString(),
    }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE DATA — REGRA 1
// ─────────────────────────────────────────────────────────────────────────────

/** Retorna o mesRef do mês de renovação atual (ex: "2026-06") */
function getMesRefAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Verifica se a data está dentro do período de renovação:
 * 1º dia pós-último sábado do mês anterior → véspera do 2º sábado do mês atual
 */
function estaNoPeriodoRenovacao(hoje) {
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();

  // Início: dia seguinte ao último sábado do mês anterior
  const ultimoDiaMesAnt = new Date(ano, mes, 0);
  const ultimoSabadoAnt = new Date(ultimoDiaMesAnt);
  while (ultimoSabadoAnt.getDay() !== 6) ultimoSabadoAnt.setDate(ultimoSabadoAnt.getDate() - 1);
  const inicio = new Date(ultimoSabadoAnt);
  inicio.setDate(ultimoSabadoAnt.getDate() + 1);
  inicio.setHours(0, 0, 0, 0);

  // Fim: véspera do 2º sábado do mês atual
  const primeiroDiaMes = new Date(ano, mes, 1);
  const primeiroSab = new Date(primeiroDiaMes);
  while (primeiroSab.getDay() !== 6) primeiroSab.setDate(primeiroSab.getDate() + 1);
  const segundoSab = new Date(primeiroSab);
  segundoSab.setDate(primeiroSab.getDate() + 7);
  const fim = new Date(segundoSab);
  fim.setDate(segundoSab.getDate() - 1);
  fim.setHours(23, 59, 59, 999);

  return hoje >= inicio && hoje <= fim;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES DE MENSAGEM
// ─────────────────────────────────────────────────────────────────────────────

function formatarDataJogo(dataStr, horario) {
  const d = new Date(`${dataStr}T12:00:00`);
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  // Capitaliza
  const semanaFmt = semana.charAt(0).toUpperCase() + semana.slice(1);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hor  = (horario || '').split(' ')[0]; // pega só "08:00" de "08:00 às 10:00"
  return `${semanaFmt}, ${data} às ${hor}`;
}

function formatarDataAmigavel(dataStr) {
  const d = new Date(`${dataStr}T12:00:00`);
  const sem  = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const semFmt = sem.charAt(0).toUpperCase() + sem.slice(1);
  const dia  = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
  return `${semFmt}, ${dia}`;
}

/** REGRA 1 — Mensagem de abertura do período de renovação */
function msgAberturaMensalidade(mesRef, jogadores, pagamentos) {
  const mesFormatado = mesRef.split('-').reverse().join('/');
  const lista = buildListaMensalistas(mesRef, jogadores, pagamentos);

  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🔄 *ABERTURA DE RENOVAÇÃO DE MENSALIDADE* 🔄\n` +
    `📅 *Referência: ${mesFormatado}*\n\n` +
    `Galera, está aberta a janela de renovação de mensalidade!\n` +
    `Abaixo a situação atual dos nossos mensalistas:\n\n` +
    `${lista}\n\n` +
    `----------------------------------------\n` +
    `💰 Pague sua mensalidade pelo portal e garanta sua vaga!\n` +
    `📲 https://peladabatista.onrender.com`
  );
}

/** REGRA 1 — Lista atualizada após cada pagamento */
function msgListaMensalidadeAtualizada(mesRef, jogadores, pagamentos) {
  const mesFormatado = mesRef.split('-').reverse().join('/');
  const lista = buildListaMensalistas(mesRef, jogadores, pagamentos);
  const totalPago = pagamentos.length;
  const total     = jogadores.length;

  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `💰 *MENSALIDADE ATUALIZADA — ${mesFormatado}* 💰\n\n` +
    `Situação atual dos mensalistas:\n\n` +
    `${lista}\n\n` +
    `📊 *${totalPago} de ${total} mensalistas quitados*\n` +
    `----------------------------------------\n` +
    `📲 Acesse o portal para quitar sua mensalidade:\nhttps://peladabatista.onrender.com`
  );
}

/** Monta a lista numerada de mensalistas com 💰 nos que pagaram */
function buildListaMensalistas(mesRef, jogadores, pagamentos) {
  if (!jogadores.length) return '_Nenhum mensalista cadastrado_';

  const pagouIds = new Set((pagamentos || []).map(p => p.jogador_id));

  return jogadores.map((j, i) => {
    const pagou  = pagouIds.has(j.id);
    const gold   = j.is_gold ? ' 🏅' : '';
    const status = pagou ? ' 💰' : '';
    return `${i + 1}. *${j.nome} ${j.sobrenome}*${gold}${status}`;
  }).join('\n');
}

function msgNovaPartida(p) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🏆 *NOVO JOGO AGENDADO!* 🏆\n\n` +
    `📋 *${p.titulo}*\n` +
    `🗓️ Data: *${formatarDataJogo(p.data, p.horario)}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `⏰ *Janela de confirmação:*\n` +
    `🗓️ Terça-feira às 00:00 até Sexta-feira às 23:59\n\n` +
    `📲 Confirme sua presença no portal:\n${CONFIG.PORTAL_URL}`
  );
}

/** REGRA 3 — Formato exato solicitado */
function msgPartidaCancelada(p) {
  const d   = new Date(`${p.data}T12:00:00`);
  const hor = (p.horario || '').split(' ')[0];
  const dataFormatada = d.toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric'
  });
  const dataFmt = dataFormatada.charAt(0).toUpperCase() + dataFormatada.slice(1);

  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `❌ *JOGO CANCELADO!* ❌\n\n` +
    `📋 *${p.titulo}*\n` +
    `🗓️ Data: *${dataFmt} às ${hor}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `📲 Acesse nosso portal:\n${CONFIG.PORTAL_URL}`
  );
}

function msgPartidaReativada(p) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🟢 *JOGO REATIVADO!* 🟢\n\n` +
    `A partida *${p.titulo}* foi reativada e acontecerá normalmente!\n\n` +
    `🗓️ Data: *${formatarDataJogo(p.data, p.horario)}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `📲 Confirme sua presença:\n${CONFIG.PORTAL_URL}`
  );
}

function msgConfirmacaoPresenca(nomeCompleto, p) {
  return (
    `⚽ *CONFIRMAÇÃO DE PELADA - FC* ⚽\n\n` +
    `Fala galera! O atleta *${nomeCompleto}* confirmou presença para a partida:\n\n` +
    `🏆 *${p.titulo}*\n` +
    `📅 Data: *${formatarDataJogo(p.data, p.horario)}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `_Bora pro jogo tirar aquela onda!_ 💪🏃‍♂️💨`
  );
}

function msgRecusaPresenca(nomeCompleto, p) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n\n` +
    `Informamos que o atleta *${nomeCompleto}* registrou *ausência* na partida:\n\n` +
    `🏆 *${p.titulo}*\n` +
    `📅 Data: *${formatarDataJogo(p.data, p.horario)}*\n\n` +
    `_Lista de presença atualizada no portal._ 📲\n${CONFIG.PORTAL_URL}`
  );
}

function msgQuitacaoMensalidade(jog, mesRef, valor, totalQuitados) {
  const medalha      = jog.is_gold ? ' 🏅' : '';
  const mesFormatado = mesRef.split('-').reverse().join('/');
  return (
    `💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA SÁBADO* 💰\n\n` +
    `Atleta: *${jog.nome} ${jog.sobrenome}* (${jog.posicao})${medalha}\n` +
    `Referência: *${mesFormatado}*\n` +
    `Valor Quitado: *R$ ${Number(valor).toFixed(2)}*\n` +
    `Status: *PAGO & CONFIRMADO* ✅\n\n` +
    `📊 *Informativo Financeiro:*\n` +
    `- Total de mensalistas quitados neste período: *${totalQuitados}* (Limite regulamentado de 25 mensalistas)\n\n` +
    `Muito obrigado pelo compromisso em manter o nosso futebol rodando redondo de campo pago e bola cheia! 🤝⚽🏃‍♂️💨`
  );
}

function msgNovoJogadorAprovado(j) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🎉 *NOVO ATLETA APROVADO!* 🎉\n\n` +
    `Bem-vindo ao elenco, *${j.nome} ${j.sobrenome}*!\n` +
    `📋 Posição: *${j.posicao}*\n` +
    `👤 Categoria: *${j.membro_status}*\n\n` +
    `_Boas-vindas ao grupo e bora pro jogo!_ ⚽🏃‍♂️💨\n\n` +
    `📲 Portal da Pelada:\n${CONFIG.PORTAL_URL}`
  );
}

/** REGRA 2 — Lista completa A/B/C/D/E no formato exato solicitado */
async function gerarListaCompletaPartida(partidaId) {
  try {
    const [pRes, prRes, jRes] = await Promise.all([
      supabase.from('partidas').select('*').eq('id', partidaId).single(),
      supabase.from('presencas').select('jogador_id,confirmado').eq('partida_id', partidaId),
      supabase.from('jogadores').select('id,nome,sobrenome,posicao,membro_status,is_gold').eq('status', 'ativo'),
    ]);
    if (pRes.error || !pRes.data) return null;

    const partida   = pRes.data;
    const presencas = prRes.data || [];
    const jogadores = jRes.data  || [];
    const byId      = Object.fromEntries(jogadores.map(j => [j.id, j]));

    const rawConfirmados = presencas.filter(p => p.confirmado === true).map(p => byId[p.jogador_id]).filter(Boolean);
    const recusados      = presencas.filter(p => p.confirmado === false).map(p => byId[p.jogador_id]).filter(Boolean);

    const finalConfirmed = [];
    const waitingList    = [];

    for (const j of rawConfirmados) {
      if (j.posicao === 'Goleiro') {
        finalConfirmed.push(j);
      } else {
        const linhaCount = finalConfirmed.filter(x => x.posicao !== 'Goleiro').length;
        if (linhaCount < 25) {
          finalConfirmed.push(j);
        } else if (j.membro_status === 'mensalista') {
          const idx = [...finalConfirmed].reverse()
            .findIndex(x => x.posicao !== 'Goleiro' && x.membro_status === 'diarista');
          if (idx !== -1) {
            const realIdx = finalConfirmed.length - 1 - idx;
            const [saindo] = finalConfirmed.splice(realIdx, 1);
            finalConfirmed.push(j);
            waitingList.unshift(saindo);
          } else {
            waitingList.push(j);
          }
        } else {
          waitingList.push(j);
        }
      }
    }

    const mensalistas = finalConfirmed.filter(j => j.posicao !== 'Goleiro' && j.membro_status === 'mensalista');
    const diaristas   = finalConfirmed.filter(j => j.posicao !== 'Goleiro' && j.membro_status !== 'mensalista');
    const goleiros    = finalConfirmed.filter(j => j.posicao === 'Goleiro');

    const fmt  = (j, i) => `${i + 1}. *${j.nome} ${j.sobrenome}* - ${j.posicao}${j.is_gold ? ' 🏅' : ''}`;
    const fmtG = (j, i) => `${i + 1}. *${j.nome} ${j.sobrenome}*${j.is_gold ? ' 🏅' : ''}`;

    const strM = mensalistas.length ? mensalistas.map(fmt).join('\n')  : '_Nenhum mensalista confirmado ainda_';
    const strD = diaristas.length   ? diaristas.map(fmt).join('\n')    : '_Nenhum diarista confirmado ainda_';
    const strG = goleiros.length    ? goleiros.map(fmtG).join('\n')    : '_Nenhum goleiro confirmado ainda_';
    const strA = recusados.length   ? recusados.map(fmt).join('\n')    : '_Nenhuma ausência registrada_';
    const strE = waitingList.length ? waitingList.map(fmt).join('\n')  : '_Nenhum jogador em lista de espera_';

    const d            = new Date(`${partida.data}T12:00:00`);
    // Formato: "Sábado, 25 de junho"
    const diaSem = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const diaSemFmt = diaSem.charAt(0).toUpperCase() + diaSem.slice(1);
    const diaNum = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    const dataAmigavel = `${diaSemFmt}, ${diaNum}`;
    const hor = (partida.horario || '').split(' ')[0];

    // Formato EXATO da Regra 2
    return (
      `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
      `🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆\n\n` +
      `📅 Jogo: *${partida.titulo}*\n` +
      `🗓️ Data: *${dataAmigavel}* às *${hor}*\n` +
      `📍 Local: *${partida.local}*\n\n` +
      `*A - MENSALISTAS:*\n${strM}\n\n` +
      `*B - DIARISTAS:*\n${strD}\n\n` +
      `*C - GOLEIROS:*\n${strG}\n\n` +
      `*D - JOGADORES AUSENTES:*\n${strA}\n\n` +
      `*E - LISTA DE ESPERA:*\n${strE}\n\n` +
      `----------------------------------------\n` +
      `📲 Acesse o portal oficial para confirmar ou alterar sua presença:\nhttps://peladabatista.onrender.com`
    );
  } catch (err) {
    console.error('❌ gerarListaCompleta:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// ENVIO AO GRUPO
// ─────────────────────────────────────────────────────────────────────────────
async function enviarParaGrupo(texto) {
  if (!sock || !isConnected) throw new Error('WhatsApp não conectado');
  if (!CONFIG.DEFAULT_GROUP_ID) throw new Error('WHATSAPP_GROUP_ID não configurado');
  const jid = await resolverJID(CONFIG.DEFAULT_GROUP_ID);
  await sock.sendMessage(jid, { text: texto });
  console.log(`📤 Mensagem enviada → ${jid}`);
}

async function resolverJID(grupoId) {
  if (!grupoId) throw new Error('grupo_id vazio');
  if (jidCache.has(grupoId)) return jidCache.get(grupoId);

  let jid;
  if (grupoId.includes('chat.whatsapp.com/')) {
    const codigo = grupoId.split('chat.whatsapp.com/').pop().split('?')[0].trim();
    try {
      const meta = await sock.groupGetInviteInfo(codigo);
      jid = meta.id;
    } catch (err) {
      throw new Error(`Não foi possível resolver link de convite: ${err.message}`);
    }
  } else if (grupoId.includes('@g.us')) {
    jid = grupoId;
  } else {
    jid = `${grupoId.replace(/\D/g, '')}@g.us`;
  }

  jidCache.set(grupoId, jid);
  console.log(`✅ JID resolvido: ${grupoId} → ${jid}`);
  return jid;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO — Supabase Storage
// ─────────────────────────────────────────────────────────────────────────────
async function baixarSessao() {
  console.log('📥 Restaurando sessão do Supabase Storage...');
  try {
    const { data: arquivos } = await supabase.storage.from(CONFIG.SUPABASE_BUCKET).list('session/');
    if (!arquivos?.length) { console.log('ℹ️  Sem sessão salva — escaneie o QR Code'); return false; }
    if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
      fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });
    for (const arq of arquivos) {
      const { data } = await supabase.storage.from(CONFIG.SUPABASE_BUCKET).download(`session/${arq.name}`);
      if (data) fs.writeFileSync(path.join(CONFIG.SESSION_LOCAL_PATH, arq.name), Buffer.from(await data.arrayBuffer()));
    }
    console.log(`✅ Sessão restaurada (${arquivos.length} arquivos)`);
    return true;
  } catch (err) { console.error('❌ Erro ao baixar sessão:', err.message); return false; }
}

async function salvarSessao() {
  if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH)) return;
  try {
    for (const nome of fs.readdirSync(CONFIG.SESSION_LOCAL_PATH)) {
      const conteudo = fs.readFileSync(path.join(CONFIG.SESSION_LOCAL_PATH, nome));
      await supabase.storage.from(CONFIG.SUPABASE_BUCKET).upload(`session/${nome}`, conteudo, { upsert: true });
    }
    console.log('💾 Sessão salva no Supabase');
  } catch (err) { console.error('❌ Erro ao salvar sessão:', err.message); }
}

async function limparSessao() {
  if (fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.rmSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true, force: true });
  jidCache.clear();
  try {
    const { data: arqs } = await supabase.storage.from(CONFIG.SUPABASE_BUCKET).list('session/');
    if (arqs?.length) await supabase.storage.from(CONFIG.SUPABASE_BUCKET).remove(arqs.map(f => `session/${f.name}`));
  } catch {}
  console.log('🗑️  Sessão limpa');
}

// ─────────────────────────────────────────────────────────────────────────────
// SELF-PING
// ─────────────────────────────────────────────────────────────────────────────
function iniciarSelfPing() {
  if (pingInterval) clearInterval(pingInterval);
  pingInterval = setInterval(async () => {
    try {
      const fetch = (await import('node-fetch')).default;
      await fetch(`${CONFIG.SELF_URL}/`);
      console.log('🏓 Self-ping OK');
    } catch { console.warn('⚠️  Self-ping falhou'); }
  }, CONFIG.PING_INTERVAL_MS);
  console.log(`🏓 Self-ping ativo (a cada ${CONFIG.PING_INTERVAL_MS / 1000}s)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BAILEYS
// ─────────────────────────────────────────────────────────────────────────────
async function conectarWhatsApp() {
  if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_LOCAL_PATH);
  const { version }          = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version, logger,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    printQRInTerminal: false, markOnlineOnConnect: false,
    connectTimeoutMs: 30000, defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 25000, retryRequestDelayMs: 2000,
  });

  sock.ev.on('creds.update', async () => { await saveCreds(); await salvarSessao(); });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { currentQR = qr; console.log(`\n🔗 QR Code em: ${CONFIG.SELF_URL}/qr\n`); }
    if (connection === 'open') {
      isConnected = true; currentQR = null; reconnectAttempts = 0;
      console.log('✅ WhatsApp conectado!');
      await salvarSessao();
      iniciarSelfPing();
      iniciarCronDiario();   // ← Inicia o cron da REGRA 1 ao conectar
    }
    if (connection === 'close') {
      isConnected = false;
      const code = lastDisconnect?.error?.output?.statusCode;
      console.warn(`⚠️  Conexão encerrada — código: ${code}`);
      if (code === DisconnectReason.loggedOut) {
        console.error('🚪 Logout! Limpando sessão...');
        await limparSessao();
        await conectarWhatsApp();
        return;
      }
      reconnectAttempts++;
      const delay = Math.min(CONFIG.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1), CONFIG.RECONNECT_MAX_MS);
      console.log(`🔄 Reconectando em ${delay / 1000}s (tentativa #${reconnectAttempts})...`);
      setTimeout(conectarWhatsApp, delay);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
async function iniciar() {
  console.log('🚀 Robô Pelada Batista v2.1 — iniciando...');
  console.log(`📡 URL: ${CONFIG.SELF_URL}`);
  console.log(`🔐 Secret: ${CONFIG.WEBHOOK_SECRET ? '✅' : '❌ NÃO configurado!'}`);
  console.log('📋 Regras ativas: REGRA1(cron+webhook) | REGRA2(webhook) | REGRA3(webhook)');

  app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Servidor na porta ${CONFIG.PORT}`);
    console.log(`📱 QR Code em: ${CONFIG.SELF_URL}/qr`);
  });

  await baixarSessao();
  await conectarWhatsApp();
}

iniciar().catch(err => { console.error('💥 Erro fatal:', err); process.exit(1); });
