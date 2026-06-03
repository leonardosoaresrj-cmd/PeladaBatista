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
    id: 'admin-1',
    nome: 'Carlos',
    sobrenome: 'Silva',
    posicao: 'Meio',
    dataNascimento: '1988-06-15',
    foto: 'jersey-black',
    membroStatus: 'mensalista',
    email: 'admin@campo.com',
    senha: '1234',
    status: 'ativo',
    role: 'admin',
    createdAt: '2026-01-01T12:00:00Z',
  },
  {
    id: 'jog-1',
    nome: 'Roberto',
    sobrenome: 'Carlos',
    posicao: 'Defesa',
    dataNascimento: '1993-04-12',
    foto: 'jersey-blue',
    membroStatus: 'mensalista',
    email: 'roberto@email.com',
    senha: '1111',
    status: 'ativo',
    role: 'jogador',
    createdAt: '2026-02-10T14:30:00Z',
  },
  {
    id: 'jog-2',
    nome: 'Neymar',
    sobrenome: 'Santos',
    posicao: 'Ataque',
    dataNascimento: '1992-02-05',
    foto: 'jersey-yellow',
    membroStatus: 'diarista',
    email: 'neymar@email.com',
    senha: '2222',
    status: 'ativo',
    role: 'jogador',
    createdAt: '2026-03-15T10:00:00Z',
  },
  {
    id: 'jog-3',
    nome: 'Alisson',
    sobrenome: 'Becker',
    posicao: 'Goleiro',
    dataNascimento: '1992-10-02',
    foto: 'jersey-green',
    membroStatus: 'mensalista',
    email: 'alisson@email.com',
    senha: '3333',
    status: 'ativo',
    role: 'jogador',
    createdAt: '2026-03-20T09:15:00Z',
  },
  {
    id: 'jog-4',
    nome: 'Bruno',
    sobrenome: 'Guimarães',
    posicao: 'Meio',
    dataNascimento: '1997-11-16',
    foto: 'jersey-red',
    membroStatus: 'mensalista',
    email: 'bruno@email.com',
    senha: '4444',
    status: 'ativo',
    role: 'jogador',
    createdAt: '2026-04-01T16:00:00Z',
  },
  {
    id: 'jog-5',
    nome: 'Marquinhos',
    sobrenome: 'Correa',
    posicao: 'Defesa',
    dataNascimento: '1994-05-14',
    foto: 'jersey-white',
    membroStatus: 'mensalista',
    email: 'marquinhos@email.com',
    senha: '5555',
    status: 'ativo',
    role: 'jogador',
    createdAt: '2026-04-05T11:45:00Z',
  },
  {
    id: 'jog-6',
    nome: 'Vinícius',
    sobrenome: 'Júnior',
    posicao: 'Ataque',
    dataNascimento: '2000-07-12',
    foto: 'jersey-purple',
    membroStatus: 'diarista',
    email: 'vini@email.com',
    senha: '6666',
    status: 'ativo',
    role: 'jogador',
    createdAt: '2026-04-10T18:20:00Z',
  },
  {
    id: 'jog-7',
    nome: 'Lucas',
    sobrenome: 'Paquetá',
    posicao: 'Meio',
    dataNascimento: '1997-08-27',
    foto: 'jersey-orange',
    membroStatus: 'diarista',
    email: 'lucas@email.com',
    senha: '7777',
    status: 'pendente_aprovacao',
    role: 'jogador',
    createdAt: '2026-05-28T15:30:00Z',
  },
  {
    id: 'jog-8',
    nome: 'Weverton',
    sobrenome: 'Pereira',
    posicao: 'Goleiro',
    dataNascimento: '1987-12-13',
    foto: 'jersey-yellow',
    membroStatus: 'mensalista',
    email: 'weverton@email.com',
    senha: '8888',
    status: 'pendente_aprovacao',
    role: 'jogador',
    createdAt: '2026-05-29T10:00:00Z',
  }
];

