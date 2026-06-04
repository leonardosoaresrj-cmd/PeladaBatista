/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, Server, Share2, HelpCircle, ToggleLeft, ToggleRight, MessageSquare, ListFilter, Trash2, Send, ShieldCheck, Zap, Coins } from 'lucide-react';
import { DATABASE_SQL_SCHEMA } from '../data';
import { obterCredenciaisSupabase, salvarCredenciaisSupabase, getSupabase } from '../supabaseClient';

interface ConfiguracaoSystemProps {
  onConfigUpdated?: () => void;
  whatsappGrupoLink: string;
  whatsappAutomacaoAtiva: boolean;
  whatsappWebhookUrl: string;
  whatsappWebhookToken: string;
  onUpdateWhatsappConfig: (link: string, ativa: boolean, webhookUrl: string, token: string) => void;
  whatsappLogs: any[];
  onClearLogs: () => void;
  onSendTestAlert: () => void;
  valor4Sabados: number;
  valor5Sabados: number;
  valorDiaria: number;
  onUpdateValoresConfig: (v4: number, v5: number, vD: number) => void;
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
  valor4Sabados,
  valor5Sabados,
  valorDiaria,
  onUpdateValoresConfig,
}: ConfiguracaoSystemProps) {
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Configuração Supabase Local
  const [supaUrl, setSupaUrl] = useState('');
  const [supaKey, setSupaKey] = useState('');
  const [configSalva, setConfigSalva] = useState(false);
  const [isLive, setIsLive] = useState(false);

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

  useEffect(() => {
    const creds = obterCredenciaisSupabase();
    setSupaUrl(creds.url);
    setSupaKey(creds.key);
    setIsLive(!!getSupabase());
  }, []);

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
                  Link de Convite do Grupo de WhatsApp
                </label>
                <input
                  id="input-wa-grupo-link"
                  type="url"
                  required
                  value={localLink}
                  onChange={(e) => setLocalLink(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-3 focus:outline-none focus:border-white transition-all placeholder:text-emerald-850/60"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">
                    Webhook URL de Disparo (Opcional - Ex: Baileys/Local Bot)
                  </label>
                  <input
                    id="input-wa-webhook-url"
                    type="url"
                    value={localWebhookUrl}
                    onChange={(e) => setLocalWebhookUrl(e.target.value)}
                    placeholder="http://localhost:5000/api/messages/send"
                    className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-white transition-all placeholder:text-emerald-850/60"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">
                    Token Bearer de API (Opcional)
                  </label>
                  <input
                    id="input-wa-webhook-token"
                    type="text"
                    value={localWebhookToken}
                    onChange={(e) => setLocalWebhookToken(e.target.value)}
                    placeholder="SuaChaveSecretaJWT..."
                    className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-white transition-all placeholder:text-emerald-850/60"
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  id="btn-salvar-wa-config"
                  type="submit"
                  className="flex-grow bg-white hover:bg-emerald-50 text-emerald-950 font-extrabold text-xs py-2.5 px-4 rounded-lg transition-colors shadow-sm cursor-pointer"
                >
                  Salvar Configurações do WhatsApp
                </button>

                <button
                  id="btn-enviar-teste-wa"
                  type="button"
                  onClick={onSendTestAlert}
                  className="bg-emerald-950 hover:bg-emerald-900 border border-white/10 text-emerald-300 text-xs px-3.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Disparar alerta de teste no simulador"
                >
                  <Send className="w-3.5 h-3.5 text-teal-400" />
                  Alerta Teste
                </button>
              </div>

              {successMsg && (
                <p className="text-[10px] text-teal-300 font-bold text-center animate-pulse">
                  ✓ {successMsg}
                </p>
              )}
            </form>
          </div>

          {/* MANUAL PASSO A PASSO DA CONFIGURAÇÃO DO BOT */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-xs text-teal-300 flex items-center gap-2 uppercase tracking-wide">
              <ShieldCheck className="w-4 h-4 text-teal-400 font-bold" />
              Guia Completo: Instalar Bot de WhatsApp Real
            </h3>
            
            <p className="text-[11px] text-emerald-250 leading-relaxed font-sans">
              Para fazer o disparo automático e real das confirmações de presença e notificações de depósitos para o grupo de WhatsApp oficial da sua pelada, siga o tutorial de instalação do microsserviço oficial:
            </p>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <p className="font-bold text-white text-[11px] flex items-center gap-1.5 leading-none">
                  <span className="w-4 h-4 rounded-full bg-emerald-950 border border-teal-500/30 text-[9px] font-mono font-bold flex items-center justify-center text-teal-300">1</span>
                  Preparar arquivos do Servidor Bot
                </p>
                <p className="text-[10.5px] text-emerald-300/80 ml-5 leading-relaxed">
                  Criamos um script Node autônomo baseado no <strong>whatsapp-web.js (ou Baileys)</strong> pronto para rodar. Crie uma pasta vazia em seu computador ou servidor e salve o arquivo do bot (veja <code>scripts/whatsapp-bot.js</code> no código deste projeto).
                </p>
              </div>

              <div className="space-y-1.5">
                <p className="font-bold text-white text-[11px] flex items-center gap-1.5 leading-none">
                  <span className="w-4 h-4 rounded-full bg-emerald-950 border border-teal-500/30 text-[9px] font-mono font-bold flex items-center justify-center text-teal-300">2</span>
                  Instalar Dependências e Executar
                </p>
                <p className="text-[10.5px] text-emerald-300/80 ml-5 leading-relaxed">
                  Abra o terminal do seu computador dentro da pasta do bot e instale os pacotes requeridos rodando:
                </p>
                <div className="ml-5 bg-emerald-950/80 border border-white/5 p-2 rounded-lg font-mono text-[9px] text-teal-300 overflow-x-auto select-all">
                  npm install express body-parser qrcode-terminal whatsapp-web.js
                </div>
                <p className="text-[10.5px] text-emerald-300/80 ml-5 leading-relaxed">
                  Para iniciar e disponibilizar a API local, rode o comando:
                </p>
                <div className="ml-5 bg-emerald-950/80 border border-white/5 p-2 rounded-lg font-mono text-[9px] text-teal-300 overflow-x-auto select-all">
                  node whatsapp-bot.js
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-white text-[11px] flex items-center gap-1.5 leading-none">
                  <span className="w-4 h-4 rounded-full bg-emerald-950 border border-teal-500/30 text-[9px] font-mono font-bold flex items-center justify-center text-teal-300">3</span>
                  Escanear o QR Code de Vinculação
                </p>
                <p className="text-[10.5px] text-emerald-300/80 ml-5 leading-relaxed">
                  Assim que inicializar, um correspondente <strong>QR Code</strong> será impresso no terminal. Abra seu WhatsApp celular &gt; <strong>Aparelhos Conectados</strong> &gt; escanete o QR Code para conectar a conta ativa do Bot.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-bold text-white text-[11px] flex items-center gap-1.5 leading-none">
                  <span className="w-4 h-4 rounded-full bg-emerald-950 border border-teal-500/30 text-[9px] font-mono font-bold flex items-center justify-center text-teal-300">4</span>
                  Acoplar o Webhook acima
                </p>
                <p className="text-[10.5px] text-emerald-300/80 ml-5 leading-relaxed">
                  Copie o endereço local impresso: <code>http://localhost:5000/api/messages/send</code> (ou utilize ngrok para obter link público se hospedado em VPS pública) e cole no input <strong>Webhook URL de Disparo</strong> acima. Salve a configuração e clique em <strong>Alerta Teste</strong>!
                </p>
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE LOGS DA AUTOMAÇÃO */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4 flex flex-col h-[320px]">
            <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
              <h3 className="font-display font-semibold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
                <ListFilter className="w-3.5 h-3.5 text-emerald-400" />
                Histórico & Logs de Atividade do Bot
              </h3>

              {whatsappLogs.length > 0 && (
                <button
                  id="btn-limpar-wa-logs"
                  type="button"
                  onClick={onClearLogs}
                  className="text-[9px] font-bold text-rose-300 hover:text-rose-400 flex items-center gap-0.5"
                >
                  <Trash2 className="w-3 h-3 text-rose-400" />
                  Limpar Logs
                </button>
              )}
            </div>

            <div className="flex-grow overflow-y-auto space-y-2 pr-1 font-mono text-[10px]">
              {whatsappLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-emerald-550 space-y-1.5 py-12">
                  <span className="text-xl">💤</span>
                  <p className="text-[11px]">Nenhum disparo de bot registrado até o momento.</p>
                </div>
              ) : (
                whatsappLogs.map((log) => (
                  <div key={log.id} className="bg-emerald-950/70 p-2 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-emerald-500">
                      <span>{log.data}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-900 border border-emerald-500/20 text-emerald-300 rounded uppercase text-[7px] font-black">
                        {log.status === 'sucesso' ? 'sucesso' : 'falha'}
                      </span>
                    </div>
                    <div className="text-[10px] text-white leading-relaxed">
                      <span className="font-bold text-teal-300 font-sans mr-1">[{log.atleta}]</span>
                      {log.mensagem}
                    </div>
                    {whatsappGrupoLink && (
                      <div className="text-[8.5px] text-emerald-450 truncate">
                        Link: <a href={whatsappGrupoLink} target="_blank" rel="noopener noreferrer" className="underline hover:text-white transition-colors">{whatsappGrupoLink}</a>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* PARTE DIREITA: CONFIGURAÇÕES DE DB & SQL SCHEMA (Lg: 6/12) */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* CONFIGURAÇÃO DE TARIFAS E CAIXA */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <Coins className="w-4 h-4 text-emerald-400" />
              Parâmetros de Cálculo de Tarifas e Caixa
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
                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black text-xs py-2.5 rounded-xl transition-all shadow-md active:scale-97 cursor-pointer"
              >
                Salvar Configurações de Tarifas
              </button>
            </form>
          </div>
          
          {/* BANCO DE DADOS SUPABASE */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-sm text-white flex items-center gap-2 uppercase tracking-wide">
              <Share2 className="w-4 h-4 text-emerald-400" />
              Credenciais Supabase API
            </h3>
            
            <p className="text-xs text-emerald-300/80 leading-relaxed font-sans">
              Para sincronizar os dados da pelada de forma remota em vez de simulação offline por LocalStorage, insira as chaves da sua API Supabase abaixo:
            </p>

            <form onSubmit={handleSalvarSupabase} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">SUPABASE_URL</label>
                <input
                  id="input-supa-url-config"
                  type="url"
                  value={supaUrl}
                  onChange={(e) => setSupaUrl(e.target.value)}
                  placeholder="https://your-project.supabase.co"
                  className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-xs rounded-lg p-2.5 focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-emerald-300 uppercase tracking-widest mb-1.5 font-sans">SUPABASE_ANON_KEY (CLIENT)</label>
                <textarea
                  id="input-supa-key-config"
                  rows={2}
                  value={supaKey}
                  placeholder="eyJhbGciOi..."
                  onChange={(e) => setSupaKey(e.target.value)}
                  className="w-full bg-emerald-950 border border-white/10 text-white font-mono text-[10px] rounded-lg p-2.5 focus:outline-none focus:border-white resize-none"
                />
              </div>

              <button
                id="btn-salvar-supa-config-system"
                type="submit"
                className="w-full bg-emerald-950 hover:bg-emerald-900 hover:text-white text-emerald-300 border border-white/10 font-bold text-xs py-2.5 rounded-lg transition-all shadow-sm cursor-pointer"
              >
                Conectar ao Supabase Live
              </button>

              {configSalva && (
                <p className="text-[10px] text-teal-300 font-bold text-center animate-pulse">
                  ✓ Configuração integrada! Chaves de acesso salvas com sucesso.
                </p>
              )}
            </form>
          </div>

          {/* SCRIPT SQL EXPORT */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 flex-wrap gap-2">
              <h3 className="font-display font-semibold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                Criação de Tabelas SQL (Postgres)
              </h3>
              
              <button
                id="btn-copiar-sql-config"
                type="button"
                onClick={copiarSql}
                className="bg-emerald-950 hover:bg-emerald-900/80 text-emerald-300 font-bold text-[10px] px-2.5 py-1 rounded transition-all flex items-center gap-1 border border-white/10 cursor-pointer"
              >
                {copied ? <Check className="w-3 h-3 text-teal-400" /> : <Copy className="w-3 h-3" />}
                {copied ? 'Copiado!' : 'Copiar SQL'}
              </button>
            </div>

            <p className="text-[11px] text-emerald-300/80 font-sans leading-relaxed">
              Crie tabelas, privilégios RLS na sua instância do Supabase colando este script no console.
            </p>

            <div className="w-full bg-emerald-950 border border-white/10 rounded-xl p-3 max-h-[140px] overflow-auto">
              <pre className="text-[9px] leading-relaxed font-mono text-emerald-400/80 whitespace-pre">
                {DATABASE_SQL_SCHEMA}
              </pre>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
