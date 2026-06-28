/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Jogador, Pagamento } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Users, Search, UserCheck, Award, Star, Mail, Calendar } from 'lucide-react';
import { obterJanelaRenovacaoParaMesRef, isFechamentoMensalistas } from '../utils/confirmationRules';

interface MensalistasMesProps {
  jogadores: Jogador[];
  pagamentos: Pagamento[];
  jogadorAtual: Jogador;
  onRegistrarPagamento: (jogadorId: string, mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado', dataPagamento: string | null, valor: number) => void;
  valor4Sabados: number;
  valor5Sabados: number;
  whatsappAutomacaoAtiva?: boolean;
  onRegistrarLogAutomacao?: (atleta: string, partida: string, msg: string) => void;
}

export default function MensalistasMes({
  jogadores,
  pagamentos,
  jogadorAtual,
  onRegistrarPagamento,
  valor4Sabados,
  valor5Sabados,
  whatsappAutomacaoAtiva = false,
  onRegistrarLogAutomacao
}: MensalistasMesProps) {
  const [filtroPesquisa, setFiltroPesquisa] = useState('');
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

  const [removerConfirmId, setRemoverConfirmId] = useState<string | null>(null);

  // Obter período de renovação dos mensalistas
  const janelaRenovacao = useMemo(() => {
    const agora = new Date();
    const y = agora.getFullYear();
    const m = agora.getMonth();
    
    let janela = obterJanelaRenovacaoParaMesRef(y, m);
    if (agora > janela.fim) {
      let proxMes = m + 1;
      let proxAno = y;
      if (proxMes > 11) {
        proxMes = 0;
        proxAno += 1;
      }
      janela = obterJanelaRenovacaoParaMesRef(proxAno, proxMes);
    }
    
    const infoFechamento = isFechamentoMensalistas(agora);
    
    return {
      inicio: janela.inicio.toLocaleDateString('pt-BR'),
      fim: janela.fim.toLocaleDateString('pt-BR'),
      estaAberta: infoFechamento.emPeriodo
    };
  }, []);

  const obterMesAtual = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  const opcoesMeses = useMemo(() => {
    const mesLimit = obterMesAtual(); // ex: '2026-06'
    const mesSet = new Set<string>();
    
    if (mesLimit >= startupMonth) {
      mesSet.add(mesLimit);
    } else {
      mesSet.add(startupMonth);
    }

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
  }, [pagamentos, startupMonth]);

  // Calcular sábados do mês selecionado
  const countSabados = useMemo(() => {
    const [ano, mesNum] = mesSelecionado.split('-').map(Number);
    const tempDate = new Date(ano, mesNum - 1, 1);
    let count = 0;
    while (tempDate.getMonth() === mesNum - 1) {
      if (tempDate.getDay() === 6) {
        count++;
      }
      tempDate.setDate(tempDate.getDate() + 1);
    }
    return count;
  }, [mesSelecionado]);

  const valorMensalidadeMês = countSabados === 5 ? valor5Sabados : valor4Sabados;

  // Filtrar apenas mensalistas cadastrados e ativos
  const mensalistasAtivos = useMemo(() => {
    return jogadores.filter(
      (j) => j.membroStatus === 'mensalista' && j.status === 'ativo'
    );
  }, [jogadores]);

  const mensalistasComStatusDoMes = useMemo(() => {
    return mensalistasAtivos.map(jogador => {
      const pag = pagamentos.find(
        (p) => p.jogadorId === jogador.id && p.mesRef === mesSelecionado && !p.partidaId
      );
      return {
        jogador,
        pagamento: pag
      };
    });
  }, [mensalistasAtivos, pagamentos, mesSelecionado]);

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

  const dispararMensalistasWhatsApp = () => {
    if (!whatsappAutomacaoAtiva || !onRegistrarLogAutomacao) return;

    const quitados = mensalistasComStatusDoMes.filter(m => m.pagamento?.status === 'pago');
    const pendentes = mensalistasComStatusDoMes.filter(m => !m.pagamento || m.pagamento?.status === 'pendente' || m.pagamento?.status === 'pendente_confirmacao');
    
    let msg = `💰 *MENSALIDADES DO ELENCO - ${mesSelecionado.split('-').reverse().join('/')}* 💰\n\n`;
    msg += `Valor base: R$ ${valorMensalidadeMês.toFixed(2)}\n\n`;
    
    msg += `✅ *QUITADOS (${quitados.length})*\n`;
    if (quitados.length === 0) msg += `_Nenhum pagamento registrado_\n`;
    else msg += quitados.map((m, i) => `${i+1}. ${m.jogador.nome} ${m.jogador.sobrenome} 💰`).join('\n') + '\n';
    
    msg += `\n⏳ *PENDENTES (${pendentes.length})*\n`;
    if (pendentes.length === 0) msg += `_Todos em dia!_\n`;
    else msg += pendentes.map((m, i) => `${i+1}. ${m.jogador.nome} ${m.jogador.sobrenome} ❌`).join('\n') + '\n';
    
    msg += `\n_Para realizar o pagamento através da nossa chave PIX, procure a tesouraria. Quem paga em dia garante prioridade no jogo!_`;

    // Automatic sending removed as per user request (only config area tests allowed)
    alert('Automação removida conforme solicitação. Somente mensagens da área de configuração estão ativas no momento.');
  };

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
            Membros oficiais e vitalícios que compõem o elenco da pelada Pelada Batista Sábado.
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

      {/* Banner de Janela de Renovação */}
      <div id="banner-janela-renovacao-mensalistas" className="bg-emerald-950/40 border border-emerald-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left shadow-lg backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="space-y-0.5">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">Período de Renovação da Mensalidade</h4>
            <p className="text-[11px] text-emerald-250 leading-relaxed">
              O período de renovação oficial compreende de segunda-feira após o último sábado do mês anterior até a sexta-feira antes do segundo sábado do mês de renovação.
            </p>
          </div>
        </div>
        <div className="bg-emerald-900/60 border border-white/5 rounded-xl px-4 py-2.5 shrink-0 flex flex-col justify-center sm:text-right">
          <span className="text-[9px] text-emerald-350 font-mono uppercase tracking-wider block">
            {janelaRenovacao.estaAberta ? '🟢 Janela de Renovação Ativa' : '⏳ Status de Renovação'}
          </span>
          <span className="text-xs font-bold text-white font-mono mt-0.5 block">
            {janelaRenovacao.inicio} a {janelaRenovacao.fim}
          </span>
        </div>
      </div>

      {/* Filtros e Caixa de Busca */}
      <div id="filtros-mensalistas-container" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div id="filtros-busca-mensalistas" className="relative md:col-span-2">
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

        <div id="selecao-competencia-mensalistas" className="relative">
          <select
            id="select-mes-mensalistas"
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="w-full bg-emerald-950/45 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white hover:border-emerald-500/50 focus:outline-none focus:border-white focus:ring-1 focus:ring-white/20 transition-all font-sans cursor-pointer appearance-none"
          >
            {opcoesMeses.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-emerald-950 text-white">
                📅 {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-emerald-500 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* SEÇÃO: CONTROLE / HISTÓRICO DE PAGAMENTO DOS MENSALISTAS */}
      {jogadorAtual?.role === 'admin' && (
        <div 
          id="historico-financeiro-mensalistas" 
          className="bg-emerald-900/40 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4 text-left font-sans text-white"
        >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-base text-amber-400 flex items-center gap-2 uppercase tracking-wide">
              <Calendar className="w-5 h-5 text-amber-400" />
              Histórico / Relação de Pagamento de Mensalistas ({mesSelecionado.split('-').reverse().join('/')})
            </h3>
            <p className="text-xs text-emerald-300/80">
              Acompanhe quem já quitou a mensalidade deste período ou registre pagamentos diretamente. Valor: <strong className="text-white">R$ {valorMensalidadeMês.toFixed(2)}</strong> ({countSabados} sábados).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-teal-500/10 border border-teal-500/20 text-teal-300 px-3 py-1 rounded-full whitespace-nowrap">
              {mensalistasComStatusDoMes.filter(m => m.pagamento?.status === 'pago').length} Quitados
            </span>
            <span className="text-xs font-mono font-bold bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3 py-1 rounded-full whitespace-nowrap">
              {mensalistasComStatusDoMes.filter(m => !m.pagamento || m.pagamento?.status === 'pendente').length} Pendentes
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mensalistasComStatusDoMes.map(({ jogador, pagamento }) => {
            const avatar = getAvatarProps(jogador.foto);
            const status = pagamento?.status || 'pendente';
            
            return (
              <div 
                key={jogador.id}
                className="flex items-center justify-between p-3.5 bg-emerald-950/30 border border-white/5 rounded-xl hover:bg-emerald-955/45 transition-all gap-4 animate-fade-in"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/10 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                    style={{ backgroundColor: avatar.color }}
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
                  <div className="min-w-0">
                    <h4 className="font-bold text-white text-xs truncate">{jogador.nome} {jogador.sobrenome}</h4>
                    <p className="text-[10px] text-emerald-400 font-mono">{jogador.posicao}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 col-span-1">
                  <div className="text-right">
                    <span className="block font-mono font-black text-white text-[11px]">
                      R$ {valorMensalidadeMês.toFixed(2)}
                    </span>
                    <span className={`block text-[9px] font-black uppercase tracking-wider font-mono ${
                      status === 'pago' 
                        ? 'text-teal-400' 
                        : status === 'pendente_confirmacao' 
                          ? 'text-amber-400 animate-pulse' 
                          : status === 'cancelado'
                            ? 'text-slate-400 line-through'
                            : 'text-rose-400'
                    }`}>
                      {status === 'pago' 
                        ? 'Pago ✅' 
                        : status === 'pendente_confirmacao' 
                          ? 'Aguard. Confirmação ⏳' 
                          : status === 'cancelado'
                            ? 'Cancelado/Indevido 🚫'
                            : 'Pendente ❌'}
                    </span>
                    {status === 'pago' && pagamento?.dataPagamento && (
                      <span className="block text-[8.5px] font-mono text-emerald-400 font-bold mt-0.5">
                        📅 {pagamento.dataPagamento.split('-').reverse().join('/')}
                      </span>
                    )}
                  </div>

                  {/* Botão de Quitação para ADMINISTRADOR */}
                  {jogadorAtual?.role === 'admin' && (
                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      {status === 'cancelado' ? (
                        <button
                          type="button"
                          onClick={() => {
                            onRegistrarPagamento(jogador.id, mesSelecionado, 'pendente', null, valorMensalidadeMês);
                          }}
                          className="py-1 px-2.5 bg-emerald-700/80 hover:bg-emerald-600 text-white font-bold text-[9px] rounded transition-all cursor-pointer uppercase font-sans"
                        >
                          Reativar
                        </button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          {status === 'pendente' || status === 'pendente_confirmacao' ? (
                            <button
                              type="button"
                              onClick={() => {
                                const hojeStr = new Date().toISOString().split('T')[0];
                                onRegistrarPagamento(jogador.id, mesSelecionado, 'pago', hojeStr, valorMensalidadeMês);
                              }}
                              className="py-1 px-2.5 bg-teal-500 hover:bg-teal-400 text-black font-black text-[10px] rounded transition-all cursor-pointer uppercase tracking-wide active:scale-97 font-sans"
                            >
                              Quitar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                onRegistrarPagamento(jogador.id, mesSelecionado, 'pendente', null, valorMensalidadeMês);
                              }}
                              className="py-1 px-2 bg-rose-955/50 border border-rose-500/20 hover:bg-rose-900 text-rose-300 font-bold text-[9px] rounded transition-all cursor-pointer uppercase font-sans"
                            >
                              Estornar
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (removerConfirmId === jogador.id) {
                                onRegistrarPagamento(jogador.id, mesSelecionado, 'cancelado', null, valorMensalidadeMês);
                                setRemoverConfirmId(null);
                              } else {
                                setRemoverConfirmId(jogador.id);
                                setTimeout(() => setRemoverConfirmId(prev => prev === jogador.id ? null : prev), 3005);
                              }
                            }}
                            className={`py-1 px-1.5 rounded transition-all cursor-pointer uppercase text-[9px] font-bold font-sans ${
                              removerConfirmId === jogador.id
                                ? 'bg-red-500 text-black font-black animate-pulse border border-red-500'
                                : 'text-rose-400 hover:text-rose-300 bg-rose-955/20 border border-rose-500/10 hover:bg-rose-955/40'
                            }`}
                            title="Remover / Cancelar Cobrança"
                          >
                            {removerConfirmId === jogador.id ? 'Confirma?' : 'Remover'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      )}

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
                              className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 shadow-lg overflow-hidden relative border-2 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200 ${
                                isGold ? 'border-amber-400 animate-pulse' : 'border-emerald-500/20'
                              }`}
                              style={{ backgroundColor: avatar.color }}
                              onClick={() => {
                                if (jogador.foto && (jogador.foto.startsWith('http') || jogador.foto.startsWith('data:'))) {
                                  (window as any).ampliarFoto?.(jogador.foto, `${jogador.nome} ${jogador.sobrenome}`);
                                }
                              }}
                              title={jogador.foto ? "Clique para ampliar" : undefined}
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
