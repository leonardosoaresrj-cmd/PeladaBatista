/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Jogador, Pagamento } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Users, Search, UserCheck, Award, Star, Mail, Calendar } from 'lucide-react';

interface MensalistasMesProps {
  jogadores: Jogador[];
  pagamentos: Pagamento[];
  jogadorAtual: Jogador;
  onRegistrarPagamento: (jogadorId: string, mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao', dataPagamento: string | null, valor: number) => void;
}

export default function MensalistasMes({
  jogadores,
  pagamentos,
  jogadorAtual,
  onRegistrarPagamento,
}: MensalistasMesProps) {
  const [filtroPesquisa, setFiltroPesquisa] = useState('');

  // Filtrar apenas mensalistas cadastrados e ativos
  const mensalistasAtivos = jogadores.filter(
    (j) => j.membroStatus === 'mensalista' && j.status === 'ativo'
  );

  // Filtrar pela busca (nome/sobrenome)
  const mensalistasFiltrados = mensalistasAtivos.filter((jogador) => {
    const nomeCompleto = `${jogador.nome} ${jogador.sobrenome}`.toLowerCase();
    return nomeCompleto.includes(filtroPesquisa.toLowerCase()) || 
           jogador.posicao.toLowerCase().includes(filtroPesquisa.toLowerCase());
  });

  const getAvatarProps = (presetId: string) => {
    const preset = AVATAR_PRESETS.find((p) => p.id === presetId);
    return preset || { color: '#047857', text: '⚪' };
  };

  // Agrupamento por posição
  const posicoesOrdem: { key: 'Goleiro' | 'Defesa' | 'Meio' | 'Ataque'; label: string; icon: string; cor: string }[] = [
    { key: 'Goleiro', label: 'Goleiros', icon: '🧤', cor: 'from-blue-500/10 to-transparent' },
    { key: 'Defesa', label: 'Defensores', icon: '🛡️', cor: 'from-emerald-500/10 to-transparent' },
    { key: 'Meio', label: 'Meio-Campistas', icon: '🧠', cor: 'from-amber-500/10 to-transparent' },
    { key: 'Ataque', label: 'Atacantes', icon: '🚀', cor: 'from-rose-500/10 to-transparent' },
  ];

  return (
    <div id="container-mensalistas-mes" className="space-y-6 w-full animate-fade-in">
      
      {/* Cabeçalho */}
      <div id="header-mensalistas" className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h2 id="titulo-mensalistas-mes" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            Mensalistas Ativos da Temporada
          </h2>
          <p className="text-xs text-emerald-300/85 font-sans mt-0.5">
            Membros oficiais e vitalícios que compõem o elenco da pelada Arena Record.
          </p>
        </div>

        {/* Estatísticas Simples (Sem finanças!) */}
        <div className="flex items-center gap-3 bg-emerald-950/65 px-4 py-2 border border-white/5 rounded-xl self-start md:self-auto">
          <Users className="w-4 h-4 text-emerald-400" />
          <div className="text-xs">
            <span className="text-emerald-300 font-sans">Elenco Oficial: </span>
            <strong className="text-white font-mono">{mensalistasAtivos.length} Atletas</strong>
          </div>
        </div>
      </div>

      {/* Caixa de Busca */}
      <div id="filtros-busca-mensalistas" className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-500" />
        <input
          id="input-pesquisa-mensalistas"
          type="text"
          placeholder="Buscar no elenco oficial por nome ou posição..."
          value={filtroPesquisa}
          onChange={(e) => setFiltroPesquisa(e.target.value)}
          className="w-full bg-emerald-950/45 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-emerald-600 hover:border-emerald-500/50 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all font-sans"
        />
      </div>

      {/* Agrupamento por Posições */}
      <div className="space-y-8">
        {posicoesOrdem.map((pos) => {
          const jogadoresDaPosicao = mensalistasFiltrados.filter(j => j.posicao === pos.key);
          
          if (jogadoresDaPosicao.length === 0 && filtroPesquisa !== '') return null;

          return (
            <div key={pos.key} className="space-y-3">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <span className="text-lg select-none">{pos.icon}</span>
                <h3 className="font-display font-black text-sm text-white uppercase tracking-wider">
                  {pos.label} ({jogadoresDaPosicao.length})
                </h3>
              </div>

              {jogadoresDaPosicao.length === 0 ? (
                <p className="text-xs text-emerald-500 italic font-sans pl-2">
                  Nenhum mensalista cadastrado nesta posição.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {jogadoresDaPosicao.map((jogador) => {
                    const avatar = getAvatarProps(jogador.foto);
                    const isGold = jogador.isGold;

                    return (
                      <div
                        id={`cartao-mensalista-${jogador.id}`}
                        key={jogador.id}
                        className={`border rounded-2xl p-4 flex flex-col justify-between transition-all shadow-md relative overflow-hidden ${
                          isGold
                            ? 'border-amber-500/45 bg-gradient-to-b from-amber-500/10 via-emerald-950/20 to-emerald-950/30'
                            : 'border-white/10 bg-emerald-950/20 hover:border-white/20'
                        }`}
                      >
                        {/* Indicador superior de status Gold */}
                        {isGold && (
                          <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-500 to-yellow-600 text-[9px] font-black uppercase text-black px-2.5 py-0.5 rounded-bl-xl flex items-center gap-1 shadow">
                            <Award className="w-3 h-3 text-black" fill="currentColor" />
                            <span>Gold 🏅</span>
                          </div>
                        )}

                        <div className="space-y-3.5">
                          <div className="flex items-center gap-3">
                            {/* Avatar com bordas douradas para Gold */}
                            <div
                              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 shadow-lg overflow-hidden relative border-2 ${
                                isGold ? 'border-amber-400 animate-pulse' : 'border-emerald-500/20'
                              }`}
                              style={{ backgroundColor: avatar.color }}
                            >
                              {jogador.foto && (jogador.foto.startsWith('http') || jogador.foto.startsWith('data:')) ? (
                                <img src={jogador.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                              ) : (
                                pos.icon
                              )}
                            </div>
                            <div className="min-w-0 pr-8">
                              <h4 className="text-sm font-extrabold text-white truncate leading-snug flex items-center gap-1">
                                {jogador.nome} {jogador.sobrenome}
                              </h4>
                              <p className="text-[10px] text-emerald-400 font-sans tracking-wide mt-0.5">
                                {pos.key === 'Goleiro' ? '🧤 Goleiro Oficial' : pos.key === 'Defesa' ? '🛡️ Defensor do Quadro' : pos.key === 'Meio' ? '🧠 Meio-Campista de Linha' : '🚀 Atacante do Elenco'}
                              </p>
                            </div>
                          </div>

                          {/* Detalhes do Perfil Sem Finanças */}
                          <div className="space-y-1.5 border-t border-white/5 pt-3 text-[11px] text-emerald-250">
                            <div className="flex items-center justify-between">
                              <span className="flex items-center gap-1 text-emerald-400/80"><Mail className="w-3.5 h-3.5 text-emerald-500" /> E-mail:</span>
                              <span className="font-mono text-white truncate max-w-40" title={jogador.email}>{jogador.email}</span>
                            </div>
                            {jogador.dataNascimento && (
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1 text-emerald-400/80"><Calendar className="w-3.5 h-3.5 text-emerald-500" /> Nascimento:</span>
                                <span className="font-mono text-white">
                                  {jogador.dataNascimento.split('-').reverse().join('/')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Distinção Visual Adicional se Gold */}
                        {isGold && (
                          <div className="mt-3.5 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2 text-center">
                            <span className="text-[10px] font-black text-amber-300 tracking-wider flex items-center justify-center gap-1 uppercase">
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                              Destaque da Temporada
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Mensagem se tudo filtrado */}
      {mensalistasFiltrados.length === 0 && (
        <div className="bg-emerald-950/15 border border-white/5 rounded-2xl py-12 px-4 text-center space-y-2">
          <Users className="w-8 h-8 text-emerald-500/50 mx-auto" />
          <h4 className="text-white font-bold text-sm">Nenhum mensalista para a pesquisa atual</h4>
          <p className="text-xs text-emerald-400 max-w-md mx-auto">
            Por favor, verifique os termos digitados na busca para encontrar atletas mensais.
          </p>
        </div>
      )}

    </div>
  );
}
