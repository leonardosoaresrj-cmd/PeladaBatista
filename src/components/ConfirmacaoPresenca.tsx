/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Partida, Jogador, Pagamento, MembroStatus, PosicaoJogador } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Calendar as CalendarIcon, MapPin, Clock, Users, Check, X, ShieldAlert, Award, ChevronLeft, ChevronRight, Share2, AlertTriangle, Send, Copy, Edit2, Trash2 } from 'lucide-react';
import { getJanelaConfirmacao, gerarLinkCompartilhamento, obterTextoConfirmacaoJogador, obterTextoAlertaSemanal, obterDebitosDoJogador } from '../utils/confirmationRules';

interface ConfirmacaoPresencaProps {
  partidas: Partida[];
  jogadores: Jogador[];
  jogadorAtual: Jogador;
  partidaSelecionadaId: string | null;
  setPartidaSelecionadaId: (id: string | null) => void;
  onActualizarPresenca: (partidaId: string, jogadorId: string, confirmado: boolean | null) => void;
  onExcluirJogador?: (id: string) => void;
  onEditarJogador?: (id: string, camposAtualizados: Partial<Jogador>) => void;
  pagamentos: Pagamento[];
  whatsappAutomacaoAtiva?: boolean;
  whatsappGrupoLink?: string;
  onRegistrarLogAutomacao?: (atletaNome: string, partidaTitulo: string, msg: string) => void;
  onCancelarPartida?: (partidaId: string, cancelar: boolean) => void;
}

