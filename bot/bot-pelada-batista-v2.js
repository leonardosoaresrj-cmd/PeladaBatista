/**
 * ⚽ ROBÔ PELADA BATISTA — WhatsApp Bot v2.2
 *
 * CORREÇÕES v2.2 (baseadas na análise do log do Render):
 * ─────────────────────────────────────────────────────────────
 * FIX 1 — ENOENT pre-key-X.json
 *   salvarSessao() agora verifica existência individual de cada arquivo
 *   antes de tentar ler, evitando crash quando Baileys deleta arquivos
 *   durante rotação de chaves (pre-key bundle exchange).
 *
 * FIX 2 — Race condition no upload de 100 arquivos
 *   Upload agora é sequencial com try/catch por arquivo.
 *   Arquivo inexistente no momento do upload é ignorado silenciosamente.
 *
 * FIX 3 — Sessão salva como JSON consolidado no Supabase
 *   Em vez de 100 arquivos separados (pre-key-1.json, pre-key-2.json...),
 *   a sessão é comprimida em um único objeto JSON salvo em uma tabela
 *   do Supabase (bot_session). Eliminando o problema de paginação e
 *   race condition do Storage.
 *
 * FIX 4 — Debounce no salvarSessao
 *   Múltiplos eventos creds.update simultâneos são agrupados em um único
 *   save após 2 segundos, evitando 10+ uploads paralelos ao mesmo tempo.
 *
 * REGRAS (mantidas da v2.1):
 * ─────────────────────────────────────────────────────────────
 * REGRA 1 — Renovação: cron às 08h + webhook pagamentos
 * REGRA 2 — Presenças: lista A/B/C/D/E a cada confirmação
 * REGRA 3 — Cancelamento: formato exato com data dd/MM/YYYY
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
  SAVE_DEBOUNCE_MS:   2000,   // agrupa múltiplos saves em 1 após 2s
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
let saveDebounceTimer = null;   // debounce do salvarSessao

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

// ── GET / ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    app:                  '⚽ Robô Pelada Batista v2.2',
    status:               isConnected ? '✅ Conectado' : '⏳ Aguardando QR',
    qr_disponivel:        !isConnected && !!currentQR,
    tentativas_reconexao: reconnectAttempts,
    uptime_segundos:      Math.floor(process.uptime()),
    grupo_padrao:         CONFIG.DEFAULT_GROUP_ID ? '✅ configurado' : '⚠️ não configurado',
    regras:               'REGRA1(cron+webhook) | REGRA2(webhook) | REGRA3(webhook)',
  });
});

// ── GET /qr ───────────────────────────────────────────────────────────────────
app.get('/qr', async (req, res) => {
  if (isConnected) {
    return res.send(`
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body{font-family:sans-serif;text-align:center;padding:40px;background:#e8f5e9;margin:0}
          .card{display:inline-block;background:white;border-radius:16px;padding:32px;
                box-shadow:0 4px 24px rgba(0,0,0,.1);min-width:320px}
          h1{color:#2e7d32;margin-bottom:8px}
          p{color:#555;font-size:14px;margin-bottom:20px}
          .btn{display:inline-block;background:#25D366;color:white;text-decoration:none;
               padding:12px 28px;border-radius:100px;font-weight:700;font-size:14px;
               margin:6px;transition:opacity .2s}
          .btn:hover{opacity:.85}
          .btn-outline{background:transparent;border:2px solid #25D366;color:#1a7a40}
        </style>
      </head>
      <body>
        <div class="card">
          <div style="font-size:48px;margin-bottom:12px">✅</div>
          <h1>WhatsApp Conectado!</h1>
          <p>Robô Pelada Batista v2.2 — 3 regras ativas.</p>
          <a href="/grupos" class="btn">📋 Ver grupos do WhatsApp</a><br>
          <a href="/" class="btn btn-outline" style="font-size:12px;padding:8px 20px">Ver status JSON</a>
        </div>
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
      <h1>⚽ Pelada Batista — Robô v2.2</h1>
      <p>Escaneie o QR Code com seu WhatsApp:</p>
      <img src="${qrImg}" alt="QR Code"/>
      <ol>
        <li>Abra o WhatsApp no celular</li>
        <li>3 pontinhos → <strong>Aparelhos conectados</strong></li>
        <li><strong>Conectar um aparelho</strong></li>
        <li>Aponte a câmera para o QR acima</li>
      </ol>
      <p style="color:#888;font-size:12px">Recarrega em 30s · QR expira em ~60s</p>
    </div></body></html>`);
});


// ── GET /grupos — lista todos os grupos do número conectado ──────────────────
app.get('/grupos', async (req, res) => {
  if (!isConnected || !sock) {
    return res.send(`
      <html><head><meta charset="UTF-8"><meta http-equiv="refresh" content="5"></head>
      <body style="font-family:sans-serif;text-align:center;padding:40px;background:#fff8e1">
        <h1>⏳ WhatsApp não conectado</h1>
        <p>Conecte primeiro em <a href="/qr">/qr</a>. Recarregando em 5s...</p>
      </body></html>`);
  }

  try {
    // Busca todos os grupos que o número participa
    const grupos = await sock.groupFetchAllParticipating();
    const lista = Object.values(grupos)
      .sort((a, b) => (a.subject || '').localeCompare(b.subject || ''))
      .map(g => ({
        id:          g.id,
        nome:        g.subject || '(sem nome)',
        participantes: g.size || (g.participants || []).length || '?',
        criado:      g.creation ? new Date(g.creation * 1000).toLocaleDateString('pt-BR') : '?',
      }));

    const linhas = lista.map((g, i) => `
      <tr style="background:${i % 2 === 0 ? '#f9fffe' : 'white'}">
        <td style="padding:12px 16px;font-weight:600;color:#1a1a1a">${g.nome}</td>
        <td style="padding:12px 16px">
          <code style="background:#e8f5e9;padding:4px 10px;border-radius:6px;
                       font-size:12px;color:#1a7a40;user-select:all">${g.id}</code>
          <button onclick="navigator.clipboard.writeText('${g.id}');this.textContent='✅ Copiado!';setTimeout(()=>this.textContent='📋 Copiar',2000)"
            style="margin-left:8px;padding:4px 10px;border:1px solid #25D366;background:white;
                   color:#1a7a40;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">
            📋 Copiar
          </button>
        </td>
        <td style="padding:12px 16px;text-align:center;color:#555">${g.participantes}</td>
        <td style="padding:12px 16px;text-align:center;color:#888;font-size:12px">${g.criado}</td>
      </tr>`).join('');

    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Grupos WhatsApp — Pelada Batista Bot</title>
        <style>
          *{box-sizing:border-box;margin:0;padding:0}
          body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
               background:#f0fdf4;color:#1a1a1a;padding:32px 16px}
          .container{max-width:900px;margin:0 auto}
          .header{background:white;border-radius:16px;padding:28px 32px;
                  box-shadow:0 2px 16px rgba(0,0,0,.07);margin-bottom:20px;
                  display:flex;align-items:center;justify-content:space-between;flex-wrap:gap}
          .header-left h1{font-size:22px;color:#1a7a40;margin-bottom:4px}
          .header-left p{font-size:13px;color:#666}
          .badge{background:#25D366;color:white;padding:6px 16px;border-radius:100px;
                 font-size:12px;font-weight:700}
          table{width:100%;border-collapse:collapse;background:white;border-radius:12px;
                overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.07)}
          thead{background:#1a7a40;color:white}
          th{padding:14px 16px;text-align:left;font-size:12px;letter-spacing:.5px;text-transform:uppercase}
          th:nth-child(3),th:nth-child(4){text-align:center}
          td{border-bottom:1px solid #f0f0f0;font-size:14px;vertical-align:middle}
          tr:last-child td{border-bottom:none}
          .footer{margin-top:20px;text-align:center}
          .back{display:inline-block;padding:10px 24px;border-radius:100px;
                background:#1a7a40;color:white;text-decoration:none;font-weight:600;font-size:13px}
          .hint{background:#fffbeb;border:1px solid #fbbf24;border-radius:10px;
                padding:12px 16px;margin-bottom:16px;font-size:13px;color:#92400e}
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="header-left">
              <h1>📋 Grupos do WhatsApp</h1>
              <p>${lista.length} grupo(s) encontrado(s) para este número</p>
            </div>
            <span class="badge">✅ Conectado</span>
          </div>

          <div class="hint">
            💡 <strong>Como usar:</strong> copie o ID do grupo desejado e cole no campo
            <strong>"Link ou ID do Grupo"</strong> nas Configurações do portal
            (<em>peladabatista.onrender.com</em> → ⚙️ → Automação WhatsApp).
          </div>

          <table>
            <thead>
              <tr>
                <th>Nome do Grupo</th>
                <th>ID do Grupo</th>
                <th>Membros</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>${linhas || '<tr><td colspan="4" style="padding:32px;text-align:center;color:#888">Nenhum grupo encontrado</td></tr>'}</tbody>
          </table>

          <div class="footer">
            <a href="/qr" class="back">← Voltar</a>
          </div>
        </div>
      </body></html>`);
  } catch (err) {
    console.error('❌ /grupos:', err.message);
    res.status(500).send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#c00">Erro ao listar grupos</h2>
        <p>${err.message}</p>
        <p><a href="/qr">← Voltar</a></p>
      </body></html>`);
  }
});

// ── POST /teste ───────────────────────────────────────────────────────────────
app.post('/teste', async (req, res) => {
  if (req.headers['x-webhook-secret'] !== CONFIG.WEBHOOK_SECRET) {
    console.warn('⚠️  /teste: secret inválido');
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isConnected) {
    return res.status(503).json({
      error: 'WhatsApp não conectado.',
      qr_url: `${CONFIG.SELF_URL}/qr`
    });
  }
  const { mensagem, grupo_id } = req.body;
  if (!mensagem) return res.status(400).json({ error: '"mensagem" obrigatório' });

  const grupoAlvo = grupo_id || CONFIG.DEFAULT_GROUP_ID;
  if (!grupoAlvo) return res.status(400).json({ error: 'grupo_id não informado' });

  try {
    const jid = await resolverJID(grupoAlvo);
    await sock.sendMessage(jid, { text: mensagem });
    console.log(`📤 [/teste] → ${jid} | ${mensagem.substring(0, 60).replace(/\n/g, ' ')}`);
    await supabase.from('bot_logs').insert({
      evento: 'DIRETO', tabela: 'frontend',
      mensagem: mensagem.substring(0, 500), enviado_em: new Date().toISOString(),
    });
    res.json({ success: true, jid });
  } catch (err) {
    console.error('❌ /teste:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /webhook ─────────────────────────────────────────────────────────────
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
    console.error('❌ webhook:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SESSÃO — Estratégia híbrida:
//   1ª tentativa: tabela bot_session no Supabase (JSON consolidado, sem ENOENT)
//   2ª tentativa: Supabase Storage (compatibilidade com sessões existentes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * FIX 1+2+3: salvarSessao com debounce + verificação de existência por arquivo
 * Agrupa múltiplos eventos creds.update em um único save após SAVE_DEBOUNCE_MS.
 */
