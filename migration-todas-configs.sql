-- ============================================================
-- MIGRAÇÃO COMPLETA: todas as configurações do sistema no Supabase
-- Executar em: Supabase → SQL Editor → New query → Run
-- ============================================================

-- Garantir que a tabela existe
CREATE TABLE IF NOT EXISTS racha_configuracoes (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Sem RLS — configurações são globais do sistema admin
ALTER TABLE racha_configuracoes DISABLE ROW LEVEL SECURITY;

-- Inserir todas as configurações com valores padrão
-- (serão sobrescritas quando o admin salvar pelo portal)
INSERT INTO racha_configuracoes (chave, valor) VALUES
  -- WhatsApp / Bot
  ('racha_whatsapp_grupo_link',        '')
, ('racha_whatsapp_automacao_ativa',   'false')
, ('racha_whatsapp_webhook_url',       'https://futebolbot.onrender.com/teste')
, ('racha_whatsapp_webhook_token',     '')
  -- Valores de mensalidade e diária
, ('racha_valor_4s',                   '85')
, ('racha_valor_5s',                   '105')
, ('racha_valor_diaria',               '30')
  -- Aluguel do campo
, ('futebol_aluguel_campo_base',       '300')
, ('futebol_aluguel_mensal_map',       '{}')
  -- Mês de referência inicial
, ('futebol_startup_month',            '2026-06')
  -- PIX direto (fallback se Mercado Pago indisponível)
, ('direto_pix_chave',                 '')
, ('direto_pix_nome',                  'Pelada Batista')
, ('direto_pix_cidade',                'RIO DE JANEIRO')
ON CONFLICT (chave) DO NOTHING;

-- Confirmar resultado
SELECT chave, valor, updated_at
FROM racha_configuracoes
ORDER BY chave;
