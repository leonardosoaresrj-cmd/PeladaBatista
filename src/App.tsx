/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Jogador, Partida, Pagamento, PosicaoJogador, MembroStatus, LancamentoAvulso } from './types';
import {
  getSavedJogadores,
  saveJogadores,
  getSavedPartidas,
  savePartidas,
  getSavedPagamentos,
  savePagamentos,
  getSavedLancamentos,
  saveLancamentos,
  getSavedAluguelCampo,
  saveAluguelCampo,
  AVATAR_PRESETS
} from './data';
import {
  getSupabase,
  carregarJogadoresDoSupabase,
  carregarPartidasDoSupabase,
  carregarPagamentosDoSupabase,
  salvarJogadorNoSupabase,
  salvarPartidaNoSupabase,
  salvarPagamentoNoSupabase,
  deletarPartidaNoSupabase,
  obterConfiguracaoDoSupabase,
  salvarConfiguracaoNoSupabase
} from './supabaseClient';
import LoginCadastro from './components/LoginCadastro';
import CalendarioJogos from './components/CalendarioJogos';
import ConfirmacaoPresenca from './components/ConfirmacaoPresenca';
import ListaCadastrados from './components/ListaCadastrados';
import ControlePagamentos from './components/ControlePagamentos';
import ControleCaixa from './components/ControleCaixa';
import PainelAdmin from './components/PainelAdmin';
import ConfiguracaoSystem from './components/ConfiguracaoSystem';
import MensalistasMes from './components/MensalistasMes';
import HistoricoJogos from './components/HistoricoJogos';
import { mesclarPartidasAutomáticas } from './utils/partidaHelper';
import logoPelada from './assets/images/logo_pelada_batista_1780453160575.png';
import { Calendar, Users, DollarSign, ShieldAlert, LogOut, Database, Award, User, Settings, UserCheck, History, CheckSquare, Check, X, Lock, Cake, TrendingUp } from 'lucide-react';

