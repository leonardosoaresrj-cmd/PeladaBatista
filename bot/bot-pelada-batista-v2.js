/**
 * ⚽ ROBÔ PELADA BATISTA — WhatsApp Bot v2.3
 *
 * CORREÇÃO CRÍTICA v2.3 — Loop de conexão (código 440/515):
 * ─────────────────────────────────────────────────────────────
 * PROBLEMA: o bot entrava em loop de connect/disconnect porque:
 *   1. sock anterior não era fechado antes de criar novo
 *   2. múltiplas instâncias de ping/cron ficavam ativas
 *   3. código 440 (stream replace) gerava reconexão imediata,
 *      que criava nova sessão duplicada no WhatsApp, que gerava
 *      outro 440, num loop infinito
 *
 * FIX:
 *   - Lock global (isReconnecting) impede reconexões paralelas
 *   - sock.end() + sock.ev.removeAllListeners() antes de criar novo sock
 *   - clearInterval em TODOS os intervalos antes de reconectar
 *   - Código 440: aguarda 10s antes de reconectar (não 3s)
 *   - Código 515 (restart required): aguarda 5s, comportamento normal
 *   - Baileys recebe a opção syncFullHistory: false para reduzir
 *     o volume de mensagens na reconexão inicial
 *
 * MANTIDO DA v2.2:
 *   - Sessão como JSON consolidado na tabela bot_session
 *   - Debounce de 2s no save
 *   - ENOENT fix (verifica existência de cada arquivo)
 *   - 3 Regras (cron renovação, lista presenças, cancelamento)
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
  RECONNECT_BASE_MS:  5000,
  RECONNECT_MAX_MS:   60000,
  SAVE_DEBOUNCE_MS:   2000,
};

// ─── Supabase ─────────────────────────────────────────────────────────────────
const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
const logger   = pino({ level: 'silent' });

// ─── Estado global ────────────────────────────────────────────────────────────
let sock              = null;
let currentQR         = null;
let isConnected       = false;
let reconnectAttempts = 0;
let pingInterval      = null;
let cronInterval      = null;
let saveDebounceTimer = null;

// ── LOCK: impede reconexões paralelas ─────────────────────────────────────────
let isReconnecting    = false;

const jidCache = new Map();

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-webhook-secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.get('/', (req, res) => res.json({
  app:       '⚽ Robô Pelada Batista v2.3',
  status:    isConnected ? '✅ Conectado' : (isReconnecting ? '🔄 Reconectando' : '⏳ Aguardando QR'),
  uptime:    Math.floor(process.uptime()),
  grupo:     CONFIG.DEFAULT_GROUP_ID ? '✅' : '⚠️ não configurado',
  tentativas: reconnectAttempts,
}));

app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;background:#e8f5e9">
      <h1 style="color:#2e7d32">✅ WhatsApp Conectado!</h1>
      <p>Robô Pelada Batista v2.3 operacional.</p><a href="/">Status JSON</a>
    </body></html>`);
  }
  if (!currentQR) {
    return res.send(`<html><head><meta http-equiv="refresh" content="5"></head>
    <body style="font-family:sans-serif;text-align:center;padding:40px;background:#fff8e1">
      <h1>${isReconnecting ? '🔄 Reconectando...' : '⏳ Gerando QR Code...'}</h1>
      <p>Recarrega em 5 segundos.</p></body></html>`);
  }
  const qrImg = await qrcode.toDataURL(currentQR, { width: 300, margin: 2 });
  res.send(`<html><head><meta http-equiv="refresh" content="30">
  <style>
    body{font-family:sans-serif;text-align:center;padding:40px;background:#f1f8e9}
    .card{display:inline-block;background:white;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.1)}
    img{border:4px solid #4CAF50;border-radius:8px} h1{color:#2e7d32}
    ol{text-align:left;background:#e8f5e9;border-radius:8px;padding:16px 24px;margin-top:16px}
  </style></head>
  <body><div class="card">
    <h1>⚽ Pelada Batista — Robô v2.3</h1>
    <p>Escaneie com seu WhatsApp:</p>
    <img src="${qrImg}" alt="QR Code"/>
    <ol>
      <li>Abra o WhatsApp no celular</li>
      <li>3 pontinhos → <b>Aparelhos conectados</b></li>
      <li><b>Conectar um aparelho</b></li>
      <li>Aponte a câmera para o QR acima</li>
    </ol>
    <p style="color:#888;font-size:12px">Recarrega em 30s · QR expira em ~60s</p>
  </div></body></html>`);
});

app.post('/teste', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  if (!isConnected)
    return res.status(503).json({ error: 'WhatsApp não conectado', qr_url: `${CONFIG.SELF_URL}/qr` });

  const { mensagem, grupo_id } = req.body;
  if (!mensagem) return res.status(400).json({ error: '"mensagem" obrigatório' });

  const grupoAlvo = grupo_id || CONFIG.DEFAULT_GROUP_ID;
  if (!grupoAlvo) return res.status(400).json({ error: 'grupo_id não informado' });

  try {
    const jid = await resolverJID(grupoAlvo);
    await sock.sendMessage(jid, { text: mensagem });
    console.log(`📤 [/teste] → ${jid}`);
    supabase.from('bot_logs').insert({
      evento: 'DIRETO', tabela: 'frontend',
      mensagem: mensagem.substring(0, 500), enviado_em: new Date().toISOString(),
    }).catch(() => {});
    res.json({ success: true, jid });
  } catch (err) {
    console.error('❌ /teste:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/webhook', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET)
    return res.status(401).json({ error: 'Unauthorized' });
  if (!isConnected)
    return res.status(503).json({ error: 'WhatsApp não conectado' });

  const { type, table, record, old_record } = req.body;
  console.log(`📥 [webhook] ${type} em "${table}"`);
  try {
    await processarEventoWebhook(type, table, record, old_record);
    res.json({ success: true });
  } catch (err) {
    console.error('❌ webhook:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// LIMPEZA — fecha sock e intervalos antes de reconectar
// ─────────────────────────────────────────────────────────────────────────────
function limparEstado() {
  // Para todos os intervalos
  if (pingInterval)      { clearInterval(pingInterval);  pingInterval  = null; }
  if (cronInterval)      { clearInterval(cronInterval);  cronInterval  = null; }
  if (saveDebounceTimer) { clearTimeout(saveDebounceTimer); saveDebounceTimer = null; }

  // Fecha o sock anterior (se existir) sem disparar evento 'close' novamente
  if (sock) {
    try {
      sock.ev.removeAllListeners();
      sock.end(new Error('limpando para reconexão'));
    } catch {}
    sock = null;
  }

  isConnected = false;
}

// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO — JSON consolidado na tabela bot_session
// ─────────────────────────────────────────────────────────────────────────────
function agendarSalvarSessao() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(salvarSessao, CONFIG.SAVE_DEBOUNCE_MS);
}

async function salvarSessao() {
  if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH)) return;
  try {
    const arquivos = fs.readdirSync(CONFIG.SESSION_LOCAL_PATH);
    if (!arquivos.length) return;
    const obj = {};
    for (const nome of arquivos) {
      const p = path.join(CONFIG.SESSION_LOCAL_PATH, nome);
      if (!fs.existsSync(p)) continue;
      try { obj[nome] = fs.readFileSync(p, 'utf8'); } catch {}
    }
    if (!Object.keys(obj).length) return;
    const { error } = await supabase.from('bot_session').upsert(
      { id: 'main', session_data: JSON.stringify(obj), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
    if (!error) {
      console.log(`💾 Sessão salva (${Object.keys(obj).length} arquivos → bot_session)`);
    } else {
      console.warn('⚠️  Falha ao salvar na tabela, tentando Storage...');
      for (const [nome, conteudo] of Object.entries(obj)) {
        try {
          await supabase.storage.from(CONFIG.SUPABASE_BUCKET)
            .upload(`session/${nome}`, Buffer.from(conteudo, 'utf8'), { upsert: true });
        } catch {}
      }
    }
  } catch (err) {
    console.error('❌ salvarSessao:', err.message);
  }
}

async function baixarSessao() {
  console.log('📥 Restaurando sessão...');
  // Tentativa 1: tabela bot_session
  try {
    const { data } = await supabase.from('bot_session').select('session_data').eq('id', 'main').maybeSingle();
    if (data?.session_data) {
      const obj = JSON.parse(data.session_data);
      const nomes = Object.keys(obj);
      if (nomes.length > 0) {
        if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
          fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });
        for (const [nome, conteudo] of Object.entries(obj))
          fs.writeFileSync(path.join(CONFIG.SESSION_LOCAL_PATH, nome), conteudo, 'utf8');
        console.log(`✅ Sessão restaurada da tabela bot_session (${nomes.length} arquivos)`);
        return true;
      }
    }
  } catch (err) {
    console.warn('⚠️  bot_session indisponível:', err.message);
  }
  // Tentativa 2: Storage (compatibilidade)
  try {
    const { data: arqs } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET).list('session/', { limit: 200 });
    if (arqs?.length) {
      if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
        fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });
      let ok = 0;
      for (const arq of arqs) {
        try {
          const { data } = await supabase.storage
            .from(CONFIG.SUPABASE_BUCKET).download(`session/${arq.name}`);
          if (data) {
            fs.writeFileSync(path.join(CONFIG.SESSION_LOCAL_PATH, arq.name),
              Buffer.from(await data.arrayBuffer()));
            ok++;
          }
        } catch {}
      }
      if (ok > 0) {
        console.log(`✅ Sessão restaurada do Storage (${ok} arquivos) — migrando para bot_session...`);
        await salvarSessao();
        return true;
      }
    }
  } catch {}
  console.log('ℹ️  Sem sessão salva — escaneie o QR Code em /qr');
  return false;
}

async function limparSessaoCompleta() {
  if (fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.rmSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true, force: true });
  jidCache.clear();
  try { await supabase.from('bot_session').delete().eq('id', 'main'); } catch {}
  try {
    const { data: arqs } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET).list('session/', { limit: 200 });
    if (arqs?.length)
      await supabase.storage.from(CONFIG.SUPABASE_BUCKET)
        .remove(arqs.map(f => `session/${f.name}`));
  } catch {}
  console.log('🗑️  Sessão limpa completamente');
}

// ─────────────────────────────────────────────────────────────────────────────
// CONEXÃO WHATSAPP — com lock anti-loop
// ─────────────────────────────────────────────────────────────────────────────
async function conectarWhatsApp() {
  // LOCK: se já está reconectando, não abre outra conexão
  if (isReconnecting) {
    console.log('🔒 Já reconectando — ignorando chamada duplicada');
    return;
  }
  isReconnecting = true;

  // Garante que estado anterior está limpo
  limparEstado();

  if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });

  try {
    const { state, saveCreds } = await useMultiFileAuthState(CONFIG.SESSION_LOCAL_PATH);
    const { version }          = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      printQRInTerminal:   false,
      markOnlineOnConnect: false,
      syncFullHistory:     false,   // reduz volume de sync na reconexão
      connectTimeoutMs:    60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      retryRequestDelayMs: 3000,
    });

    sock.ev.on('creds.update', async () => {
      await saveCreds();
      agendarSalvarSessao();
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        currentQR = qr;
        console.log(`\n🔗 QR Code em: ${CONFIG.SELF_URL}/qr\n`);
      }

      if (connection === 'open') {
        isConnected       = true;
        isReconnecting    = false;  // libera o lock
        currentQR         = null;
        reconnectAttempts = 0;
        console.log('✅ WhatsApp conectado!');
        await salvarSessao();
        iniciarSelfPing();
        iniciarCronDiario();
      }

      if (connection === 'close') {
        const code = lastDisconnect?.error?.output?.statusCode;
        console.warn(`⚠️  Conexão encerrada — código: ${code}`);

        // Logout explícito: limpa sessão e pede novo QR
        if (code === DisconnectReason.loggedOut) {
          console.error('🚪 Logout detectado! Limpando sessão e aguardando QR...');
          isReconnecting = false;
          limparEstado();
          await limparSessaoCompleta();
          setTimeout(conectarWhatsApp, 3000);
          return;
        }

        // Código 440 = outra sessão tomou o controle (stream replace)
        // Aguarda mais tempo para não criar loop de sessões duplicadas
        const delay = code === 440
          ? 10000  // 10s para código 440
          : Math.min(
              CONFIG.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts),
              CONFIG.RECONNECT_MAX_MS
            );

        reconnectAttempts++;
        isReconnecting = false;  // libera lock ANTES do setTimeout
        limparEstado();

        console.log(`🔄 Reconectando em ${delay / 1000}s (#${reconnectAttempts}) — código ${code}...`);
        setTimeout(conectarWhatsApp, delay);
      }
    });

  } catch (err) {
    console.error('❌ Erro ao criar socket:', err.message);
    isReconnecting = false;
    setTimeout(conectarWhatsApp, 10000);
  }
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
// CRON DIÁRIO — REGRA 1
// ─────────────────────────────────────────────────────────────────────────────
function iniciarCronDiario() {
  if (cronInterval) clearInterval(cronInterval);
  cronInterval = setInterval(async () => {
    const agora = new Date();
    if (agora.getHours() !== 8) return;
    if (ehPrimeiroDiaPosUltimoSabadoMesAnterior(agora)) {
      console.log('📅 [CRON] REGRA 1 — abrindo renovação...');
      await dispararAberturaMensalidade(agora);
    }
  }, 60 * 60 * 1000);

  setTimeout(async () => {
    const agora = new Date();
    if (agora.getHours() === 8 && ehPrimeiroDiaPosUltimoSabadoMesAnterior(agora))
      await dispararAberturaMensalidade(agora);
  }, 5000);

  console.log('📅 Cron diário ativo (REGRA 1 às 08h)');
}

function ehPrimeiroDiaPosUltimoSabadoMesAnterior(hoje) {
  const mes = hoje.getMonth(), ano = hoje.getFullYear();
  const ult = new Date(ano, mes, 0);
  while (ult.getDay() !== 6) ult.setDate(ult.getDate() - 1);
  const p = new Date(ult); p.setDate(ult.getDate() + 1);
  return hoje.getFullYear() === p.getFullYear()
      && hoje.getMonth()    === p.getMonth()
      && hoje.getDate()     === p.getDate();
}

function estaNoPeriodoRenovacao(hoje) {
  const mes = hoje.getMonth(), ano = hoje.getFullYear();
  const ult = new Date(ano, mes, 0);
  while (ult.getDay() !== 6) ult.setDate(ult.getDate() - 1);
  const inicio = new Date(ult); inicio.setDate(ult.getDate() + 1); inicio.setHours(0, 0, 0, 0);
  const p1 = new Date(ano, mes, 1);
  while (p1.getDay() !== 6) p1.setDate(p1.getDate() + 1);
  const p2 = new Date(p1); p2.setDate(p1.getDate() + 7);
  const fim = new Date(p2); fim.setDate(p2.getDate() - 1); fim.setHours(23, 59, 59, 999);
  return hoje >= inicio && hoje <= fim;
}

function getMesRefAtual() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
}

async function dispararAberturaMensalidade(hoje) {
  if (!isConnected) return;
  try {
    const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const { data: jogs } = await supabase.from('jogadores')
      .select('id,nome,sobrenome,membro_status,is_gold')
      .eq('status', 'ativo').eq('membro_status', 'mensalista').order('nome');
    const { data: pags } = await supabase.from('pagamentos')
      .select('jogador_id,mes_ref,status').eq('mes_ref', mesRef).eq('status', 'pago');
    const msg = msgAberturaMensalidade(mesRef, jogs || [], pags || []);
    await enviarParaGrupo(msg);
    supabase.from('bot_logs').insert({ evento: 'CRON_REGRA1', tabela: 'pagamentos',
      mensagem: msg.substring(0, 500), enviado_em: new Date().toISOString() }).catch(() => {});
    console.log(`✅ [REGRA1] Abertura enviada — ${mesRef}`);
  } catch (err) { console.error('❌ [REGRA1]:', err.message); }
}

// ─────────────────────────────────────────────────────────────────────────────
// PROCESSADOR DE EVENTOS
// ─────────────────────────────────────────────────────────────────────────────
async function processarEventoWebhook(tipo, tabela, rec, recAntigo) {
  let mensagem = null;

  if (tabela === 'partidas') {
    if (tipo === 'INSERT' && !rec.cancelada) mensagem = msgNovaPartida(rec);
    if (tipo === 'UPDATE') {
      if (!recAntigo?.cancelada && rec.cancelada) mensagem = msgPartidaCancelada(rec);
      if (recAntigo?.cancelada && !rec.cancelada) mensagem = msgPartidaReativada(rec);
    }
  }

  if (tabela === 'presencas' && (tipo === 'INSERT' || tipo === 'UPDATE')) {
    const [jR, pR] = await Promise.all([
      supabase.from('jogadores').select('nome,sobrenome,posicao,membro_status,is_gold').eq('id', rec.jogador_id).maybeSingle(),
      supabase.from('partidas').select('titulo,data,horario,local').eq('id', rec.partida_id).maybeSingle(),
    ]);
    if (jR.data && pR.data) {
      const nome = `${jR.data.nome} ${jR.data.sobrenome}`;
      if (rec.confirmado === true) {
        mensagem = msgConfirmacaoPresenca(nome, pR.data);
        setTimeout(async () => {
          try { const l = await gerarListaCompleta(rec.partida_id); if (l) await enviarParaGrupo(l); } catch {}
        }, 3000);
      } else if (rec.confirmado === false) {
        mensagem = msgRecusaPresenca(nome, pR.data);
        setTimeout(async () => {
          try { const l = await gerarListaCompleta(rec.partida_id); if (l) await enviarParaGrupo(l); } catch {}
        }, 3000);
      }
    }
  }

  if (tabela === 'pagamentos') {
    const ficouPago = rec.status === 'pago' && recAntigo?.status !== 'pago';
    if ((tipo === 'INSERT' && rec.status === 'pago') || (tipo === 'UPDATE' && ficouPago)) {
      const { data: jog } = await supabase.from('jogadores')
        .select('nome,sobrenome,posicao,is_gold').eq('id', rec.jogador_id).maybeSingle();
      if (jog) {
        const { count } = await supabase.from('pagamentos')
          .select('*', { count: 'exact', head: true })
          .eq('mes_ref', rec.mes_ref).eq('status', 'pago');
        mensagem = msgQuitacaoMensalidade(jog, rec.mes_ref, rec.valor, count || 1);
      }
      setTimeout(async () => {
        try {
          const { data: jogs } = await supabase.from('jogadores')
            .select('id,nome,sobrenome,membro_status,is_gold')
            .eq('status', 'ativo').eq('membro_status', 'mensalista').order('nome');
          const { data: pags } = await supabase.from('pagamentos')
            .select('jogador_id,mes_ref,status').eq('mes_ref', rec.mes_ref).eq('status', 'pago');
          await enviarParaGrupo(msgListaMensalidadeAtualizada(rec.mes_ref, jogs || [], pags || []));
        } catch (e) { console.error('❌ Lista mens.:', e.message); }
      }, 3000);
    }
  }

  if (tabela === 'jogadores' && tipo === 'UPDATE') {
    if (recAntigo?.status === 'pendente_aprovacao' && rec.status === 'ativo')
      mensagem = msgNovoJogadorAprovado(rec);
    if (rec.membro_status === 'mensalista' && recAntigo?.membro_status !== 'mensalista'
        && rec.status === 'ativo' && estaNoPeriodoRenovacao(new Date())) {
      setTimeout(async () => {
        try {
          const mesRef = getMesRefAtual();
          const { data: jogs } = await supabase.from('jogadores')
            .select('id,nome,sobrenome,membro_status,is_gold').eq('status', 'ativo').eq('membro_status', 'mensalista').order('nome');
          const { data: pags } = await supabase.from('pagamentos')
            .select('jogador_id,mes_ref,status').eq('mes_ref', mesRef).eq('status', 'pago');
          await enviarParaGrupo(msgListaMensalidadeAtualizada(mesRef, jogs || [], pags || []));
        } catch {}
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
// TEMPLATES DE MENSAGEM
// ─────────────────────────────────────────────────────────────────────────────
function fmt_hora(horario) { return (horario || '').split(' ')[0]; }

function fmt_data_jogo(dataStr, horario) {
  const d = new Date(`${dataStr}T12:00:00`);
  const sem = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const semFmt = sem.charAt(0).toUpperCase() + sem.slice(1);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `${semFmt}, ${data} às ${fmt_hora(horario)}`;
}

function buildListaMensalistas(mesRef, jogs, pags) {
  if (!jogs.length) return '_Nenhum mensalista cadastrado_';
  const pagouIds = new Set((pags || []).map(p => p.jogador_id));
  return jogs.map((j, i) =>
    `${i + 1}. *${j.nome} ${j.sobrenome}*${j.is_gold ? ' 🏅' : ''}${pagouIds.has(j.id) ? ' 💰' : ''}`
  ).join('\n');
}

function msgAberturaMensalidade(mesRef, jogs, pags) {
  const mes = mesRef.split('-').reverse().join('/');
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n🔄 *ABERTURA DE RENOVAÇÃO DE MENSALIDADE* 🔄\n📅 *Referência: ${mes}*\n\nGalera, está aberta a janela de renovação de mensalidade!\nSituação atual dos mensalistas:\n\n${buildListaMensalistas(mesRef, jogs, pags)}\n\n----------------------------------------\n💰 Pague sua mensalidade pelo portal e garanta sua vaga!\n📲 ${CONFIG.PORTAL_URL}`;
}

function msgListaMensalidadeAtualizada(mesRef, jogs, pags) {
  const mes = mesRef.split('-').reverse().join('/');
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n💰 *MENSALIDADE ATUALIZADA — ${mes}* 💰\n\nSituação atual:\n\n${buildListaMensalistas(mesRef, jogs, pags)}\n\n📊 *${(pags||[]).length} de ${jogs.length} mensalistas quitados*\n----------------------------------------\n📲 ${CONFIG.PORTAL_URL}`;
}

function msgNovaPartida(p) {
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n🏆 *NOVO JOGO AGENDADO!* 🏆\n\n📋 *${p.titulo}*\n🗓️ Data: *${fmt_data_jogo(p.data, p.horario)}*\n📍 Local: *${p.local}*\n\n⏰ Janela de confirmação: Terça 00:00 → Sexta 23:59\n\n📲 ${CONFIG.PORTAL_URL}`;
}

function msgPartidaCancelada(p) {
  const d = new Date(`${p.data}T12:00:00`);
  const df = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n❌ *JOGO CANCELADO!* ❌\n\n📋 *${p.titulo}*\n🗓️ Data: *${df.charAt(0).toUpperCase() + df.slice(1)} às ${fmt_hora(p.horario)}*\n📍 Local: *${p.local}*\n\n📲 Acesse nosso portal:\n${CONFIG.PORTAL_URL}`;
}

function msgPartidaReativada(p) {
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n🟢 *JOGO REATIVADO!* 🟢\n\nA partida *${p.titulo}* foi reativada!\n🗓️ Data: *${fmt_data_jogo(p.data, p.horario)}*\n📍 *${p.local}*\n\n📲 ${CONFIG.PORTAL_URL}`;
}

function msgConfirmacaoPresenca(nome, p) {
  return `⚽ *CONFIRMAÇÃO DE PELADA - FC* ⚽\n\nFala galera! O atleta *${nome}* confirmou presença!\n\n🏆 *${p.titulo}*\n📅 Data: *${fmt_data_jogo(p.data, p.horario)}*\n📍 Local: *${p.local}*\n\n_Bora tirar aquela onda!_ 💪🏃‍♂️💨`;
}

function msgRecusaPresenca(nome, p) {
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n\nO atleta *${nome}* registrou *ausência*:\n\n🏆 *${p.titulo}*\n📅 *${fmt_data_jogo(p.data, p.horario)}*\n\n_Lista atualizada no portal._ 📲\n${CONFIG.PORTAL_URL}`;
}

function msgQuitacaoMensalidade(jog, mesRef, valor, total) {
  const mes = mesRef.split('-').reverse().join('/');
  return `💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA* 💰\n\nAtleta: *${jog.nome} ${jog.sobrenome}* (${jog.posicao})${jog.is_gold ? ' 🏅' : ''}\nReferência: *${mes}*\nValor: *R$ ${Number(valor).toFixed(2)}*\nStatus: *PAGO ✅*\n\n📊 Total quitados: *${total}* (limite: 25)\n\nObrigado pelo compromisso! 🤝⚽`;
}

function msgNovoJogadorAprovado(j) {
  return `⚽ *PELADA BATISTA SÁBADO* ⚽\n🎉 *NOVO ATLETA APROVADO!* 🎉\n\nBem-vindo, *${j.nome} ${j.sobrenome}*!\n📋 Posição: *${j.posicao}*\n👤 Categoria: *${j.membro_status}*\n\n_Bora pro jogo!_ ⚽\n📲 ${CONFIG.PORTAL_URL}`;
}

async function gerarListaCompleta(partidaId) {
  try {
    const [pR, prR, jR] = await Promise.all([
      supabase.from('partidas').select('*').eq('id', partidaId).single(),
      supabase.from('presencas').select('jogador_id,confirmado').eq('partida_id', partidaId),
      supabase.from('jogadores').select('id,nome,sobrenome,posicao,membro_status,is_gold').eq('status', 'ativo'),
    ]);
    if (pR.error || !pR.data) return null;

    const partida = pR.data;
    const byId = Object.fromEntries((jR.data || []).map(j => [j.id, j]));
    const rawConf = (prR.data || []).filter(p => p.confirmado === true).map(p => byId[p.jogador_id]).filter(Boolean);
    const recus   = (prR.data || []).filter(p => p.confirmado === false).map(p => byId[p.jogador_id]).filter(Boolean);

    const conf = [], wait = [];
    for (const j of rawConf) {
      if (j.posicao === 'Goleiro') { conf.push(j); continue; }
      const lc = conf.filter(x => x.posicao !== 'Goleiro').length;
      if (lc < 25) { conf.push(j); continue; }
      if (j.membro_status === 'mensalista') {
        const idx = [...conf].reverse().findIndex(x => x.posicao !== 'Goleiro' && x.membro_status === 'diarista');
        if (idx !== -1) { const ri = conf.length - 1 - idx; const [s] = conf.splice(ri, 1); conf.push(j); wait.unshift(s); }
        else wait.push(j);
      } else wait.push(j);
    }

    const mens = conf.filter(j => j.posicao !== 'Goleiro' && j.membro_status === 'mensalista');
    const diar = conf.filter(j => j.posicao !== 'Goleiro' && j.membro_status !== 'mensalista');
    const gols = conf.filter(j => j.posicao === 'Goleiro');
    const f  = (j, i) => `${i+1}. *${j.nome} ${j.sobrenome}* - ${j.posicao}${j.is_gold ? ' 🏅' : ''}`;
    const fG = (j, i) => `${i+1}. *${j.nome} ${j.sobrenome}*${j.is_gold ? ' 🏅' : ''}`;

    const d = new Date(`${partida.data}T12:00:00`);
    const sem = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const semFmt = sem.charAt(0).toUpperCase() + sem.slice(1);
    const diaNum = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

    return (
      `⚽ *PELADA BATISTA SÁBADO* ⚽\n🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆\n\n` +
      `📅 Jogo: *${partida.titulo}*\n` +
      `🗓️ Data: *${semFmt}, ${diaNum}* às *${fmt_hora(partida.horario)}*\n` +
      `📍 Local: *${partida.local}*\n\n` +
      `*A - MENSALISTAS:*\n${mens.length ? mens.map(f).join('\n') : '_Nenhum mensalista confirmado ainda_'}\n\n` +
      `*B - DIARISTAS:*\n${diar.length ? diar.map(f).join('\n') : '_Nenhum diarista confirmado ainda_'}\n\n` +
      `*C - GOLEIROS:*\n${gols.length ? gols.map(fG).join('\n') : '_Nenhum goleiro confirmado ainda_'}\n\n` +
      `*D - JOGADORES AUSENTES:*\n${recus.length ? recus.map(f).join('\n') : '_Nenhuma ausência registrada_'}\n\n` +
      `*E - LISTA DE ESPERA:*\n${wait.length ? wait.map(f).join('\n') : '_Nenhum jogador em lista de espera_'}\n\n` +
      `----------------------------------------\n📲 Acesse o portal para confirmar sua presença:\nhttps://peladabatista.onrender.com`
    );
  } catch (err) { console.error('❌ gerarListaCompleta:', err.message); return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// JID + ENVIO
// ─────────────────────────────────────────────────────────────────────────────
async function resolverJID(grupoId) {
  if (!grupoId) throw new Error('grupo_id vazio');
  if (jidCache.has(grupoId)) return jidCache.get(grupoId);
  let jid;
  if (grupoId.includes('chat.whatsapp.com/')) {
    const cod = grupoId.split('chat.whatsapp.com/').pop().split('?')[0].trim();
    try { const m = await sock.groupGetInviteInfo(cod); jid = m.id; } catch (e) { throw new Error(`Link inválido: ${e.message}`); }
  } else if (grupoId.includes('@g.us')) {
    jid = grupoId;
  } else {
    jid = `${grupoId.replace(/\D/g, '')}@g.us`;
  }
  jidCache.set(grupoId, jid);
  console.log(`✅ JID: ${grupoId} → ${jid}`);
  return jid;
}

async function enviarParaGrupo(texto) {
  if (!sock || !isConnected) throw new Error('WhatsApp não conectado');
  if (!CONFIG.DEFAULT_GROUP_ID) throw new Error('WHATSAPP_GROUP_ID não configurado');
  const jid = await resolverJID(CONFIG.DEFAULT_GROUP_ID);
  await sock.sendMessage(jid, { text: texto });
  console.log(`📤 → ${jid} | ${texto.substring(0, 50).replace(/\n/g, ' ')}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
async function iniciar() {
  console.log('🚀 Robô Pelada Batista v2.3 — iniciando...');
  console.log(`📡 URL: ${CONFIG.SELF_URL}`);
  console.log(`🔐 Secret: ${CONFIG.WEBHOOK_SECRET ? '✅' : '❌ NÃO configurado!'}`);
  console.log(`👥 Grupo: ${CONFIG.DEFAULT_GROUP_ID || '⚠️  não configurado'}`);
  console.log('📋 Regras: REGRA1(cron+webhook) | REGRA2(webhook) | REGRA3(webhook)');

  app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Servidor na porta ${CONFIG.PORT}`);
    console.log(`📱 QR Code em: ${CONFIG.SELF_URL}/qr`);
  });

  await baixarSessao();
  await conectarWhatsApp();
}

iniciar().catch(err => { console.error('💥 Erro fatal:', err); process.exit(1); });
