/**
 * Pelada Batista Sábado - Servidor do Bot do WhatsApp
 * Framework: Express + whatsapp-web.js
 * 
 * Instruções de instalação detalhadas disponíveis na área de configurações do portal.
 */

const express = require('express');
const bodyParser = require('body-parser');

let Client, LocalAuth;
try {
  const wa = require('whatsapp-web.js');
  Client = wa.Client;
  LocalAuth = wa.LocalAuth;
} catch (e) {
  console.log('whatsapp-web.js não instalado localmente.');
}

let qrcode;
try {
  qrcode = require('qrcode-terminal');
} catch (e) {}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(bodyParser.json());

let client = null;
let isReady = false;

if (Client && LocalAuth) {
  client = new Client({
    authStrategy: new LocalAuth({
      dataPath: './session'
    }),
    puppeteer: {
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
  });

  client.on('qr', (qr) => {
    console.log('------------------------------------------------------------');
    console.log('ROTEIRO DE ATIVAÇÃO DO BOT PARA A PELADA BATISTA SÁBADO');
    console.log('Escaneie o QR Code abaixo com seu WhatsApp para ativar o bot:');
    console.log('------------------------------------------------------------');
    if (qrcode) {
      qrcode.generate(qr, { small: true });
    } else {
      console.log('Link QR Code gerado (escaneie no terminal):', qr);
    }
  });

  client.on('ready', () => {
    isReady = true;
    console.log('\n============================================================');
    console.log('🤖 BOT WHATSAPP CONECTADO COM SUCESSO!');
    console.log(`Pronto para despachar alertas de presença e pagamentos.`);
    console.log(`Porta Servidor API: http://localhost:${PORT}`);
    console.log('============================================================\n');
  });

  client.on('auth_failure', (msg) => {
    console.error('Falha na autenticação do WhatsApp:', msg);
  });

  client.on('disconnected', (reason) => {
    isReady = false;
    console.warn('Conexão do WhatsApp encerrada. Motivo:', reason);
  });

  client.initialize();
} else {
  console.log('Executando em modo simulado. Para ativar, rode: npm install express body-parser qrcode-terminal whatsapp-web.js');
}

// Endpoint para enviar mensagens de forma programática
app.post('/api/messages/send', async (req, res) => {
  const { message, groupLink } = req.body;

  if (!message) {
    return res.status(400).json({ success: false, error: 'Mensagem ("message") é obrigatória no corpo.' });
  }

  // Se simulado
  if (!client) {
    console.log('🤖 [SIMULADOR BOT WHATSAPP]: Recebido disparo:', message);
    return res.json({ 
      success: true, 
      simulado: true, 
      message: 'Mensagem simulada enviada com sucesso no console do servidor!' 
    });
  }

  if (!isReady) {
    return res.status(503).json({ success: false, error: 'O bot ainda não concluiu a autenticação via QR Code.' });
  }

  try {
    let chatTarget = null;

    // Se passarem link de convite do grupo, extraímos o ID do grupo
    if (groupLink && groupLink.includes('chat.whatsapp.com/')) {
      const inviteCode = groupLink.split('chat.whatsapp.com/')[1].split('?')[0]; // Limpar queries
      try {
        const groupChatId = await client.acceptInvite(inviteCode);
        chatTarget = groupChatId._serialized || groupChatId;
        console.log(`Bot conectado ao grupo pelo convite: ${inviteCode}`);
      } catch (err) {
        console.warn('Não foi possível entrar no grupo usando o link fornecido. Tentando enviar como mensagem direta de fallback...', err);
      }
    }

    if (chatTarget) {
      await client.sendMessage(chatTarget, message);
      return res.json({ success: true, message: 'Mensagem enviada com sucesso para o grupo de WhatsApp!' });
    } else {
      // Procurar nos chats existentes por grupo de futebol
      const chats = await client.getChats();
      const groupChat = chats.find(c => c.isGroup && (
        c.name.toLowerCase().includes('pelada') || 
        c.name.toLowerCase().includes('racha') || 
        c.name.toLowerCase().includes('futebol') || 
        c.name.toLowerCase().includes('batista')
      ));

      if (groupChat) {
        await client.sendMessage(groupChat.id._serialized, message);
        return res.json({ success: true, message: `Mensagem enviada para o grupo encontrado "${groupChat.name}"!` });
      } else {
        return res.status(404).json({ 
          success: false, 
          error: 'Nenhum grupo de futebol correspondente encontrado. Entre no grupo com a conta do bot ou forneça o link correto.' 
        });
      }
    }
  } catch (error) {
    console.error('Erro no envio da mensagem via WhatsApp SDK:', error);
    return res.status(500).json({ success: false, error: error.message || error });
  }
});

app.get('/api/health', (req, res) => {
  res.json({
    status: isReady ? 'online' : (client ? 'aguardando_autenticacao' : 'modo_simulado'),
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de Automação de WhatsApp ativo na porta ${PORT}`);
});
