/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Partida, Jogador, Pagamento } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Calendar as CalendarIcon, MapPin, Clock, Users, ArrowUpRight, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, PlusCircle, Trash2, Check, X, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getJanelaConfirmacao, obterDebitosDoJogador } from '../utils/confirmationRules';
import CheckoutPixModal from './CheckoutPixModal';

interface CalendarioJogosProps {
  partidas: Partida[];
  jogadores: Jogador[];
  pagamentos: Pagamento[];
  jogadorAtual: Jogador;
  onSelectPartidaForConfirmation: (partidaId: string) => void;
  onNavigateToTab: (tab: 'calendario' | 'confirmacao' | 'elenco' | 'financeiro' | 'mensalistas' | 'historico' | 'admin' | 'db') => void;
  onOpenAgendarModal?: () => void;
  onCriarPartida?: (novaPartida: Omit<Partida, 'id' | 'confirmados' | 'recusados' | 'createdAt'>) => void;
  onDeletarPartida?: (partidaId: string) => void;
  onCancelarPartida?: (partidaId: string, cancelar: boolean) => void;
  onActualizarPresenca?: (partidaId: string, jogadorId: string, confirmado: boolean | null) => void;
  onRegistrarPagamento?: (jogadorId: string, mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado', dataPagamento: string | null, valor: number, partidaId?: string) => Promise<void>;
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
  onDeletarPartida,
  onCancelarPartida,
  onActualizarPresenca,
  onRegistrarPagamento,
}: CalendarioJogosProps) {
  // Estado para armazenar o ID do jogo agendado atualmente exibido em pop-up detalhado
  const [partidaDetalhadaPopupId, setPartidaDetalhadaPopupId] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Estado para modal/pop-up de fora do período de confirmação
  const [showForaPeriodoModal, setShowForaPeriodoModal] = useState(false);
  const [foraPeriodoInfo, setForaPeriodoInfo] = useState<{ inicio: string; fim: string; jogoTitulo: string; jogoData: string } | null>(null);

  // Estados para Modal Checkout PIX Diarista
  const [showPixCheckoutDiarista, setShowPixCheckoutDiarista] = useState(false);
  const [debitosParaPagarDiarista, setDebitosParaPagarDiarista] = useState<any[]>([]);
  const [dadosConfirmacaoPendente, setDadosConfirmacaoPendente] = useState<{ partidaId: string; jogadorId: string; confirmado: boolean } | null>(null);

  // Estados para Modal de Inadimplência
  const [showInadimplenteModal, setShowInadimplenteModal] = useState(false);
  const [debitosPendentes, setDebitosPendentes] = useState<any[]>([]);

  // Estado do calendário de visualização: Inicia no mês atual de forma dinâmica
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);

  // Estado para armazenar o jogo passado selecionado para detalhamento
  const [jogoPassadoSelecionado, setJogoPassadoSelecionado] = useState<Partida | null>(null);

  // Estado para modal de agendamento por clique no calendário (Admin)
  const [showSchedulerModal, setShowSchedulerModal] = useState(false);
  const [newGameTitulo, setNewGameTitulo] = useState('Pelada Batista Sábado');
  const [selectedDateForNewGame, setSelectedDateForNewGame] = useState(() => {
    const hoje = new Date();
    const mm = (hoje.getMonth() + 1).toString().padStart(2, '0');
    const dd = hoje.getDate().toString().padStart(2, '0');
    return `${hoje.getFullYear()}-${mm}-${dd}`;
  });
  const [newGameHoraInicio, setNewGameHoraInicio] = useState('08:05'); // padrão: 08:00
  const [newGameHoraFim, setNewGameHoraFim] = useState('10:05'); // padrão: 10:00
  const [newGameLocal, setNewGameLocal] = useState('Pelada Batista Sábado - Quadra Principal');
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

  // Tratar clique em um dia com partida (Abre o pop-up de detalhes com confirmação, recusa e admin deletar)
  const handleDayClick = (partida: Partida) => {
    setPartidaDetalhadaPopupId(partida.id);
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
  const leftColSpan = jogoPassadoSelecionado ? 'lg:col-span-5' : 'lg:col-span-12';

  const proximaPartidaSelec = partidas && partidas.length > 0
    ? (partidas.filter(p => !p.cancelada && p.data >= '2026-05-31').sort((a, b) => a.data.localeCompare(b.data))[0] || partidas[0])
    : null;

  return (
    <div id="container-calendario-jogos" className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full max-w-7xl mx-auto animate-fade-in text-sans">
      
      {/* 1. SEÇÃO DO CALENDÁRIO MENSUAL DE DATAS DE PELADA */}
      <div className={`${leftColSpan} bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm flex flex-col justify-between transition-all duration-300`}>
        <div>
          {/* Cabeçalho do Calendário */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5 border-b border-white/10 pb-4">
            <div>
              <h3 id="calendar-header-title" className="font-display font-semibold text-base text-white flex items-center gap-2 uppercase tracking-wide">
                <CalendarIcon className="w-5 h-5 text-emerald-400" />
                Seletor Geral de Datas {isAdmin && <span className="text-[10px] bg-emerald-500 text-black font-black px-2 py-0.5 rounded-md uppercase">Modo Admin ativo</span>}
              </h3>
              <p className="text-[11px] text-emerald-300 mt-0.5">
                {isAdmin ? 'Clique nos dias com jogo para ver presença ou em qualquer dia vazio para cadastrar uma nova pelada por pop-up.' : 'Clique nas datas com jogo para confirmar presença ou revisar listas de partidas passadas.'}
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

          {/* Regulamento de Confirmação do Próximo Jogo */}
          {proximaPartidaSelec && proximaPartidaSelec.data >= '2026-05-31' && (
            <div className="mb-4">
              {(() => {
                const jan = getJanelaConfirmacao(proximaPartidaSelec.data);
                const isFechado = jan.status === 'fechado';
                return (
                  <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
                    isFechado 
                      ? 'bg-amber-950/45 border-amber-500/20 text-amber-200 shadow' 
                      : 'bg-emerald-950/45 border-emerald-500/25 text-emerald-100 shadow'
                  }`}>
                    <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${isFechado ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <div>
                      <h5 className="font-bold uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                        <span>Regulamento de Confirmação</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8px] font-extrabold ${isFechado ? 'bg-amber-500 text-black' : 'bg-emerald-500 text-black animate-pulse'}`}>
                          {isFechado ? 'FECHADO' : 'ABERTO'}
                        </span>
                      </h5>
                      <p className="mt-1 leading-relaxed text-[11px] text-emerald-300">
                        Início: Terça-feira (<b>{jan.inicio.toLocaleDateString('pt-BR')}</b>) às 00:00 até Sexta-feira (<b>{jan.fim.toLocaleDateString('pt-BR')}</b>) às 23:59.
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
 
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

              // Obter data atual de forma dinâmica (YYYY-MM-DD em fuso local)
              const d = new Date();
              const hojeString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

              const isPastMatch = temJogo && jogo.data < hojeString;
              const matchesToday = dataString === hojeString;

              const isHistoricoAtivo = jogoPassadoSelecionado?.id === jogo?.id;

              let buttonStyleClass = '';
              if (isHistoricoAtivo) {
                buttonStyleClass = 'bg-emerald-500 text-black font-black shadow-lg ring-2 ring-emerald-300 cursor-pointer';
              } else if (temJogo) {
                if (jogo.data < hojeString) {
                  // Jogo no passado (anterior a hoje)
                  if (jogo.cancelada) {
                    // 1 - Jogos Cancelados: piscante em vermelho com um icone ❌
                    buttonStyleClass = 'bg-red-650 hover:bg-rose-900 border border-red-500/50 text-red-200 animate-pulse cursor-pointer shadow shadow-red-550/25';
                  } else {
                    // 2 - Jogos realizados: piscante em azul com um icone ✅
                    buttonStyleClass = 'bg-blue-650 hover:bg-blue-600 border border-blue-450 text-blue-100 animate-pulse cursor-pointer shadow shadow-blue-500/25';
                  }
                } else {
                  // Jogo futuro ou hoje (3 - Jogos futuros: piscante em verde)
                  buttonStyleClass = 'bg-teal-500 text-emerald-950 font-black shadow shadow-teal-500/20 hover:bg-teal-400 animate-pulse cursor-pointer';
                }
              } else if (isAdmin) {
                buttonStyleClass = 'bg-emerald-950/20 hover:bg-emerald-900/35 text-emerald-500 hover:text-white border border-emerald-500/10 hover:border-emerald-500 cursor-pointer';
              } else {
                buttonStyleClass = 'bg-emerald-950/20 text-emerald-700/40 cursor-default border border-transparent';
              }

              return (
                <button
                  id={`btn-dia-calendario-${diaNum}`}
                  key={`dia-grid-${diaNum}`}
                  type="button"
                  onClick={() => {
                    if (temJogo) {
                      handleDayClick(jogo);
                    } else if (isAdmin) {
                      // CASO SEJA CLICADO EM UMA DATA SEM JOGO AGENDADO E SEJA ADMIN, ABRIR O POP UP DE CADASTRO DE NOVO JOGO
                      setSelectedDateForNewGame(dataString);
                      setNewGameTitulo('Pelada Batista Sábado');
                      setNewGameLocal('Pelada Batista Sábado - Quadra Principal');
                      setNewGameHoraInicio('08:05');
                      setNewGameHoraFim('10:05');
                      setSchedulerError('');
                      setSchedulerSuccess(false);
                      setShowSchedulerModal(true);
                    }
                  }}
                  disabled={!temJogo && !isAdmin}
                  className={`aspect-square rounded-xl flex flex-col items-center justify-center relative text-xs font-bold transition-all ${buttonStyleClass}`}
                >
                  <span className="z-10">{diaNum}</span>
                  {temJogo ? (
                    <span className="absolute bottom-1 text-[9px] select-none text-center">
                      {jogo.data < hojeString
                        ? jogo.cancelada
                          ? '❌'
                          : '✅'
                        : jogo.cancelada
                        ? '🚫'
                        : '⚽'}
                    </span>
                  ) : isAdmin ? (
                    <span className="absolute bottom-1 text-[7.5px] text-emerald-400 font-extrabold tracking-tight opacity-50 hover:opacity-100">+ NOVO</span>
                  ) : null}
                  {matchesToday && (
                    <span className="absolute top-1 right-1 text-[7px] px-1 bg-amber-500 text-black font-extrabold rounded leading-none shrink-0 scale-90 font-mono">HOJE</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legenda Explicativa de Status */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-5 text-[10px] text-emerald-300 bg-emerald-950/50 p-3 rounded-xl border border-white/5">
            <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[8px] text-emerald-400 w-full mb-0.5">
              Legenda de Status
            </span>
            <span className="flex items-center gap-1.5 text-blue-300 animate-pulse font-medium">
              <span className="w-2.5 h-2.5 rounded bg-blue-650 border border-blue-450" />
              ✅ Jogo Realizado (Passado)
            </span>
            <span className="flex items-center gap-1.5 text-rose-300 animate-pulse font-medium">
              <span className="w-2.5 h-2.5 rounded bg-red-650 border border-red-500/50" />
              ❌ Jogo Cancelado (Passado)
            </span>
            <span className="flex items-center gap-1.5 text-teal-300 animate-pulse font-medium">
              <span className="w-2.5 h-2.5 rounded bg-teal-500" />
              ⚽ Jogo Futuro / Agendado
            </span>
            {isAdmin && (
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-950/25 border border-emerald-500/40" />
                Vazio (Admin: agendar)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. DETALHAMENTO DE JOGO JÁ OCORRIDO OU AGENDAMENTO DE JOGO INLINE */}
      {jogoPassadoSelecionado ? (
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 text-[11px] text-emerald-300 border-t border-white/5">
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
                                  className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 overflow-hidden border border-white/5 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                                  style={{ backgroundColor: av.color }}
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
      ) : null}

      {/* =========================================================================
          MODAL COM DETALHES DO JOGO AGENDADO E OPÇÕES DE CONFIRMAR OU AUSÊNCIA E DELETAR PARA ADM
          ========================================================================= */}
      {(() => {
        const activePartidaPopup = partidas.find(p => p.id === partidaDetalhadaPopupId);
        if (!activePartidaPopup) return null;

        const isConfirmado = activePartidaPopup.confirmados?.includes(jogadorAtual.id);
        const isAusente = activePartidaPopup.recusados?.includes(jogadorAtual.id);
        const isAdmin = jogadorAtual.role === 'admin';
        const isFutureMatch = activePartidaPopup.data >= '2026-05-31';

        return (
          <div id="modal-detalhes-jogo-agendado" className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in font-sans text-white">
            <div className="bg-emerald-950 border border-white/10 rounded-2xl p-6 max-w-lg w-full space-y-5 shadow-2xl relative">
              <button
                id="btn-close-modal-detalhes"
                onClick={() => {
                  setPartidaDetalhadaPopupId(null);
                  setShowConfirmDelete(false);
                }}
                className="absolute top-4 right-4 text-emerald-400 hover:text-white transition-colors text-lg cursor-pointer"
              >
                ✕
              </button>

              <div>
                <span className="text-[10px] font-black uppercase bg-emerald-900 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded">
                  ℹ️ Informações da Pelada
                </span>
                <h3 className="font-display font-extrabold text-lg text-white mt-2 leading-tight">
                  {activePartidaPopup.titulo}
                </h3>
                <p className="text-xs text-emerald-300 mt-1 font-sans">
                  {isFutureMatch ? 'Acompanhe o status e confirme ou informe sua ausência para esta partida.' : 'Confira a lista de atletas da partida passada.'}
                </p>
              </div>

              {/* Detalhes do Jogo */}
              <div className="bg-emerald-900/30 p-4 rounded-xl border border-white/5 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">Data</span>
                      <strong className="text-white font-mono">{formatarDataAmigavel(activePartidaPopup.data)}</strong>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">Horário</span>
                      <strong className="text-white font-mono">{activePartidaPopup.horario}</strong>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-2 flex items-start gap-2 text-xs">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-emerald-400 font-bold block uppercase tracking-wider">Local</span>
                    <strong className="text-white">{activePartidaPopup.local}</strong>
                  </div>
                </div>
              </div>

              {/* Regulamento de Confirmação do Popup */}
              {isFutureMatch && (() => {
                const jan = getJanelaConfirmacao(activePartidaPopup.data);
                const isFechado = jan.status === 'fechado';
                return (
                  <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
                    isFechado 
                      ? 'bg-amber-955/45 border-amber-500/20 text-amber-200' 
                      : 'bg-emerald-950/45 border-emerald-500/25 text-emerald-100 shadow'
                  }`}>
                    <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${isFechado ? 'text-amber-400' : 'text-emerald-400'}`} />
                    <div>
                      <h5 className="font-bold uppercase tracking-wide text-[10px] flex items-center gap-1.5 font-display text-emerald-350">
                        <span>Regulamento de Confirmação</span>
                        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-extrabold ${isFechado ? 'bg-amber-500 text-black' : 'bg-teal-500 text-black animate-pulse'}`}>
                          {isFechado ? 'FECHADO' : 'ABERTO'}
                        </span>
                      </h5>
                      <p className="mt-1 leading-relaxed text-[11px] text-emerald-300 font-sans">
                        Regulamento: Terça-feira (<b>{jan.inicio.toLocaleDateString('pt-BR')}</b>) às 00:00 até Sexta-feira (<b>{jan.fim.toLocaleDateString('pt-BR')}</b>) às 23:59.
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* Presença do Usuário Atual */}
              {isFutureMatch && (() => {
                const isAdmin = jogadorAtual.role === 'admin';
                const originalStatus = jogadorAtual.membroStatusDb || jogadorAtual.membroStatus;
                const isMensalista = originalStatus === 'mensalista';
                
                let hasDebits = false;
                if (!isAdmin && isMensalista) {
                  const vD = parseFloat(localStorage.getItem('racha_valor_diaria') || '30');
                  const v4 = parseFloat(localStorage.getItem('racha_valor_4s') || '85');
                  const v5 = parseFloat(localStorage.getItem('racha_valor_5s') || '105');
                  hasDebits = obterDebitosDoJogador(jogadorAtual.id, originalStatus, jogadorAtual.posicao, partidas, pagamentos, vD, v4, v5, jogadorAtual.createdAt).length > 0;
                }

                return (
                <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300 font-sans">Sua Presença neste Jogo:</span>
                    {isConfirmado ? (
                      <span className="text-[10.5px] font-black bg-teal-500 text-emerald-950 px-2 py-0.5 rounded uppercase">
                        ✅ Confirmado
                      </span>
                    ) : isAusente ? (
                      <span className="text-[10.5px] font-black bg-rose-500 text-white px-2 py-0.5 rounded uppercase">
                        ❌ Ausente Informado
                      </span>
                    ) : (
                      <span className="text-[10.5px] font-black bg-amber-500 text-amber-950 px-2 py-0.5 rounded uppercase">
                        ⏳ Pendente / Não Respondido
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2 font-semibold">
                    <button
                      id="btn-confirmar-presenca-popup"
                      type="button"
                      onClick={() => {
                        const jan = getJanelaConfirmacao(activePartidaPopup.data);
                        if (jogadorAtual.role !== 'admin' && jan.status === 'fechado') {
                          const dataInicioStr = jan.inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                          const dataFimStr = jan.fim.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                          const dataJogoDate = new Date(`${activePartidaPopup.data}T12:00:00`);
                          const dataJogoFormatado = dataJogoDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                          setForaPeriodoInfo({ 
                            inicio: dataInicioStr, 
                            fim: dataFimStr,
                            jogoTitulo: activePartidaPopup.titulo,
                            jogoData: dataJogoFormatado
                          });
                          setShowForaPeriodoModal(true);
                          return;
                        }

                        const vD = parseFloat(localStorage.getItem('racha_valor_diaria') || '30');
                        const v4 = parseFloat(localStorage.getItem('racha_valor_4s') || '85');
                        const v5 = parseFloat(localStorage.getItem('racha_valor_5s') || '105');

                        const debits = obterDebitosDoJogador(
                          jogadorAtual.id,
                          originalStatus,
                          jogadorAtual.posicao,
                          partidas,
                          pagamentos,
                          vD,
                          v4,
                          v5,
                          jogadorAtual.createdAt
                        );

                        if (jogadorAtual.role !== 'admin' && originalStatus === 'diarista' && !isConfirmado) {
                          const novaDiaria = {
                            id: `diaria-[temp]-${activePartidaPopup.id}`,
                            tipo: 'diaria',
                            referencia: `Diária do jogo: ${activePartidaPopup.titulo}`,
                            dataOrigem: activePartidaPopup.data,
                            mesRef: activePartidaPopup.data.substring(0, 7),
                            valor: vD,
                            status: 'pendente',
                            partidaId: activePartidaPopup.id
                          };
                          const todosDebitos = [novaDiaria, ...debits];
                          setDebitosParaPagarDiarista(todosDebitos);
                          setDadosConfirmacaoPendente({ partidaId: activePartidaPopup.id, jogadorId: jogadorAtual.id, confirmado: true });
                          setShowPixCheckoutDiarista(true);
                          return;
                        }

                        if (jogadorAtual.role !== 'admin' && originalStatus === 'mensalista' && debits.length > 0 && !isConfirmado) {
                          setDebitosPendentes(debits);
                          setDadosConfirmacaoPendente({ partidaId: activePartidaPopup.id, jogadorId: jogadorAtual.id, confirmado: true });
                          setShowInadimplenteModal(true);
                          return;
                        }

                        if (onActualizarPresenca) {
                          onActualizarPresenca(activePartidaPopup.id, jogadorAtual.id, true);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        isConfirmado
                          ? 'bg-emerald-500 text-emerald-950 shadow-md ring-2 ring-emerald-350'
                          : hasDebits 
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-emerald-900 hover:bg-emerald-800 text-white border border-emerald-500/20'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      {isConfirmado ? 'Confirmar Jogo (Vou Jogar)' : (hasDebits ? 'Pendente Financeiro (Vou Jogar)' : 'Confirmar Jogo (Vou Jogar)')}
                    </button>

                    <button
                      id="btn-recusar-presenca-popup"
                      type="button"
                      onClick={() => {
                        const jan = getJanelaConfirmacao(activePartidaPopup.data);
                        if (jogadorAtual.role !== 'admin' && jan.status === 'fechado') {
                          const dataInicioStr = jan.inicio.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                          const dataFimStr = jan.fim.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
                          const dataJogoDate = new Date(`${activePartidaPopup.data}T12:00:00`);
                          const dataJogoFormatado = dataJogoDate.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                          setForaPeriodoInfo({ 
                            inicio: dataInicioStr, 
                            fim: dataFimStr,
                            jogoTitulo: activePartidaPopup.titulo,
                            jogoData: dataJogoFormatado
                          });
                          setShowForaPeriodoModal(true);
                          return;
                        }
                        if (onActualizarPresenca) {
                          onActualizarPresenca(activePartidaPopup.id, jogadorAtual.id, false);
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
                        isAusente
                          ? 'bg-rose-500 text-white shadow-md ring-2 ring-rose-300'
                          : 'bg-rose-950/45 hover:bg-rose-950/65 text-rose-350 border border-rose-500/20'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Informar Ausência (Ficar Fora)
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* Listas curtas de Jogadores que confirmaram ou recusaram para sabermos a presença */}
              <div className="grid grid-cols-2 gap-3 text-xs pt-1">
                <div className="space-y-1.5 font-sans">
                  <span className="text-[10px] font-mono font-black text-emerald-400 uppercase tracking-widest block">
                    🟢 Confirmados ({activePartidaPopup.confirmados?.length || 0})
                  </span>
                  <div className="max-h-[120px] overflow-y-auto bg-black/20 rounded-xl p-2 border border-white/5 space-y-1">
                    {(activePartidaPopup.confirmados || []).length === 0 ? (
                      <span className="text-[10px] text-emerald-600 italic block">Nenhum atleta ainda</span>
                    ) : (
                      activePartidaPopup.confirmados?.map(id => {
                        const jog = jogadores.find(j => j.id === id);
                        if (!jog) return null;
                        return (
                          <div key={id} className="flex items-center gap-1.5 truncate">
                            <span className="text-[10px]">⚽</span>
                            <span className="truncate">{jog.nome} {jog.sobrenome}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-1.5 font-sans">
                  <span className="text-[10px] font-mono font-black text-rose-450 uppercase tracking-widest block">
                    🔴 Ausentes ({activePartidaPopup.recusados?.length || 0})
                  </span>
                  <div className="max-h-[120px] overflow-y-auto bg-black/20 rounded-xl p-2 border border-white/5 space-y-1">
                    {(activePartidaPopup.recusados || []).length === 0 ? (
                      <span className="text-[10px] text-emerald-600/50 italic block">Nenhuma ausência</span>
                    ) : (
                      activePartidaPopup.recusados?.map(id => {
                        const jog = jogadores.find(j => j.id === id);
                        if (!jog) return null;
                        return (
                          <div key={id} className="flex items-center gap-1.5 truncate text-stone-300">
                            <span className="text-[10px]">❌</span>
                            <span className="truncate">{jog.nome} {jog.sobrenome}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

               {/* Ações de Administração: Cancelar e Deletar Jogo */}
              {isAdmin && (
                <div className="border-t border-white/10 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-sans">
                  <span className="text-[10px] text-emerald-450 font-bold uppercase tracking-wider">Ações de Administrador:</span>
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Botão Cancelar/Reativar Partida */}
                    <button
                      id="btn-cancelar-partida-popup"
                      type="button"
                      onClick={() => {
                        if (onCancelarPartida) {
                          onCancelarPartida(activePartidaPopup.id, !activePartidaPopup.cancelada);
                        }
                      }}
                      className={`text-xs font-bold px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap ${
                        activePartidaPopup.cancelada
                          ? 'bg-emerald-600/90 hover:bg-emerald-500 text-white'
                          : 'bg-amber-600/80 hover:bg-amber-500 text-amber-100 hover:text-white border border-amber-500/30'
                      }`}
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {activePartidaPopup.cancelada ? 'Reativar Partida' : 'Cancelar Partida'}
                    </button>

                    {/* Botão Deletar Jogo */}
                    {!showConfirmDelete ? (
                      <button
                        id="btn-deletar-partida-popup"
                        type="button"
                        onClick={() => setShowConfirmDelete(true)}
                        className="bg-rose-900/80 hover:bg-rose-700 text-rose-200 hover:text-white border border-rose-500/30 font-bold text-xs px-3 py-2 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Deletar Jogo (Admin)
                      </button>
                    ) : (
                      <div className="flex items-center gap-2 bg-rose-950/65 p-2 rounded-xl border border-rose-500/40 animate-fade-in shrink-0">
                        <span className="text-[11px] text-rose-200 font-bold">Excluir?</span>
                        <button
                          id="btn-confirmar-deletar-partida"
                          type="button"
                          onClick={() => {
                            if (onDeletarPartida) {
                              onDeletarPartida(activePartidaPopup.id);
                              setPartidaDetalhadaPopupId(null);
                              setShowConfirmDelete(false);
                            }
                          }}
                          className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Sim
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowConfirmDelete(false)}
                          className="bg-emerald-900 hover:bg-emerald-800 text-emerald-100 text-xs px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Não
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
                    placeholder="Ex: Pelada Batista Sábado"
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
                    placeholder="Ex: Pelada Batista Sábado - Quadra Principal"
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

      {/* MODAL DE FORA DO PERÍODO DE CONFIRMAÇÃO */}
      {showForaPeriodoModal && foraPeriodoInfo && (
        <div id="modal-fora-periodo-calendario" className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-emerald-950 border border-amber-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-amber-500/25 pb-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="font-display font-black text-sm text-amber-400 uppercase tracking-wider">
                  🚨 Fora do Período de Confirmação
                </h3>
                <p className="text-[10px] text-amber-300/80 font-mono mt-0.5">
                  Regulamento de Janela de Confirmações
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-left text-xs font-sans text-amber-100">
              <p className="leading-relaxed text-[11.5px]">
                Olá, <strong className="text-white">{jogadorAtual.nome} {jogadorAtual.sobrenome}</strong>. 
                Sua solicitação de presença/ausência para a partida <b>{foraPeriodoInfo.jogoTitulo} (Data: {foraPeriodoInfo.jogoData})</b> não pôde ser registrada porque a janela oficial está fechada.
              </p>

              <div className="bg-black/40 border border-amber-500/15 p-4 rounded-xl space-y-2.5">
                <p className="font-bold text-amber-405 font-sans uppercase tracking-wider text-[10px] flex items-center gap-1.5">
                  ⏰ Regra Oficial do Regulamento:
                </p>
                <div className="space-y-1 text-[11px] leading-relaxed text-emerald-300">
                  <p>• <b>Início:</b> {foraPeriodoInfo.inicio}</p>
                  <p>• <b>Término:</b> {foraPeriodoInfo.fim}</p>
                </div>
              </div>

              <p className="text-[11px] text-amber-200/90 leading-relaxed italic bg-amber-500/5 p-3 rounded-xl border border-amber-500/10">
                Se você precisar alterar seu status de forma excepcional (por exemplo, contusão de última hora), entre em contato diretamente com a organização que possui acesso de administrador.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                id="btn-fora-periodo-fechar-calendario"
                onClick={() => {
                  setShowForaPeriodoModal(false);
                }}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs rounded-xl transition-all shadow-md active:scale-97 text-center cursor-pointer uppercase font-sans"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {showPixCheckoutDiarista && debitosParaPagarDiarista.length > 0 && (
        <CheckoutPixModal
          isOpen={showPixCheckoutDiarista}
          onClose={() => {
            setShowPixCheckoutDiarista(false);
            setDadosConfirmacaoPendente(null);
            setDebitosParaPagarDiarista([]);
          }}
          jogadorAtual={jogadorAtual}
          valorTotal={debitosParaPagarDiarista.reduce((sum, d) => sum + d.valor, 0)}
          debitos={debitosParaPagarDiarista}
          onConfirmarPagamentoTotal={async (debitList) => {
            if (onRegistrarPagamento) {
              for (const dt of debitList) {
                await onRegistrarPagamento(jogadorAtual.id, dt.mesRef, 'pago', new Date().toISOString().split('T')[0], dt.valor, dt.partidaId);
              }
            }
            if (dadosConfirmacaoPendente && onActualizarPresenca) {
              onActualizarPresenca(dadosConfirmacaoPendente.partidaId, dadosConfirmacaoPendente.jogadorId, dadosConfirmacaoPendente.confirmado);
            }
            setShowPixCheckoutDiarista(false);
            setDadosConfirmacaoPendente(null);
            setDebitosParaPagarDiarista([]);
          }}
        />
      )}

      {showInadimplenteModal && (
        <div id="modal-alerta-inadimplencia" className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-emerald-950 border border-rose-500/30 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5 backdrop-blur-md">
            <div className="flex items-center gap-3 border-b border-rose-500/20 pb-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <ShieldAlert className="w-6 h-6 animate-pulse" />
              </div>
              <div className="text-left">
                <h3 className="font-display font-black text-sm text-rose-400 uppercase tracking-wider">
                  ⚠️ Aviso de Inadimplência
                </h3>
                <p className="text-[10px] text-rose-350 font-mono mt-0.5">
                  Regularização Pendente de Contribuição
                </p>
              </div>
            </div>

            <div className="space-y-3.5 text-left text-xs font-sans text-rose-100">
              <p className="leading-relaxed text-[11.5px]">
                Prezado(a) <strong className="text-white">{jogadorAtual.nome} {jogadorAtual.sobrenome}</strong>, detectamos débitos pendentes de quitação.
              </p>

              <div className="bg-black/40 border border-rose-500/15 p-3.5 rounded-xl space-y-2.5 max-h-48 overflow-y-auto font-mono text-[10.5px]">
                <p className="font-bold text-rose-300 font-sans border-b border-white/5 pb-1 uppercase tracking-wider">Detalhamento dos Débitos:</p>
                {debitosPendentes.map((deb, index) => (
                  <div key={deb.id || index} className="flex justify-between items-start gap-2 border-b border-white/5 last:border-b-0 pb-1.5 last:pb-0">
                    <div>
                      <p className="text-white/90 font-bold">{deb.referencia}</p>
                      <p className="text-[9px] text-rose-400 font-sans mt-0.5">Vencido desde/Referente: {deb.dataOrigem.split('-').reverse().join('/')}</p>
                    </div>
                    <span className="text-xs font-bold text-rose-400 shrink-0 font-mono">
                      R$ {deb.valor.toFixed(2)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between items-center text-xs font-bold border-t border-rose-500/20 pt-2 text-rose-400 font-mono">
                  <span>VALOR TOTAL DEVIDO:</span>
                  <span>R$ {debitosPendentes.reduce((sum, d) => sum + d.valor, 0).toFixed(2)}</span>
                </div>
              </div>

              <p className="text-[11px] text-rose-250/80 leading-relaxed italic bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
                Por favor, solicitamos a regularização desses débitos no sistema para manter o compromisso com nossa pelada e com o aluguel da quadra. Os débitos encontram-se descritos no seu histórico de mensalidades/pagamentos.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {jogadorAtual.membroStatus !== 'diarista' && (
                <button
                  type="button"
                  id="btn-quitar-debitos-pix"
                  onClick={() => {
                    setShowInadimplenteModal(false);
                    setDebitosParaPagarDiarista(debitosPendentes);
                    setShowPixCheckoutDiarista(true);
                  }}
                  className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-emerald-950 font-black text-xs rounded-xl transition-all shadow-md active:scale-97 text-center cursor-pointer uppercase flex items-center justify-center gap-1.5"
                >
                  <span>⚡ Quitar Débitos via PIX</span>
                </button>
              )}
              <button
                type="button"
                id="btn-confirmar-inadimplente-fechar"
                onClick={() => {
                  setShowInadimplenteModal(false);
                  setDadosConfirmacaoPendente(null);
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all text-center cursor-pointer"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
