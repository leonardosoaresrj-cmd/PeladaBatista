/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { Jogador, Partida, Pagamento, LancamentoAvulso } from '../types';
import { AVATAR_PRESETS } from '../data';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  PlusCircle,
  FileText,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Sliders,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  X,
  Users,
  Pencil
} from 'lucide-react';
import { obterDebitosDoJogador } from '../utils/confirmationRules';

interface ControleCaixaProps {
  partidas: Partida[];
  jogadores: Jogador[];
  pagamentos: Pagamento[];
  lancamentos: LancamentoAvulso[];
  onAddLancamento: (l: Omit<LancamentoAvulso, 'id'>) => void;
  onRemoveLancamento: (id: string) => void;
  onUpdateLancamento?: (l: LancamentoAvulso) => void;
  aluguelCampoBase: number;
  onUpdateAluguelCampoBase: (valor: number) => void;
  valorDiaria: number;
  valor4Sabados: number;
  valor5Sabados: number;
  onRegistrarPagamento?: (jogadorId: string, mesRef: string, status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado', dataPagamento: string | null, valor: number, partidaId?: string) => void;
  jogadorAtual?: Jogador;
  onLimparDadosDoMes?: (mesRef: string) => void;
}

export default function ControleCaixa({
  partidas,
  jogadores,
  pagamentos,
  lancamentos,
  onAddLancamento,
  onRemoveLancamento,
  onUpdateLancamento,
  aluguelCampoBase,
  onUpdateAluguelCampoBase,
  valorDiaria,
  valor4Sabados,
  valor5Sabados,
  onRegistrarPagamento,
  jogadorAtual,
  onLimparDadosDoMes
}: ControleCaixaProps) {
  // Helper to find the correct rent of a given month
  const getAluguelDoMes = (mes: string): number => {
    const mapStr = localStorage.getItem('futebol_aluguel_mensal_map');
    const currentMonthStr = '2026-06';
    if (mapStr) {
      try {
        const map = JSON.parse(mapStr);
        if (map[mes] !== undefined) {
          return map[mes];
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (mes <= currentMonthStr) {
      const priorVal = localStorage.getItem('futebol_aluguel_campo_prior');
      return priorVal ? Number(priorVal) : 500;
    }
    return aluguelCampoBase;
  };

  // Estado para escopo de visualização (Mensal vs Anual vs Consolidado Total)
  const [visaoEscopo, setVisaoEscopo] = useState<'mensal' | 'anual' | 'consolidado'>('mensal');

  // Estado para confirmar cancelamento sem window.confirm
  const [cancelarConfirmId, setCancelarConfirmId] = useState<string | null>(null);

  // Estados para exclusão de mês e pop-up de detalhes
  const [deletarMesConfirmId, setDeletarMesConfirmId] = useState<string | null>(null);
  const [detalhesMesModal, setDetalhesMesModal] = useState<string | null>(null);

  // Estado para Mês de Referência do Caixa Geral
  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  
  // Estado para Jogo Selecionado na sub-área 1
  const [partidaSelecionadaId, setPartidaSelecionadaId] = useState<string>('');

  // Formulário de lançamentos avulsos
  const [showFormAvulso, setShowFormAvulso] = useState<boolean>(false);
  const [avulsoTipo, setAvulsoTipo] = useState<'receita' | 'despesa'>('receita');
  const [avulsoDescricao, setAvulsoDescricao] = useState('');
  const [avulsoValor, setAvulsoValor] = useState<number>(0);
  const [avulsoData, setAvulsoData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [avulsoCategoria, setAvulsoCategoria] = useState<string>('outros_receita');
  const [avulsoPartidaId, setAvulsoPartidaId] = useState<string>('');
  const [editingLancamentoId, setEditingLancamentoId] = useState<string>('');

  // Ajuste de aluguel do campo local state
  const [tempAluguel, setTempAluguel] = useState<number>(aluguelCampoBase);
  const [isEditingAluguel, setIsEditingAluguel] = useState(false);

  // Extrair o ano ativo a partir do mês selecionado
  const anoSelecionado = useMemo(() => {
    return mesSelecionado.split('-')[0] || '2026';
  }, [mesSelecionado]);

  // --- CÁLCULO MENSAL ---
  // Filtrar partidas que ocorrem no mês selecionado
  const partidasDoMes = useMemo(() => {
    return partidas.filter(p => !p.cancelada && p.data.startsWith(mesSelecionado));
  }, [partidas, mesSelecionado]);

  // Ordenar partidas cronologicamente
  const partidasDoMesSorted = useMemo(() => {
    return [...partidasDoMes].sort((a, b) => a.data.localeCompare(b.data));
  }, [partidasDoMes]);

  // Contagem de sábados no mês para rateios de mensalidades
  const numSabados = useMemo(() => {
    if (!mesSelecionado) return 4;
    const [ano, mesNum] = mesSelecionado.split('-').map(Number);
    const data = new Date(ano, mesNum - 1, 1);
    let count = 0;
    while (data.getMonth() === mesNum - 1) {
      if (data.getDay() === 6) {
        count++;
      }
      data.setDate(data.getDate() + 1);
    }
    return count;
  }, [mesSelecionado]);

  const valorMensalidadeMes = numSabados === 5 ? valor5Sabados : valor4Sabados;

  // Filtrar lançamentos manuais do mês correspondente
  const lancamentosDoMes = useMemo(() => {
    return lancamentos.filter(l => l.data.startsWith(mesSelecionado));
  }, [lancamentos, mesSelecionado]);

  // 1. Receitas de Jogadores no Mês (Quitado)
  const pagamentosDoMes = useMemo(() => {
    return pagamentos.filter(p => p.mesRef === mesSelecionado && p.status === 'pago');
  }, [pagamentos, mesSelecionado]);

  // JOGADORES PAGANTES DO MÊS DETALHADO
  const pagantesDetalhado = useMemo(() => {
    return pagamentosDoMes
      .map(p => {
        const jogador = jogadores.find(j => j.id === p.jogadorId);
        return {
          pagamento: p,
          jogador: jogador
        };
      })
      .filter((item): item is { pagamento: Pagamento; decorator: any; jogador: Jogador } => item.jogador !== undefined);
  }, [pagamentosDoMes, jogadores]);

  // JOGADORES COM PAGAMENTO PENDENTE DE CONFIRMAÇÃO DO ADMINISTRADOR
  const pagantesPendentesDetalhado = useMemo(() => {
    return pagamentos
      .filter(p => p.status === 'pendente_confirmacao')
      .map(p => {
        const jogador = jogadores.find(j => j.id === p.jogadorId);
        return {
          pagamento: p,
          jogador: jogador
        };
      })
      .filter((item): item is { pagamento: Pagamento; jogador: Jogador } => item.jogador !== undefined);
  }, [pagamentos, jogadores]);

  // CÁLCULO DE TODOS OS DÉBITOS PENDENTES DO ELENCO PARA EXIBIÇÃO NO CONTROLE DE CAIXA
  const todosDebitosPendentes = useMemo(() => {
    const list: {
      id: string;
      jogadorId: string;
      jogadorNome: string;
      jogadorSobrenome: string;
      jogadorMembroStatus: string;
      jogadorPosicao: string;
      jogadorFoto?: string;
      tipo: 'mensalidade' | 'diaria';
      referencia: string;
      dataOrigem: string;
      mesRef: string;
      valor: number;
      status: 'pendente' | 'pendente_confirmacao' | 'pago';
      partidaId?: string;
      pagamentoId?: string;
    }[] = [];

    for (const jogador of jogadores) {
      if (jogador.posicao === 'Goleiro') continue;
      
      const debits = obterDebitosDoJogador(
        jogador.id,
        jogador.membroStatus,
        jogador.posicao,
        partidas,
        pagamentos,
        valorDiaria,
        valor4Sabados,
        valor5Sabados,
        jogador.createdAt
      );

      for (const deb of debits) {
        list.push({
          id: deb.id,
          jogadorId: jogador.id,
          jogadorNome: jogador.nome,
          jogadorSobrenome: jogador.sobrenome,
          jogadorMembroStatus: jogador.membroStatus,
          jogadorPosicao: jogador.posicao,
          jogadorFoto: jogador.foto,
          tipo: deb.tipo,
          referencia: deb.referencia,
          dataOrigem: deb.dataOrigem,
          mesRef: deb.mesRef,
          valor: deb.valor,
          status: deb.status,
          partidaId: deb.partidaId,
          pagamentoId: deb.pagamentoId
        });
      }
    }

    return list;
  }, [jogadores, partidas, pagamentos, valorDiaria, valor4Sabados, valor5Sabados]);

  // Separar receita de mensalistas e diaristas do Mês
  const receitaMensalistas = useMemo(() => {
    return pagamentosDoMes
      .filter(p => {
        const j = jogadores.find(j => j.id === p.jogadorId);
        return j && j.membroStatus === 'mensalista';
      })
      .reduce((sum, p) => sum + p.valor, 0);
  }, [pagamentosDoMes, jogadores]);

  const receitaDiaristas = useMemo(() => {
    return pagamentosDoMes
      .filter(p => {
        const j = jogadores.find(j => j.id === p.jogadorId);
        return j && j.membroStatus === 'diarista';
      })
      .reduce((sum, p) => sum + p.valor, 0);
  }, [pagamentosDoMes, jogadores]);

  // Receitas Avulsas do Mês
  const receitaAvulsaTotal = useMemo(() => {
    return lancamentosDoMes
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0);
  }, [lancamentosDoMes]);

  // Total Geral de Receita do Mês
  const receitaTotalGeral = receitaMensalistas + receitaDiaristas + receitaAvulsaTotal;

  // 2. Despesas Automáticas do Mês
  const despesaAluguelAutomatico = useMemo(() => {
    return partidasDoMes.length * getAluguelDoMes(mesSelecionado);
  }, [partidasDoMes, mesSelecionado, aluguelCampoBase]);

  // Despesas Avulsas do Mês
  const despesaAvulsaTotal = useMemo(() => {
    return lancamentosDoMes
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0);
  }, [lancamentosDoMes]);

  // Despesa total do mês
  const despesaTotalGeral = despesaAluguelAutomatico + despesaAvulsaTotal;

  // Saldo Líquido do Mês
  const saldoLiquidoMês = receitaTotalGeral - despesaTotalGeral;


  const startupMonth = useMemo(() => {
    return localStorage.getItem('futebol_startup_month') || '2026-06';
  }, []);

  // Retorna o mês atual no formato "YYYY-MM"
  const obterMesAtual = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  };

  // --- CÁLCULO ANUAL CONSOLIDADO ATÉ O MOMENTO (BREAKDOWN MENSAL) ---
  const consolidadoMensalDoAno = useMemo(() => {
    const meses = [
      { id: '01', nome: 'Janeiro' },
      { id: '02', nome: 'Fevereiro' },
      { id: '03', nome: 'Março' },
      { id: '04', nome: 'Abril' },
      { id: '05', nome: 'Maio' },
      { id: '06', nome: 'Junho' },
      { id: '07', nome: 'Julho' },
      { id: '08', nome: 'Agosto' },
      { id: '09', nome: 'Setembro' },
      { id: '10', nome: 'Outubro' },
      { id: '11', nome: 'Novembro' },
      { id: '12', nome: 'Dezembro' }
    ];

    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const anoSelInt = parseInt(anoSelecionado) || 2026;
    const mesLimit = obterMesAtual();

    const mesesExibidos = meses.filter(m => {
      const mesIdInt = parseInt(m.id);
      const mesRef = `${anoSelecionado}-${m.id}`;
      // Nao mostrar meses passados que foram resetados (antes de startupMonth) ou meses futuros
      if (mesRef < startupMonth || mesRef > mesLimit) {
        return false;
      }
      if (anoSelInt < anoAtual) {
        return true; // past year
      } else if (anoSelInt === anoAtual) {
        return mesIdInt <= mesAtual; // current year: up to current month (YTD)
      } else {
        return false; // future year
      }
    });

    return mesesExibidos.map(m => {
      const mesRef = `${anoSelecionado}-${m.id}`;
      
      const partidasM = partidas.filter(p => !p.cancelada && p.data && p.data.startsWith(mesRef));
      const pagamentosM = pagamentos.filter(p => p.mesRef === mesRef && p.status === 'pago');
      
      const recMensalistasM = pagamentosM
        .filter(p => {
          const j = jogadores.find(jg => jg.id === p.jogadorId);
          return j && j.membroStatus === 'mensalista';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const recDiaristasM = pagamentosM
        .filter(p => {
          const j = jogadores.find(jg => jg.id === p.jogadorId);
          return j && j.membroStatus === 'diarista';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const recAvulsaM = lancamentos
        .filter(l => l.tipo === 'receita' && l.data && l.data.startsWith(mesRef))
        .reduce((sum, l) => sum + l.valor, 0);

      const receitaTotalM = recMensalistasM + recDiaristasM + recAvulsaM;

      const despesaAluguelM = partidasM.length * getAluguelDoMes(mesRef);
      const despesaAvulsaM = lancamentos
        .filter(l => l.tipo === 'despesa' && l.data && l.data.startsWith(mesRef))
        .reduce((sum, l) => sum + l.valor, 0);

      const despesaTotalM = despesaAluguelM + despesaAvulsaM;

      return {
        ...m,
        mesRef,
        partidasCount: partidasM.length,
        receitaTotal: receitaTotalM,
        receitaMensalistas: recMensalistasM,
        receitaDiaristas: recDiaristasM,
        receitaAvulsa: recAvulsaM,
        despesaTotal: despesaTotalM,
        despesaAluguel: despesaAluguelM,
        despesaAvulsa: despesaAvulsaM,
        saldo: receitaTotalM - despesaTotalM
      };
    });
  }, [partidas, pagamentos, lancamentos, jogadores, aluguelCampoBase, anoSelecionado, startupMonth]);

  // Agregar totais anais com base no demonstrativo consolidado mensal
  const receitaTotalAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.receitaTotal, 0);
  }, [consolidadoMensalDoAno]);

  const receitaMensalistasAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.receitaMensalistas, 0);
  }, [consolidadoMensalDoAno]);

