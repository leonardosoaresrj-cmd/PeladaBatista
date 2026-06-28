/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Jogador, PosicaoJogador, MembroStatus, Partida, Pagamento, RoleUsuario } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Users, Trash2, Shield, Calendar, Edit2, Check, X, ShieldAlert, Award, Share2, Send, Copy, History, DollarSign, ArrowLeftRight } from 'lucide-react';
import { obterTextoListaCompletaPartida, gerarLinkCompartilhamento, obterJanelaRenovacaoParaMesRef, isFechamentoMensalistas, obterDebitosDoJogador } from '../utils/confirmationRules';

interface ListaCadastradosProps {
  jogadores: Jogador[];
  partidas: Partida[];
  jogadorAtual: Jogador;
  pagamentos?: Pagamento[];
  onExcluirJogador: (id: string) => void;
  onEditarJogador: (id: string, camposAtualizados: Partial<Jogador>) => void;
  proximaPartida?: Partida | null;
  onActualizarPresenca?: (partidaId: string, jogadorId: string, confirmado: boolean | null) => void;
  whatsappAutomacaoAtiva?: boolean;
}

export default function ListaCadastrados({
  jogadores,
  partidas,
  jogadorAtual,
  pagamentos = [],
  onExcluirJogador,
  onEditarJogador,
  proximaPartida,
  onActualizarPresenca,
  whatsappAutomacaoAtiva = true,
}: ListaCadastradosProps) {
  // Filtrar apenas jogadores "Ativo" (e "Suspenso" se for admin) para a área pública de cadastrados
  const jogadoresAtivos = jogadores.filter(j => j.status === 'ativo' || (jogadorAtual.role === 'admin' && j.status === 'suspenso'));

  // Separar e contar ativos para goleiros, mensalistas e diaristas
  const goleirosAtivos = jogadoresAtivos.filter(j => j.posicao === 'Goleiro');
  const mensalistasAtivos = jogadoresAtivos.filter(j => j.posicao !== 'Goleiro' && j.membroStatus === 'mensalista');
  const diaristasAtivos = jogadoresAtivos.filter(j => j.posicao !== 'Goleiro' && j.membroStatus === 'diarista');

  // Controle de Edição Administrativa e Pessoal
  const [jogadorEditandoId, setJogadorEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSobrenome, setEditSobrenome] = useState('');
  const [editPosicao, setEditPosicao] = useState<PosicaoJogador>('Meio');
  const [editMembro, setEditMembro] = useState<MembroStatus>('mensalista');
  const [editIsGold, setEditIsGold] = useState(false);
  const [editFoto, setEditFoto] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [editRole, setEditRole] = useState<RoleUsuario>('jogador');
  const [showConfirmacaoCadastrados, setShowConfirmacaoCadastrados] = useState(false);

  // Estados para Whatsapp e Compartilhamento Manual (Automação de Admin)
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState('');
  const [copiedShare, setCopiedShare] = useState(false);
  const [showAutoToast, setShowAutoToast] = useState(false);
  const [autoToastMsg, setAutoToastMsg] = useState('');
  const [jogadorHistoricoSelecionado, setJogadorHistoricoSelecionado] = useState<Jogador | null>(null);
  const [jogadorExclusaoModal, setJogadorExclusaoModal] = useState<Jogador | null>(null);
  const [anoHistorico, setAnoHistorico] = useState<string>('2026');

  // Computa o histórico detalhado mês a mês do jogador
  const obterHistoricoMensalDoJogador = (j: Jogador, ano: string) => {
    // Meses de referência da temporada
    const mesesCobranca = [`${ano}-05`, `${ano}-06`, `${ano}-07`, `${ano}-08`];
    const mesesNomes: Record<string, string> = {
      [`${ano}-05`]: `Maio / ${ano}`,
      [`${ano}-06`]: `Junho / ${ano}`,
      [`${ano}-07`]: `Julho / ${ano}`,
      [`${ano}-08`]: `Agosto / ${ano}`
    };

    return mesesCobranca.map((mes) => {
      const isGoleiro = j.posicao === 'Goleiro';
      const isIsento = j.membroStatus === 'isento';

      // Filtrar todos os pagamentos daquele mês que não foram cancelados
      const pagamentosDoMes = pagamentos.filter(
        (p) => p.jogadorId === j.id && p.mesRef === mes && p.status !== 'cancelado'
      );

      // Soma de todos os valores realmente quitados neste mês
      const totalPago = pagamentosDoMes
        .filter((p) => p.status === 'pago')
        .reduce((sum, p) => sum + p.valor, 0);

      let situacao: 'Mensalista' | 'Diarista' | 'Isento' = 'Diarista';
      let quitado = false;
      let detalhesStatus = 'Sem histórico';
      let rebaixadoTemporario = false;

      if (isGoleiro || isIsento) {
        situacao = 'Isento';
        quitado = true;
        detalhesStatus = 'Isento';
      } else if (j.membroStatus === 'mensalista') {
        // Encontrar pagamento de mensalidade (onde partidaId está ausente), incluindo cancelados
        const pagMensalCancelado = pagamentos.find((p) => p.jogadorId === j.id && p.mesRef === mes && !p.partidaId && p.status === 'cancelado');
        const pagMensal = pagamentosDoMes.find((p) => !p.partidaId);

        if (pagMensalCancelado) {
          situacao = 'Mensalista';
          quitado = true;
          detalhesStatus = 'Cobrança Cancelada 🚫';
          rebaixadoTemporario = false;
        } else if (pagMensal?.status === 'pago') {
          situacao = 'Mensalista';
          quitado = true;
          detalhesStatus = 'Quitado (Mensalidade)';
        } else if (pagMensal?.status === 'pendente_confirmacao') {
          situacao = 'Mensalista';
          quitado = false;
          detalhesStatus = 'Aguardando Aprovação de PIX';
        } else {
          // Inadimplente: temporariamente rebaixado a Diarista conforme regulamento
          situacao = 'Diarista';
          quitado = false;
          detalhesStatus = pagMensal ? 'Mensalidade Pendente' : 'Inadimplente';
          rebaixadoTemporario = true;
        }
      } else {
        // Diarista regular
        situacao = 'Diarista';

        // Filtrar as partidas fechadas ou passadas daquele mês onde o jogador estava confirmado
        const dataHojeStr = new Date().toISOString().split('T')[0];
        const partidasConfirmadas = partidas.filter(
          (p) => !p.cancelada && p.data.substring(0, 7) === mes && p.data < dataHojeStr && p.confirmados.includes(j.id)
        );

        if (partidasConfirmadas.length === 0) {
          quitado = true;
          detalhesStatus = 'Nenhuma Pelada Confirmada';
        } else {
          // Verificar se todos os pagamentos de diária foram realizados ou cancelados
          const todasPagasOuCanceladas = partidasConfirmadas.every((ptId) => {
            const pgEncontrado = pagamentos.find((p) => p.jogadorId === j.id && p.partidaId === ptId.id);
            return pgEncontrado?.status === 'pago' || pgEncontrado?.status === 'cancelado';
          });

          quitado = todasPagasOuCanceladas;

          const nPagas = partidasConfirmadas.filter((ptId) => {
            const pgEncontrado = pagamentos.find((p) => p.jogadorId === j.id && p.partidaId === ptId.id);
            return pgEncontrado?.status === 'pago';
          }).length;

          const nCanceladas = partidasConfirmadas.filter((ptId) => {
            const pgEncontrado = pagamentos.find((p) => p.jogadorId === j.id && p.partidaId === ptId.id);
            return pgEncontrado?.status === 'cancelado';
          }).length;

          if (todasPagasOuCanceladas) {
            detalhesStatus = nCanceladas === partidasConfirmadas.length ? 'Isento/Cancelado 🚫' : 'Quitado';
          } else {
            detalhesStatus = `${nPagas} de ${partidasConfirmadas.length} Jogos Pagos`;
          }
        }
      }

      return {
        mesValue: mes,
        mesLabel: mesesNomes[mes] || mes,
        situacao,
        quitado,
        detalhesStatus,
        totalPago,
        rebaixadoTemporario,
        pagamentos: pagamentosDoMes
      };
    });
  };

  const handlePresencaAdminClick = async (jog: Jogador, confirmado: boolean) => {
    if (!proximaPartida || !onActualizarPresenca) return;
    
    // Confirma ou nega a presença para a próxima partida
    onActualizarPresenca(proximaPartida.id, jog.id, confirmado);
    
    // Gerar objeto de partida atualizada de forma otimista para a mensagem
    const partidaAtualizada = { ...proximaPartida };
    partidaAtualizada.confirmados = partidaAtualizada.confirmados.filter(jId => jId !== jog.id);
    partidaAtualizada.recusados = partidaAtualizada.recusados.filter(jId => jId !== jog.id);
    if (confirmado) {
      partidaAtualizada.confirmados.push(jog.id);
    } else {
      partidaAtualizada.recusados.push(jog.id);
    }

    const msgAtualizada = obterTextoListaCompletaPartida(partidaAtualizada, jogadores, window.location.origin);

    // Removed WhatsApp toast and modal for individual confirmation as per user request
  };

  // Função para verificar a janela de renovação mensal
  const checkJanelaRenovacao = () => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth();

    const janelaAtual = obterJanelaRenovacaoParaMesRef(ano, mes);
    let janelaEscolhida = janelaAtual;

    if (agora > janelaAtual.fim) {
      let proxMes = mes + 1;
      let proxAno = ano;
      if (proxMes > 11) {
        proxMes = 0;
        proxAno += 1;
      }
      janelaEscolhida = obterJanelaRenovacaoParaMesRef(proxAno, proxMes);
    }

    const estaAberta = isFechamentoMensalistas(agora).emPeriodo;

    return {
      estaAberta,
      inicio: janelaEscolhida.inicio,
      fim: janelaEscolhida.fim,
      primeiroJogo: ""
    };
  };

  const janelaInfo = checkJanelaRenovacao();

  const formatarData = (d: Date) => {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} às ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setEditFoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const calcularIdade = (dataNascimento: string) => {
    if (!dataNascimento) return 0;
    const hoje = new Date();
    const nasc = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const handleSalvarEdicao = (id: string) => {
    onEditarJogador(id, {
      nome: editNome,
      sobrenome: editSobrenome,
      posicao: editPosicao,
      membroStatus: editMembro,
      isGold: editIsGold,
      foto: editFoto,
      dataNascimento: editDataNascimento,
      senha: editSenha,
      role: editRole,
    });
    setJogadorEditandoId(null);
    setShowConfirmacaoCadastrados(true);
  };

  const iniciarEdicao = (jog: Jogador) => {
    setJogadorEditandoId(jog.id);
    setEditNome(jog.nome);
    setEditSobrenome(jog.sobrenome);
    setEditPosicao(jog.posicao);
    setEditMembro(jog.membroStatusDb ?? jog.membroStatus);
    setEditIsGold(jog.isGoldDb !== undefined ? !!jog.isGoldDb : !!jog.isGold);
    setEditFoto(jog.foto || '');
    setEditDataNascimento(jog.dataNascimento || '');
    setEditSenha(jog.senha || '');
    setEditRole(jog.role || 'jogador');
  };

  // Helper para renderizar um card de jogador
  const renderJogadorCard = (j: Jogador) => {
    const isEditing = jogadorEditandoId === j.id;
    const jersey = AVATAR_PRESETS.find(p => p.id === j.foto) || AVATAR_PRESETS[0];

    return (
      <div
        id={`jogador-card-${j.id}`}
        key={j.id}
        className="bg-emerald-900/40 border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:border-white/15 backdrop-blur-sm transition-all flex flex-col justify-between"
      >
        {/* Cabeçalho do Card */}
        <div className="p-4 flex gap-4 items-start">
          
          {/* Jersey / Visual Avatar */}
          <div 
            className="w-16 h-16 rounded-full flex flex-col items-center justify-center shrink-0 border border-white/10 relative shadow-inner overflow-hidden cursor-zoom-in hover:scale-105 active:scale-97 transition-all duration-200"
            style={{ backgroundColor: jersey.color }}
            onClick={() => {
              if (j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:'))) {
                (window as any).ampliarFoto?.(j.foto, `${j.nome} ${j.sobrenome}`);
              }
            }}
            title={j.foto ? "Clique para ampliar a foto" : undefined}
          >
            {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
              <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="Avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-xl font-bold font-display" style={{ color: jersey.text === '⚪' ? '#fff' : '#000' }}>
                {j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'}
              </span>
            )}
            <span className="text-[8px] text-white font-extrabold bg-emerald-955/90 px-1.5 py-0.5 border border-white/10 rounded absolute -bottom-1 uppercase font-mono tracking-wider whitespace-nowrap">
              {j.posicao === 'Goleiro' ? '🧤 GOL' : j.posicao === 'Defesa' ? '🛡️ DEF' : j.posicao === 'Meio' ? '🧠 MEI' : '🚀 ATA'}
            </span>
          </div>

          {/* Informações de Perfil */}
          <div className="flex-1 overflow-hidden">
            {isEditing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id={`input-edit-nome-${j.id}`}
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    placeholder="Nome"
                    className="bg-emerald-950/80 border border-white/10 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-white"
                  />
                  <input
                    id={`input-edit-sobrenome-${j.id}`}
                    value={editSobrenome}
                    onChange={(e) => setEditSobrenome(e.target.value)}
                    placeholder="Sobrenome"
                    className="bg-emerald-950/80 border border-white/10 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    id={`select-edit-posicao-${j.id}`}
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
                    disabled={jogadorAtual.role !== 'admin'}
                    className="bg-emerald-950 border border-white/10 text-white text-[11px] rounded px-1.5 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option className="bg-emerald-950 text-white" value="Goleiro">Goleiro</option>
                    <option className="bg-emerald-950 text-white" value="Defesa">Defesa</option>
                    <option className="bg-emerald-950 text-white" value="Meio">Meio</option>
                    <option className="bg-emerald-950 text-white" value="Ataque">Ataque</option>
                  </select>

                  <select
                    id={`select-edit-membro-${j.id}`}
                    value={editMembro}
                    onChange={(e) => setEditMembro(e.target.value as MembroStatus)}
                    disabled={
                      jogadorAtual.role !== 'admin' && 
                      (
                        editPosicao === 'Goleiro' || 
                        (
                          !janelaInfo.estaAberta || 
                          pagamentos.some(p => p.jogadorId === j.id && p.mesRef === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` && !p.partidaId && p.status === 'pago')
                        )
                      )
                    }
                    className="bg-emerald-950 border border-white/10 text-white text-[11px] rounded px-1.5 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {editPosicao === 'Goleiro' && jogadorAtual.role !== 'admin' ? (
                      <option className="bg-emerald-950 text-white" value="isento">Isento</option>
                    ) : (
                      <>
                        <option className="bg-emerald-950 text-white" value="mensalista">Mensalista</option>
                        <option className="bg-emerald-950 text-white" value="diarista">Diarista</option>
                        <option className="bg-emerald-950 text-white" value="isento">Isento</option>
                      </>
                    )}
                  </select>
                </div>

                {jogadorAtual.role !== 'admin' && (
                  !janelaInfo.estaAberta ||
                  pagamentos.some(p => p.jogadorId === j.id && p.mesRef === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` && !p.partidaId && p.status === 'pago')
                ) && editPosicao !== 'Goleiro' && (
                  <p className="text-[9px] text-rose-400 font-medium leading-tight">
                    * Alteração de plano indisponível fora do período de renovação ou mensalidade já paga.
                  </p>
                )}

                {jogadorAtual.role === 'admin' && editMembro !== 'diarista' && (
                  <label className="flex items-center gap-2 mt-1.5 text-[11px] font-bold text-amber-400 select-none cursor-pointer p-1 rounded bg-black/20 border border-white/5">
                    <input
                      type="checkbox"
                      checked={editIsGold}
                      onChange={(e) => setEditIsGold(e.target.checked)}
                      className="rounded border-white/20 bg-emerald-955 focus:ring-amber-500 text-amber-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>🏅 Jogador Gold</span>
                  </label>
                )}

                {jogadorAtual.role === 'admin' && (
                  <button
                    type="button"
                    onClick={() => setEditRole(editRole === 'admin' ? 'jogador' : 'admin')}
                    className={`w-full py-1.5 px-3 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all duration-200 mt-2 flex items-center justify-center gap-1 border shadow ${
                      editRole === 'admin'
                        ? 'bg-amber-500/10 border-amber-500 text-amber-400 hover:bg-amber-500/20'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-700'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    {editRole === 'admin' ? '🛡️ Admin do Site (Verificado)' : '🛡️ Promover a Admin'}
                  </button>
                )}
              </div>
            ) : (
              <div>
                <h3 className="font-display font-bold text-base text-white truncate flex items-center gap-1.5 flex-wrap">
                  <span>{j.nome} {j.sobrenome}</span>
                  {j.isGold && (
                    <span className="text-sm shrink-0 select-none" title="Jogador Gold">🏅</span>
                  )}
                  {j.role === 'admin' && (
                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Administrador Geral" />
                  )}
                </h3>
                <p className="text-xs text-emerald-300 truncate">{j.email}</p>
                
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {j.isGold && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase font-mono border bg-amber-955/75 border-amber-500/30 text-amber-400 flex items-center gap-0.5 shadow-sm select-none">
                      🏅 GOLD
                    </span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase font-mono border ${
                    j.posicao === 'Goleiro' ? 'bg-amber-955/50 border-amber-500/20 text-amber-400' :
                    j.posicao === 'Defesa' ? 'bg-blue-955/50 border-blue-500/20 text-blue-400' :
                    j.posicao === 'Meio' ? 'bg-purple-955/50 border-purple-500/20 text-purple-400' :
                    'bg-red-955/50 border-red-500/20 text-red-400'
                  }`}>
                    {j.posicao === 'Goleiro' ? '🧤 Goleiro' : j.posicao === 'Defesa' ? '🛡️ Defesa' : j.posicao === 'Meio' ? '🧠 Meio' : '🚀 Ataque'}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase font-mono border ${
                    j.membroStatus === 'isento'
                      ? 'bg-emerald-950/85 border-emerald-500/40 text-emerald-300'
                      : j.membroStatus === 'mensalista' 
                      ? 'bg-teal-950/60 border-teal-500/25 text-teal-400' 
                      : 'bg-amber-950/60 border-amber-500/25 text-amber-400'
                  }`}>
                    {j.membroStatus}
                  </span>
                  {j.status === 'suspenso' && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase font-mono border bg-rose-950/80 border-rose-500/40 text-rose-400 flex items-center gap-0.5 shadow-sm">
                      🚫 SUSPENSO
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Linha Divisória de Info Secundária */}
        <div className="px-4 py-2.5 bg-emerald-950/60 flex flex-wrap items-center justify-between text-[10px] text-emerald-300 border-t border-b border-white/10 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Nasc: {j.dataNascimento ? j.dataNascimento.split('-').reverse().join('/') : '-'} ({calcularIdade(j.dataNascimento)} anos)
          </span>
        </div>

        {/* Status para a próxima partida e botões rápidos para Administrador */}
        {proximaPartida && (
          <div className="px-4 py-3 bg-emerald-950/30 border-b border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2 overflow-hidden">
              <span className="text-[9px] uppercase font-bold tracking-wider text-emerald-400/80 shrink-0">
                Próxima Partida:
              </span>
              <span className="text-[9px] font-mono font-bold text-white/50 truncate max-w-[140px]" title={proximaPartida.titulo}>
                {proximaPartida.data.split('-').reverse().slice(0, 2).join('/')} - {proximaPartida.titulo}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-2 mt-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                {proximaPartida.confirmados.includes(j.id) ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 text-[10px] font-bold">
                    <Check className="w-3 h-3 stroke-[3]" /> Confirmado
                  </span>
                ) : proximaPartida.recusados.includes(j.id) ? (
                  <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 text-[10px] font-bold">
                    <X className="w-3 h-3 stroke-[3]" /> Ausência
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/5 px-2 py-0.5 rounded-md border border-amber-500/15 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span> Responder
                  </span>
                )}
              </div>

              {/* Botões rápidos apenas para admin */}
              {jogadorAtual.role === 'admin' && !isEditing && (
                <div id={`admin-fast-presence-${j.id}`} className="flex items-center gap-1.5 shrink-0">
                  <button
                    id={`btn-admin-confirmar-presenca-${j.id}`}
                    type="button"
                    onClick={() => handlePresencaAdminClick(j, true)}
                    disabled={proximaPartida.confirmados.includes(j.id)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      proximaPartida.confirmados.includes(j.id)
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300 opacity-50 cursor-not-allowed shadow-none'
                        : 'bg-emerald-950/60 border-emerald-500/40 hover:bg-emerald-500 hover:text-emerald-950 text-emerald-400 hover:scale-103'
                    }`}
                    title="Confirmar Presença do Atleta"
                  >
                    Confirmar
                  </button>
                  <button
                    id={`btn-admin-confirmar-ausencia-${j.id}`}
                    type="button"
                    onClick={() => handlePresencaAdminClick(j, false)}
                    disabled={proximaPartida.recusados.includes(j.id)}
                    className={`px-2 py-1 rounded-lg border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      proximaPartida.recusados.includes(j.id)
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300 opacity-50 cursor-not-allowed shadow-none'
                        : 'bg-emerald-950/60 border-rose-500/40 hover:bg-rose-500 hover:text-white text-rose-450 hover:scale-103'
                    }`}
                    title="Confirmar Ausência / Falta do Atleta"
                  >
                    Falta
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Área de Ações (Admin ou Próprio Jogador) */}
        {(jogadorAtual.role === 'admin' || jogadorAtual.id === j.id) && (
          <div className="p-3 bg-emerald-950/40 border-t border-white/10 grid grid-cols-2 gap-2 shrink-0">
            {isEditing ? (
              <>
                <button
                  id={`btn-salvar-edicao-${j.id}`}
                  type="button"
                  onClick={() => handleSalvarEdicao(j.id)}
                  className="bg-white hover:bg-emerald-50 text-black text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-full"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </button>
                <button
                  id={`btn-cancelar-edicao-${j.id}`}
                  type="button"
                  onClick={() => setJogadorEditandoId(null)}
                  className="bg-emerald-950 border border-white/10 text-emerald-300 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center w-full"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                {jogadorAtual.role === 'admin' && (
                  <button
                    id={`btn-historico-atleta-${j.id}`}
                    type="button"
                    onClick={() => setJogadorHistoricoSelecionado(j)}
                    className="text-[11px] font-bold text-teal-300 hover:text-white hover:bg-teal-950/40 bg-teal-950/20 border border-teal-500/20 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer w-full"
                    title="Visualizar histórico mensal do atleta"
                  >
                    <History className="w-3.5 h-3.5 text-teal-400" />
                    Histórico
                  </button>
                )}

                <button
                  id={`btn-editar-atleta-${j.id}`}
                  type="button"
                  onClick={() => iniciarEdicao(j)}
                  className="text-[11px] font-bold text-white hover:bg-white/10 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-full"
                  title="Editar cadastro do atleta"
                >
                  <Edit2 className="w-3 h-3 text-emerald-450" />
                  Editar
                </button>

                {jogadorAtual.role === 'admin' && j.id !== jogadorAtual.id && j.status === 'suspenso' && (
                  <button
                    id={`btn-reativar-atleta-${j.id}`}
                    type="button"
                    onClick={() => {
                      if (confirm(`Deseja reativar a conta de ${j.nome} ${j.sobrenome}?`)) {
                        onEditarJogador(j.id, { status: 'ativo' });
                      }
                    }}
                    className="text-[11px] font-bold text-emerald-300 hover:bg-emerald-950/30 hover:text-white bg-emerald-950/15 border border-emerald-500/15 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-full"
                    title="Reativar a conta deste jogador"
                  >
                    <Check className="w-3 h-3" />
                    Reativar
                  </button>
                )}

                {jogadorAtual.role === 'admin' && j.id !== jogadorAtual.id && j.status !== 'suspenso' && (
                  <button
                    id={`btn-suspender-atleta-${j.id}`}
                    type="button"
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja suspender temporariamente a conta de ${j.nome} ${j.sobrenome}?`)) {
                        onEditarJogador(j.id, { status: 'suspenso' });
                      }
                    }}
                    className="text-[11px] font-bold text-rose-350 hover:bg-rose-950/30 hover:text-white bg-rose-950/15 border border-rose-500/15 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-full"
                    title="Suspender a conta deste jogador"
                  >
                    <ShieldAlert className="w-3 h-3" />
                    Suspender
                  </button>
                )}
                
                {/* Permitir exclusão se o usuário for administrador (e não for ele mesmo) ou se for o próprio usuário acessando seu perfil */}
                {((jogadorAtual.role === 'admin' && j.id !== jogadorAtual.id) || j.id === jogadorAtual.id) && (
                  <button
                    id={`btn-excluir-atleta-${j.id}`}
                    type="button"
                    onClick={() => {
                      if (j.id === jogadorAtual.id) {
                        setJogadorExclusaoModal(j);
                      } else {
                        const msg = `Tem certeza que deseja excluir as informações de ${j.nome} ${j.sobrenome} definitivamente?`;
                        if (confirm(msg)) {
                           onExcluirJogador(j.id);
                        }
                      }
                    }}
                    className="text-[11px] font-bold text-rose-350 hover:bg-rose-950/30 hover:text-white bg-rose-950/15 border border-rose-500/15 px-3 py-1.5 rounded-lg transition-colors flex items-center justify-center gap-1 w-full"
                    title={j.id === jogadorAtual.id ? "Excluir minha conta do portal" : "Remover atleta do portal"}
                  >
                    <Trash2 className="w-3 h-3" />
                    Excluir
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* Banner / Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h2 id="titulo-cadastrados" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <Users className="w-5 h-5 text-emerald-400" />
            Jogadores Cadastrados
          </h2>
          <p className="text-xs text-emerald-300/80 font-sans mt-0.5">Elenco oficial de atletas com cadastro ativo e aprovado no portal.</p>
        </div>
        
        <div className="flex items-center gap-3 self-start sm:self-center font-mono text-xs bg-emerald-950/40 px-3.5 py-1.5 rounded-lg border border-white/10">
          <span className="text-emerald-300">Total no Elenco:</span>
          <span className="text-white font-bold">{jogadoresAtivos.length} Ativos</span>
        </div>
      </div>

      {jogadoresAtivos.length === 0 ? (
        <div className="text-center py-16 bg-emerald-900/40 rounded-2xl border border-dashed border-white/10 text-emerald-300 max-w-lg mx-auto">
          <ShieldAlert className="w-12 h-12 text-emerald-500/50 mb-3 mx-auto" />
          <h3 className="font-display font-semibold text-base text-white">Nenhum atleta ativo</h3>
          <p className="text-xs text-emerald-450 mt-1">Nenhum jogador aprovado consta como ativo na pelada no momento.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* SEÇÃO JOGADORES GOLEIROS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="text-amber-400">🧤</span>
                Goleiros Cadastrados
              </h3>
              <span className="text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-0.5 rounded-full">
                {goleirosAtivos.length} Ativos
              </span>
            </div>

            {goleirosAtivos.length === 0 ? (
              <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-emerald-450 text-xs italic">
                Nenhum goleiro ativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {goleirosAtivos.map((j) => renderJogadorCard(j))}
              </div>
            )}
          </div>

          {/* SEÇÃO JOGADORES MENSALISTAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="text-teal-400">🛡️</span>
                Jogadores Mensalistas
              </h3>
              <span className="text-xs font-mono font-bold bg-teal-500/15 border border-teal-500/30 text-teal-400 px-3 py-0.5 rounded-full">
                {mensalistasAtivos.length} Ativos
              </span>
            </div>

            {mensalistasAtivos.length === 0 ? (
              <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-emerald-450 text-xs italic">
                Nenhum jogador mensalista ativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mensalistasAtivos.map((j) => renderJogadorCard(j))}
              </div>
            )}
          </div>

          {/* SEÇÃO JOGADORES DIARISTAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="text-amber-400">⚡</span>
                Jogadores Diaristas
              </h3>
              <span className="text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-0.5 rounded-full">
                {diaristasAtivos.length} Ativos
              </span>
            </div>

            {diaristasAtivos.length === 0 ? (
              <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-emerald-450 text-xs italic">
                Nenhum jogador diarista ativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {diaristasAtivos.map((j) => renderJogadorCard(j))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* POPUP DE CONFIRMAÇÃO DE ALTERAÇÃO SALVA */}
      {showConfirmacaoCadastrados && (
        <div 
          id="confirmacao-sucesso-cadastrados-popup"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/80 backdrop-blur-md"
        >
          <div className="bg-emerald-900 border border-emerald-500/35 rounded-2xl max-w-sm w-full max-h-[72vh] md:max-h-[85vh] overflow-y-auto p-6 text-center shadow-2xl relative">
            <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">Alterações Salvas!</h3>
            <p className="text-xs text-emerald-200 leading-relaxed mb-6">
              As informações cadastrais do atleta foram gravadas e atualizadas com sucesso!
            </p>
            <button
               id="btn-confirmar-edicao-cadastrados"
               type="button"
               onClick={() => setShowConfirmacaoCadastrados(false)}
               className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs"
            >
               Entendido
            </button>
          </div>
        </div>
      )}

      {/* MODAL DE COMPARTILHAMENTO WHATSAPP (Abertura Manual para Admin se automação desativada) */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto animate-fade-in">
          <div className="bg-emerald-950 border border-white/20 rounded-2xl w-full max-w-lg max-h-[72vh] md:max-h-[85vh] overflow-y-auto p-6 shadow-2xl space-y-4">
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

      {/* POPUP DE HISTÓRICO MENSAL - DISPONÍVEL APENAS PARA ADMINISTRADORES */}
      {jogadorHistoricoSelecionado && jogadorAtual.role === 'admin' && (() => {
        const j = jogadorHistoricoSelecionado;
        const historico = obterHistoricoMensalDoJogador(j, anoHistorico);
        const jersey = AVATAR_PRESETS.find(p => p.id === j.foto) || AVATAR_PRESETS[0];

        return (
          <div id="modal-historico-atleta" className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-emerald-950 border border-emerald-500/20 rounded-3xl w-full max-w-lg max-h-[72vh] md:max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col overflow-hidden animate-slide-in text-sans">
              
              {/* Cabeçalho */}
              <div className="p-5 border-b border-white/10 bg-emerald-900/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-14 h-14 rounded-full flex items-center justify-center shrink-0 shadow-lg border border-white/10 overflow-hidden relative" 
                    style={{ backgroundColor: jersey.color }}
                  >
                    {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                      <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="Avatar" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-lg font-bold font-display" style={{ color: jersey.text === '⚪' ? '#fff' : '#000' }}>
                        {j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'}
                      </span>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      Histórico de {j.nome} {j.sobrenome}
                    </h3>
                    <p className="text-[11px] text-emerald-300 font-medium mt-0.5 tracking-wide">
                      Posição: <span className="text-white">{j.posicao}</span> • Registro: <span className="text-white font-semibold uppercase">{j.membroStatus}</span>
                    </p>
                  </div>
                </div>
                <button
                  id="btn-fechar-historico-modal"
                  type="button"
                  onClick={() => setJogadorHistoricoSelecionado(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-emerald-400 hover:text-white transition-colors flex items-center justify-center cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo */}
              <div className="p-5 overflow-y-auto max-h-[60vh] space-y-4">
                <div className="flex items-center justify-between bg-emerald-900/20 p-2.5 rounded-xl border border-white/5 font-sans">
                  <span className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest">
                    Relação de Competências
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] text-emerald-300 font-bold uppercase tracking-wider">Ano:</span>
                    <select
                      id="select-ano-historico"
                      value={anoHistorico}
                      onChange={(e) => setAnoHistorico(e.target.value)}
                      className="bg-emerald-950 text-white border border-emerald-500/30 text-[10px] font-bold py-1 px-1.5 rounded focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      <option value="2025">2025</option>
                      <option value="2026">2026</option>
                      <option value="2027">2027</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-3">
                  {historico.map((m) => {
                    return (
                      <div key={m.mesValue} className="p-3.5 bg-emerald-900/10 border border-white/5 rounded-2xl space-y-3 flex flex-col justify-between hover:bg-emerald-900/20 transition-all">
                        <div className="flex justify-between items-start gap-3">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-white block">{m.mesLabel}</span>
                            <div className="flex items-center gap-1.5 mt-1">
                              {/* Situação badge */}
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                                m.situacao === 'Isento'
                                  ? 'bg-purple-900/60 text-purple-200 border border-purple-500/25'
                                  : m.rebaixadoTemporario
                                  ? 'bg-amber-950/80 text-amber-300 border border-amber-500/20'
                                  : m.situacao === 'Mensalista'
                                  ? 'bg-emerald-900/60 text-emerald-400 border border-emerald-500/25'
                                  : 'bg-blue-900/60 text-blue-200 border border-blue-500/25'
                              }`}>
                                {m.rebaixadoTemporario ? '⚠️ DIARISTA (PENDÊNCIA)' : m.situacao}
                              </span>

                              {/* Quitado status badge */}
                              <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider ${
                                m.quitado
                                  ? 'bg-teal-900/60 text-teal-400 border border-teal-500/25'
                                  : 'bg-rose-950/80 text-rose-455 border border-rose-500/20'
                              }`}>
                                {m.quitado ? 'Quitado' : 'Débito'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right space-y-0.5 shrink-0">
                            <span className="text-[9.5px] uppercase tracking-wider text-emerald-400 font-mono block">Pago no Mês</span>
                            <span className="text-sm font-extrabold text-white font-mono block">R$ {m.totalPago.toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Detalhes de Pagamento associados no mês (Peladas ou Mensalidades) */}
                        {m.pagamentos.length > 0 ? (
                          <div className="bg-black/20 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                            <span className="text-[8.5px] text-emerald-400 font-bold uppercase tracking-widest block border-b border-white/5 pb-1">Registros Vinculados:</span>
                            {m.pagamentos.map((pag) => {
                              // Se tem partidaId, busca título
                              const matchedPartida = partidas.find(pt => pt.id === pag.partidaId);
                              const detailsLabel = matchedPartida
                                ? `⚽ Diária: ${matchedPartida.titulo}`
                                : `🛡️ Mensalidade de ${m.mesLabel}`;

                              return (
                                <div key={pag.id} className="flex justify-between items-center text-[10px] text-emerald-200 tracking-wide font-mono">
                                  <span className="truncate max-w-[200px]">{detailsLabel}</span>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {pag.status === 'pago' && pag.dataPagamento && (
                                      <span className="text-[9px] font-mono text-emerald-400 bg-emerald-950/40 px-1 rounded border border-emerald-500/15">
                                        Data: {pag.dataPagamento.split('-').reverse().join('/')}
                                      </span>
                                    )}
                                    <span className={`text-[8px] font-bold px-1 rounded ${
                                      pag.status === 'pago'
                                        ? 'bg-teal-950/20 text-teal-400'
                                        : 'bg-rose-955/20 text-rose-455'
                                    }`}>
                                      {pag.status === 'pago' ? 'PG' : 'PENDENTE'}
                                    </span>
                                    <span className="font-bold text-white">R$ {pag.valor.toFixed(2)}</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[10px] text-emerald-500/70 font-mono italic pl-1">
                            {m.situacao === 'Isento' ? 'Jogador com isenção ativa nesta temporada.' : 'Nenhum lançamento ou registro de pagamento para este mês.'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rodapé */}
              <div className="p-4 border-t border-white/10 bg-emerald-900/40 text-center">
                <p className="text-[9.5px] text-emerald-350 leading-relaxed max-w-sm mx-auto">
                  💡 <b>Regulamento de Inadimplência:</b> Mensalistas que possuem débitos ativos ({historico.filter(x => !x.quitado && x.rebaixadoTemporario).length > 0 ? 'Inadimplente ⚠️' : 'Nenhum'}) são rebaixados a Diaristas temporariamente.
                </p>
              </div>

            </div>
          </div>
        );
      })()}

      {/* MODAL DE SOLICITAÇÃO DE EXCLUSÃO DE CONTA */}
      {jogadorExclusaoModal && (() => {
        const j = jogadorExclusaoModal;
        const originalStatus = j.membroStatusDb || j.membroStatus || 'diarista';
        const vD = parseFloat(localStorage.getItem('racha_valor_diaria') || '30');
        const v4 = parseFloat(localStorage.getItem('racha_valor_4s') || '85');
        const v5 = parseFloat(localStorage.getItem('racha_valor_5s') || '105');
        const debits = obterDebitosDoJogador(
          j.id,
          originalStatus,
          j.posicao,
          partidas,
          pagamentos,
          vD,
          v4,
          v5,
          j.createdAt
        );
        const hasDebits = debits.length > 0;
        const totalDebitos = debits.reduce((acc, d) => acc + d.valor, 0);

        const formatarMesRef = (mesRef: string) => {
          const [ano, mes] = mesRef.split('-');
          const mesesNomes: Record<string, string> = {
            '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
            '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
            '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
          };
          return `${mesesNomes[mes] || mes} / ${ano}`;
        };

        return (
          <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-neutral-900 border border-white/10 w-full max-w-md max-h-[72vh] md:max-h-[85vh] overflow-y-auto rounded-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="p-4 bg-zinc-900/60 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-sm text-white uppercase tracking-wider">Solicitar Exclusão de Perfil</h3>
                  <p className="text-[10px] text-zinc-400 font-mono mt-0.5">Atleta: {j.nome} {j.sobrenome}</p>
                </div>
                <button
                  id="btn-close-modal-exclusao"
                  type="button"
                  onClick={() => setJogadorExclusaoModal(null)}
                  className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-zinc-300 font-sans leading-relaxed">
                  Para proceder com o desligamento definitivo do elenco oficial da Pelada Batista, o sistema exige a inexistência de quaisquer pendências financeiras ativas.
                </p>

                {j.status === 'solicitou_exclusao' ? (
                  <div className="p-4 bg-amber-950/20 border border-amber-500/30 rounded-xl space-y-1">
                    <h4 className="text-xs font-bold text-amber-400 flex items-center gap-1.5 uppercase font-mono">
                      ⏳ Exclusão já Solicitada
                    </h4>
                    <p className="text-[11px] text-amber-200/80 font-sans leading-relaxed">
                      Sua solicitação de exclusão já se encontra em fila de análise pelo administrador do portal. Por favor, aguarde o deferimento final de sua conta.
                    </p>
                  </div>
                ) : hasDebits ? (
                  <div className="space-y-3">
                    <div className="p-4 bg-rose-950/35 border border-rose-500/25 rounded-xl space-y-2">
                      <h4 className="text-xs font-black text-rose-400 flex items-center gap-1.5 uppercase tracking-wide">
                        ⚠️ DÉBITOS PENDENTES DETECTADOS
                      </h4>
                      <p className="text-[11.5px] text-rose-300 font-sans leading-relaxed">
                        Constam débitos pendentes de pagamento em seu perfil. Estas pendências de mensalidade ou diária devem ser liquidadas com o Administrador antes de prosseguir com a exclusão.
                      </p>
                    </div>

                    <div className="bg-black/35 rounded-xl border border-white/5 overflow-hidden">
                      <div className="p-2.5 bg-rose-955/20 border-b border-white/10 text-[10px] uppercase font-bold tracking-wider text-rose-400">
                        Extrato de Pendências
                      </div>
                      <div className="divide-y divide-white/5 max-h-[160px] overflow-y-auto">
                        {debits.map((d) => (
                          <div key={d.id} className="p-3 flex items-center justify-between font-mono text-[11px]">
                            <div className="text-left">
                              <span className="text-white font-bold block">{formatarMesRef(d.mesRef)}</span>
                              <span className="text-[9.5px] text-zinc-400 uppercase tracking-wider block">
                                {d.tipo === 'mensalidade' ? '🛡️ Mensalidade' : '⚽ Diária de Jogo'}
                              </span>
                            </div>
                            <span className="text-rose-400 font-extrabold whitespace-nowrap">
                              R$ {d.valor.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="p-3 bg-black/40 border-t border-white/5 flex items-center justify-between text-xs font-bold">
                        <span className="text-zinc-300 font-display">Total de Débito Pendente:</span>
                        <span className="text-rose-450 font-mono text-sm font-extrabold">R$ {totalDebitos.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-1.5">
                      <h4 className="text-xs font-black text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                        ✅ SITUAÇÃO REGULARIZADA!
                      </h4>
                      <p className="text-[11.5px] text-emerald-300 font-sans leading-relaxed">
                        Excelente! Não há nenhum débito financeiro ou pendência registrada no seu nome.
                      </p>
                    </div>

                    <div className="p-3 bg-white/5 border border-white/5 rounded-xl">
                      <p className="text-[10.5px] text-zinc-300 font-sans leading-relaxed">
                        Ao clicar em confirmar abaixo, sua solicitação de exclusão definitiva será enviada ao painel do Administrador que supervisionará o seu pedido. Após a validação administrativa, seu registro será permanentemente apagado.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4 bg-zinc-900/60 border-t border-white/10 flex items-center justify-end gap-2">
                <button
                  id="btn-modal-exclusao-cancel"
                  type="button"
                  onClick={() => setJogadorExclusaoModal(null)}
                  className="bg-neutral-950 border border-white/10 text-zinc-300 hover:text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors"
                >
                  {hasDebits ? 'Voltar / Entendido' : 'Cancelar'}
                </button>
                {j.status !== 'solicitou_exclusao' && !hasDebits && (
                  <button
                    id="btn-modal-exclusao-confirm"
                    type="button"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja solicitar a exclusão da sua conta? Esta ação enviará seu perfil ao painel administrativo para desligamento do elenco.')) {
                        onEditarJogador(j.id, { status: 'solicitou_exclusao' });
                        setJogadorExclusaoModal(null);
                        alert('Solicitação de exclusão de perfil enviada com sucesso! Aguarde aprovação do administrador do portal.');
                      }
                    }}
                    className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-rose-950/40"
                  >
                    Confirmar e Enviar Pedido
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* AUTO TOAST NOTIFICATION FOR ROBOT/AUTOMATION STATUS */}
      {showAutoToast && (
        <div className="fixed bottom-24 md:bottom-6 right-4 sm:right-6 bg-teal-500 text-emerald-950 font-extrabold px-5 py-4 rounded-2xl shadow-2xl border border-teal-300 z-50 flex items-center gap-3 animate-bounce max-w-sm sm:max-w-md">
          <span className="text-xl">🤖</span>
          <div className="text-left font-sans">
            <h5 className="text-[10px] font-black uppercase tracking-wider text-emerald-950">Bot de Automação Pelada</h5>
            <p className="text-[11px] font-bold mt-0.5 leading-snug">{autoToastMsg}</p>
          </div>
        </div>
      )}
    </div>
  );
}
