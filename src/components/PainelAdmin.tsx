/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Jogador, Partida } from '../types';
import { AVATAR_PRESETS } from '../data';
import { ShieldCheck, UserPlus, Check, X } from 'lucide-react';

interface PainelAdminProps {
  jogadores: Jogador[];
  partidas: Partida[];
  jogadorAtual: Jogador;
  onAprovarJogador: (id: string, aprovar: boolean) => void;
}

export default function PainelAdmin({
  jogadores,
  jogadorAtual,
  onAprovarJogador,
}: PainelAdminProps) {
  // Filtro de jogadores pendentes de aprovação
  const pendentes = jogadores.filter(j => j.status === 'pendente_aprovacao');

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

      <div className="w-full">
        
        {/* PARTE 1: APROVAÇÕES DE CADASTRO */}
        <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              Solicitações de Acesso Pendentes ({pendentes.length})
            </h3>
            <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 border border-amber-500/25 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Aprovação Requerida
            </span>
          </div>

          <p className="text-xs text-emerald-300/80 font-sans leading-relaxed">
            De acordo com o regulamento do portal, novos atletas solicitam acesso informando seus dados básicos, porém dependem da autorização direta da gerência para logar e participar da confirmação de jogos.
          </p>

          {pendentes.length === 0 ? (
            <div className="text-center py-12 bg-emerald-950/20 rounded-xl border border-dashed border-white/5 text-emerald-400 text-xs">
              Excelente! Nenhuma solicitação pendente no momento. Todo o elenco está regularizado.
            </div>
          ) : (
            <div className="space-y-3">
              {pendentes.map((p) => {
                const avatar = AVATAR_PRESETS.find(a => a.id === p.foto) || AVATAR_PRESETS[0];
                return (
                  <div 
                    id={`pendente-row-${p.id}`}
                    key={p.id}
                    className="p-4 bg-emerald-955/40 hover:bg-emerald-955/65 border border-white/5 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all"
                  >
                    {/* Perfil básico */}
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border border-white/10 overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
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
                        <h4 className="text-xs font-bold text-white leading-none">{p.nome} {p.sobrenome}</h4>
                        <p className="text-[10px] text-emerald-350 font-mono mt-1">{p.email}</p>
                        
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
                      <button
                        id={`btn-aprovar-atleta-${p.id}`}
                        type="button"
                        onClick={() => onAprovarJogador(p.id, true)}
                        className="bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1 shadow"
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
                        className="bg-emerald-950 border border-white/10 text-rose-350 hover:bg-rose-955/20 hover:text-white font-bold text-xs px-3.5 py-2 rounded-lg transition-colors flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        Recusar
                      </button>
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
