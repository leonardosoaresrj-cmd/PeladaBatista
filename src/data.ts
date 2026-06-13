/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Jogador, Partida, Pagamento } from './types';

// Avatares com jérsei de futebol com cores estilosas
export const AVATAR_PRESETS = [
  { id: 'jersey-red', name: 'Manto Vermelho', color: '#dc2626', text: '⚪' },
  { id: 'jersey-blue', name: 'Manto Azul', color: '#2563eb', text: '⚪' },
  { id: 'jersey-green', name: 'Manto Verde', color: '#16a34a', text: '⚪' },
  { id: 'jersey-yellow', name: 'Manto Amarelo', color: '#ca8a04', text: '⚫' },
  { id: 'jersey-black', name: 'Manto Preto', color: '#171717', text: '⚪' },
  { id: 'jersey-orange', name: 'Manto Laranja', color: '#ea580c', text: '⚪' },
  { id: 'jersey-white', name: 'Manto Branco', color: '#f8fafc', text: '⚫' },
  { id: 'jersey-purple', name: 'Manto Roxo', color: '#9333ea', text: '⚪' },
];

export const INITIAL_JOGADORES: Jogador[] = [
  {
    id: 'admin-leonardo',
    nome: 'Leonardo',
    sobrenome: 'Soares',
    posicao: 'Meio',
    dataNascimento: '1990-01-01',
    foto: 'jersey-black',
    membroStatus: 'mensalista',
    email: 'leonardo.soares.rj@gmail.com',
    senha: '1234',
    status: 'ativo',
    role: 'admin',
    createdAt: '2026-06-03T12:00:00Z',
  }
];

export const INITIAL_PARTIDAS: Partida[] = [];

export const INITIAL_PAGAMENTOS: Pagamento[] = [];

// Scripts SQL prontos para implementação no Supabase cadastrado e Render
export const DATABASE_SQL_SCHEMA = `-- SCHEMA DE BANCO DE DADOS POSTGRESQL (SUPABASE / RENDER.COM)
-- Aplicação: Gestão de Partidas de Futebol

-- 1. Habilitar extensões úteis
create extension if not exists "uuid-ossp";

-- 2. Enumerados para tipos de posições e status
create type posicao_jogador as enum ('Goleiro', 'Defesa', 'Meio', 'Ataque');
create type status_jogador as enum ('pendente_aprovacao', 'ativo', 'suspenso');
create type membro_status as enum ('mensalista', 'diarista');
create type role_usuario as enum ('admin', 'jogador');

-- 3. Tabela de Jogadores / Usuários
create table jogadores (
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
create table partidas (
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
create table presencas (
  id uuid primary key default uuid_generate_v4(),
  partida_id uuid references partidas(id) on delete cascade not null,
  jogador_id uuid references jogadores(id) on delete cascade not null,
  confirmado boolean not null, -- TRUE para Sim, FALSE para Não
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (partida_id, jogador_id)
);

-- 6. Tabela de Pagamentos
create table pagamentos (
  id uuid primary key default uuid_generate_v4(),
  jogador_id uuid references jogadores(id) on delete cascade not null,
  mes_ref varchar(7) not null, -- Formato 'YYYY-MM'
  status varchar(20) not null check (status in ('pago', 'pendente')),
  data_pagamento timestamp with time zone,
  valor numeric(10,2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Criar Índices para consultas rápidas
create index idx_jogadores_email on jogadores(email);
create index idx_partidas_data on partidas(data);
create index idx_presencas_partida on presencas(partida_id);
create index idx_pagamentos_jogador_mes on pagamentos(jogador_id, mes_ref);

-- 7. Configurar Row Level Security (RLS) para Supabase
alter table jogadores enable row level security;
alter table partidas enable row level security;
alter table presencas enable row level security;
alter table pagamentos enable row level security;

-- Políticas para tabela JOGADORES
create policy "Qualquer pessoa pode se cadastrar" on jogadores
  for insert with check (true);

create policy "Jogadores ativos podem ver perfis" on jogadores
  for select using (
    exists (
      select 1 from jogadores where id = auth.uid() and status = 'ativo'
    )
  );

create policy "Admins podem tudo em jogadores" on jogadores
  using (
    exists (
      select 1 from jogadores where id = auth.uid() and role = 'admin'
    )
  );

-- Políticas para tabela PARTIDAS
create policy "Qualquer usuário ativo vê as partidas" on partidas
  for select using (
    exists (
      select 1 from jogadores where id = auth.uid() and status = 'ativo'
    )
  );

create policy "Apenas administradores editam partidas" on partidas
  for all using (
    exists (
      select 1 from jogadores where id = auth.uid() and role = 'admin'
    )
  );

-- Políticas para tabela PRESENCAS
create policy "Jogadores ativos podem ver presenças" on presencas
  for select using (
    exists (
      select 1 from jogadores where id = auth.uid() and status = 'ativo'
    )
  );

create policy "Jogadores ativos podem atualizar sua própria confirmação" on presencas
  for all using (
    jogador_id = auth.uid() and
    exists (
      select 1 from jogadores where id = auth.uid() and status = 'ativo'
    )
  );

create policy "Admins gerenciam todas as confirmações" on presencas
  for all using (
    exists (
      select 1 from jogadores where id = auth.uid() and role = 'admin'
    )
  );

-- Políticas para tabela PAGAMENTOS
create policy "Jogadores vêem seus próprios pagamentos" on pagamentos
  for select using (jogador_id = auth.uid());

create policy "Admins gerenciam todos os pagamentos" on pagamentos
  for all using (
    exists (
      select 1 from jogadores where id = auth.uid() and role = 'admin'
    )
  );

-- 8. Tabelas de Integração do Robô WhatsApp v2.2 (MIGRAÇÃO)
create table if not exists bot_session (
  id           TEXT PRIMARY KEY DEFAULT 'main',
  session_data TEXT NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

alter table bot_session enable row level security;
create policy "Service role total na bot_session" on bot_session using (true) with check (true);

create table if not exists bot_logs (
  id uuid primary key default uuid_generate_v4(),
  evento varchar(100),
  tabela varchar(100),
  mensagem text not null,
  enviado_em timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table bot_logs enable row level security;
create policy "Qualquer pessoa vê os logs do bot" on bot_logs for select using (true);
create policy "Admins gerenciam logs do bot" on bot_logs for all using (
  exists (select 1 from jogadores where id = auth.uid() and role = 'admin')
);

-- 9. Tabela de Configurações Globais (MIGRAÇÃO)
create table if not exists racha_configuracoes (
  chave varchar(100) primary key,
  valor text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table racha_configuracoes enable row level security;

create policy "Visualização pública de chaves de configuração" on racha_configuracoes
  for select using (true);

create policy "Admins gerenciam configurações do racha" on racha_configuracoes
  for all using (
    exists (
      select 1 from jogadores where id = auth.uid() and role = 'admin'
    )
  );
`;

