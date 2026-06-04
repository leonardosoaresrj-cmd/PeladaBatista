/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
  RefreshCw
} from 'lucide-react';
import { isFechamentoMensalistas, obterTextoPagamentoMensalidade, obterDebitosDoJogador } from '../utils/confirmationRules';

interface ControlePagamentosProps {
  pagamentos: Pagamento[];
  jogadores: Jogador[];
  jogadorAtual: Jogador;
  onRegistrarPagamento: (jogadorId: string, mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao', dataPagamento: string | null, valor: number, partidaId?: string) => void;
  valor4Sabados: number;
  valor5Sabados: number;
  valorDiaria: number;
  onUpdateValoresConfig: (v4: number, v5: number, vD: number) => void;
  partidas: Partida[];
}

function contarSabadosNoMes(mes: string): number {
  if (!mes || !mes.includes('-')) return 4;
  const [ano, mesNum] = mes.split('-').map(Number);
  const data = new Date(ano, mesNum - 1, 1);
  let count = 0;
  while (data.getMonth() === mesNum - 1) {
    if (data.getDay() === 6) { // 6 é sábado
      count++;
    }
    data.setDate(data.getDate() + 1);
  }
  return count;
}

export default function ControlePagamentos({
  pagamentos,
  jogadores,
  jogadorAtual,
  onRegistrarPagamento,
  valor4Sabados,
  valor5Sabados,
  valorDiaria,
  partidas,
}: ControlePagamentosProps) {
  // Filtro de mês de referência para a cobrança atual
  const [mesSelecionado, setMesSelecionado] = useState('2026-05');
  
  // Cálculos de sábados e tarifas correspondentes
  const numSabados = contarSabadosNoMes(mesSelecionado);
  const valorMensalidadeMes = numSabados === 5 ? valor5Sabados : valor4Sabados;
  const valorDiariaMes = valorDiaria;

  // Período de fechamento (dias 1-10 do mês)
  const isPeriodoFechamento = isFechamentoMensalistas();

  // Obter o registro do pagamento atual do jogador para o mês selecionado
  const obterPagamentoDoJogador = (mes: string) => {
    return pagamentos.find(p => p.jogadorId === jogadorAtual.id && p.mesRef === mes);
  };

  const pagAtual = obterPagamentoDoJogador(mesSelecionado);

  const valorCobradoMes = useMemo(() => {
    if (jogadorAtual.posicao === 'Goleiro') return 0;
    if (jogadorAtual.membroStatus === 'mensalista') return valorMensalidadeMes;
    return valorDiariaMes;
  }, [jogadorAtual, valorMensalidadeMes, valorDiariaMes]);

  // Histórico de competências que o usuário pode visualizar
  const competencasDisponiveis = [
    { value: '2026-05', label: 'Maio / 2026' },
    { value: '2026-06', label: 'Junho / 2026' }
  ];

  const debitosPessoais = useMemo(() => {
    return obterDebitosDoJogador(
      jogadorAtual.id,
      jogadorAtual.membroStatus,
      jogadorAtual.posicao,
      partidas,
      pagamentos,
      valorDiaria,
      valor4Sabados,
      valor5Sabados
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
      {jogadorAtual.posicao === 'Goleiro' ? (
        <div className="bg-gradient-to-r from-teal-950/60 to-emerald-950/30 border border-teal-500/20 p-4.5 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-emerald-100">
          <div className="flex items-start gap-2.5 text-left">
            <Sparkles className="w-5 h-5 mt-0.5 shrink-0 text-teal-400 animate-pulse" />
            <div>
              <h4 className="text-xs font-black uppercase tracking-wider">
                🛡️ Posição Isenta de Taxas (Goleiro Oficial)
              </h4>
              <p className="text-[11px] text-teal-300 mt-1 font-sans leading-relaxed">
                No Arena Record, os <b>Goleiros são 100% gratuitos</b> e isentos de mensalidade ou diária. Obrigado por fechar o gol e garantir ótimas defesas a cada treino!
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
          const isGoleiro = jogadorAtual.posicao === 'Goleiro';
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
                  className="w-16 h-16 rounded-full flex items-center justify-center text-sm font-bold border border-white/10 overflow-hidden shadow-lg"
                  style={{ backgroundColor: avatar.color, color: avatar.text === '⚪' ? '#fff' : '#000' }}
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
                    ✓ <b>Livre de pendências!</b> Você tem acesso total de goleiro oficial confirmado aos rachas. Não há cobranças emitidas para o seu PIN.
                  </p>
                </div>
              ) : debitosPessoais.length === 0 ? (
                <div className="text-center w-full max-w-md space-y-1.5 pt-1">
                  <p className="text-xs text-teal-200 leading-relaxed font-sans bg-teal-500/10 border border-teal-500/20 p-3 rounded-xl font-bold">
                    🎉 Excelente! Você está 100% em dia com a pelada Arena Record. Não há nenhum débito pendente em aberto ou em análise. Obrigado pela colaboração!
                  </p>
                </div>
              ) : hasPendenteConfirmacaoOnly ? (
                <div className="text-center w-full max-w-md space-y-3 pt-1">
                  <p className="text-xs text-amber-200 leading-relaxed font-sans bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl">
                    ✓ <b>Comprovantes de pagamento informados!</b> Todos os seus débitos (<b>R$ {totalConsolidado.toFixed(2)}</b>) estão sendo analisados pela administração do caixa.
                  </p>
                  
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Olá! Sou o atleta ${jogadorAtual.nome} ${jogadorAtual.sobrenome} e acabei de informar o pagamento total de meus débitos no app Arena Record no valor de R$ ${totalConsolidado.toFixed(2)}.`
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
                      abertos.forEach(deb => {
                        onRegistrarPagamento(
                          jogadorAtual.id,
                          deb.mesRef,
                          'pendente_confirmacao',
                          null,
                          deb.valor,
                          deb.partidaId
                        );
                      });
                    }}
                    className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5 cursor-pointer uppercase border-b-2 border-amber-700"
                  >
                    <DollarSign className="w-3.5 h-3.5" />
                    Quitar Débito Consolidado (R$ {totalAberto.toFixed(2)})
                  </button>
                </div>
              )}

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
                      <button
                        type="button"
                        onClick={() => {
                          onRegistrarPagamento(
                            jogadorAtual.id,
                            deb.mesRef,
                            'pendente_confirmacao',
                            null,
                            deb.valor,
                            deb.partidaId
                          );
                        }}
                        className="py-1.5 px-3 bg-rose-500 text-black hover:bg-rose-400 font-black text-[10px] rounded-lg transition-all shadow cursor-pointer uppercase tracking-wider active:scale-97 flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3 text-black animate-spin-slow" />
                        Quitar Débito
                      </button>
                    ) : (
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 py-1 px-2.5 rounded border border-emerald-500/20">
                        Pendente Confirmação
                      </span>
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
              const checkPg = obterPagamentoDoJogador(comp.value);
              const isGoleiro = jogadorAtual.posicao === 'Goleiro';
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
                        Faturamento de: {isGoleiro ? 'Isenção de Goleiro' : (jogadorAtual.membroStatus === 'mensalista' ? 'Mensalista Fixo' : 'Diarista Avulso')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3.5">
                    <span className="font-mono text-white font-bold">
                      R$ {isGoleiro ? '0,00' : (checkPg ? checkPg.valor : valorCobradoMes).toFixed(2)}
                    </span>

                    <span className={`px-2.5 py-0.5 rounded text-[9px] font-black font-mono uppercase tracking-wider ${
                      isGoleiro 
                        ? 'bg-teal-555/40 border border-teal-500/30 text-teal-400' 
                        : checkPg?.status === 'pendente_confirmacao'
                          ? 'bg-amber-955/70 border border-amber-500/20 text-amber-500'
                          : isCompPaid 
                            ? 'bg-teal-900/60 border border-teal-500/30 text-teal-400' 
                            : 'bg-rose-955/60 border border-rose-500/30 text-rose-455'
                    }`}>
                      {isGoleiro 
                        ? 'ISENTO' 
                        : checkPg?.status === 'pendente_confirmacao' 
                          ? 'AGUARDANDO VALID' 
                          : isCompPaid 
                            ? 'QUITADO' 
                            : 'PENDENTE'}
                    </span>

                    {checkPg?.dataPagamento && (
                      <span className="text-[10px] font-mono text-emerald-400/80">
                        PG: {checkPg.dataPagamento.split('-').reverse().join('/')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

    </div>
  );
}
