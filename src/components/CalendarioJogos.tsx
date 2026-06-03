/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Partida, Jogador, Pagamento } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Calendar as CalendarIcon, MapPin, Clock, Users, ArrowUpRight, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, PlusCircle } from 'lucide-react';

interface CalendarioJogosProps {
  partidas: Partida[];
  jogadores: Jogador[];
  pagamentos: Pagamento[];
  jogadorAtual: Jogador;
  onSelectPartidaForConfirmation: (partidaId: string) => void;
  onNavigateToTab: (tab: 'calendario' | 'confirmacao' | 'elenco' | 'financeiro' | 'mensalistas' | 'historico' | 'admin' | 'db') => void;
  onOpenAgendarModal?: () => void;
  onCriarPartida?: (novaPartida: Omit<Partida, 'id' | 'confirmados' | 'recusados' | 'createdAt'>) => void;
}

export default function CalendarioJogos({
  partidas,
  jogadores,
  pagamentos,
  jogadorAtual,
  onSelectPartidaForConfirmation,
  onNavigateToTab,
  onOpenAgendarModal,
  onCriarPartida,
}: CalendarioJogosProps) {
  // Estado do calendário de visualização: Inicia no mês atual de forma dinâmica
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);

  // Estado para armazenar o jogo passado selecionado para detalhamento
  const [jogoPassadoSelecionado, setJogoPassadoSelecionado] = useState<Partida | null>(null);

  // Estado para modal de agendamento por clique no calendário (Admin)
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [newGameTitulo, setNewGameTitulo] = useState('');
  const [selectedDateForNewGame, setSelectedDateForNewGame] = useState('');
  const [newGameHoraInicio, setNewGameHoraInicio] = useState('08:00'); // padrão: 08:00
  const [newGameHoraFim, setNewGameHoraFim] = useState('10:00'); // padrão: 10:00
  const [newGameLocal, setNewGameLocal] = useState('');
  const [schedulerError, setSchedulerError] = useState('');
  const [schedulerSuccess, setSchedulerSuccess] = useState(false);

  const mesesMap = [
    '', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Obter dias do mês selecionado
  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month, 0).getDate();
  };

  // Obter em qual dia da semana o mês inicia (0 = Domingo, 1 = Segunda, etc.)
  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month - 1, 1).getDay();
  };

  const diasNoMes = getDaysInMonth(currentYear, currentMonth);
  const primeiroDiaSemana = getFirstDayOfMonth(currentYear, currentMonth);

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const formatDayString = (day: number) => {
    const mm = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
    const dd = day < 10 ? `0${day}` : `${day}`;
    return `${currentYear}-${mm}-${dd}`;
  };

  const formatarDataAmigavel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const getAvatarProps = (photoId: string) => {
    const preset = AVATAR_PRESETS.find(p => p.id === photoId);
    return preset || { color: '#047857', text: '⚪' };
  };

  // Tratar clique em um dia com partida
  const handleDayClick = (partida: Partida) => {
    const isPast = partida.data < '2026-05-31';

    if (isPast) {
      // Jogo ocorrido: mostra os detalhes do jogo passado diretamente aqui
      setJogoPassadoSelecionado(partida);
    } else {
      // Jogo atual ou futuro: limpa histórico local e redireciona para confirmação
      setJogoPassadoSelecionado(null);
      onSelectPartidaForConfirmation(partida.id);
      onNavigateToTab('confirmacao');
    }
  };

  // Obter informações detalhadas de ex-participantes daquela partida
  const obterJogadoresComDadosPassados = (partida: Partida) => {
    const confirmadosIds = partida.confirmados || [];
    const mesReferencia = partida.data.substring(0, 7); // Ex: "2026-05"

    const confirmados = confirmadosIds
      .map((id) => jogadores.find((j) => j.id === id))
      .filter((j): j is Jogador => !!j);

    const detilhados = confirmados.map((jogador) => {
      // Procurar pagamento do jogador para o mês daquela partida
      const pagamento = pagamentos.find(
        (p) => p.jogadorId === jogador.id && p.mesRef === mesReferencia
      );

      return {
        jogador,
        pago: pagamento ? pagamento.status === 'pago' : false,
        valorPagar: pagamento ? pagamento.valor : (jogador.membroStatus === 'mensalista' ? 120 : 20)
      };
    });

    const goleiros = detilhados.filter((d) => d.jogador.posicao === 'Goleiro');
    const defesas = detilhados.filter((d) => d.jogador.posicao === 'Defesa');
    const meios = detilhados.filter((d) => d.jogador.posicao === 'Meio');
    const ataques = detilhados.filter((d) => d.jogador.posicao === 'Ataque');

    return { goleiros, defesas, meios, ataques, total: detilhados.length };
  };

  const isAdmin = jogadorAtual.role === 'admin';

  return (
    <div id="container-calendario-jogos" className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-7xl mx-auto animate-fade-in text-sans">
      
      {/* 1. SEÇÃO DO CALENDÁRIO MENSUAL DE DATAS DE PELADA */}
      <div className={`${jogoPassadoSelecionado ? 'lg:col-span-5' : 'lg:col-span-12'} bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between transition-all duration-300`}>
        <div>
          {/* Cabeçalho do Calendário */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-white/10 pb-4">
            <div>
              <h3 id="calendar-header-title" className="font-display font-semibold text-base text-white flex items-center gap-2 uppercase tracking-wide">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                Seletor Geral de Datas {isAdmin && <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-md uppercase">Modo Admin ativo</span>}
              </h3>
              <p className="text-[11px] text-emerald-300 mt-0.5">
                {isAdmin ? 'Clique nos dias com jogo para ver presença ou em qualquer dia vazio para cadastrar uma nova pelada.' : 'Clique nas datas com jogo para confirmar presença ou revisar listas de partidas passadas.'}
              </p>
            </div>
            
            {/* Controles de Navegação de Mês */}
            <div className="flex items-center gap-2">
              <button
                id="btn-calendar-prev"
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-emerald-200 transition-all border border-white/5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-white min-w-[100px] text-center font-mono uppercase bg-emerald-950/80 px-2.5 py-1.5 rounded border border-white/5">
                {mesesMap[currentMonth]} {currentYear}
              </span>
              <button
                id="btn-calendar-next"
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-emerald-200 transition-all border border-white/5 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-extrabold text-emerald-450 uppercase tracking-widest mb-3 font-mono leading-none">
            <div>Dom</div>
            <div>Seg</div>
            <div>Ter</div>
            <div>Qua</div>
            <div>Qui</div>
            <div>Sex</div>
            <div>Sáb</div>
          </div>

          {/* Grid Geral de Dias */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Espaços de Alinhamento */}
            {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
              <div key={`empty-day-${i}`} className="aspect-square bg-transparent rounded" />
            ))}

            {Array.from({ length: diasNoMes }).map((_, i) => {
              const diaNum = i + 1;
              const dataString = formatDayString(diaNum);
              const partidasNoDia = partidas.filter(p => p.data === dataString);
              const temJogo = partidasNoDia.length > 0;
              const jogo = partidasNoDia[0];
              const isPastMatch = temJogo && jogo.data < '2026-05-31';

              // Destacar Hoje: 2026-05-31
              const matchesToday = dataString === '2026-05-31';

              const isHistoricoAtivo = jogoPassadoSelecionado?.id === jogo?.id;

              return (
                <button
                  id={`btn-dia-calendario-${diaNum}`}
                  key={`dia-grid-${diaNum}`}
                  type="button"
                  onClick={() => {
                    if (temJogo) {
                      handleDayClick(jogo);
                    } else if (isAdmin) {
                      // Abrir agendamento tipo pop up para este dia!
                      setSelectedDateForNewGame(dataString);
                      setNewGameTitulo('Pelada Arena Record Oficial');
                      setNewGameLocal('Campo do Meio do Colégio Batista - Tijuca');
                      setNewGameHoraInicio('08:00');
                      setNewGameHoraFim('10:00');
                      setSchedulerError('');
                      setSchedulerSuccess(false);
                      setShowSchedulerModal(true);
                    }
                  }}
                  disabled={!temJogo && !isAdmin}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative text-xs font-bold transition-all ${
                    isHistoricoAtivo
                      ? 'bg-emerald-500 text-black font-black shadow-lg ring-2 ring-emerald-300'
                      : temJogo
                      ? jogo.cancelada
                        ? 'bg-red-950/85 hover:bg-rose-950 border border-rose-550/30 text-rose-350 cursor-pointer line-through text-white/50 opacity-90'
                        : isPastMatch
                        ? 'bg-emerald-950/75 hover:bg-emerald-900 border border-emerald-500/15 text-emerald-100 cursor-pointer'
                        : 'bg-teal-500 text-emerald-950 font-black shadow shadow-teal-500/20 hover:bg-teal-400 cursor-pointer animate-pulse'
                      : isAdmin
                      ? 'bg-emerald-950/20 hover:bg-emerald-900/35 text-emerald-500 hover:text-white border border-emerald-500/10 cursor-pointer hover:border-emerald-500'
                      : 'bg-emerald-950/20 text-emerald-700/40 cursor-default border border-transparent'
                  }`}
                >
                  <span className="z-10">{diaNum}</span>
                  {temJogo ? (
                    <span className="absolute bottom-1 text-[9px] select-none text-center">
                      {jogo.cancelada ? '🚫' : '⚽'}
                    </span>
                  ) : isAdmin ? (
                    <span className="absolute bottom-1 text-[7.5px] text-emerald-400 font-extrabold tracking-tight opacity-50 hover:opacity-100">+ NOVO</span>
                  ) : null}
                  {matchesToday && (
                    <span className="absolute top-1 right-1 text-[7px] px-1 bg-amber-500 text-black font-extrabold rounded leading-none shrink-0 scale-90">HOJE</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda Explicativa de Status */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 text-[10px] text-emerald-300 bg-emerald-950/50 p-3 rounded-xl border border-white/5">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-950/75 border border-emerald-500/15" />
              Jogo Passado (Clique para Ver Detalhes)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-teal-500" />
              Jogo Ativo/Próximo (Levará à Confirmação)
            </span>
            <span className="flex items-center gap-1.5 text-rose-350">
              <span className="w-2.5 h-2.5 rounded bg-rose-955/65 border border-rose-500/30" />
              🚫 Jogo Cancelado (Fortuito)
            </span>
            {isAdmin && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-950/25 border border-emerald-500/40" />
                Vazio (Admin: clique para agendar pop up)
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="mt-6 pt-4 border-t border-white/10">
            <button
              id="admin-calendar-agendar-partida-inline"
              type="button"
              onClick={() => {
                const hoje = new Date();
                const hojeString = `${hoje.getFullYear()}-${(hoje.getMonth() + 1).toString().padStart(2, '0')}-${hoje.getDate().toString().padStart(2, '0')}`;
                setSelectedDateForNewGame(hojeString);
                setNewGameTitulo('Pelada Arena Record Oficial');
                setNewGameLocal('Arena Record - Quadra Principal');
                setNewGameHoraInicio('08:00');
                setNewGameHoraFim('10:00');
                setSchedulerError('');
                setSchedulerSuccess(false);
                setShowSchedulerModal(true);
              }}
              className="w-full bg-white hover:bg-emerald-50 text-emerald-950 text-xs font-bold py-2.5 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow"
            >
              <PlusCircle className="w-4 h-4 text-emerald-700 font-extrabold" />
              Cadastrar Novo Jogo (Popup de Agendamento)
            </button>
          </div>
        )}
      </div>

      {/* 2. DETALHAMENTO DE JOGO JÁ OCORRIDO (Apenas se houver um selecionado) */}
      {jogoPassadoSelecionado && (
        <div id="visualizador-jogos-passados" className="lg:col-span-7 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-5 animate-slide-in">
          
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase bg-emerald-950/80 border border-emerald-500/25 px-2.5 py-1 rounded-lg text-emerald-400">
                📄 Evento Já Ocorrido
              </span>
            </div>
            <button
              type="button"
              onClick={() => setJogoPassadoSelecionado(null)}
              className="text-xs font-bold hover:text-white text-emerald-350 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1 transition-all"
            >
              Fechar Detalhes ✕
            </button>
          </div>

          {/* Dados Gerais da Partida */}
          <div className="bg-emerald-950/50 p-4 rounded-xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-display font-extrabold text-white text-sm">
                {jogoPassadoSelecionado.titulo}
              </h4>
              <span className="font-mono text-[10px] text-emerald-450">Código: #{jogoPassadoSelecionado.id.substring(0, 8)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-emerald-250 border-t border-white/5">
              <div className="flex items-center gap-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Dia: <b className="text-white font-mono">{formatarDataAmigavel(jogoPassadoSelecionado.data)}</b></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Horário: <b className="text-white font-mono">{jogoPassadoSelecionado.horario}h</b></span>
              </div>
              <div className="flex items-center gap-1.5 col-span-1 sm:col-span-3">
                <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">Local: <b className="text-white">{jogoPassadoSelecionado.local}</b></span>
              </div>
            </div>
          </div>

          {/* Lista de escalados por posição, tipo (membroStatus), e pagamento */}
          <div>
            {(() => {
              const { goleiros, defesas, meios, ataques, total } = obterJogadoresComDadosPassados(jogoPassadoSelecionado);

              const renderPosicaoPassada = (tituloGrid: string, lista: ReturnType<typeof obterJogadoresComDadosPassados>['goleiros']) => {
                return (
                  <div className="space-y-1.5 bg-emerald-950/60 rounded-xl border border-white/10 p-2.5">
                    <div className="flex items-center justify-between border-b border-white/5 pb-1.5 mb-1.5">
                      <span className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-300 font-mono">{tituloGrid}</span>
                      <span className="text-[10px] font-bold bg-white/5 px-2 py-0.5 rounded-full font-mono text-emerald-200">{lista.length}</span>
                    </div>

                    {lista.length === 0 ? (
                      <p className="text-[10px] text-emerald-500/50 italic py-1 text-center font-sans">Nenhum jogador atuou nesta posição</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {lista.map(({ jogador, pago }) => {
                          const av = getAvatarProps(jogador.foto);
                          return (
                            <div
                              key={jogador.id}
                              className="flex items-center justify-between p-2 bg-black/20 border border-white/5 rounded-lg group hover:border-white/10 transition-all font-sans"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 overflow-hidden"
                                  style={{ backgroundColor: av.color }}
                                >
                                  {jogador.foto && (jogador.foto.startsWith('http') || jogador.foto.startsWith('data:')) ? (
                                    <img src={jogador.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                  ) : (
                                    jogador.posicao === 'Goleiro' ? '🧤' : jogador.posicao === 'Defesa' ? '🛡️' : jogador.posicao === 'Meio' ? '🧠' : '🚀'
                                  )}
                                </div>
                                <div className="overflow-hidden min-w-0">
                                  <p className="text-xs font-bold text-white truncate leading-none flex items-center gap-1">
                                    <span>{jogador.nome} {jogador.sobrenome}</span>
                                    {jogador.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">
                                    <span style={{ fontSize: '7.5px' }} className={`px-1 rounded-sm uppercase font-extrabold tracking-wider ${
                                      jogador.membroStatus === 'mensalista' 
                                        ? 'bg-teal-950/60 text-teal-400 border border-teal-500/20' 
                                        : 'bg-amber-950/60 text-amber-400 border border-amber-500/20'
                                    }`}>
                                      {jogador.membroStatus === 'mensalista' ? 'MENSAL' : 'AVULSO'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Status de Pagamento */}
                              <div className="text-right shrink-0">
                                {pago ? (
                                  <span className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold text-teal-400 bg-teal-950/70 border border-teal-500/20 px-1.5 py-0.5 rounded uppercase">
                                    💳 Pago
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-[8.5px] font-extrabold text-amber-400 bg-amber-950/70 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">
                                    ⏳ Aberto
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              };

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h5 className="text-[11px] font-bold text-emerald-200 uppercase tracking-widest font-mono">
                      ⚽ Elenco Participante ({total} Confirmados)
                    </h5>
                  </div>

                  {total === 0 ? (
                    <div className="py-8 text-center bg-emerald-950/20 text-emerald-450 border border-dashed border-white/5 rounded-xl text-xs">
                      Não há registro de jogadores confirmados para esta antiga partida.
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {renderPosicaoPassada('🛡️ Goleiros', goleiros)}
                      {renderPosicaoPassada('🛡️ Defensores', defesas)}
                      {renderPosicaoPassada('🛡️ Meio-Campistas', meios)}
                      {renderPosicaoPassada('🛡️ Atacantes', ataques)}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Rodapé informativo de auditoria */}
          <div className="text-[10px] text-emerald-450 font-mono text-center border-t border-white/5 pt-3">
            Dados financeiros sincronizados em tempo real com o banco auditado da temporada.
          </div>

        </div>
      )}

      {/* =========================================================================
          MODAL DE CADASTRO DE NOVO JOGO (Abertura Pop-Up por clique de data)
          ========================================================================= */}
      {showSchedulerModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in font-sans">
          <div className="bg-emerald-950 border border-white/10 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <button
              onClick={() => setShowSchedulerModal(false)}
              className="absolute top-4 right-4 text-emerald-400 hover:text-white transition-colors text-lg"
            >
              ✕
            </button>

            <div>
              <h3 className="font-display font-extrabold text-base text-white uppercase tracking-wider flex items-center gap-2">
                ⚽ Cadastrar Novo Jogo
              </h3>
              <p className="text-xs text-emerald-300 mt-1">
                Data da pelada: <strong className="text-white font-mono">{formatarDataAmigavel(selectedDateForNewGame)}</strong>
              </p>
            </div>

            {schedulerError && (
              <div className="bg-rose-955/40 border border-rose-500/30 text-rose-300 text-xs p-2.5 rounded-lg flex items-center gap-2">
                ⚠️ <span>{schedulerError}</span>
              </div>
            )}

            {schedulerSuccess ? (
              <div className="bg-teal-950/60 border border-teal-500/30 text-teal-200 text-xs p-5 rounded-lg text-center font-bold animate-pulse">
                🎉 Jogo cadastrado e adicionado ao calendário de pelada com sucesso!
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setSchedulerError('');

                  if (!newGameTitulo.trim() || !newGameLocal.trim() || !newGameHoraInicio || !newGameHoraFim) {
                    setSchedulerError('Preencha todas as informações para cadastrar a partida.');
                    return;
                  }

                  if (onCriarPartida) {
                    onCriarPartida({
                      titulo: newGameTitulo.trim(),
                      data: selectedDateForNewGame,
                      horario: `${newGameHoraInicio} às ${newGameHoraFim}`,
                      local: newGameLocal.trim(),
                      criadoPor: jogadorAtual.id,
                    });
                  }

                  setSchedulerSuccess(true);
                  setTimeout(() => {
                    setShowSchedulerModal(false);
                    setSchedulerSuccess(false);
                  }, 1500);
                }}
                className="space-y-4 pt-1"
              >
                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-sans">Título da Partida / Confronto</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Pelada Arena Record Oficial"
                    value={newGameTitulo}
                    onChange={(e) => setNewGameTitulo(e.target.value)}
                    className="w-full bg-emerald-900 border border-white/10 text-white placeholder-emerald-600 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-sans">Horário de Início</label>
                    <input
                      type="time"
                      required
                      value={newGameHoraInicio}
                      onChange={(e) => setNewGameHoraInicio(e.target.value)}
                      className="w-full bg-emerald-900 border border-white/10 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-sans">Hora de Fim</label>
                    <input
                      type="time"
                      required
                      value={newGameHoraFim}
                      onChange={(e) => setNewGameHoraFim(e.target.value)}
                      className="w-full bg-emerald-900 border border-white/10 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-sans">Local da Arena / Quadra</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Arena Record - Quadra Principal"
                    value={newGameLocal}
                    onChange={(e) => setNewGameLocal(e.target.value)}
                    className="w-full bg-emerald-900 border border-white/10 text-white placeholder-emerald-600 rounded-lg p-2.5 text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowSchedulerModal(false)}
                    className="w-1/2 bg-emerald-950 border border-white/10 hover:bg-white/5 text-emerald-350 hover:text-white font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer"
                  >
                    Voltar / Cancelar
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs py-2.5 rounded-lg transition-colors shadow-md shadow-emerald-500/20 cursor-pointer"
                  >
                    Cadastrar Jogo
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
