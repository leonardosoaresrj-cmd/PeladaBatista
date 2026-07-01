/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Jogador, PosicaoJogador, MembroStatus } from '../types';
import { AVATAR_PRESETS } from '../data';
import { KeyRound, Mail, User, Calendar, Shield, Users, Check, AlertCircle, ArrowLeft, Send, Loader2 } from 'lucide-react';
import logoPelada from '../assets/images/logo_pelada.svg';
import { isFechamentoMensalistas, obterJanelaRenovacaoParaMesRef } from '../utils/confirmationRules';
import { obterCredenciaisSupabase } from '../supabaseClient';

interface LoginCadastroProps {
  jogadores: Jogador[];
  onLoginSuccess: (jogador: Jogador) => void;
  onRegistrar: (novo: Omit<Jogador, 'id' | 'status' | 'role' | 'createdAt'>) => void;
}

export default function LoginCadastro({ jogadores, onLoginSuccess, onRegistrar }: LoginCadastroProps) {
  const [isLogin, setIsLogin] = useState(true);
  
  // Login State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');

  const quickLogin = (emailStr: string, pinStr: string) => {
    setLoginEmail(emailStr);
    setLoginPin(pinStr);
    setLoginError('');
  };

  // Sign Up State
  const [nome, setNome] = useState('');
  const [sobrenome, setSobrenome] = useState('');
  const [posicao, setPosicao] = useState<PosicaoJogador>('Meio');
  const [dataNascimento, setDataNascimento] = useState('');
  const [foto, setFoto] = useState('');
  const [membroStatus, setMembroStatus] = useState<MembroStatus>(() => {
    return isFechamentoMensalistas().emPeriodo ? 'mensalista' : 'diarista';
  });
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [singupSuccess, setSingupSuccess] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [showForaRenovacaoModal, setShowForaRenovacaoModal] = useState(false);

  // Password Recovery State
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [recoverySuccess, setRecoverySuccess] = useState(false);
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveredPin, setRecoveredPin] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoverySuccess(false);

    if (!recoveryEmail.trim()) {
      setRecoveryError('Por favor, informe seu e-mail cadastrado.');
      return;
    }

    const found = jogadores.find(j => j.email.toLowerCase().trim() === recoveryEmail.toLowerCase().trim());
    if (!found) {
      setRecoveryError('O e-mail informado não consta no elenco de cadastrados do portal.');
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch('/api/recover-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: found.email,
          nome: `${found.nome} ${found.sobrenome || ''}`.trim(),
          senha: found.senha
        })
      });

      let data;
      const textResponse = await response.text();
      try {
        data = JSON.parse(textResponse);
      } catch (err) {
        console.error('Resposta não-JSON do servidor:', textResponse);
        throw new Error('Servidor retornou uma resposta inesperada. Verifique os logs.');
      }

      if (response.ok) {
        setRecoverySuccess(true);
      } else {
        setRecoveryError(data?.error || data?.details || 'Erro ao tentar enviar o e-mail pela API.');
      }
    } catch (error: any) {
      console.error('Erro no envio de recuperação:', error);
      setRecoveryError(`Falha na requisição: ${error.message || 'Erro de conexão.'}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setSignupError('A imagem do avatar deve ter no máximo 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setFoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const found = jogadores.find(j => j.email.toLowerCase().trim() === loginEmail.toLowerCase().trim());
    
    if (!found) {
      setLoginError('Email não cadastrado.');
      return;
    }

    if (found.senha !== loginPin) {
      setLoginError('Senha (PIN) incorreta.');
      return;
    }

    if (found.status === 'pendente_aprovacao') {
      setLoginError('Seu cadastro ainda está pendente de aprovação pelo administrador do portal.');
      return;
    }

    if (found.status === 'suspenso') {
      onLoginSuccess(found);
      return;
    }

    onLoginSuccess(found);
  };

  const handleMembroStatusChange = (status: MembroStatus) => {
    if (status === 'mensalista') {
      const infoFechamento = isFechamentoMensalistas();
      if (!infoFechamento.emPeriodo) {
        setShowForaRenovacaoModal(true);
        setMembroStatus('mensalista');
        return;
      }
    }
    setMembroStatus(status);
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError('');
    setSingupSuccess(false);

    if (!nome.trim() || !sobrenome.trim() || !dataNascimento || !email.trim() || !pin) {
      setSignupError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    if (pin.length !== 4 || isNaN(Number(pin))) {
      setSignupError('A senha deve ser um PIN numérico de exatamente 4 dígitos.');
      return;
    }

    // Check if email already exists
    const exists = jogadores.some(j => j.email.toLowerCase().trim() === email.toLowerCase().trim());
    if (exists) {
      setSignupError('Este email já está cadastrado no sistema.');
      return;
    }

    let finalMembroStatus = membroStatus;
    if (membroStatus === 'mensalista') {
      const infoFechamento = isFechamentoMensalistas();
      if (!infoFechamento.emPeriodo) {
        finalMembroStatus = 'diarista';
        setMembroStatus('diarista');
        setShowForaRenovacaoModal(true);
      }
    }

    onRegistrar({
      nome: nome.trim(),
      sobrenome: sobrenome.trim(),
      posicao,
      dataNascimento,
      foto,
      membroStatus: finalMembroStatus,
      email: email.toLowerCase().trim(),
      senha: pin,
      isGold: false,
    });

    setSingupSuccess(true);
    // Reset form
    setNome('');
    setSobrenome('');
    setDataNascimento('');
    setEmail('');
    setPin('');
    setFoto('');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 py-8">
      {/* Visual de tática / futebol de fundo discreto */}
      <div className="w-full max-w-md bg-emerald-900/40 border border-white/15 rounded-2xl shadow-2xl overflow-hidden relative backdrop-blur-sm">
        
        {/* Banner do Estádio */}
        <div className="bg-gradient-to-r from-emerald-950 to-emerald-900 py-6 px-6 relative border-b border-white/10 text-center">
          <div className="absolute inset-0 bg-radial-gradient from-white/5 to-transparent pointer-events-none" />
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-900/40 border border-white/15 p-2 text-white mb-2 shadow-inner hover:scale-105 transition-transform duration-300">
            <img 
              src={logoPelada} 
              alt="Pelada Batista Logo" 
              className="w-full h-full object-contain filter drop-shadow(0 2px 8px rgba(0,0,0,0.4))"
              referrerPolicy="no-referrer"
            />
          </div>
          <h2 className="text-2xl font-display font-bold text-white tracking-wide">PELADA BATISTA SÁBADO</h2>
          <p className="text-xs text-emerald-400 font-semibold tracking-widest uppercase mt-0.5">SISTEMA DE GESTÃO DA PELADA</p>
        </div>

        {/* Abas */}
        <div className="flex border-b border-white/10 bg-emerald-950/40">
          <button
            id="btn-aba-login"
            type="button"
            className={`flex-1 py-3 text-center text-sm font-semibold transition-all ${
              isLogin 
                ? 'text-white border-b-2 border-white bg-white/5 font-bold' 
                : 'text-emerald-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => { setIsLogin(true); setLoginError(''); }}
          >
            Entrar no Portal
          </button>
          <button
            id="btn-aba-cadastrar"
            type="button"
            className={`flex-1 py-3 text-center text-sm font-semibold transition-all ${
              !isLogin 
                ? 'text-white border-b-2 border-white bg-white/5 font-bold' 
                : 'text-emerald-300 hover:text-white hover:bg-white/5'
            }`}
            onClick={() => { setIsLogin(false); setSignupError(''); setSingupSuccess(false); }}
          >
            Nova Conta
          </button>
        </div>

        <div className="p-6">
          {isLogin ? (
            isRecoveryMode ? (
              /* FORMULÁRIO DE RECUPERAÇÃO DE SENHA */
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-white/5">
                  <button
                    type="button"
                    onClick={() => { setIsRecoveryMode(false); setRecoveryError(''); setRecoverySuccess(false); }}
                    className="p-1 rounded-md hover:bg-white/10 text-emerald-400 hover:text-white transition-colors cursor-pointer"
                    title="Voltar ao Login"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm font-semibold text-white tracking-wide">Recuperar Senha (PIN)</span>
                </div>

                {recoveryError && (
                  <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-500/20 text-rose-200 text-xs px-3 py-2.5 rounded-lg animate-pulse">
                    <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                    <span>{recoveryError}</span>
                  </div>
                )}

                {recoverySuccess ? (
                  <div className="bg-emerald-950/60 border border-teal-500/10 rounded-xl p-4 space-y-4 text-left">
                    <div className="flex items-center gap-1.5 text-teal-400">
                      <Check className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Disparo Realizado!</span>
                    </div>
                    <p className="text-xs text-emerald-200 leading-relaxed">
                      O sistema localizou seu cadastro e enviou as credenciais para o e-mail: <strong className="text-white font-medium">{recoveryEmail.toLowerCase().trim()}</strong>.
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        setIsRecoveryMode(false);
                        setRecoverySuccess(false);
                        setRecoveryError('');
                      }}
                      className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-lg text-sm transition-all shadow-md cursor-pointer uppercase tracking-wider text-[11px] hover:scale-[1.01]"
                    >
                      Voltar para o Login
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleRecoverySubmit} className="space-y-4">
                    <p className="text-xs text-emerald-200/90 leading-relaxed font-sans mt-1">
                      Insira o seu e-mail cadastrado abaixo. O sistema verificará seu cadastro no portal e reenviará o seu PIN de acesso de 4 dígitos.
                    </p>

                    <div>
                      <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1.5">Email Cadastrado</label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-emerald-450" />
                        <input
                          id="input-recovery-email"
                          type="email"
                          required
                          placeholder="exemplo@email.com"
                          value={recoveryEmail}
                          onChange={(e) => setRecoveryEmail(e.target.value)}
                          className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all font-sans"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSending}
                      className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-emerald-900" />
                          <span>Disparando correio...</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4 text-emerald-900" />
                          <span>Enviar Senha por E-mail</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => { setIsRecoveryMode(false); setRecoveryError(''); }}
                      className="w-full bg-emerald-950/30 hover:bg-emerald-950/50 text-emerald-300 font-bold py-2 rounded-lg text-xs border border-white/5 transition-all text-center cursor-pointer"
                    >
                      Voltar ao Login
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* FORMULÁRIO DE LOGIN */
              <form onSubmit={handleLoginSubmit} className="space-y-4">
                {loginError && (
                  <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-500/20 text-rose-200 text-xs px-3 py-2.5 rounded-lg animate-pulse">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1.5">Email Cadastrado</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-emerald-450" />
                    <input
                      id="input-login-email"
                      type="email"
                      required
                      placeholder="exemplo@email.com"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all font-sans"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider">Senha (PIN de 4 Números)</label>
                    <button
                      id="btn-login-forgot-pin"
                      type="button"
                      onClick={() => {
                        setIsRecoveryMode(true);
                        setRecoveryEmail(loginEmail);
                        setRecoverySuccess(false);
                        setRecoveryError('');
                      }}
                      className="text-[10px] text-teal-400 hover:text-white transition-colors hover:underline focus:outline-none font-bold uppercase tracking-wider cursor-pointer decoration-dotted underline-offset-2"
                    >
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-emerald-450" />
                    <input
                      id="input-login-pin"
                      type="password"
                      maxLength={4}
                      required
                      placeholder="••••"
                      value={loginPin}
                      onChange={(e) => setLoginPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg pl-9 pr-3 py-2 text-sm tracking-widest font-mono focus:outline-none focus:border-white focus:ring-1 focus:ring-white/10 transition-all"
                    />
                  </div>
                </div>

                <button
                  id="btn-login-submit"
                  type="submit"
                  className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Shield className="w-4 h-4 text-emerald-900" />
                  Entrar no Elenco
                </button>
              </form>
            )
          ) : (
            /* FORMULÁRIO DE CADASTRO */
            <form onSubmit={handleSignUpSubmit} className="space-y-4">
              {signupError && (
                <div className="flex items-start gap-2 bg-rose-950/50 border border-rose-500/20 text-rose-200 text-xs px-3 py-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-rose-450 shrink-0 mt-0.5" />
                  <span>{signupError}</span>
                </div>
              )}



              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Nome</label>
                  <input
                    id="input-nome"
                    type="text"
                    required
                    placeholder="Neymar"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-white transition-all font-sans"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Sobrenome</label>
                  <input
                    id="input-sobrenome"
                    type="text"
                    required
                    placeholder="Santos"
                    value={sobrenome}
                    onChange={(e) => setSobrenome(e.target.value)}
                    className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-white transition-all font-sans"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Posição</label>
                  <select
                    id="select-posicao"
                    value={posicao}
                    onChange={(e) => {
                      const newPos = e.target.value as PosicaoJogador;
                      setPosicao(newPos);
                      if (newPos === 'Goleiro') {
                        setMembroStatus('isento');
                      } else if (membroStatus === 'isento') {
                        setMembroStatus('mensalista');
                      }
                    }}
                    className="w-full bg-emerald-950 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-white transition-all font-sans"
                  >
                    <option className="bg-emerald-950 text-white" value="Goleiro">🧤 Goleiro</option>
                    <option className="bg-emerald-950 text-white" value="Defesa">🛡️ Defesa</option>
                    <option className="bg-emerald-950 text-white" value="Meio">🎯 Meio-Campo</option>
                    <option className="bg-emerald-950 text-white" value="Ataque">⚡ Ataque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Membro</label>
                  <select
                    id="select-membro"
                    value={membroStatus}
                    onChange={(e) => handleMembroStatusChange(e.target.value as MembroStatus)}
                    className="w-full bg-emerald-950 border border-white/10 text-white rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:border-white transition-all font-sans"
                  >
                    {posicao === 'Goleiro' ? (
                      <option className="bg-emerald-950 text-white" value="isento">🧤 Isento</option>
                    ) : (
                      <>
                        <option className="bg-emerald-950 text-white" value="mensalista">📅 Mensalista</option>
                        <option className="bg-emerald-950 text-white" value="diarista">⚽ Diarista</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Data de Aniversário</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 w-4 h-4 text-emerald-400" />
                  <input
                    id="input-aniversario"
                    type="date"
                    required
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full bg-emerald-950/40 border border-white/10 text-white rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-white transition-all font-sans"
                  />
                </div>
              </div>

              <div className="bg-emerald-950/30 border border-white/5 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider font-sans">INSIRA SUA FOTO</label>
                  {foto && (
                    <button
                      type="button"
                      onClick={() => setFoto('')}
                      className="text-[9px] text-rose-450 hover:text-rose-400 font-bold uppercase"
                    >
                      Remover imagem
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {/* Live Preview */}
                  <div className="w-12 h-12 rounded-full border border-white/10 bg-emerald-900/50 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    {foto ? (
                      <img
                        src={foto}
                        className="w-full h-full object-cover"
                        alt="Preview"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          // No recursive loading loops
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : (
                      <span className="text-xl select-none">
                        {posicao === 'Goleiro' ? '🧤' : posicao === 'Defesa' ? '🛡️' : posicao === 'Meio' ? '🧠' : '🚀'}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="relative">
                      <input
                        type="file"
                        id="avatar-file-upload"
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <label
                        htmlFor="avatar-file-upload"
                        className="inline-flex items-center justify-center w-full px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg text-xs font-bold text-white cursor-pointer transition-all text-center"
                      >
                        Selecionar Arquivo de Imagem
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Email (Utilizado para Login)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 w-4 h-4 text-emerald-400" />
                  <input
                    id="input-signup-email"
                    type="email"
                    required
                    placeholder="meu.email@provedor.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:border-white transition-all font-sans"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-emerald-400 tracking-wider mb-1">Senha PIN (Exatamente 4 Números)</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-emerald-400" />
                  <input
                    id="input-signup-pin"
                    type="password"
                    maxLength={4}
                    required
                    placeholder="Ex: 5820"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-emerald-950/40 border border-white/10 text-white placeholder-emerald-600/60 rounded-lg pl-9 pr-3 py-1.5 text-sm font-mono tracking-widest focus:outline-none focus:border-white transition-all"
                  />
                </div>
              </div>


              <button
                id="btn-signup-submit"
                type="submit"
                className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2 rounded-lg text-sm transition-all shadow-md flex items-center justify-center gap-1 hover:scale-[1.01] active:scale-[0.99]"
              >
                <User className="w-4 h-4" />
                Solicitar Cadastro
              </button>

              <p className="text-[10px] text-emerald-300 text-center leading-relaxed">
                Ao solicitar o cadastro, seus dados ficarão visíveis para a administração geral do portal realizar a liberação do seu perfil.
              </p>
            </form>
          )}
        </div>
      </div>

      {/* Modal Aviso Período de Renovação Encerrado */}
      {showForaRenovacaoModal && (() => {
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

        return (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="w-full max-w-md bg-emerald-950 border border-white/20 rounded-2xl shadow-2xl p-6 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 animate-bounce">
                <AlertCircle className="w-8 h-8" />
              </div>
              
              <h3 className="text-xl font-display font-bold text-white tracking-wide">Fora do Período de Renovação</h3>
              
              <div className="text-emerald-200 text-sm leading-relaxed space-y-3">
                <p>
                  O período de renovação de mensalidade não está ativo neste momento.
                </p>
                <p className="bg-emerald-900/60 border border-white/5 rounded-lg p-3.5 text-emerald-350 text-xs text-left leading-relaxed">
                  Por este motivo, seu perfil será cadastrado como <strong className="text-white font-semibold">Diarista</strong>. Você poderá solicitar a alteração do seu status para Mensalista no início do próximo ciclo de renovação da mensalidade!
                </p>

                <div className="mt-2 bg-black/30 p-2.5 rounded-xl border border-white/10">
                  <p className="text-[9px] text-emerald-350 font-mono uppercase tracking-wide">Próxima Janela de Renovação</p>
                  <p className="text-xs font-bold text-white mt-0.5">{dtInicio} a {dtFim}</p>
                </div>
              </div>

              <button
                id="btn-confirm-fora-renovacao"
                type="button"
                onClick={() => {
                  setShowForaRenovacaoModal(false);
                  setMembroStatus('diarista');
                }}
                className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-lg text-sm transition-all shadow-md uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Ciente e Continuar como Diarista
              </button>
            </div>
          </div>
        );
      })()}

      {/* Modal Confirmação de Pré-Registrado */}
      {singupSuccess && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-emerald-950 border border-white/20 rounded-2xl shadow-2xl p-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 animate-pulse">
              <Check className="w-8 h-8 stroke-[3.5px]" />
            </div>
            
            <h3 className="text-xl font-display font-bold text-white tracking-wide">Cadastro Pré-Registrado!</h3>
            
            <div className="text-emerald-250 text-sm leading-relaxed space-y-3">
              <p className="text-emerald-100">
                Sua conta foi criada no portal com sucesso!
              </p>
              <p className="bg-emerald-900/60 border border-white/5 rounded-lg p-3.5 text-emerald-350 text-xs text-left leading-relaxed">
                Para manter a integridade e segurança do campeonato, um <strong className="text-white font-semibold">administrador do jogo</strong> precisa verificar e aprovar o seu cadastro antes de liberar o acesso de login com o seu PIN cadastrado.
              </p>
            </div>

            <button
              id="btn-login-success-close"
              type="button"
              onClick={() => {
                setSingupSuccess(false);
                setIsLogin(true);
              }}
              className="w-full bg-white hover:bg-emerald-100 text-black font-semibold py-2.5 rounded-lg text-sm transition-all shadow-md uppercase tracking-wider text-[11px] cursor-pointer flex items-center justify-center gap-1.5 hover:scale-[1.01] active:scale-[0.99]"
            >
              <ArrowLeft className="w-4 h-4 text-black" />
              Voltar para Tela de Login
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