function agendarSalvarSessao() {
  if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(async () => {
    await salvarSessao();
  }, CONFIG.SAVE_DEBOUNCE_MS);
}

async function salvarSessao() {
  if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH)) return;

  try {
    const arquivos = fs.readdirSync(CONFIG.SESSION_LOCAL_PATH);
    if (!arquivos.length) return;

    // Serializa todos os arquivos existentes em um único objeto JSON
    const sessaoObj = {};
    for (const nome of arquivos) {
      const caminho = path.join(CONFIG.SESSION_LOCAL_PATH, nome);
      // FIX ENOENT: verifica se ainda existe no momento da leitura
      if (!fs.existsSync(caminho)) continue;
      try {
        const conteudo = fs.readFileSync(caminho, 'utf8');
        sessaoObj[nome] = conteudo;
      } catch {
        // arquivo pode ter sido deletado pelo Baileys entre o readdirSync e o readFileSync
        continue;
      }
    }

    if (!Object.keys(sessaoObj).length) return;

    const payload = JSON.stringify(sessaoObj);

    // Salva como registro na tabela bot_session (sem race condition de arquivos)
    const { error } = await supabase.from('bot_session').upsert({
      id: 'main',
      session_data: payload,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });

    if (error) {
      // Fallback: tenta salvar no Storage arquivo por arquivo
      await salvarSessaoStorage(sessaoObj);
    } else {
      console.log(`💾 Sessão salva (${Object.keys(sessaoObj).length} arquivos → tabela bot_session)`);
    }
  } catch (err) {
    console.error('❌ Erro ao salvar sessão:', err.message);
  }
}

