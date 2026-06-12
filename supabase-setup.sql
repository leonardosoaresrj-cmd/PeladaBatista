-- ============================================================
--  ROBÔ DE FUTEBOL — Setup do Supabase
--  Execute este script no SQL Editor do Supabase
--  supabase.com → seu projeto → SQL Editor → New query
-- ============================================================

-- ── 1. Tabela de log das mensagens enviadas ───────────────────
CREATE TABLE IF NOT EXISTS bot_logs (
  id          BIGSERIAL PRIMARY KEY,
  evento      TEXT NOT NULL,          -- INSERT, UPDATE, DELETE
  tabela      TEXT NOT NULL,          -- nome da tabela que gerou o evento
  mensagem    TEXT NOT NULL,          -- texto enviado para o grupo
  enviado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Exemplo: Tabela de jogos ───────────────────────────────
--  ⚙️ ADAPTE esta estrutura ao seu banco atual!
--  Se você já tem as tabelas, pule esta parte.

CREATE TABLE IF NOT EXISTS jogos (
  id               BIGSERIAL PRIMARY KEY,
  time_casa        TEXT NOT NULL,
  time_visitante   TEXT NOT NULL,
  data_jogo        TIMESTAMPTZ NOT NULL,
  horario          TEXT,
  local            TEXT,
  placar_casa      INTEGER,           -- NULL até o jogo acontecer
  placar_visitante INTEGER,           -- NULL até o jogo acontecer
  criado_em        TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. Exemplo: Tabela de artilharia ────────────────────────
CREATE TABLE IF NOT EXISTS artilharia (
  id          BIGSERIAL PRIMARY KEY,
  jogador     TEXT NOT NULL,
  time        TEXT NOT NULL,
  total_gols  INTEGER DEFAULT 1,
  criado_em   TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. Habilitar Realtime nas tabelas (necessário para webhooks) ─
-- Execute um por vez se necessário
ALTER PUBLICATION supabase_realtime ADD TABLE jogos;
ALTER PUBLICATION supabase_realtime ADD TABLE artilharia;
ALTER PUBLICATION supabase_realtime ADD TABLE bot_logs;

-- ── 5. Política de segurança (RLS) ───────────────────────────
-- Permite que a Service Key leia/escreva em bot_logs
ALTER TABLE bot_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role acesso total" ON bot_logs
  USING (true)
  WITH CHECK (true);

-- ============================================================
--  PRÓXIMO PASSO:
--  Configure o Webhook no painel do Supabase:
--  Supabase → Database → Webhooks → Create a new hook
--
--  Nome: futebol-bot-webhook
--  Tabela: jogos (repita para cada tabela)
--  Eventos: INSERT, UPDATE
--  URL: https://SEU-SERVICO.onrender.com/webhook
--  Headers:
--    Content-Type: application/json
--    x-webhook-secret: (sua WEBHOOK_SECRET)
-- ============================================================
