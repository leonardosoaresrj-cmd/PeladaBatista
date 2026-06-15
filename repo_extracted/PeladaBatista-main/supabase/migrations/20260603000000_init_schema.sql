-- SCHEMA DE BANCO DE DADOS POSTGRESQL (SUPABASE / RENDER.COM)
-- Aplicação: Gestão de Partidas de Futebol

-- 1. Habilitar extensões úteis
create extension if not exists "uuid-ossp";

-- 2. Enumerados para tipos de posições e status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'posicao_jogador') THEN
        CREATE TYPE posicao_jogador AS ENUM ('Goleiro', 'Defesa', 'Meio', 'Ataque');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'status_jogador') THEN
        CREATE TYPE status_jogador AS ENUM ('pendente_aprovacao', 'ativo', 'suspenso');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'membro_status') THEN
        CREATE TYPE membro_status AS ENUM ('mensalista', 'diarista', 'isento');
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'role_usuario') THEN
        CREATE TYPE role_usuario AS ENUM ('admin', 'jogador');
    END IF;
END $$;

-- 3. Tabela de Jogadores / Usuários
create table if not exists jogadores (
  id uuid primary key default uuid_generate_v4(),
  nome varchar(50) not null,
  sobrenome varchar(50) not null,
  posicao posicao_jogador not null,
  data_nascimento date not null,
  foto varchar(100) default 'jersey-red',
  membro_status membro_status not null,
  email varchar(100) unique not null,
  senha varchar(4) not null, -- PIN de 4 dígitos
  status status_jogador default 'pendente_aprovacao',
  role role_usuario default 'jogador',
  is_gold boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Partidas/Eventos
create table if not exists partidas (
  id uuid primary key default uuid_generate_v4(),
  titulo varchar(150) not null,
  data date not null,
  horario varchar(50) not null, -- Alterado de time para varchar para suportar formatos flexíveis
  local varchar(200) not null,
  criado_por uuid references jogadores(id) on delete set null,
  cancelada boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabela de Confirmações de Presença (Relação N-M)
create table if not exists presencas (
  id uuid primary key default uuid_generate_v4(),
  partida_id uuid references partidas(id) on delete cascade not null,
  jogador_id uuid references jogadores(id) on delete cascade not null,
  confirmado boolean not null, -- TRUE para Sim, FALSE para Não
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (partida_id, jogador_id)
);

-- 6. Tabela de Pagamentos
create table if not exists pagamentos (
  id uuid primary key default uuid_generate_v4(),
  jogador_id uuid references jogadores(id) on delete cascade not null,
  mes_ref varchar(7) not null, -- Formato 'YYYY-MM'
  status varchar(20) not null check (status in ('pago', 'pendente')),
  data_pagamento timestamp with time zone,
  valor numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar Índices para consultas rápidas
create index if not exists idx_jogadores_email on jogadores(email);
create index if not exists idx_partidas_data on partidas(data);
create index if not exists idx_presencas_partida on presencas(partida_id);
create index if not exists idx_pagamentos_jogador_mes on pagamentos(jogador_id, mes_ref);

-- 7. Configurar Row Level Security (RLS) para Supabase
-- RLS desativado/permitido para a chave pública pois a autenticação ocorre a nível da aplicação (PIN customizado)
alter table jogadores enable row level security;
alter table partidas enable row level security;
alter table presencas enable row level security;
alter table pagamentos enable row level security;

-- Políticas para tabela JOGADORES (Acesso total para o sistema rodando frontend)
drop policy if exists "Acesso livre jogadores" on jogadores;
create policy "Acesso livre jogadores" on jogadores for all using (true) with check (true);

-- Políticas para tabela PARTIDAS
drop policy if exists "Acesso livre partidas" on partidas;
create policy "Acesso livre partidas" on partidas for all using (true) with check (true);

-- Políticas para tabela PRESENCAS
drop policy if exists "Acesso livre presenças" on presencas;
create policy "Acesso livre presenças" on presencas for all using (true) with check (true);

-- Políticas para tabela PAGAMENTOS
drop policy if exists "Acesso livre pagamentos" on pagamentos;
create policy "Acesso livre pagamentos" on pagamentos for all using (true) with check (true);

-- 8. Tabela de Logs e Histórico do Bot de WhatsApp (MIGRAÇÃO)
create table if not exists whatsapp_logs (
  id uuid primary key default uuid_generate_v4(),
  data timestamp with time zone default timezone('utc'::text, now()) not null,
  atleta varchar(150),
  partida varchar(150),
  mensagem text not null,
  status varchar(20) default 'sucesso' not null
);

alter table whatsapp_logs enable row level security;

drop policy if exists "Acesso livre logs" on whatsapp_logs;
create policy "Acesso livre logs" on whatsapp_logs for all using (true) with check (true);

-- 9. Tabela de Configurações Globais (MIGRAÇÃO)
create table if not exists racha_configuracoes (
  chave varchar(100) primary key,
  valor text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table racha_configuracoes enable row level security;

drop policy if exists "Acesso livre configurações" on racha_configuracoes;
create policy "Acesso livre configurações" on racha_configuracoes for all using (true) with check (true);