async function salvarSessaoStorage(sessaoObj) {
  let salvos = 0;
  for (const [nome, conteudo] of Object.entries(sessaoObj)) {
    try {
      const buf = Buffer.from(conteudo, 'utf8');
      await supabase.storage.from(CONFIG.SUPABASE_BUCKET)
        .upload(`session/${nome}`, buf, { upsert: true });
      salvos++;
    } catch {
      // ignora arquivos que falharam individualmente
    }
  }
  if (salvos > 0) console.log(`💾 Sessão salva no Storage (${salvos} arquivos)`);
}

async function baixarSessao() {
  console.log('📥 Restaurando sessão...');

  // Tentativa 1: tabela bot_session (JSON consolidado)
  try {
    const { data, error } = await supabase
      .from('bot_session')
      .select('session_data')
      .eq('id', 'main')
      .maybeSingle();

    if (!error && data?.session_data) {
      const sessaoObj = JSON.parse(data.session_data);
      const nomes = Object.keys(sessaoObj);

      if (nomes.length > 0) {
        if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
          fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });

        for (const [nome, conteudo] of Object.entries(sessaoObj)) {
          fs.writeFileSync(path.join(CONFIG.SESSION_LOCAL_PATH, nome), conteudo, 'utf8');
        }
        console.log(`✅ Sessão restaurada da tabela bot_session (${nomes.length} arquivos)`);
        return true;
      }
    }
  } catch (err) {
    console.warn('⚠️  bot_session não disponível, tentando Storage...', err.message);
  }

  // Tentativa 2: Supabase Storage (sessões antigas com 100 arquivos)
  try {
    // O storage pode paginar — busca até 200 arquivos
    const { data: arquivos } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET)
      .list('session/', { limit: 200 });

    if (!arquivos?.length) {
      console.log('ℹ️  Sem sessão salva — escaneie o QR Code em /qr');
      return false;
    }

    if (!fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
      fs.mkdirSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true });

    let restaurados = 0;
    for (const arq of arquivos) {
      try {
        const { data } = await supabase.storage
          .from(CONFIG.SUPABASE_BUCKET)
          .download(`session/${arq.name}`);
        if (data) {
          fs.writeFileSync(
            path.join(CONFIG.SESSION_LOCAL_PATH, arq.name),
            Buffer.from(await data.arrayBuffer())
          );
          restaurados++;
        }
      } catch { continue; }
    }

    if (restaurados > 0) {
      console.log(`✅ Sessão restaurada do Storage (${restaurados} arquivos)`);
      // Migra para a tabela bot_session para próximas reinicializações
      await salvarSessao();
      return true;
    }
  } catch (err) {
    console.error('❌ Erro ao restaurar sessão do Storage:', err.message);
  }

  return false;
}

