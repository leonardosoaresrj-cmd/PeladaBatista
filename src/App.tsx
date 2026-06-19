/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Jogador, Partida, Pagamento, PosicaoJogador, MembroStatus, LancamentoAvulso, BotLog } from './types';
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
  salvarConfiguracaoNoSupabase,
  carregarBotLogsDoSupabase,
  limparBotLogsDoSupabase,
  atualizarStatusPresencaUsuario
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
import { isJogadorFuncionalmenteGold } from './utils/goldRules';
import { obterTextoListaCompletaPartida, obterTextoListaRenovacao, obterStatusMembroEfetivo, obterDebitosDoJogador, obterTextoPartidaCancelada, obterJanelaRenovacaoParaMesRef, isFechamentoMensalistas } from './utils/confirmationRules';
import logoPelada from './assets/images/logo_pelada.svg';
import { Calendar, Users, DollarSign, ShieldAlert, LogOut, Database, Award, User, Settings, UserCheck, History, CheckSquare, Check, X, Lock, Cake, TrendingUp, UserPlus, AlertCircle } from 'lucide-react';

export default function App() {
  // Carregar estados iniciais do banco local simulado
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [partidasDeletadas, setPartidasDeletadas] = useState<string[]>([]);
  const partidasMescladas = useMemo(() => {
    const list = mesclarPartidasAutomáticas(partidas);
    return list.filter(p => !partidasDeletadas.includes(p.id));
  }, [partidas, partidasDeletadas]);

  const proximaPartida = useMemo(() => {
    if (!partidasMescladas || partidasMescladas.length === 0) return null;
    const filtradas = partidasMescladas.filter(p => !p.cancelada && p.data >= '2026-05-31');
    return filtradas.sort((a, b) => a.data.localeCompare(b.data))[0] || partidasMescladas[0];
  }, [partidasMescladas]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  
  // Controle de Sessão de Usuário
  const [jogadorAtual, setJogadorAtual] = useState<Jogador | null>(null);
  const [showSessaoExpiradaModal, setShowSessaoExpiradaModal] = useState(false);

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

  const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);

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

  const handleUpdateLancamento = (atualizado: LancamentoAvulso) => {
    const novos = lancamentos.map(l => l.id === atualizado.id ? atualizado : l);
    setLancamentos(novos);
    saveLancamentos(novos);
  };

  const handleLimparDadosDoMes = async (mesRef: string) => {
    // 1. Filtrar pagamentos que não pertencem ao mesRef
    const novosPagamentos = pagamentos.filter(p => p.mesRef !== mesRef);
    setPagamentos(novosPagamentos);
    savePagamentos(novosPagamentos);

    const supabase = getSupabase();

    // 2. Apagar do Supabase todos os pagamentos daquele mês
    try {
      if (supabase) {
        await supabase
          .from('pagamentos')
          .delete()
          .eq('mes_ref', mesRef);
      }
    } catch (e) {
      console.error('Erro ao deletar pagamentos do Supabase:', e);
    }

    // 3. Filtrar lançamentos avulsos que pertencem àquele mês
    const novosLancamentos = lancamentos.filter(l => !l.data || !l.data.startsWith(mesRef));
    setLancamentos(novosLancamentos);
    saveLancamentos(novosLancamentos);

    // 4. Detetar partidas do mês (reais e sábados automáticos) e apagá-las/ocultá-las
    try {
      // Filtrar partidas reais guardadas que começam com o mesRef
      const partidasDoMesReais = partidas.filter(p => p.data && p.data.startsWith(mesRef));
      const partidasDoMesReaisIds = partidasDoMesReais.map(p => p.id);

      // Calcular sábados automáticos desse mês para adicionar a lista de deletadas
      const sabadosDoMesIds: string[] = [];
      const parts = mesRef.split('-');
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]);

      for (let day = 1; day <= 31; day++) {
        const date = new Date(year, month - 1, day, 12, 0, 0);
        if (date.getMonth() === month - 1 && date.getDay() === 6) {
          const yyyy = date.getFullYear();
          const mm = String(date.getMonth() + 1).padStart(2, '0');
          const dd = String(date.getDate()).padStart(2, '0');
          sabadosDoMesIds.push(`sat-${yyyy}-${mm}-${dd}`);
        }
      }

      // Combinar os IDs de exclusão (reais e virtuais/automáticos)
      const todosIdsParaDeletar = Array.from(new Set([...partidasDoMesReaisIds, ...sabadosDoMesIds]));

      // Atualizar partidasDeletadas no estado e localstorage
      const novasDeletadas = [...partidasDeletadas];
      todosIdsParaDeletar.forEach(id => {
        if (!novasDeletadas.includes(id)) {
          novasDeletadas.push(id);
        }
      });
      setPartidasDeletadas(novasDeletadas);
      localStorage.setItem('futebol_partidas_deletadas', JSON.stringify(novasDeletadas));

      // Atualizar partidas reais excluindo as deletadas
      const novasPartidas = partidas.filter(p => !partidasDoMesReaisIds.includes(p.id));
      setPartidas(novasPartidas);
      savePartidas(novasPartidas);

      // Sincronizar exclusão de partidas reais e de configuração de deletadas no Supabase
      if (supabase) {
        salvarConfiguracaoNoSupabase('partidas_excluidas', JSON.stringify(novasDeletadas))
          .catch(err => console.error('Erro ao salvar partidas deletadas adicionais em config do Supabase:', err));

        for (const realId of partidasDoMesReaisIds) {
          deletarPartidaNoSupabase(realId)
            .catch(err => console.error('Erro ao deletar partida real no Supabase:', err));
        }
      }
    } catch (err) {
      console.error('Erro ao deletar histórico/partidas do mês:', err);
    }
  };

  const handleResetDatabase = async (startingMonth: string) => {
    // 1. Limpar partidas, pagamentos, despesas avulsas
    setPartidas([]);
    savePartidas([]);

    setPagamentos([]);
    savePagamentos([]);

    setLancamentos([]);
    saveLancamentos([]);

    setPartidasDeletadas([]);
    localStorage.setItem('futebol_partidas_deletadas', JSON.stringify([]));

    // 2. Limpar cadastros de jogadores mantendo o administrador Leonardo Soares ativo
    const adminEmail = 'leonardo.soares.rj@gmail.com';
    const list = getSavedJogadores();
    const adminOriginal = list.filter(j => j.email.toLowerCase().trim() === adminEmail);
    setJogadores(adminOriginal);
    saveJogadores(adminOriginal);

    // 3. Atualizar configurações de início de recebimento
    localStorage.setItem('futebol_startup_month', startingMonth);

    // 4. Limpar do Supabase se estiver conectado
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('partidas').delete().neq('id', 'placeholder-doesnotexist');
        await supabase.from('pagamentos').delete().neq('id', 'placeholder-doesnotexist');
        await supabase.from('lancamentos').delete().neq('id', 'placeholder-doesnotexist');
        await supabase.from('jogadores').delete().neq('email', adminEmail);
      } catch (e) {
        console.error('Erro ao limpar tabelas no Supabase:', e);
      }
    }

    // 5. Recarregar dados para garantir sincronismo
    fetchTodoDados();
  };

  const handleUpdateAluguelCampoBase = (valor: number) => {
    const currentMonthStr = '2026-06';
    const oldVal = aluguelCampoBase;

    // Preservar valores antigos no mapa para não alterar o faturamento histórico
    const mapStr = localStorage.getItem('futebol_aluguel_mensal_map');
    let map: Record<string, number> = {};
    if (mapStr) {
      try {
        map = JSON.parse(mapStr);
      } catch (e) {
        console.error(e);
      }
    }

    // Se Maio/2026 e Junho/2026 não estiverem definidos, assegure-se de que fiquem com o valor antigo
    if (map['2026-05'] === undefined) map['2026-05'] = oldVal;
    if (map['2026-06'] === undefined) map['2026-06'] = oldVal;

    if (!localStorage.getItem('futebol_aluguel_campo_prior')) {
      localStorage.setItem('futebol_aluguel_campo_prior', String(oldVal));
    }

    // Atualizar os meses futuros (Julho de 2026 em diante)
    const futureMonths = ['2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'];
    for (const m of futureMonths) {
      map[m] = valor;
    }

    localStorage.setItem('futebol_aluguel_mensal_map', JSON.stringify(map));

    setAluguelCampoBase(valor);
    saveAluguelCampo(valor);
  };

  const handleRegistrarLogAutomacao = async (atletaNome: string, partidaTitulo: string, msg: string) => {
    // Insere o evento de teste inicial
    const logId = `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const novoLog: BotLog = {
      id: logId,
      tabela: atletaNome,
      evento: 'TESTE_PAINEL',
      mensagem: msg,
      enviado_em: new Date().toISOString()
    };
    
    // Atualização otimista apenas da UI temporária, o real load vem do supabase
    setWhatsappLogs(currentLogs => [novoLog, ...currentLogs].slice(0, 50));
    
    const supabase = getSupabase();
    if (supabase) {
       await supabase.from('bot_logs').insert(novoLog);
    }

    if (whatsappAutomacaoAtiva && whatsappWebhookUrl) {
      setTimeout(async () => {
        try {
          const response = await fetch('/api/bot-proxy', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: whatsappWebhookUrl,
              secret: whatsappWebhookToken,
              payload: {
                mensagem: msg,
                grupo_id: whatsappGrupoLink
              }
            })
          });

          if (!response.ok) {
            const respTxt = await response.text().catch(() => '');
            const falhaMsg = `[FALHA DISPARO] Status ${response.status} - ${respTxt.substring(0, 80)}`;
            if (supabase) {
               await supabase.from('bot_logs').insert({
                 tabela: atletaNome,
                 evento: 'FALHA_DISPARO',
                 mensagem: `${msg} | ⚠️ ${falhaMsg}`,
                 enviado_em: new Date().toISOString()
               });
            }
          }
        } catch (error: any) {
          const falhaMsg = `[FALHA CONEXÃO] ${error.message || error}`;
          if (supabase) {
             await supabase.from('bot_logs').insert({
               tabela: atletaNome,
               evento: 'FALHA_CONEXAO',
               mensagem: `${msg} | ⚠️ ${falhaMsg}`,
               enviado_em: new Date().toISOString()
             });
          }
        }
        
        // Recarregar os logs reais da base para manter consistência
        if (supabase) {
           const bLogs = await carregarBotLogsDoSupabase();
           if (bLogs) setWhatsappLogs(bLogs as any[]);
        }
      }, 50);
    }
  };

  const handleClearWhatsappLogs = async () => {
    setWhatsappLogs([]);
    await limparBotLogsDoSupabase();
  };

  const handleSendTestAlert = (msg?: string) => {
    handleRegistrarLogAutomacao(
      'Automação (Teste)',
      'Teste Painel',
      msg || '📢 [ALERTA DE TESTE]: Disparo de teste bem-sucedido via painel de controle!'
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
  const [alertaRenovacaoPlano, setAlertaRenovacaoPlano] = useState<{aberto: boolean, inicio: string, fim: string, tipo?: 'diarista_para_mensalista' | 'comum'} | null>(null);
  const [perfilFoto, setPerfilFoto] = useState('');
  const [perfilDataNascimento, setPerfilDataNascimento] = useState('');
  const [perfilSenha, setPerfilSenha] = useState('');
  const [showConfirmacaoModal, setShowConfirmacaoModal] = useState(false);

  // Navegação de Abas
  const [activeTab, setActiveTab] = useState<'calendario' | 'confirmacao' | 'elenco' | 'financeiro' | 'caixa' | 'mensalistas' | 'historico' | 'admin' | 'db'>('calendario');
  const [partidaSelecionadaId, setPartidaSelecionadaId] = useState<string | null>(null);

  // Estados de alertas pós-login (caso haja pendências financeiras)
  const [mostrarPopUpAlertaMensalista, setMostrarPopUpAlertaMensalista] = useState(false);
  const [mostrarPopUpAlertaDiarista, setMostrarPopUpAlertaDiarista] = useState(false);
  const [diaristaDebitosParaAlerta, setDiaristaDebitosParaAlerta] = useState<any[]>([]);
  const [mostrarPopUpAlertaAdminAprovacoes, setMostrarPopUpAlertaAdminAprovacoes] = useState(false);
  const [fotoZoomada, setFotoZoomada] = useState<{ url: string; nome?: string } | null>(null);

  // Expor função de zoom globalmente para todos os subcomponentes poderem usá-la
  useEffect(() => {
    (window as any).ampliarFoto = (url: string, nome?: string) => {
      setFotoZoomada({ url, nome });
    };
    return () => {
      delete (window as any).ampliarFoto;
    };
  }, []);

  // Alerta de novos cadastros pendentes para o administrador após login
  useEffect(() => {
    if (jogadorAtual && jogadorAtual.role === 'admin') {
      const sessaoAlertaAdminChave = `alerta_admin_aprovacoes_mostrada_${jogadorAtual.id}`;
      const jaMostradoAdmin = sessionStorage.getItem(sessaoAlertaAdminChave);
      
      const pendentes = jogadores.filter(j => j.status === 'pendente_aprovacao');
      if (pendentes.length > 0 && !jaMostradoAdmin) {
        setMostrarPopUpAlertaAdminAprovacoes(true);
        sessionStorage.setItem(sessaoAlertaAdminChave, 'true');
      }
    } else {
      setMostrarPopUpAlertaAdminAprovacoes(false);
    }
  }, [jogadorAtual, jogadores]);

  // Helpers de status de membros dinâmicos/efetivos baseados em adimplência
  const jogadorAtualEfetivo = useMemo(() => {
    if (!jogadorAtual) return null;
    return {
      ...jogadorAtual,
      membroStatus: obterStatusMembroEfetivo(jogadorAtual, pagamentos),
      membroStatusDb: jogadorAtual.membroStatus,
      isGold: isJogadorFuncionalmenteGold(jogadorAtual, pagamentos)
    };
  }, [jogadorAtual, pagamentos]);

  const jogadoresEfetivos = useMemo(() => {
    return jogadores.map(j => ({
      ...j,
      membroStatus: obterStatusMembroEfetivo(j, pagamentos),
      membroStatusDb: j.membroStatus,
      isGoldDb: j.isGold,
      isGold: isJogadorFuncionalmenteGold(j, pagamentos)
    }));
  }, [jogadores, pagamentos]);

  useEffect(() => {
    if (jogadorAtual) {
      const sessaoAlertaChave = `alerta_login_mostrado_${jogadorAtual.id}`;
      const jaMostrado = sessionStorage.getItem(sessaoAlertaChave);
      
      if (!jaMostrado) {
        // Calcular débitos reais do jogador usando status original cadastrado para checar pendências
        const debs = obterDebitosDoJogador(
          jogadorAtual.id,
          jogadorAtual.membroStatus,
          jogadorAtual.posicao,
          partidasMescladas,
          pagamentos,
          valorDiaria,
          valor4Sabados,
          valor5Sabados
        );

        if (jogadorAtual.membroStatus === 'mensalista') {
          const temMensalidadePendente = debs.some(d => d.tipo === 'mensalidade' && d.status === 'pendente');
          if (temMensalidadePendente) {
            setMostrarPopUpAlertaMensalista(true);
            sessionStorage.setItem(sessaoAlertaChave, 'true');
          }
        } else if (jogadorAtual.membroStatus === 'diarista') {
          const debsDiarias = debs.filter(d => d.tipo === 'diaria' && d.status === 'pendente');
          if (debsDiarias.length > 0) {
            setDiaristaDebitosParaAlerta(debsDiarias);
            setMostrarPopUpAlertaDiarista(true);
            sessionStorage.setItem(sessaoAlertaChave, 'true');
          }
        }
      }
    } else {
      setMostrarPopUpAlertaMensalista(false);
      setMostrarPopUpAlertaDiarista(false);
      setDiaristaDebitosParaAlerta([]);
    }
  }, [jogadorAtual, pagamentos, partidasMescladas, valorDiaria, valor4Sabados, valor5Sabados]);


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

        // Carregar logs do bot
        const bLogs = await carregarBotLogsDoSupabase();
        if (bLogs) {
          setWhatsappLogs(bLogs as any[]);
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

    // Carrega sessao do sessionStorage (ou localStorage anterior caso exista para transição suave)
    const savedSession = sessionStorage.getItem('arena_user_session') || localStorage.getItem('arena_user_session');
    if (savedSession) {
      const parsed = JSON.parse(savedSession) as Jogador;
      // Validar se o jogador ainda existe no banco
      const baseJogadores = getSavedJogadores();
      const match = baseJogadores.find(j => j.id === parsed.id && j.status === 'ativo');
      if (match) {
        setJogadorAtual(match);
        // Migramos para sessionStorage para deslogar ao sair do app (fechar aba/desligar pc)
        sessionStorage.setItem('arena_user_session', JSON.stringify(match));
        localStorage.removeItem('arena_user_session');
      } else {
        sessionStorage.removeItem('arena_user_session');
        localStorage.removeItem('arena_user_session');
      }
    }
  }, []);

  // Alerta de Abertura de Renovação de Mensalidade
  useEffect(() => {
    if (!whatsappAutomacaoAtiva || jogadores.length === 0) return;

    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);

    if (ontem.getDay() === 6) {
      const proximoSabado = new Date(ontem);
      proximoSabado.setDate(ontem.getDate() + 7);

      // Se ontem foi o último sábado do seu respectivo mês:
      if (ontem.getMonth() !== proximoSabado.getMonth()) {
        const refAno = proximoSabado.getFullYear();
        const refMesString = String(proximoSabado.getMonth() + 1).padStart(2, '0');
        const mesRef = `${refAno}-${refMesString}`;

        const key = `renew_alert_sent_${mesRef}`;
        if (!localStorage.getItem(key)) {
          const msgCompleta = obterTextoListaRenovacao(mesRef, jogadores, pagamentos);
          handleRegistrarLogAutomacao(
            'Sistema', 
            `Abertura Renovação ${mesRef}`, 
            msgCompleta
          );
          localStorage.setItem(key, 'true');
        }
      }
    }
  }, [jogadores, pagamentos, whatsappAutomacaoAtiva]);

  const handleLoginSuccess = (jogador: Jogador) => {
    setJogadorAtual(jogador);
    sessionStorage.setItem('arena_user_session', JSON.stringify(jogador));
    localStorage.removeItem('arena_user_session'); // Maior segurança limpando do local
    setActiveTab('calendario');
  };

  const performLogout = () => {
    setJogadorAtual(null);
    sessionStorage.removeItem('arena_user_session');
    localStorage.removeItem('arena_user_session');
  };

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    performLogout();
    setShowLogoutConfirm(false);
  };

  const handleCancelLogout = () => {
    setShowLogoutConfirm(false);
  };

  // Controle de inatividade e logout automático após 5 minutos (300.000 ms)
  useEffect(() => {
    if (!jogadorAtual) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      
      timeoutId = setTimeout(() => {
        // Deslogar automaticamente por inatividade de 5 minutos
        performLogout();
        setShowSessaoExpiradaModal(true);
      }, 5 * 60 * 1000); // 5 minutos
    };

    // Eventos comuns de interação com a página para renovar o tempo
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    
    events.forEach(event => {
      window.addEventListener(event, resetTimer, { passive: true });
    });

    // Inicia o contador
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [jogadorAtual]);

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
      performLogout();
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
      sessionStorage.setItem('arena_user_session', JSON.stringify(sessaoAtualizada));
    }
  };

  const checkJanelaRenovacaoGeral = () => {
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
        titulo: 'Pelada Batista Sábado',
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
      await atualizarStatusPresencaUsuario(partidaId, jogadorId, confirmado);
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
        titulo: 'Pelada Batista Sábado',
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
      
      if (whatsappAutomacaoAtiva && cancelar) {
        const msgCancelamento = obterTextoPartidaCancelada(modificado);
        handleRegistrarLogAutomacao('Administrador', 'Cancelamento de Jogo', msgCancelamento);
      }
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

      // Removed automatic WhatsApp WhatsApp group logging as per user request
    }
  };

  const handleRegistrarVariosPagamentos = async (
    jogadorId: string,
    items: Array<{
      mesRef: string;
      status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado';
      dataPagamento: string | null;
      valor: number;
      partidaId?: string;
    }>
  ) => {
    let atualizados = [...pagamentos];
    const modificados: Pagamento[] = [];

    for (const item of items) {
      const existeIndex = item.partidaId
        ? atualizados.findIndex(p => p.jogadorId === jogadorId && p.partidaId === item.partidaId)
        : atualizados.findIndex(p => p.jogadorId === jogadorId && p.mesRef === item.mesRef && !p.partidaId);

      let pagModificado: Pagamento;
      if (existeIndex >= 0) {
        pagModificado = {
          ...atualizados[existeIndex],
          status: item.status,
          dataPagamento: item.dataPagamento,
          valor: item.valor
        };
        atualizados[existeIndex] = pagModificado;
      } else {
        pagModificado = {
          id: `pag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          jogadorId,
          mesRef: item.mesRef,
          status: item.status,
          dataPagamento: item.dataPagamento,
          valor: item.valor,
          partidaId: item.partidaId
        };
        atualizados.push(pagModificado);
      }
      modificados.push(pagModificado);
    }

    setPagamentos(atualizados);
    savePagamentos(atualizados);

    for (const pag of modificados) {
      await salvarPagamentoNoSupabase(pag);
    }
  };

  // Auxiliares Visuais de Estilo
  const getSessaoAvatarProps = (fotoId: string) => {
    return AVATAR_PRESETS.find(p => p.id === fotoId) || AVATAR_PRESETS[0];
  };

  return (
    <div className="min-h-screen max-w-full overflow-x-hidden bg-emerald-950 text-slate-50 flex flex-col font-sans selection:bg-emerald-600 selection:text-white relative">
      
      {/* Visual de linhas do campo de futebol em marca d'água de alta fidelidade */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/40 via-emerald-950 to-emerald-950 pointer-events-none" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] h-[300px] border-b border-l border-r border-white/5 rounded-b-[150px] pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 border-2 border-white/5 rounded-full pointer-events-none" />

      {/* HEADER PRINCIPAL */}
      <header className="bg-emerald-900/40 border-b border-white/10 backdrop-blur-md sticky top-0 z-30 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          
          {/* Logo / Emblema da Arena */}
          <div className="flex items-center gap-3">
            <img 
              src={logoPelada} 
              alt="Pelada Batista Logo" 
              className="w-14 h-14 object-contain drop-shadow-xl" 
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
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-inner overflow-hidden cursor-zoom-in hover:scale-110 active:scale-95 transition-all duration-200"
                style={{ backgroundColor: getSessaoAvatarProps(jogadorAtual.foto).color, color: getSessaoAvatarProps(jogadorAtual.foto).text === '⚪' ? '#fff' : '#000' }}
                onClick={() => {
                  if (jogadorAtual.foto && (jogadorAtual.foto.startsWith('http') || jogadorAtual.foto.startsWith('data:'))) {
                    setFotoZoomada({ url: jogadorAtual.foto, nome: `${jogadorAtual.nome} ${jogadorAtual.sobrenome}` });
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

              <div 
                id="header-perfil-edit-trigger"
                onClick={abrirModalPerfil}
                className="flex flex-col cursor-pointer hover:bg-white/5 hover:border-white/20 px-2 py-1 rounded-lg transition-all border border-transparent select-none active:scale-97"
                title="Clique aqui para editar seu perfil"
              >
                <div>
                  <div className="flex items-center gap-1">
                    <span id="nome-usuario-logado" className="text-xs font-bold text-white hover:text-teal-300 transition-colors leading-none decoration-dotted hover:underline underline-offset-2">{jogadorAtual.nome} {jogadorAtual.sobrenome}</span>
                    {jogadorAtualEfetivo?.isGold && (
                      <span className="text-[9px] bg-gradient-to-r from-amber-400 to-yellow-600 text-black px-1 py-0.5 font-extrabold rounded shadow-sm shadow-amber-500/20 whitespace-nowrap">GOLD 🏅</span>
                    )}
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
                onClick={handleLogoutClick}
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
          <aside className="w-full md:w-64 shrink-0 p-2 md:p-4 rounded-2xl bg-emerald-900/25 border border-white/10 md:sticky md:top-24 gap-1.5 md:gap-2 flex flex-row flex-wrap md:flex-col shadow-xl backdrop-blur-md select-none justify-center md:justify-start">
            
            <div className="hidden md:block px-3.5 pb-2 border-b border-white/5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest font-mono shrink-0 w-full">
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
              <span className="whitespace-nowrap text-left">Confirmação</span>
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
              <span className="whitespace-nowrap text-left">Participantes</span>
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
                title="Finanças Gerais"
              >
                <TrendingUp className="w-4.5 h-4.5 text-emerald-400 shrink-0" />
                <span className="whitespace-nowrap text-left">Finanças</span>
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
                <span className="whitespace-nowrap text-left">Configuração</span>
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
                  jogadores={jogadoresEfetivos}
                  pagamentos={pagamentos}
                  jogadorAtual={jogadorAtualEfetivo}
                  onSelectPartidaForConfirmation={setPartidaSelecionadaId}
                  onNavigateToTab={setActiveTab}
                  onCriarPartida={handleCriarPartida}
                  onDeletarPartida={handleDeletarPartida}
                  onCancelarPartida={handleCancelarPartida}
                  onActualizarPresenca={handleActualizarPresenca}
                  onRegistrarPagamento={handleRegistrarPagamento}
                />
              )}

              {activeTab === 'confirmacao' && (
                <ConfirmacaoPresenca
                  partidas={partidasMescladas}
                  jogadores={jogadoresEfetivos}
                  jogadorAtual={jogadorAtualEfetivo}
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
                  onRegistrarPagamento={handleRegistrarPagamento}
                />
              )}

              {activeTab === 'elenco' && (
                <ListaCadastrados
                  jogadores={jogadoresEfetivos}
                  partidas={partidasMescladas}
                  jogadorAtual={jogadorAtual}
                  pagamentos={pagamentos}
                  onExcluirJogador={handleExcluirJogador}
                  onEditarJogador={handleEditarJogador}
                  proximaPartida={proximaPartida}
                  onActualizarPresenca={handleActualizarPresenca}
                  whatsappAutomacaoAtiva={whatsappAutomacaoAtiva}
                />
              )}

              {activeTab === 'financeiro' && (
                <ControlePagamentos
                  pagamentos={pagamentos}
                  jogadores={jogadoresEfetivos}
                  jogadorAtual={jogadorAtual}
                  onRegistrarPagamento={handleRegistrarPagamento}
                  onRegistrarVariosPagamentos={handleRegistrarVariosPagamentos}
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
                  jogadores={jogadoresEfetivos}
                  pagamentos={pagamentos}
                  lancamentos={lancamentos}
                  onAddLancamento={handleAddLancamento}
                  onRemoveLancamento={handleRemoveLancamento}
                  onUpdateLancamento={handleUpdateLancamento}
                  aluguelCampoBase={aluguelCampoBase}
                  onUpdateAluguelCampoBase={handleUpdateAluguelCampoBase}
                  valorDiaria={valorDiaria}
                  valor4Sabados={valor4Sabados}
                  valor5Sabados={valor5Sabados}
                  onRegistrarPagamento={handleRegistrarPagamento}
                  jogadorAtual={jogadorAtual}
                  onLimparDadosDoMes={handleLimparDadosDoMes}
                />
              )}

              {activeTab === 'mensalistas' && (
                <MensalistasMes
                  jogadores={jogadoresEfetivos}
                  pagamentos={pagamentos}
                  jogadorAtual={jogadorAtual}
                  onRegistrarPagamento={handleRegistrarPagamento}
                  valor4Sabados={valor4Sabados}
                  valor5Sabados={valor5Sabados}
                  whatsappAutomacaoAtiva={whatsappAutomacaoAtiva}
                  onRegistrarLogAutomacao={handleRegistrarLogAutomacao}
                />
              )}

              {activeTab === 'historico' && (
                <HistoricoJogos
                  partidas={partidasMescladas}
                  jogadores={jogadoresEfetivos}
                  jogadorAtual={jogadorAtualEfetivo}
                  onDeletarPartida={handleDeletarPartida}
                />
              )}

              {activeTab === 'admin' && jogadorAtual.role === 'admin' && (
                <PainelAdmin
                  jogadores={jogadoresEfetivos}
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
                  onResetDatabase={handleResetDatabase}
                />
              )}
            </div>
          ) : (
            /* LOGIN / CADASTRO DE ACESSO */
            <LoginCadastro
              jogadores={jogadoresEfetivos}
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

      {/* POPUP DE EXPIRAÇÃO DE SESSÃO POR INATIVIDADE */}
      {showSessaoExpiradaModal && (
        <div 
          id="popup-sessao-expirada"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in text-white font-sans"
        >
          <div className="bg-emerald-950 border border-teal-500/30 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-scale-up">
            <div className="w-16 h-16 bg-teal-500/10 border-2 border-teal-500 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 animate-pulse" />
            </div>
            <h3 className="font-display font-black text-sm uppercase tracking-widest text-teal-400 mb-2">🚨 Sessão Finalizada</h3>
            <p className="text-xs text-emerald-200/90 leading-relaxed mb-6 font-sans">
              Você foi desconectado automaticamente por motivos de segurança após <b>5 minutos de inatividade</b>. Por favor, faça login novamente para continuar.
            </p>
            <button
              id="btn-sessao-expirada-entendido"
              type="button"
              onClick={() => setShowSessaoExpiradaModal(false)}
              className="w-full bg-teal-500 hover:bg-teal-400 text-emerald-950 font-black py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs uppercase"
            >
              Fazer Login Novamente
            </button>
          </div>
        </div>
      )}

      {/* POPUP DE ALERTA DE DÉBITO MENSALISTA APÓS LOGIN */}
      {mostrarPopUpAlertaMensalista && jogadorAtual && (
        <div 
          id="popup-alerta-mensalidade-pendente"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-emerald-950 border border-amber-500/30 rounded-2xl max-w-md w-full p-6 text-left shadow-2xl relative animate-scale-up">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3.5 mb-4">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-black text-sm uppercase tracking-wide text-amber-200">Aviso importante de pendência</h3>
                <p className="text-[10px] text-emerald-400/80 font-mono">Competência Financeira Pendente</p>
              </div>
            </div>
            
            <p className="text-xs text-emerald-250 leading-relaxed font-sans mb-4">
              Olá, <b className="text-white">{jogadorAtual.nome}</b>. Identificamos que você possui uma <b>mensalidade em aberto ou pendente de confirmação</b>.
            </p>
            
            <div className="bg-amber-955/25 border border-amber-500/20 rounded-xl p-3 mb-5 text-[11px] text-amber-200 leading-relaxed font-sans">
              <b>⚠️ Regulamento de Mensalistas:</b> No Pelada Batista Sábado, atletas com pendências financeiras de mensalidade passam temporariamente para o status de <b>Diarista</b> até a devida regularização do débito. Desse modo, você perde temporariamente a prioridade automática de mensalistas na lista de chamada oficial.
            </div>

            <div className="flex gap-2.5">
              <button
                id="btn-popup-quitar-mensalidade"
                type="button"
                onClick={() => {
                  setMostrarPopUpAlertaMensalista(false);
                  setActiveTab('financeiro');
                }}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-extrabold py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                Quitar Mensalidade
              </button>
              <button
                id="btn-popup-entendi-mensalidade"
                type="button"
                onClick={() => setMostrarPopUpAlertaMensalista(false)}
                className="py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-emerald-300 hover:text-white transition-all text-xs cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE ALERTA DE DÉBITO DIARISTA APÓS LOGIN */}
      {mostrarPopUpAlertaDiarista && jogadorAtual && (
        <div 
          id="popup-alerta-diaria-pendente"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-emerald-955 border border-rose-500/30 rounded-2xl max-w-md w-full p-6 text-left shadow-2xl relative animate-scale-up">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3.5 mb-4">
              <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="font-display font-black text-sm uppercase tracking-wide text-rose-300">Alerta de Diária Pendente</h3>
                <p className="text-[10px] text-rose-400/80 font-mono">Diaristas com pendências financeiras</p>
              </div>
            </div>
            
            <p className="text-xs text-emerald-250 leading-relaxed font-sans mb-3.5">
              Olá, <b className="text-white">{jogadorAtual.nome}</b>. Constam <b>diárias pendentes de pagamento</b> vinculadas ao seu perfil de atleta avulso:
            </p>

            <div className="space-y-2 mb-4 max-h-[140px] overflow-y-auto pr-1">
              {diaristaDebitosParaAlerta.map((deb, idx) => {
                // Formatar data: "yyyy-mm-dd" para "dd/mm"
                let dataFormatada = 'Diária';
                if (deb.dataRef) {
                  const pts = deb.dataRef.split('-');
                  if (pts.length >= 3) {
                    dataFormatada = `${pts[2]}/${pts[1]}`;
                  }
                }
                return (
                  <div key={idx} className="flex justify-between items-center bg-black/25 border border-white/5 rounded-xl px-3.5 py-2 text-xs">
                    <span className="font-semibold text-emerald-300">📅 Partida de {dataFormatada}</span>
                    <span className="font-mono font-bold text-rose-400">R$ {deb.valor.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-rose-950/40 border border-rose-500/20 rounded-xl p-3 mb-5 text-[10px] text-rose-300 leading-relaxed font-sans">
              <b>⚠️ Regra de Confirmação:</b> Atletas diaristas com pendências financeiras estão impedidos de confirmar presença em novos jogos até a quitação do saldo pendente.
            </div>

            <div className="flex gap-2.5">
              <button
                id="btn-popup-quitar-diaria"
                type="button"
                onClick={() => {
                  setMostrarPopUpAlertaDiarista(false);
                  setActiveTab('financeiro');
                }}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-extrabold py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <DollarSign className="w-4 h-4" />
                Quitar Débito
              </button>
              <button
                id="btn-popup-fechar-diaria"
                type="button"
                onClick={() => setMostrarPopUpAlertaDiarista(false)}
                className="py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-emerald-300 hover:text-white transition-all text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE ALERTA DE NOVOS CADASTROS PENDENTES PARA O ADMIN APÓS LOGIN */}
      {mostrarPopUpAlertaAdminAprovacoes && jogadorAtual && jogadorAtual.role === 'admin' && (
        <div 
          id="popup-alerta-admin-aprovacoes"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-emerald-950 border border-teal-500/30 rounded-2xl max-w-lg w-full p-6 text-left shadow-2xl relative animate-scale-up max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3.5 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-teal-500/10 border border-teal-500/30 text-teal-400 rounded-xl flex items-center justify-center shrink-0">
                  <UserPlus className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-display font-black text-sm uppercase tracking-wide text-teal-300">Novos Cadastros Pendentes</h3>
                  <p className="text-[10px] text-emerald-400/80 font-mono">Solicitações de entrada aguardando aprovação</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMostrarPopUpAlertaAdminAprovacoes(false)}
                className="text-emerald-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-emerald-200 leading-relaxed font-sans mb-4 shrink-0">
              Olá, Administrador <b>{jogadorAtual.nome}</b>. Identificamos novos atletas aguardando liberação de acesso para participar da nossa lista de jogos:
            </p>
            
            <div className="flex-grow overflow-y-auto space-y-3 pr-1 mb-5 select-none scrollbar-thin">
              {jogadores.filter(j => j.status === 'pendente_aprovacao').map((j) => (
                <div 
                  key={j.id} 
                  className="p-3.5 bg-emerald-900/40 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all hover:bg-emerald-900/60"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 shadow-inner overflow-hidden text-black font-sans"
                      style={{ 
                        backgroundColor: getSessaoAvatarProps ? getSessaoAvatarProps(j.foto || '').color : '#10b981',
                        color: getSessaoAvatarProps && getSessaoAvatarProps(j.foto || '').text === '⚪' ? '#fff' : '#000'
                      }}
                    >
                      {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
                        <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="" referrerPolicy="no-referrer" />
                      ) : (
                        j.nome.substring(0, 1).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate leading-tight">{j.nome} {j.sobrenome}</p>
                      <p className="text-[10px] text-emerald-300/80 mt-0.5 font-sans flex flex-wrap items-center gap-1.5 leading-none">
                        <span className="bg-emerald-950 text-emerald-400 px-1.5 py-0.5 rounded font-bold">{j.posicao}</span>
                        <span>•</span>
                        <span>{j.mensalistaStatus === 'mensalista' ? '🟢 Mensalista' : j.mensalistaStatus === 'isento' ? '⭐ Isento' : '🔵 Diarista'}</span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleAprovarJogador(j.id, true)}
                      className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-emerald-950 font-black text-[10px] uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aprovar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAprovarJogador(j.id, false)}
                      className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 border border-rose-500/30 hover:border-transparent text-rose-300 hover:text-white font-bold text-[10px] uppercase rounded-lg transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                  </div>
                </div>
              ))}
              {jogadores.filter(j => j.status === 'pendente_aprovacao').length === 0 && (
                <div className="text-center py-6 text-emerald-400/60 italic text-xs">
                  Todos os cadastros pendentes já foram processados!
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-white/10 pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setMostrarPopUpAlertaAdminAprovacoes(false);
                  setActiveTab('admin');
                }}
                className="flex-1 bg-white hover:bg-emerald-100 text-black font-extrabold py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                Painel Completo de Aprovações
              </button>
              <button
                type="button"
                onClick={() => setMostrarPopUpAlertaAdminAprovacoes(false)}
                className="py-2.5 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-emerald-300 hover:text-white transition-all text-xs cursor-pointer"
              >
                Fechar
              </button>
            </div>
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-base text-white">Editar Perfil Atleta</h3>
                    {jogadorAtualEfetivo?.isGold && (
                      <span className="text-[10px] bg-gradient-to-r from-amber-400 to-yellow-600 text-black px-1.5 py-0.5 font-extrabold rounded shadow-sm shadow-amber-500/20 whitespace-nowrap">GOLD 🏅</span>
                    )}
                  </div>
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
                    className="w-full bg-emerald-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none"
                    style={{ backgroundColor: '#064e3b' }}
                  >
                    <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="Goleiro">Goleiro 🧤</option>
                    <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="Defesa">Defesa 🛡️</option>
                    <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="Meio">Meio Campo 🧠</option>
                    <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="Ataque">Ataque 🚀</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-emerald-300 uppercase tracking-wide">Plano de Participação</label>
                  <select
                    value={perfilMembroStatus}
                    onChange={(e) => {
                      const selectedStatus = e.target.value as MembroStatus;
                      const isMudarDiaristaParaMensalista = jogadorAtual.membroStatus === 'diarista' && selectedStatus === 'mensalista';
                      
                      const isRenovacaoAtiva = checkJanelaRenovacaoGeral().estaAberta && !pagamentos.some(p => p.jogadorId === jogadorAtual.id && p.mesRef === `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` && !p.partidaId && p.status === 'pago');
                      
                      const allowed = (
                        jogadorAtual.role === 'admin' ||
                        perfilPosicao === 'Goleiro' ||
                        isRenovacaoAtiva
                      );
                      
                      if (isMudarDiaristaParaMensalista && !allowed) {
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

                        const dtInicio = janela.inicio.toLocaleDateString('pt-BR');
                        const dtFim = janela.fim.toLocaleDateString('pt-BR');
                        setAlertaRenovacaoPlano({ aberto: true, inicio: dtInicio, fim: dtFim, tipo: 'diarista_para_mensalista' });
                        return;
                      }
                      
                      if (!allowed) {
                        const info = checkJanelaRenovacaoGeral();
                        const dtInicio = info.inicio.toLocaleDateString('pt-BR');
                        const dtFim = info.fim.toLocaleDateString('pt-BR');
                        setAlertaRenovacaoPlano({ aberto: true, inicio: dtInicio, fim: dtFim, tipo: 'comum' });
                        return;
                      }

                      setPerfilMembroStatus(selectedStatus);
                    }}
                    className="w-full bg-emerald-900 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#064e3b' }}
                  >
                    {perfilPosicao === 'Goleiro' ? (
                      <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="isento">Isento</option>
                    ) : (
                      <>
                        <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="mensalista">Mensalista</option>
                        <option style={{ backgroundColor: '#064e3b' }} className="bg-emerald-900 text-white" value="diarista">Diarista</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Data Aniversário e PIN de Segurança */}
              <div className="flex flex-col gap-3 w-full">
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
                    <div 
                      className="w-6 h-6 rounded-full overflow-hidden border border-white/10 shrink-0 cursor-zoom-in hover:scale-110 transition-transform duration-200"
                      onClick={() => setFotoZoomada({ url: perfilFoto, nome: `${perfilNome} ${perfilSobrenome} (Prévia)` })}
                      title="Clique para ampliar a prévia"
                    >
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
            
            {alertaRenovacaoPlano?.aberto && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-emerald-950/80 backdrop-blur-sm rounded-2xl">
                {alertaRenovacaoPlano.tipo === 'diarista_para_mensalista' ? (
                  <div className="bg-emerald-950 border border-white/20 p-5 rounded-2xl shadow-2xl max-w-[310px] text-center space-y-4 animate-fade-in">
                    <div className="flex justify-center">
                      <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center animate-bounce">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider">Fora do Período de Renovação</h4>
                      <p className="text-[11px] text-emerald-100 leading-relaxed">
                        O período de renovação de mensalidade não está ativo neste momento.
                      </p>
                      <p className="bg-emerald-900/60 border border-white/5 rounded-xl p-3 text-emerald-250 text-[10px] text-left leading-relaxed">
                        Por este motivo, seu status continuará registrado como <strong className="text-white font-semibold">Diarista</strong>. Você poderá solicitar a alteração para Mensalista no início do próximo ciclo de renovação da mensalidade!
                      </p>
                      
                      <div className="mt-2 bg-black/30 p-2.5 rounded-xl border border-white/10">
                        <p className="text-[9px] text-emerald-350 font-mono uppercase tracking-wide">Próxima Janela de Renovação</p>
                        <p className="text-xs font-bold text-white mt-0.5">{alertaRenovacaoPlano.inicio} a {alertaRenovacaoPlano.fim}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlertaRenovacaoPlano(null)}
                      className="w-full bg-white hover:bg-emerald-100 text-black py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-97 cursor-pointer uppercase tracking-wider text-[10px]"
                    >
                      Ciente e Fechar
                    </button>
                  </div>
                ) : (
                  <div className="bg-rose-950 border border-rose-500/30 p-5 rounded-2xl shadow-2xl max-w-[280px] text-center space-y-4">
                    <div className="flex justify-center">
                      <div className="w-10 h-10 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center">
                        <Lock className="w-5 h-5" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-rose-300 uppercase">Alteração Indisponível</h4>
                      <p className="text-[11px] text-rose-200 mt-2 leading-relaxed">
                        O plano de participação somente pode ser alterado durante o período da próxima renovação.
                      </p>
                      <div className="mt-3 bg-black/30 p-2 rounded-xl border border-rose-500/10">
                        <p className="text-[9px] text-rose-400 font-mono uppercase">Período de Renovação</p>
                        <p className="text-xs font-bold text-white mt-0.5">{alertaRenovacaoPlano.inicio} a {alertaRenovacaoPlano.fim}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAlertaRenovacaoPlano(null)}
                      className="w-full bg-rose-500 hover:bg-rose-400 text-black py-2 rounded-xl text-xs font-bold shadow-md transition-all active:scale-97"
                    >
                      Entendido
                    </button>
                  </div>
                )}
              </div>
            )}
            
          </div>
        </div>
      )}
      {/* POPUP DE ZOOM DE FOTO */}
      {fotoZoomada && (
        <div 
          id="popup-foto-zoom"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
          onClick={() => setFotoZoomada(null)}
        >
          <div 
            className="relative max-w-md w-full bg-emerald-950 border border-white/10 rounded-2xl p-4 text-center shadow-2xl animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setFotoZoomada(null)}
              className="absolute top-3 right-3 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors cursor-pointer z-10"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
            
            {fotoZoomada.nome && (
              <h4 className="text-xs font-display font-extrabold text-teal-300 mb-3.5 truncate px-8 uppercase tracking-wider">
                {fotoZoomada.nome}
              </h4>
            )}
            
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-black/20 border border-white/5 flex items-center justify-center">
              <img 
                src={fotoZoomada.url} 
                className="w-full h-full object-contain" 
                alt="Foto Ampliada" 
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="mt-3 text-[10px] text-emerald-400 font-mono tracking-wide">
              Clique fora ou no botão para fechar
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in"
        >
          <div className="bg-emerald-955 border border-teal-500/30 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-scale-up">
            <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6" />
            </div>
            <h3 className="font-display font-black text-lg uppercase tracking-wide text-white mb-2">Sair do Sistema</h3>
            <p className="text-xs text-emerald-200 leading-relaxed font-sans mb-6">
              Você tem certeza que deseja sair do portal da Pelada Batista?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 bg-rose-500 hover:bg-rose-400 text-white font-extrabold py-3 rounded-xl transition-all shadow-md active:scale-97 text-xs flex items-center justify-center gap-1.5 cursor-pointer uppercase"
              >
                Sim, Quero Sair
              </button>
              <button
                type="button"
                onClick={handleCancelLogout}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-emerald-300 hover:text-white transition-all text-xs cursor-pointer font-bold uppercase"
              >
                Permanecer
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