export default function App() {
  // Carregar estados iniciais do banco local simulado
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [partidasDeletadas, setPartidasDeletadas] = useState<string[]>([]);
  const partidasMescladas = useMemo(() => {
    const list = mesclarPartidasAutomáticas(partidas);
    return list.filter(p => !partidasDeletadas.includes(p.id));
  }, [partidas, partidasDeletadas]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  
  // Controle de Sessão de Usuário
  const [jogadorAtual, setJogadorAtual] = useState<Jogador | null>(null);

  // Configuração de Preço Editável para Mensalidade e Diárias
  const [valor4Sabados, setValor4Sabados] = useState<number>(() => {
    const saved = localStorage.getItem('racha_valor_4s');
    return saved ? parseFloat(saved) : 85;
  });
  const [valor5Sabados, setValor5Sabados] = useState<number>(() => {
    const saved = localStorage.getItem('racha_valor_5s');
    return saved ? parseFloat(saved) : 105;
  });
  const [valorDiaria, setValorDiaria] = useState<number>(() => {
    const saved = localStorage.getItem('racha_valor_diaria');
    return saved ? parseFloat(saved) : 30;
  });

  // Configurações do Bot de WhatsApp
  const [whatsappGrupoLink, setWhatsappGrupoLink] = useState<string>(() => {
    return localStorage.getItem('racha_whatsapp_grupo_link') || 'https://chat.whatsapp.com/HQ7pT22dZloB3aL8vNqX1r';
  });

  const [whatsappAutomacaoAtiva, setWhatsappAutomacaoAtiva] = useState<boolean>(() => {
    const saved = localStorage.getItem('racha_whatsapp_automacao_ativa');
    return saved ? saved === 'true' : true;
  });

  const [whatsappWebhookUrl, setWhatsappWebhookUrl] = useState<string>(() => {
    return localStorage.getItem('racha_whatsapp_webhook_url') || '';
  });

  const [whatsappWebhookToken, setWhatsappWebhookToken] = useState<string>(() => {
    return localStorage.getItem('racha_whatsapp_webhook_token') || '';
  });

  const [whatsappLogs, setWhatsappLogs] = useState<any[]>(() => {
    const saved = localStorage.getItem('racha_whatsapp_logs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [
      {
        id: 'log-1',
        data: new Date().toLocaleString('pt-BR'),
        atleta: 'Sistema Automação',
        partida: 'Pelada Arena Record',
        mensagem: '🤖 Bot do WhatsApp carregado e monitorando confirmações no portal.',
        status: 'sucesso'
      }
    ];
  });

  const handleUpdateWhatsappConfig = (link: string, ativa: boolean, webhookUrl: string = '', token: string = '') => {
    setWhatsappGrupoLink(link);
    setWhatsappAutomacaoAtiva(ativa);
    setWhatsappWebhookUrl(webhookUrl);
    setWhatsappWebhookToken(token);
    localStorage.setItem('racha_whatsapp_grupo_link', link);
    localStorage.setItem('racha_whatsapp_automacao_ativa', ativa.toString());
    localStorage.setItem('racha_whatsapp_webhook_url', webhookUrl);
    localStorage.setItem('racha_whatsapp_webhook_token', token);
  };

  // Estados de Controle de Caixa e Lançamentos
  const [lancamentos, setLancamentos] = useState<LancamentoAvulso[]>(() => {
    return getSavedLancamentos();
  });
  const [aluguelCampoBase, setAluguelCampoBase] = useState<number>(() => {
    return getSavedAluguelCampo();
  });

  const handleAddLancamento = (novo: Omit<LancamentoAvulso, 'id'>) => {
    const lCompleto: LancamentoAvulso = {
      ...novo,
      id: 'lanc-' + Date.now() + '-' + Math.floor(Math.random() * 1000)
    };
    const novos = [lCompleto, ...lancamentos];
    setLancamentos(novos);
    saveLancamentos(novos);
  };

  const handleRemoveLancamento = (id: string) => {
    const novos = lancamentos.filter(l => l.id !== id);
    setLancamentos(novos);
    saveLancamentos(novos);
  };

  const handleUpdateAluguelCampoBase = (valor: number) => {
    setAluguelCampoBase(valor);
    saveAluguelCampo(valor);
  };

  const handleRegistrarLogAutomacao = (atletaNome: string, partidaTitulo: string, msg: string) => {
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const novoLog = {
      id: logId,
      data: new Date().toLocaleString('pt-BR'),
      atleta: atletaNome,
      partida: partidaTitulo,
      mensagem: msg,
      status: 'sucesso' as const
    };

    setWhatsappLogs(currentLogs => {
      const logsAtualizados = [novoLog, ...currentLogs].slice(0, 50);
      localStorage.setItem('racha_whatsapp_logs', JSON.stringify(logsAtualizados));
      return logsAtualizados;
    });

    // Se a automação de WhatsApp estiver ativa e com webhook preenchido, dispara a requisição real
    if (whatsappAutomacaoAtiva && whatsappWebhookUrl) {
      setTimeout(async () => {
        try {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          if (whatsappWebhookToken) {
            headers['Authorization'] = whatsappWebhookToken.startsWith('Bearer ') 
              ? whatsappWebhookToken 
              : `Bearer ${whatsappWebhookToken}`;
          }

          const response = await fetch(whatsappWebhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({
              message: msg,
              groupLink: whatsappGrupoLink,
              grupo: 'Pelada Batista Sábado',
              atleta: atletaNome,
              partida: partidaTitulo,
              timestamp: new Date().toISOString()
            })
          });

          if (!response.ok) {
            const respTxt = await response.text().catch(() => '');
            const falhaMsg = `[FALHA DISPARO] Status ${response.status} - ${respTxt.substring(0, 80)}`;
            setWhatsappLogs(currentLogs => {
              const logsAtualizados = currentLogs.map(l => 
                l.id === logId ? { ...l, status: 'falha' as const, mensagem: `${l.mensagem} | ⚠️ ${falhaMsg}` } : l
              );
              localStorage.setItem('racha_whatsapp_logs', JSON.stringify(logsAtualizados));
              return logsAtualizados;
            });
          }
        } catch (error: any) {
          const falhaMsg = `[FALHA CONEXÃO] ${error.message || error}`;
          setWhatsappLogs(currentLogs => {
            const logsAtualizados = currentLogs.map(l => 
              l.id === logId ? { ...l, status: 'falha' as const, mensagem: `${l.mensagem} | ⚠️ ${falhaMsg}` } : l
            );
            localStorage.setItem('racha_whatsapp_logs', JSON.stringify(logsAtualizados));
            return logsAtualizados;
          });
        }
      }, 50);
    }
  };

  const handleClearWhatsappLogs = () => {
    setWhatsappLogs([]);
    localStorage.removeItem('racha_whatsapp_logs');
  };

  const handleSendTestAlert = () => {
    handleRegistrarLogAutomacao(
      'Automação (Teste)',
      'Todas as Peladas',
      '📢 [ALERTA DE TESTE]: Disparo de teste bem-sucedido via painel de controle!'
    );
  };

  const handleUpdateValoresConfig = (v4: number, v5: number, vDiaria: number) => {
    setValor4Sabados(v4);
    setValor5Sabados(v5);
    setValorDiaria(vDiaria);
    localStorage.setItem('racha_valor_4s', v4.toString());
    localStorage.setItem('racha_valor_5s', v5.toString());
    localStorage.setItem('racha_valor_diaria', vDiaria.toString());
  };

  // Estados para Modal de Edição de Perfil
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false);
  const [perfilNome, setPerfilNome] = useState('');
  const [perfilSobrenome, setPerfilSobrenome] = useState('');
  const [perfilPosicao, setPerfilPosicao] = useState<PosicaoJogador>('Meio');
  const [perfilMembroStatus, setPerfilMembroStatus] = useState<MembroStatus>('mensalista');
  const [perfilFoto, setPerfilFoto] = useState('');
  const [perfilDataNascimento, setPerfilDataNascimento] = useState('');
  const [perfilSenha, setPerfilSenha] = useState('');
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);

  // Navegação de Abas
  const [activeTab, setActiveTab] = useState<'calendario' | 'confirmacao' | 'elenco' | 'financeiro' | 'caixa' | 'mensalistas' | 'historico' | 'admin' | 'db'>('calendario');
  const [partidaSelecionadaId, setPartidaSelecionadaId] = useState<string | null>(null);

  // Carregar todos os dados (live Supabase com fallback Offline)
  const fetchTodoDados = async () => {
    // Carregar primeiro as deletadas locais para feedback instantâneo
    const localDeletadasStr = localStorage.getItem('futebol_partidas_deletadas');
    if (localDeletadasStr) {
      try {
        setPartidasDeletadas(JSON.parse(localDeletadasStr));
      } catch (e) {
        console.error(e);
      }
    }

    const isLive = !!getSupabase();
    if (isLive) {
      try {
        const dbJogadores = await carregarJogadoresDoSupabase();
        if (dbJogadores) {
          setJogadores(dbJogadores);
          saveJogadores(dbJogadores);
        } else {
          setJogadores(getSavedJogadores());
        }

        const dbPartidas = await carregarPartidasDoSupabase();
        if (dbPartidas) {
          setPartidas(dbPartidas);
          savePartidas(dbPartidas);
        } else {
          setPartidas(getSavedPartidas());
        }

        const dbPagamentos = await carregarPagamentosDoSupabase();
        if (dbPagamentos) {
          setPagamentos(dbPagamentos);
          savePagamentos(dbPagamentos);
        } else {
          setPagamentos(getSavedPagamentos());
        }

        // Carregar configurações de partidas excluídas da nuvem
        const dbDeletadasStr = await obterConfiguracaoDoSupabase('partidas_excluidas');
        if (dbDeletadasStr) {
          try {
            const parsed = JSON.parse(dbDeletadasStr);
            setPartidasDeletadas(parsed);
            localStorage.setItem('futebol_partidas_deletadas', dbDeletadasStr);
          } catch (e) {
            console.error(e);
          }
        }
      } catch (err) {
        console.warn('Erro ao ler dados do Supabase. Usando local:', err);
        setJogadores(getSavedJogadores());
        setPartidas(getSavedPartidas());
        setPagamentos(getSavedPagamentos());
      }
    } else {
      setJogadores(getSavedJogadores());
      setPartidas(getSavedPartidas());
      setPagamentos(getSavedPagamentos());
    }
  };

  // Carregar dados na primeira renderização
  useEffect(() => {
    fetchTodoDados();

    // Auto-login do admin para excelente experiência de primeira utilização
    const savedSession = localStorage.getItem('arena_user_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession) as Jogador;
      // Validar se o jogador ainda existe no banco
      const baseJogadores = getSavedJogadores();
      const match = baseJogadores.find(j => j.id === parsed.id && j.status === 'ativo');
      if (match) {
        setJogadorAtual(match);
      } else {
        localStorage.removeItem('arena_user_session');
      }
    }
  }, []);

  const handleLoginSuccess = (jogador: Jogador) => {
    setJogadorAtual(jogador);
    localStorage.setItem('arena_user_session', JSON.stringify(jogador));
    setActiveTab('calendario');
  };

  const handleLogout = () => {
    setJogadorAtual(null);
    localStorage.removeItem('arena_user_session');
  };

  // ----- OPERAÇÕES DE TABELAS (MUTANTES DE ESTADO COM PERSISTÊNCIA) -----

  // 1. Cadastro Solicitado por jogador (status 'pendente_aprovacao')
  const handleRegistrarJogador = async (novo: Omit<Jogador, 'id' | 'status' | 'role' | 'createdAt'>) => {
    const novoJogador: Jogador = {
      ...novo,
      id: `jog-${Date.now()}`,
      status: 'pendente_aprovacao',
      role: 'jogador',
      createdAt: new Date().toISOString(),
    };
    
    const atualizados = [...jogadores, novoJogador];
    setJogadores(atualizados);
    saveJogadores(atualizados);

    await salvarJogadorNoSupabase(novoJogador);
  };

  // 2. Aprovar / Recusar cadastro pendente (Ação administrativa)
  const handleAprovarJogador = async (id: string, aprovar: boolean) => {
    let atualizados: Jogador[];
    let modificado: Jogador | null = null;

    if (aprovar) {
      atualizados = jogadores.map(j => {
        if (j.id === id) {
          modificado = { ...j, status: 'ativo' as const };
          return modificado;
        }
        return j;
      });
    } else {
      atualizados = jogadores.filter(j => j.id !== id);
    }
    
    setJogadores(atualizados);
    saveJogadores(atualizados);

    if (modificado) {
      await salvarJogadorNoSupabase(modificado);
    } else if (!aprovar) {
      const supabase = getSupabase();
      if (supabase) {
        await supabase.from('jogadores').delete().eq('id', id);
      }
    }
  };

  // 3. Excluir Atleta do elenco (Ação de administração ou auto-exclusão do jogador)
  const handleExcluirJogador = async (id: string) => {
    const atualizados = jogadores.filter(j => j.id !== id);
    setJogadores(atualizados);
    saveJogadores(atualizados);

    const supabase = getSupabase();
    if (supabase) {
      await supabase.from('jogadores').delete().eq('id', id);
    }

    if (jogadorAtual && jogadorAtual.id === id) {
      handleLogout();
    }
  };

  // 4. Editar Informações Básicas do Atleta (Ação administrativa)
  const handleEditarJogador = async (id: string, camposAtualizados: Partial<Jogador>) => {
    let modificado: Jogador | null = null;
    const atualizados = jogadores.map(j => {
      if (j.id === id) {
        modificado = { ...j, ...camposAtualizados };
        return modificado;
      }
      return j;
    });
    setJogadores(atualizados);
    saveJogadores(atualizados);

    if (modificado) {
      await salvarJogadorNoSupabase(modificado);
    }

    // Atualizar sessão corrente caso tenha editado o próprio perfil
    if (jogadorAtual && jogadorAtual.id === id) {
      const sessaoAtualizada = { ...jogadorAtual, ...camposAtualizados };
      setJogadorAtual(sessaoAtualizada);
      localStorage.setItem('arena_user_session', JSON.stringify(sessaoAtualizada));
    }
  };

  const checkJanelaRenovacaoGeral = () => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth();

    const inicio = new Date(ano, mes, 1, 0, 1, 0, 0);
    while (inicio.getDay() !== 1) {
      inicio.setDate(inicio.getDate() + 1);
    }

    const partidasDoMes = (partidas || []).filter(p => {
      if (!p.data) return false;
      const [pAno, pMes] = p.data.split('-').map(Number);
      return pAno === ano && pMes === (mes + 1);
    });

    const sortedPartidas = [...partidasDoMes].sort((a, b) => a.data.localeCompare(b.data));

    let primeiroJogoDataStr = '';
    let dataReferenciaJogo: Date;

    if (sortedPartidas.length > 0) {
      primeiroJogoDataStr = sortedPartidas[0].data;
      const [y, m, d] = primeiroJogoDataStr.split('-').map(Number);
      dataReferenciaJogo = new Date(y, m - 1, d, 23, 59, 59);
    } else {
      const sab = new Date(ano, mes, 1, 23, 59, 59);
      while (sab.getDay() !== 6) {
        sab.setDate(sab.getDate() + 1);
      }
      dataReferenciaJogo = sab;
      primeiroJogoDataStr = `${sab.getFullYear()}-${(sab.getMonth() + 1).toString().padStart(2, '0')}-${sab.getDate().toString().padStart(2, '0')}`;
    }

    const diaSemanaJogo = dataReferenciaJogo.getDay();
    const diffParaSexta = 5 - diaSemanaJogo;
    const fim = new Date(dataReferenciaJogo);
    fim.setDate(fim.getDate() + diffParaSexta);
    fim.setHours(23, 59, 59, 999);

    const estaAberta = agora >= inicio && agora <= fim;

    return {
      estaAberta,
      inicio,
      fim,
      primeiroJogo: primeiroJogoDataStr
    };
  };

  const abrirModalPerfil = () => {
    if (!jogadorAtual) return;
    setPerfilNome(jogadorAtual.nome);
    setPerfilSobrenome(jogadorAtual.sobrenome);
    setPerfilPosicao(jogadorAtual.posicao);
    setPerfilMembroStatus(jogadorAtual.membroStatus);
    setPerfilFoto(jogadorAtual.foto || '');
    setPerfilDataNascimento(jogadorAtual.dataNascimento || '');
    setPerfilSenha(jogadorAtual.senha || '');
    setModalPerfilAberto(true);
  };

  const handleSalvarPerfilProprio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jogadorAtual) return;

    if (perfilSenha.length !== 4 || isNaN(Number(perfilSenha))) {
      alert('O PIN de segurança deve possuir exatamente 4 dígitos numéricos.');
      return;
    }

    const camposAtualizados = {
      nome: perfilNome,
      sobrenome: perfilSobrenome,
      posicao: perfilPosicao,
      membroStatus: perfilMembroStatus,
      foto: perfilFoto,
      dataNascimento: perfilDataNascimento,
      senha: perfilSenha,
    };

    await handleEditarJogador(jogadorAtual.id, camposAtualizados);
    setModalPerfilAberto(false);
    setShowConfirmacaoModal(true);
  };

  // 5. Agendar Nova Partida no Calendário (Ação administrativa)
  const handleCriarPartida = async (novaPartida: Omit<Partida, 'id' | 'confirmados' | 'recusados' | 'createdAt'>) => {
    const partidaCompleta: Partida = {
      ...novaPartida,
      id: `part-${Date.now()}`,
      confirmados: [],
      recusados: [],
      createdAt: new Date().toISOString(),
    };

    const atualizadas = [...partidas, partidaCompleta];
    setPartidas(atualizadas);
    savePartidas(atualizadas);

    await salvarPartidaNoSupabase(partidaCompleta);
  };

  // Deletar Partida no Calendário / Histórico (Ação administrativa)
  const handleDeletarPartida = async (id: string) => {
    try {
      // 1. Adicionar o ID à lista de partidas ocultas/deletadas para sumir imediatamente do UI
      const novasDeletadas = [...partidasDeletadas];
      if (!novasDeletadas.includes(id)) {
        novasDeletadas.push(id);
      }
      setPartidasDeletadas(novasDeletadas);
      localStorage.setItem('futebol_partidas_deletadas', JSON.stringify(novasDeletadas));

      // 2. Filtrar e remover se for uma partida persistida no banco local/remoto as well
      const atualizadas = partidas.filter(p => p.id !== id);
      setPartidas(atualizadas);
      savePartidas(atualizadas);

      // 3. Salvar esta exclusão no Supabase se houver conexão ativa de forma assíncrona tolerante a falhas
      if (getSupabase()) {
        salvarConfiguracaoNoSupabase('partidas_excluidas', JSON.stringify(novasDeletadas))
          .catch(err => console.error('Erro ao sincronizar partidos excluídos no Supabase:', err));
        
        deletarPartidaNoSupabase(id)
          .catch(err => console.error('Erro ao deletar partida específica no Supabase:', err));
      }
    } catch (error) {
      console.error('Erro geral ao executar handleDeletarPartida:', error);
    }
  };


  // 6. Confirmar ou Recusar Presença em Jogo (Ação de qualquer Jogador para si mesmo, lidando com Sábados Virtuais)
  const handleActualizarPresenca = async (partidaId: string, jogadorId: string, confirmado: boolean | null) => {
    let modificado: Partida | null = null;
    let partidaExistente = partidas.find(p => p.id === partidaId);

    // Se for virtual do sábado, inicializar com os dados padrões para salvar no banco
    if (!partidaExistente && partidaId.startsWith('sat-')) {
      const dataString = partidaId.replace('sat-', '');
      partidaExistente = {
        id: partidaId,
        titulo: 'Pelada Arena Record Oficial',
        data: dataString,
        horario: '08:00 às 10:00',
        local: 'Campo do Meio do Colégio Batista - Tijuca',
        confirmados: [],
        recusados: [],
        criadoPor: 'sistema',
        createdAt: new Date().toISOString()
      };
    }

    let novasPartidas: Partida[] = [];

    if (partidaExistente) {
      let confirmados = [...partidaExistente.confirmados];
      let recusados = [...partidaExistente.recusados];

      // Limpar registros anteriores do jogador para evitar duplo estado
      confirmados = confirmados.filter(id => id !== jogadorId);
      recusados = recusados.filter(id => id !== jogadorId);

      if (confirmado === true) {
        confirmados.push(jogadorId);
      } else if (confirmado === false) {
        recusados.push(jogadorId);
      }

      modificado = { ...partidaExistente, confirmados, recusados };

      if (partidas.some(p => p.id === partidaId)) {
        novasPartidas = partidas.map(p => p.id === partidaId ? modificado! : p);
      } else {
        novasPartidas = [...partidas, modificado];
      }
    } else {
      novasPartidas = partidas;
    }

    setPartidas(novasPartidas);
    savePartidas(novasPartidas);

    if (modificado) {
      await salvarPartidaNoSupabase(modificado);
    }
  };

  // 6.2. Cancelar/Reativar Partida (Ação administrativa de fortuito)
  const handleCancelarPartida = async (partidaId: string, cancelar: boolean) => {
    let modificado: Partida | null = null;
    let partidaExistente = partidas.find(p => p.id === partidaId);

    // Se for virtual do sábado, inicializar com os dados padrões antes de salvar no banco
    if (!partidaExistente && partidaId.startsWith('sat-')) {
      const dataString = partidaId.replace('sat-', '');
      partidaExistente = {
        id: partidaId,
        titulo: 'Pelada Arena Record Oficial',
        data: dataString,
        horario: '08:00 às 10:00',
        local: 'Campo do Meio do Colégio Batista - Tijuca',
        confirmados: [],
        recusados: [],
        criadoPor: 'sistema',
        createdAt: new Date().toISOString()
      };
    }

    let novasPartidas: Partida[] = [];

    if (partidaExistente) {
      modificado = { ...partidaExistente, cancelada: cancelar };

      if (partidas.some(p => p.id === partidaId)) {
        novasPartidas = partidas.map(p => p.id === partidaId ? modificado! : p);
      } else {
        novasPartidas = [...partidas, modificado];
      }
    } else {
      novasPartidas = partidas;
    }

    setPartidas(novasPartidas);
    savePartidas(novasPartidas);

    if (modificado) {
      await salvarPartidaNoSupabase(modificado);
    }
  };

  // 7. Lançar ou alterar status de pagamento (Ação Administrativa)
  const handleRegistrarPagamento = async (
    jogadorId: string,
    mesRef: string,
    status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado',
    dataPagamento: string | null,
    valor: number,
    partidaId?: string
  ) => {
    const existe = partidaId 
      ? pagamentos.some(p => p.jogadorId === jogadorId && p.partidaId === partidaId)
      : pagamentos.some(p => p.jogadorId === jogadorId && p.mesRef === mesRef && !p.partidaId);
    
    let atualizados: Pagamento[];
    let pagModificado: Pagamento;

    if (existe) {
      atualizados = pagamentos.map(p => {
        const condicao = partidaId
          ? p.jogadorId === jogadorId && p.partidaId === partidaId
          : p.jogadorId === jogadorId && p.mesRef === mesRef && !p.partidaId;
        
        if (condicao) {
          pagModificado = { ...p, status, dataPagamento, valor };
          return pagModificado;
        }
        return p;
      });
    } else {
      pagModificado = {
        id: `pag-${Date.now()}`,
        jogadorId,
        mesRef,
        status,
        dataPagamento,
        valor,
        partidaId,
      };
      atualizados = [...pagamentos, pagModificado];
    }

    setPagamentos(atualizados);
    savePagamentos(atualizados);

    if (pagModificado!) {
      await salvarPagamentoNoSupabase(pagModificado);
    }
  };

  // Auxiliares Visuais de Estilo
  const getSessaoAvatarProps = (fotoId: string) => {
    return AVATAR_PRESETS.find(p => p.id === fotoId) || AVATAR_PRESETS[0];
  };

  return (
    <div className="min-h-screen bg-emerald-950 text-slate-50 flex flex-col font-sans selection:bg-emerald-600 selection:text-white relative">
      
      {/* Visual de linhas do campo de futebol em marca d'água de alta fidelidade */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-emerald-950 to-emerald-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] border-b border-l border-r border-white/5 rounded-b-[150px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/5 rounded-full pointer-events-none" />

      {/* HEADER PRINCIPAL */}
      <header className="bg-emerald-900/40 border-b border-white/10 backdrop-blur-md sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo / Emblema da Arena */}
          <div className="flex items-center gap-3">
            <img 
              src={logoPelada} 
              alt="Pelada Batista Logo" 
              className="w-12 h-12 object-cover rounded-full shadow-md ring-2 ring-white/10" 
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-lg font-display font-extrabold tracking-tight text-white flex items-center gap-1.5">
                PELADA BATISTA SÁBADO
              </h1>
              <p className="text-[10px] text-emerald-400 font-mono tracking-widest uppercase">Futebol, Resenha e Cerveja</p>
            </div>
          </div>

          {/* Dados do Usuário Logado & Logout */}
          {jogadorAtual && (
            <div className="flex items-center justify-between sm:justify-end gap-3.5 bg-emerald-950/60 p-2 rounded-lg border border-white/10">
              
              <div 
                id="header-perfil-edit-trigger"
                onClick={abrirModalPerfil}
                className="flex items-center gap-2.5 cursor-pointer hover:bg-white/5 hover:border-white/20 px-2 py-1 rounded-lg transition-all border border-transparent select-none active:scale-97"
                title="Clique aqui para editar seu perfil"
              >
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-inner overflow-hidden"
                  style={{ backgroundColor: getSessaoAvatarProps(jogadorAtual.foto).color, color: getSessaoAvatarProps(jogadorAtual.foto).text === '⚪' ? '#fff' : '#000' }}
                >
                  {jogadorAtual.foto && (jogadorAtual.foto.startsWith('http') || jogadorAtual.foto.startsWith('data:')) ? (
                    <img src={jogadorAtual.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                  ) : (
                    jogadorAtual.posicao.substring(0, 1)
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1">
                    <span id="nome-usuario-logado" className="text-xs font-bold text-white hover:text-teal-300 transition-colors leading-none decoration-dotted hover:underline underline-offset-2">{jogadorAtual.nome} {jogadorAtual.sobrenome}</span>
                    {jogadorAtual.role === 'admin' ? (
                      <span className="text-[8px] bg-amber-500 text-black px-1 font-extrabold rounded">ADM</span>
                    ) : (
                      <span className="text-[8px] bg-white/10 text-emerald-300 px-1 font-bold rounded">JOG</span>
                    )}
                  </div>
                  <p className="text-[9px] text-emerald-400/80 font-sans tracking-wide mt-0.5">{jogadorAtual.posicao} • Encontro {jogadorAtual.membroStatus}</p>
                </div>
              </div>

              <div className="border-l border-white/10 h-6 mx-0.5" />

              <button
                id="btn-header-logout"
                type="button"
                onClick={handleLogout}
                className="p-1.5 rounded-md hover:bg-white/10 text-emerald-300 hover:text-rose-400 transition-colors"
                title="Sair do Portal"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ÁREA DE CONTEÚDO PRINCIPAL COM LAYOUT FLEX ADAPTÁVEL PARA CELULAR (flex-col) E DESKTOP (flex-row) */}
      <div className={`flex-grow w-full max-w-7xl mx-auto flex flex-col md:flex-row items-start p-3 sm:p-4 md:p-6 gap-4 sm:gap-5 md:gap-6 relative z-10`}>
        
        {/* MENU NAVEGAÇÃO HORIZONTAL NO CELULAR / VERTICAL NO DESKTOP (Somente se autenticado) */}
        {jogadorAtual && (
          <aside className="w-full md:w-64 shrink-0 p-2 md:p-4 rounded-2xl bg-emerald-900/25 border border-white/10 md:sticky md:top-24 gap-1.5 md:gap-2 flex flex-row md:flex-col overflow-x-auto md:overflow-visible shadow-xl backdrop-blur-md select-none whitespace-nowrap [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            <div className="hidden md:block px-3.5 pb-2 border-b border-white/5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono shrink-0">
              Menu de Acesso
            </div>

            <button
              id="tab-calendario"
              type="button"
              onClick={() => setActiveTab('calendario')}
              className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                activeTab === 'calendario' 
                  ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
              }`}
              title="Calendário de Jogos"
            >
              <Calendar className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap text-left">Calendário</span>
            </button>

            <button
              id="tab-confirmacao"
              type="button"
              onClick={() => setActiveTab('confirmacao')}
              className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                activeTab === 'confirmacao' 
                  ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
              }`}
              title="Lista de Confirmação"
            >
              <CheckSquare className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap text-left">Presenças</span>
            </button>

            <button
              id="tab-elenco"
              type="button"
              onClick={() => setActiveTab('elenco')}
              className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                activeTab === 'elenco' 
                  ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
              }`}
              title="Elenco Cadastrado"
            >
              <Users className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap text-left">Elenco</span>
            </button>

            <button
              id="tab-financeiro"
              type="button"
              onClick={() => setActiveTab('financeiro')}
              className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                activeTab === 'financeiro' 
                  ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
              }`}
              title="Pagamentos"
            >
              <DollarSign className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap text-left">Pagamentos</span>
            </button>

            <button
              id="tab-mensalistas"
              type="button"
              onClick={() => setActiveTab('mensalistas')}
              className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                activeTab === 'mensalistas' 
                  ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
              }`}
              title="Mensalistas do Mês"
            >
              <UserCheck className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap text-left">Mensalistas</span>
            </button>

            <button
              id="tab-historico"
              type="button"
              onClick={() => setActiveTab('historico')}
              className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                activeTab === 'historico' 
                  ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                  : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
              }`}
              title="Histórico de Jogos"
            >
              <History className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
              <span className="whitespace-nowrap text-left">Histórico</span>
            </button>

            {jogadorAtual.role === 'admin' && (
              <button
                id="tab-caixa"
                type="button"
                onClick={() => setActiveTab('caixa')}
                className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                  activeTab === 'caixa' 
                    ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                    : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
                }`}
                title="Controle de Caixa"
              >
                <TrendingUp className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap text-left">Caixa</span>
              </button>
            )}

            {jogadorAtual.role === 'admin' && (
              <button
                id="tab-admin"
                type="button"
                onClick={() => setActiveTab('admin')}
                className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                  activeTab === 'admin' 
                    ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                    : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
                }`}
                title="Painel de Aprovações"
              >
                <Award className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap text-left">Aprovações</span>
              </button>
            )}

            {jogadorAtual.role === 'admin' && (
              <button
                id="tab-configuracao"
                type="button"
                onClick={() => setActiveTab('configuracao')}
                className={`py-2 md:py-3 px-3 md:px-4 text-xs font-bold transition-all relative flex items-center justify-center md:justify-start gap-2.5 rounded-xl border-l-2 md:border-l-4 shrink-0 leading-none ${
                  activeTab === 'configuracao' 
                    ? 'text-white font-extrabold bg-white/10 border-teal-400 pl-3' 
                    : 'text-emerald-300 hover:text-white hover:bg-white/5 border-transparent'
                }`}
                title="Configuração do Sistema"
              >
                <Settings className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap text-left">Sua Conta / PIX</span>
              </button>
            )}

          </aside>
        )}

        {/* ÁREA DE CONTEÚDO PRINCIPAL */}
        <main className="flex-grow w-full min-w-0">
          
          {jogadorAtual ? (
            /* MULTI-VIEW COM NAVEGAÇÃO */
            <div className="w-full">
              {activeTab === 'calendario' && (
                <CalendarioJogos
                  partidas={partidasMescladas}
                  jogadores={jogadores}
                  pagamentos={pagamentos}
                  jogadorAtual={jogadorAtual}
                  onSelectPartidaForConfirmation={setPartidaSelecionadaId}
                  onNavigateToTab={setActiveTab}
                  onCriarPartida={handleCriarPartida}
                  onDeletarPartida={handleDeletarPartida}
                  onActualizarPresenca={handleActualizarPresenca}
                />
              )}

              {activeTab === 'confirmacao' && (
                <ConfirmacaoPresenca
                  partidas={partidasMescladas}
                  jogadores={jogadores}
                  jogadorAtual={jogadorAtual}
                  partidaSelecionadaId={partidaSelecionadaId}
                  setPartidaSelecionadaId={setPartidaSelecionadaId}
                  onActualizarPresenca={handleActualizarPresenca}
                  onExcluirJogador={handleExcluirJogador}
                  onEditarJogador={handleEditarJogador}
                  pagamentos={pagamentos}
                  whatsappAutomacaoAtiva={whatsappAutomacaoAtiva}
                  whatsappGrupoLink={whatsappGrupoLink}
                  onRegistrarLogAutomacao={handleRegistrarLogAutomacao}
                  onCancelarPartida={handleCancelarPartida}
                />
              )}

              {activeTab === 'elenco' && (
                <ListaCadastrados
                  jogadores={jogadores}
                  partidas={partidasMescladas}
                  jogadorAtual={jogadorAtual}
                  onExcluirJogador={handleExcluirJogador}
                  onEditarJogador={handleEditarJogador}
                />
              )}

              {activeTab === 'financeiro' && (
                <ControlePagamentos
                  pagamentos={pagamentos}
                  jogadores={jogadores}
                  jogadorAtual={jogadorAtual}
                  onRegistrarPagamento={handleRegistrarPagamento}
                  valor4Sabados={valor4Sabados}
                  valor5Sabados={valor5Sabados}
                  valorDiaria={valorDiaria}
                  onUpdateValoresConfig={handleUpdateValoresConfig}
                  partidas={partidasMescladas}
                />
              )}

              {activeTab === 'caixa' && jogadorAtual.role === 'admin' && (
                <ControleCaixa
                  partidas={partidasMescladas}
                  jogadores={jogadores}
                  pagamentos={pagamentos}
                  lancamentos={lancamentos}
                  onAddLancamento={handleAddLancamento}
                  onRemoveLancamento={handleRemoveLancamento}
                  aluguelCampoBase={aluguelCampoBase}
                  onUpdateAluguelCampoBase={handleUpdateAluguelCampoBase}
                  valorDiaria={valorDiaria}
                  valor4Sabados={valor4Sabados}
                  valor5Sabados={valor5Sabados}
                  onRegistrarPagamento={handleRegistrarPagamento}
                  jogadorAtual={jogadorAtual}
                />
              )}

              {activeTab === 'mensalistas' && (
                <MensalistasMes
                  jogadores={jogadores}
                  pagamentos={pagamentos}
                  jogadorAtual={jogadorAtual}
                  onRegistrarPagamento={handleRegistrarPagamento}
                  valor4Sabados={valor4Sabados}
                  valor5Sabados={valor5Sabados}
                />
              )}

              {activeTab === 'historico' && (
                <HistoricoJogos
                  partidas={partidasMescladas}
                  jogadores={jogadores}
                  jogadorAtual={jogadorAtual}
                  onDeletarPartida={handleDeletarPartida}
                />
              )}

              {activeTab === 'admin' && jogadorAtual.role === 'admin' && (
                <PainelAdmin
                  jogadores={jogadores}
                  partidas={partidasMescladas}
                  jogadorAtual={jogadorAtual}
                  onAprovarJogador={handleAprovarJogador}
                />
              )}

              {activeTab === 'configuracao' && jogadorAtual.role === 'admin' && (
                <ConfiguracaoSystem
                  onConfigUpdated={fetchTodoDados}
                  whatsappGrupoLink={whatsappGrupoLink}
                  whatsappAutomacaoAtiva={whatsappAutomacaoAtiva}
                  whatsappWebhookUrl={whatsappWebhookUrl}
                  whatsappWebhookToken={whatsappWebhookToken}
                  onUpdateWhatsappConfig={handleUpdateWhatsappConfig}
                  whatsappLogs={whatsappLogs}
                  onClearLogs={handleClearWhatsappLogs}
                  onSendTestAlert={handleSendTestAlert}
                  valor4Sabados={valor4Sabados}
                  valor5Sabados={valor5Sabados}
                  valorDiaria={valorDiaria}
                  onUpdateValoresConfig={handleUpdateValoresConfig}
                />
              )}
            </div>
          ) : (
            /* LOGIN / CADASTRO DE ACESSO */
            <LoginCadastro
              jogadores={jogadores}
              onLoginSuccess={handleLoginSuccess}
              onRegistrar={handleRegistrarJogador}
            />
          )}

        </main>
      </div>

      {/* FOOTER */}
      <footer className="bg-emerald-950/60 border-t border-white/10 py-5 px-4 text-center text-[10px] text-emerald-400/70 tracking-wider font-mono">
        <div>
          PELADA BATISTA SÁBADO - PLATAFORMA DE GERENCIAMENTO DA PELADA - TODOS OS DIREITOS RESERVADOS - Desenvolvido por Leonardo Navarro
        </div>
      </footer>

      {/* POPUP DE CONFIRMAÇÃO DE ALTERAÇÃO SALVA */}
      {showConfirmacaoModal && (
        <div 
          id="confirmacao-sucesso-popup"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-emerald-900 border border-emerald-500/35 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-scale-up">
            <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">Alterações Salvas!</h3>
            <p className="text-xs text-emerald-200 leading-relaxed mb-6">
              Seu perfil foi atualizado com sucesso. Dados persistidos localmente e sincronizados no Supabase.
            </p>
            <button
              id="btn-confirmar-edicao-entendido"
              type="button"
              onClick={() => setShowConfirmacaoModal(false)}
              className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs"
            >
              Excelente!
            </button>
          </div>
        </div>
      )}

      {/* MODAL / POPUP DE EDIÇÃO COMPLETA DO PERFIL JOGADOR */}
      {modalPerfilAberto && jogadorAtual && (
        <div 
          id="modal-editar-perfil-atual"
          className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="bg-emerald-900 border border-white/10 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-teal-400">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base text-white">Editar Perfil Atleta</h3>
                  <p className="text-[10px] text-emerald-300">Atualize suas informações gerais de acesso</p>
                </div>
              </div>
              <button
                id="btn-close-modal-perfil"
                type="button"
                onClick={() => setModalPerfilAberto(false)}
                className="p-1 px-2 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-xs flex items-center gap-1 font-bold"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário de Configurações */}
            <form onSubmit={handleSalvarPerfilProprio} className="space-y-4">
              
              {/* Nome e Sobrenome */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Nome</label>
                  <input
                    type="text"
                    required
                    value={perfilNome}
                    onChange={(e) => setPerfilNome(e.target.value)}
                    className="w-full bg-emerald-955 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder-emerald-750 focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Sobrenome</label>
                  <input
                    type="text"
                    required
                    value={perfilSobrenome}
                    onChange={(e) => setPerfilSobrenome(e.target.value)}
                    className="w-full bg-emerald-955 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white placeholder-emerald-750 focus:outline-none"
                  />
                </div>
              </div>

              {/* Posição e Status de Membro */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Posição de Jogo</label>
                  <select
                    value={perfilPosicao}
                    onChange={(e) => {
                      const newPos = e.target.value as PosicaoJogador;
                      setPerfilPosicao(newPos);
                      if (newPos === 'Goleiro') {
                        setPerfilMembroStatus('isento');
                      } else if (perfilMembroStatus === 'isento') {
                        setPerfilMembroStatus('mensalista');
                      }
                    }}
                    className="w-full bg-emerald-955 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                  >
                    <option className="bg-emerald-955 text-white" value="Goleiro">Goleiro 🧤</option>
                    <option className="bg-emerald-955 text-white" value="Defesa">Defesa 🛡️</option>
                    <option className="bg-emerald-955 text-white" value="Meio">Meio Campo 🧠</option>
                    <option className="bg-emerald-955 text-white" value="Ataque">Ataque 🚀</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Plano de Participação</label>
                  <select
                    value={perfilMembroStatus}
                    onChange={(e) => setPerfilMembroStatus(e.target.value as MembroStatus)}
                    disabled={jogadorAtual.role !== 'admin' && !checkJanelaRenovacaoGeral().estaAberta && perfilPosicao !== 'Goleiro'}
                    className="w-full bg-emerald-955 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {perfilPosicao === 'Goleiro' ? (
                      <option className="bg-emerald-955 text-white" value="isento">Isento</option>
                    ) : (
                      <>
                        <option className="bg-emerald-955 text-white" value="mensalista">Mensalista - R$50</option>
                        <option className="bg-emerald-955 text-white" value="diarista">Diarista - R$15/jogo</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Mensagem informativa sobre plano se bloqueado */}
              {jogadorAtual.role !== 'admin' && !checkJanelaRenovacaoGeral().estaAberta && (
                <div className="bg-black/20 border border-rose-500/20 p-2 rounded-xl text-[9px] text-rose-350 leading-relaxed font-sans">
                  * Alteração de plano (Status Membro) indisponível fora do período de renovação mensal estabelecido.
                </div>
              )}

              {/* Data Aniversário e PIN de Segurança */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="space-y-1 min-w-0 w-full">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                    <Cake className="w-3 h-3 text-teal-400" />
                    Data Nascimento
                  </label>
                  <input
                    type="date"
                    required
                    value={perfilDataNascimento}
                    onChange={(e) => setPerfilDataNascimento(e.target.value)}
                    className="w-full min-w-0 bg-emerald-955 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-white/20"
                  />
                </div>
                
                <div className="space-y-1 min-w-0 w-full">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1">
                    <Lock className="w-3 h-3 text-teal-400" />
                    PIN (4 Dígitos)
                  </label>
                  <input
                    type="text"
                    maxLength={4}
                    required
                    pattern="\d{4}"
                    placeholder="Ex: 1234"
                    value={perfilSenha}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      setPerfilSenha(val);
                    }}
                    className="w-full min-w-0 bg-emerald-955 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white text-center font-mono focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>

              {/* Foto do Atleta (URL/Base64/Preset) */}
              <div className="space-y-2 bg-black/20 p-3 rounded-xl border border-white/5">
                <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">Avatar / Imagem de Perfil</p>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="profile-avatar-file-upload"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          if (typeof reader.result === 'string') {
                            setPerfilFoto(reader.result);
                          }
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="profile-avatar-file-upload"
                    className="px-3 py-1.5 bg-emerald-950 hover:bg-emerald-900 border border-white/10 rounded-xl text-xs text-white cursor-pointer transition-all select-none whitespace-nowrap active:scale-97 font-bold"
                  >
                    Enviar Foto
                  </label>
                  <input
                    type="text"
                    placeholder="Ou cola uma URL da imagem"
                    value={perfilFoto.startsWith('data:') ? '' : perfilFoto}
                    onChange={(e) => setPerfilFoto(e.target.value)}
                    className="w-full bg-emerald-955 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  />
                </div>
                {perfilFoto && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[9px] text-emerald-400">Prévia do Avatar selecionado:</span>
                    <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10 shrink-0">
                      <img 
                        src={perfilFoto} 
                        className="w-full h-full object-cover" 
                        alt="Preview" 
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100';
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botões Operacionais */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 shrink-0">
                <button
                  id="btn-close-edit-perfil-modal"
                  type="button"
                  onClick={() => setModalPerfilAberto(false)}
                  className="bg-emerald-950 border border-white/10 text-emerald-300 hover:text-white px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-97"
                >
                  Cancelar
                </button>
                <button
                  id="btn-save-edit-perfil-modal"
                  type="submit"
                  className="bg-white hover:bg-emerald-100 text-black px-5 py-2 rounded-xl text-xs font-bold transition-all active:scale-97 shadow-md flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar Alterações
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