async function limparSessao() {
  if (fs.existsSync(CONFIG.SESSION_LOCAL_PATH))
    fs.rmSync(CONFIG.SESSION_LOCAL_PATH, { recursive: true, force: true });
  jidCache.clear();

  // Limpa tabela bot_session
  try {
    await supabase.from('bot_session').delete().eq('id', 'main');
  } catch {}

  // Limpa Storage
  try {
    const { data: arqs } = await supabase.storage
      .from(CONFIG.SUPABASE_BUCKET).list('session/', { limit: 200 });
    if (arqs?.length)
      await supabase.storage.from(CONFIG.SUPABASE_BUCKET)
        .remove(arqs.map(f => `session/${f.name}`));
  } catch {}

  console.log('🗑️  Sessão limpa');
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
      console.log('📅 [CRON] REGRA 1 — disparando abertura de renovação...');
      await dispararAberturaMensalidade(agora);
    }
  }, 60 * 60 * 1000);

  // Verifica imediatamente no boot
  setTimeout(async () => {
    const agora = new Date();
    if (agora.getHours() === 8 && ehPrimeiroDiaPosUltimoSabadoMesAnterior(agora)) {
      console.log('📅 [CRON BOOT] REGRA 1 — disparando no boot...');
      await dispararAberturaMensalidade(agora);
    }
  }, 5000);

  console.log('📅 Cron diário ativo (verifica abertura de renovação às 08h)');
}

function ehPrimeiroDiaPosUltimoSabadoMesAnterior(hoje) {
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const ultimoDiaMesAnt = new Date(ano, mes, 0);
  const ultimoSabAnt = new Date(ultimoDiaMesAnt);
  while (ultimoSabAnt.getDay() !== 6) ultimoSabAnt.setDate(ultimoSabAnt.getDate() - 1);
  const primeiroDia = new Date(ultimoSabAnt);
  primeiroDia.setDate(ultimoSabAnt.getDate() + 1);
  return (
    hoje.getFullYear() === primeiroDia.getFullYear() &&
    hoje.getMonth()    === primeiroDia.getMonth()    &&
    hoje.getDate()     === primeiroDia.getDate()
  );
}

