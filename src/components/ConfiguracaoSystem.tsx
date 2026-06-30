/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, Server, Share2, HelpCircle, ToggleLeft, ToggleRight, MessageSquare, ListFilter, Trash2, Send, ShieldCheck, Zap, Coins, Mail } from 'lucide-react';
import { DATABASE_SQL_SCHEMA } from '../data';
import { obterCredenciaisSupabase, salvarCredenciaisSupabase, getSupabase, salvarConfiguracaoNoSupabase, obterConfiguracaoDoSupabase } from '../supabaseClient';
import { Partida, Jogador, Pagamento } from '../types';
import { obterTextoListaCompletaPartida, obterTextoListaRenovacao, obterTextoPartidaCancelada, obterTextoAlertaSemanal, getJanelaConfirmacao } from '../utils/confirmationRules';

interface ConfiguracaoSystemProps {
  onConfigUpdated?: () => void;
  whatsappGrupoLink: string;
  whatsappAutomacaoAtiva: boolean;
  whatsappWebhookUrl: string;
  whatsappWebhookToken: string;
  onUpdateWhatsappConfig: (link: string, ativa: boolean, webhookUrl: string, token: string) => void;
  whatsappLogs: any[];
  onClearLogs: () => void;
  onSendTestAlert: (msg?: string, destinatario?: 'grupo' | 'admin') => void;
  onResendMessage?: (log: any) => void;
  valor4Sabados: number;
  valor5Sabados: number;
  valorDiaria: number;
  onUpdateValoresConfig: (v4: number, v5: number, vD: number) => void;
  onResetDatabase?: (startingMonth: string) => void;
  partidas?: Partida[];
  jogadores?: Jogador[];
  pagamentos?: Pagamento[];
  onRegistrarLogAutomacao?: (atletaNome: string, partidaTitulo: string, msg: string) => void;
}