export const INITIAL_PARTIDAS: Partida[] = [
  {
    id: 'part-1',
    titulo: 'Rebatedores vs Clássico Arena',
    data: '2026-05-20',
    horario: '19:30',
    local: 'Arena Futebol Show - Campo A',
    confirmados: ['admin-1', 'jog-1', 'jog-3', 'jog-4', 'jog-5'],
    recusados: ['jog-2', 'jog-6'],
    criadoPor: 'admin-1',
    createdAt: '2026-05-15T12:00:00Z',
  },
  {
    id: 'part-2',
    titulo: 'Racha de Domingo Clássico',
    data: '2026-05-31', // Hoje (de acordo com metadados)
    horario: '16:00',
    local: 'Arena Society Verde - Campo 2',
    confirmados: ['admin-1', 'jog-1', 'jog-2', 'jog-3', 'jog-4', 'jog-5', 'jog-6'],
    recusados: [],
    criadoPor: 'admin-1',
    createdAt: '2026-05-25T10:00:00Z',
  },
  {
    id: 'part-3',
    titulo: 'Primeiro Racha de Junho',
    data: '2026-06-07',
    horario: '09:00',
    local: 'Arena Society Verde - Campo 1',
    confirmados: ['admin-1', 'jog-1', 'jog-3', 'jog-4'],
    recusados: ['jog-5'],
    criadoPor: 'admin-1',
    createdAt: '2026-05-30T10:00:00Z',
  },
  {
    id: 'part-4',
    titulo: 'Clássico do Meio do Mês',
    data: '2026-06-14',
    horario: '20:00',
    local: 'Estádio Municipal Secundário',
    confirmados: ['jog-2', 'jog-6'],
    recusados: [],
    criadoPor: 'admin-1',
    createdAt: '2026-05-31T08:00:00Z',
  }
];

export const INITIAL_PAGAMENTOS: Pagamento[] = [
  // Mensalistas de Maio 2026
  {
    id: 'pag-1',
    jogadorId: 'admin-1',
    mesRef: '2026-05',
    status: 'pago',
    dataPagamento: '2026-05-02',
    valor: 120.00,
  },
  {
    id: 'pag-2',
    jogadorId: 'jog-1',
    mesRef: '2026-05',
    status: 'pago',
    dataPagamento: '2026-05-05',
    valor: 120.00,
  },
  {
    id: 'pag-3',
    jogadorId: 'jog-3',
    mesRef: '2026-05',
    status: 'pendente',
    dataPagamento: null,
    valor: 120.00,
  },
  {
    id: 'pag-4',
    jogadorId: 'jog-4',
    mesRef: '2026-05',
    status: 'pago',
    dataPagamento: '2026-05-10',
    valor: 120.00,
  },
  {
    id: 'pag-5',
    jogadorId: 'jog-5',
    mesRef: '2026-05',
    status: 'pendente',
    dataPagamento: null,
    valor: 120.00,
  },
  // Diaristas de Maio 2026 (pagos por partida participada)
  {
    id: 'pag-6',
    jogadorId: 'jog-2',
    mesRef: '2026-05',
    status: 'pago',
    dataPagamento: '2026-05-31',
    valor: 20.00,
  },
  {
    id: 'pag-7',
    jogadorId: 'jog-6',
    mesRef: '2026-05',
    status: 'pendente',
    dataPagamento: null,
    valor: 20.00, // Pendente do jogo de hoje
  }
];

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

create policy "Qualquer pessoa vê os logs do bot" on whatsapp_logs
  for select using (true);

create policy "Admins gerenciam logs do bot" on whatsapp_logs
  for all using (
    exists (
      select 1 from jogadores where id = auth.uid() and role = 'admin'
    )
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

// Carregar dados iniciais guardados
export function getSavedJogadores(): Jogador[] {
  const json = localStorage.getItem('futebol_jogadores');
  if (!json) {
    localStorage.setItem('futebol_jogadores', JSON.stringify(INITIAL_JOGADORES));
    return INITIAL_JOGADORES;
  }
  return JSON.parse(json);
}

export function saveJogadores(jogadores: Jogador[]) {
  localStorage.setItem('futebol_jogadores', JSON.stringify(jogadores));
}

export function getSavedPartidas(): Partida[] {
  const json = localStorage.getItem('futebol_partidas');
  if (!json) {
    localStorage.setItem('futebol_partidas', JSON.stringify(INITIAL_PARTIDAS));
    return INITIAL_PARTIDAS;
  }
  return JSON.parse(json);
}

export function savePartidas(partidas: Partida[]) {
  localStorage.setItem('futebol_partidas', JSON.stringify(partidas));
}

export function getSavedPagamentos(): Pagamento[] {
  const json = localStorage.getItem('futebol_pagamentos');
  if (!json) {
    localStorage.setItem('futebol_pagamentos', JSON.stringify(INITIAL_PAGAMENTOS));
    return INITIAL_PAGAMENTOS;
  }
  return JSON.parse(json);
}

export function savePagamentos(pagamentos: Pagamento[]) {
  localStorage.setItem('futebol_pagamentos', JSON.stringify(pagamentos));
}

export function getSavedLancamentos(): any[] {
  const json = localStorage.getItem('futebol_lancamentos_caixa');
  if (!json) {
    return [];
  }
  return JSON.parse(json);
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

