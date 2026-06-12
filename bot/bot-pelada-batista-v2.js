/**
 * ⚽ ROBÔ PELADA BATISTA — WhatsApp Bot v2
 *
 * ARQUITETURA APÓS ANÁLISE DO COMMIT:
 * ─────────────────────────────────────────────────────────────
 * O frontend (peladabatista.onrender.com) NÃO usa webhooks do
 * Supabase para disparar mensagens. Ele chama o bot DIRETAMENTE
 * via fetch() para POST /teste com o payload:
 *   { mensagem: string, grupo_id: string }
 *   header: x-webhook-secret
 *
 * O grupo_id pode ser:
 *   - Link de convite: https://chat.whatsapp.com/XXXXX
 *   - JID completo:    120363XXXXXXXXXX@g.us
 *   - Só números:      120363XXXXXXXXXX
 *
 * DOIS MODOS DE OPERAÇÃO:
 *   1. DIRETO (principal): Frontend → POST /teste → bot envia ao grupo
 *   2. WEBHOOK Supabase (redundância): Supabase → POST /webhook → bot envia
 *
 * ANTI-LOGOUT (Render Free):
 *   - Sessão persistida no Supabase Storage
 *   - Self-ping a cada 9 min
 *   - Reconnect com backoff exponencial
 *   - Cache de JID: resolve grupo_id uma vez e reutiliza
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
  DEFAULT_GROUP_ID:   process.env.WHATSAPP_GROUP_ID,  // fallback se frontend não enviar
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

// Cache de JID resolvido (evita re-busca para cada mensagem)
const jidCache = new Map();

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// CORS — permite que o frontend (peladabatista.onrender.com) chame o bot
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── GET / — health check ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app:                  '⚽ Robô Pelada Batista v2',
    status:               isConnected ? '✅ Conectado' : '⏳ Aguardando QR',
    qr_disponivel:        !isConnected && !!currentQR,
    tentativas_reconexao: reconnectAttempts,
    uptime_segundos:      Math.floor(process.uptime()),
    grupo_padrao:         CONFIG.DEFAULT_GROUP_ID ? '✅ configurado' : '⚠️ não configurado',
  });
});

// ── GET /qr — página visual do QR Code ───────────────────────────────────────
app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#e8f5e9">
        <h1 style="color:#2e7d32">✅ WhatsApp Conectado!</h1>
        <p>O Robô da Pelada Batista está ativo e enviando mensagens.</p>
        <a href="/">Ver status completo</a>
      </body></html>`);
  }
  if (!currentQR) {
    return res.send(`
      <html><head><meta http-equiv="refresh" content="5"></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;background:#fff8e1">
        <h1>⏳ Gerando QR Code...</h1>
        <p>Página recarrega automaticamente em 5 segundos.</p>
      </body></html>`);
  }
  const qrImg = await qrcode.toDataURL(currentQR, { width: 300, margin: 2 });
  res.send(`
    <html>
    <head><meta http-equiv="refresh" content="30">
    <style>
      body{font-family:sans-serif;text-align:center;padding:40px;background:#f1f8e9}
      .card{display:inline-block;background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.1)}
      img{border:4px solid #4CAF50;border-radius:8px}
      h1{color:#2e7d32}
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

// ── POST /teste — chamado DIRETAMENTE pelo frontend PeladaBatista ─────────────
// Payload: { mensagem: string, grupo_id?: string }
// Header:  x-webhook-secret
app.post('/teste', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET) {
    console.warn('⚠️  /teste rejeitado: secret inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!isConnected) {
    console.warn('⚠️  /teste: WhatsApp não conectado');
    return res.status(503).json({
      error: 'WhatsApp não conectado. Acesse /qr para conectar.',
      qr_url: `${CONFIG.SELF_URL}/qr`
    });
  }

  const { mensagem, grupo_id } = req.body;

  if (!mensagem) {
    return res.status(400).json({ error: 'Campo "mensagem" é obrigatório' });
  }

  // Resolve o grupo: usa o enviado pelo frontend, senão usa o padrão
  const grupoAlvo = grupo_id || CONFIG.DEFAULT_GROUP_ID;
  if (!grupoAlvo) {
    return res.status(400).json({
      error: 'grupo_id não informado e WHATSAPP_GROUP_ID não configurado no servidor'
    });
  }

  try {
    const jid = await resolverJID(grupoAlvo);
    await sock.sendMessage(jid, { text: mensagem });

    console.log(`📤 [/teste] Mensagem enviada → ${jid}`);
    console.log(`   Preview: ${mensagem.substring(0, 80).replace(/\n/g, ' ')}...`);

    // Loga no Supabase (sem bloquear a resposta)
    supabase.from('bot_logs').insert({
      evento:     'DIRETO',
      tabela:     'frontend',
      mensagem:   mensagem.substring(0, 500),
      enviado_em: new Date().toISOString(),
    }).catch(() => {});

    res.json({ success: true, jid });
  } catch (err) {
    console.error('❌ Erro ao enviar via /teste:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhook — eventos automáticos do Supabase (modo redundância) ────────
app.post('/webhook', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isConnected) {
    return res.status(503).json({ error: 'WhatsApp não conectado' });
  }

  const { type, table, record, old_record } = req.body;
  console.log(`📥 [/webhook] ${type} em "${table}"`);

  try {
    await processarEventoWebhook(type, table, record, old_record);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro no webhook:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RESOLUÇÃO DE JID
// Suporta: link de convite, JID completo, só números
// ─────────────────────────────────────────────────────────────────────────────
async function resolverJID(grupoId) {
  if (!grupoId) throw new Error('grupo_id vazio');

  // Já está em cache
  if (jidCache.has(grupoId)) return jidCache.get(grupoId);

  let jid;

  // É um link de convite do WhatsApp
  if (grupoId.includes('chat.whatsapp.com/')) {
    const codigo = grupoId.split('chat.whatsapp.com/').pop().split('?')[0].trim();
    console.log(`🔗 Resolvendo link de convite: ${codigo}`);
    try {
      const info = await sock.groupAcceptInvite(codigo).catch(() => null);
      if (info) {
        // groupAcceptInvite retorna o JID do grupo após entrar
        jid = info;
      } else {
        // Tenta apenas obter metadata sem entrar
        const meta = await sock.groupGetInviteInfo(codigo);
        jid = meta.id;
      }
    } catch (err) {
      throw new Error(`Não foi possível resolver link de convite: ${err.message}`);
    }
  }
  // Já é JID completo
  else if (grupoId.includes('@g.us')) {
    jid = grupoId;
  }
  // Só números
  else {
    jid = `${grupoId.replace(/\D/g, '')}@g.us`;
  }

  jidCache.set(grupoId, jid);
  console.log(`✅ JID resolvido: ${grupoId} → ${jid}`);
  return jid;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSADOR DE EVENTOS WEBHOOK (modo redundância via Supabase)
// ─────────────────────────────────────────────────────────────────────────────
async function processarEventoWebhook(tipo, tabela, rec, recAntigo) {
  let mensagem = null;

  if (tabela === 'partidas') {
    if (tipo === 'INSERT' && !rec.cancelada) {
      mensagem = msgNovaPartida(rec);
    }
    if (tipo === 'UPDATE') {
      const foiCancelada = !recAntigo?.cancelada && rec.cancelada;
      const foiReativada = recAntigo?.cancelada && !rec.cancelada;
      if (foiCancelada) mensagem = msgPartidaCancelada(rec);
      if (foiReativada) mensagem = msgPartidaReativada(rec);
    }
  }

  if (tabela === 'presencas' && (tipo === 'INSERT' || tipo === 'UPDATE')) {
    const [jogRes, parRes] = await Promise.all([
      supabase.from('jogadores').select('nome,sobrenome,posicao,membro_status,is_gold').eq('id', rec.jogador_id).maybeSingle(),
      supabase.from('partidas').select('titulo,data,horario,local').eq('id', rec.partida_id).maybeSingle(),
    ]);
    if (jogRes.data && parRes.data) {
      const nomeCompleto = `${jogRes.data.nome} ${jogRes.data.sobrenome}`;
      if (rec.confirmado === true) {
        mensagem = msgConfirmacaoPresenca(nomeCompleto, parRes.data);
        setTimeout(async () => {
          try {
            const lista = await gerarListaCompletaPartida(rec.partida_id);
            if (lista) await enviarParaGrupo(lista);
          } catch {}
        }, 3000);
      } else if (rec.confirmado === false) {
        mensagem = msgRecusaPresenca(nomeCompleto, parRes.data);
      }
    }
  }

  if (tabela === 'pagamentos') {
    const ficouPago = rec.status === 'pago' && recAntigo?.status !== 'pago';
    if ((tipo === 'INSERT' && rec.status === 'pago') || (tipo === 'UPDATE' && ficouPago)) {
      const { data: jog } = await supabase
        .from('jogadores').select('nome,sobrenome,posicao,is_gold').eq('id', rec.jogador_id).maybeSingle();
      if (jog) {
        const { count } = await supabase.from('pagamentos')
          .select('*', { count: 'exact', head: true })
          .eq('mes_ref', rec.mes_ref).eq('status', 'pago');
        mensagem = msgQuitacaoMensalidade(jog, rec.mes_ref, rec.valor, count || 1);
      }
    }
  }

  if (tabela === 'jogadores' && tipo === 'UPDATE'
      && recAntigo?.status === 'pendente_aprovacao' && rec.status === 'ativo') {
    mensagem = msgNovoJogadorAprovado(rec);
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
// ENVIO PARA O GRUPO PADRÃO (modo webhook)
// ─────────────────────────────────────────────────────────────────────────────
async function enviarParaGrupo(texto) {
  if (!sock || !isConnected) throw new Error('WhatsApp não conectado');
  if (!CONFIG.DEFAULT_GROUP_ID) throw new Error('WHATSAPP_GROUP_ID não configurado');
  const jid = await resolverJID(CONFIG.DEFAULT_GROUP_ID);
  await sock.sendMessage(jid, { text: texto });
  console.log(`📤 Mensagem enviada → ${jid}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES DE MENSAGEM
// Espelham src/utils/confirmationRules.ts + src/components/ConfirmacaoPresenca.tsx
// ─────────────────────────────────────────────────────────────────────────────

function formatarDataJogo(dataStr, horario) {
  const d = new Date(`${dataStr}T12:00:00`);
  const semana = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const data   = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${semana}, ${data} às *${horario}*`;
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

function msgPartidaCancelada(p) {
  const d = new Date(`${p.data}T12:00:00`);
  const dataAmigavel = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    `⚠️ *ATENÇÃO: PELADA CANCELADA!* ⚠️\n\n` +
    `A partida *${p.titulo}* do dia *${dataAmigavel}* foi oficialmente CANCELADA.\n\n` +
    `Fique atento aos próximos jogos e comunicados da diretoria. Não vá ao campo à toa!`
  );
}

function msgPartidaReativada(p) {
  const d = new Date(`${p.data}T12:00:00`);
  const dataAmigavel = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  return (
    `⚽ *BOA NOTÍCIA: PELADA REATIVADA!* ⚽\n\n` +
    `A partida *${p.titulo}* do dia *${dataAmigavel}* foi reativada e vai acontecer normalmente!\n\n` +
    `A pelada segue viva, não deixe de confirmar sua presença! 💪\n` +
    `📲 ${CONFIG.PORTAL_URL}`
  );
}

// Espelha obterTextoConfirmacaoJogador()
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

// Espelha obterTextoQuitacaoMensalidade()
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

// Espelha obterTextoListaCompletaPartida() — buscando dados frescos do Supabase
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

    // Regra de prioridade: 25 jogadores de linha, mensalistas têm preferência
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

    const fmt  = (j, i) => `${i + 1}. *${j.nome} ${j.sobrenome}* - ${j.posicao}${j.is_gold ? ' 🏅' : ''}`;
    const fmtG = (j, i) => `${i + 1}. *${j.nome} ${j.sobrenome}*${j.is_gold ? ' 🏅' : ''}`;

    const mensalistas = finalConfirmed.filter(j => j.posicao !== 'Goleiro' && j.membro_status === 'mensalista');
    const diaristas   = finalConfirmed.filter(j => j.posicao !== 'Goleiro' && j.membro_status !== 'mensalista');
    const goleiros    = finalConfirmed.filter(j => j.posicao === 'Goleiro');

    const strM = mensalistas.length ? mensalistas.map(fmt).join('\n')  : '_Nenhum mensalista confirmado ainda_';
    const strD = diaristas.length   ? diaristas.map(fmt).join('\n')    : '_Nenhum diarista confirmado ainda_';
    const strG = goleiros.length    ? goleiros.map(fmtG).join('\n')    : '_Nenhum goleiro confirmado ainda_';
    const strA = recusados.length   ? recusados.map(fmt).join('\n')    : '_Nenhuma ausência registrada_';
    const strE = waitingList.length ? waitingList.map(fmt).join('\n')  : '_Nenhum jogador em lista de espera_';

    const d            = new Date(`${partida.data}T12:00:00`);
    const dataAmigavel = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

    return (
      `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
      `🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆\n\n` +
      `📅 Jogo: *${partida.titulo}*\n` +
      `🗓️ Data: *${dataAmigavel}* às *${partida.horario}*\n` +
      `📍 Local: *${partida.local}*\n\n` +
      `*A - MENSALISTAS:*\n${strM}\n\n` +
      `*B - DIARISTAS:*\n${strD}\n\n` +
      `*C - GOLEIROS:*\n${strG}\n\n` +
      `*D - JOGADORES AUSENTES:*\n${strA}\n\n` +
      `*E - LISTA DE ESPERA:*\n${strE}\n\n` +
      `----------------------------------------\n` +
      `📲 Acesse o portal oficial para confirmar ou alterar sua presença:\n${CONFIG.PORTAL_URL}`
    );
  } catch (err) {
    console.error('Erro ao gerar lista completa:', err.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO — Supabase Storage
// ─────────────────────────────────────────────────────────────────────────────
async function baixarSessao() {
  console.log('📥 Restaurando sessão do Supabase Storage...');
  try {
    const { data: arquivos } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET).list('session/');
    if (!arquivos?.length) { console.log('ℹ️  Sem sessão salva — escaneie o QR Code'); return false; }
    if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
      fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });
    for (const arq of arquivos) {
      const { data } = await supabase.storage
        .from(CONFIG.SUPABASE_BUCKET).download(`session/${arq.name}`);
      if (data) fs.writeFileSync(
        path.join(CONFIG.SESSION_LOCAL_PATH, arq.name),
        Buffer.from(await data.arrayBuffer())
      );
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
      await supabase.storage.from(CONFIG.SUPABASE_BUCKET)
        .upload(`session/${nome}`, conteudo, { upsert: true });
    }
    console.log('💾 Sessão salva no Supabase');
  } catch (err) { console.error('❌ Erro ao salvar sessão:', err.message); }
}

async function limparSessao() {
  if (fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.rmSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true, force: true });
  jidCache.clear();
  try {
    const { data: arqs } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET).list('session/');
    if (arqs?.length)
      await supabase.storage.from(CONFIG.SUPABASE_BUCKET)
        .remove(arqs.map(f => `session/${f.name}`));
  } catch {}
  console.log('🗑️  Sessão limpa');
}

// ─────────────────────────────────────────────────────────────────────────────
// SELF-PING — Render Free nunca dorme
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
// BAILEYS — conexão WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
async function conectarWhatsApp() {
  if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_LOCAL_PATH);
  const { version }          = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal:     false,
    markOnlineOnConnect:   false,
    connectTimeoutMs:      30000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs:   25000,
    retryRequestDelayMs:   2000,
  });

  sock.ev.on('creds.update', async () => {
    await saveCreds();
    await salvarSessao();
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      currentQR = qr;
      console.log(`\n🔗 QR Code disponível em: ${CONFIG.SELF_URL}/qr\n`);
    }
    if (connection === 'open') {
      isConnected       = true;
      currentQR         = null;
      reconnectAttempts = 0;
      console.log('✅ WhatsApp conectado com sucesso!');
      await salvarSessao();
      iniciarSelfPing();
    }
    if (connection === 'close') {
      isConnected = false;
      const code  = lastDisconnect?.error?.output?.statusCode;
      console.warn(`⚠️  Conexão encerrada — código: ${code}`);
      if (code === DisconnectReason.loggedOut) {
        console.error('🚪 Logout! Limpando sessão e reiniciando...');
        await limparSessao();
        await conectarWhatsApp();
        return;
      }
      reconnectAttempts++;
      const delay = Math.min(
        CONFIG.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1),
        CONFIG.RECONNECT_MAX_MS
      );
      console.log(`🔄 Reconectando em ${delay / 1000}s (tentativa #${reconnectAttempts})...`);
      setTimeout(conectarWhatsApp, delay);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
async function iniciar() {
  console.log('🚀 Robô Pelada Batista v2 — iniciando...');
  console.log(`📡 URL pública: ${CONFIG.SELF_URL}`);
  console.log(`🔐 Webhook secret: ${CONFIG.WEBHOOK_SECRET ? '✅ configurado' : '❌ NÃO configurado!'}`);

  app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Servidor na porta ${CONFIG.PORT}`);
    console.log(`📱 QR Code em: ${CONFIG.SELF_URL}/qr`);
  });

  await baixarSessao();
  await conectarWhatsApp();
}

iniciar().catch(err => {
  console.error('💥 Erro fatal ao iniciar:', err);
  process.exit(1);
});
