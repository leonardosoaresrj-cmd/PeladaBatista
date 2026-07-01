/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Jogador, Partida, Pagamento, BotLog } from './types';

// ── Credenciais padrão embutidas no código ─────────────────────────────────
// A anon key é PÚBLICA por design — feita para ficar no frontend.
// A proteção dos dados vem das regras RLS do Supabase, não do sigilo da chave.
// Com as credenciais embutidas, QUALQUER navegador/dispositivo conecta
// ao Supabase sem depender de configuração local no localStorage.
const SUPABASE_URL_PADRAO  = 'https://gqasacnaubkhokqyrpwc.supabase.co';
const SUPABASE_ANON_KEY    = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxYXNhY25hdWJraG9rcXlycHdjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTIzOTAsImV4cCI6MjA5NjA2ODM5MH0.rRgF_yoLeVRVg9eK_VSKSnBUkf7MXaY1yJAlvWBEfzQ';

export function obterCredenciaisSupabase() {
  const customUrl = localStorage.getItem('supabase_url_config');
  const customKey = localStorage.getItem('supabase_key_config');
  
  const isUrlValid = customUrl && customUrl.trim() !== '' && customUrl.trim() !== 'null' && customUrl.trim() !== 'undefined' && !customUrl.includes('your-supabase-url');
  const isKeyValid = customKey && customKey.trim() !== '' && customKey.trim() !== 'null' && customKey.trim() !== 'undefined' && !customKey.includes('your-anon-key') && !customKey.includes('COLE_SUA_ANON_KEY_AQUI');

  if (isUrlValid && isKeyValid) {
    return { url: customUrl!.trim(), key: customKey!.trim(), isCustom: true };
  }
  
  return { url: SUPABASE_URL_PADRAO, key: SUPABASE_ANON_KEY, isCustom: false };
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
let supabaseInstanceUrl: string | null = null;

export function getSupabase(): SupabaseClient | null {
  const { url, key } = obterCredenciaisSupabase();
  const isUrlValid = url && url.trim() !== '' && url.trim() !== 'null' && url.trim() !== 'undefined' && !url.includes('your-supabase-url');
  const isKeyValid = key && key.trim() !== '' && key.trim() !== 'null' && key.trim() !== 'undefined' && !key.includes('your-anon-key') && !key.includes('COLE_SUA_ANON_KEY_AQUI');

  if (!isUrlValid || !isKeyValid) {
    return null;
  }

  try {
    // Reseta o singleton se a URL mudar (troca de projeto Supabase)
    if (supabaseInstance && supabaseInstanceUrl !== url) {
      supabaseInstance = null;
    }
    if (!supabaseInstance) {
      supabaseInstance    = createClient(url, key, {
        auth: {
          persistSession:   false,
          autoRefreshToken: false,
        },
      });
      supabaseInstanceUrl = url;
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
    console.warn('Erro ao sincronizar jogador no Supabase:', error);
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
    console.warn('Erro ao buscar jogadores do Supabase:', error);
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
    // DELETADO PARA EVITAR BULK UPSERTS EXPLODINDO WEBHOOKS DO BOT
    // if (partidaId) {
    //   await sincronizarPresencasNoSupabase(partidaId, partida.confirmados, true);
    //   await sincronizarPresencasNoSupabase(partidaId, partida.recusados, false);
    // }
    return true;
  } catch (error) {
    console.warn('Erro ao salvar partida no Supabase:', error);
    return false;
  }
}

/**
 * Atualiza o status de presenca de um unico jogador (Ideal para Webhooks)
 */
export async function atualizarStatusPresencaUsuario(partidaId: string, jogadorId: string, confirmado: boolean | null) {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    if (confirmado === null) {
      await supabase.from('presencas')
        .delete()
        .eq('partida_id', partidaId)
        .eq('jogador_id', jogadorId);
    } else {
      await supabase.from('presencas')
        .upsert({
          partida_id: partidaId,
          jogador_id: jogadorId,
          confirmado: confirmado,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'partida_id,jogador_id'
        });
    }
  } catch (err) {
    console.warn('Erro ao atualizar presenca individual:', err);
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
    console.warn('Erro em sincronizarPresencasNoSupabase:', err);
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
    console.warn('Erro ao buscar partidas do Supabase:', error);
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

    const record: any = {
      ...(pagamento.id && !pagamento.id.startsWith('pag-') ? { id: pagamento.id } : {}),
      jogador_id: pagamento.jogadorId,
      mes_ref: pagamento.mesRef,
      status: pagamento.status,
      data_pagamento: pagamento.dataPagamento ? `${pagamento.dataPagamento}T12:00:00Z` : null,
      valor: pagamento.valor,
    };

    if (pagamento.partidaId) {
      record.partida_id = pagamento.partidaId;
    }

    const { error } = await supabase
      .from('pagamentos')
      .upsert(record, {
        onConflict: 'id'
      });

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Erro ao salvar pagamento no Supabase:', error);
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
      valor: Number(d.valor),
      partidaId: d.partida_id || undefined
    }));
  } catch (error) {
    console.warn('Erro ao buscar pagamentos do Supabase:', error);
    return null;
  }
}