  const receitaDiaristasAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.receitaDiaristas, 0);
  }, [consolidadoMensalDoAno]);

  const receitaAvulsaAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.receitaAvulsa, 0);
  }, [consolidadoMensalDoAno]);

  const despesaTotalAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.despesaTotal, 0);
  }, [consolidadoMensalDoAno]);

  const despesaAluguelAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.despesaAluguel, 0);
  }, [consolidadoMensalDoAno]);

  const despesaAvulsaAno = useMemo(() => {
    return consolidadoMensalDoAno.reduce((sum, m) => sum + m.despesaAvulsa, 0);
  }, [consolidadoMensalDoAno]);

  const saldoLiquidoAno = receitaTotalAno - despesaTotalAno;


  // --- CÁLCULOS CONSOLIDADOS (HISTÓRICO TOTAL) ---
  const receitaMensalistasConsolidado = useMemo(() => {
    const mesLimit = obterMesAtual();
    return pagamentos
      .filter(p => p.status === 'pago' && p.mesRef >= startupMonth && p.mesRef <= mesLimit)
      .filter(p => {
        const j = jogadores.find(jg => jg.id === p.jogadorId);
        return j && j.membroStatus === 'mensalista';
      })
      .reduce((sum, p) => sum + p.valor, 0);
  }, [pagamentos, jogadores, startupMonth]);

  const receitaDiaristasConsolidado = useMemo(() => {
    const mesLimit = obterMesAtual();
    return pagamentos
      .filter(p => p.status === 'pago' && p.mesRef >= startupMonth && p.mesRef <= mesLimit)
      .filter(p => {
        const j = jogadores.find(jg => jg.id === p.jogadorId);
        return j && j.membroStatus === 'diarista';
      })
      .reduce((sum, p) => sum + p.valor, 0);
  }, [pagamentos, jogadores, startupMonth]);

  const receitaAvulsaConsolidado = useMemo(() => {
    const mesLimit = obterMesAtual();
    return lancamentos
      .filter(l => l.tipo === 'receita' && l.data && l.data.substring(0, 7) >= startupMonth && l.data.substring(0, 7) <= mesLimit)
      .reduce((sum, l) => sum + l.valor, 0);
  }, [lancamentos, startupMonth]);

  const receitaTotalConsolidado = receitaMensalistasConsolidado + receitaDiaristasConsolidado + receitaAvulsaConsolidado;

  const despesaAluguelConsolidado = useMemo(() => {
    const mesLimit = obterMesAtual();
    return partidas
      .filter(p => !p.cancelada && p.data && p.data.substring(0, 7) >= startupMonth && p.data.substring(0, 7) <= mesLimit)
      .reduce((sum, p) => sum + getAluguelDoMes(p.data.substring(0, 7)), 0);
  }, [partidas, aluguelCampoBase, startupMonth]);

  const despesaAvulsaConsolidado = useMemo(() => {
    const mesLimit = obterMesAtual();
    return lancamentos
      .filter(l => l.tipo === 'despesa' && l.data && l.data.substring(0, 7) >= startupMonth && l.data.substring(0, 7) <= mesLimit)
      .reduce((sum, l) => sum + l.valor, 0);
  }, [lancamentos, startupMonth]);

  const despesaTotalConsolidado = despesaAluguelConsolidado + despesaAvulsaConsolidado;
  const saldoLiquidoConsolidado = receitaTotalConsolidado - despesaTotalConsolidado;

  const mesesDisponiveis = useMemo(() => {
    const mesLimit = obterMesAtual(); // ex: '2026-06'
    const mesSet = new Set<string>();
    
    // So adicionar mesLimit se for >= startupMonth
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

    lancamentos.forEach(l => {
      if (l.data && l.data.length >= 7) {
        const m = l.data.substring(0, 7);
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

    // Ordenar os meses cronologicamente para montar a sequência a partir do primeiro registro
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
      return sequencia;
    }
    const fallbackSeq = [];
    const [minY, minM] = startupMonth.split('-').map(Number);
    const [maxY, maxM] = (mesLimit >= startupMonth ? mesLimit : startupMonth).split('-').map(Number);
    let curY = minY;
    let curM = minM;
    while (curY < maxY || (curY === maxY && curM <= maxM)) {
      const mesStr = `${curY}-${String(curM).padStart(2, '0')}`;
      fallbackSeq.push(mesStr);
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return fallbackSeq;
  }, [partidas, lancamentos, pagamentos, startupMonth]);

  const consolidadoMensalHistorico = useMemo(() => {
    // Ordem cronológica decrescente dos meses disponíveis para exibição histórica útil
    const mesesSorted = [...mesesDisponiveis].reverse();
    
    const nomesMesesIndex: Record<string, string> = {
      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
    };

    return mesesSorted.map(mesRef => {
      const [ano, mesId] = mesRef.split('-');
      const nomeMes = nomesMesesIndex[mesId] || mesId;
      const nomeCompleto = `${nomeMes} de ${ano}`;
      
      const partidasM = partidas.filter(p => !p.cancelada && p.data.startsWith(mesRef));
      const pagamentosM = pagamentos.filter(p => p.mesRef === mesRef && p.status === 'pago');
      
      const recMensalistasM = pagamentosM
        .filter(p => {
          const j = jogadores.find(jg => jg.id === p.jogadorId);
          return j && j.membroStatus === 'mensalista';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const recDiaristasM = pagamentosM
        .filter(p => {
          const j = jogadores.find(jg => jg.id === p.jogadorId);
          return j && j.membroStatus === 'diarista';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const recAvulsaM = lancamentos
        .filter(l => l.tipo === 'receita' && l.data.startsWith(mesRef))
        .reduce((sum, l) => sum + l.valor, 0);

      const receitaTotalM = recMensalistasM + recDiaristasM + recAvulsaM;

      const despesaAluguelM = partidasM.length * getAluguelDoMes(mesRef);
      const despesaAvulsaM = lancamentos
        .filter(l => l.tipo === 'despesa' && l.data.startsWith(mesRef))
        .reduce((sum, l) => sum + l.valor, 0);

      const despesaTotalM = despesaAluguelM + despesaAvulsaM;

      return {
        id: mesRef,
        mesRef,
        nome: nomeCompleto,
        partidasCount: partidasM.length,
        receitaTotal: receitaTotalM,
        receitaMensalistas: recMensalistasM,
        receitaDiaristas: recDiaristasM,
        receitaAvulsa: recAvulsaM,
        despesaTotal: despesaTotalM,
        despesaAluguel: despesaAluguelM,
        despesaAvulsa: despesaAvulsaM,
        saldo: receitaTotalM - despesaTotalM
      };
    });
  }, [mesesDisponiveis, partidas, pagamentos, lancamentos, jogadores, aluguelCampoBase]);


  // --- ADAPTABILIDADES DO ESCOPO ---
  const partidasDoAno = useMemo(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const anoSelInt = parseInt(anoSelecionado) || 2026;

    return partidas.filter(p => {
      if (p.cancelada) return false;
      if (!p.data.startsWith(anoSelecionado)) return false;

      const mesPartidaStr = p.data.substring(0, 7);
      if (mesPartidaStr < startupMonth) return false;

      const mesPartida = parseInt(p.data.substring(5, 7));
      if (anoSelInt < anoAtual) {
        return true;
      } else if (anoSelInt === anoAtual) {
        return mesPartida <= mesAtual;
      } else {
        return false;
      }
    });
  }, [partidas, anoSelecionado, startupMonth]);

  // Seletor de partidas dinâmico por escopo
  const partidasEscopo = useMemo(() => {
    if (visaoEscopo === 'mensal') {
      return partidasDoMes;
    } else {
      return partidasDoAno;
    }
  }, [visaoEscopo, partidasDoMes, partidasDoAno]);

  // Seção 1: Jogo Selecionado (padrão é o primeiro jogo ativo do escopo)
  const partidaAtivaId = partidaSelecionadaId || (partidasEscopo[0]?.id) || '';
  const partidaAtiva = useMemo(() => {
    return partidas.find(p => p.id === partidaAtivaId);
  }, [partidas, partidaAtivaId]);

  // Contagem de sábados dinâmico para a partida selecionada
  const numSabadosPartida = useMemo(() => {
    if (!partidaAtiva) return 4;
    const mesPartida = partidaAtiva.data.substring(0, 7);
    const [ano, mesNum] = mesPartida.split('-').map(Number);
    const data = new Date(ano, mesNum - 1, 1);
    let count = 0;
    while (data.getMonth() === mesNum - 1) {
      if (data.getDay() === 6) {
        count++;
      }
      data.setDate(data.getDate() + 1);
    }
    return count;
  }, [partidaAtiva]);

  // Filtragem dinâmica de lançamentos avulsos por escopo
  const lancamentosEscopo = useMemo(() => {
    if (visaoEscopo === 'mensal') {
      return lancamentosDoMes;
    } else {
      const hoje = new Date();
      const anoAtual = hoje.getFullYear();
      const mesAtual = hoje.getMonth() + 1;
      const anoSelInt = parseInt(anoSelecionado) || 2026;

      return lancamentos.filter(l => {
        if (!l.data.startsWith(anoSelecionado)) return false;

        const mesLancamento = parseInt(l.data.substring(5, 7));
        if (anoSelInt < anoAtual) {
          return true;
        } else if (anoSelInt === anoAtual) {
          return mesLancamento <= mesAtual;
        } else {
          return false;
        }
      });
    }
  }, [lancamentos, lancamentosDoMes, visaoEscopo, anoSelecionado]);

  // Sub-área 1: Análise de Caixa do Jogo Específico Selecionado
  const analiseJogoDetalhes = useMemo(() => {
    if (!partidaAtiva) return null;

    const mesPartida = partidaAtiva.data.substring(0, 7);

    // Obter todos confirmados desta partida
    const confirmadosAtletas = partidaAtiva.confirmados
      .map(id => jogadores.find(j => j.id === id))
      .filter(Boolean) as Jogador[];

    // Separar
    const mensalistasConfirmados = confirmadosAtletas.filter(j => j.membroStatus === 'mensalista');
    const diaristasConfirmados = confirmadosAtletas.filter(j => j.membroStatus === 'diarista');

    // Goleiros são gratuitos e não pagam
    const goleirosConfirmadosCount = confirmadosAtletas.filter(j => j.posicao === 'Goleiro').length;

    // Calcular receita gerada ou arrecadada no jogo:
    const receitaEstProjDiaristas = diaristasConfirmados.reduce((sum, d) => {
      const pag = pagamentos.find(p => p.jogadorId === d.id && p.mesRef === mesPartida && p.status === 'pago');
      return sum + (pag ? pag.valor : 0);
    }, 0);

    const receitaEstProjMensalistasFraction = mensalistasConfirmados.reduce((sum, m) => {
      const pag = pagamentos.find(p => p.jogadorId === m.id && p.mesRef === mesPartida && p.status === 'pago');
      if (pag) {
        return sum + (pag.valor / (numSabadosPartida || 4));
      }
      return sum;
    }, 0);

    const receitaJogoTotal = receitaEstProjDiaristas + receitaEstProjMensalistasFraction;
    const despesaAluguelJogo = getAluguelDoMes(mesPartida);

    // Encontrar despesas avulsas atribuídas a esse jogo (ex: se na descrição houver o ID do jogo ou data)
    const despesasAdicionaisJogo = lancamentos
      .filter(l => l.tipo === 'despesa' && l.data.startsWith(mesPartida) && (l.descricao.includes(partidaAtiva.data) || l.descricao.includes(partidaAtiva.titulo)))
      .reduce((sum, l) => sum + l.valor, 0);

    return {
      totalConfirmados: confirmadosAtletas.length,
      mensalistas: mensalistasConfirmados.length,
      diaristas: diaristasConfirmados.length,
      goleiros: goleirosConfirmadosCount,
      receitaEstimada: receitaJogoTotal,
      despesaAluguel: despesaAluguelJogo,
      despesaAdicionais: despesasAdicionaisJogo,
      despesaTotal: despesaAluguelJogo + despesasAdicionaisJogo,
      saldoJogo: receitaJogoTotal - (despesaAluguelJogo + despesasAdicionaisJogo),
      listaAtletas: confirmadosAtletas
    };
  }, [partidaAtiva, jogadores, pagamentos, numSabadosPartida, aluguelCampoBase, lancamentos]);

  // --- CÁLCULO E DETALHES DO POPUP DO MÊS ---
  const ativosM = useMemo(() => {
    if (!detalhesMesModal) return [];
    const setAtivos = new Set<string>();
    const list: Jogador[] = [];

    // 1. Mensalistas ativos (Goleiros não pagam mensalidade mas participam)
    jogadores.forEach(j => {
      if (j.membroStatus === 'mensalista' && j.posicao !== 'Goleiro') {
        if (!setAtivos.has(j.id)) {
          setAtivos.add(j.id);
          list.push(j);
        }
      }
    });

    // 2. Pagamentos efetuados ou aguardando confirmação
    pagamentos.forEach(p => {
      if (p.mesRef === detalhesMesModal && (p.status === 'pago' || p.status === 'pendente_confirmacao')) {
        const j = jogadores.find(jg => jg.id === p.jogadorId);
        if (j && !setAtivos.has(j.id)) {
          setAtivos.add(j.id);
          list.push(j);
        }
      }
    });

    // 3. Confirmados em partidas deste mês
    partidas.forEach(p => {
      if (!p.cancelada && p.data.startsWith(detalhesMesModal)) {
        p.confirmados.forEach(cId => {
          const j = jogadores.find(jg => jg.id === cId);
          if (j && !setAtivos.has(j.id)) {
            setAtivos.add(j.id);
            list.push(j);
          }
        });
      }
    });

    return list.sort((a, b) => a.nome.localeCompare(b.nome));
  }, [detalhesMesModal, jogadores, pagamentos, partidas]);

  const statsModal = useMemo(() => {
    if (!detalhesMesModal) return null;

    const [ano, mes] = detalhesMesModal.split('-');
    const mesesNomes = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const nomeMesExtenso = `${mesesNomes[parseInt(mes) - 1]} de ${ano}`;

    const partidasM = partidas.filter(p => !p.cancelada && p.data.startsWith(detalhesMesModal));
    const lancamentosM = lancamentos.filter(l => l.data.startsWith(detalhesMesModal));
    
    const pagamentosM = pagamentos.filter(p => p.mesRef === detalhesMesModal && p.status === 'pago');
    
    const recMensalistas = pagamentosM
      .filter(p => {
        const j = jogadores.find(jg => jg.id === p.jogadorId);
        return j && j.membroStatus === 'mensalista';
      })
      .reduce((sum, p) => sum + p.valor, 0);

    const recDiaristas = pagamentosM
      .filter(p => {
        const j = jogadores.find(jg => jg.id === p.jogadorId);
        return j && j.membroStatus === 'diarista';
      })
      .reduce((sum, p) => sum + p.valor, 0);

    const recAvulsa = lancamentosM
      .filter(l => l.tipo === 'receita')
      .reduce((sum, l) => sum + l.valor, 0);

    const receitaTotal = recMensalistas + recDiaristas + recAvulsa;

    const despesaAluguel = partidasM.length * getAluguelDoMes(detalhesMesModal);
    const despesaAvulsa = lancamentosM
      .filter(l => l.tipo === 'despesa')
      .reduce((sum, l) => sum + l.valor, 0);

    const despesaTotal = despesaAluguel + despesaAvulsa;

    const debitosM = todosDebitosPendentes.filter(d => d.mesRef === detalhesMesModal);
    const totalDebitos = debitosM.reduce((sum, d) => sum + d.valor, 0);

    const pagantesM = pagamentosM
      .map(p => {
        const j = jogadores.find(jg => jg.id === p.jogadorId);
        return { pagamento: p, jogador: j };
      })
      .filter((item): item is { pagamento: Pagamento; jogador: Jogador } => item.jogador !== undefined)
      .sort((a,b) => a.jogador.nome.localeCompare(b.jogador.nome));

    return {
      nomeMesExtenso,
      partidasCount: partidasM.length,
      receitaTotal,
      recMensalistas,
      recDiaristas,
      recAvulsa,
      despesaTotal,
      despesaAluguel,
      despesaAvulsa,
      saldo: receitaTotal - despesaTotal,
      debitosM,
      totalDebitos,
      pagantesM,
      ativosCount: ativosM.length,
      pagantesCount: pagantesM.length,
    };
  }, [detalhesMesModal, partidas, lancamentos, pagamentos, jogadores, aluguelCampoBase, todosDebitosPendentes, ativosM]);

  const handleSalvarLancamentoAvulso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!avulsoDescricao.trim() || avulsoValor <= 0) return;

    if (editingLancamentoId && onUpdateLancamento) {
      onUpdateLancamento({
        id: editingLancamentoId,
        tipo: avulsoTipo,
        descricao: avulsoDescricao,
        valor: avulsoValor,
        data: avulsoData,
        categoria: avulsoCategoria,
        partidaId: avulsoPartidaId || undefined
      });
    } else {
      onAddLancamento({
        tipo: avulsoTipo,
        descricao: avulsoDescricao,
        valor: avulsoValor,
        data: avulsoData,
        categoria: avulsoCategoria,
        partidaId: avulsoPartidaId || undefined
      });
    }

    // Reset formulário
    setAvulsoDescricao('');
    setAvulsoValor(0);
    setAvulsoPartidaId('');
    setEditingLancamentoId('');
    setShowFormAvulso(false);
  };

  const handleSalvarAluguel = () => {
    onUpdateAluguelCampoBase(tempAluguel);
    setIsEditingAluguel(false);
  };

  const receitaVisualizar = visaoEscopo === 'mensal' 
    ? receitaTotalGeral 
    : visaoEscopo === 'anual' 
    ? receitaTotalAno 
    : receitaTotalConsolidado;

  const receitaMensalistasVisualizar = visaoEscopo === 'mensal' 
    ? receitaMensalistas 
    : visaoEscopo === 'anual' 
    ? receitaMensalistasAno 
    : receitaMensalistasConsolidado;

  const receitaDiaristasVisualizar = visaoEscopo === 'mensal' 
    ? receitaDiaristas 
    : visaoEscopo === 'anual' 
    ? receitaDiaristasAno 
    : receitaDiaristasConsolidado;

  const receitaAvulsaVisualizar = visaoEscopo === 'mensal' 
    ? receitaAvulsaTotal 
    : visaoEscopo === 'anual' 
    ? receitaAvulsaAno 
    : receitaAvulsaConsolidado;

  const despesaVisualizar = visaoEscopo === 'mensal' 
    ? despesaTotalGeral 
    : visaoEscopo === 'anual' 
    ? despesaTotalAno 
    : despesaTotalConsolidado;

  const despesaAluguelVisualizar = visaoEscopo === 'mensal' 
    ? despesaAluguelAutomatico 
    : visaoEscopo === 'anual' 
    ? despesaAluguelAno 
    : despesaAluguelConsolidado;

  const despesaAvulsaVisualizar = visaoEscopo === 'mensal' 
    ? despesaAvulsaTotal 
    : visaoEscopo === 'anual' 
    ? despesaAvulsaAno 
    : despesaAvulsaConsolidado;

  const partidasCountVisualizar = visaoEscopo === 'mensal' 
    ? partidasDoMes.length 
    : visaoEscopo === 'anual' 
    ? partidasDoAno.length 
    : partidas.filter(p => !p.cancelada).length;

  const saldoLiquidoVisualizar = visaoEscopo === 'mensal' 
    ? saldoLiquidoMês 
    : visaoEscopo === 'anual' 
    ? saldoLiquidoAno 
    : saldoLiquidoConsolidado;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* CABEÇALHO */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-emerald-955/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div className="text-left space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono tracking-wider font-extrabold text-teal-400 bg-teal-500/15 border border-teal-550/20 px-2.5 py-0.5 rounded-full uppercase">
              Módulo Admin
            </span>
          </div>
          <h2 id="titulo-caixa" className="font-display font-black text-lg text-white flex items-center gap-2 uppercase tracking-wider">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            Controle Financeiro Geral
          </h2>
          <p className="text-[11px] text-emerald-300/80 font-sans tracking-wide">
            Gestão financeira consolidada do caixa, faturamento mensal, rateios proporcionais e caixa anual.
          </p>
        </div>

        {/* CONTROLES DE ESCOPO E FILTROS */}
        <div className="flex flex-row flex-wrap items-center gap-3 md:justify-end shrink-0 w-full md:w-auto">
          {/* Seletor de Escopo (Pill Switch) */}
          <div className="bg-black/45 p-1 border border-white/10 rounded-xl flex items-center shrink-0">
            <button
              id="switch-scope-mensal"
              type="button"
              onClick={() => {
                setVisaoEscopo('mensal');
                setPartidaSelecionadaId('');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center shrink-0 ${
                visaoEscopo === 'mensal'
                  ? 'bg-teal-500 text-emerald-950 shadow-md font-extrabold'
                  : 'text-emerald-300 hover:text-white font-medium'
              }`}
            >
              Ciclo Mensal
            </button>
            <button
              id="switch-scope-anual"
              type="button"
              onClick={() => {
                setVisaoEscopo('anual');
                setPartidaSelecionadaId('');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center shrink-0 ${
                visaoEscopo === 'anual'
                  ? 'bg-teal-500 text-emerald-950 shadow-md font-extrabold'
                  : 'text-emerald-300 hover:text-white font-medium'
              }`}
            >
              Consolidado Anual
            </button>
            <button
              id="switch-scope-consolidado"
              type="button"
              onClick={() => {
                setVisaoEscopo('consolidado');
                setPartidaSelecionadaId('');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer text-center shrink-0 ${
                visaoEscopo === 'consolidado'
                  ? 'bg-teal-500 text-emerald-950 shadow-md font-extrabold'
                  : 'text-emerald-300 hover:text-white font-medium'
              }`}
            >
              Consolidado Total
            </button>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {visaoEscopo === 'mensal' ? (
              <div className="flex items-center gap-2 shrink-0">
                <label htmlFor="caixa-mes-seletor" className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider font-sans shrink-0">
                  Mês:
                </label>
                <select
                  id="caixa-mes-seletor"
                  value={mesSelecionado}
                  onChange={(e) => {
                    setMesSelecionado(e.target.value);
                    setPartidaSelecionadaId(''); // reset partida ativa
                  }}
                  className="bg-black/45 border border-white/10 text-white text-xs font-bold font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-teal-555 cursor-pointer shadow-inner shrink-0"
                >
                  {[...mesesDisponiveis].reverse().map(m => {
                    const nomesMesesIndex: Record<string, string> = {
                      '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
                      '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
                      '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
                    };
                    const [ano, mesId] = m.split('-');
                    const label = `${nomesMesesIndex[mesId] || mesId} / ${ano}`;
                    return (
                      <option className="bg-emerald-955 text-white animate-fade-in" key={m} value={m}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            ) : visaoEscopo === 'anual' ? (
              <span className="bg-black/45 border border-white/10 text-teal-400 text-xs font-mono font-bold rounded-lg px-3.5 py-2 shadow-inner shrink-0">
                Ano {anoSelecionado}
              </span>
            ) : (
              <span className="bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-mono font-bold rounded-lg px-3.5 py-2 shadow-inner shrink-0">
                Todo o Histórico
              </span>
            )}
          </div>
        </div>
      </div>

      {/* DASHBOARDS - BIG NUMBERS DE COLETIVO FINANCEIRO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Receita TOTAL */}
        <div className="bg-emerald-900/30 border border-white/10 p-5 rounded-2xl relative overflow-hidden text-left shadow-md">
          <p className="text-[9px] text-emerald-300 uppercase font-bold tracking-wider leading-none">
            {visaoEscopo === 'mensal' ? 'Receitas do Mês' : visaoEscopo === 'anual' ? `Receitas do Ano (${anoSelecionado})` : 'Faturamento Histórico'}
          </p>
          <h4 className="text-2xl font-mono font-bold text-white mt-2">
            R$ {receitaVisualizar.toFixed(2)}
          </h4>
          <div className="space-y-1 mt-3.5 text-[10px] text-emerald-300/80 border-t border-white/5 pt-2.5">
            <div className="flex justify-between">
              <span>Mensalistas:</span>
              <strong className="text-white">
                R$ {receitaMensalistasVisualizar.toFixed(2)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Diaristas:</span>
              <strong className="text-white">
                R$ {receitaDiaristasVisualizar.toFixed(2)}
              </strong>
            </div>
            {(receitaAvulsaVisualizar > 0) && (
              <div className="flex justify-between text-teal-400 font-bold">
                <span>Avulsos:</span>
                <strong>
                  R$ {receitaAvulsaVisualizar.toFixed(2)}
                </strong>
              </div>
            )}
          </div>
          <div className="absolute right-3 top-3 w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        {/* Despesas Gerais */}
        <div className="bg-emerald-900/30 border border-white/10 p-5 rounded-2xl relative overflow-hidden text-left shadow-md">
          <p className="text-[9px] text-emerald-300 uppercase font-bold tracking-wider leading-none">
            {visaoEscopo === 'mensal' ? 'Despesas do Mês' : visaoEscopo === 'anual' ? `Despesas do Ano (${anoSelecionado})` : 'Custos Históricos'}
          </p>
          <h4 className="text-2xl font-mono font-bold text-rose-300 mt-2">
            R$ {despesaVisualizar.toFixed(2)}
          </h4>
          <div className="space-y-1 mt-3.5 text-[10px] text-rose-300/80 border-t border-white/5 pt-2.5">
            <div className="flex justify-between">
              <span>Aluguel ({partidasCountVisualizar} {partidasCountVisualizar === 1 ? 'jogo' : 'jogos'}):</span>
              <strong className="text-white">
                R$ {despesaAluguelVisualizar.toFixed(2)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Goleiro / Avulsas:</span>
              <strong className="text-white">
                R$ {despesaAvulsaVisualizar.toFixed(2)}
              </strong>
            </div>
          </div>
          <div className="absolute right-3 top-3 w-8 h-8 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>

        {/* Saldo Líquido */}
        <div className="bg-emerald-900/30 border border-white/10 p-5 rounded-2xl relative overflow-hidden text-left shadow-md">
          <p className="text-[9px] text-emerald-300 uppercase font-bold tracking-wider leading-none">
            {visaoEscopo === 'mensal' ? 'Saldo Líquido' : visaoEscopo === 'anual' ? `Saldo Líquido Ano (${anoSelecionado})` : 'Lucro Consolidado'}
          </p>
          {(() => {
            const val = saldoLiquidoVisualizar;
            return (
              <>
                <h4 className={`text-2xl font-mono font-bold mt-2 ${val >= 0 ? 'text-teal-400' : 'text-rose-400'}`}>
                  R$ {val.toFixed(2)}
                </h4>
                <p className="text-[10px] text-emerald-300 mt-3.5 border-t border-white/5 pt-2.5 flex items-center gap-1 font-sans">
                  Status do período: 
                  <strong className={`${val >= 0 ? 'text-teal-300 bg-teal-500/10' : 'text-rose-400 bg-rose-500/10'} px-2 py-0.5 rounded text-[9px] uppercase tracking-wider`}>
                    {val >= 0 ? 'Superávit' : 'Déficit'}
                  </strong>
                </p>
              </>
            );
          })()}
          <div className="absolute right-3 top-3 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/50">
            <DollarSign className="w-4 h-4" />
          </div>
        </div>

        {/* Custo de Aluguel de Campo e Ajuste */}
        <div className="bg-gradient-to-br from-emerald-950 to-emerald-900/50 border border-white/10 p-5 rounded-2xl relative overflow-hidden text-left shadow-md">
          <p className="text-[9px] text-teal-400 uppercase font-bold tracking-wider leading-none flex items-center gap-1">
            <Settings className="w-3 h-3 text-teal-400 animate-spin-slow" /> Aluguel Configurado
          </p>
          
          {isEditingAluguel ? (
            <div className="mt-2 space-y-2">
              <input 
                type="number"
                value={tempAluguel}
                onChange={(e) => setTempAluguel(Number(e.target.value))}
                className="w-full bg-emerald-955 border border-white/20 text-white font-mono font-bold text-sm rounded px-2.5 py-1 focus:outline-none"
              />
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handleSalvarAluguel}
                  className="bg-teal-500 text-bg text-[9px] px-2 py-1 font-sans font-black uppercase rounded block"
                  style={{ color: '#022c22' }}
                >
                  Salvar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTempAluguel(aluguelCampoBase);
                    setIsEditingAluguel(false);
                  }}
                  className="bg-white/10 text-white text-[9px] px-2 py-1 font-sans font-bold uppercase rounded block"
                >
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <>
              <h4 className="text-2xl font-mono font-bold text-white mt-1.5">R$ {aluguelCampoBase.toFixed(2)}</h4>
              <p className="text-[9px] text-emerald-300 mt-1 leading-normal font-sans">
                {visaoEscopo === 'mensal'
                  ? `Taxa de aluguel por jogo agendado. Incide débito automático de R$ ${aluguelCampoBase.toFixed(2)} a cada partida.`
                  : visaoEscopo === 'anual'
                  ? `Custo total de aluguel do campo acumulado este ano: R$ ${despesaAluguelAno.toFixed(2)}.`
                  : `Custo acumulado histórico de aluguel pago: R$ ${despesaAluguelConsolidado.toFixed(2)}.`}
              </p>
              <button
                type="button"
                onClick={() => setIsEditingAluguel(true)}
                className="mt-2 text-[9px] font-black uppercase tracking-wider text-teal-300 bg-white/5 border border-white/10 hover:border-teal-500/40 px-2 py-1 rounded inline-flex items-center gap-1 cursor-pointer"
              >
                <Sliders className="w-2.5 h-2.5" /> Reajustar Aluguel
              </button>
            </>
          )}
        </div>

      </div>

      {/* DEMONSTRATIVO MENSAL CONSOLIDADO (EXIBIDO EM VISÃO ANUAL OU CONSOLIDADO TOTAL) */}
      {(visaoEscopo === 'anual' || visaoEscopo === 'consolidado') && (
        <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left animate-fade-in text-white">
          <div className="border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide">
              <Calendar className="w-5 h-5 text-teal-400" />
              {visaoEscopo === 'anual' 
                ? `Demonstrativo Mensal Consolidado - Ano ${anoSelecionado}` 
                : 'Demonstrativo Mensal Histórico Consolidado (Tudo)'}
            </h3>
            <p className="text-xs text-emerald-300/80 font-sans mt-0.5">
              {visaoEscopo === 'anual'
                ? 'Visão verticalizada de todos os meses do ano de faturamento, gasto operacional e saldo acumulado.'
                : 'Histórico consolidado completo de faturamento, custos operacionais e saldos de competência.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(visaoEscopo === 'anual' ? consolidadoMensalDoAno : consolidadoMensalHistorico)
              .filter(m => m.receitaTotal > 0 || m.despesaTotal > 0 || m.partidasCount > 0)
              .map((m) => {
                const isPos = m.saldo >= 0;
                return (
                  <div 
                    key={m.id}
                    onClick={() => setDetalhesMesModal(m.mesRef)}
                    className="bg-black/30 hover:bg-black/55 hover:border-teal-500/35 hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 p-4 rounded-xl border border-white/5 space-y-3 flex flex-col justify-between cursor-pointer group shadow hover:shadow-teal-550/10"
                    title="Clique para ver o detalhamento financeiro do mês"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="font-bold text-xs uppercase tracking-wide text-white group-hover:text-teal-300 transition-colors">{m.nome}</span>
                      <div className="flex items-center gap-1.5 shrink-0 select-none">
                        <span className="text-[10px] bg-teal-500/10 px-2 py-0.5 rounded text-teal-300 font-mono font-bold">
                          {m.partidasCount} {m.partidasCount === 1 ? 'jogo' : 'jogos'}
                        </span>
                        {jogadorAtual?.role === 'admin' && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation(); // Evitar abrir modal de detalhes ao clicar em deletar
                              if (deletarMesConfirmId === m.mesRef) {
                                if (onLimparDadosDoMes) {
                                  onLimparDadosDoMes(m.mesRef);
                                }
                                setDeletarMesConfirmId(null);
                              } else {
                                setDeletarMesConfirmId(m.mesRef);
                                setTimeout(() => setDeletarMesConfirmId(prev => prev === m.mesRef ? null : prev), 3500);
                              }
                            }}
                            className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all uppercase leading-none font-sans ${
                              deletarMesConfirmId === m.mesRef
                                ? 'bg-red-500 text-black font-black animate-pulse border border-red-400'
                                : 'text-rose-400 hover:text-rose-300 bg-rose-955/20 border border-rose-500/10 hover:bg-rose-955/40 hover:border-rose-500/30'
                            }`}
                            title="Limpar todos os registros e mensalidades deste mês"
                          >
                            {deletarMesConfirmId === m.mesRef ? 'Confirma?' : 'Deletar'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs font-mono">
                      <div className="flex justify-between text-emerald-300/90 text-[11px]">
                        <span>Receitas:</span>
                        <span className="font-bold text-white">R$ {m.receitaTotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-rose-300/90 text-[11px]">
                        <span>Despesas:</span>
                        <span className="font-bold text-white">R$ {m.despesaTotal.toFixed(2)}</span>
                      </div>
                      
                      {/* Visual Ratio Indicator */}
                      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden mt-2">
                        {m.receitaTotal + m.despesaTotal > 0 ? (
                          <div className="h-full flex">
                            <div 
                              style={{ width: `${(m.receitaTotal / (m.receitaTotal + m.despesaTotal)) * 100}%` }}
                              className="bg-teal-400 h-full"
                              title={`Receita: ${Math.round((m.receitaTotal / (m.receitaTotal + m.despesaTotal)) * 100)}%`}
                            />
                            <div 
                              style={{ width: `${(m.despesaTotal / (m.receitaTotal + m.despesaTotal)) * 100}%` }}
                              className="bg-rose-500 h-full"
                              title={`Despesa: ${Math.round((m.despesaTotal / (m.receitaTotal + m.despesaTotal)) * 100)}%`}
                            />
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t border-white/5 mt-1">
                      <span className="text-[10.5px] text-emerald-400 font-sans">Resultado Líquido:</span>
                      <span className={`font-mono font-extrabold text-xs classNameIsPos ${isPos ? 'text-teal-400' : 'text-rose-400'}`}>
                        R$ {m.saldo.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            
            {(visaoEscopo === 'anual' ? consolidadoMensalDoAno : consolidadoMensalHistorico).filter(m => m.receitaTotal > 0 || m.despesaTotal > 0 || m.partidasCount > 0).length === 0 && (
              <div className="col-span-full text-center py-8 text-emerald-500 font-sans italic text-xs">
                Nenhum registro consolidado encontrado.
              </div>
            )}
          </div>
        </div>
      )}

      {/* POPUP DE LANÇAMENTO AVULSO */}
      {showFormAvulso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in text-white font-sans">
          <div 
            className="w-full max-w-md border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden relative"
            style={{ backgroundColor: '#021a14' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
              <div className="space-y-1 text-left">
                <span className="text-[10px] font-mono tracking-wider font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full uppercase">
                  Gestão Financeira
                </span>
                <h3 className="font-display font-black text-sm text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                  {editingLancamentoId ? 'Editar Lançamento Avulso' : 'Registrar Lançamento Avulso'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowFormAvulso(false);
                  setAvulsoPartidaId('');
                  setAvulsoDescricao('');
                  setAvulsoValor(0);
                  setEditingLancamentoId('');
                }}
                className="w-8 h-8 rounded-lg bg-black/20 hover:bg-white/10 border border-white/10 flex items-center justify-center text-emerald-300 hover:text-white transition-all cursor-pointer"
                title="Fechar Lançamento"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSalvarLancamentoAvulso} className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">Tipo de Operação:</label>
                <select
                  value={avulsoTipo}
                  onChange={(e) => {
                    const val = e.target.value as 'receita' | 'despesa';
                    setAvulsoTipo(val);
                    setAvulsoCategoria(val === 'receita' ? 'outros_receita' : 'outros_despesa');
                  }}
                  className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-bold rounded-lg p-2.5 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="receita">➕ RECEITA (Entrada de Caixa)</option>
                  <option value="despesa">➖ DESPESA (Saída de Caixa)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">Associação / Vínculo:</label>
                <select
                  id="select-vinculo-partida"
                  value={avulsoPartidaId}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    setAvulsoPartidaId(selectedId);
                    if (selectedId) {
                      const pObj = partidasDoMes.find(p => p.id === selectedId);
                      if (pObj) {
                        setAvulsoData(pObj.data);
                      }
                    }
                  }}
                  className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-bold rounded-lg p-2.5 focus:outline-none focus:border-teal-500 cursor-pointer"
                >
                  <option value="">🌐 Lançamento Transversal (Genérico do Mês)</option>
                  {partidasDoMesSorted.map((p) => (
                    <option key={p.id} value={p.id}>
                      ⚽ Jogo: {p.titulo} ({p.data.split('-').reverse().join('/')})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">Descrição / Motivo:</label>
                <input
                  type="text"
                  value={avulsoDescricao}
                  onChange={(e) => setAvulsoDescricao(e.target.value)}
                  placeholder="Ex: Compra de 2 coletes, Copo descartável, Água..."
                  className="w-full bg-emerald-950 border border-white/10 text-white text-xs rounded-lg p-2.5 focus:outline-none focus:border-teal-500 text-left"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1">Valor (R$):</label>
                  <input
                    type="number"
                    value={avulsoValor || ''}
                    onChange={(e) => setAvulsoValor(Number(e.target.value))}
                    placeholder="100.00"
                    className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                    min="0.01"
                    step="any"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-emerald-350 uppercase tracking-wider mb-1">Data:</label>
                  <input
                    type="date"
                    value={avulsoData}
                    onChange={(e) => setAvulsoData(e.target.value)}
                    className="w-full bg-emerald-950 border border-white/10 text-white text-xs rounded-lg p-2.5 focus:outline-none focus:border-teal-500"
                    required
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowFormAvulso(false);
                    setAvulsoPartidaId('');
                    setAvulsoDescricao('');
                    setAvulsoValor(0);
                    setEditingLancamentoId('');
                  }}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs py-2.5 rounded-lg transition-colors cursor-pointer justify-center text-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-500 hover:bg-teal-400 text-emerald-950 font-extrabold text-xs py-2.5 rounded-lg transition-colors cursor-pointer justify-center text-center"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETALHAMENTO POR PARTIDA DO MÊS */}
      {visaoEscopo === 'mensal' && (
        <div id="detalhamento-partidas-mes" className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left text-white animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3 gap-2">
            <div className="space-y-0.5">
              <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                detalhamento Financeiro por Partida (Mês)
              </h3>
              <p className="text-[10px] text-emerald-300/80 font-sans">
                Acompanhamento individualizado de receitas arrecadadas (diaristas + mensalistas proporcional) e despesas de cada jogo.
              </p>
            </div>
            {jogadorAtual?.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  setAvulsoData(`${mesSelecionado}-15`);
                  setAvulsoTipo('despesa');
                  setAvulsoCategoria('outros_despesa');
                  setAvulsoPartidaId('');
                  setAvulsoDescricao('');
                  setAvulsoValor(0);
                  setShowFormAvulso(true);
                }}
                className="bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/35 text-teal-300 font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                <PlusCircle className="w-3 h-3 text-teal-400" /> Novo Lançamento
              </button>
            )}
          </div>

          {partidasDoMesSorted.length === 0 ? (
            <div className="text-center py-10 bg-emerald-950/20 border border-white/5 rounded-2xl">
              <p className="text-emerald-500 font-sans italic text-xs">Nenhum jogo cadastrado para este mês ({mesSelecionado.split('-').reverse().join('/')}).</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {partidasDoMesSorted.map((p) => {
                const pDateFormatted = p.data.split('-').reverse().join('/');
                
                // Confirmados breakdown
                const confirmadosAtletas = p.confirmados
                  .map(id => jogadores.find(j => j.id === id))
                  .filter(Boolean) as Jogador[];
                const mensalistasCount = confirmadosAtletas.filter(j => j.membroStatus === 'mensalista' && j.posicao !== 'Goleiro').length;
                const diaristasCount = confirmadosAtletas.filter(j => j.membroStatus === 'diarista' && j.posicao !== 'Goleiro').length;
                const goleirosCount = confirmadosAtletas.filter(j => j.posicao === 'Goleiro').length;

                // Receita calculada
                const recDiaristasJogo = pagamentos
                  .filter(pay => pay.partidaId === p.id && pay.status === 'pago')
                  .reduce((sum, pay) => sum + pay.valor, 0);

                const recMensalistasJogo = confirmadosAtletas
                  .filter(j => j.membroStatus === 'mensalista' && j.posicao !== 'Goleiro')
                  .reduce((sum, j) => {
                    const pagMes = pagamentos.find(pay => pay.jogadorId === j.id && pay.mesRef === mesSelecionado && !pay.partidaId && pay.status === 'pago');
                    if (pagMes) {
                      return sum + (pagMes.valor / (numSabados || 4));
                    }
                    return sum;
                  }, 0);

                const recAvulsasJogo = lancamentos
                  .filter(l => l.partidaId === p.id && l.tipo === 'receita')
                  .reduce((sum, l) => sum + l.valor, 0);

                const receitaTotalJogo = recDiaristasJogo + recMensalistasJogo + recAvulsasJogo;

                // Despesa calculada
                const despesasAvulsasJogo = lancamentos
                  .filter(l => l.partidaId === p.id && l.tipo === 'despesa')
                  .reduce((sum, l) => sum + l.valor, 0);

                const despesaTotalJogo = aluguelCampoBase + despesasAvulsasJogo;
                const saldoJogo = receitaTotalJogo - despesaTotalJogo;
                const isPositive = saldoJogo >= 0;

                // Capturar lançamentos avulsos específicos do jogo para listagem
                const lancamentosExclusivosJogo = lancamentos.filter(l => l.partidaId === p.id);

                return (
                  <div 
                    key={p.id}
                    className="bg-black/25 border border-white/5 p-4 rounded-xl flex flex-col justify-between hover:border-teal-500/20 transition-all text-left space-y-3 shadow-md"
                  >
                    {/* Header do Jogo */}
                    <div className="flex justify-between items-start border-b border-white/5 pb-2">
                      <div className="space-y-0.5 font-sans">
                        <span className="text-[9px] font-mono text-teal-400 bg-teal-950/40 px-2 py-0.5 rounded border border-teal-500/20 font-bold">
                          {pDateFormatted}
                        </span>
                        <h4 className="font-sans font-bold text-white text-xs mt-1 truncate max-w-[200px]" title={p.titulo}>
                          {p.titulo}
                        </h4>
                      </div>
                      <div className="text-right">
                        <span className="block text-[8px] uppercase tracking-wider text-emerald-300 font-sans">Saldo do Jogo</span>
                        <span className={`text-xs font-mono font-black ${isPositive ? 'text-teal-400' : 'text-rose-455'}`}>
                          {isPositive ? '+' : ''}R$ {saldoJogo.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Presenças */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[9px] text-emerald-300 border-b border-white/5 pb-2 border-dashed">
                      <Users className="w-2.5 h-2.5 text-teal-450" />
                      <span>Confirmados:</span>
                      <strong className="text-white font-mono">{confirmadosAtletas.length}</strong>
                      <span>(</span>
                      <span className="text-teal-400 font-mono font-bold">{mensalistasCount} Mens</span>
                      <span>+</span>
                      <span className="text-amber-300 font-mono font-bold">{diaristasCount} Diar</span>
                      {goleirosCount > 0 && (
                        <>
                          <span>+</span>
                          <span className="text-emerald-400 font-mono">{goleirosCount} Goleiros</span>
                        </>
                      )}
                      <span>)</span>
                    </div>

                    {/* Detalhamento de Receita & Despesa */}
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-sans pb-1">
                      {/* Receitas Breakdown */}
                      <div className="space-y-1 border-r border-white/5 pr-2 text-left">
                        <span className="text-[8px] uppercase font-bold text-emerald-400 tracking-wider">Arrecadação</span>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-emerald-350">Diaristas (Pago):</span>
                          <strong className="text-white font-mono">R$ {recDiaristasJogo.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between text-[10px]" title="Soma proporcional de mensalidades dos assistentes ao jogo">
                          <span className="text-emerald-355">Mensalistas (Rateio):</span>
                          <strong className="text-white font-mono">R$ {recMensalistasJogo.toFixed(2)}</strong>
                        </div>
                        {recAvulsasJogo > 0 && (
                          <div className="flex justify-between text-[10px] text-teal-400 font-bold">
                            <span>Avulsos Jogo:</span>
                            <span className="font-mono">R$ {recAvulsasJogo.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between border-t border-white/10 pt-1 text-[10.5px] font-bold text-teal-300">
                          <span>Total Receita digital:</span>
                          <span className="font-mono">R$ {receitaTotalJogo.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Despesas Breakdown */}
                      <div className="space-y-1 pl-2 text-left">
                        <span className="text-[8px] uppercase font-bold text-rose-350 tracking-wider">Custos do Dia</span>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-emerald-350">Aluguel do Campo:</span>
                          <strong className="text-white font-mono">R$ {aluguelCampoBase.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-emerald-350">DIVERSAS / EXTRA:</span>
                          <strong className="text-white font-mono">R$ {despesasAvulsasJogo.toFixed(2)}</strong>
                        </div>
                        <div className="flex justify-between border-t border-white/10 pt-1 text-[10.5px] font-bold text-rose-355">
                          <span>Total Despesa:</span>
                          <span className="font-mono">R$ {despesaTotalJogo.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Lançamentos específicos deste jogo */}
                    {lancamentosExclusivosJogo.length > 0 && (
                      <div className="bg-black/35 rounded-lg p-2 border border-white/5 space-y-1 text-left text-[9px] max-h-24 overflow-y-auto">
                        <span className="text-teal-400 font-bold uppercase tracking-wider block text-[7.5px] mb-1">LANÇAMENTOS DESTE JOGO:</span>
                        {lancamentosExclusivosJogo.map(l => (
                          <div key={l.id} className="flex justify-between items-center text-white/90">
                            <span className="truncate max-w-[130px] font-sans">• {l.descricao}</span>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`font-mono font-bold ${l.tipo === 'receita' ? 'text-teal-450' : 'text-rose-455'}`}>
                                {l.tipo === 'receita' ? '+' : '-'} R$ {l.valor.toFixed(2)}
                              </span>
                              {jogadorAtual?.role === 'admin' && (
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLancamentoId(l.id);
                                      setAvulsoTipo(l.tipo);
                                      setAvulsoDescricao(l.descricao);
                                      setAvulsoValor(l.valor);
                                      setAvulsoData(l.data);
                                      setAvulsoCategoria(l.categoria);
                                      setAvulsoPartidaId(l.partidaId || '');
                                      setShowFormAvulso(true);
                                    }}
                                    className="text-white/40 hover:text-teal-400 p-0.5 rounded transition-colors cursor-pointer"
                                    title="Editar Lançamento"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onRemoveLancamento(l.id)}
                                    className="text-white/40 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                                    title="Excluir Lançamento"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botão de rápido lançamento para esse jogo */}
                    {jogadorAtual?.role === 'admin' && (
                      <div className="pt-2 border-t border-white/5 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAvulsoData(p.data);
                            setAvulsoTipo('despesa');
                            setAvulsoCategoria('outros_despesa');
                            setAvulsoPartidaId(p.id);
                            setAvulsoDescricao(`Despesa Jogo: ${p.titulo.substring(0, 15)}`);
                            setAvulsoValor(0);
                            setShowFormAvulso(true);
                          }}
                          className="flex-1 bg-white/5 hover:bg-rose-500/10 hover:text-rose-300 border border-white/5 hover:border-rose-500/20 text-white/70 font-bold text-[9px] py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer text-center"
                        >
                          ➕ Despesa extra
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAvulsoData(p.data);
                            setAvulsoTipo('receita');
                            setAvulsoCategoria('outros_receita');
                            setAvulsoPartidaId(p.id);
                            setAvulsoDescricao(`Receita Extra Jogo: ${p.titulo.substring(0, 15)}`);
                            setAvulsoValor(0);
                            setShowFormAvulso(true);
                          }}
                          className="flex-1 bg-white/5 hover:bg-teal-500/10 hover:text-teal-300 border border-white/5 hover:border-teal-500/20 text-white/70 font-bold text-[9px] py-1.5 rounded uppercase tracking-wider transition-all cursor-pointer text-center"
                        >
                          ➕ Receita extra
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-ÁREAS FINANCEIRAS */}
      <div className="grid grid-cols-1 gap-6 w-full">
        
        {/* SUBGERÊNCIA 1: FINANCEIRO E PAGAMENTOS DO JOGO ATUAL */}
        <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3.5 gap-2.5">
            <div className="space-y-0.5">
              <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                1. Financeiro do Jogo {visaoEscopo === 'mensal' ? 'Atual' : 'Selecionado'} & Rateios
              </h3>
              <p className="text-[10px] text-emerald-300/80 font-sans">
                {visaoEscopo === 'mensal'
                  ? 'Selecione uma partida de sábado ou jogo avulso para auditar receitas e despesas.'
                  : `Demonstrativo de rateio de partidas em todo o ano de ${anoSelecionado}.`}
              </p>
            </div>

            {/* Seletor de Jogo do Período */}
            <select
              value={partidaAtivaId}
              onChange={(e) => setPartidaSelecionadaId(e.target.value)}
              className="bg-emerald-950 border border-white/10 text-white text-xs font-bold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 cursor-pointer max-w-full sm:max-w-xs"
            >
              <option value="">-- Selecione uma Partida --</option>
              {partidasEscopo.map(p => (
                <option className="bg-emerald-955 text-white" key={p.id} value={p.id}>
                  {p.data.split('-').reverse().join('/')} - {p.titulo.substring(0, 20)}...
                </option>
              ))}
            </select>
          </div>

          {partidaAtiva && analiseJogoDetalhes ? (
            <div className="space-y-4">
              
              {/* Resumo da Partida no Topo */}
              <div className="bg-black/25 rounded-xl border border-white/5 p-3.5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="text-left filter-sm">
                  <span className="text-[9px] text-emerald-400/70 uppercase font-mono tracking-tight block">Confirmados</span>
                  <strong className="text-sm font-semibold text-white">{analiseJogoDetalhes.totalConfirmados} atletas</strong>
                </div>
                <div className="text-left filter-sm">
                  <span className="text-[9px] text-emerald-400/70 uppercase font-mono tracking-tight block">Receita Projetada</span>
                  <strong className="text-sm font-mono font-bold text-teal-400">R$ {analiseJogoDetalhes.receitaEstimada.toFixed(2)}</strong>
                </div>
                <div className="text-left filter-sm">
                  <span className="text-[9px] text-rose-455 uppercase font-mono tracking-tight block">Aluguel do Campo</span>
                  <strong className="text-sm font-mono font-bold text-rose-350">R$ {analiseJogoDetalhes.despesaAluguel.toFixed(2)}</strong>
                </div>
                <div className="text-left filter-sm font-mono">
                  <span className="text-[9px] text-emerald-300 uppercase tracking-tight block">Déficit / Sobra</span>
                  <span className={`text-sm font-bold ${analiseJogoDetalhes.saldoJogo >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
                    R$ {analiseJogoDetalhes.saldoJogo.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Informações de Rateio */}
              <div className="bg-emerald-950/40 p-4 border border-white/5 rounded-xl text-xs space-y-2 text-emerald-300">
                <p className="font-sans leading-relaxed">
                  💡 <b>Fórmula do Rateio de Receita por Jogo Realizado:</b>
                </p>
                <ul className="list-disc pl-5 font-sans space-y-1 text-[11px] text-emerald-300/80">
                  <li>Cada <b>Mensalista quitado</b> que participou contribui proporcionalmente com <b>R$ {(valor5Sabados / 5).toFixed(2)}</b> ou <b>R$ {(valor4Sabados / 4).toFixed(2)}</b> a depender do ciclo de sábados.</li>
                  <li>Cada <b>Diarista</b> contribui com o valor integral da taxa diária: <b>R$ {valorDiaria.toFixed(2)}</b>.</li>
                  <li>Atletas na posição <b>🧤 Goleiro</b> são isentos (contribuição zero).</li>
                  <li>A despesa padrão automática por jogo é de <b>R$ {aluguelCampoBase.toFixed(2)}</b>.</li>
                </ul>
              </div>

              {/* Lista dos Atletas que confirmaram a este jogo e o status individual */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-white">Status de Pagamento dos Confirmados ({analiseJogoDetalhes.totalConfirmados})</h4>
                {analiseJogoDetalhes.listaAtletas.length === 0 ? (
                  <p className="text-xs font-sans italic text-emerald-500/50 text-center py-4 bg-emerald-950/20 rounded-lg">Nenhum jogador confirmado para este jogo no momento.</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto pr-1 space-y-1 font-sans">
                    {analiseJogoDetalhes.listaAtletas.map((atl, index) => {
                      const avatar = AVATAR_PRESETS.find(p => p.id === atl.foto) || AVATAR_PRESETS[0];
                      const statusPg = pagamentos.find(p => p.jogadorId === atl.id && p.mesRef === analiseJogoDetalhes.mesPartida);
                      const isPaid = statusPg?.status === 'pago';
                      const isGoleiro = atl.posicao === 'Goleiro';

                      return (
                        <div 
                          key={atl.id || index}
                          className="flex items-center justify-between p-2.5 bg-emerald-955/20 border border-white/5 rounded-xl gap-2 font-sans"
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div 
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold shrink-0 border border-white/10 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden"
                              style={{ backgroundColor: avatar.color }}
                              onClick={() => {
                                if (atl.foto && (atl.foto.startsWith('http') || atl.foto.startsWith('data:'))) {
                                  (window as any).ampliarFoto?.(atl.foto, `${atl.nome} ${atl.sobrenome}`);
                                }
                              }}
                              title={atl.foto ? "Clique para ampliar a foto" : undefined}
                            >
                              {atl.foto && (atl.foto.startsWith('http') || atl.foto.startsWith('data:')) ? (
                                <img src={atl.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                              ) : (
                                atl.posicao.substring(0, 1)
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate leading-none">
                                {atl.nome} {atl.sobrenome}
                              </p>
                              <p className="text-[10px] text-emerald-300 font-medium leading-none mt-1 uppercase font-mono">
                                {atl.membroStatus} • {atl.posicao}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {isGoleiro ? (
                              <span className="inline-block px-2.5 py-0.5 bg-teal-550 border border-teal-500/20 text-teal-400 text-[10px] uppercase font-black tracking-normal rounded-md font-mono">
                                GRÁTIS / EXENTO
                              </span>
                            ) : statusPg?.status === 'pendente_confirmacao' ? (
                              <span className="inline-block px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/35 text-amber-400 text-[10px] font-bold rounded-md font-mono animate-pulse">
                                AGUARDANDO ADM
                              </span>
                            ) : isPaid ? (
                              <span className="inline-block px-2.5 py-0.5 bg-teal-950 border border-teal-500/25 text-teal-350 text-[10px] font-bold rounded-md font-mono">
                                QUITADO (R$ {statusPg.valor.toFixed(2)})
                              </span>
                            ) : (
                              <span className="inline-block px-2.5 py-0.5 bg-rose-955/40 border border-rose-500/25 text-rose-455 text-[10px] font-bold rounded-md font-mono font-bold">
                                PENDENTE
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-10 bg-emerald-950/20 border border-white/5 rounded-2xl">
              <p className="text-emerald-500 font-sans italic text-xs">Nenhum jogo ativo encontrado neste escopo.</p>
              <p className="text-[10.5px] text-emerald-400 font-sans mt-1">Crie jogos no calendário ou mude filtros para auditar o financeiro das partidas.</p>
            </div>
          )}
        </div>

        {/* SUBGERÊNCIA 2: CONTROLE DE CAIXA ANUAL - HISTÓRICO DE LANÇAMENTOS DO MÊS */}
        <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left">
          <div className="border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide font-sans">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              2. Livro de Lançamentos {visaoEscopo === 'mensal' ? `de ${mesSelecionado.split('-').reverse().join('/')}` : `do Ano ${anoSelecionado}`}
            </h3>
            <p className="text-[10px] text-emerald-300/80 font-sans mt-0.5">
              {visaoEscopo === 'mensal'
                ? 'Audite as despesas e receitas avulsas declaradas manualmente no sistema.'
                : `Audite as transações declaradas no consolidado anual de ${anoSelecionado}.`}
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-white">Lançamentos Avulsos ({lancamentosEscopo.length})</span>
            </div>

            {lancamentosEscopo.length === 0 ? (
              <div className="text-center py-8 bg-emerald-950/20 border border-white/5 rounded-xl space-y-2">
                <FileText className="w-8 h-8 text-emerald-555 mx-auto block animate-pulse" />
                <p className="text-xs font-sans italic text-emerald-500/60">Nessa competência não foram inseridos lançamentos avulsos.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {lancamentosEscopo.map((l) => (
                  <div 
                    key={l.id}
                    className="flex items-center justify-between p-3.5 bg-emerald-955/20 hover:bg-emerald-955/35 border border-white/5 rounded-xl gap-2 font-mono text-xs text-white"
                  >
                    <div className="flex items-start gap-2 max-w-[70%] text-left">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${l.tipo === 'receita' ? 'bg-teal-400' : 'bg-rose-500'}`} />
                      <div className="min-w-0">
                        <p className="font-bold font-sans text-xs line-clamp-1">{l.descricao}</p>
                        <p className="text-[9.5px] text-emerald-400 font-sans mt-0.5">Motivo: {l.categoria} • Dia {l.data.split('-').reverse().join('/')}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`font-mono font-bold shrink-0 ${l.tipo === 'receita' ? 'text-teal-400' : 'text-rose-400'}`}>
                        {l.tipo === 'receita' ? '+' : '-'} R$ {l.valor.toFixed(2)}
                      </span>
                      {jogadorAtual?.role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLancamentoId(l.id);
                            setAvulsoTipo(l.tipo);
                            setAvulsoDescricao(l.descricao);
                            setAvulsoValor(l.valor);
                            setAvulsoData(l.data);
                            setAvulsoCategoria(l.categoria);
                            setAvulsoPartidaId(l.partidaId || '');
                            setShowFormAvulso(true);
                          }}
                          className="text-white/40 hover:text-teal-400 p-1.5 rounded hover:bg-white/5 transition-all cursor-pointer"
                          title="Editar Lançamento"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onRemoveLancamento(l.id)}
                        className="text-white/40 hover:text-rose-400 p-1 rounded hover:bg-white/5 transition-all cursor-pointer"
                        title="Remover Entrada"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* 2.5. CONTROLE DE CONFIRMAÇÃO DE CAIXA (APROVAÇÕES PENDENTES) */}
      <div 
        id="controle-aprovacoes-caixa-pendentes" 
        className="bg-emerald-900/40 border border-amber-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4 text-left animate-fade-in text-white mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-base text-amber-400 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              Aprovações Pendentes de Pagamento (Confirmação Financeira)
            </h3>
            <p className="text-xs text-emerald-300/80 font-sans">
              Membros que informaram pagamento próprio. Verifique o comprovante e confirme ou estorne o pagamento.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1 rounded-full whitespace-nowrap">
              {pagantesPendentesDetalhado.length} Aguardando Aprovação
            </span>
          </div>
        </div>

        {pagantesPendentesDetalhado.length === 0 ? (
          <div className="text-center py-8 bg-emerald-950/10 border border-dashed border-white/5 rounded-2xl">
            <p className="text-xs font-sans italic text-emerald-500/50">Nenhum pagamento pendente de aprovação pelo administrador.</p>
          </div>
        ) : (
          <div className="space-y-3 font-sans">
            {pagantesPendentesDetalhado.map(({ pagamento, jogador }) => {
              const avatar = AVATAR_PRESETS.find(p => p.id === jogador.foto) || AVATAR_PRESETS[0];
              const partidaObj = pagamento.partidaId ? partidas.find(p => p.id === pagamento.partidaId) : null;
              
              return (
                <div 
                  key={pagamento.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between p-4 bg-amber-950/10 border border-amber-500/10 rounded-xl hover:bg-amber-955/15 transition-all gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/15 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden"
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
                    <div>
                      <h4 className="font-bold text-white text-sm">{jogador.nome} {jogador.sobrenome}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-300 font-mono mt-0.5">
                        <span className="bg-white/5 px-2 py-0.5 rounded text-emerald-400 capitalize">{jogador.membroStatus}</span>
                        <span>•</span>
                        <span>{jogador.posicao}</span>
                        <span>•</span>
                        <span className="text-amber-400 font-bold">
                          {partidaObj 
                            ? `Diária Jogo: ${partidaObj.titulo} (${partidaObj.data.split('-').reverse().join('/')})` 
                            : `Mensalidade: ${pagamento.mesRef.split('-').reverse().join('/')}`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4">
                    <div className="text-right shrink-0">
                      <span className="block font-mono font-black text-white text-sm">
                        R$ {pagamento.valor.toFixed(2)}
                      </span>
                      <span className="block text-[9px] font-bold text-amber-400 font-mono">
                        Aguardando Liberação
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        id={`btn-confirmar-caixa-${pagamento.id}`}
                        onClick={() => {
                          if (onRegistrarPagamento) {
                            const hojeStr = new Date().toISOString().split('T')[0];
                            onRegistrarPagamento(jogador.id, pagamento.mesRef, 'pago', hojeStr, pagamento.valor, pagamento.partidaId);
                          }
                        }}
                        className="py-1.5 px-3 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-[11px] rounded-lg transition-all shadow cursor-pointer uppercase tracking-wider"
                      >
                        Confirmar Pagamento
                      </button>
                      <button
                        type="button"
                        id={`btn-estornar-caixa-${pagamento.id}`}
                        onClick={() => {
                          if (onRegistrarPagamento) {
                            onRegistrarPagamento(jogador.id, pagamento.mesRef, 'pendente', null, pagamento.valor, pagamento.partidaId);
                          }
                        }}
                        className="py-1.5 px-3 bg-rose-950 border border-rose-500/25 hover:bg-rose-900 text-rose-300 font-bold text-[11px] rounded-lg transition-all cursor-pointer uppercase"
                      >
                        Estornar
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SEÇÃO: CONTROLE DE INADIMPLÊNCIA / DÉBITOS PENDENTES */}
      <div 
        id="controle-inadimplencia-debitos-pendentes" 
        className="bg-emerald-900/40 border border-rose-500/30 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4 text-left animate-fade-in text-white mb-6"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-base text-rose-450 flex items-center gap-2 uppercase tracking-wide">
              <ShieldAlert className="w-5 h-5 text-rose-550 animate-pulse" />
              Controle de Inadimplência &amp; Débitos Pendentes
            </h3>
            <p className="text-xs text-emerald-300/80 font-sans">
              Listagem de atletas com pendências financeiras em aberto no campeonato (mensalidades atrasadas ou diárias de partidas confirmadas sem quitação).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-rose-500/10 border border-rose-500/20 text-rose-300 px-3 py-1 rounded-full whitespace-nowrap">
              {todosDebitosPendentes.length} Pendências Ativas
            </span>
            <span className="text-xs font-mono font-bold bg-white/5 border border-white/10 text-white px-3 py-1 rounded-full whitespace-nowrap">
              Total Devido: R$ {todosDebitosPendentes.reduce((sum, d) => sum + d.valor, 0).toFixed(2)}
            </span>
          </div>
        </div>

        {todosDebitosPendentes.length === 0 ? (
          <div className="text-center py-8 bg-emerald-950/10 border border-dashed border-white/5 rounded-2xl">
            <p className="text-xs font-sans italic text-emerald-500/50">Excelente! Não há nenhum débito pendente registrado para os jogadores ativos.</p>
          </div>
        ) : (
          <div className="space-y-3 font-sans">
            {todosDebitosPendentes.map((deb, index) => {
              const avatar = AVATAR_PRESETS.find(p => p.id === deb.jogadorFoto) || AVATAR_PRESETS[0];
              const isPendenteConfirmacao = deb.status === 'pendente_confirmacao';
              
              return (
                <div 
                  key={`${deb.jogadorId}-${deb.id}-${index}`}
                  className="flex flex-col md:flex-row md:items-center md:justify-between p-4 bg-rose-955/5 border border-rose-500/10 rounded-xl hover:bg-rose-955/10 transition-all gap-4"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/15 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden"
                      style={{ backgroundColor: avatar.color }}
                      onClick={() => {
                        if (deb.jogadorFoto && (deb.jogadorFoto.startsWith('http') || deb.jogadorFoto.startsWith('data:'))) {
                          (window as any).ampliarFoto?.(deb.jogadorFoto, `${deb.jogadorNome} ${deb.jogadorSobrenome}`);
                        }
                      }}
                      title={deb.jogadorFoto ? "Clique para ampliar a foto" : undefined}
                    >
                      {deb.jogadorFoto && (deb.jogadorFoto.startsWith('http') || deb.jogadorFoto.startsWith('data:')) ? (
                        <img src={deb.jogadorFoto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        deb.jogadorPosicao.substring(0, 1)
                      )}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{deb.jogadorNome} {deb.jogadorSobrenome}</h4>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-emerald-300 font-mono mt-0.5">
                        <span className="bg-white/5 px-2 py-0.5 rounded text-emerald-400 capitalize">{deb.jogadorMembroStatus}</span>
                        <span>•</span>
                        <span>{deb.jogadorPosicao}</span>
                        <span>•</span>
                        <span className={`${deb.tipo === 'mensalidade' ? 'text-teal-400' : 'text-amber-400'} font-bold`}>
                          {deb.tipo === 'mensalidade' 
                            ? `Mensalidade: ${deb.mesRef.split('-').reverse().join('/')}` 
                            : `Diária Jogo: ${deb.referencia.replace('Diária do jogo:', '').trim()} (${deb.dataOrigem.split('-').reverse().join('/')})`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4">
                    <div className="text-right shrink-0">
                      <span className="block font-mono font-black text-white text-sm">
                        R$ {deb.valor.toFixed(2)}
                      </span>
                      <span className={`block text-[9px] font-bold uppercase tracking-widest font-mono ${
                        isPendenteConfirmacao ? 'text-amber-400 animate-pulse' : 'text-rose-400'
                      }`}>
                        {isPendenteConfirmacao ? 'Aguardo Validação' : 'Em Aberto'}
                      </span>
                    </div>

                    {/* Botões administrativos - só aparece para o ADM */}
                    {jogadorAtual?.role === 'admin' && (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          id={`btn-quitar-debito-adm-${deb.id}`}
                          onClick={() => {
                            if (onRegistrarPagamento) {
                              const hojeStr = new Date().toISOString().split('T')[0];
                              onRegistrarPagamento(deb.jogadorId, deb.mesRef, 'pago', hojeStr, deb.valor, deb.partidaId);
                            }
                          }}
                          className="py-1.5 px-3 bg-teal-500 hover:bg-teal-400 text-black font-black text-[11px] rounded-lg transition-all shadow cursor-pointer uppercase tracking-wider active:scale-97"
                        >
                          Quitar Débito
                        </button>
                        
                        <button
                          type="button"
                          id={`btn-cancelar-debito-adm-${deb.id}`}
                          onClick={() => {
                            if (onRegistrarPagamento) {
                              if (cancelarConfirmId === deb.id) {
                                onRegistrarPagamento(deb.jogadorId, deb.mesRef, 'cancelado', null, deb.valor, deb.partidaId);
                                setCancelarConfirmId(null);
                              } else {
                                setCancelarConfirmId(deb.id);
                                setTimeout(() => setCancelarConfirmId(prev => prev === deb.id ? null : prev), 3000);
                              }
                            }
                          }}
                          className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer uppercase active:scale-97 text-[11px] font-bold ${
                            cancelarConfirmId === deb.id
                              ? 'bg-red-500 text-black font-black animate-pulse border border-red-500'
                              : 'bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900 text-rose-300'
                          }`}
                        >
                          {cancelarConfirmId === deb.id ? 'Confirmar?' : 'Cancelar Cobrança'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. LISTA DETALHADA DE JOGADORES PAGANTES DO MES */}
      <div 
        id="lista-detalhada-pagantes-mes" 
        className="bg-emerald-900/40 border border-white/10 rounded-2xl p-6 shadow-xl backdrop-blur-sm space-y-4 text-left animate-fade-in text-white"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4 gap-3">
          <div className="space-y-1">
            <h3 className="font-display font-semibold text-base text-teal-300 flex items-center gap-2 uppercase tracking-wide">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse" />
              Lista Detalhada de Jogadores Pagantes do Mês
            </h3>
            <p className="text-xs text-emerald-300/80 font-sans">
              Todos os atletas com mensalidades ou diárias aprovadas e quitadas para a competência de <strong>{mesSelecionado.split('-').reverse().join('/')}</strong>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold bg-teal-500/10 border border-teal-500/20 text-teal-300 px-3 py-1 rounded-full whitespace-nowrap">
              {pagantesDetalhado.length} Pagamentos Quitados
            </span>
            <span className="text-xs font-mono font-bold bg-white/5 border border-white/10 text-white px-3 py-1 rounded-full whitespace-nowrap">
              Total: R$ {pagantesDetalhado.reduce((sum, p) => sum + p.pagamento.valor, 0).toFixed(2)}
            </span>
          </div>
        </div>

        {pagantesDetalhado.length === 0 ? (
          <div className="text-center py-12 bg-emerald-950/20 border border-dashed border-white/5 rounded-2xl">
            <p className="text-xs font-sans italic text-emerald-500/50">Nenhum jogador registrado como pagante (comprovante quitado) para o mês de {mesSelecionado.split('-').reverse().join('/')}.</p>
          </div>
        ) : (
          <div className="overflow-x-auto text-[11px]">
            <table className="w-full text-left border-collapse font-sans text-[11px] text-white">
              <thead>
                <tr className="border-b border-white/5 text-[10px] text-emerald-400 uppercase tracking-widest bg-black/10">
                  <th className="py-3 px-4 font-bold">Jogador / Atleta</th>
                  <th className="py-3 px-4 font-bold">Tipo</th>
                  <th className="py-3 px-4 font-bold">Posição</th>
                  <th className="py-3 px-4 font-bold">Data do Pagamento</th>
                  <th className="py-3 px-4 font-bold">Mês/Dia de Referência</th>
                  <th className="py-3 px-4 font-bold text-right">Valor Pago</th>
                  <th className="py-3 px-4 font-bold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {pagantesDetalhado.map(({ pagamento, jogador }) => {
                  const avatar = AVATAR_PRESETS.find(p => p.id === jogador.foto) || AVATAR_PRESETS[0];
                  return (
                    <tr 
                      key={pagamento.id} 
                      className="hover:bg-white/5 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border border-white/10 cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200 overflow-hidden"
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
                          <div>
                            <p className="font-bold text-white text-xs">{jogador.nome} {jogador.sobrenome}</p>
                            <p className="text-[10px] text-emerald-400 font-mono">{jogador.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          jogador.membroStatus === 'mensalista' 
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-400' 
                            : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400'
                        }`}>
                          {jogador.membroStatus}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-emerald-300">
                        {jogador.posicao}
                      </td>
                      <td className="py-3.5 px-4 text-emerald-300/80 font-mono text-[11px]">
                        {pagamento.dataPagamento 
                          ? pagamento.dataPagamento.split('T')[0].split('-').reverse().join('/') 
                          : 'Sincronizado'}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-teal-300/85">
                        {(() => {
                          if (jogador.membroStatus === 'mensalista') {
                            return pagamento.mesRef.split('-').reverse().join('/');
                          } else {
                            const pObj = pagamento.partidaId ? partidas.find(pt => pt.id === pagamento.partidaId) : null;
                            if (pObj) {
                              return pObj.data.split('T')[0].split('-').reverse().join('/');
                            }
                            return `Diária ${pagamento.mesRef.split('-').reverse().join('/')}`;
                          }
                        })()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-teal-300 text-[11px]">
                        R$ {pagamento.valor.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="inline-flex items-center gap-1 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-[9.5px] font-bold rounded px-2 py-0.5 uppercase font-mono">
                            <CheckCircle2 className="w-2.5 h-2.5 text-teal-400 shrink-0" />
                            Validado
                          </span>
                          <button
                            type="button"
                            id={`btn-estornar-tabela-${pagamento.id}`}
                            onClick={() => {
                              if (onRegistrarPagamento) {
                                onRegistrarPagamento(jogador.id, pagamento.mesRef, 'pendente', null, pagamento.valor, pagamento.partidaId);
                              }
                            }}
                            className="text-[9.5px] font-bold text-rose-400 hover:text-rose-300 bg-rose-950/40 border border-rose-500/20 py-0.5 px-2 rounded hover:bg-rose-950 hover:border-rose-500/40 transition-all cursor-pointer"
                          >
                            Estornar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* POPUP DE DETALHAMENTO FINANCEIRO DO MÊS */}
      {detalhesMesModal && statsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in text-white">
          <div 
            className="w-full max-w-4xl max-h-[90vh] border border-white/10 rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden relative font-sans"
            onClick={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#021a14' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="space-y-1 text-left">
                <span className="text-[10px] font-mono tracking-wider font-bold text-teal-400 bg-teal-500/10 px-2.5 py-0.5 rounded-full uppercase">
                  Auditoria Financeira
                </span>
                <h3 className="font-display font-black text-lg text-white uppercase tracking-wider">
                  Detalhamento de {statsModal.nomeMesExtenso}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDetalhesMesModal(null)}
                className="w-8 h-8 rounded-lg bg-black/20 hover:bg-white/10 border border-white/10 flex items-center justify-center text-emerald-300 hover:text-white transition-all cursor-pointer"
                title="Fechar Detalhes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-6 scrollbar-thin">
              
              {/* Row of BIG METRICS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                {/* Receitas Box */}
                <div className="bg-emerald-900/30 border border-white/10 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-emerald-450 uppercase font-mono font-bold tracking-wider">Arrecadação Total</span>
                    <h4 className="text-xl font-mono font-bold text-teal-300 mt-1">R$ {statsModal.receitaTotal.toFixed(2)}</h4>
                  </div>
                  <div className="text-[10px] text-emerald-300/80 border-t border-white/5 pt-2 mt-2.5 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span>Mensalistas:</span>
                      <span className="text-white">R$ {statsModal.recMensalistas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Diaristas:</span>
                      <span className="text-white">R$ {statsModal.recDiaristas.toFixed(2)}</span>
                    </div>
                    {statsModal.recAvulsa > 0 && (
                      <div className="flex justify-between">
                        <span>Avulsos:</span>
                        <span className="text-white">R$ {statsModal.recAvulsa.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Despesas Box */}
                <div className="bg-emerald-995 border border-white/10 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-rose-350 uppercase font-mono font-bold tracking-wider">Custo de Operação</span>
                    <h4 className="text-xl font-mono font-bold text-rose-300 mt-1">R$ {statsModal.despesaTotal.toFixed(2)}</h4>
                  </div>
                  <div className="text-[10px] text-rose-300/80 border-t border-white/5 pt-2 mt-2.5 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span>Aluguel ({statsModal.partidasCount} jogos):</span>
                      <span className="text-white">R$ {statsModal.despesaAluguel.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Outras Despesas:</span>
                      <span className="text-white">R$ {statsModal.despesaAvulsa.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Saldo Líquido Box */}
                <div className="bg-emerald-900/30 border border-white/10 p-4 rounded-xl flex flex-col justify-between">
                  <div>
                    <span className="text-[9px] text-zinc-350 uppercase font-mono font-bold tracking-wider">Resultado Líquido</span>
                    <h4 className={`text-xl font-mono font-bold mt-1 ${statsModal.saldo >= 0 ? 'text-teal-400' : 'text-rose-455'}`}>
                      R$ {statsModal.saldo.toFixed(2)}
                    </h4>
                  </div>
                  <div className="text-[10px] border-t border-white/5 pt-2 mt-2.5 space-y-1 font-mono">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Atletas Ativos:</span>
                      <span className="font-bold text-white">{statsModal.ativosCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-400">Total Pagamentos:</span>
                      <span className="font-bold text-teal-300">{statsModal.pagantesCount} pagos</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Lists detail split inside layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                
                {/* List of Quitados */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col h-64 text-left">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 shrink-0">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                      Quitados ({statsModal.pagantesCount})
                    </h4>
                    <span className="text-[10px] font-bold text-teal-355 font-mono">
                      R$ {(statsModal.recDiaristas + statsModal.recMensalistas).toFixed(2)}
                    </span>
                  </div>

                  {statsModal.pagantesM.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-emerald-500/50 italic font-sans">
                      Nenhum pagamento quitado registrado neste mês.
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-sans">
                      {statsModal.pagantesM.map((p, idx) => {
                        const avatar = AVATAR_PRESETS.find(pr => pr.id === p.jogador.foto) || AVATAR_PRESETS[0];
                        return (
                          <div key={p.pagamento.id || idx} className="flex items-center justify-between p-2 bg-emerald-955/10 rounded-lg border border-white/5 h-12">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div 
                                className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 text-white overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200" 
                                style={{ backgroundColor: avatar.color }}
                                onClick={() => {
                                  if (p.jogador.foto && (p.jogador.foto.startsWith('http') || p.jogador.foto.startsWith('data:'))) {
                                    (window as any).ampliarFoto?.(p.jogador.foto, `${p.jogador.nome} ${p.jogador.sobrenome}`);
                                  }
                                }}
                                title={p.jogador.foto ? "Clique para ampliar a foto" : undefined}
                              >
                                {p.jogador.foto && (p.jogador.foto.startsWith('http') || p.jogador.foto.startsWith('data:')) ? (
                                  <img src={p.jogador.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  p.jogador.nome.substring(0, 1)
                                )}
                              </div>
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-white truncate">{p.jogador.nome} {p.jogador.sobrenome}</p>
                                <p className="text-[9px] text-amber-400/80 uppercase font-black tracking-tighter">{p.jogador.membroStatus}</p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-teal-350 font-extrabold bg-teal-500/10 px-2 py-0.5 rounded shrink-0">
                              R$ {p.pagamento.valor.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* List of active roster */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col h-64 text-left">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 shrink-0">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-emerald-400" />
                      Relação de Atletas Ativos ({statsModal.ativosCount})
                    </h4>
                    <span className="text-[9.5px] text-emerald-450 italic font-medium">Faturamento e Rateio Base</span>
                  </div>

                  {ativosM.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-emerald-500/50 italic font-sans">
                      Nenhum atleta listado como ativo para o mês.
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1 font-sans">
                      {ativosM.map((at, idx) => {
                        const avatar = AVATAR_PRESETS.find(pr => pr.id === at.foto) || AVATAR_PRESETS[0];
                        const jaPago = pagamentos.some(p => p.jogadorId === at.id && p.mesRef === detalhesMesModal && p.status === 'pago');
                        return (
                          <div key={at.id || idx} className="flex items-center justify-between p-2 bg-emerald-955/10 rounded-lg border border-white/5 h-12">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div 
                                className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 text-white overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200" 
                                style={{ backgroundColor: avatar.color }}
                                onClick={() => {
                                  if (at.foto && (at.foto.startsWith('http') || at.foto.startsWith('data:'))) {
                                    (window as any).ampliarFoto?.(at.foto, `${at.nome} ${at.sobrenome}`);
                                  }
                                }}
                                title={at.foto ? "Clique para ampliar a foto" : undefined}
                              >
                                {at.foto && (at.foto.startsWith('http') || at.foto.startsWith('data:')) ? (
                                  <img src={at.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  at.nome.substring(0, 1)
                                )}
                              </div>
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-white truncate">{at.nome} {at.sobrenome}</p>
                                <p className="text-[9px] text-emerald-400/80 font-mono leading-none">{at.posicao}</p>
                              </div>
                            </div>
                            <span className={`text-[9px] font-bold uppercase py-0.5 px-2 rounded-full border shrink-0 ${
                              jaPago 
                                ? 'bg-teal-500/15 border-teal-500/30 text-teal-300' 
                                : 'bg-rose-500/15 border-rose-500/20 text-rose-350'
                            }`}>
                              {jaPago ? 'Pago' : 'Pendente'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* List of outstanding debts */}
                <div className="bg-black/30 border border-white/5 rounded-xl p-4 flex flex-col h-64 text-left lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2 shrink-0">
                    <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-455 flex items-center gap-1.5 animate-pulse">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-455" />
                      Inadimplência de Mensalistas / Diaristas ({statsModal.debitosM.length})
                    </h4>
                    <span className="text-[10px] font-bold text-rose-350 font-mono">
                      R$ {statsModal.totalDebitos.toFixed(2)} pendente
                    </span>
                  </div>

                  {statsModal.debitosM.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-4 bg-teal-555/5 border border-teal-500/20 rounded-xl space-y-1">
                      <CheckCircle2 className="w-6 h-6 text-teal-400" />
                      <p className="text-teal-400 text-xs font-bold font-sans">Sem inadimplências!</p>
                      <p className="text-[10px] text-teal-300/75">Excelente! Todos os atletas assíduos quitaram as pendências do mês.</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 font-sans">
                      {statsModal.debitosM.map((deb, idx) => {
                        const avatar = AVATAR_PRESETS.find(pr => pr.id === deb.jogadorFoto) || AVATAR_PRESETS[0];
                        return (
                          <div key={deb.id || idx} className="flex items-center justify-between p-2.5 bg-rose-955/15 hover:bg-rose-955/25 transition-all rounded-lg border border-rose-500/10">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div 
                                className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 text-white overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200" 
                                style={{ backgroundColor: avatar.color }}
                                onClick={() => {
                                  if (deb.jogadorFoto && (deb.jogadorFoto.startsWith('http') || deb.jogadorFoto.startsWith('data:'))) {
                                    (window as any).ampliarFoto?.(deb.jogadorFoto, `${deb.jogadorNome} ${deb.jogadorSobrenome}`);
                                  }
                                }}
                                title={deb.jogadorFoto ? "Clique para ampliar a foto" : undefined}
                              >
                                {deb.jogadorFoto && (deb.jogadorFoto.startsWith('http') || deb.jogadorFoto.startsWith('data:')) ? (
                                  <img src={deb.jogadorFoto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  deb.jogadorNome.substring(0, 1)
                                )}
                              </div>
                              <div className="truncate">
                                <p className="text-[11px] font-bold text-white truncate">{deb.jogadorNome} {deb.jogadorSobrenome}</p>
                                <p className="text-[9px] text-rose-400 font-sans truncate">
                                  Débito de <span className="uppercase font-semibold">{deb.tipo}</span> • Referência {deb.referencia}
                                </p>
                              </div>
                            </div>
                            <span className="text-[10px] font-mono text-rose-400 font-black bg-rose-500/10 border border-rose-555/20 px-2 py-0.5 rounded shrink-0">
                              R$ {deb.valor.toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

            </div>

            {/* Footer */}
            <div className="border-t border-white/10 pt-3 mt-4 flex items-center justify-between text-[10px] text-emerald-450 font-sans shrink-0">
              <span className="font-semibold tracking-wider uppercase">Pelada Batista • Gestão de Elenco</span>
              <button
                type="button"
                onClick={() => setDetalhesMesModal(null)}
                className="bg-teal-500 hover:bg-teal-400 text-emerald-950 font-extrabold text-xs px-4 py-2 rounded-lg transition-all cursor-pointer"
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
