-- ============================================================
-- Migração: garantir que racha_configuracoes existe
-- Executar em: Supabase → SQL Editor → New query
-- ============================================================

CREATE TABLE IF NOT EXISTS racha_configuracoes (
  chave       TEXT PRIMARY KEY,
  valor       TEXT NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar RLS (configurações são globais do sistema)
ALTER TABLE racha_configuracoes DISABLE ROW LEVEL SECURITY;

-- Inserir as configurações de WhatsApp com valores padrão (vazios)
-- Eles serão sobrescritos quando o admin salvar pelo portal
INSERT INTO racha_configuracoes (chave, valor) VALUES
  ('whatsapp_grupo_link',     '')
, ('whatsapp_automacao_ativa','false')
, ('whatsapp_webhook_url',    'https://futebolbot.onrender.com/teste')
, ('whatsapp_webhook_token',  '')
ON CONFLICT (chave) DO NOTHING;

-- Verificar resultado
SELECT chave, valor, updated_at FROM racha_configuracoes ORDER BY chave;
