-- ============================================================
--  PELADA BATISTA — Webhooks do Supabase
--  Execute no SQL Editor: supabase.com → SQL Editor → New query
--  Tabelas já existem no seu projeto — só execute o que falta
-- ============================================================

-- 1. Tabela de log das mensagens do robô (se não existir)
CREATE TABLE IF NOT EXISTS bot_logs (
  id          BIGSERIAL PRIMARY KEY,
  evento      TEXT NOT NULL,
  tabela      TEXT NOT NULL,
  mensagem    TEXT NOT NULL,
  enviado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Habilitar Realtime nas tabelas do PeladaBatista
--    (necessário para que os webhooks funcionem)
ALTER PUBLICATION supabase_realtime ADD TABLE partidas;
ALTER PUBLICATION supabase_realtime ADD TABLE presencas;
ALTER PUBLICATION supabase_realtime ADD TABLE pagamentos;
ALTER PUBLICATION supabase_realtime ADD TABLE jogadores;
ALTER PUBLICATION supabase_realtime ADD TABLE bot_logs;

-- ============================================================
--  CONFIGURAÇÃO DOS WEBHOOKS NO PAINEL SUPABASE
--  Supabase → Database → Webhooks → Create a new hook
--
--  Crie um hook para CADA tabela abaixo:
--
--  ┌─────────────────────────────────────────────────────────┐
--  │ HOOK 1: partidas                                        │
--  │  Nome:    pelada-bot-partidas                           │
--  │  Tabela:  partidas                                      │
--  │  Eventos: INSERT, UPDATE                                │
--  │  URL:     https://SEU-BOT.onrender.com/webhook         │
--  │  Headers: x-webhook-secret: SUA_WEBHOOK_SECRET         │
--  ├─────────────────────────────────────────────────────────┤
--  │ HOOK 2: presencas                                       │
--  │  Nome:    pelada-bot-presencas                          │
--  │  Tabela:  presencas                                     │
--  │  Eventos: INSERT, UPDATE                                │
--  │  URL:     https://SEU-BOT.onrender.com/webhook         │
--  │  Headers: x-webhook-secret: SUA_WEBHOOK_SECRET         │
--  ├─────────────────────────────────────────────────────────┤
--  │ HOOK 3: pagamentos                                      │
--  │  Nome:    pelada-bot-pagamentos                         │
--  │  Tabela:  pagamentos                                    │
--  │  Eventos: INSERT, UPDATE                                │
--  │  URL:     https://SEU-BOT.onrender.com/webhook         │
--  │  Headers: x-webhook-secret: SUA_WEBHOOK_SECRET         │
--  ├─────────────────────────────────────────────────────────┤
--  │ HOOK 4: jogadores                                       │
--  │  Nome:    pelada-bot-jogadores                          │
--  │  Tabela:  jogadores                                     │
--  │  Eventos: UPDATE (apenas aprovações)                    │
--  │  URL:     https://SEU-BOT.onrender.com/webhook         │
--  │  Headers: x-webhook-secret: SUA_WEBHOOK_SECRET         │
--  └─────────────────────────────────────────────────────────┘
-- ============================================================
