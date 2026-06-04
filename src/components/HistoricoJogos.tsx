/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Jogador, Partida } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Calendar, Users, MapPin, Clock, Search, HelpCircle, Award, Shield, User, CircleDot, Trash2 } from 'lucide-react';

interface HistoricoJogosProps {
  partidas: Partida[];
  jogadores: Jogador[];
  jogadorAtual: Jogador;
  onDeletarPartida?: (id: string) => void;
}

export default function HistoricoJogos({
  partidas,
  jogadores,
  jogadorAtual,
  onDeletarPartida,
}: HistoricoJogosProps) {
  const [mesSelecionado, setMesSelecionado] = useState('2026-05');
  const [buscaNome, setBuscaNome] = useState('');
  const [idConfirmacaoExclusao, setIdConfirmacaoExclusao] = useState<string | null>(null);

  // Formatar data em formato amigável (Dia, DD/MM/AAAA)
  const formatarDataAmigavel = (dataStr: string) => {
    try {
      const partes = dataStr.split('-');
      if (partes.length !== 3) return dataStr;
      const dataObj = new Date(Number(partes[0]), Number(partes[1]) - 1, Number(partes[2]));
      const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const diaSemana = diasSemana[dataObj.getDay()];
      return `${diaSemana}, ${partes[2]}/${partes[1]}/${partes[0]}`;
    } catch {
      return dataStr;
    }
  };

  // Filtrar partidas do mês selecionado
  const partidasDoMes = partidas.filter((p) => p.data.startsWith(mesSelecionado));

  // Ordenar as partidas - Mais antigas primeiro ou mais recentes primeiro?
  // Mais recentes primeiro costuma ser melhor para histórico, mas vamos ordenar por data de jogo decrescente (ou crescente)
  const partidasOrdenadas = [...partidasDoMes].sort((a, b) => b.data.localeCompare(a.data));

  // Função auxiliar para extrair jogadores confirmados em uma partida e classificar por Mensalistas / Diaristas
  const obterParticipantes = (partida: Partida) => {
    const confirmadosIds = partida.confirmados || [];
    
    const confirmadosJogadores = confirmadosIds
      .map((id) => jogadores.find((j) => j.id === id))
      .filter((j): j is Jogador => !!j && j.status === 'ativo');

    // Filtro por termo de busca caso o usuário digite um nome
    const filtradosPorBusca = confirmadosJogadores.filter((j) => {
      if (!buscaNome) return true;
      const nomeCompleto = `${j.nome} ${j.sobrenome}`.toLowerCase();
      return nomeCompleto.includes(buscaNome.toLowerCase()) || j.posicao.toLowerCase().includes(buscaNome.toLowerCase());
    });

    const mensalistas = filtradosPorBusca.filter((j) => j.membroStatus === 'mensalista');
    const diaristas = filtradosPorBusca.filter((j) => j.membroStatus === 'diarista');

    return {
      mensalistas,
      diaristas,
      totalGeral: confirmadosJogadores.length,
      totalMostrados: filtradosPorBusca.length,
    };
  };

  const getAvatarProps = (presetId: string) => {
    const preset = AVATAR_PRESETS.find((p) => p.id === presetId);
    return preset || { color: '#047857', text: '⚪' };
  };

  // Estatísticas de participação geral no mês selecionado
  const todasPartidasConfirmados = partidasDoMes.flatMap((p) => p.confirmados || []);
  const totalParticipacoesEmPartidas = todasPartidasConfirmados.length;
  
  // Jogadores únicos que participaram de pelo menos 1 jogo no mês
  const jogadoresUnicosIds = Array.from(new Set(todasPartidasConfirmados));
  const jogadoresUnicosAtivos = jogadoresUnicosIds
    .map((id) => jogadores.find((j) => j.id === id))
    .filter((j): j is Jogador => !!j);
  
  const totalMensalistasUnicos = jogadoresUnicosAtivos.filter((j) => j.membroStatus === 'mensalista').length;
  const totalDiaristasUnicos = jogadoresUnicosAtivos.filter((j) => j.membroStatus === 'diarista').length;

  return (
    <div id="container-historico-jogos" className="space-y-6 w-full animate-fade-in">
      
      {/* Cabeçalho */}
      <div id="header-historico" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h2 id="titulo-historico" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Histórico Mensal de Partidas
          </h2>
          <p className="text-xs text-emerald-300/85 font-sans mt-0.5">
            Visualize a lista de escalados, mensalistas e diaristas que jogaram em cada data programada.
          </p>
        </div>

        {/* Seletor do Mês de Referência */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-sans shrink-0">Mês da Temporada:</label>
          <select
            id="select-mes-historico"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="bg-emerald-950 border border-white/10 text-white text-xs font-bold font-mono rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-white"
          >
            <option className="bg-emerald-955 text-white" value="2026-05">Maio / 2026</option>
            <option className="bg-emerald-955 text-white" value="2026-06">Junho / 2026</option>
          </select>
        </div>
      </div>

      {/* Painel de Métricas do Mês */}
      <div id="metricas-historico" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total de Jogos */}
        <div className="bg-emerald-950/40 border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="w-10 h-10 rounded-xl bg-teal-950/60 border border-teal-500/25 text-teal-400 flex items-center justify-center font-mono font-bold">
            <CircleDot className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-300 uppercase font-sans font-bold tracking-widest leading-none">Jogos Realizados</p>
            <h4 className="text-xl font-mono font-bold text-white mt-1">{partidasDoMes.length}</h4>
            <p className="text-[9px] text-emerald-400 mt-0.5">Partidas programadas no mês</p>
          </div>
        </div>

        {/* Mensalistas Participantes */}
        <div className="bg-emerald-950/40 border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/25 text-emerald-400 flex items-center justify-center font-mono font-bold">
            <Users className="w-5 h-5 text-teal-400" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-300 uppercase font-sans font-bold tracking-widest leading-none">Mensalistas Convocados</p>
            <h4 className="text-xl font-mono font-bold text-white mt-1">{totalMensalistasUnicos}</h4>
            <p className="text-[9px] text-emerald-400 mt-0.5">Jogadores titulares atuando</p>
          </div>
        </div>

        {/* Diaristas Participantes */}
        <div className="bg-emerald-950/40 border border-white/10 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/25 text-amber-400 flex items-center justify-center font-mono font-bold">
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] text-emerald-300 uppercase font-sans font-bold tracking-widest leading-none">Diaristas / Convidados</p>
            <h4 className="text-xl font-mono font-bold text-white mt-1">{totalDiaristasUnicos}</h4>
            <p className="text-[9px] text-emerald-400 mt-0.5">Diaristas atuantes no mês</p>
          </div>
        </div>
      </div>

      {/* Caixa de Pesquisa em Escalação */}
      <div id="busca-historico-div" className="relative w-full">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-450" />
        <input
          id="input-pesquisa-historico"
          type="text"
          placeholder="Pesquisar se jogador específico integrou as listas nesta temporada de jogos..."
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          className="w-full bg-emerald-950/45 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-emerald-500 hover:border-emerald-500 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all font-sans"
        />
      </div>

      {/* Relação de Jogos e Convocados por Data */}
      {partidasOrdenadas.length === 0 ? (
        <div className="bg-emerald-950/15 border border-white/5 rounded-2xl py-12 px-4 text-center space-y-2">
          <HelpCircle className="w-8 h-8 text-emerald-500/70 mx-auto" />
          <h4 className="text-white font-bold text-sm">Nenhuma pelada registrada no mês</h4>
          <p className="text-xs text-emerald-400 max-w-md mx-auto">
            Não há histórico de partidas para o mês selecionado. Caso seja administrador, você pode registrar novos eventos no Painel do Administrador.
          </p>
        </div>
      ) : (
        <div id="deck-jogos-historico" className="space-y-6">
          {partidasOrdenadas.map((partida) => {
            const { mensalistas, diaristas, totalGeral, totalMostrados } = obterParticipantes(partida);
            const totalJogadoresMatch = mensalistas.length + diaristas.length;

            return (
              <div
                id={`historico-partida-${partida.id}`}
                key={partida.id}
                className="bg-emerald-950/40 border border-white/10 rounded-2xl p-5 space-y-4 hover:bg-emerald-950/60 transition-all shadow-lg"
              >
                {/* Informações Primárias do Jogo */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-white/10 pb-4 gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="bg-emerald-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                        CONVOCADOS REGISTRADOS
                      </span>
                      <span className="text-[10px] text-emerald-300 font-mono">
                        ID Evento: #{partida.id.substring(0, 8)}
                      </span>
                    </div>
                    <h3 className="font-display font-extrabold text-white text-base leading-snug">
                      {partida.titulo}
                    </h3>
                  </div>

                  {/* Informações de Local e Hora */}
                  <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-250 font-sans sm:text-right sm:justify-end">
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-semibold text-white">{formatarDataAmigavel(partida.data)}</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5">
                      <Clock className="w-3.5 h-3.5 text-teal-400" />
                      <span className="font-semibold text-white">{partida.horario}h</span>
                    </div>
                    <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2.5 py-1.5 border border-white/5 animate-pulse-fade">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span className="text-white truncate max-w-36">{partida.local}</span>
                    </div>

                    {jogadorAtual?.role === 'admin' && onDeletarPartida && (
                      <div className="flex items-center shrink-0">
                        {idConfirmacaoExclusao === partida.id ? (
                          <div className="flex items-center gap-1.5 bg-rose-950/80 border border-rose-500/30 rounded-lg p-1 animate-fade-in">
                            <span className="text-[9px] text-rose-300 font-bold px-1 uppercase tracking-wider">Excluir?</span>
                            <button
                              id={`btn-confirm-delete-game-${partida.id}`}
                              type="button"
                              onClick={() => {
                                onDeletarPartida(partida.id);
                                setIdConfirmacaoExclusao(null);
                              }}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-[9px] font-bold px-2 py-1 rounded transition-all cursor-pointer uppercase"
                            >
                              Sim
                            </button>
                            <button
                              type="button"
                              onClick={() => setIdConfirmacaoExclusao(null)}
                              className="bg-white/15 hover:bg-white/20 text-white text-[9px] font-bold px-2 py-1 rounded transition-all cursor-pointer uppercase"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`btn-delete-game-${partida.id}`}
                            type="button"
                            onClick={() => setIdConfirmacaoExclusao(partida.id)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/35 hover:border-rose-500/60 text-rose-400 hover:text-white transition-all cursor-pointer group"
                            title="Excluir do histórico"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Sub-Header com Placar de Convocação */}
                <div className="flex items-center justify-between text-xs text-emerald-200 bg-emerald-950/80 px-3.5 py-2 rounded-xl border border-white/5">
                  <div className="font-semibold">
                    Jogadores Atuantes: <span className="text-white font-mono font-bold text-sm">{totalJogadoresMatch}</span>
                  </div>
                  <div className="text-[10px] font-mono text-emerald-450 uppercase tracking-wider">
                    {mensalistas.length} Mensalistas | {diaristas.length} Diaristas
                  </div>
                </div>

                {/* Relação Detalhada por Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                  
                  {/* Coluna de Mensalistas */}
                  <div className="space-y-2.5">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-300 flex items-center justify-between">
                      <span>🛡️ Mensalistas ({mensalistas.length})</span>
                      <span className="h-px bg-white/10 flex-grow ml-3"></span>
                    </h4>

                    {mensalistas.length === 0 ? (
                      <p className="text-[10px] text-emerald-400/80 italic py-1 pl-1">
                        Nenhum mensalista confirmado nesta data.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                        {mensalistas.map((j) => {
                          const av = getAvatarProps(j.foto);
                          return (
                            <div
                              key={j.id}
                              className="flex items-center gap-2.5 bg-black/20 border border-white/5 rounded-xl p-2.5 hover:border-emerald-500/20 transition-all font-sans"
                            >
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 overflow-hidden"
                                style={{ backgroundColor: av.color }}
                              >
                                {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                                  <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate leading-none flex items-center gap-1">
                                  <span>{j.nome} {j.sobrenome.substring(0, 1)}.</span>
                                  {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                                </p>
                                <p className="text-[9px] text-emerald-400/80 mt-0.5 font-sans truncate">
                                  {j.posicao === 'Goleiro' ? '🧤 Goleiro' : j.posicao === 'Defesa' ? '🛡️ Defesa' : j.posicao === 'Meio' ? '🧠 Meio' : '🚀 Ataque'} • Mensal
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Coluna de Diaristas / Convidados */}
                  <div className="space-y-2.5">
                    <h4 className="text-[11px] font-extrabold uppercase tracking-widest text-teal-300 flex items-center justify-between">
                      <span>⚡ Diaristas ({diaristas.length})</span>
                      <span className="h-px bg-white/10 flex-grow ml-3"></span>
                    </h4>

                    {diaristas.length === 0 ? (
                      <p className="text-[10px] text-emerald-400/80 italic py-1 pl-1">
                        Nenhum diarista (avulso) confirmado nesta data.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-sans">
                        {diaristas.map((j) => {
                          const av = getAvatarProps(j.foto);
                          return (
                            <div
                              key={j.id}
                              className="flex items-center gap-2.5 bg-black/20 border border-white/5 rounded-xl p-2.5 hover:border-emerald-500/20 transition-all font-sans"
                            >
                              <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 overflow-hidden"
                                style={{ backgroundColor: av.color }}
                              >
                                {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                                  <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'
                                )}
                              </div>
                              <div className="min-w-0 font-sans">
                                <p className="text-xs font-bold text-white truncate leading-none flex items-center gap-1">
                                  <span>{j.nome} {j.sobrenome.substring(0, 1)}.</span>
                                  {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                                </p>
                                <p className="text-[9px] text-emerald-400/80 mt-0.5 font-sans truncate">
                                  {j.posicao === 'Goleiro' ? '🧤 Goleiro' : j.posicao === 'Defesa' ? '🛡️ Defesa' : j.posicao === 'Meio' ? '🧠 Meio' : '🚀 Ataque'} • Avulso
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                </div>

                {/* Footer do Card com alertas de preenchimento mínimo */}
                <div className="text-[10px] text-emerald-400/70 text-right pt-2 border-t border-white/5 flex items-center justify-between">
                  <span className="font-mono">
                    {totalGeral >= 12 ? '⚽ Elenco ideal ativo' : '⚠️ Sobram vagas para completar a pelada'}
                  </span>
                  <span>{totalGeral} confirmados no total</span>
                </div>

              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
