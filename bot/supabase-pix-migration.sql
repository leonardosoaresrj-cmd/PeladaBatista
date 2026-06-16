-- ============================================================
-- PELADA BATISTA — Migração PIX Mercado Pago
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Coluna para rastrear o ID do pagamento no MP
ALTER TABLE pagamentos
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT;

-- 2. Índice único: impede quitação duplicada por jogador+mês
--    Necessário para o upsert do webhook funcionar
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_jogador_mes
  ON pagamentos (jogador_id, mes_ref)
  WHERE partida_id IS NULL;

-- Para diaristas (tem partida_id):
CREATE UNIQUE INDEX IF NOT EXISTS idx_pagamentos_jogador_partida
  ON pagamentos (jogador_id, partida_id)
  WHERE partida_id IS NOT NULL;

-- 3. Índice para busca por ID do MP
CREATE INDEX IF NOT EXISTS idx_pagamentos_mp
  ON pagamentos (mp_payment_id);

-- ============================================================
-- VERIFICAÇÃO: rode esta query para confirmar
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'pagamentos';
-- ============================================================
