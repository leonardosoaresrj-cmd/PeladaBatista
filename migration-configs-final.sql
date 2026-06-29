-- ============================================================
-- MIGRAÇÃO FINAL: todas as 14 configurações no Supabase
-- Supabase → SQL Editor → New query → Run
-- ============================================================
CREATE TABLE IF NOT EXISTS racha_configuracoes (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE racha_configuracoes DISABLE ROW LEVEL SECURITY;

INSERT INTO racha_configuracoes (chave, valor) VALUES
  ('racha_whatsapp_grupo_link',      '')
, ('racha_whatsapp_automacao_ativa', 'false')
, ('racha_whatsapp_webhook_url',     'https://futebolbot.onrender.com/teste')
, ('racha_whatsapp_webhook_token',   '')
, ('racha_valor_4s',                 '85')
, ('racha_valor_5s',                 '105')
, ('racha_valor_diaria',             '30')
, ('futebol_aluguel_campo_base',     '300')
, ('futebol_aluguel_mensal_map',     '{}')
, ('futebol_startup_month',          '2026-06')
, ('direto_pix_chave',               '')
, ('direto_pix_nome',                'Pelada Batista')
, ('direto_pix_cidade',              'RIO DE JANEIRO')
, ('partidas_excluidas',             '[]')
ON CONFLICT (chave) DO NOTHING;

SELECT chave, valor FROM racha_configuracoes ORDER BY chave;
