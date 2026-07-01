/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Jogador, Pagamento, Partida } from '../types';
import { AVATAR_PRESETS } from '../data';
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Send,
  UserCheck,
  ShieldAlert,
  History,
  Sparkles,
  RefreshCw,
  Mail
} from 'lucide-react';
import { isFechamentoMensalistas, obterDebitosDoJogador, obterNumeroRecibo, obterMesReferenciaParaRenovacao } from '../utils/confirmationRules';
import CheckoutPixModal from './CheckoutPixModal';

interface ControlePagamentosProps {
  pagamentos: Pagamento[];
  jogadores: Jogador[];
  jogadorAtual: Jogador;
  onRegistrarPagamento: (jogadorId: string, mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado', dataPagamento: string | null, valor: number, partidaId?: string) => void;
  onRegistrarVariosPagamentos?: (jogadorId: string, items: Array<{ mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado', dataPagamento: string | null, valor: number, partidaId?: string }>) => Promise<void>;
  valor4Sabados: number;
  valor5Sabados: number;
  valorDiaria: number;
  partidas: Partida[];
}

function contarSabadosNoMes(mes: string): number {
  if (!mes || !mes.includes('-')) return 4;
  const [ano, mesNum] = mes.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mesNum - 1, 1, 12, 0, 0));
  let count = 0;
  while (data.getUTCMonth() === mesNum - 1) {
    if (data.getUTCDay() === 6) { // 6 é sábado
      count++;
    }
    data.setUTCDate(data.getUTCDate() + 1);
  }
  return count;
}

export default function ControlePagamentos({
  pagamentos,
  jogadores,
  jogadorAtual,
  onRegistrarPagamento,
  onRegistrarVariosPagamentos,
  valor4Sabados,
  valor5Sabados,
  valorDiaria,
  partidas,
}: ControlePagamentosProps) {
  // Filtro de mês de referência para a cobrança atual
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });

  const startupMonth = useMemo(() => {
    return localStorage.getItem('futebol_startup_month') || '2026-06';
  }, []);

  useEffect(() => {
    if (mesSelecionado < startupMonth) {
      setMesSelecionado(startupMonth);
    }
  }, [mesSelecionado, startupMonth]);

  // Estado para confirmar cancelamento sem window.confirm
  const [cancelarConfirmId, setCancelarConfirmId] = useState<string | null>(null);

  const [alertMessage, setAlertMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [sendingReceiptId, setSendingReceiptId] = useState<string | null>(null);

  const handleReenviarRecibo = async (p: Pagamento, descReferencia: string) => {
    setSendingReceiptId(p.id);
    const numRecibo = obterNumeroRecibo(p.id).replace('#', '');
    try {
      const res = await fetch('/api/send-receipt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: jogadorAtual.email,
          nome: `${jogadorAtual.nome} ${jogadorAtual.sobrenome || ''}`.trim(),
          valor: p.valor,
          referencia: descReferencia,
          dataPagamento: p.dataPagamento || new Date().toISOString(),
          numRecibo: numRecibo
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setAlertMessage({
          type: 'success',
          text: `Recibo de pagamento enviado com sucesso para o e-mail: ${jogadorAtual.email}`
        });
      } else {
        setAlertMessage({
          type: 'error',
          text: `Erro ao enviar recibo: ${data.error || 'Falha na comunicação com o servidor'}`
        });
      }
    } catch (err: any) {
      setAlertMessage({
        type: 'error',
        text: `Falha ao conectar ao servidor: ${err.message || err}`
      });
    } finally {
      setSendingReceiptId(null);
    }
  };

  // Controle de estado do pop-up de checkout PIX Mercado Pago
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutValorTotal, setCheckoutValorTotal] = useState(0);
  const [checkoutDebitos, setCheckoutDebitos] = useState<Array<{
    id: string;
    referencia: string;
    valor: number;
    mesRef: string;
    partidaId?: string;
  }>>([]);

  const abrirCheckout = (debs: typeof checkoutDebitos) => {
    const total = debs.reduce((sum, d) => sum + d.valor, 0);
    setCheckoutDebitos(debs);
    setCheckoutValorTotal(total);
    setIsCheckoutOpen(true);
  };

  const handleConfirmarPagamentoTotal = async (
    debitList: Array<{ mesRef: string; valor: number; partidaId?: string }>,
    status: 'pago' | 'pendente_confirmacao' = 'pago'
  ) => {
    const hojeStr = new Date().toISOString().split('T')[0];
    if (onRegistrarVariosPagamentos) {
      const items = debitList.map(deb => ({
        mesRef: deb.mesRef,
        status: status,
        dataPagamento: status === 'pago' ? hojeStr : null,
        valor: deb.valor,
        partidaId: deb.partidaId
      }));
      await onRegistrarVariosPagamentos(jogadorAtual.id, items);
    } else {
      for (const deb of debitList) {
        await onRegistrarPagamento(
          jogadorAtual.id,
          deb.mesRef,
          status,
          status === 'pago' ? hojeStr : null,
          deb.valor,
          deb.partidaId
        );
      }
    }
    setIsCheckoutOpen(false);
  };
  
  // Cálculos de sábados e tarifas correspondentes
  const numSabados = contarSabadosNoMes(mesSelecionado);
  const valorMensalidadeMes = numSabados === 5 ? valor5Sabados : valor4Sabados;
  const valorDiariaMes = valorDiaria;

  // Período de fechamento (dias 1-10 do mês)
  const isPeriodoFechamento = isFechamentoMensalistas();

  // Obter o registro do pagamento atual do jogador para o mês selecionado
  const obterPagamentoDoJogador = (mes: string) => {
    return pagamentos.find(p => p.jogadorId === jogadorAtual.id && p.mesRef === mes && !p.partidaId);
  };

  const pagAtual = obterPagamentoDoJogador(mesSelecionado);

  const valorCobradoMes = useMemo(() => {
    if (jogadorAtual.posicao.includes('Goleiro')) return 0;
    if (jogadorAtual.membroStatus === 'mensalista') return valorMensalidadeMes;
    return valorDiariaMes;
  }, [jogadorAtual, valorMensalidadeMes, valorDiariaMes]);

  const obterMesAtual = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // Histórico de competências que o usuário pode visualizar (computado dinamicamente)
  const competencasDisponiveis = useMemo(() => {
    let mesLimit = obterMesAtual(); // ex: '2026-06'
    const mesRenovacao = obterMesReferenciaParaRenovacao(partidas);
    if (mesRenovacao > mesLimit) {
      mesLimit = mesRenovacao;
    }
    const mesSet = new Set<string>();
    
    if (mesLimit >= startupMonth) {
      mesSet.add(mesLimit);
    } else {
      mesSet.add(startupMonth);
    }

    partidas.forEach(p => {
      if (p.data && p.data.length >= 7) {
        const m = p.data.substring(0, 7);
        if (m >= startupMonth && m <= mesLimit) {
          mesSet.add(m);
        }
      }
    });

    pagamentos.forEach(p => {
      if (p.mesRef && p.mesRef.length >= 7) {
        if (p.mesRef >= startupMonth && p.mesRef <= mesLimit) {
          mesSet.add(p.mesRef);
        }
      }
    });

    const listaMeses = Array.from(mesSet).sort();
    if (listaMeses.length > 0) {
      const minMes = listaMeses[0] >= startupMonth ? listaMeses[0] : startupMonth;
      const maxMes = mesLimit >= startupMonth ? mesLimit : startupMonth;
      const [minY, minM] = minMes.split('-').map(Number);
      const [maxY, maxM] = maxMes.split('-').map(Number);

      const sequencia: string[] = [];
      let curY = minY;
      let curM = minM;
      while (curY < maxY || (curY === maxY && curM <= maxM)) {
        const mesStr = `${curY}-${String(curM).padStart(2, '0')}`;
        sequencia.push(mesStr);
        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }
      
      const nomesMesesIndex: Record<string, string> = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
      };

      return sequencia.map(m => {
        const [ano, mesId] = m.split('-');
        const label = `${nomesMesesIndex[mesId] || mesId} / ${ano}`;
        return { value: m, label };
      });
    }
    return [{ value: startupMonth, label: 'Maio / 2026' }];
  }, [partidas, pagamentos, startupMonth]);

  const debitosPessoais = useMemo(() => {
    return obterDebitosDoJogador(
      jogadorAtual.id,
      jogadorAtual.membroStatus,
      jogadorAtual.posicao,
      partidas,
      pagamentos,
      valorDiaria,
      valor4Sabados,
      valor5Sabados,
      jogadorAtual.createdAt
    );
  }, [jogadorAtual, partidas, pagamentos, valorDiaria, valor4Sabados, valor5Sabados]);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      
      {/* CABEÇALHO UNIFICADO DE PAGAMENTOS */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div className="text-left">
          <h2 id="titulo-pagamentos-user" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <CreditCard className="w-5 h-5 text-teal-400" />
            Minhas Mensalidades e Diárias
          </h2>
          <p className="text-xs text-emerald-300/85 font-sans mt-0.5">
            Demonstrativo de quitações individuais de <b>{jogadorAtual.nome} {jogadorAtual.sobrenome}</b>.
          </p>
        </div>

        {/* Seletor de Mês Ativo */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-bold text-emerald-300 uppercase tracking-wider font-sans shrink-0">Consultar Ciclo:</label>
          <select
            id="select-mes-proprio"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="bg-emerald-950 border border-white/10 text-white text-xs font-bold font-mono rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-white cursor-pointer"
          >
            {competencasDisponiveis.map(comp => (
              <option className="bg-emerald-955 text-white" key={comp.value} value={comp.value}>{comp.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* DETALHAMENTO DE EXENÇÃO DO GOLEIRO OU BANNER DE FECHAMENTO */}
      {jogadorAtual.posicao.includes('Goleiro') ? (
        <div className="bg-gradient-to-r from-teal-950/60 to-emerald-950/30 border border-teal-500/20 p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-emerald-100">
          <div className="flex items-start gap-2.5 text-left">
            <Sparkles className="w-5 h-5 mt-0.5 shrink-0 text-teal-400 animate-pulse" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">
                🛡️ Posição Isenta de Taxas (Goleiro Oficial)
              </h4>
              <p className="text-[11px] text-teal-300 mt-1 font-sans leading-relaxed">
                No Pelada Batista Sábado, os <b>Goleiros são 100% gratuitos</b> e isentos de mensalidade ou diária. Obrigado por fechar o gol e garantir ótimas defesas a cada treino!
              </p>
            </div>
          </div>
          <div>
            <span className="text-[9.5px] font-black px-3 py-1 rounded-full bg-teal-550 border border-teal-500 text-bg uppercase tracking-widest font-mono">
              Isento Permanentemente
            </span>
          </div>
        </div>
      ) : (
        <div className={`p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border text-left ${
          isPeriodoFechamento.emPeriodo 
            ? 'bg-amber-955/45 border-amber-500/25 text-amber-200' 
            : 'bg-emerald-950/30 border-white/5 text-emerald-300'
        }`}>
          <div className="flex items-start gap-2.5">
            <Calendar className={`w-5 h-5 mt-0.5 shrink-0 ${isPeriodoFechamento.emPeriodo ? 'text-amber-400' : 'text-emerald-400'}`} />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">
                {isPeriodoFechamento.emPeriodo ? '🚨 Período de Fechamento de Mensalistas Ativo!' : 'Período Normal de Recebimentos'}
              </h4>
              <p className="text-[11px] text-emerald-300 mt-1 font-sans">
                {isPeriodoFechamento.descricao}
              </p>
            </div>
          </div>
          <div>
            <span className={`text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-widest ${
              isPeriodoFechamento.emPeriodo 
                ? 'bg-amber-500 text-black animate-pulse' 
                : 'bg-white/10 text-emerald-300'
            }`}>
              {isPeriodoFechamento.emPeriodo ? '● Fechamento Ativo' : 'Prazo de Rotina'}
            </span>
          </div>
        </div>
      )}

      {/* CONTAINER PRINCIPAL DE PAGAMENTO CONSELHEIRO */}
      <div className="w-full bg-emerald-900/40 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-6">
        
        {/* INFORMAÇÃO INDIVIDUAL CARDS */}
        {(() => {
          const isGoleiro = jogadorAtual.posicao.includes('Goleiro');
          const totalConsolidado = isGoleiro ? 0 : debitosPessoais.reduce((sum, d) => sum + d.valor, 0);
          const totalAberto = isGoleiro ? 0 : debitosPessoais.filter(d => d.status === 'pendente').reduce((sum, d) => sum + d.valor, 0);
          const hasUnpaid = debitosPessoais.some(d => d.status === 'pendente');
          const hasPendenteConfirmacaoOnly = debitosPessoais.length > 0 && !hasUnpaid;
          
          const avatar = AVATAR_PRESETS.find(p => p.id === jogadorAtual.foto) || AVATAR_PRESETS[0];

          return (
            <div className="flex flex-col items-center justify-center text-center space-y-5">
              
              {/* Status Ring & Foto */}
              <div className="relative">
                <div 
                  className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold border border-white/10 overflow-hidden shadow-lg cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                  style={{ backgroundColor: avatar.color, color: avatar.text === '⚪' ? '#fff' : '#000' }}
                  onClick={() => {
                    if (jogadorAtual.foto && (jogadorAtual.foto.startsWith('http') || jogadorAtual.foto.startsWith('data:'))) {
                      (window as any).ampliarFoto?.(jogadorAtual.foto, `${jogadorAtual.nome} ${jogadorAtual.sobrenome}`);
                    }
                  }}
                  title={jogadorAtual.foto ? "Clique para ampliar a foto" : undefined}
                >
                  {jogadorAtual.foto && (jogadorAtual.foto.startsWith('http') || jogadorAtual.foto.startsWith('data:')) ? (
                    <img src={jogadorAtual.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    jogadorAtual.posicao.substring(0, 1)
                  )}
                </div>
                <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full border border-emerald-950 flex items-center justify-center ${
                  isGoleiro || debitosPessoais.length === 0 
                    ? 'bg-teal-500 text-black' 
                    : hasPendenteConfirmacaoOnly 
                      ? 'bg-amber-400 text-black animate-pulse' 
                      : 'bg-rose-500 text-white'
                }`}>
                  {isGoleiro || debitosPessoais.length === 0 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                </div>
              </div>

              <div>
                <h4 className="font-display font-black text-lg text-white leading-none">{jogadorAtual.nome} {jogadorAtual.sobrenome}</h4>
                <p className="text-xs text-emerald-300 capitalize font-medium mt-1.5 font-mono">
                  Perfil: <span className="text-white font-bold">{jogadorAtual.membroStatus}</span> • Posição: <span className="text-white font-bold">{jogadorAtual.posicao}</span> {jogadorAtual.role === 'admin' && <span className="text-amber-400 font-bold ml-1">• ADMIN 🔐</span>}
                </p>
              </div>

              {/* Informações de Faturamento e demonstrativo de Caixa - Dívida Consolidada */}
              <div className="w-full max-w-md bg-black/20 p-4 rounded-xl space-y-2.5 border border-white/5 text-left font-mono text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-emerald-300 font-sans">Contas em Aberto:</span>
                  <span className="font-mono text-white font-bold">{isGoleiro ? '0' : debitosPessoais.length} {debitosPessoais.length === 1 ? 'pendência' : 'pendências'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-emerald-300 font-sans">Dívida Consolidada Total:</span>
                  <span className="font-mono text-white font-bold">R$ {totalConsolidado.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-2.5">
                  <span className="text-emerald-300 font-sans">Situação Geral:</span>
                  <span className={`px-2.5 py-0.5 rounded text-[9.5px] font-black font-mono uppercase tracking-wide leading-none ${
                    isGoleiro 
                      ? 'bg-teal-555 border border-teal-500 text-teal-400' 
                      : debitosPessoais.length === 0
                        ? 'bg-teal-900/60 border border-teal-500/30 text-teal-400' 
                        : hasUnpaid 
                          ? 'bg-rose-955/60 border border-rose-500/30 text-rose-455'
                          : 'bg-amber-955 border border-amber-500/30 text-amber-400 font-bold'
                  }`}>
                    {isGoleiro 
                      ? 'ISENTO' 
                      : debitosPessoais.length === 0
                        ? 'QUITADO' 
                        : hasUnpaid 
                          ? 'PENDENTE' 
                          : 'EM ANÁLISE'}
                  </span>
                </div>
              </div>

              {/* AÇÕES DE JOGADOR */}
              {isGoleiro ? (
                <div className="text-center w-full max-w-md space-y-2">
                  <p className="text-xs text-teal-200 leading-relaxed font-sans bg-teal-500/10 border border-teal-500/20 p-3 rounded-xl">
                    ✓ <b>Livre de pendências!</b> Você tem acesso total de goleiro oficial confirmado aos jogos. Não há cobranças emitidas para o seu PIN.
                  </p>
                </div>
              ) : debitosPessoais.length === 0 ? (
                <div className="text-center w-full max-w-md space-y-1.5 pt-1">
                  <p className="text-xs text-teal-200 leading-relaxed font-sans bg-teal-500/10 border border-teal-500/20 p-3 rounded-xl font-bold">
                    🎉 Excelente! Você está 100% em dia com a pelada Pelada Batista Sábado. Não há nenhum débito pendente em aberto ou em análise. Obrigado pela colaboração!
                  </p>
                </div>
              ) : hasPendenteConfirmacaoOnly ? (
                <div className="text-center w-full max-w-md space-y-3 pt-1">
                  <p className="text-xs text-amber-200 leading-relaxed font-sans bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                    ✓ <b>Comprovantes de pagamento informados!</b> Todos os seus débitos (<b>R$ {totalConsolidado.toFixed(2)}</b>) estão sendo analisados pela administração.
                  </p>
                  
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Olá! Sou o atleta ${jogadorAtual.nome} ${jogadorAtual.sobrenome} e acabei de informar o pagamento total de meus débitos no app Pelada Batista Sábado no valor de R$ ${totalConsolidado.toFixed(2)}.`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-white" />
                    Enviar Comprovante (WhatsApp)
                  </a>
                </div>
              ) : (
                <div className="text-center w-full max-w-md space-y-3 pt-1">
                  <p className="text-xs text-rose-200 leading-relaxed font-sans bg-rose-500/10 border border-rose-500/25 p-3 rounded-xl font-sans">
                    Detectamos pendências financeiras consolidadas no total de <b>R$ {totalAberto.toFixed(2)}</b>. Realize a transferência correspondente e informe a quitação total abaixo.
                  </p>

                  <button
                    type="button"
                    id="btn-quitar-consolidado-total-caixa"
                    onClick={() => {
                      const abertos = debitosPessoais.filter(d => d.status === 'pendente');
                      abrirCheckout(abertos);
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5 cursor-pointer uppercase border-b-2 border-amber-700 font-sans"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Quitar Débito Consolidado (R$ {totalAberto.toFixed(2)})
                  </button>
                </div>
              )}

              {/* Pagamentos Efetuados no Ciclo com Recibo e Segunda Via */}
              {(() => {
                const pagamentosEfetuadosCiclo = pagamentos.filter(
                  p => p.jogadorId === jogadorAtual.id && p.mesRef === mesSelecionado && p.status === 'pago'
                );
                if (pagamentosEfetuadosCiclo.length === 0) return null;
                return (
                  <div className="w-full max-w-md bg-teal-950/20 border border-teal-500/25 p-4 rounded-2xl text-left space-y-3 font-sans mt-3">
                    <h5 className="text-[11px] font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      Pagamentos Efetuados e Recibos (Ciclo Selecionado)
                    </h5>
                    <div className="divide-y divide-teal-500/10 space-y-2.5">
                      {pagamentosEfetuadosCiclo.map(p => {
                        const numRec = obterNumeroRecibo(p.id);
                        const desc = p.partidaId 
                          ? `Diária ref. Jogo de ${p.mesRef.split('-').reverse().join('/')}`
                          : `Mensalidade Fixa ref. ${p.mesRef.split('-').reverse().join('/')}`;
                        return (
                          <div key={p.id} className="flex flex-col gap-2 pt-2 first:pt-0">
                            <div className="flex justify-between items-start text-xs">
                              <div>
                                <p className="font-bold text-white leading-snug">{desc}</p>
                                <p className="text-[10px] text-teal-300 font-mono mt-0.5">Recibo: <span className="text-white font-extrabold">{numRec}</span></p>
                              </div>
                              <span className="font-mono font-bold text-teal-300 whitespace-nowrap">R$ {p.valor.toFixed(2)}</span>
                            </div>
                            
                            <button
                              type="button"
                              disabled={sendingReceiptId === p.id}
                              onClick={() => handleReenviarRecibo(p, desc)}
                              className="w-full mt-1 bg-teal-900/60 hover:bg-teal-800 disabled:opacity-50 text-white font-bold text-[10px] py-1.5 px-3 rounded-lg border border-teal-500/20 hover:border-teal-500/40 transition-all flex items-center justify-center gap-1.5 cursor-pointer uppercase active:scale-97"
                            >
                              {sendingReceiptId === p.id ? (
                                <>
                                  <RefreshCw className="w-3 h-3 text-white animate-spin" />
                                  Enviando...
                                </>
                              ) : (
                                <>
                                  <Mail className="w-3 h-3 text-teal-350" />
                                  Segunda Via Recibo (E-mail)
                                </>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

            </div>
          );
        })()}

        {debitosPessoais.length > 0 && (
          <div className="border-t border-rose-500/20 pt-5 space-y-4 text-left animate-fade-in" id="lista-debitos-atrasados-jogador">
            <h3 className="font-display font-black text-sm text-rose-455 flex items-center gap-2 uppercase tracking-wide">
              <ShieldAlert className="w-4 h-4 text-rose-500 animate-pulse" />
              Atenção: Débitos Pendentes de Quitação ({debitosPessoais.length})
            </h3>
            <p className="text-[10px] text-rose-300 mr-2">
              Você possui pendências financeiras registradas em jogos ou mensalidades anteriores. Regularize-as informando o pagamento para liberação pelo administrador.
            </p>

            <div className="bg-rose-950/20 rounded-2xl overflow-hidden border border-rose-500/20 divide-y border-rose-500/10 font-sans">
              {debitosPessoais.map((deb) => (
                <div 
                  key={deb.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-rose-955/5 hover:bg-rose-955/10 transition-all gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                    <div>
                      <p className="font-bold text-white text-xs">{deb.referencia}</p>
                      <p className="text-[10px] text-rose-300 font-mono mt-0.5">
                        Referido em: {deb.dataOrigem.split('-').reverse().join('/')} | Tipo: {deb.tipo === 'mensalidade' ? 'Mensalidade Fixa' : 'Diária de Partida'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3.5 shrink-0">
                    <div className="text-right">
                      <span className="font-mono text-white font-extrabold text-xs block">
                        R$ {deb.valor.toFixed(2)}
                      </span>
                      <span className={`text-[9px] font-black font-mono uppercase tracking-wider block mt-0.5 ${
                        deb.status === 'pendente_confirmacao' ? 'text-amber-400 animate-pulse' : 'text-rose-400 font-bold'
                      }`}>
                        {deb.status === 'pendente_confirmacao' ? 'AGUARDANDO VALID.' : 'EM ABERTO'}
                      </span>
                    </div>

                    {deb.status === 'pendente' ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            abrirCheckout([deb]);
                          }}
                          className="py-1.5 px-3 bg-rose-500 text-black hover:bg-rose-400 font-black text-[10px] rounded-lg transition-all shadow cursor-pointer uppercase tracking-wider active:scale-97 flex items-center gap-1 font-sans font-bold"
                        >
                          <RefreshCw className="w-3 h-3 text-black animate-spin-slow" />
                          Quitar Débito
                        </button>

                        {jogadorAtual.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (cancelarConfirmId === deb.id) {
                                onRegistrarPagamento(jogadorAtual.id, deb.mesRef, 'cancelado', null, deb.valor, deb.partidaId);
                                setCancelarConfirmId(null);
                              } else {
                                setCancelarConfirmId(deb.id);
                                setTimeout(() => setCancelarConfirmId(prev => prev === deb.id ? null : prev), 3000);
                              }
                            }}
                            className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer uppercase active:scale-97 text-[10px] font-bold ${
                              cancelarConfirmId === deb.id
                                ? 'bg-red-500 text-black font-black animate-pulse border border-red-500'
                                : 'bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900'
                            }`}
                          >
                            {cancelarConfirmId === deb.id ? 'Confirmar Cancelamento?' : 'Cancelar Cobrança'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 py-1 px-2.5 rounded border border-emerald-500/20 whitespace-nowrap">
                          Pendente Confirmação
                        </span>

                        {jogadorAtual.role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => {
                              if (cancelarConfirmId === deb.id) {
                                onRegistrarPagamento(jogadorAtual.id, deb.mesRef, 'cancelado', null, deb.valor, deb.partidaId);
                                setCancelarConfirmId(null);
                              } else {
                                setCancelarConfirmId(deb.id);
                                setTimeout(() => setCancelarConfirmId(prev => prev === deb.id ? null : prev), 3000);
                              }
                            }}
                            className={`py-1.5 px-2.5 rounded-lg transition-all cursor-pointer uppercase active:scale-97 text-[10px] font-bold ${
                              cancelarConfirmId === deb.id
                                ? 'bg-red-500 text-black font-black animate-pulse border border-red-500'
                                : 'bg-rose-950/60 border border-rose-500/30 text-rose-300 hover:bg-rose-900'
                            }`}
                          >
                            {cancelarConfirmId === deb.id ? 'Confirmar Cancelamento?' : 'Cancelar Cobrança'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SEÇÃO NOVO: HISTÓRICO DE FATURAMENTO COMPLETO DESTE JOGADOR */}
        <div className="border-t border-white/10 pt-5 space-y-4 text-left">
          <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide">
            <History className="w-4 h-4 text-teal-400" />
            Histórico Pessoal de Faturamento e Mensalidades
          </h3>
          <p className="text-[10px] text-emerald-300/80 font-sans">Exibição de todos os fechamentos e contribuições passadas na competência da pelada.</p>

          <div className="bg-black/25 rounded-2xl overflow-hidden border border-white/5 divide-y divide-white/5 font-sans">
            {competencasDisponiveis.map((comp) => {
              const isGoleiro = jogadorAtual.posicao.includes('Goleiro');
              const isDiarista = jogadorAtual.membroStatus === 'diarista';
              
              let mesCadastro: string | null = null;
              if (jogadorAtual.createdAt) {
                if (jogadorAtual.createdAt.length >= 7 && jogadorAtual.createdAt.includes('-')) {
                  mesCadastro = jogadorAtual.createdAt.substring(0, 7);
                } else {
                  const d = new Date(jogadorAtual.createdAt);
                  if (!isNaN(d.getTime())) {
                    const y = d.getUTCFullYear();
                    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                    mesCadastro = `${y}-${m}`;
                  }
                }
              }
              
              const checkPgGeral = obterPagamentoDoJogador(comp.value);
              const pagamentosDiaristaMes = pagamentos.filter(p => p.jogadorId === jogadorAtual.id && p.mesRef === comp.value && p.status !== 'cancelado' && p.partidaId);
              
              if (mesCadastro && comp.value < mesCadastro && !checkPgGeral && pagamentosDiaristaMes.length === 0) {
                return null;
              }
              
              if (isDiarista) {
                const pagamentosMes = pagamentosDiaristaMes;
                const valorTotalNoMes = pagamentosMes.reduce((sum, p) => sum + p.valor, 0);
                const isAllPaid = pagamentosMes.length > 0 && pagamentosMes.every(p => p.status === 'pago');
                const hasPendingValidation = pagamentosMes.some(p => p.status === 'pendente_confirmacao');
                const pStatus = isGoleiro ? 'isento' : pagamentosMes.length === 0 ? 'nenhum' : hasPendingValidation ? 'aguardando' : isAllPaid ? 'pago' : 'pendente';

                return (
                  <div key={`diarista-${comp.value}`} className="flex flex-col p-3.5 bg-emerald-955/10 hover:bg-emerald-955/20 transition-all gap-3 text-xs w-full">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                        <div>
                          <p className="font-bold text-white text-xs">{comp.label}</p>
                          <p className="text-[10px] text-emerald-300 font-mono mt-0.5">
                            Faturamento de: Diarista Avulso (Consolidado)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3.5">
                        <span className="font-mono text-white font-bold">
                          R$ {valorTotalNoMes.toFixed(2)}
                        </span>

                        <span className={`px-2.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider ${
                          pStatus === 'isento' 
                            ? 'bg-teal-555/40 border border-teal-500/30 text-teal-400' 
                            : pStatus === 'nenhum'
                              ? 'bg-slate-800/60 border border-slate-700/30 text-slate-400'
                              : pStatus === 'aguardando'
                                ? 'bg-amber-955/70 border border-amber-500/20 text-amber-500'
                                : pStatus === 'pago' 
                                  ? 'bg-teal-900/60 border border-teal-500/30 text-teal-400' 
                                  : 'bg-rose-955/60 border border-rose-500/30 text-rose-455'
                        }`}>
                          {pStatus === 'isento' ? 'ISENTO' : pStatus === 'nenhum' ? 'SEM JOGOS' : pStatus === 'aguardando' ? 'AGUARDANDO VALID' : pStatus === 'pago' ? 'QUITADO' : 'PENDENTE'}
                        </span>
                      </div>
                    </div>

                    {/* Detalhamento das partidas pagas no mes pelo diarista */}
                    {pagamentosMes.length > 0 && (
                      <div className="mt-2 pl-4 border-l-2 border-emerald-500/20 space-y-2">
                        <p className="text-[9.5px] font-bold text-emerald-400 mb-1">Relação de Diárias no Mês:</p>
                        {pagamentosMes.map(p => {
                          const prt = partidas.find(pt => pt.id === p.partidaId);
                          const numRec = obterNumeroRecibo(p.id);
                          const descRef = `Diária ref. Jogo de ${p.mesRef.split('-').reverse().join('/')}`;
                          return (
                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 text-[10px] tracking-wide text-emerald-200 bg-black/10 p-2 rounded-lg border border-white/5">
                              <div>
                                <span className="font-bold">• {prt ? prt.titulo : 'Jogo Avulso'}</span>
                                <span className="text-[9.5px] font-mono text-emerald-400 block mt-0.5">
                                  {p.status === 'pago' ? `Quitado em ${p.dataPagamento?.split('-').reverse().join('/') || ''}` : 'Pendente'}
                                </span>
                                {p.status === 'pago' && (
                                  <span className="text-[9px] font-mono text-teal-350 block mt-0.5">Recibo: <span className="text-white font-extrabold">{numRec}</span></span>
                                )}
                              </div>
                              <div className="flex items-center gap-2.5 justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0">
                                <span className="font-mono font-bold text-white text-[11px]">R$ {p.valor.toFixed(2)}</span>
                                {p.status === 'pago' && (
                                  <button
                                    type="button"
                                    disabled={sendingReceiptId === p.id}
                                    onClick={() => handleReenviarRecibo(p, descRef)}
                                    className="py-1 px-2.5 rounded bg-teal-900/60 hover:bg-teal-800 disabled:opacity-50 text-[9px] font-bold text-teal-300 border border-teal-500/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                                    title="Reenviar segunda via do recibo para o seu e-mail"
                                  >
                                    {sendingReceiptId === p.id ? (
                                      <RefreshCw className="w-2.5 h-2.5 text-white animate-spin" />
                                    ) : (
                                      <Mail className="w-2.5 h-2.5 text-teal-400" />
                                    )}
                                    Segunda Via
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }

              // Lógica original para MENSALISTAS
              const checkPg = obterPagamentoDoJogador(comp.value);
              
              // Se o pagamento foi cancelado, ocultamos do histórico (deletado do histórico)
              if ((checkPg?.status as any) === 'cancelado') return null;

              const isCompPaid = isGoleiro || checkPg?.status === 'pago';

              return (
                <div 
                  key={comp.value}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3.5 bg-emerald-955/10 hover:bg-emerald-955/20 transition-all gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white text-xs">{comp.label}</p>
                      <p className="text-[10px] text-emerald-300 font-mono mt-0.5">
                        Faturamento de: {isGoleiro ? 'Isenção de Goleiro' : 'Mensalista Fixo'}
                      </p>
                      {checkPg && checkPg.status === 'pago' && (
                        <p className="text-[9px] text-teal-350 font-mono mt-0.5">
                          Recibo: <span className="text-white font-extrabold">{obterNumeroRecibo(checkPg.id)}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3.5 flex-wrap">
                    <span className="font-mono text-white font-bold">
                      R$ {isGoleiro ? '0,00' : (checkPg ? checkPg.valor : valorCobradoMes).toFixed(2)}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider ${
                      isGoleiro 
                        ? 'bg-teal-555/40 border border-teal-500/30 text-teal-400' 
                        : (checkPg?.status as any) === 'pendente_confirmacao'
                          ? 'bg-amber-955/70 border border-amber-500/20 text-amber-500'
                          : (checkPg?.status as any) === 'cancelado'
                            ? 'bg-slate-800/60 border border-slate-700/30 text-slate-400 line-through'
                            : isCompPaid 
                              ? 'bg-teal-900/60 border border-teal-500/30 text-teal-400' 
                              : 'bg-rose-955/60 border border-rose-500/30 text-rose-455'
                    }`}>
                      {isGoleiro 
                        ? 'ISENTO' 
                        : (checkPg?.status as any) === 'pendente_confirmacao' 
                          ? 'AGUARDANDO VALID' 
                          : (checkPg?.status as any) === 'cancelado'
                            ? 'CANCELADO'
                            : isCompPaid 
                              ? 'QUITADO' 
                              : 'PENDENTE'}
                    </span>

                    {checkPg?.dataPagamento && (
                      <span className="text-[10px] font-mono text-emerald-400/80">
                        PG: {checkPg.dataPagamento.split('-').reverse().join('/')}
                      </span>
                    )}

                    {checkPg && checkPg.status === 'pago' && (
                      <button
                        type="button"
                        disabled={sendingReceiptId === checkPg.id}
                        onClick={() => handleReenviarRecibo(checkPg, `Mensalidade Fixa ref. ${comp.label}`)}
                        className="py-1 px-2.5 rounded bg-teal-900/60 hover:bg-teal-800 disabled:opacity-50 text-[9px] font-bold text-teal-300 border border-teal-500/20 transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Reenviar segunda via do recibo para o seu e-mail"
                      >
                        {sendingReceiptId === checkPg.id ? (
                          <RefreshCw className="w-2.5 h-2.5 text-white animate-spin" />
                        ) : (
                          <Mail className="w-2.5 h-2.5 text-teal-400" />
                        )}
                        Segunda Via
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      <CheckoutPixModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        jogadorAtual={jogadorAtual}
        valorTotal={checkoutValorTotal}
        debitos={checkoutDebitos}
        onConfirmarPagamentoTotal={handleConfirmarPagamentoTotal}
      />

      {/* POPUP ALERT DE RESPOSTA DO RECIBO */}
      {alertMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
          <div className="bg-emerald-950 border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 text-center font-sans">
            <div className="flex justify-center">
              {alertMessage.type === 'success' ? (
                <div className="w-12 h-12 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              ) : (
                <div className="w-12 h-12 rounded-full bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertCircle className="w-6 h-6 animate-bounce" />
                </div>
              )}
            </div>
            
            <div className="space-y-1.5">
              <h4 className="font-display font-black text-sm text-white uppercase tracking-wider">
                {alertMessage.type === 'success' ? 'Recibo Enviado!' : 'Falha no Envio'}
              </h4>
              <p className="text-xs text-emerald-300/90 leading-relaxed">
                {alertMessage.text}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAlertMessage(null)}
              className="w-full bg-white hover:bg-emerald-50 text-emerald-950 font-extrabold text-xs py-2.5 rounded-xl transition-all cursor-pointer uppercase font-sans tracking-wide active:scale-97"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
