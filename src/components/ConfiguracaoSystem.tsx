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
  onSendTestAlert: (msg?: string) => void;
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

  useEffect(() => {
    const creds = obterCredenciaisSupabase();
    setSupaUrl(creds.url);
    setSupaKey(creds.key);
    setIsLive(!!getSupabase());

    // Carregar credenciais Mercado Pago e Chave PIX direta
    setMpAccessToken(localStorage.getItem('mercado_pago_access_token') || '');
    setMpPublicKey(localStorage.getItem('mercado_pago_public_key') || '');
    setDiretoPixChave(localStorage.getItem('direto_pix_chave') || '');
    setDiretoPixNome(localStorage.getItem('direto_pix_nome') || 'Arena Record');
    setDiretoPixCidade(localStorage.getItem('direto_pix_cidade') || 'SAO PAULO');
  }, []);

  const handleSalvarMercadoPago = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('mercado_pago_access_token', mpAccessToken);
    localStorage.setItem('mercado_pago_public_key', mpPublicKey);
    localStorage.setItem('direto_pix_chave', diretoPixChave);
    localStorage.setItem('direto_pix_nome', diretoPixNome);
    localStorage.setItem('direto_pix_cidade', diretoPixCidade);
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
                whatsappLogs.map((log: any) => (
                  <div key={log.id} className="bg-emerald-950/70 p-2 rounded-lg border border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[8px] text-emerald-500">
                      <span>{log.enviado_em ? new Date(log.enviado_em).toLocaleString('pt-BR') : log.data}</span>
                      <span className="px-1.5 py-0.2 bg-emerald-900 border border-emerald-500/20 text-emerald-300 rounded uppercase text-[7px] font-black">
                        {log.evento || 'DISPARO'}
                      </span>
                    </div>
                    <div className="text-[10px] text-white leading-relaxed">
                      <span className="font-bold text-teal-300 font-sans mr-1">[{log.tabela || log.atleta || ''}]</span>
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

          {/* MENSAGENS PADRÕES DO SISTEMA */}
          <div className="bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-xl backdrop-blur-sm space-y-4">
            <h3 className="font-display font-semibold text-xs text-white flex items-center gap-2 uppercase tracking-wide">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              Templates de Mensagens do Robô
            </h3>
            
            <p className="text-[10px] text-emerald-300/80 leading-relaxed font-sans">
              Testes práticos para checar a automação das 4 mensagens principais.
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
                  setSuccessMsg('Mensagem 1 disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 1: Jogo Agendado
              </button>
            </div>

            {/* MESSAGE 2 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">2. Confirmação de Presença</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`⚽ *CONFIRMAÇÃO DE PELADA - FC* ⚽

Fala galera! O atleta *[Nome do Atleta]* confirmou presença para a partida:

🏆 *[Partida Teste]*
📅 Data: *Sábado, 25/06/2026 às 08:00*
📍 Local: *Campo do Batista*

_Bora pro jogo tirar aquela onda!_ 💪🏃‍♂️💨`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`⚽ *CONFIRMAÇÃO DE PELADA - FC* ⚽\n\nFala galera! O atleta *[Nome do Atleta]* confirmou presença para a partida:\n\n🏆 *[Partida Teste]*\n📅 Data: *Sábado, 25/06/2026 às 08:00*\n📍 Local: *Campo do Batista*\n\n_Bora pro jogo tirar aquela onda!_ 💪🏃‍♂️💨`);
                  setSuccessMsg('Mensagem 2 disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 2: Confirmação Presença
              </button>
            </div>

            {/* MESSAGE 3 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">3. Quitação de Mensalidade</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA SÁBADO* 💰

Atleta: *[Nome do Atleta]* (Ataque) 🏅
Referência: *06/2026*
Valor Quitado: *R$ 60.00*
Status: *PAGO & CONFIRMADO* ✅

📊 *Informativo Financeiro:*
- Total de mensalistas quitados neste período: *15* (Limite regulamentado de 25 mensalistas)

Muito obrigado pelo compromisso em manter o nosso futebol rodando redondo de campo pago e bola cheia! 🤝⚽🏃‍♂️💨`}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSendTestAlert(`💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA SÁBADO* 💰\n\nAtleta: *[Nome do Atleta]* (Ataque) 🏅\nReferência: *06/2026*\nValor Quitado: *R$ 60.00*\nStatus: *PAGO & CONFIRMADO* ✅\n\n📊 *Informativo Financeiro:*\n- Total de mensalistas quitados neste período: *15* (Limite regulamentado de 25 mensalistas)\n\nMuito obrigado pelo compromisso em manter o nosso futebol rodando redondo de campo pago e bola cheia! 🤝⚽🏃‍♂️💨`);
                  setSuccessMsg('Mensagem 3 disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 3: Quitação Pagamento
              </button>
            </div>

            {/* MESSAGE 4 */}
            <div className="bg-emerald-950/70 p-3 rounded-lg border border-white/5 space-y-2">
              <strong className="text-white text-[10px] block font-sans">4. Convocação & Presença Atualizada</strong>
              <div className="font-mono text-[8px] text-emerald-300 whitespace-pre">
{`⚽ *PELADA BATISTA SÁBADO* ⚽
🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆

📅 Jogo: *[Partida Teste]*
🗓️ Data: *Sábado, 25 de junho* às *08:00*
📍 Local: *Campo do Batista*

*A - MENSALISTAS:*
1. *[Nome Mensalista]* - Meio 🏅

*B - DIARISTAS:*
_Nenhum diarista confirmado ainda_

*C - GOLEIROS:*
1. *[Nome Goleiro]*

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
                  onSendTestAlert(`⚽ *PELADA BATISTA SÁBADO* ⚽\n🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆\n\n📅 Jogo: *[Partida Teste]*\n🗓️ Data: *Sábado, 25 de junho* às *08:00*\n📍 Local: *Campo do Batista*\n\n*A - MENSALISTAS:*\n1. *[Nome Mensalista]* - Meio 🏅\n\n*B - DIARISTAS:*\n_Nenhum diarista confirmado ainda_\n\n*C - GOLEIROS:*\n1. *[Nome Goleiro]*\n\n*D - JOGADORES AUSENTES:*\n_Nenhuma ausência registrada_\n\n*E - LISTA DE ESPERA:*\n_Nenhum jogador em lista de espera_\n\n----------------------------------------\n📲 Acesse o portal oficial para confirmar ou alterar sua presença:\nhttps://peladabatista.onrender.com`);
                  setSuccessMsg('Mensagem 4 disparada!');
                  setTimeout(() => setSuccessMsg(''), 4000);
                }}
                className="w-full bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-[9px] py-1.5 flex items-center justify-center gap-1.5 rounded transition-colors"
              >
                <Send className="w-3 h-3 text-teal-300" /> Teste 4: Convocação Consolidada
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
                    placeholder="Ex: pix@arena.com ou 123.456.789-00 ou celular"
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

        </div>

      </div>

    </div>
  );
}
