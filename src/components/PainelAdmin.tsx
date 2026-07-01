/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Jogador, Partida, Pagamento } from '../types';
import { AVATAR_PRESETS } from '../data';
import { ShieldCheck, UserPlus, Check, X, Trash2, DollarSign, Clock } from 'lucide-react';

interface PainelAdminProps {
  jogadores: Jogador[];
  partidas: Partida[];
  pagamentos: Pagamento[];
  jogadorAtual: Jogador;
  onAprovarJogador: (id: string, aprovar: boolean) => void;
  onRegistrarPagamento?: (
    jogadorId: string,
    mesRef: string,
    status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado',
    dataPagamento: string | null,
    valor: number,
    partidaId?: string
  ) => void;
}

export default function PainelAdmin({
  jogadores,
  partidas,
  pagamentos,
  jogadorAtual,
  onAprovarJogador,
  onRegistrarPagamento,
}: PainelAdminProps) {
  // Filtro de jogadores pendentes de aprovação e solicitações de exclusão de conta
  const pendentes = jogadores.filter(j => j.status === 'pendente_aprovacao' || j.status === 'solicitou_exclusao');

  // Filtro de pagamentos aguardando confirmação financeira
  const pagamentosPendentes = pagamentos.filter(p => p.status === 'pendente_confirmacao');

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* Banner Informativo */}
      <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-950 to-emerald-950/40 border border-white/10 rounded-2xl p-5 shadow-lg relative">
        <div className="p-3 bg-emerald-500/15 border border-white/10 text-emerald-400 rounded-lg shrink-0">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h2 id="titulo-admin" className="font-display font-semibold text-base text-white uppercase tracking-wider">Painel Geral de Controle (Acesso Administrativo)</h2>
          <p className="text-xs text-emerald-355 font-medium">Você está autenticado como <b>{jogadorAtual.nome} {jogadorAtual.sobrenome}</b> (Administrador).</p>
        </div>
      </div>

      <div className="w-full grid grid-cols-1 gap-6">
        
        {/* PARTE 1: APROVAÇÕES E SOLICITAÇÕES DE CADASTRO/EXCLUSÃO */}
        <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Solicitações Requerendo Aprovação ({pendentes.length})
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/25 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Cadastro e Perfil
            </span>
          </div>

          <p className="text-xs text-emerald-300/80 font-sans leading-relaxed">
            De acordo com as regras da pelada, novos cadastros e solicitações de exclusão de perfil de jogador passam pela verificação direta do administrador antes de serem consolidados definitivamente no sistema.
          </p>

          {pendentes.length === 0 ? (
            <div className="text-center py-12 bg-emerald-950/20 rounded-xl border border-dashed border-white/5 text-emerald-400 text-xs font-sans">
              Excelente! Nenhuma solicitação de acesso ou desligamento pendente no momento.
            </div>
          ) : (
            <div className="space-y-3">
              {pendentes.map((p) => {
                const avatar = AVATAR_PRESETS.find(a => a.id === p.foto) || AVATAR_PRESETS[0];
                const isExclusao = p.status === 'solicitou_exclusao';
                return (
                  <div 
                    id={`pendente-row-${p.id}`}
                    key={p.id}
                    className={`p-4 border rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
                      isExclusao 
                        ? 'bg-rose-955/20 border-rose-500/20 hover:bg-rose-955/35' 
                        : 'bg-emerald-955/40 hover:bg-emerald-955/65 border-white/5'
                    }`}
                  >
                    {/* Perfil básico */}
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/10 overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                        style={{ backgroundColor: avatar.color, color: avatar.text === '⚪' ? '#fff' : '#000' }}
                        onClick={() => {
                          if (p.foto && (p.foto.startsWith('http') || p.foto.startsWith('data:'))) {
                            (window as any).ampliarFoto?.(p.foto, `${p.nome} ${p.sobrenome}`);
                          }
                        }}
                        title={p.foto ? "Clique para ampliar a foto" : undefined}
                      >
                        {p.foto && (p.foto.startsWith('http') || p.foto.startsWith('data:')) ? (
                          <img src={p.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          p.posicao.substring(0, 1)
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap text-left">
                          <h4 className="text-xs font-bold text-white leading-none">{p.nome} {p.sobrenome}</h4>
                          {isExclusao ? (
                            <span className="text-[8px] font-black uppercase text-rose-400 bg-rose-950/60 border border-rose-500/30 px-1.5 py-0.5 rounded leading-none">
                              ⚠️ PEDIDO DE EXCLUSÃO
                            </span>
                          ) : (
                            <span className="text-[8px] font-black uppercase text-teal-400 bg-teal-950/60 border border-teal-500/30 px-1.5 py-0.5 rounded leading-none">
                              🆕 NOVO CADASTRO
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-emerald-350 font-mono mt-1 text-left">{p.email}</p>
                        
                        <div className="flex gap-1.5 mt-2">
                          <span className="text-[8px] font-extrabold uppercase font-mono bg-emerald-950/65 w-fit px-1.5 py-0.5 rounded text-emerald-300 border border-white/5">
                            🛡️ {p.posicao}
                          </span>
                          <span className="text-[8px] font-extrabold uppercase font-mono bg-emerald-950/65 w-fit px-1.5 py-0.5 rounded text-emerald-300 border border-white/5">
                            📅 {p.membroStatus}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      {isExclusao ? (
                        <>
                          <button
                            id={`btn-aprovar-exclusao-${p.id}`}
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja DEFERIR a exclusão definitiva do perfil de ${p.nome} ${p.sobrenome}? Todas as informações dele serão permanentemente deletadas.`)) {
                                onAprovarJogador(p.id, false); // Em App.tsx, aprovar=false no handleAprovarJogador exclui/remove definitivamente.
                              }
                            }}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Aprovar Exclusão
                          </button>
                          <button
                            id={`btn-rejeitar-exclusao-${p.id}`}
                            type="button"
                            onClick={() => {
                              if (confirm(`Deseja REJEITAR a solicitação de exclusão de ${p.nome} ${p.sobrenome} e mantê-lo ativo no elenco?`)) {
                                onAprovarJogador(p.id, true); // Devolve status para 'ativo'.
                              }
                            }}
                            className="bg-emerald-950 border border-white/10 text-emerald-300 hover:text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Rejeitar / Manter
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            id={`btn-aprovar-atleta-${p.id}`}
                            type="button"
                            onClick={() => onAprovarJogador(p.id, true)}
                            className="bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 shadow cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5 text-emerald-800" />
                            Aprovar
                          </button>
                          <button
                            id={`btn-negar-atleta-${p.id}`}
                            type="button"
                            onClick={() => {
                              if (confirm(`Remover solicitação de ${p.nome}?`)) {
                                onAprovarJogador(p.id, false);
                              }
                            }}
                            className="bg-emerald-950 border border-white/10 text-rose-350 hover:bg-rose-955/20 hover:text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Recusar
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* PARTE 2: APROVAÇÕES DE PAGAMENTO (CONFIRMAÇÃO FINANCEIRA) */}
        <div className="bg-emerald-900/40 border border-amber-500/20 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <DollarSign className="w-5 h-5 text-amber-400" />
              Aprovações Pendentes de Pagamento ({pagamentosPendentes.length})
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/25 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Confirmação Financeira
            </span>
          </div>

          <p className="text-xs text-emerald-300/80 font-sans leading-relaxed">
            Atletas que realizaram pagamento Pix via auto-declaração de quitação. Valide o recebimento em sua conta bancária antes de aprovar.
          </p>

          {pagamentosPendentes.length === 0 ? (
            <div className="text-center py-12 bg-emerald-950/20 rounded-xl border border-dashed border-white/5 text-emerald-400 text-xs font-sans">
              Nenhum pagamento pendente de aprovação pelo administrador no momento.
            </div>
          ) : (
            <div className="space-y-3 font-sans">
              {pagamentosPendentes.map((pag) => {
                const jogador = jogadores.find(j => j.id === pag.jogadorId);
                if (!jogador) return null;
                const avatar = AVATAR_PRESETS.find(a => a.id === jogador.foto) || AVATAR_PRESETS[0];
                const partidaObj = pag.partidaId ? partidas.find(pt => pt.id === pag.partidaId) : null;

                return (
                  <div 
                    key={pag.id}
                    className="p-4 bg-amber-950/10 border border-amber-500/10 rounded-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4 transition-all hover:bg-amber-955/15"
                  >
                    {/* Atleta e Informações */}
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/10 overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                        style={{ backgroundColor: avatar.color, color: avatar.text === '⚪' ? '#fff' : '#000' }}
                        onClick={() => {
                          if (jogador.foto && (jogador.foto.startsWith('http') || jogador.foto.startsWith('data:'))) {
                            (window as any).ampliarFoto?.(jogador.foto, `${jogador.nome} ${jogador.sobrenome}`);
                          }
                        }}
                        title={jogador.foto ? "Clique para ampliar a foto" : undefined}
                      >
                        {jogador.foto && (jogador.foto.startsWith('http') || jogador.foto.startsWith('data:')) ? (
                          <img src={jogador.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                        ) : (
                          jogador.posicao.substring(0, 1)
                        )}
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs font-bold text-white leading-none">{jogador.nome} {jogador.sobrenome}</h4>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-300 font-mono mt-1.5">
                          <span className="bg-white/5 px-1.5 py-0.5 rounded capitalize">{jogador.membroStatus}</span>
                          <span>•</span>
                          <span className="text-amber-400 font-bold">
                            {partidaObj 
                              ? `Diária Jogo: ${partidaObj.titulo} (${partidaObj.data.split('-').reverse().join('/')})` 
                              : `Mensalidade: ${pag.mesRef.split('-').reverse().join('/')}`}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Valores e Botões */}
                    <div className="flex items-center justify-between md:justify-end gap-4">
                      <div className="text-right shrink-0">
                        <span className="block font-mono font-black text-white text-xs">
                          R$ {pag.valor.toFixed(2)}
                        </span>
                        <span className="block text-[8.5px] font-bold text-amber-400 font-mono uppercase tracking-wider">
                          Pendente Confirmação
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          id={`btn-painel-confirmar-pg-${pag.id}`}
                          onClick={() => {
                            if (onRegistrarPagamento) {
                              const hojeStr = new Date().toISOString().split('T')[0];
                              onRegistrarPagamento(jogador.id, pag.mesRef, 'pago', hojeStr, pag.valor, pag.partidaId);
                            }
                          }}
                          className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[10px] rounded-lg transition-all shadow cursor-pointer uppercase tracking-wider"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          id={`btn-painel-estornar-pg-${pag.id}`}
                          onClick={() => {
                            if (onRegistrarPagamento) {
                              onRegistrarPagamento(jogador.id, pag.mesRef, 'pendente', null, pag.valor, pag.partidaId);
                            }
                          }}
                          className="py-1.5 px-3 bg-rose-950 border border-rose-500/25 hover:bg-rose-900 text-rose-300 font-bold text-[10px] rounded-lg transition-all cursor-pointer uppercase"
                        >
                          Recusar
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
