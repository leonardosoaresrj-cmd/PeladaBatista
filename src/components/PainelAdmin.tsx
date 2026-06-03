/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Jogador, Partida } from '../types';
import { AVATAR_PRESETS } from '../data';
import { ShieldCheck, UserPlus, Calendar, Check, X, AlertCircle, Play, Sparkles } from 'lucide-react';

interface PainelAdminProps {
  jogadores: Jogador[];
  partidas: Partida[];
  jogadorAtual: Jogador;
  onAprovarJogador: (id: string, aprovar: boolean) => void;
  onCriarPartida: (novaPartida: Omit<Partida, 'id' | 'confirmados' | 'recusados' | 'createdAt'>) => void;
}

export default function PainelAdmin({
  jogadores,
  partidas,
  jogadorAtual,
  onAprovarJogador,
  onCriarPartida,
}: PainelAdminProps) {
  // Filtro de jogadores pendentes de aprovação
  const pendentes = jogadores.filter(j => j.status === 'pendente_aprovacao');

  // Estado para agendamento de jogos
  const [titulo, setTitulo] = useState('');
  const [data, setData] = useState('2026-06-07');
  const [horario, setHorario] = useState('19:00');
  const [local, setLocal] = useState('');
  const [schedulerSuccess, setSchedulerSuccess] = useState(false);
  const [schedulerError, setSchedulerError] = useState('');

  const submitAgendarJogo = (e: React.FormEvent) => {
    e.preventDefault();
    setSchedulerSuccess(false);
    setSchedulerError('');

    if (!titulo.trim() || !data || !horario || !local.trim()) {
      setSchedulerError('Preencha todas as informações para agendar a partida.');
      return;
    }

    onCriarPartida({
      titulo: titulo.trim(),
      data,
      horario,
      local: local.trim(),
      criadoPor: jogadorAtual.id,
    });

    setSchedulerSuccess(true);
    setTitulo('');
    setLocal('');

    setTimeout(() => {
      setSchedulerSuccess(false);
    }, 4000);
  };

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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PARTE 1: APROVAÇÕES DE CADASTRO (Lg: 7/12) */}
        <div className="lg:col-span-7 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
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
                        className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border border-white/10 overflow-hidden"
                        style={{ backgroundColor: avatar.color, color: avatar.text === '⚪' ? '#fff' : '#000' }}
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

        {/* PARTE 2: AGENDAMENTO DE JOGO (Lg: 5/12) */}
        <div className="lg:col-span-5 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
          <div className="border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <Calendar className="w-5 h-5 text-emerald-400" />
              Agendar Nova Partida
            </h3>
            <p className="text-[11px] text-emerald-300/80 font-sans mt-0.5">Defina os detalhes locais e horários do próximo jogo.</p>
          </div>

          <form onSubmit={submitAgendarJogo} className="space-y-4">
            
            {schedulerError && (
              <div className="flex items-start gap-2 bg-rose-955/40 border border-rose-500/30 text-rose-205 text-xs p-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{schedulerError}</span>
              </div>
            )}

            {schedulerSuccess && (
              <div className="flex items-start gap-2 bg-teal-950/60 border border-teal-500/30 text-teal-200 text-xs p-2.5 rounded-lg">
                <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5 animate-bounce" />
                <span>Partida agendada e incorporada ao calendário do racha com sucesso!</span>
              </div>
            )}

            <div>
              <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">Título da Partida / Confronto</label>
              <input
                id="input-sched-titulo"
                type="text"
                required
                placeholder="Ex: Racha de Domingo Tradicional"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full bg-emerald-950 border border-white/10 text-white placeholder-emerald-400/50 rounded-lg p-2.5 text-xs focus:outline-none focus:border-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">Data do Jogo</label>
                <input
                  id="input-sched-data"
                  type="date"
                  required
                  value={data}
                  onChange={(e) => setData(e.target.value)}
                  className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">Horário de Início</label>
                <input
                  id="input-sched-hora"
                  type="time"
                  required
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">Local da Arena / Quadra</label>
              <input
                id="input-sched-local"
                type="text"
                required
                placeholder="Ex: Arena Society Verde - Campo 1"
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                className="w-full bg-emerald-950 border border-white/10 text-white placeholder-emerald-400/50 rounded-lg p-2.5 text-xs focus:outline-none focus:border-white"
              />
            </div>

            <button
              id="btn-sched-submit"
              type="submit"
              className="w-full bg-white hover:bg-emerald-50 text-emerald-950 font-bold text-xs py-2.5 rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-emerald-950" />
              Agendar e Divulgar Partida
            </button>
          </form>
        </div>

      </div>

    </div>
  );
}
