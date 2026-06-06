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
  Users
} from 'lucide-react';
import { obterDebitosDoJogador } from '../utils/confirmationRules';

interface ControleCaixaProps {
  partidas: Partida[];
  jogadores: Jogador[];
  pagamentos: Pagamento[];
  lancamentos: LancamentoAvulso[];
  onAddLancamento: (l: Omit<LancamentoAvulso, 'id'>) => void;
  onRemoveLancamento: (id: string) => void;
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
  aluguelCampoBase,
  onUpdateAluguelCampoBase,
  valorDiaria,
  valor4Sabados,
  valor5Sabados,
  onRegistrarPagamento,
  jogadorAtual,
  onLimparDadosDoMes
}: ControleCaixaProps) {
  // Estado para escopo de visualização (Mensal vs Anual Consolidado)
  const [visaoEscopo, setVisaoEscopo] = useState<'mensal' | 'anual'>('mensal');

  // Estado para confirmar cancelamento sem window.confirm
  const [cancelarConfirmId, setCancelarConfirmId] = useState<string | null>(null);

  // Estados para exclusão de mês e pop-up de detalhes
  const [deletarMesConfirmId, setDeletarMesConfirmId] = useState<string | null>(null);
  const [detalhesMesModal, setDetalhesMesModal] = useState<string | null>(null);

  // Estado para Mês de Referência do Caixa Geral
  const [mesSelecionado, setMesSelecionado] = useState('2026-05');
  
  // Estado para Jogo Selecionado na sub-área 1
  const [partidaSelecionadaId, setPartidaSelecionadaId] = useState<string>('');

  // Formulário de lançamentos avulsos
  const [showFormAvulso, setShowFormAvulso] = useState<boolean>(false);
  const [avulsoTipo, setAvulsoTipo] = useState<'receita' | 'despesa'>('receita');
  const [avulsoDescricao, setAvulsoDescricao] = useState('');
  const [avulsoValor, setAvulsoValor] = useState<number>(0);
  const [avulsoData, setAvulsoData] = useState<string>(new Date().toISOString().split('T')[0]);
  const [avulsoCategoria, setAvulsoCategoria] = useState<string>('outros_receita');

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
        valor5Sabados
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
    return partidasDoMes.length * aluguelCampoBase;
  }, [partidasDoMes, aluguelCampoBase]);

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

    const mesesExibidos = meses.filter(m => {
      const mesIdInt = parseInt(m.id);
      if (anoSelInt < anoAtual) {
        return true; // past year: include all months
      } else if (anoSelInt === anoAtual) {
        return mesIdInt <= mesAtual; // current year: up to current month (YTD)
      } else {
        return false; // future year: exclude all months
      }
    });

    return mesesExibidos.map(m => {
      const mesRef = `${anoSelecionado}-${m.id}`;
      
      const partidasM = partidas.filter(p => !p.cancelada && p.data.startsWith(mesRef));
      const pagamentosM = pagamentos.filter(p => p.mesRef === mesRef && p.status === 'pago');
      
      const recMensalistasM = pagamentosM
        .filter(p => {
          const j = jogadores.find(j => j.id === p.jogadorId);
          return j && j.membroStatus === 'mensalista';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const recDiaristasM = pagamentosM
        .filter(p => {
          const j = jogadores.find(j => j.id === p.jogadorId);
          return j && j.membroStatus === 'diarista';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const recAvulsaM = lancamentos
        .filter(l => l.tipo === 'receita' && l.data.startsWith(mesRef))
        .reduce((sum, l) => sum + l.valor, 0);

      const receitaTotalM = recMensalistasM + recDiaristasM + recAvulsaM;

      const despesaAluguelM = partidasM.length * aluguelCampoBase;
      const despesaAvulsaM = lancamentos
        .filter(l => l.tipo === 'despesa' && l.data.startsWith(mesRef))
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
  }, [partidas, pagamentos, lancamentos, jogadores, aluguelCampoBase, anoSelecionado]);

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


  // --- ADAPTABILIDADES DO ESCOPO ---
  const partidasDoAno = useMemo(() => {
    const hoje = new Date();
    const anoAtual = hoje.getFullYear();
    const mesAtual = hoje.getMonth() + 1;
    const anoSelInt = parseInt(anoSelecionado) || 2026;

    return partidas.filter(p => {
      if (p.cancelada) return false;
      if (!p.data.startsWith(anoSelecionado)) return false;

      const mesPartida = parseInt(p.data.substring(5, 7));
      if (anoSelInt < anoAtual) {
        return true;
      } else if (anoSelInt === anoAtual) {
        return mesPartida <= mesAtual;
      } else {
        return false;
      }
    });
  }, [partidas, anoSelecionado]);

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
    const despesaAluguelJogo = aluguelCampoBase;

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

    const despesaAluguel = partidasM.length * aluguelCampoBase;
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

    onAddLancamento({
      tipo: avulsoTipo,
      descricao: avulsoDescricao,
      valor: avulsoValor,
      data: avulsoData,
      categoria: avulsoCategoria
    });

    // Reset formulário
    setAvulsoDescricao('');
    setAvulsoValor(0);
    setShowFormAvulso(false);
  };

  const handleSalvarAluguel = () => {
    onUpdateAluguelCampoBase(tempAluguel);
    setIsEditingAluguel(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* CABEÇALHO */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div className="text-left">
          <h2 id="titulo-caixa" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <TrendingUp className="w-5 h-5 text-teal-400" />
            Controle de Caixa Geral
          </h2>
          <p className="text-xs text-emerald-300/85 font-sans mt-0.5">Gestão financeira de caixa consolidada, faturamento, rateio e auditorias administradoras.</p>
        </div>

        {/* CONTROLES DE ESCOPO E FILTROS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Escopo (Pill Switch) */}
          <div className="bg-emerald-950 p-1 border border-white/15 rounded-xl flex items-center shrink-0">
            <button
              id="switch-scope-mensal"
              type="button"
              onClick={() => {
                setVisaoEscopo('mensal');
                setPartidaSelecionadaId('');
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                visaoEscopo === 'mensal'
                  ? 'bg-teal-500 text-emerald-950 shadow font-extrabold'
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
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                visaoEscopo === 'anual'
                  ? 'bg-teal-500 text-emerald-950 shadow font-extrabold'
                  : 'text-emerald-300 hover:text-white font-medium'
              }`}
            >
              Consolidado Anual
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {visaoEscopo === 'mensal' ? (
              <>
                <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider font-sans shrink-0">Filtrar Mês:</label>
                <select
                  id="caixa-mes-seletor"
                  value={mesSelecionado}
                  onChange={(e) => {
                    setMesSelecionado(e.target.value);
                    setPartidaSelecionadaId(''); // reset partida ativa
                  }}
                  className="bg-emerald-950 border border-white/10 text-white text-xs font-bold font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-white cursor-pointer"
                >
                  <option className="bg-emerald-955 text-white" value="2026-05">Maio / 2026</option>
                  <option className="bg-emerald-955 text-white" value="2026-06">Junho / 2026</option>
                </select>
              </>
            ) : (
              <span className="bg-emerald-950 border border-white/10 text-teal-400 text-xs font-extrabold font-mono rounded-lg px-3 py-2 shrink-0">
                Ano {anoSelecionado} (Até o momento)
              </span>
            )}

            <button
              id="btn-add-lancamento-caixa"
              type="button"
              onClick={() => {
                setAvulsoData(`${mesSelecionado}-15`);
                setAvulsoTipo('receita');
                setAvulsoCategoria('outros_receita');
                setShowFormAvulso(true);
              }}
              className="bg-teal-500 hover:bg-teal-400 text-bg shadow hover:shadow-teal-500/10 font-bold text-xs py-2 px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              style={{ color: '#022c22' }}
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-950" />
              Novo Lançamento
            </button>
          </div>
        </div>
      </div>

      {/* DASHBOARDS - BIG NUMBERS DE COLETIVO FINANCEIRO */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Receita TOTAL */}
        <div className="bg-emerald-900/30 border border-white/10 p-5 rounded-2xl relative overflow-hidden text-left shadow-md">
          <p className="text-[9px] text-emerald-300 uppercase font-bold tracking-wider leading-none">
            {visaoEscopo === 'mensal' ? 'Receitas do Mês' : `Receitas do Ano (${anoSelecionado})`}
          </p>
          <h4 className="text-2xl font-mono font-bold text-white mt-2">
            R$ {(visaoEscopo === 'mensal' ? receitaTotalGeral : receitaTotalAno).toFixed(2)}
          </h4>
          <div className="space-y-1 mt-3.5 text-[10px] text-emerald-300/80 border-t border-white/5 pt-2.5">
            <div className="flex justify-between">
              <span>Mensalistas:</span>
              <strong className="text-white">
                R$ {(visaoEscopo === 'mensal' ? receitaMensalistas : receitaMensalistasAno).toFixed(2)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Diaristas:</span>
              <strong className="text-white">
                R$ {(visaoEscopo === 'mensal' ? receitaDiaristas : receitaDiaristasAno).toFixed(2)}
              </strong>
            </div>
            {((visaoEscopo === 'mensal' ? receitaAvulsaTotal : receitaAvulsaAno) > 0) && (
              <div className="flex justify-between text-teal-400 font-bold">
                <span>Avulsos:</span>
                <strong>
                  R$ {(visaoEscopo === 'mensal' ? receitaAvulsaTotal : receitaAvulsaAno).toFixed(2)}
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
            {visaoEscopo === 'mensal' ? 'Despesas do Mês' : `Despesas do Ano (${anoSelecionado})`}
          </p>
          <h4 className="text-2xl font-mono font-bold text-rose-300 mt-2">
            R$ {(visaoEscopo === 'mensal' ? despesaTotalGeral : despesaTotalAno).toFixed(2)}
          </h4>
          <div className="space-y-1 mt-3.5 text-[10px] text-rose-300/80 border-t border-white/5 pt-2.5">
            <div className="flex justify-between">
              <span>Aluguel ({visaoEscopo === 'mensal' ? partidasDoMes.length : partidasDoAno.length} jogos):</span>
              <strong className="text-white">
                R$ {(visaoEscopo === 'mensal' ? despesaAluguelAutomatico : despesaAluguelAno).toFixed(2)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span>Goleiro / Avulsas:</span>
              <strong className="text-white">
                R$ {(visaoEscopo === 'mensal' ? despesaAvulsaTotal : despesaAvulsaAno).toFixed(2)}
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
            {visaoEscopo === 'mensal' ? 'Saldo Líquido' : `Saldo Líquido Ano (${anoSelecionado})`}
          </p>
          {(() => {
            const val = visaoEscopo === 'mensal' ? saldoLiquidoMês : saldoLiquidoAno;
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
                className="w-full bg-emerald-950 border border-white/20 text-white font-mono font-bold text-sm rounded px-2.5 py-1 focus:outline-none"
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
                  : `Custo total de aluguel do campo acumulado este ano: R$ ${despesaAluguelAno.toFixed(2)}.`}
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

      {/* DEMONSTRATIVO MENSAL CONSOLIDADO DO ANO (EXIBIDO APENAS EM VISÃO ANUAL) */}
      {visaoEscopo === 'anual' && (
        <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left animate-fade-in text-white">
          <div className="border-b border-white/10 pb-3">
            <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide">
              <Calendar className="w-5 h-5 text-teal-400" />
              Demonstrativo Mensal Consolidado - Ano {anoSelecionado}
            </h3>
            <p className="text-xs text-emerald-300/80 font-sans mt-0.5">Visão verticalizada de todos os meses do ano de faturamento, gasto operacional e saldo acumulado.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {consolidadoMensalDoAno
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
                      <span className={`font-mono font-extrabold text-xs ${isPos ? 'text-teal-400' : 'text-rose-400'}`}>
                        R$ {m.saldo.toFixed(2)}
                      </span>
                    </div>
                  </div>
                );
              })}
            
            {consolidadoMensalDoAno.filter(m => m.receitaTotal > 0 || m.despesaTotal > 0 || m.partidasCount > 0).length === 0 && (
              <div className="col-span-full text-center py-8 text-emerald-500 font-sans italic text-xs">
                Nenhum registro consolidado encontrado para o ano {anoSelecionado}.
              </div>
            )}
          </div>
        </div>
      )}

      {/* FORMULÁRIO DE LANÇAMENTO AVULSO */}
      {showFormAvulso && (
        <div className="bg-emerald-900/30 border border-white/15 p-5 rounded-2xl text-left shadow-lg animate-fade-in relative">
          <button 
            type="button"
            onClick={() => setShowFormAvulso(false)}
            className="absolute right-4 top-4 text-emerald-300 hover:text-white font-bold"
          >
            Fechar ×
          </button>
          
          <h3 className="text-xs font-bold uppercase tracking-wider text-white mb-4 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-400 animate-pulse" /> Registrar Lançamento Avulso (Receita ou Despesa)
          </h3>

          <form onSubmit={handleSalvarLancamentoAvulso} className="grid grid-cols-1 sm:grid-cols-5 gap-3.5 items-end">
            <div>
              <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1 font-sans">Tipo:</label>
              <select
                value={avulsoTipo}
                onChange={(e) => {
                  const val = e.target.value as 'receita' | 'despesa';
                  setAvulsoTipo(val);
                  setAvulsoCategoria(val === 'receita' ? 'outros_receita' : 'outros_despesa');
                }}
                className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-bold rounded-lg p-2.5 focus:outline-none"
              >
                <option value="receita">➕ RECEITA (Entrada)</option>
                <option value="despesa">➖ DESPESA (Saída)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1 font-sans">Descrição / Motivo:</label>
              <input
                type="text"
                value={avulsoDescricao}
                onChange={(e) => setAvulsoDescricao(e.target.value)}
                placeholder="Ex: Compra de 2 bolas oficiais, Goleiro avulso, Patrocinador..."
                className="w-full bg-emerald-950 border border-white/10 text-white text-xs rounded-lg p-2.5 focus:outline-none text-left"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-wider mb-1 font-sans">Valor (R$):</label>
              <input
                type="number"
                value={avulsoValor || ''}
                onChange={(e) => setAvulsoValor(Number(e.target.value))}
                placeholder="100.00"
                className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none"
                min="0"
                step="any"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                className="w-full bg-white hover:bg-teal-50 text-black font-extrabold text-xs py-2.5 rounded-lg transition-colors cursor-pointer justify-center"
              >
                Lançar Registro
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUB-ÁREAS FINANCEIRAS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* SUBGERÊNCIA 1: CAIXA E PAGAMENTOS DO JOGO ATUAL (Col: 7/12) */}
        <div className="lg:col-span-7 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-3.5 gap-2.5">
            <div className="space-y-0.5">
              <h3 className="font-display font-semibold text-sm text-teal-300 flex items-center gap-2 uppercase tracking-wide">
                <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                1. Caixa do Jogo {visaoEscopo === 'mensal' ? 'Atual' : 'Selecionado'} & Rateios
              </h3>
              <p className="text-[10px] text-emerald-300/80 font-sans">
                {visaoEscopo === 'mensal'
                  ? 'Selecione uma partida de sábado ou racha avulso para auditar receitas e despesas.'
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
                  <p className="text-xs font-sans italic text-emerald-500/50 text-center py-4 bg-emerald-950/20 rounded-lg">Nenhum jogador confirmado para este racha no momento.</p>
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
                              className="w-7 h-7 rounded-full flex items-center justify-center text-[10.5px] font-bold shrink-0 border border-white/10"
                              style={{ backgroundColor: avatar.color }}
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
              <p className="text-emerald-500 font-sans italic text-xs">Nenhum racha / jogo ativo encontrado neste escopo.</p>
              <p className="text-[10.5px] text-emerald-400 font-sans mt-1">Crie jogos no calendário ou mude filtros para auditar os caixas de partida.</p>
            </div>
          )}
        </div>

        {/* SUBGERÊNCIA 2: CONTROLE DE CAIXA ANUAL - HISTÓRICO DE LANÇAMENTOS DO MÊS (Col: 5/12) */}
        <div className="lg:col-span-5 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left">
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
              Aprovações Pendentes de Caixa (Confirmação Financeira)
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
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/15"
                      style={{ backgroundColor: avatar.color }}
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
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 border border-white/15"
                      style={{ backgroundColor: avatar.color }}
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
                  <th className="py-3 px-4 font-bold text-center">Status no Caixa</th>
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
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 border border-white/10"
                            style={{ backgroundColor: avatar.color }}
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
                  Auditoria de Caixa
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
                              <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 text-white" style={{ backgroundColor: avatar.color }}>
                                {p.jogador.nome.substring(0, 1)}
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
                              <div className="w-6.5 h-6.5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 text-white" style={{ backgroundColor: avatar.color }}>
                                {at.nome.substring(0, 1)}
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
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 border border-white/5 text-white" style={{ backgroundColor: avatar.color }}>
                                {deb.jogadorNome.substring(0, 1)}
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