function estaNoPeriodoRenovacao(hoje) {
  const mes = hoje.getMonth();
  const ano = hoje.getFullYear();
  const ultimoDiaMesAnt = new Date(ano, mes, 0);
  const ultimoSabAnt = new Date(ultimoDiaMesAnt);
  while (ultimoSabAnt.getDay() !== 6) ultimoSabAnt.setDate(ultimoSabAnt.getDate() - 1);
  const inicio = new Date(ultimoSabAnt);
  inicio.setDate(ultimoSabAnt.getDate() + 1);
  inicio.setHours(0, 0, 0, 0);
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

function getMesRefAtual() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
}

async function dispararAberturaMensalidade(hoje) {
  try {
    if (!isConnected) { console.warn('⚠️  [REGRA1] WA não conectado'); return; }
    const mesRef = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    const { data: jogadores } = await supabase
      .from('jogadores').select('id,nome,sobrenome,membro_status,is_gold')
      .eq('status', 'ativo').eq('membro_status', 'mensalista').order('nome');
    const { data: pagamentos } = await supabase
      .from('pagamentos').select('jogador_id,mes_ref,status')
      .eq('mes_ref', mesRef).eq('status', 'pago');
    const mensagem = msgAberturaMensalidade(mesRef, jogadores || [], pagamentos || []);
    await enviarParaGrupo(mensagem);
    await supabase.from('bot_logs').insert({
      evento: 'CRON_REGRA1', tabela: 'pagamentos',
      mensagem: mensagem.substring(0, 500), enviado_em: new Date().toISOString(),
    });
    console.log(`✅ [REGRA1] Abertura de renovação enviada para ${mesRef}`);
  } catch (err) {
    console.error('❌ [REGRA1]:', err.message);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// WEBHOOK — processador de eventos
// ─────────────────────────────────────────────────────────────────────────────
async function processarEventoWebhook(tipo, tabela, rec, recAntigo) {
  let mensagem = null;

  // REGRA 3 — partidas
  if (tabela === 'partidas') {
    if (tipo === 'INSERT' && !rec.cancelada) mensagem = msgNovaPartida(rec);
    if (tipo === 'UPDATE') {
      if (!recAntigo?.cancelada && rec.cancelada) mensagem = msgPartidaCancelada(rec);
      if (recAntigo?.cancelada && !rec.cancelada) mensagem = msgPartidaReativada(rec);
    }
  }

  // REGRA 2 — presenças
  if (tabela === 'presencas' && (tipo === 'INSERT' || tipo === 'UPDATE')) {
    const [jogRes, parRes] = await Promise.all([
      supabase.from('jogadores').select('nome,sobrenome,posicao,membro_status,is_gold').eq('id', rec.jogador_id).maybeSingle(),
      supabase.from('partidas').select('titulo,data,horario,local').eq('id', rec.partida_id).maybeSingle(),
    ]);
    if (jogRes.data && parRes.data) {
      const nome = `${jogRes.data.nome} ${jogRes.data.sobrenome}`;
      if (rec.confirmado === true) {
        mensagem = msgConfirmacaoPresenca(nome, parRes.data);
        setTimeout(async () => {
          try { const l = await gerarListaCompletaPartida(rec.partida_id); if (l) await enviarParaGrupo(l); } catch {}
        }, 3000);
      } else if (rec.confirmado === false) {
        mensagem = msgRecusaPresenca(nome, parRes.data);
        setTimeout(async () => {
          try { const l = await gerarListaCompletaPartida(rec.partida_id); if (l) await enviarParaGrupo(l); } catch {}
        }, 3000);
      }
    }
  }

  // REGRA 1 — pagamento quitado → mensagem individual + lista atualizada
  if (tabela === 'pagamentos') {
    const ficouPago = rec.status === 'pago' && recAntigo?.status !== 'pago';
    if ((tipo === 'INSERT' && rec.status === 'pago') || (tipo === 'UPDATE' && ficouPago)) {
      const { data: jog } = await supabase
        .from('jogadores').select('nome,sobrenome,posicao,is_gold,membro_status').eq('id', rec.jogador_id).maybeSingle();
      if (jog) {
        const { count } = await supabase.from('pagamentos')
          .select('*', { count: 'exact', head: true })
          .eq('mes_ref', rec.mes_ref).eq('status', 'pago');
        mensagem = msgQuitacaoMensalidade(jog, rec.mes_ref, rec.valor, count || 1);
      }
      setTimeout(async () => {
        try {
          const { data: jogs } = await supabase.from('jogadores')
            .select('id,nome,sobrenome,membro_status,is_gold').eq('status', 'ativo').eq('membro_status', 'mensalista').order('nome');
          const { data: pags } = await supabase.from('pagamentos')
            .select('jogador_id,mes_ref,status').eq('mes_ref', rec.mes_ref).eq('status', 'pago');
          const lista = msgListaMensalidadeAtualizada(rec.mes_ref, jogs || [], pags || []);
          await enviarParaGrupo(lista);
        } catch (e) { console.error('❌ Lista mensalidade:', e.message); }
      }, 3000);
    }
  }

  // Novo jogador aprovado ou promovido a mensalista
  if (tabela === 'jogadores' && tipo === 'UPDATE') {
    if (recAntigo?.status === 'pendente_aprovacao' && rec.status === 'ativo')
      mensagem = msgNovoJogadorAprovado(rec);

    if (rec.membro_status === 'mensalista' && recAntigo?.membro_status !== 'mensalista' && rec.status === 'ativo') {
      if (estaNoPeriodoRenovacao(new Date())) {
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
  }

  if (mensagem) {
    await enviarParaGrupo(mensagem);
    await supabase.from('bot_logs').insert({
      evento: tipo, tabela, mensagem: mensagem.substring(0, 500),
      enviado_em: new Date().toISOString(),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES DE MENSAGEM
// ─────────────────────────────────────────────────────────────────────────────

function formatarDataJogo(dataStr, horario) {
  const d = new Date(`${dataStr}T12:00:00`);
  const sem = d.toLocaleDateString('pt-BR', { weekday: 'long' });
  const semFmt = sem.charAt(0).toUpperCase() + sem.slice(1);
  const data = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const hor = (horario || '').split(' ')[0];
  return `${semFmt}, ${data} às ${hor}`;
}

function buildListaMensalistas(mesRef, jogadores, pagamentos) {
  if (!jogadores.length) return '_Nenhum mensalista cadastrado_';
  const pagouIds = new Set((pagamentos || []).map(p => p.jogador_id));
  return jogadores.map((j, i) =>
    `${i + 1}. *${j.nome} ${j.sobrenome}*${j.is_gold ? ' 🏅' : ''}${pagouIds.has(j.id) ? ' 💰' : ''}`
  ).join('\n');
}

function msgAberturaMensalidade(mesRef, jogadores, pagamentos) {
  const mesFormatado = mesRef.split('-').reverse().join('/');
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🔄 *ABERTURA DE RENOVAÇÃO DE MENSALIDADE* 🔄\n` +
    `📅 *Referência: ${mesFormatado}*\n\n` +
    `Galera, está aberta a janela de renovação de mensalidade!\n` +
    `Situação atual dos mensalistas:\n\n` +
    `${buildListaMensalistas(mesRef, jogadores, pagamentos)}\n\n` +
    `----------------------------------------\n` +
    `💰 Pague sua mensalidade pelo portal e garanta sua vaga!\n` +
    `📲 ${CONFIG.PORTAL_URL}`
  );
}

function msgListaMensalidadeAtualizada(mesRef, jogadores, pagamentos) {
  const mesFormatado = mesRef.split('-').reverse().join('/');
  const totalPago = (pagamentos || []).length;
  const total = jogadores.length;
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `💰 *MENSALIDADE ATUALIZADA — ${mesFormatado}* 💰\n\n` +
    `Situação atual dos mensalistas:\n\n` +
    `${buildListaMensalistas(mesRef, jogadores, pagamentos)}\n\n` +
    `📊 *${totalPago} de ${total} mensalistas quitados*\n` +
    `----------------------------------------\n` +
    `📲 Acesse o portal para quitar sua mensalidade:\n${CONFIG.PORTAL_URL}`
  );
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
    `📲 Confirme sua presença:\n${CONFIG.PORTAL_URL}`
  );
}

function msgPartidaCancelada(p) {
  const d = new Date(`${p.data}T12:00:00`);
  const dataFmt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const dataFmtCap = dataFmt.charAt(0).toUpperCase() + dataFmt.slice(1);
  const hor = (p.horario || '').split(' ')[0];
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `❌ *JOGO CANCELADO!* ❌\n\n` +
    `📋 *${p.titulo}*\n` +
    `🗓️ Data: *${dataFmtCap} às ${hor}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `📲 Acesse nosso portal:\n${CONFIG.PORTAL_URL}`
  );
}

function msgPartidaReativada(p) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🟢 *JOGO REATIVADO!* 🟢\n\n` +
    `A partida *${p.titulo}* foi reativada e acontecerá normalmente!\n` +
    `🗓️ Data: *${formatarDataJogo(p.data, p.horario)}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `📲 Confirme sua presença:\n${CONFIG.PORTAL_URL}`
  );
}

function msgConfirmacaoPresenca(nome, p) {
  return (
    `⚽ *CONFIRMAÇÃO DE PELADA - FC* ⚽\n\n` +
    `Fala galera! O atleta *${nome}* confirmou presença para a partida:\n\n` +
    `🏆 *${p.titulo}*\n` +
    `📅 Data: *${formatarDataJogo(p.data, p.horario)}*\n` +
    `📍 Local: *${p.local}*\n\n` +
    `_Bora pro jogo tirar aquela onda!_ 💪🏃‍♂️💨`
  );
}

function msgRecusaPresenca(nome, p) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n\n` +
    `Informamos que o atleta *${nome}* registrou *ausência* na partida:\n\n` +
    `🏆 *${p.titulo}*\n` +
    `📅 Data: *${formatarDataJogo(p.data, p.horario)}*\n\n` +
    `_Lista de presença atualizada no portal._ 📲\n${CONFIG.PORTAL_URL}`
  );
}

function msgQuitacaoMensalidade(jog, mesRef, valor, totalQuitados) {
  const medalha = jog.is_gold ? ' 🏅' : '';
  const mesFormatado = mesRef.split('-').reverse().join('/');
  return (
    `💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA SÁBADO* 💰\n\n` +
    `Atleta: *${jog.nome} ${jog.sobrenome}* (${jog.posicao})${medalha}\n` +
    `Referência: *${mesFormatado}*\n` +
    `Valor Quitado: *R$ ${Number(valor).toFixed(2)}*\n` +
    `Status: *PAGO & CONFIRMADO* ✅\n\n` +
    `📊 *Informativo Financeiro:*\n` +
    `- Total de mensalistas quitados: *${totalQuitados}* (Limite: 25 mensalistas)\n\n` +
    `Muito obrigado pelo compromisso em manter o futebol rodando! 🤝⚽`
  );
}

function msgNovoJogadorAprovado(j) {
  return (
    `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
    `🎉 *NOVO ATLETA APROVADO!* 🎉\n\n` +
    `Bem-vindo ao elenco, *${j.nome} ${j.sobrenome}*!\n` +
    `📋 Posição: *${j.posicao}*\n` +
    `👤 Categoria: *${j.membro_status}*\n\n` +
    `_Boas-vindas e bora pro jogo!_ ⚽🏃‍♂️💨\n\n` +
    `📲 ${CONFIG.PORTAL_URL}`
  );
}

async function gerarListaCompletaPartida(partidaId) {
  try {
    const [pRes, prRes, jRes] = await Promise.all([
      supabase.from('partidas').select('*').eq('id', partidaId).single(),
      supabase.from('presencas').select('jogador_id,confirmado').eq('partida_id', partidaId),
      supabase.from('jogadores').select('id,nome,sobrenome,posicao,membro_status,is_gold').eq('status', 'ativo'),
    ]);
    if (pRes.error || !pRes.data) return null;

    const partida = pRes.data;
    const presencas = prRes.data || [];
    const jogadores = jRes.data || [];
    const byId = Object.fromEntries(jogadores.map(j => [j.id, j]));

    const rawConf = presencas.filter(p => p.confirmado === true).map(p => byId[p.jogador_id]).filter(Boolean);
    const recusados = presencas.filter(p => p.confirmado === false).map(p => byId[p.jogador_id]).filter(Boolean);

    const finalConf = [], waitList = [];
    for (const j of rawConf) {
      if (j.posicao === 'Goleiro') { finalConf.push(j); continue; }
      const linhaCount = finalConf.filter(x => x.posicao !== 'Goleiro').length;
      if (linhaCount < 25) { finalConf.push(j); continue; }
      if (j.membro_status === 'mensalista') {
        const idx = [...finalConf].reverse().findIndex(x => x.posicao !== 'Goleiro' && x.membro_status === 'diarista');
        if (idx !== -1) {
          const realIdx = finalConf.length - 1 - idx;
          const [saindo] = finalConf.splice(realIdx, 1);
          finalConf.push(j); waitList.unshift(saindo);
        } else waitList.push(j);
      } else waitList.push(j);
    }

    const mens = finalConf.filter(j => j.posicao !== 'Goleiro' && j.membro_status === 'mensalista');
    const diar = finalConf.filter(j => j.posicao !== 'Goleiro' && j.membro_status !== 'mensalista');
    const gols = finalConf.filter(j => j.posicao === 'Goleiro');

    const fmt  = (j, i) => `${i + 1}. *${j.nome} ${j.sobrenome}* - ${j.posicao}${j.is_gold ? ' 🏅' : ''}`;
    const fmtG = (j, i) => `${i + 1}. *${j.nome} ${j.sobrenome}*${j.is_gold ? ' 🏅' : ''}`;

    const strM = mens.length ? mens.map(fmt).join('\n') : '_Nenhum mensalista confirmado ainda_';
    const strD = diar.length ? diar.map(fmt).join('\n') : '_Nenhum diarista confirmado ainda_';
    const strG = gols.length ? gols.map(fmtG).join('\n') : '_Nenhum goleiro confirmado ainda_';
    const strA = recusados.length ? recusados.map(fmt).join('\n') : '_Nenhuma ausência registrada_';
    const strE = waitList.length ? waitList.map(fmt).join('\n') : '_Nenhum jogador em lista de espera_';

    const d = new Date(`${partida.data}T12:00:00`);
    const diaSem = d.toLocaleDateString('pt-BR', { weekday: 'long' });
    const diaSemFmt = diaSem.charAt(0).toUpperCase() + diaSem.slice(1);
    const diaNum = d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });
    const hor = (partida.horario || '').split(' ')[0];

    return (
      `⚽ *PELADA BATISTA SÁBADO* ⚽\n` +
      `🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆\n\n` +
      `📅 Jogo: *${partida.titulo}*\n` +
      `🗓️ Data: *${diaSemFmt}, ${diaNum}* às *${hor}*\n` +
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
// JID
// ─────────────────────────────────────────────────────────────────────────────
async function resolverJID(grupoId) {
  if (!grupoId) throw new Error('grupo_id vazio');
  if (jidCache.has(grupoId)) return jidCache.get(grupoId);
  let jid;
  if (grupoId.includes('chat.whatsapp.com/')) {
    const codigo = grupoId.split('chat.whatsapp.com/').pop().split('?')[0].trim();
    try { const meta = await sock.groupGetInviteInfo(codigo); jid = meta.id; }
    catch (err) { throw new Error(`Link inválido: ${err.message}`); }
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
  console.log(`📤 → ${jid}`);
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
    connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000, retryRequestDelayMs: 3000,
  });

  // FIX: usa agendarSalvarSessao (debounced) em vez de salvarSessao direto
  sock.ev.on('creds.update', async () => {
    await saveCreds();
    agendarSalvarSessao();
  });

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) { currentQR = qr; console.log(`\n🔗 QR: ${CONFIG.SELF_URL}/qr\n`); }

    if (connection === 'open') {
      isConnected = true; currentQR = null; reconnectAttempts = 0;
      console.log('✅ WhatsApp conectado!');
      // Salva sessão após conectar (sem debounce — é um evento único)
      await salvarSessao();
      iniciarSelfPing();
      iniciarCronDiario();
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
      const delay = Math.min(
        CONFIG.RECONNECT_BASE_MS * Math.pow(2, reconnectAttempts - 1),
        CONFIG.RECONNECT_MAX_MS
      );
      console.log(`🔄 Reconectando em ${delay / 1000}s (#${reconnectAttempts})...`);
      setTimeout(conectarWhatsApp, delay);
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────
async function iniciar() {
  console.log('🚀 Robô Pelada Batista v2.2 — iniciando...');
  console.log(`📡 URL: ${CONFIG.SELF_URL}`);
  console.log(`🔐 Secret: ${CONFIG.WEBHOOK_SECRET ? '✅' : '❌ NÃO configurado!'}`);
  console.log('📋 Regras: REGRA1(cron+webhook) | REGRA2(webhook) | REGRA3(webhook)');

  app.listen(CONFIG.PORT, () => {
    console.log(`🌐 Servidor na porta ${CONFIG.PORT}`);
    console.log(`📱 QR Code em: ${CONFIG.SELF_URL}/qr`);
  });

  await baixarSessao();
  await conectarWhatsApp();
}

iniciar().catch(err => {
  console.error('💥 Erro fatal:', err);
  process.exit(1);
});
