/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Jogador, Partida, Pagamento } from './types';

// Carregar URL e Key salvas no LocalStorage ou providas no ambiente
export function obterCredenciaisSupabase() {
  const url = localStorage.getItem('supabase_url_config') || 'https://futebol-arena-manager.supabase.co';
  const key = localStorage.getItem('supabase_key_config') || '';
  const isCustom = !!localStorage.getItem('supabase_key_config');
  return { url, key, isCustom };
}

export function salvarCredenciaisSupabase(url: string, key: string) {
  localStorage.setItem('supabase_url_config', url);
  localStorage.setItem('supabase_key_config', key);
}

export function removerCredenciaisSupabase() {
  localStorage.removeItem('supabase_url_config');
  localStorage.removeItem('supabase_key_config');
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, key } = obterCredenciaisSupabase();
  if (!url || !key || key.includes('...')) {
    return null;
  }
  
  try {
    if (!supabaseInstance) {
      supabaseInstance = createClient(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
    }
    return supabaseInstance;
  } catch (error) {
    console.warn('Erro ao instanciar cliente do Supabase:', error);
    return null;
  }
}

// ----- ROTINAS DE SINCRONIZAÇÃO DE GRANDE PORTTE -----

/**
 * Cadastrar ou atualizar jogador no Supabase
 */
export async function salvarJogadorNoSupabase(jogador: Jogador): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    // Mapear de camelCase para snake_case esperado no Postgres do usuário
    const record = {
      // Usar o id diretamente se for formato uuid, caso contrário o Supabase gera ou o Postgres lida
      nome: jogador.nome,
      sobrenome: jogador.sobrenome,
      posicao: jogador.posicao,
      data_nascimento: jogador.dataNascimento,
      foto: jogador.foto,
      membro_status: jogador.membroStatus,
      email: jogador.email,
      senha: jogador.senha,
      status: jogador.status,
      role: jogador.role,
      is_gold: jogador.isGold,
    };

    // Verificar se já existe jogador com este email
    const { data: existente } = await supabase
      .from('jogadores')
      .select('id')
      .eq('email', jogador.email)
      .maybeSingle();

    if (existente) {
      const { error } = await supabase
        .from('jogadores')
        .update(record)
        .eq('id', existente.id);
      
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('jogadores')
        .insert({
          ...record,
          id: jogador.id.startsWith('jog-') ? undefined : jogador.id // Se for ID temporário, deixa o Supabase gerar uuid
        });
      
      if (error) throw error;
    }
    return true;
  } catch (error) {
    console.error('Erro ao sincronizar jogador no Supabase:', error);
    return false;
  }
}

/**
 * Carregar elenco de jogadores do Supabase
 */
export async function carregarJogadoresDoSupabase(): Promise<Jogador[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('jogadores')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    // Mapear de volta para o formato camelCase do frontend
    return data.map((d: any) => ({
      id: d.id,
      nome: d.nome,
      sobrenome: d.sobrenome,
      posicao: d.posicao,
      dataNascimento: d.data_nascimento,
      foto: d.foto || 'jersey-red',
      membroStatus: d.membro_status,
      email: d.email,
      senha: d.senha,
      status: d.status,
      role: d.role,
      createdAt: d.created_at,
      isGold: d.is_gold
    }));
  } catch (error) {
    console.error('Erro ao buscar jogadores do Supabase:', error);
    return null;
  }
}

/**
 * Salvar nova Partida no Supabase
 */
export async function salvarPartidaNoSupabase(partida: Partida): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const record = {
      titulo: partida.titulo,
      data: partida.data,
      horario: partida.horario,
      local: partida.local,
      cancelada: partida.cancelada || false,
      created_at: partida.createdAt
    };

    let partidaId = partida.id;

    if (partida.id.startsWith('part-')) {
      // É local, vamo fazer insert e pegar o id gerado
      const { data, error } = await supabase
        .from('partidas')
        .insert(record)
        .select('id')
        .single();
      
      if (error) throw error;
      partidaId = data.id;
    } else {
      // Já é UUID
      const { error } = await supabase
        .from('partidas')
        .upsert({ id: partidaId, ...record });
      
      if (error) throw error;
    }

    // Sincronizar as presenças confirmadas e recusadas
    if (partidaId) {
      await sincronizarPresencasNoSupabase(partidaId, partida.confirmados, true);
      await sincronizarPresencasNoSupabase(partidaId, partida.recusados, false);
    }
    return true;
  } catch (error) {
    console.error('Erro ao salvar partida no Supabase:', error);
    return false;
  }
}