export default function ConfirmacaoPresenca({
  partidas,
  jogadores,
  jogadorAtual,
  partidaSelecionadaId,
  setPartidaSelecionadaId,
  onActualizarPresenca,
  onExcluirJogador,
  onEditarJogador,
  pagamentos,
  whatsappAutomacaoAtiva = true,
  whatsappGrupoLink = '',
  onRegistrarLogAutomacao,
  onCancelarPartida,
}: ConfirmacaoPresencaProps) {
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [modoExibicao, setModoExibicao] = useState<'posicao' | 'confirmacao'>('posicao');

  // Estados de Notificação Automática do Bot WhatsApp
  const [showAutoToast, setShowAutoToast] = useState(false);
  const [autoToastMsg, setAutoToastMsg] = useState('');

  // Estados para Modal de Inadimplência
  const [showInadimplenteModal, setShowInadimplenteModal] = useState(false);
  const [debitosPendentes, setDebitosPendentes] = useState<any[]>([]);
  const [dadosConfirmacaoPendente, setDadosConfirmacaoPendente] = useState<{ id: string; confirmado: boolean } | null>(null);

  // Controladores do Popup/Modal de informações e edição do jogador
  const [jogadorSelecionadoModal, setJogadorSelecionadoModal] = useState<Jogador | null>(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);
  const [editNome, setEditNome] = useState('');
  const [editSobrenome, setEditSobrenome] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPosicao, setEditPosicao] = useState<PosicaoJogador>('Meio');
  const [editMembro, setEditMembro] = useState<MembroStatus>('mensalista');
  const [editGold, setEditGold] = useState(false);
  const [editFoto, setEditFoto] = useState('');
  const [editError, setEditError] = useState('');

  const handlePlayerClick = (j: Jogador) => {
    setJogadorSelecionadoModal(j);
    setEditNome(j.nome);
    setEditSobrenome(j.sobrenome);
    setEditEmail(j.email || '');
    setEditPosicao(j.posicao);
    setEditMembro(j.membroStatus || 'mensalista');
    setEditGold(!!j.isGold);
    setEditFoto(j.foto || '');
    setEditError('');
    setShowPlayerModal(true);
  };

  const handleModalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setEditError('A foto do atleta deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setEditFoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSavePlayerFromModal = () => {
    if (!jogadorSelecionadoModal) return;
    if (!editNome.trim() || !editSobrenome.trim()) {
      setEditError('Nome e Sobrenome são obrigatórios.');
      return;
    }
    if (onEditarJogador) {
      onEditarJogador(jogadorSelecionadoModal.id, {
        nome: editNome.trim(),
        sobrenome: editSobrenome.trim(),
        email: editEmail.trim(),
        posicao: editPosicao,
        membroStatus: editMembro,
        isGold: editGold,
        foto: editFoto,
      });
    }
    setShowPlayerModal(false);
    setJogadorSelecionadoModal(null);
  };

  const handleDeletePlayerFromModal = () => {
    if (!jogadorSelecionadoModal) return;
    const confirmName = `${editNome} ${editSobrenome}`;
    if (window.confirm(`Tem certeza que deseja EXCLUIR permanentemente a conta de ${confirmName}? Esta ação é irreversível e excluirá o cadastro.`)) {
      if (onExcluirJogador) {
        onExcluirJogador(jogadorSelecionadoModal.id);
      }
      setShowPlayerModal(false);
      setJogadorSelecionadoModal(null);
    }
  };

  // Filtrar partidas que ocorrem na mesma semana do dia atual (domingo a sábado)
  const partidasAtivas = (() => {
    try {
      const agora = new Date();
      
      // Domingo da semana atual (00:00:00)
      const diaSemana = agora.getDay();
      const domingoSemana = new Date(agora);
      domingoSemana.setDate(agora.getDate() - diaSemana);
      domingoSemana.setHours(0, 0, 0, 0);

      // Sábado da semana atual (23:59:59)
      const sabadoSemana = new Date(domingoSemana);
      sabadoSemana.setDate(domingoSemana.getDate() + 6);
      sabadoSemana.setHours(23, 59, 59, 999);

      const filtradas = partidas.filter((p) => {
        const dataPartida = new Date(`${p.data}T12:00:00`);
        return dataPartida >= domingoSemana && dataPartida <= sabadoSemana;
      });

      if (filtradas.length > 0) return filtradas;
    } catch (e) {
      console.error('Erro ao processar datas da semana:', e);
    }
    // Fallback amigável caso não existam partidas cadastradas nesta semana específica
    return partidas.filter((p) => p.data >= '2026-05-31');
  })();

  // Ajustar partida selecionada caso a atual esteja vazia ou expirada
  const idPartidaCorrente = partidaSelecionadaId || partidasAtivas[0]?.id || null;
  const partidaSelecionada = partidas.find((p) => p.id === idPartidaCorrente);

  const formatarDataAmigavel = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const executarConfirmacaoPresenca = (id: string, confirmado: boolean) => {
    if (!idPartidaCorrente) return;
    onActualizarPresenca(idPartidaCorrente, id, confirmado);
    
    if (partidaSelecionada) {
      const dataAmigavel = formatarDataAmigavel(partidaSelecionada.data);
      const text = obterTextoConfirmacaoJogador(
        `${jogadorAtual.nome} ${jogadorAtual.sobrenome}`,
        partidaSelecionada.titulo,
        dataAmigavel,
        partidaSelecionada.horario,
        partidaSelecionada.local
      );

      if (whatsappAutomacaoAtiva) {
        // Envio automático via Bot do Racha de Futebol
        if (onRegistrarLogAutomacao) {
          onRegistrarLogAutomacao(
            `${jogadorAtual.nome} ${jogadorAtual.sobrenome}`,
            partidaSelecionada.titulo,
            confirmado 
              ? `Atleta confirmou presença no jogo do dia ${dataAmigavel}. Bot disparou alerta automático.`
              : `Atleta declarou ausência no jogo do dia ${dataAmigavel}. Bot disparou rebaixamento de escalação.`
          );
        }
        
        // Ativar animação/aviso do robô
        setAutoToastMsg(`🤖 [BOT DO WHATSAPP]: Confirmação registrada e enviada automaticamente para o grupo de WhatsApp!`);
        setShowAutoToast(true);
        setTimeout(() => {
          setShowAutoToast(false);
        }, 5000);
      } else {
        // Modo manual antigo de retransmissão
        if (confirmado) {
          setShareText(text);
          setShowShareModal(true);
        }
      }
    }
  };

  const handleConfirmarPresencaLocally = (id: string, confirmado: boolean) => {
    if (confirmado) {
      const v4 = parseFloat(localStorage.getItem('racha_valor_4s') || '85');
      const v5 = parseFloat(localStorage.getItem('racha_valor_5s') || '105');
      const vDiaria = parseFloat(localStorage.getItem('racha_valor_diaria') || '20');

      const debits = obterDebitosDoJogador(
        id,
        jogadorAtual.membroStatus,
        jogadorAtual.posicao,
        partidas,
        pagamentos,
        vDiaria,
        v4,
        v5
      );

      if (debits.length > 0) {
        // Se houver débitos, abre o pop-up e salva as variáveis de confirmação
        setDebitosPendentes(debits);
        setDadosConfirmacaoPendente({ id, confirmado });
        setShowInadimplenteModal(true);
        return;
      }
    }

    // Se estiver tudo OK ou se for recusa, executa normalmente
    executarConfirmacaoPresenca(id, confirmado);
  };

  const currentMatchId = partidaSelecionada?.id || '';

  // Mapear jogadores confirmados/recusados da partida selecionada
  const obterJogadorPorId = (id: string) => jogadores.find((j) => j.id === id);

  // 1. Obter todos os jogadores que clicaram em "Sim" (na ordem original de confirmação)
  const rawConfirmados = partidaSelecionada
    ? (partidaSelecionada.confirmados.map(obterJogadorPorId).filter(Boolean) as Jogador[])
    : [];

  const recusados = partidaSelecionada
    ? (partidaSelecionada.recusados.map(obterJogadorPorId).filter(Boolean) as Jogador[])
    : [];

  // 2. Separar em Confirmados (máximo 25 de linha + goleiros) e Lista de Espera utilizando as regras de prioridade
  const processarFilas = (lista: Jogador[]) => {
    const finalConfirmed: Jogador[] = [];
    const waitingList: Jogador[] = [];

    for (const jogador of lista) {
      if (jogador.posicao === 'Goleiro') {
        // Goleiros não entram na contagem dos 25 jogadores de linha e são confirmados direto
        finalConfirmed.push(jogador);
      } else {
        // Jogadores de linha estão sujeitos ao limite de 25
        const linePlayersConfirmed = finalConfirmed.filter(j => j.posicao !== 'Goleiro');

        if (linePlayersConfirmed.length < 25) {
          finalConfirmed.push(jogador);
        } else {
          // A lista de 25 jogadores de linha está cheia
          if (jogador.membroStatus === 'mensalista') {
            // Procurar por um diarista (de linha) entre os confirmados para enviar para a lista de espera
            const lastDiaristaLinhaIndex = finalConfirmed.map(j => j.posicao !== 'Goleiro' && j.membroStatus === 'diarista').lastIndexOf(true);
            
            if (lastDiaristaLinhaIndex !== -1) {
              const diaristaParaSair = finalConfirmed[lastDiaristaLinhaIndex];
              // Remove o diarista de finalConfirmed
              finalConfirmed.splice(lastDiaristaLinhaIndex, 1);
              // Adiciona o mensalista nos confirmados
              finalConfirmed.push(jogador);
              // O diarista vai para a lista de espera como o primeiro da lista (unshift)
              waitingList.unshift(diaristaParaSair);
            } else {
              // Se não há diaristas de linha nos confirmados, o mensalista vai para o final da lista de espera
              waitingList.push(jogador);
            }
          } else {
            // É diarista de linha, vai para o final da lista de espera (push)
            waitingList.push(jogador);
          }
        }
      }
    }

    return { finalConfirmed, waitingList };
  };

  const { finalConfirmed: todosConfirmados, waitingList: todosEspera } = processarFilas(rawConfirmados);

  // Mantém a compatibilidade com contadores e outras seções usando "confirmados.length"
  const confirmados = todosConfirmados;

  // Estado de filtro de membros: 'todos', 'mensalista' ou 'diarista'
  const [filtroMembro, setFiltroMembro] = useState<'todos' | 'mensalista' | 'diarista'>('todos');

  // Filtrar as listas conforme o filtro selecionado
  const filteredConfirmados = todosConfirmados.filter((j) => {
    if (filtroMembro === 'todos') return true;
    return j.membroStatus === filtroMembro;
  });

  const filteredEspera = todosEspera.filter((j) => {
    if (filtroMembro === 'todos') return true;
    return j.membroStatus === filtroMembro;
  });

  const filteredRecusados = recusados.filter((j) => {
    if (filtroMembro === 'todos') return true;
    return j.membroStatus === filtroMembro;
  });

  // Agrupamento por posição dos confirmados filtrados
  const goleirosConfirmados = filteredConfirmados.filter((j) => j.posicao === 'Goleiro');
  const defesasConfirmados = filteredConfirmados.filter((j) => j.posicao === 'Defesa');
  const meiosConfirmados = filteredConfirmados.filter((j) => j.posicao === 'Meio');
  const ataquesConfirmados = filteredConfirmados.filter((j) => j.posicao === 'Ataque');

  const goleirosNaOrdem = filteredConfirmados.filter((j) => j.posicao === 'Goleiro');
  const mensalistasNaOrdem = filteredConfirmados.filter((j) => j.posicao !== 'Goleiro' && j.membroStatus === 'mensalista');
  const diaristasNaOrdem = filteredConfirmados.filter((j) => j.posicao !== 'Goleiro' && j.membroStatus === 'diarista');

  const getOrdemDeConfirmacaoCount = (jogador: Jogador) => {
    const idx = filteredConfirmados.findIndex((j) => j.id === jogador.id);
    return idx !== -1 ? `${idx + 1}°` : '';
  };

  // Verificar se o usuário atual já marcou sim ou não
  const presencaUsuarioAtual = partidaSelecionada
    ? partidaSelecionada.confirmados.includes(jogadorAtual.id)
      ? 'sim'
      : partidaSelecionada.recusados.includes(jogadorAtual.id)
      ? 'nao'
      : 'pendente'
    : 'pendente';

  const getAvatarStyle = (jwtId: string) => {
    const avatar = AVATAR_PRESETS.find((p) => p.id === jwtId);
    return avatar || { color: '#000000', text: '⚪' };
  };

  function membrosMensalistasConfirmadosCount(lista: Jogador[]) {
    return lista.filter((j) => j.membroStatus === 'mensalista').length;
  }

  function membrosDiaristasConfirmadosCount(lista: Jogador[]) {
    return lista.filter((j) => j.membroStatus === 'diarista').length;
  }

  // Renderizar o bloco de posições de racha
  function renderPosicaoBloque(titulo: string, lista: Jogador[], mostrarOrdem: boolean = false) {
    return (
      <div className="bg-emerald-950/60 rounded-xl border border-white/10 overflow-hidden">
        <div className="bg-emerald-950/80 px-3 py-2 border-b border-white/10 flex justify-between items-center">
          <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest font-mono">{titulo}</span>
          <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded-full font-mono">{lista.length}</span>
        </div>
        
        {lista.length === 0 ? (
          <div className="px-3 py-4 text-emerald-500/50 font-sans text-[11px] italic bg-black/10 text-center">
            Nenhum atleta listado nesta categoria
          </div>
        ) : (
          <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
            {lista.map((j, index) => {
              const style = getAvatarStyle(j.foto);
              return (
                <div
                  id={`confirmado-pcard-${j.id || index}`}
                  key={j.id || index} 
                  onClick={() => handlePlayerClick(j)}
                  className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl group hover:bg-white/10 border border-white/5 hover:border-emerald-500/25 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    {mostrarOrdem && (
                      <span className="text-xs font-mono font-black text-emerald-400 w-6 text-right shrink-0 select-none">
                        {getOrdemDeConfirmacaoCount(j)}
                      </span>
                    )}
                    <div 
                      className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[10.5px] font-bold shadow shrink-0 overflow-hidden border border-white/10"
                      style={{ backgroundColor: style.color }}
                    >
                      {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                        <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'
                      )}
                    </div>
                    <div className="overflow-hidden min-w-0 text-left">
                      <p className="text-xs font-semibold text-white truncate flex items-center gap-1 leading-none">
                        <span>{j.nome} {j.sobrenome}</span>
                        {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-1 py-0.5 text-[9px] text-emerald-300 font-sans mt-1 leading-none">
                        <span className="bg-emerald-900/60 px-1.5 py-0.2 rounded text-[8px] font-semibold text-white font-mono uppercase">
                          {j.posicao === 'Goleiro' ? 'Goleiro' : j.posicao === 'Defesa' ? 'Defesa' : j.posicao === 'Meio' ? 'Meio' : 'Ataque'}
                        </span>
                        <span className="text-white/20 select-none">•</span>
                        <span className="truncate max-w-[100px]">{j.email}</span>
                      </div>
                    </div>
                  </div>

                  <span 
                    title={j.membroStatus === 'isento' ? 'Goleiro Isento' : j.membroStatus === 'mensalista' ? 'Membro Mensalista' : 'Jogador Diarista'}
                    className={`text-[8.5px] px-2 py-0.5 font-extrabold rounded-md uppercase font-mono tracking-wider shrink-0 shadow-sm ${
                      j.membroStatus === 'isento'
                        ? 'bg-emerald-950/85 border border-emerald-500/40 text-emerald-300'
                        : j.membroStatus === 'mensalista' 
                        ? 'bg-teal-950/60 border border-teal-500/35 text-teal-400' 
                        : 'bg-amber-950/60 border border-amber-500/35 text-amber-400'
                    }`}
                  >
                    {j.membroStatus === 'isento' ? 'ISENTO' : j.membroStatus === 'mensalista' ? 'MENSAL' : 'DIÁRIA'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div id="container-confirmacao-presenca" className="space-y-6 w-full max-w-7xl mx-auto animate-fade-in">
      
      {/* Seletor de Partida Ativa */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h2 id="titulo-confirmacao" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <Check className="w-5 h-5 text-emerald-400 border border-emerald-400 rounded-full" />
            Lista de Confirmação
          </h2>
          <p className="text-xs text-emerald-300/85 font-sans mt-0.5">
            Selecione uma das próximas datas da pelada agendadas e registre sua escalação oficial!
          </p>
        </div>

        {/* Seletor do Próximo Jogo */}
        {partidasAtivas.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest font-sans shrink-0">Jogo Ativo:</span>
            <select
              id="select-partida-confirmacao"
              value={idPartidaCorrente || ''}
              onChange={(e) => setPartidaSelecionadaId(e.target.value)}
              className="bg-emerald-950 border border-white/10 text-white text-xs font-bold font-mono rounded-lg px-3 py-2 cursor-pointer focus:outline-none focus:border-white"
            >
              {partidasAtivas.map((p) => (
                <option key={p.id} value={p.id} className="text-white bg-emerald-955">
                  [{formatarDataAmigavel(p.data)}] {p.titulo}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {partidaSelecionada ? (
        <div className="flex flex-col gap-6 w-full">
          
          {/* Bloco Geral do Jogo */}
          <div className={`bg-gradient-to-r ${partidaSelecionada.cancelada ? 'from-rose-950/40 to-rose-900/10 border-rose-500/25' : 'from-emerald-950/50 to-emerald-900/30 border-white/10'} border rounded-2xl p-5 relative overflow-hidden shadow-lg backdrop-blur-sm w-full`}>
              <div className="absolute right-4 top-4 text-emerald-500/10">
                <Users className="w-20 h-20 -mr-4 -mt-4 rotate-12" />
              </div>

              <div className="flex items-center gap-2 mb-2.5">
                <div className="inline-block px-2.5 py-0.5 bg-white/10 border border-white/10 text-emerald-300 text-[10px] font-bold rounded-full uppercase tracking-wider">
                  📅 Jogo Selecionado
                </div>
                {partidaSelecionada.cancelada && (
                  <span className="inline-block px-2.5 py-0.5 bg-rose-550 border border-rose-500 text-white text-[10px] font-black uppercase rounded-full tracking-wider animate-pulse">
                    🚫 CANCELADO
                  </span>
                )}
              </div>

              <h3 id="confirmacao-jogo-titulo" className={`text-lg font-display font-bold text-white leading-normal ${partidaSelecionada.cancelada ? 'line-through text-white/50' : ''}`}>
                {partidaSelecionada.titulo}
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs text-emerald-250 font-sans border-t border-white/10 pt-3.5">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="leading-none">Dia: <b className="text-white font-mono">{formatarDataAmigavel(partidaSelecionada.data)}</b></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="leading-none">Hora: <b className="text-white font-mono">{partidaSelecionada.horario}h</b></span>
                </div>
                <div className="flex items-center gap-1.5 col-span-1 sm:col-span-3">
                  <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span className="truncate leading-none">Local: <b className="text-white font-semibold">{partidaSelecionada.local}</b></span>
                </div>
              </div>

              {jogadorAtual.role === 'admin' && (
                <div id="admin-actions-partida-cancelamento" className="mt-4 pt-3.5 border-t border-dashed border-white/15 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs w-full">
                  <div className="flex flex-col text-left">
                    <span className="font-extrabold text-amber-400 uppercase tracking-wider text-[9.5px] font-mono">🔐 Controle do Administrador</span>
                    <span className="text-[10px] text-emerald-300">Marque se o jogo foi cancelado por fortuito/chuva.</span>
                  </div>
                  {partidaSelecionada.cancelada ? (
                    <button
                      id="btn-admin-reativar-jogo"
                      type="button"
                      onClick={() => onCancelarPartida && onCancelarPartida(partidaSelecionada.id, false)}
                      className="w-full sm:w-auto bg-emerald-555 hover:bg-emerald-500 text-bg shadow hover:shadow-lg hover:shadow-emerald-555/10 font-black px-4 py-2 rounded-xl text-[10px] tracking-widest uppercase cursor-pointer transition-all duration-200 border-none inline-flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: '#10b981', color: '#022c22' }}
                    >
                      <span>🔄 Reativar Partida</span>
                    </button>
                  ) : (
                    <button
                      id="btn-admin-cancelar-jogo"
                      type="button"
                      onClick={() => onCancelarPartida && onCancelarPartida(partidaSelecionada.id, true)}
                      className="w-full sm:w-auto bg-rose-650 hover:bg-rose-600 text-white font-extrabold px-4 py-2 rounded-xl text-[10px] tracking-widest uppercase cursor-pointer transition-all duration-200 shadow border-none inline-flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: '#e11d48' }}
                    >
                      <span>🚫 Cancelar Partida</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Regulamento de Confirmação */}
            {partidaSelecionada.data >= '2026-05-31' && (() => {
              const jan = getJanelaConfirmacao(partidaSelecionada.data);
              const isFechado = jan.status === 'fechado';
              return (
                <div className={`p-4 rounded-2xl text-xs flex items-start gap-2.5 border ${
                  isFechado 
                    ? 'bg-amber-955/45 border-amber-500/20 text-amber-200 shadow' 
                    : 'bg-emerald-950/45 border-emerald-500/25 text-emerald-100 shadow'
                }`}>
                  <AlertTriangle className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${isFechado ? 'text-amber-400' : 'text-emerald-400'}`} />
                  <div>
                    <h5 className="font-bold uppercase tracking-wide text-[10px] flex items-center gap-1">
                      {isFechado ? '🚨 Janela de Confirmação Fechada' : '✅ Janela de Confirmação Aberta'}
                    </h5>
                    <p className="mt-0.5 leading-relaxed text-[11px] text-emerald-250">
                      Regulamento: Terça-feira (<b>{jan.inicio.toLocaleDateString('pt-BR')}</b>) às 00:00 até Sexta-feira (<b>{jan.fim.toLocaleDateString('pt-BR')}</b>) às 23:59.
                    </p>
                    {isFechado && (
                      <span className="inline-block mt-1.5 text-[8.5px] bg-amber-550 text-black px-2 py-0.5 font-black uppercase rounded tracking-wider">FORA DO PRAZO DE REGULAMENTO</span>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* SUA CONFIRMAÇÃO PESSOAL */}
            {partidaSelecionada.data >= '2026-05-31' && (
              <div className="bg-emerald-950/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm space-y-4">
                <div>
                  <h4 className="text-xs font-bold uppercase text-emerald-400 tracking-wider">Sua Presença Oficial</h4>
                  <p className="text-[11px] text-emerald-300 font-sans mt-0.5">Marque se você estará em campo ou relate ausência justificada:</p>
                </div>

                {(() => {
                  if (partidaSelecionada.cancelada) {
                    return (
                      <div className="bg-rose-950/60 border border-rose-500/30 p-4 rounded-xl text-center space-y-2.5">
                        <div className="flex items-center justify-center gap-1.5 text-rose-450 font-black text-xs uppercase tracking-wide">
                          <ShieldAlert className="w-4.5 h-4.5 text-rose-500 animate-bounce" />
                          Partida Cancelada
                        </div>
                        <p className="text-[11px] text-rose-200 leading-relaxed font-sans">
                          Esta partida foi <b>cancelada administrativamente</b> devido a caso fortuito ou de força maior (chuva forte, colégio sem luz/agua, etc.).
                        </p>
                        <p className="text-[10px] text-rose-350 font-semibold font-mono">
                          As confirmações e agendamentos estão bloqueados para este dia.
                        </p>
                      </div>
                    );
                  }

                  const isDiarista = jogadorAtual.membroStatus === 'diarista';
                  const temDiariaPendente = pagamentos.some(
                    p => p.jogadorId === jogadorAtual.id && (p.status === 'pendente' || p.status === 'pendente_confirmacao')
                  );
                  const bloqueadoPorPendencia = false; // Desativado para usar pop-up de alerta dinâmico solicitado

                  return bloqueadoPorPendencia ? (
                    <div className="bg-rose-950/60 border border-rose-500/30 p-4 rounded-xl text-center space-y-2.5">
                      <div className="flex items-center justify-center gap-1.5 text-rose-400 font-extrabold text-xs uppercase tracking-wide">
                        <ShieldAlert className="w-4 h-4 text-rose-500" />
                        Confirmação Bloqueada
                      </div>
                      <p className="text-[11px] text-rose-200 leading-relaxed font-sans">
                        Você possui diárias pendentes de pagamento. Atletas diaristas com pendências financeiras no caixa estão impedidos de confirmar presença em novos jogos.
                      </p>
                      <div className="text-[10px] text-rose-350 font-mono">
                        Acesse a aba <b>Mensalidades/Caixa</b> para informar seu pagamento e aguarde a aprovação do administrador.
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        id="btn-presenca-sim"
                        type="button"
                        onClick={() => handleConfirmarPresencaLocally(jogadorAtual.id, true)}
                        className={`flex items-center justify-center gap-1.5 py-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                          presencaUsuarioAtual === 'sim'
                            ? 'bg-white text-black shadow-md ring-2 ring-white'
                            : 'bg-emerald-950/50 border border-white/10 text-emerald-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        Sim, vou jogar
                      </button>
                      <button
                        id="btn-presenca-nao"
                        type="button"
                        onClick={() => handleConfirmarPresencaLocally(jogadorAtual.id, false)}
                        className={`flex items-center justify-center gap-1.5 py-3 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${
                          presencaUsuarioAtual === 'nao'
                            ? 'bg-rose-750 text-white shadow shadow-rose-950 ring-2 ring-rose-500'
                            : 'bg-emerald-950/50 border border-white/10 text-emerald-300 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        <X className="w-4 h-4" />
                        Não vou jogar
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* LISTA ELENCO CONFIRMADO */}
            <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-5 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-3">
              <div>
                <h4 className="text-xs sm:text-sm font-bold uppercase text-white tracking-wide flex items-center gap-1.5">
                  🛡️ Elenco Confirmado ({todosConfirmados.filter(j => j.posicao !== 'Goleiro').length}/25 Linha + {todosConfirmados.filter(j => j.posicao === 'Goleiro').length} Goleiros)
                </h4>
                <p className="text-[10px] text-emerald-400 mt-0.5 font-sans">
                  Mensalistas: <b className="text-white">{todosConfirmados.filter(j => j.membroStatus === 'mensalista').length}</b> • Diaristas: <b className="text-white">{todosConfirmados.filter(j => j.membroStatus === 'diarista').length}</b>
                </p>
              </div>

              {/* Botões de Filtro */}
              <div className="flex items-center gap-1 bg-emerald-950/80 p-1 rounded-lg border border-white/5 shadow-inner">
                <button
                  type="button"
                  onClick={() => setFiltroMembro('todos')}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                    filtroMembro === 'todos'
                      ? 'bg-emerald-800 text-white shadow-sm'
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMembro('mensalista')}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                    filtroMembro === 'mensalista'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  Mensais
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroMembro('diarista')}
                  className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-md tracking-wider transition-all cursor-pointer ${
                    filtroMembro === 'diarista'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  Diárias
                </button>
              </div>
            </div>

            {/* Opções de Exibição */}
            <div className="flex items-center justify-between bg-emerald-950/45 p-2 rounded-xl border border-white/5 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider ml-1">Visualização:</span>
              <div className="flex items-center gap-1.5 bg-black/30 p-1 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setModoExibicao('posicao')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                    modoExibicao === 'posicao' 
                      ? 'bg-emerald-850 text-white shadow-sm font-mono' 
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  Por Posição
                </button>
                <button
                  type="button"
                  onClick={() => setModoExibicao('confirmacao')}
                  className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                    modoExibicao === 'confirmacao' 
                      ? 'bg-emerald-850 text-white shadow-sm font-mono' 
                      : 'text-emerald-300 hover:text-white'
                  }`}
                >
                  Ordem de Confirmação
                </button>
              </div>
            </div>

            {filteredConfirmados.length === 0 ? (
              <div className="text-center py-12 bg-emerald-950/30 rounded-2xl border border-dashed border-white/10 text-emerald-400/60 text-xs max-w-md mx-auto space-y-1.5">
                <Users className="w-8 h-8 mx-auto text-emerald-500/40" />
                <h5 className="font-bold text-white">Nenhum confirmado com este filtro</h5>
                <p className="text-[10px] text-emerald-400/80">Altere o filtro acima ou seja o primeiro a marcar presença!</p>
              </div>
            ) : modoExibicao === 'posicao' ? (
              <div className="space-y-4 animate-fade-in text-left">
                {/* GOLEIROS */}
                {renderPosicaoBloque('Goleiros', goleirosConfirmados, false)}

                {/* DEFESAS */}
                {renderPosicaoBloque('Defesas', defesasConfirmados, false)}

                {/* MEIO-CAMPISTAS */}
                {renderPosicaoBloque('Meio-Campistas', meiosConfirmados, false)}

                {/* ATACANTES */}
                {renderPosicaoBloque('Atacantes', ataquesConfirmados, false)}
              </div>
            ) : (
              <div className="space-y-4 animate-fade-in text-left">
                {/* 1. GOLEIROS */}
                <div className="bg-emerald-950/60 rounded-xl border border-white/10 overflow-hidden">
                  <div className="bg-emerald-950/80 px-3 py-2 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      🧤 Goleiros
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded-full font-mono">
                      {goleirosNaOrdem.length}
                    </span>
                  </div>
                  {goleirosNaOrdem.length === 0 ? (
                    <div className="px-3 py-4 text-emerald-500/50 font-sans text-[11px] italic bg-black/10 text-center">
                      Nenhum goleiro confirmado nesta lista
                    </div>
                  ) : (
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {goleirosNaOrdem.map((j, index) => {
                        const style = getAvatarStyle(j.foto);
                        return (
                          <div
                            id={`confirmado-ordem-card-goleiro-${j.id}`}
                            key={j.id}
                            onClick={() => handlePlayerClick(j)}
                            className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl group hover:bg-white/10 border border-white/5 hover:border-emerald-500/25 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="text-xs font-mono font-black text-emerald-400 w-6 text-right shrink-0 select-none">
                                {index + 1}°
                              </span>
                              <div 
                                className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[10.5px] font-bold shadow shrink-0 overflow-hidden border border-white/10"
                                style={{ backgroundColor: style.color }}
                              >
                                {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                                  <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  '🧤'
                                )}
                              </div>
                              <div className="overflow-hidden min-w-0">
                                <p className="text-xs font-semibold text-white truncate flex items-center gap-1 leading-none">
                                  <span>{j.nome} {j.sobrenome}</span>
                                  {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-1 py-0.5 text-[9px] text-emerald-300 font-sans mt-1 leading-none">
                                  <span className="bg-emerald-900/60 px-1.5 py-0.2 rounded text-[8px] font-semibold text-white font-mono uppercase">
                                    Goleiro
                                  </span>
                                  <span className="text-white/20 select-none">•</span>
                                  <span className="truncate max-w-[100px]">{j.email}</span>
                                </div>
                              </div>
                            </div>
                            <span className={`text-[8.5px] px-2 py-0.5 font-extrabold rounded-md uppercase font-mono tracking-wider shrink-0 shadow-sm ${
                              j.membroStatus === 'isento'
                                ? 'bg-emerald-950/85 border border-emerald-500/40 text-emerald-300'
                                : j.membroStatus === 'mensalista'
                                ? 'bg-teal-950/60 border border-teal-500/35 text-teal-400'
                                : 'bg-amber-950/60 border border-amber-500/35 text-amber-400'
                            }`}>
                              {j.membroStatus === 'isento' ? 'ISENTO' : j.membroStatus === 'mensalista' ? 'MENSAL' : 'DIÁRIA'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 2. JOGADORES MENSALISTAS */}
                <div className="bg-emerald-950/60 rounded-xl border border-white/10 overflow-hidden">
                  <div className="bg-emerald-950/80 px-3 py-2 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      🏃‍♂️ Jogadores Mensalistas
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded-full font-mono">
                      {mensalistasNaOrdem.length}
                    </span>
                  </div>
                  {mensalistasNaOrdem.length === 0 ? (
                    <div className="px-3 py-4 text-emerald-500/50 font-sans text-[11px] italic bg-black/10 text-center">
                      Nenhum jogador mensalista confirmado nesta lista
                    </div>
                  ) : (
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {mensalistasNaOrdem.map((j, index) => {
                        const style = getAvatarStyle(j.foto);
                        return (
                          <div
                            id={`confirmado-ordem-card-mensalista-${j.id}`}
                            key={j.id}
                            onClick={() => handlePlayerClick(j)}
                            className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl group hover:bg-white/10 border border-white/5 hover:border-emerald-500/25 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="text-xs font-mono font-black text-emerald-400 w-6 text-right shrink-0 select-none">
                                {index + 1}°
                              </span>
                              <div 
                                className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[10.5px] font-bold shadow shrink-0 overflow-hidden border border-white/10"
                                style={{ backgroundColor: style.color }}
                              >
                                {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                                  <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'
                                )}
                              </div>
                              <div className="overflow-hidden min-w-0">
                                <p className="text-xs font-semibold text-white truncate flex items-center gap-1 leading-none">
                                  <span>{j.nome} {j.sobrenome}</span>
                                  {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-1 py-0.5 text-[9px] text-emerald-300 font-sans mt-1 leading-none">
                                  <span className="bg-emerald-900/60 px-1.5 py-0.2 rounded text-[8px] font-semibold text-white font-mono uppercase">
                                    {j.posicao === 'Defesa' ? 'Defesa' : j.posicao === 'Meio' ? 'Meio' : 'Ataque'}
                                  </span>
                                  <span className="text-white/20 select-none">•</span>
                                  <span className="truncate max-w-[100px]">{j.email}</span>
                                </div>
                              </div>
                            </div>
                            <span className="text-[8.5px] px-2 py-0.5 font-extrabold rounded-md uppercase font-mono tracking-wider shrink-0 shadow-sm bg-teal-950/60 border border-teal-500/35 text-teal-400">
                              MENSAL
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. JOGADORES DIARISTAS */}
                <div className="bg-emerald-950/60 rounded-xl border border-white/10 overflow-hidden">
                  <div className="bg-emerald-950/80 px-3 py-2 border-b border-white/10 flex justify-between items-center">
                    <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-widest font-mono flex items-center gap-1.5">
                      🏃‍♂️ Jogadores Diaristas
                    </span>
                    <span className="text-[10px] font-bold bg-white/10 text-emerald-200 px-2 py-0.5 rounded-full font-mono">
                      {diaristasNaOrdem.length}
                    </span>
                  </div>
                  {diaristasNaOrdem.length === 0 ? (
                    <div className="px-3 py-4 text-emerald-500/50 font-sans text-[11px] italic bg-black/10 text-center">
                      Nenhum jogador diarista confirmado nesta lista
                    </div>
                  ) : (
                    <div className="p-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {diaristasNaOrdem.map((j, index) => {
                        const style = getAvatarStyle(j.foto);
                        return (
                          <div
                            id={`confirmado-ordem-card-diarista-${j.id}`}
                            key={j.id}
                            onClick={() => handlePlayerClick(j)}
                            className="flex items-center justify-between p-2.5 bg-white/5 rounded-xl group hover:bg-white/10 border border-white/5 hover:border-emerald-500/25 transition-all cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <span className="text-xs font-mono font-black text-emerald-400 w-6 text-right shrink-0 select-none">
                                {index + 1}°
                              </span>
                              <div 
                                className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[10.5px] font-bold shadow shrink-0 overflow-hidden border border-white/10"
                                style={{ backgroundColor: style.color }}
                              >
                                {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                                  <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'
                                )}
                              </div>
                              <div className="overflow-hidden min-w-0">
                                <p className="text-xs font-semibold text-white truncate flex items-center gap-1 leading-none">
                                  <span>{j.nome} {j.sobrenome}</span>
                                  {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                                </p>
                                <div className="flex flex-wrap items-center gap-x-1 py-0.5 text-[9px] text-emerald-300 font-sans mt-1 leading-none">
                                  <span className="bg-emerald-900/60 px-1.5 py-0.2 rounded text-[8px] font-semibold text-white font-mono uppercase">
                                    {j.posicao === 'Defesa' ? 'Defesa' : j.posicao === 'Meio' ? 'Meio' : 'Ataque'}
                                  </span>
                                  <span className="text-white/20 select-none">•</span>
                                  <span className="truncate max-w-[100px]">{j.email}</span>
                                </div>
                              </div>
                            </div>
                            <span className="text-[8.5px] px-2 py-0.5 font-extrabold rounded-md uppercase font-mono tracking-wider shrink-0 shadow-sm bg-amber-950/60 border border-amber-500/35 text-amber-400">
                              DIÁRIA
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEÇÃO LISTA DE ESPERA */}
            <div className="pt-4 border-t border-white/10 shadow-sm animate-fade-in text-left">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-[10.5px] font-bold text-amber-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  ⏳ Lista de Espera ({todosEspera.length})
                </h5>
                {todosEspera.length > 0 && (
                  <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 font-extrabold px-1.5 py-0.5 rounded uppercase">
                    Aguardando vaga
                  </span>
                )}
              </div>

              {todosEspera.length === 0 ? (
                <div className="px-3 py-4 text-emerald-500/50 font-sans text-xs italic bg-emerald-950/20 rounded-xl border border-white/5 text-center">
                  Lista de espera vazia. Vagas de convocados totalmente garantidas!
                </div>
              ) : filteredEspera.length === 0 ? (
                <div className="px-3 py-4 text-emerald-500/50 font-sans text-xs italic bg-emerald-950/20 rounded-xl border border-white/5 text-center">
                  Ninguém na lista de espera corresponde ao filtro ativo.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredEspera.map((j, index) => {
                    const style = getAvatarStyle(j.foto);
                    return (
                      <div
                        id={`espera-card-${j.id || index}`}
                        key={j.id || index}
                        onClick={() => handlePlayerClick(j)}
                        className="flex items-center justify-between p-2 bg-black/20 border border-white/5 hover:border-emerald-500/25 rounded-lg group hover:bg-white/5 transition-all font-sans cursor-pointer animate-fade-in"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 bg-amber-950 border border-amber-500/30 text-amber-400 font-mono shadow"
                          >
                            #{index + 1}
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <p className="text-xs font-semibold text-white truncate flex items-center gap-1">
                              <span>{j.nome} {j.sobrenome}</span>
                              {j.isGold && <span className="text-xs select-none" title="Jogador Gold">🏅</span>}
                            </p>
                            <p className="text-[9px] text-emerald-400 truncate">
                              {j.posicao === 'Goleiro' ? '🧤 Goleiro' : j.posicao === 'Defesa' ? '🛡️ Defesa' : j.posicao === 'Meio' ? '🧠 Meio' : '🚀 Ataque'}
                            </p>
                          </div>
                        </div>

                        <span
                          title={j.membroStatus === 'isento' ? 'Goleiro Isento' : j.membroStatus === 'mensalista' ? 'Membro Mensalista' : 'Jogador Diarista'}
                          className={`text-[9px] px-2 py-0.5 font-extrabold rounded-md uppercase font-mono tracking-wider shrink-0 shadow-sm ${
                            j.membroStatus === 'isento'
                              ? 'bg-emerald-950/85 border border-emerald-500/40 text-emerald-300'
                              : j.membroStatus === 'mensalista'
                              ? 'bg-teal-950/60 border border-teal-500/35 text-teal-400'
                              : 'bg-amber-950/60 border border-amber-500/35 text-amber-400'
                          }`}
                        >
                          {j.membroStatus === 'isento' ? 'ISENTO' : j.membroStatus === 'mensalista' ? 'MENSAL' : 'DIÁRIA'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SEÇÃO LISTA DE AUSENTES */}
            <div className="pt-4 border-t border-white/10 shadow-sm animate-fade-in text-left">
              <div className="flex items-center justify-between mb-3">
                <h5 className="text-[10.5px] font-bold text-rose-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                  🚫 Lista de Ausentes ({recusados.length})
                </h5>
                {recusados.length > 0 && (
                  <span className="text-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-400 font-extrabold px-1.5 py-0.5 rounded uppercase">
                    Ausência Declarada
                  </span>
                )}
              </div>

              {recusados.length === 0 ? (
                <div className="px-3 py-4 text-emerald-500/50 font-sans text-xs italic bg-emerald-950/20 rounded-xl border border-white/5 text-center">
                  Nenhum atleta declarou ausência para este jogo. Elenco 100% focado!
                </div>
              ) : filteredRecusados.length === 0 ? (
                <div className="px-3 py-4 text-emerald-500/50 font-sans text-xs italic bg-emerald-950/20 rounded-xl border border-white/5 text-center">
                  Nenhum atleta ausente corresponde ao filtro ativo.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filteredRecusados.map((j, index) => {
                    const style = getAvatarStyle(j.foto);
                    return (
                      <div
                        id={`ausente-card-${j.id || index}`}
                        key={j.id || index}
                        onClick={() => handlePlayerClick(j)}
                        className="flex items-center justify-between p-2 bg-rose-955/10 hover:bg-rose-955/20 border border-rose-900/20 hover:border-rose-500/25 rounded-lg group transition-all font-sans cursor-pointer animate-fade-in opacity-80 hover:opacity-100"
                        style={{ backgroundColor: 'rgba(159, 18, 57, 0.08)' }}
                      >
                        <div className="flex items-center gap-2 overflow-hidden bg-transparent">
                          <div 
                            className="w-7.5 h-7.5 rounded-full flex items-center justify-center text-[10.5px] font-bold shadow shrink-0 overflow-hidden border border-white/10"
                            style={{ backgroundColor: style.color }}
                          >
                            {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                              <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                            ) : (
                              j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'
                            )}
                          </div>
                          <div className="overflow-hidden min-w-0">
                            <p className="text-xs font-semibold text-white/90 truncate flex items-center gap-1 line-through decoration-rose-500/60">
                              <span>{j.nome} {j.sobrenome}</span>
                              {j.isGold && <span className="text-xs select-none no-underline inline-block" title="Jogador Gold">🏅</span>}
                            </p>
                            <p className="text-[9px] text-rose-300 font-medium truncate flex items-center gap-1 leading-normal">
                              <span>{j.posicao === 'Goleiro' ? '🧤 Goleiro' : j.posicao === 'Defesa' ? '🛡️ Defesa' : j.posicao === 'Meio' ? '🧠 Meio' : '🚀 Ataque'}</span>
                            </p>
                          </div>
                        </div>

                        <span
                          title={j.membroStatus === 'isento' ? 'Goleiro Isento' : j.membroStatus === 'mensalista' ? 'Membro Mensalista' : 'Jogador Diarista'}
                          className={`text-[9px] px-2 py-0.5 font-extrabold rounded-md uppercase font-mono tracking-wider shrink-0 shadow-sm ${
                            j.membroStatus === 'isento'
                              ? 'bg-rose-950/40 border border-rose-500/20 text-rose-300'
                              : j.membroStatus === 'mensalista'
                              ? 'bg-rose-950/60 border border-rose-500/35 text-rose-400'
                              : 'bg-rose-900/40 border border-stone-500/25 text-stone-300'
                          }`}
                        >
                          {j.membroStatus === 'isento' ? 'ISENTO' : j.membroStatus === 'mensalista' ? 'MENSAL' : 'DIÁRIA'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center text-emerald-300 bg-emerald-900/40 border border-white/10 rounded-2xl p-6">
          <ShieldAlert className="w-12 h-12 text-emerald-500/65 mb-3 animate-bounce" />
          <h3 className="font-display font-semibold text-lg text-white">Sem Jogos Ativos no Mês</h3>
          <p className="text-xs text-emerald-400 max-w-sm mt-1">
            Seja paciente! Novas datas para o jogo serão cadastradas breve pelos coordenadores no painel de administração.
          </p>
        </div>
      )}

      {/* MODAL DE COMPARTILHAMENTO WHATSAPP */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-emerald-950 border border-white/20 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-emerald-400" />
                Compartilhar no WhatsApp
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowShareModal(false);
                  setCopiedShare(false);
                }}
                className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-all text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">Mensagem Gerada:</label>
              <textarea
                className="w-full h-44 p-3 text-xs font-mono bg-black/40 border border-white/10 rounded-xl text-white resize-none focus:outline-none focus:border-emerald-500"
                readOnly
                value={shareText}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(shareText);
                  setCopiedShare(true);
                  setTimeout(() => setCopiedShare(false), 2500);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                {copiedShare ? (
                  <>
                    <Check className="w-4 h-4 text-teal-400" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-emerald-400" />
                    Copiar Mensagem
                  </>
                )}
              </button>

              <a
                href={gerarLinkCompartilhamento(shareText)}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  setShowShareModal(false);
                  setCopiedShare(false);
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-bold bg-teal-500 hover:bg-teal-400 text-emerald-950 font-extrabold transition-all text-center rounded-xl"
              >
                <Send className="w-4 h-4" />
                Ir para o WhatsApp
              </a>
            </div>

            <p className="text-[9px] text-emerald-400/80 text-center font-mono leading-relaxed">
              O link abrirá o WhatsApp Web ou App oficial com o texto pré-carregado. Caso o seu navegador bloqueie, copie o texto manualmente.
            </p>
          </div>
        </div>
      )}

      {/* POPUP / MODAL DE INFORMAÇÕES E EDIÇÃO DO ATLETA */}
      {showPlayerModal && jogadorSelecionadoModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
          <div className="bg-emerald-950/95 border border-white/20 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 backdrop-blur-md my-8">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                👤 Ficha do Atleta
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPlayerModal(false);
                  setJogadorSelecionadoModal(null);
                }}
                className="text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-full p-1.5 transition-all text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-red-950/40 border border-red-500/20 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <div className="space-y-4 text-left">
              {/* Seção da Foto do Atleta (INSIRA SUA FOTO) */}
              <div className="flex flex-col items-center gap-2.5 bg-black/20 p-4 rounded-xl border border-white/5">
                <span className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider block">INSIRA SUA FOTO</span>
                <div 
                  className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold shadow-md shrink-0 overflow-hidden border-2 border-emerald-500/30"
                  style={{ backgroundColor: getAvatarStyle(jogadorSelecionadoModal.foto).color }}
                >
                  {editFoto ? (
                    <img src={editFoto} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    <span>⚽</span>
                  )}
                </div>

                {(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id) && (
                  <div className="relative">
                    <input
                      id="modal-avatar-file-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleModalFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="modal-avatar-file-upload"
                      className="cursor-pointer bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 hover:text-white px-3 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1.5 transition-all select-none"
                    >
                      <Edit2 className="w-3 h-3 text-emerald-400" />
                      Escolher Nova Foto
                    </label>
                  </div>
                )}
              </div>

              {/* Informações Básicas do Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">Nome:</label>
                  <input
                    type="text"
                    disabled={!(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id)}
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[10.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">Sobrenome:</label>
                  <input
                    type="text"
                    disabled={!(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id)}
                    value={editSobrenome}
                    onChange={(e) => setEditSobrenome(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">E-mail:</label>
                <input
                  type="email"
                  disabled={!(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id)}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-[10.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">Posição:</label>
                  <select
                    disabled={!(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id)}
                    value={editPosicao}
                    onChange={(e) => {
                      const newPos = e.target.value as PosicaoJogador;
                      setEditPosicao(newPos);
                      if (newPos === 'Goleiro') {
                        setEditMembro('isento');
                      } else if (editMembro === 'isento') {
                        setEditMembro('mensalista');
                      }
                    }}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    <option value="Goleiro">🧤 Goleiro</option>
                    <option value="Defesa">🛡️ Defesa</option>
                    <option value="Meio">🧠 Meio-Campo</option>
                    <option value="Ataque">🚀 Atacante</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">Status de Membro:</label>
                  <select
                    disabled={!(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id) && editPosicao !== 'Goleiro'}
                    value={editMembro}
                    onChange={(e) => setEditMembro(e.target.value as MembroStatus)}
                    className="w-full bg-neutral-900 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 disabled:opacity-50"
                  >
                    {editPosicao === 'Goleiro' ? (
                      <option value="isento">Isento</option>
                    ) : (
                      <>
                        <option value="mensalista">Mensalista</option>
                        <option value="diarista">Diarista (Avulso)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Opções Admin-Only: Status, Gold, Admin Role */}
              {jogadorAtual.role === 'admin' && (
                <div className="bg-emerald-900/30 border border-emerald-500/20 rounded-xl p-4 space-y-3.5 mt-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400">🛡️ Controles de Coordenação</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[9.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">Status da Conta:</label>
                      <select
                        value={jogadorSelecionadoModal.status}
                        onChange={(e) => {
                          if (onEditarJogador) {
                            onEditarJogador(jogadorSelecionadoModal.id, { status: e.target.value as any });
                          }
                        }}
                        className="w-full bg-neutral-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none"
                      >
                        <option value="ativo">Ativo (Habilitado)</option>
                        <option value="pendente_aprovacao">Pendente Aprovação</option>
                        <option value="suspenso">Suspenso</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[9.5px] text-emerald-300 font-bold uppercase block tracking-wider mb-1">Permissão Admin:</label>
                      <select
                        value={jogadorSelecionadoModal.role}
                        onChange={(e) => {
                          if (onEditarJogador) {
                            onEditarJogador(jogadorSelecionadoModal.id, { role: e.target.value as any });
                          }
                        }}
                        className="w-full bg-neutral-950 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none"
                      >
                        <option value="jogador">Jogador Comum</option>
                        <option value="admin">Administrador Geral</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      id="modal-is-gold-checkbox"
                      type="checkbox"
                      checked={editGold}
                      onChange={(e) => setEditGold(e.target.checked)}
                      className="w-3.5 h-3.5 accent-emerald-500 cursor-pointer"
                    />
                    <label htmlFor="modal-is-gold-checkbox" className="text-[11px] text-emerald-250 font-bold cursor-pointer select-none">
                      🏅 Conceder Status Gold (Destaque visual especial)
                    </label>
                  </div>
                </div>
              )}

              {!(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id) && (
                <p className="text-[10px] text-emerald-400 italic font-medium text-center bg-white/5 border border-white/5 p-2 rounded-xl">
                  ℹ️ Visualizando ficha do atleta. Modificações bloqueadas (apenas o próprio ou coordenadores).
                </p>
              )}
            </div>

            {/* Ações / Botões do rodapé do popup */}
            <div className="flex flex-col sm:flex-row items-center justify-between border-t border-white/10 pt-4 gap-3">
              <div>
                {(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id) ? (
                  <button
                    id="btn-excluir-atleta-modal"
                    type="button"
                    onClick={handleDeletePlayerFromModal}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-950/40 hover:bg-rose-900 border border-rose-500/35 hover:border-rose-500 text-rose-400 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer select-none"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Excluir Conta
                  </button>
                ) : <div />}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowPlayerModal(false);
                    setJogadorSelecionadoModal(null);
                  }}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>

                {(jogadorAtual.role === 'admin' || jogadorAtual.id === jogadorSelecionadoModal.id) && (
                  <button
                    type="button"
                    onClick={handleSavePlayerFromModal}
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-extrabold rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Salvar Alterações
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showAutoToast && (
        <div className="fixed bottom-6 right-6 bg-teal-500 text-emerald-950 font-extrabold px-5 py-4 rounded-2xl shadow-2xl border border-teal-300 z-50 flex items-center gap-3 animate-bounce max-w-sm sm:max-w-md">
          <span className="text-xl">🤖</span>
          <div className="text-left font-sans">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-950">Bot de Automação Pelada</h5>
            <p className="text-[11px] font-bold mt-0.5 leading-snug">{autoToastMsg}</p>
          </div>
        </div>
      )}

      {/* MODAL DE ALERTA DE INADIMPLÊNCIA */}
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
                Prezado(a) <strong className="text-white">{jogadorAtual.nome} {jogadorAtual.sobrenome}</strong>, detectamos débitos pendentes de quitação no caixa.
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

              <p className="text-[11px] text-rose-200/80 leading-relaxed italic bg-rose-500/5 p-3 rounded-xl border border-rose-500/10">
                Por favor, solicitamos a regularização desses débitos no sistema para manter o compromisso com nossa pelada e com o aluguel da quadra. Os débitos encontram-se descritos no seu histórico de mensalidades/caixa.
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                id="btn-confirmar-inadimplente-prosseguir"
                onClick={() => {
                  setShowInadimplenteModal(false);
                  if (dadosConfirmacaoPendente) {
                    executarConfirmacaoPresenca(dadosConfirmacaoPendente.id, dadosConfirmacaoPendente.confirmado);
                    setDadosConfirmacaoPendente(null);
                  }
                }}
                className="w-full py-2.5 bg-rose-500 hover:bg-rose-400 text-black font-black text-xs rounded-xl transition-all shadow-md active:scale-97 text-center cursor-pointer uppercase"
              >
                Confirmar Presença e Regularizar depois
              </button>
              <button
                type="button"
                id="btn-confirmar-inadimplente-fechar"
                onClick={() => {
                  setShowInadimplenteModal(false);
                  setDadosConfirmacaoPendente(null);
                }}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all text-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
