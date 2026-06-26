-- ============================================================
--  PELADA BATISTA v2.2 — Tabela bot_session
--  Execute no SQL Editor do Supabase ANTES de fazer o deploy
--  da v2.2. Esta tabela substitui os 100 arquivos individuais
--  do Storage, eliminando o erro ENOENT dos pre-key files.
-- ============================================================

CREATE TABLE IF NOT EXISTS bot_session (
  id           TEXT PRIMARY KEY DEFAULT 'main',
  session_data TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Política de segurança (service_role tem acesso total)
ALTER TABLE bot_session ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role total" ON bot_session
  USING (true) WITH CHECK (true);

-- ============================================================
--  APÓS CRIAR A TABELA:
--  1. Faça o deploy da v2.2 no GitHub (substitua o bot-pelada-batista-v2.js)
--  2. O Render vai reiniciar automaticamente
--  3. Na primeira inicialização, o bot migra a sessão do Storage
--     para esta tabela automaticamente
--  4. Os 100 arquivos do Storage continuam lá como backup —
--     você pode apagá-los depois se quiser
-- ============================================================