/**
 * Sincroniza tabela presencas para respectiva partida
 */
async function sincronizarPresencasNoSupabase(partidaId: string, jogadoresIds: string[], confirmado: boolean) {
  const supabase = getSupabase();
  if (!supabase || jogadoresIds.length === 0) return;

  try {
    for (const jogadorId of jogadoresIds) {
      // Ignorar IDs simulados se não forem uuid válidos (emails, etc.)
      if (jogadorId.startsWith('admin-') || jogadorId.startsWith('jog-')) {
        continue;
      }
      
      const { error } = await supabase
        .from('presencas')
        .upsert({
          partida_id: partidaId,
          jogador_id: jogadorId,
          confirmado: confirmado,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'partida_id,jogador_id'
        });

      if (error) {
        console.warn('Erro ao salvar presenca para jogador:', jogadorId, error);
      }
    }
  } catch (err) {
    console.error('Erro em sincronizarPresencasNoSupabase:', err);
  }
}

/**
 * Carregar as partidas e juntar presencas em tempo de execucao
 */
export async function carregarPartidasDoSupabase(): Promise<Partida[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    // 1. Carregar Partidas
    const { data: dbPartidas, error: pError } = await supabase
      .from('partidas')
      .select('*')
      .order('data', { ascending: false });

    if (pError) throw pError;
    if (!dbPartidas) return [];

    // 2. Carregar Presenças
    const { data: dbPresencas, error: prError } = await supabase
      .from('presencas')
      .select('partida_id, jogador_id, confirmado');

    if (prError) throw prError;

    // Mapear dados do postgres para o modelo do racha
    return dbPartidas.map((p: any) => {
      const presencasPartida = dbPresencas ? dbPresencas.filter((pr: any) => pr.partida_id === p.id) : [];
      const confirmados = presencasPartida.filter((pr: any) => pr.confirmado === true).map((pr: any) => pr.jogador_id);
      const recusados = presencasPartida.filter((pr: any) => pr.confirmado === false).map((pr: any) => pr.jogador_id);

      return {
        id: p.id,
        titulo: p.titulo,
        data: p.data,
        horario: p.horario ? (p.horario.includes(':00') && p.horario.length === 8 ? p.horario.substring(0, 5) : p.horario) : '',
        local: p.local,
        confirmados,
        recusados,
        criadoPor: p.criado_por || '',
        createdAt: p.created_at,
        cancelada: p.cancelada || false
      };
    });

  } catch (error) {
    console.error('Erro ao buscar partidas do Supabase:', error);
    return null;
  }
}

/**
 * Salvar registro de pagamento no Supabase
 */
export async function salvarPagamentoNoSupabase(pagamento: Pagamento): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    // Ignorar se id do jogador for simulado (somente aceita uuid de jogadores reais)
    if (pagamento.jogadorId.startsWith('admin-') || pagamento.jogadorId.startsWith('jog-')) {
      return false;
    }

    const record = {
      jogador_id: pagamento.jogadorId,
      mes_ref: pagamento.mesRef,
      status: pagamento.status,
      data_pagamento: pagamento.dataPagamento ? `${pagamento.dataPagamento}T12:00:00Z` : null,
      valor: pagamento.valor,
    };

    const { error } = await supabase
      .from('pagamentos')
      .upsert(record, {
        onConflict: 'jogador_id,mes_ref' // De acordo com restrição do schema SQL
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Erro ao salvar pagamento no Supabase:', error);
    return false;
  }
}

export async function carregarPagamentosDoSupabase(): Promise<Pagamento[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('pagamentos')
      .select('*');

    if (error) throw error;
    if (!data) return [];

    return data.map((d: any) => ({
      id: d.id,
      jogadorId: d.jogador_id,
      mesRef: d.mes_ref,
      status: d.status,
      dataPagamento: d.data_pagamento ? d.data_pagamento.substring(0, 10) : null,
      valor: Number(d.valor)
    }));
  } catch (error) {
    console.error('Erro ao buscar pagamentos do Supabase:', error);
    return null;
  }
}