/**
 * Excluir partida no Supabase
 */
export async function deletarPartidaNoSupabase(id: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('partidas')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn('Erro ao excluir partida no Supabase:', error);
    return false;
  }
}

/**
 * Obter uma configuração da tabela racha_configuracoes
 */
export async function obterConfiguracaoDoSupabase(chave: string): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('racha_configuracoes')
      .select('valor')
      .eq('chave', chave)
      .maybeSingle();

    if (error) throw error;
    return data ? data.valor : null;
  } catch (error) {
    console.warn(`Erro ao obter config ${chave} do Supabase:`, error);
    return null;
  }
}

/**
 * Salvar uma configuração na tabela racha_configuracoes
 */
export async function salvarConfiguracaoNoSupabase(chave: string, valor: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('racha_configuracoes')
      .upsert({ chave, valor, updated_at: new Date().toISOString() });

    if (error) throw error;
    return true;
  } catch (error) {
    console.warn(`Erro ao salvar config ${chave} no Supabase:`, error);
    return false;
  }
}

/**
 * Carregar Logs do Bot de WhatsApp da tabela bot_logs (com fallback para whatsapp_logs)
 */
export async function carregarBotLogsDoSupabase(): Promise<BotLog[] | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('bot_logs')
      .select('*')
      .order('enviado_em', { ascending: false })
      .limit(50);

    if (error) {
      if (error.code === '42P01') { // A tabela bot_logs não existe
        const { data: wData, error: wError } = await supabase
          .from('whatsapp_logs')
          .select('*')
          .order('data', { ascending: false })
          .limit(50);

        if (wError) throw wError;
        if (!wData) return [];

        return wData.map((d: any) => ({
          id: d.id,
          evento: d.partida || 'WhatsApp',
          tabela: d.atleta || '',
          mensagem: d.mensagem,
          enviado_em: d.data
        }));
      }
      throw error;
    }
    return data;
  } catch (err) {
    console.warn('Erro ao carregar bot_logs do Supabase:', err);
    return null;
  }
}

/**
 * Salvar um log na tabela bot_logs (com fallback para whatsapp_logs)
 */
export async function salvarBotLogNoSupabase(log: BotLog): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { id, ...supabaseLogPayload } = log;
    const { error } = await supabase.from('bot_logs').insert(supabaseLogPayload);

    if (error) {
      if (error.code === '42P01') { // A tabela bot_logs não existe
        const { error: wError } = await supabase.from('whatsapp_logs').insert({
          atleta: log.tabela || 'WhatsApp',
          partida: log.evento || '',
          mensagem: log.mensagem,
          status: log.evento?.includes('FALHA') ? 'falha' : 'sucesso',
          data: log.enviado_em || new Date().toISOString()
        });
        if (wError) throw wError;
        return true;
      }
      throw error;
    }
    return true;
  } catch (err) {
    console.warn('Erro ao salvar bot_log no Supabase:', err);
    return false;
  }
}

/**
 * Deletar todos os logs da tabela bot_logs (com fallback para whatsapp_logs)
 */
export async function limparBotLogsDoSupabase(): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('bot_logs')
      .delete()
      .neq('id', 'dummy'); // Deleta todos

    if (error) {
      if (error.code === '42P01') { // A tabela bot_logs não existe
        const { error: wError } = await supabase
          .from('whatsapp_logs')
          .delete()
          .neq('id', 'dummy');
        if (wError) throw wError;
        return true;
      }
      throw error;
    }
    return true;
  } catch (err) {
    console.warn('Erro ao limpar bot_logs:', err);
    return false;
  }
}