export default function ConfiguracaoSystem({
  onConfigUpdated,
  whatsappGrupoLink,
  whatsappAutomacaoAtiva,
  whatsappWebhookUrl,
  whatsappWebhookToken,
  onUpdateWhatsappConfig,
  whatsappLogs,
  onClearLogs,
  onSendTestAlert,
  onResendMessage,
  valor4Sabados,
  valor5Sabados,
  valorDiaria,
  onUpdateValoresConfig,
  onResetDatabase,
  partidas = [],
  jogadores = [],
  pagamentos = [],
  onRegistrarLogAutomacao,
}: ConfiguracaoSystemProps) {
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [resendingLogIds, setResendingLogIds] = useState<Record<string, boolean>>({});
  
  // Configuração Supabase Local
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [configSalva, setConfigSalva] = useState(false);
  const [isLive, setIsLive] = useState(false);

  // States locais para formulários de Mercado Pago PIX
  const [mpAccessToken, setMpAccessToken] = useState('');
  const [mpPublicKey, setMpPublicKey] = useState('');
  const [diretoPixChave, setDiretoPixChave] = useState('');
  const [diretoPixNome, setDiretoPixNome] = useState('');
  const [diretoPixCidade, setDiretoPixCidade] = useState('');
  const [mpSuccessMsg, setMpSuccessMsg] = useState('');

  // States locais para formulários de WhatsApp
  const [localLink, setLocalLink] = useState(whatsappGrupoLink);
  const [localAtiva, setLocalAtiva] = useState(whatsappAutomacaoAtiva);
  const [localWebhookUrl, setLocalWebhookUrl] = useState(whatsappWebhookUrl);
  const [localWebhookToken, setLocalWebhookToken] = useState(whatsappWebhookToken);

  // States locais para valores das tarifas
  const [localV4, setLocalV4] = useState(valor4Sabados);
  const [localV5, setLocalV5] = useState(valor5Sabados);
  const [localVD, setLocalVD] = useState(valorDiaria);
  const [successTarifasMsg, setSuccessTarifasMsg] = useState('');
  const [manualSuccessMsg, setManualSuccessMsg] = useState('');

  const proximaPartida = (() => {
    if (!partidas || partidas.length === 0) return null;
    const hoje = new Date();
    const sorted = partidas
      .map(p => ({ ...p, dateObj: new Date(`${p.data}T12:00:00`) }))
      .filter(p => p.dateObj >= new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()))
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    return sorted[0] || partidas[partidas.length - 1];
  })();

  // States locais para reset do banco
  const [resetMesRef, setResetMesRef] = useState(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
  });
  const [resetSuccess, setResetSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // States para testes de email SMTP
  const [loadingWelcomeEmail, setLoadingWelcomeEmail] = useState(false);
  const [welcomeEmailStatus, setWelcomeEmailStatus] = useState('');
  const [loadingReceiptEmail, setLoadingReceiptEmail] = useState(false);
  const [receiptEmailStatus, setReceiptEmailStatus] = useState('');

  const handleEnviarEmailBoasVindasTeste = async () => {
    setLoadingWelcomeEmail(true);
    setWelcomeEmailStatus('');
    try {
      const response = await fetch('/api/send-welcome-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'peladabatista.tijuca@gmail.com',
          nome: 'Atleta Teste'
        })
      });
      const data = await response.json();
      if (response.ok) {
        setWelcomeEmailStatus('✓ E-mail de boas-vindas enviado com sucesso!');
      } else {
        setWelcomeEmailStatus(`❌ Erro: ${data.error || 'Falha no envio'}`);
      }
    } catch (err: any) {
      setWelcomeEmailStatus(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingWelcomeEmail(false);
      setTimeout(() => setWelcomeEmailStatus(''), 6000);
    }
  };

  const handleEnviarEmailReciboTeste = async () => {
    setLoadingReceiptEmail(true);
    setReceiptEmailStatus('');
    try {
      const response = await fetch('/api/send-receipt-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'peladabatista.tijuca@gmail.com',
          nome: 'Atleta Teste',
          valor: 85.00,
          referencia: 'Mensalidade ref. 06/2026 (Teste)',
          dataPagamento: new Date().toISOString()
        })
      });
      const data = await response.json();
      if (response.ok) {
        setReceiptEmailStatus('✓ E-mail de recibo enviado com sucesso!');
      } else {
        setReceiptEmailStatus(`❌ Erro: ${data.error || 'Falha no envio'}`);
      }
    } catch (err: any) {
      setReceiptEmailStatus(`❌ Erro: ${err.message}`);
    } finally {
      setLoadingReceiptEmail(false);
      setTimeout(() => setReceiptEmailStatus(''), 6000);
    }
  };

  useEffect(() => {
    const creds = obterCredenciaisSupabase();
    setSupaUrl(creds.url);
    setSupaKey(creds.key);
    setIsLive(!!getSupabase());

    // Carregar credenciais Mercado Pago e Chave PIX direta
    // Supabase primeiro (sincronizado), localStorage como fallback
    (async () => {
      const [dbPixChave, dbPixNome, dbPixCidade] = await Promise.all([
        obterConfiguracaoDoSupabase('direto_pix_chave'),
        obterConfiguracaoDoSupabase('direto_pix_nome'),
        obterConfiguracaoDoSupabase('direto_pix_cidade'),
      ]);
      // MP: Supabase tem prioridade — App.tsx já sincronizou no localStorage no boot
      setMpAccessToken(localStorage.getItem('mercado_pago_access_token') || '');
      setMpPublicKey(localStorage.getItem('mercado_pago_public_key') || '');
      // Buscar direto do Supabase como garantia extra
      obterConfiguracaoDoSupabase('mercado_pago_access_token').then(v => { if (v) { setMpAccessToken(v); localStorage.setItem('mercado_pago_access_token', v); }});
      obterConfiguracaoDoSupabase('mercado_pago_public_key').then(v   => { if (v) { setMpPublicKey(v);   localStorage.setItem('mercado_pago_public_key',   v); }});
      setDiretoPixChave(dbPixChave ?? localStorage.getItem('direto_pix_chave') ?? '');
      setDiretoPixNome(dbPixNome ?? localStorage.getItem('direto_pix_nome') ?? 'Pelada Batista');
      setDiretoPixCidade(dbPixCidade ?? localStorage.getItem('direto_pix_cidade') ?? 'RIO DE JANEIRO');
    })();
  }, []);

  const handleSalvarMercadoPago = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mercado_pago_access_token', mpAccessToken);
    localStorage.setItem('mercado_pago_public_key',  mpPublicKey);
    localStorage.setItem('direto_pix_chave',         diretoPixChave);
    localStorage.setItem('direto_pix_nome',          diretoPixNome);
    localStorage.setItem('direto_pix_cidade',        diretoPixCidade);
    // Persistir TUDO no Supabase — sincroniza para qualquer navegador/dispositivo
    salvarConfiguracaoNoSupabase('mercado_pago_access_token', mpAccessToken);
    salvarConfiguracaoNoSupabase('mercado_pago_public_key',   mpPublicKey);
    salvarConfiguracaoNoSupabase('direto_pix_chave',          diretoPixChave);
    salvarConfiguracaoNoSupabase('direto_pix_nome',           diretoPixNome);
    salvarConfiguracaoNoSupabase('direto_pix_cidade',         diretoPixCidade);
    setMpSuccessMsg('✓ Credenciais e dados PIX salvos com sucesso!');
    setTimeout(() => setMpSuccessMsg(''), 3000);
  };

  // Sincronizar formulários locais se as configurações globais mudarem
  useEffect(() => {
    setLocalLink(whatsappGrupoLink);
    setLocalAtiva(whatsappAutomacaoAtiva);
    setLocalWebhookUrl(whatsappWebhookUrl);
    setLocalWebhookToken(whatsappWebhookToken);
  }, [whatsappGrupoLink, whatsappAutomacaoAtiva, whatsappWebhookUrl, whatsappWebhookToken]);

  // Sincronizar tarifas locais se as configurações globais mudarem
  useEffect(() => {
    setLocalV4(valor4Sabados);
    setLocalV5(valor5Sabados);
    setLocalVD(valorDiaria);
  }, [valor4Sabados, valor5Sabados, valorDiaria]);

  const copiarSql = () => {
    navigator.clipboard.writeText(DATABASE_SQL_SCHEMA);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSalvarSupabase = (e: React.FormEvent) => {
    e.preventDefault();
    salvarCredenciaisSupabase(supaUrl, supaKey);
    setIsLive(!!getSupabase());
    setConfigSalva(true);
    if (onConfigUpdated) {
      onConfigUpdated();
    }
    setTimeout(() => setConfigSalva(false), 3000);
  };

  const handleSalvarWhatsapp = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateWhatsappConfig(localLink, localAtiva, localWebhookUrl, localWebhookToken);
    setSuccessMsg('Configuração do WhatsApp salva com sucesso!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleSalvarTarifas = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateValoresConfig(localV4, localV5, localVD);
    setSuccessTarifasMsg('✓ Tarifas atualizadas com sucesso! Novos registros de pagamento e futuros fechamentos usarão estes valores.');
    setTimeout(() => setSuccessTarifasMsg(''), 4000);
  };

  const handleToggleAtiva = () => {
    const novoStatus = !localAtiva;
    setLocalAtiva(novoStatus);
    onUpdateWhatsappConfig(localLink, novoStatus, localWebhookUrl, localWebhookToken);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-fade-in font-sans">
      
      {/* Intro e Banner de Configuração */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h2 id="titulo-configuracoes" className="font-display font-semibold text-base text-white flex items-center gap-2 uppercase tracking-wide">
            <Zap className="w-5 h-5 text-teal-400" />
            Configurações Globais & Automação de WhatsApp
          </h2>
          <p className="text-xs text-emerald-300 mt-0.5">Gerencie os disparadores automáticos de confirmações, link do grupo oficial da pelada e acople seu banco de dados.</p>
        </div>

        <div className="flex items-center gap-2">
          <div className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold ${whatsappAutomacaoAtiva ? 'text-teal-300 bg-teal-950/60 border border-teal-500/35' : 'text-rose-300 bg-rose-950/60 border border-rose-500/25'}`}>
            {whatsappAutomacaoAtiva ? '● BOT ATIVO' : '○ BOT INATIVO'}
          </div>
          <div className={`text-[10px] px-2.5 py-1 rounded-lg font-mono font-bold ${isLive ? 'text-teal-300 bg-teal-950/60 border border-teal-500/35' : 'text-amber-300 bg-amber-950/60 border border-amber-500/25'}`}>
            {isLive ? '✓ BANCO LIVE' : '⚠️ OFFLINE LOCAL'}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PARTE ESQUERDA: CONFIGURAÇÕES DE WHATSAPP (Lg: 6/12) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* PAINEL DE AUTOMAÇÃO WHATSAPP */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
                <MessageSquare className="w-4 h-4 text-emerald-400" />
                Automação do Grupo de WhatsApp
              </h3>
              
              <button
                id="btn-toggle-whatsapp-automacao"
                type="button"
                onClick={handleToggleAtiva}
                className="focus:outline-none cursor-pointer"
                title={localAtiva ? "Desativar Automação" : "Ativar Automação"}
              >
                {localAtiva ? (
                  <ToggleRight className="w-10 h-10 text-teal-400 hover:text-teal-300 transition-colors" />
                ) : (
                  <ToggleLeft className="w-10 h-10 text-gray-500 hover:text-gray-400 transition-colors" />
                )}
              </button>
            </div>

            <p className="text-xs text-emerald-300/80 leading-relaxed">
              O sistema de automação envia a formatação das convocações, novos agendamentos e justificativas de ausências automaticamente para o grupo de WhatsApp oficial sempre que um atleta interage.
            </p>

            <form onSubmit={handleSalvarWhatsapp} className="space-y-4 pt-1">
              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">
                  Link de Convite ou ID do Grupo de WhatsApp
                </label>
                <input
                  id="input-wa-grupo-link"
                  type="text"
                  required
                  value={localLink}
                  onChange={(e) => setLocalLink(e.target.value)}
                  placeholder="Link de convite (https://chat.whatsapp.com/...) ou ID do grupo (ex: 120363425601472298@g.us)"
                  className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-3 focus:outline-none focus:border-white transition-all placeholder:text-emerald-830"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">
                    URL do Robô (ex: https://futebol-bot.onrender.com/teste)
                  </label>
                  <input
                    id="input-wa-webhook-url"
                    type="url"
                    value={localWebhookUrl}
                    onChange={(e) => setLocalWebhookUrl(e.target.value)}
                    placeholder="https://seu-bot.onrender.com/teste"
                    className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-white transition-all placeholder:text-emerald-850/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">
                    WEBHOOK_SECRET (Senha da API)
                  </label>
                  <input
                    id="input-wa-webhook-token"
                    type="text"
                    value={localWebhookToken}
                    onChange={(e) => setLocalWebhookToken(e.target.value)}
                    placeholder="Sua senha webhook secreta..."
                    className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-white transition-all placeholder:text-emerald-850/60"
                  />
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <button
                  id="btn-salvar-wa-config"
                  type="submit"
                  className="flex-grow bg-white hover:bg-emerald-50 text-emerald-950 font-extrabold text-xs py-2.5 px-4 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Salvar Configurações do WhatsApp
                </button>
                
                {localWebhookUrl && (
                  <a 
                    href={localWebhookUrl.replace(/\/teste\/?$/, '/qr')} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-emerald-800 hover:bg-emerald-700 border border-emerald-500 text-teal-100 text-xs px-3.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    Abrir QR do Robô
                  </a>
                )}

                <button
                  id="btn-enviar-teste-wa"
                  type="button"
                  onClick={() => {
                    onSendTestAlert();
                    setSuccessMsg('Alerta de teste enviado com sucesso! Verifique a tabela de Logs abaixo.');
                    setTimeout(() => setSuccessMsg(''), 4000);
                  }}
                  className="bg-emerald-950 hover:bg-emerald-900 border border-white/10 text-emerald-300 text-xs px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Disparar alerta de teste no simulador"
                >
                  <Send className="w-3.5 h-3.5 text-teal-400" />
                  Alerta Teste
                </button>
              </div>

              {successMsg && !successMsg.includes('teste') && (
                <p className="text-[10px] text-teal-300 font-bold text-center animate-pulse">
                  ✓ {successMsg}
                </p>
              )}
            </form>
          </div>

          {/* PAINEL DE DISPARO MANUAL DE MENSAGENS PADRÃO */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 text-left">
            <h3 className="font-display font-semibold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
              <Zap className="w-3.5 h-3.5 text-teal-400" />
              Disparo Manual de Mensagens Padrão do WhatsApp
            </h3>
            <p className="text-xs text-emerald-300/80 leading-relaxed">
              Dispare as 5 mensagens padrão para o robô de WhatsApp do grupo de forma manual. Esse envio é imediato e <strong>não altera</strong> o comportamento das regras automáticas existentes.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => {
                  if (!proximaPartida) {
                    setManualSuccessMsg('Nenhuma partida encontrada no sistema para convocação.');
                    setTimeout(() => setManualSuccessMsg(''), 4000);
                    return;
                  }
                  const msg = obterTextoListaCompletaPartida(proximaPartida, jogadores, window.location.origin);
                  onRegistrarLogAutomacao?.(
                    'Sistema',
                    `Abertura de Convocação - Jogo ${proximaPartida.data.split('-').reverse().join('/')}`,
                    msg
                  );
                  setManualSuccessMsg(`✓ Mensagem 'Abertura de Convocação' disparada para o jogo do dia ${proximaPartida.data.split('-').reverse().join('/')}!`);
                  setTimeout(() => setManualSuccessMsg(''), 4000);
                }}
                className="bg-emerald-950/60 hover:bg-emerald-900/95 border border-teal-500/25 hover:border-teal-500 text-teal-100 text-xs py-3 px-4 rounded-xl text-left flex flex-col justify-between gap-1 transition-all cursor-pointer font-bold shrink-0 shadow-md active:scale-95"
              >
                <span className="text-[10px] text-teal-350 font-mono tracking-wider uppercase font-black">1. Abertura Convocação</span>
                <span className="text-[9px] text-emerald-300/70 font-normal">Dispara convocação inicial do próximo jogo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!proximaPartida) {
                    setManualSuccessMsg('Nenhuma partida encontrada no sistema.');
                    setTimeout(() => setManualSuccessMsg(''), 4000);
                    return;
                  }
                  const msg = obterTextoListaCompletaPartida(proximaPartida, jogadores, window.location.origin);
                  onRegistrarLogAutomacao?.(
                    'Sistema',
                    `Lista de Presença - Jogo ${proximaPartida.data.split('-').reverse().join('/')}`,
                    msg
                  );
                  setManualSuccessMsg(`✓ Mensagem 'Lista de Presença Atualizada' disparada para o jogo do dia ${proximaPartida.data.split('-').reverse().join('/')}!`);
                  setTimeout(() => setManualSuccessMsg(''), 4000);
                }}
                className="bg-emerald-950/60 hover:bg-emerald-900/95 border border-teal-500/25 hover:border-teal-500 text-teal-100 text-xs py-3 px-4 rounded-xl text-left flex flex-col justify-between gap-1 transition-all cursor-pointer font-bold shrink-0 shadow-md active:scale-95"
              >
                <span className="text-[10px] text-teal-355 font-mono tracking-wider uppercase font-black">2. Lista Atualizada</span>
                <span className="text-[9px] text-emerald-300/70 font-normal">Dispara a lista de presença atual</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!proximaPartida) {
                    setManualSuccessMsg('Nenhuma partida encontrada no sistema.');
                    setTimeout(() => setManualSuccessMsg(''), 4000);
                    return;
                  }
                  const dataJogoDate = new Date(`${proximaPartida.data}T12:00:00`);
                  let dataAmigavel = dataJogoDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
                  dataAmigavel = dataAmigavel.charAt(0).toUpperCase() + dataAmigavel.slice(1);
                  const horario = proximaPartida.horario.split(' ')[0];
                  const msg = `⚽ *PELADA BATISTA SÁBADO* ⚽\n🏆 *NOVO JOGO AGENDADO!* 🏆\n\n📋 *${proximaPartida.titulo}*\n🗓️ Data: *${dataAmigavel} às ${horario}*\n📍 Local: *${proximaPartida.local}*\n\n⏰ *Janela de confirmação:*\n🗓️ Terça-feira às 00:00 até Sexta-feira às 23:59\n\n📲 Confirme sua presença no portal:\nhttps://peladabatista.onrender.com`;
                  
                  onRegistrarLogAutomacao?.('Administrador', 'Novo Jogo Agendado', msg);
                  setManualSuccessMsg(`✓ Mensagem 'Novo Jogo Agendado' disparada com sucesso!`);
                  setTimeout(() => setManualSuccessMsg(''), 4000);
                }}
                className="bg-emerald-950/60 hover:bg-emerald-900/95 border border-teal-500/25 hover:border-teal-500 text-teal-100 text-xs py-3 px-4 rounded-xl text-left flex flex-col justify-between gap-1 transition-all cursor-pointer font-bold shrink-0 shadow-md active:scale-95"
              >
                <span className="text-[10px] text-teal-355 font-mono tracking-wider uppercase font-black">3. Novo Jogo</span>
                <span className="text-[9px] text-emerald-300/70 font-normal">Dispara comunicado de jogo agendado</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (!proximaPartida) {
                    setManualSuccessMsg('Nenhuma partida encontrada no sistema.');
                    setTimeout(() => setManualSuccessMsg(''), 4000);
                    return;
                  }
                  const msg = obterTextoPartidaCancelada(proximaPartida);
                  onRegistrarLogAutomacao?.('Administrador', 'Cancelamento de Jogo', msg);
                  setManualSuccessMsg(`✓ Mensagem 'Cancelamento de Jogo' disparada com sucesso!`);
                  setTimeout(() => setManualSuccessMsg(''), 4000);
                }}
                className="bg-emerald-950/60 hover:bg-emerald-900/95 border border-teal-500/25 hover:border-teal-500 text-teal-100 text-xs py-3 px-4 rounded-xl text-left flex flex-col justify-between gap-1 transition-all cursor-pointer font-bold shrink-0 shadow-md active:scale-95"
              >
                <span className="text-[10px] text-teal-355 font-mono tracking-wider uppercase font-black">4. Jogo Cancelado</span>
                <span className="text-[9px] text-emerald-300/70 font-normal">Alerta de cancelamento de jogo</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const hoje = new Date();
                  const refAno = hoje.getFullYear();
                  const refMesString = String(hoje.getMonth() + 1).padStart(2, '0');
                  const mesRef = `${refAno}-${refMesString}`;
                  const msg = obterTextoListaRenovacao(mesRef, jogadores, pagamentos, valor4Sabados, valor5Sabados);
                  
                  onRegistrarLogAutomacao?.(
                    'Sistema',
                    `Abertura Renovação ${mesRef}`,
                    msg
                  );
                  setManualSuccessMsg(`✓ Mensagem de 'Renovação de Mensalidade' disparada para a competência ${mesRef.split('-').reverse().join('/')}!`);
                  setTimeout(() => setManualSuccessMsg(''), 4000);
                }}
                className="bg-emerald-950/60 hover:bg-emerald-900/95 border border-teal-500/25 hover:border-teal-500 text-teal-100 text-xs py-3 px-4 rounded-xl text-left flex flex-col justify-between gap-1 transition-all cursor-pointer font-bold shrink-0 shadow-md active:scale-95"
              >
                <span className="text-[10px] text-teal-355 font-mono tracking-wider uppercase font-black">5. Renovação</span>
                <span className="text-[9px] text-emerald-300/70 font-normal">Dispara situação atual de mensalidades</span>
              </button>
            </div>

            {manualSuccessMsg && (
              <p className="text-[11px] text-teal-300 font-bold text-center mt-2 bg-teal-950/45 py-2 px-3 rounded-lg border border-teal-500/20 animate-fade-in">
                ✓ {manualSuccessMsg}
              </p>
            )}
          </div>

          {/* HISTÓRICO DE LOGS DA AUTOMAÇÃO */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 flex flex-col h-[320px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="font-display font-semibold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
                <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
                Histórico & Logs de Atividade do Bot
              </h3>

              {whatsappLogs.length > 0 && (
                <div className="flex items-center gap-3">
                  {onConfigUpdated && (
                     <button
                       id="btn-recarregar-wa-logs"
                       type="button"
                       onClick={onConfigUpdated}
                       className="text-[9px] font-bold text-teal-300 hover:text-teal-400 flex items-center gap-0.5"
                     >
                       ⟳ Atualizar
                     </button>
                  )}
                  <button
                    id="btn-limpar-wa-logs"
                    type="button"
                    onClick={onClearLogs}
                    className="text-[9px] font-bold text-rose-300 hover:text-rose-400 flex items-center gap-0.5"
                  >
                    <Trash2 className="w-3 h-3 text-rose-400" />
                    Limpar Logs
                  </button>
                </div>
              )}
            </div>

            <div className="flex-grow overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
              {whatsappLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-emerald-550 space-y-1.5 py-12">
                  <span className="text-xl">💤</span>
                  <p className="text-[11px]">Nenhum disparo de bot registrado até o momento.</p>
                </div>
              ) : (
                whatsappLogs.map((log: any) => {
                  const isFalha = log.evento?.includes('FALHA') || log.mensagem?.includes('⚠️') || log.mensagem?.includes('[FALHA');
                  return (
                    <div key={log.id} className="bg-emerald-950/70 p-2.5 rounded-lg border border-white/5 space-y-1.5 transition-all hover:bg-emerald-950/90">
                      <div className="flex items-center justify-between text-[8px] text-emerald-500">
                        <span>{log.enviado_em ? new Date(log.enviado_em).toLocaleString('pt-BR') : log.data}</span>
                        <span className={`px-1.5 py-0.2 border rounded uppercase text-[7px] font-black ${isFalha ? 'bg-red-950/60 border-red-500/20 text-rose-300' : 'bg-emerald-900 border-emerald-500/20 text-emerald-300'}`}>
                          {log.evento || 'DISPARO'}
                        </span>
                      </div>
                      <div className="text-[10px] text-white leading-relaxed break-words">
                        <span className="font-bold text-teal-300 font-sans mr-1">[{log.tabela || log.atleta || ''}]</span>
                        {log.mensagem}
                      </div>
                      {whatsappGrupoLink && (
                        <div className="text-[8.5px] text-emerald-450 truncate">
                          Link: <a href={whatsappGrupoLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{whatsappGrupoLink}</a>
                        </div>
                      )}
                      {isFalha && onResendMessage && (
                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            disabled={resendingLogIds[log.id]}
                            onClick={() => {
                              setResendingLogIds(prev => ({ ...prev, [log.id]: true }));
                              onResendMessage(log);
                              setTimeout(() => {
                                setResendingLogIds(prev => ({ ...prev, [log.id]: false }));
                              }, 1500);
                            }}
                            className={`flex items-center gap-1 text-black text-[9px] font-extrabold px-2 py-1 rounded transition-all cursor-pointer ${
                              resendingLogIds[log.id]
                                ? 'bg-amber-600/50 cursor-not-allowed text-black/50'
                                : 'bg-amber-500 hover:bg-amber-400 active:scale-95'
                            }`}
                            title="Tentar disparar essa mensagem novamente para o robô"
                          >
                            <Send className="w-2.5 h-2.5" />
                            {resendingLogIds[log.id] ? 'Reenviando...' : 'Reenviar Mensagem'}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* MENSAGENS PADRÕES DO SISTEMA */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              Templates de Mensagens do Robô
            </h3>
            
            <p className="text-[10px] text-emerald-300/80 leading-relaxed font-sans">
              Testes práticos para checar a automação das 5 mensagens principais oficiais do sistema.
            </p>

            {/* MESSAGE 1 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">1. Novo Jogo Agendado</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`⚽ *PELADA BATISTA SÁBADO* ⚽
🏆 *NOVO JOGO AGENDADO!* 🏆

📋 *[Partida Teste]*
🗓️ Data: *Sábado, 25/06/2026 às 08:00*
📍 Local: *Campo do Batista*

⏰ *Janela de confirmação:*
🗓️ Terça-feira às 00:00 até Sexta-feira às 23:59

📲 Confirme sua presença no portal:
https://peladabatista.onrender.com`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`⚽ *PELADA BATISTA SÁBADO* ⚽\n🏆 *NOVO JOGO AGENDADO!* 🏆\n\n📋 *[Partida Teste]*\n🗓️ Data: *Sábado, 25/06/2026 às 08:00*\n📍 Local: *Campo do Batista*\n\n⏰ *Janela de confirmação:*\n🗓️ Terça-feira às 00:00 até Sexta-feira às 23:59\n\n📲 Confirme sua presença no portal:\nhttps://peladabatista.onrender.com`);
                  setSuccessMsg('Mensagem 1 (Jogo Agendado) disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 1: Jogo Agendado
              </button>
            </div>

            {/* MESSAGE 2 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">2. Novo Jogo Cancelado</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`⚽ *PELADA BATISTA SÁBADO* ⚽
❌ *JOGO CANCELADO!* ❌

📋 *[Partida Teste]*
🗓️ Data: *Sábado, 25/06/2026 às 08:00*
📍 Local: *Campo do Batista*

📲 Acesse nosso portal:
https://peladabatista.onrender.com`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`⚽ *PELADA BATISTA SÁBADO* ⚽\n❌ *JOGO CANCELADO!* ❌\n\n📋 *[Partida Teste]*\n🗓️ Data: *Sábado, 25/06/2026 às 08:00*\n📍 Local: *Campo do Batista*\n\n📲 Acesse nosso portal:\nhttps://peladabatista.onrender.com`);
                  setSuccessMsg('Mensagem 2 (Jogo Cancelado) disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 2: Jogo Cancelado
              </button>
            </div>

            {/* MESSAGE 3 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">3. Convocação & Presença Atualizada</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`⚽ *PELADA BATISTA SÁBADO* ⚽
🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆

📅 Jogo: *[Partida Teste]*
🗓️ Data: *Sábado, 25 de junho* às *08:00*
📍 Local: *Campo do Batista*

*A - MENSALISTAS:*
1. *Roberto Nunes* (Meio) 🏅
2. *Paulo Souza* (Defesa)

*B - DIARISTAS:*
1. *Renan Costa* (Ataque)

*C - GOLEIROS:*
1. *Daniel Marcos* (Goleiro)

*D - JOGADORES AUSENTES:*
_Nenhuma ausência registrada_

*E - LISTA DE ESPERA:*
_Nenhum jogador em lista de espera_

----------------------------------------
📲 Acesse o portal oficial para confirmar ou alterar sua presença:
https://peladabatista.onrender.com`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`⚽ *PELADA BATISTA SÁBADO* ⚽\n🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆\n\n📅 Jogo: *[Partida Teste]*\n🗓️ Data: *Sábado, 25 de junho* às *08:00*\n📍 Local: *Campo do Batista*\n\n*A - MENSALISTAS:*\n1. *Roberto Nunes* (Meio) 🏅\n2. *Paulo Souza* (Defesa)\n\n*B - DIARISTAS:*\n1. *Renan Costa* (Ataque)\n\n*C - GOLEIROS:*\n1. *Daniel Marcos* (Goleiro)\n\n*D - JOGADORES AUSENTES:*\n_Nenhuma ausência registrada_\n\n*E - LISTA DE ESPERA:*\n_Nenhum jogador em lista de espera_\n\n----------------------------------------\n📲 Acesse o portal oficial para confirmar ou alterar sua presença:\nhttps://peladabatista.onrender.com`);
                  setSuccessMsg('Mensagem 3 (Convocação Atualizada) disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 3: Convocação & Presença
              </button>
            </div>

            {/* MESSAGE 4 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">4. Período de Renovação de Mensalistas</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`⚽ *PELADA BATISTA SÁBADO* ⚽
🔄 *RENOVAÇÃO DE MENSALIDADE - 06/2026* 🔄

⏰ *Período de Renovação:* De *22/06/2026* até *26/06/2026*
💰 *Valor da Mensalidade:* *R$ 85.00* (4 sábados)

Abaixo a situação atual dos mensalistas:

A - ATUAIS MENSALISTAS:
1. 🏅*Jogador Teste* (Meio) -
2. *Teste PIX* (Defesa) - 💰

B - NOVOS MENSALISTAS:
1. *Rodolfo Dias* (Defesa) - 💰

----------------------------------------
📲 Acesse o portal oficial para mais informações:
https://peladabatista.onrender.com`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`⚽ *PELADA BATISTA SÁBADO* ⚽\n🔄 *RENOVAÇÃO DE MENSALIDADE - 06/2026* 🔄\n\n⏰ *Período de Renovação:* De *22/06/2026* até *26/06/2026*\n💰 *Valor da Mensalidade:* *R$ 85.00* (4 sábados)\n\nAbaixo a situação atual dos mensalistas:\n\nA - ATUAIS MENSALISTAS:\n1. 🏅*Jogador Teste* (Meio) -\n2. *Teste PIX* (Defesa) - 💰\n\nB - NOVOS MENSALISTAS:\n1. *Rodolfo Dias* (Defesa) - 💰\n\n----------------------------------------\n📲 Acesse o portal oficial para mais informações:\nhttps://peladabatista.onrender.com`);
                  setSuccessMsg('Mensagem 4 (Renovação Mensalistas) disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 4: Renovação Mensalistas
              </button>
            </div>

            {/* MESSAGE 5 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">5. Novo Cadastro (Notificação ao Administrador)</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`👤 *NOVO CADASTRO AGUARDANDO APROVAÇÃO* 👤

Um novo jogador se cadastrou no portal e aguarda a sua aprovação:

🏷️ Nome: *Carlos Alberto (Teste)*
📧 E-mail: *carlos.teste@gmail.com*
⚽ Posição: *Meio*
⭐ Mensalista/Diarista: *mensalista*

👉 Acesse o painel do administrador para aprovar:
https://peladabatista.onrender.com`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`👤 *NOVO CADASTRO AGUARDANDO APROVAÇÃO* 👤\n\nUm novo jogador se cadastrou no portal e aguarda a sua aprovação:\n\n🏷️ Nome: *Carlos Alberto (Teste)*\n📧 E-mail: *carlos.teste@gmail.com*\n⚽ Posição: *Meio*\n⭐ Mensalista/Diarista: *mensalista*\n\n👉 Acesse o painel do administrador para aprovar:\nhttps://peladabatista.onrender.com`, 'admin');
                  setSuccessMsg('Mensagem 5 (Novo Cadastro Admin) disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 5: Novo Cadastro Admin
              </button>
            </div>

            {successMsg && successMsg.includes('Mensagem') && (
              <p className="text-[10px] text-teal-300 font-bold text-center animate-pulse mt-1">
                ✓ {successMsg} Verifique os logs.
              </p>
            )}
          </div>

        </div>

        {/* PARTE DIREITA: CONFIGURAÇÕES DE DB & SQL SCHEMA (Lg: 6/12) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* CONFIGURAÇÃO DE TARIFAS E CAIXA */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <Coins className="w-4 h-4 text-emerald-400" />
              Parâmetros de Cálculo de Tarifas e Finanças
            </h3>
            
            <p className="text-xs text-emerald-300/85 leading-relaxed font-sans">
              Defina as tarifas de mensalidade e diária aplicadas às cobranças de atletas. Alterações passarão a valer para novos registros e rateios futuros, preservando os fechamentos históricos.
            </p>

            <form onSubmit={handleSalvarTarifas} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">VALOR MÊS (4 SÁBADOS)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-emerald-500 font-sans font-bold">R$</span>
                    <input
                      id="input-valor-4s-config"
                      type="number"
                      value={localV4}
                      onChange={(e) => setLocalV4(parseFloat(e.target.value) || 0)}
                      className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-white transition-all"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">VALOR MÊS (5 SÁBADOS)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-emerald-500 font-sans font-bold">R$</span>
                    <input
                      id="input-valor-5s-config"
                      type="number"
                      value={localV5}
                      onChange={(e) => setLocalV5(parseFloat(e.target.value) || 0)}
                      className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-white transition-all"
                      min="0"
                      step="0.01"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">VALOR DIÁRIA (AVULSO)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-emerald-500 font-sans font-bold">R$</span>
                  <input
                    id="input-valor-diaria-config"
                    type="number"
                    value={localVD}
                    onChange={(e) => setLocalVD(parseFloat(e.target.value) || 0)}
                    className="w-full bg-emerald-950 border border-white/10 text-white text-xs font-mono rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-white transition-all"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {successTarifasMsg && (
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-500/30 text-teal-300 text-[10.5px] rounded-xl font-sans" id="success-tarifas-notif">
                  {successTarifasMsg}
                </div>
              )}

              <button
                type="submit"
                id="btn-salvar-tarifas"
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-97 cursor-pointer font-sans"
              >
                Salvar Configurações de Tarifas
              </button>
            </form>
          </div>

          {/* RESET DA BASE DE DADOS */}
          <div className="bg-rose-950/20 border border-rose-500/25 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-sm text-rose-400 flex items-center gap-2 uppercase tracking-wide">
              <Database className="w-4 h-4 text-rose-400" />
              Reset de Partidas e Agenda
            </h3>
            
            <p className="text-xs text-rose-200/90 leading-relaxed font-sans">
              Apaga todo o histórico de partidas agendadas e confirmadas passadas, retornando a agenda de jogos a um estado inicial. <strong>Os atletas cadastrados, as credenciais de acesso, e todo o histórico financeiro (mensalidades, faturamentos e despesas passadas no caixa) são totalmente preservados.</strong> O novo histórico de partidas começará a ser contado a partir do mês escolhido abaixo.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-rose-300 uppercase tracking-widest mb-1.5 font-sans">
                  Mês Inicial para Coleta de Dados:
                </label>
                <input
                  type="month"
                  value={resetMesRef}
                  onChange={(e) => setResetMesRef(e.target.value)}
                  className="w-full bg-emerald-950/60 border border-white/15 text-white text-xs font-mono rounded-lg p-2.5 focus:outline-none focus:border-rose-400"
                />
              </div>

              {resetSuccess && (
                <div className="p-2.5 bg-rose-950/50 border border-rose-500/30 text-rose-350 text-[10.5px] rounded-xl font-sans font-bold">
                  ✓ Agenda e partidas reiniciadas com sucesso! Histórico limpo iniciando em {resetMesRef.split('-').reverse().join('/')}.
                </div>
              )}

              {!showResetConfirm ? (
                <button
                  type="button"
                  id="btn-executar-reset-banco"
                  onClick={() => setShowResetConfirm(true)}
                  className="w-full bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-black text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-rose-500/10 active:scale-97 cursor-pointer font-sans uppercase tracking-wider border border-rose-500/30"
                >
                  Executar Reset de Partidas e Agenda
                </button>
              ) : (
                <div className="bg-rose-950/45 border border-rose-500/30 p-3 rounded-xl space-y-2.5 text-center">
                  <p className="text-[10px] text-rose-300 font-bold uppercase leading-tight font-sans">
                    ⚠️ CONFIRMAR RESET? Todas as partidas e a agenda de jogos serão apagadas! Os usuários cadastrados e o histórico financeiro do caixa não sofrerão nenhuma alteração.
                  </p>
                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      id="btn-confirmar-reset"
                      onClick={() => {
                        setShowResetConfirm(false);
                        if (onResetDatabase) {
                          onResetDatabase(resetMesRef);
                        }
                        setResetSuccess(true);
                        setTimeout(() => setResetSuccess(false), 4500);
                      }}
                      className="flex-1 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-[10px] py-2.5 rounded-lg transition-all cursor-pointer uppercase font-sans border border-red-500/30 shadow-md active:scale-97"
                    >
                      Sim, Resetar Agenda
                    </button>
                    <button
                      type="button"
                      id="btn-cancelar-reset"
                      onClick={() => setShowResetConfirm(false)}
                      className="flex-1 bg-emerald-900 border border-white/15 text-white font-extrabold text-[10px] py-2.5 rounded-lg transition-all cursor-pointer uppercase font-sans hover:bg-emerald-850 active:scale-97"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PAINEL DE PAGAMENTOS MERCADO PAGO E PIX DIRETO */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-sm text-amber-400 flex items-center gap-2 uppercase tracking-wide">
              <Coins className="w-4 h-4 text-amber-400" />
              Configuração do Sistema PIX & Mercado Pago
            </h3>
            
            <p className="text-xs text-emerald-300/80 leading-relaxed font-sans">
              Para validar o recebimento de forma automática síncrona com simulações, use os campos do Mercado Pago. Para que seus jogadores possam **escanear com sucesso em QUALQUEER aplicativo de banco real**, insira sua chave PIX direta abaixo.
            </p>

            <form onSubmit={handleSalvarMercadoPago} className="space-y-4">
              <div className="bg-emerald-950/40 p-4 border border-white/5 rounded-xl space-y-3">
                <p className="text-[10px] font-bold text-teal-400 uppercase tracking-wider">
                  🎯 Dados para recebimento direto (PIX Estático Real)
                </p>
                <div>
                  <label className="block text-[9px] font-bold text-emerald-300 uppercase tracking-widest mb-1 font-sans">
                    Chave PIX (E-mail, CPF, CNPJ, Celular ou Chave Aleatória)
                  </label>
                  <input
                    id="input-direto-pix-chave"
                    type="text"
                    value={diretoPixChave}
                    onChange={(e) => setDiretoPixChave(e.target.value)}
                    placeholder="Ex: pix@peladabatista.com.br ou 123.456.789-00 ou celular"
                    className="w-full bg-emerald-955 border border-white/10 text-white font-mono text-xs rounded-lg p-2 focus:outline-none focus:border-teal-500 transition-all placeholder:text-emerald-800/60"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[9px] font-bold text-emerald-300 uppercase tracking-widest mb-1 font-sans">
                      Nome Recebedor (Até 25 caracteres, sem acento)
                    </label>
                    <input
                      id="input-direto-pix-nome"
                      type="text"
                      maxLength={25}
                      value={diretoPixNome}
                      onChange={(e) => setDiretoPixNome(e.target.value)}
                      placeholder="Ex: Leonardo Soares"
                      className="w-full bg-emerald-955 border border-white/10 text-white text-xs rounded-lg p-2 focus:outline-none focus:border-teal-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-emerald-300 uppercase tracking-widest mb-1 font-sans">
                      Cidade (Até 15 caracteres, sem acento)
                    </label>
                    <input
                      id="input-direto-pix-cidade"
                      type="text"
                      maxLength={15}
                      value={diretoPixCidade}
                      onChange={(e) => setDiretoPixCidade(e.target.value)}
                      placeholder="Ex: Rio de Janeiro"
                      className="w-full bg-emerald-955 border border-white/10 text-white text-xs rounded-lg p-2 focus:outline-none focus:border-teal-500 transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-emerald-950/20 p-4 border border-white/5 rounded-xl space-y-3">
                <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
                  🔑 API do Mercado Pago (Confirmação via Webhook / Simulador)
                </p>
                <div>
                  <label className="block text-[9px] font-bold text-emerald-300 uppercase tracking-widest mb-1 font-sans">Access Token</label>
                  <input
                    id="input-mp-access-token"
                    type="password"
                    value={mpAccessToken}
                    onChange={(e) => setMpAccessToken(e.target.value)}
                    placeholder="APP_USR-..."
                    className="w-full bg-emerald-955 border border-white/10 text-white font-mono text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500 transition-all placeholder:text-emerald-800/60"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-emerald-300 uppercase tracking-widest mb-1 font-sans">Public Key (Opcional)</label>
                  <input
                    id="input-mp-public-key"
                    type="text"
                    value={mpPublicKey}
                    onChange={(e) => setMpPublicKey(e.target.value)}
                    placeholder="APP_USR-..."
                    className="w-full bg-emerald-955 border border-white/10 text-white font-mono text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500 transition-all placeholder:text-emerald-800/60"
                  />
                </div>
              </div>

              <button
                id="btn-salvar-mp-config"
                type="submit"
                className="w-full bg-teal-500 hover:bg-teal-400 text-black font-black text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-97 cursor-pointer uppercase"
              >
                Salvar Credenciais e Preferências PIX
              </button>

              {mpSuccessMsg && (
                <p className="text-[10px] text-teal-300 font-bold text-center animate-pulse">
                  {mpSuccessMsg}
                </p>
              )}
            </form>
          </div>

          {/* AMBIENTE DE TESTES DE ENVIO DE E-MAIL (SMTP) */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-sm text-teal-400 flex items-center gap-2 uppercase tracking-wide">
              <Mail className="w-4 h-4 text-teal-400" />
              Ambiente de Testes de E-mail (SMTP)
            </h3>
            
            <p className="text-xs text-emerald-300/80 leading-relaxed font-sans">
              Cheque o funcionamento de sua integração de e-mails via SMTP de forma imediata. Para que você possa validar o visual real na sua caixa de entrada, <strong>o destinatário é fixado como peladabatista.tijuca@gmail.com</strong>.
            </p>

            <div className="space-y-3.5 pt-1">
              <div className="bg-emerald-950/40 p-3.5 border border-white/5 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block">
                  📧 Teste 1: E-mail de Boas-Vindas (Conta Aprovada)
                </span>
                <p className="text-[10px] text-emerald-400/90 leading-normal font-sans">
                  Envia a saudação oficial e as instruções de primeiro acesso para um novo jogador aprovado.
                </p>
                <button
                  type="button"
                  id="btn-testar-email-boas-vindas"
                  disabled={loadingWelcomeEmail}
                  onClick={handleEnviarEmailBoasVindasTeste}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loadingWelcomeEmail ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-teal-300" />
                  )}
                  Disparar E-mail de Boas-Vindas
                </button>
                {welcomeEmailStatus && (
                  <p className={`text-[10px] font-bold text-center ${welcomeEmailStatus.includes('sucesso') ? 'text-teal-300' : 'text-rose-400'}`}>
                    {welcomeEmailStatus}
                  </p>
                )}
              </div>

              <div className="bg-emerald-950/40 p-3.5 border border-white/5 rounded-xl space-y-3">
                <span className="text-[10px] font-bold text-teal-300 uppercase tracking-wider block">
                  🧾 Teste 2: Recibo de Pagamento (Pagamento Aprovado)
                </span>
                <p className="text-[10px] text-emerald-400/90 leading-normal font-sans">
                  Emite o comprovante de pagamento oficial para uma mensalidade fictícia de R$ 85,00.
                </p>
                <button
                  type="button"
                  id="btn-testar-email-recibo"
                  disabled={loadingReceiptEmail}
                  onClick={handleEnviarEmailReciboTeste}
                  className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-extrabold text-[10.5px] py-2 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loadingReceiptEmail ? (
                    <span className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-teal-300" />
                  )}
                  Disparar E-mail de Recibo (R$ 85,00)
                </button>
                {receiptEmailStatus && (
                  <p className={`text-[10px] font-bold text-center ${receiptEmailStatus.includes('sucesso') ? 'text-teal-300' : 'text-rose-400'}`}>
                    {receiptEmailStatus}
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