// Carregar dados iniciais guardados de jogadores (limpando histórico de teste)
export function getSavedJogadores(): Jogador[] {
  const json = localStorage.getItem('futebol_jogadores');
  let list: Jogador[] = [];
  if (json) {
    try {
      list = JSON.parse(json);
      // Mantém única e exclusivamente a conta do administrador Leonardo Soares
      list = list.filter(j => j.email.toLowerCase().trim() === 'leonardo.soares.rj@gmail.com');
    } catch (e) {
      list = [];
    }
  }
  
  if (list.length === 0) {
    list = [...INITIAL_JOGADORES];
  }
  
  localStorage.setItem('futebol_jogadores', JSON.stringify(list));
  return list;
}

export function saveJogadores(jogadores: Jogador[]) {
  // Permite salvar novos jogadores limpos
  localStorage.setItem('futebol_jogadores', JSON.stringify(jogadores));
}

// Limpar todo o histórico de partidas antigas
export function getSavedPartidas(): Partida[] {
  localStorage.setItem('futebol_partidas', JSON.stringify([]));
  return [];
}

export function savePartidas(partidas: Partida[]) {
  localStorage.setItem('futebol_partidas', JSON.stringify(partidas));
}

// Limpar todo o histórico de pagamentos antigos
export function getSavedPagamentos(): Pagamento[] {
  localStorage.setItem('futebol_pagamentos', JSON.stringify([]));
  return [];
}

export function savePagamentos(pagamentos: Pagamento[]) {
  localStorage.setItem('futebol_pagamentos', JSON.stringify(pagamentos));
}

// Limpar todo histórico de lançamentos de caixa
export function getSavedLancamentos(): any[] {
  localStorage.removeItem('futebol_lancamentos_caixa');
  return [];
}

export function saveLancamentos(lancamentos: any[]) {
  localStorage.setItem('futebol_lancamentos_caixa', JSON.stringify(lancamentos));
}

export function getSavedAluguelCampo(): number {
  const val = localStorage.getItem('futebol_aluguel_campo');
  if (!val) {
    return 500; // Valor padrão: R$ 500
  }
  return Number(val);
}

export function saveAluguelCampo(valor: number) {
  localStorage.setItem('futebol_aluguel_campo', String(valor));
}

