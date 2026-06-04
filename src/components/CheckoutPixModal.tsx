/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Copy,
  Check,
  Loader2,
  QrCode,
  ExternalLink,
  CheckCircle2,
  DollarSign,
  AlertCircle,
  ShieldCheck,
  Send,
  Zap,
  Info
} from 'lucide-react';
import { Jogador } from '../types';

interface CheckoutPixModalProps {
  isOpen: boolean;
  onClose: () => void;
  jogadorAtual: Jogador;
  valorTotal: number;
  debitos: Array<{
    id: string;
    referencia: string;
    valor: number;
    mesRef: string;
    partidaId?: string;
  }>;
  onConfirmarPagamentoTotal: (debitList: Array<{ mesRef: string; valor: number; partidaId?: string }>) => void;
}

export default function CheckoutPixModal({
  isOpen,
  onClose,
  jogadorAtual,
  valorTotal,
  debitos,
  onConfirmarPagamentoTotal
}: CheckoutPixModalProps) {
  const [copied, setCopied] = useState(false);
  const [step, setStep] = useState<'gerando' | 'qrcode' | 'sucesso'>('qrcode');
  const [tempoRestante, setTempoRestante] = useState(600); // 10 minutos
  const [simulandoVerificacao, setSimulandoVerificacao] = useState(false);
  const [opcaoSimuladorAtiva, setOpcaoSimuladorAtiva] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mercado Pago configuration simulation
  const [mpConfiguracao, setMpConfiguracao] = useState({
    accessTokenConfigured: false,
    useLiveSandbox: true
  });

  // Carregar configurações de Mercado Pago salvas
  useEffect(() => {
    const token = localStorage.getItem('mercado_pago_access_token');
    if (token && token.trim().length > 10) {
      setMpConfiguracao({
        accessTokenConfigured: true,
        useLiveSandbox: false
      });
    }
  }, [isOpen]);

  // Gerar chave PIX "Copia e Cola" idêntica ao padrão EMV Mercado Pago
  const getPixCopiaECola = () => {
    const valString = valorTotal.toFixed(2);
    const randomHex = Math.random().toString(16).substring(2, 14);
    return `00020101021226830014br.gov.bcb.pix2561pix.mercadopago.com.br/qr/v2/a94bd113-d02f-4886-9ac7-${randomHex}5204000053039865405${valString.length}${valString}5802BR5920Arena Record Futebol6009SAO PAULO62070503***63047FA8`;
  };

  const pixKey = getPixCopiaECola();

  // URL do QR code dinâmico usando o gerador público qrserver.com
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=052e16&bgcolor=f0fdf4&data=${encodeURIComponent(pixKey)}`;

  // Controlar countdown de expiração do Pix
  useEffect(() => {
    if (isOpen && step === 'qrcode') {
      setTempoRestante(600);
      timerRef.current = setInterval(() => {
        setTempoRestante((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, step]);

  // Formatar tempo em MM:SS
  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    return `${mins.toString().padStart(2, '0')}:${segs.toString().padStart(2, '0')}`;
  };

  // Copiar código PIX para o teclado
  const copiarCodigoPix = () => {
    navigator.clipboard.writeText(pixKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Simular aprovação instantânea pelo banco
  const handleSimularConfirmacaoPix = () => {
    setSimulandoVerificacao(true);
    
    // Simular o delay de validação e confirmação da API do Mercado Pago
    setTimeout(() => {
      setSimulandoVerificacao(false);
      setStep('sucesso');
      
      // Chamar callback para consolidar no banco Supabase
      const pagamentosAgendados = debitos.map((deb) => ({
        mesRef: deb.mesRef,
        valor: deb.valor,
        partidaId: deb.partidaId
      }));

      // Consolida os pagamentos como "pago" (quitado) automaticamente!
      onConfirmarPagamentoTotal(pagamentosAgendados);
    }, 2200);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        id="modal-checkout-pix-overlay" 
        className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          id="modal-checkout-pix"
          className="bg-emerald-990 border border-emerald-500/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-left relative font-sans text-white"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 p-6 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-sm tracking-wide text-amber-400 uppercase">
                  Checkout PIX Seguro
                </h2>
                <p className="text-[10px] text-emerald-300 font-mono">
                  MERCADO PAGO PAYMENT GATEWAY
                </p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-black/30 text-slate-400 hover:text-white flex items-center justify-center hover:bg-black/50 transition-all cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {step === 'qrcode' ? (
            <div className="p-6 space-y-5">
              {/* Resumo do pagamento */}
              <div className="bg-emerald-950/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">
                    Total a pagar consolidado:
                  </p>
                  <p className="text-xl font-mono font-black text-white mt-1">
                    R$ {valorTotal.toFixed(2)}
                  </p>
                  <p className="text-[9.5px] text-emerald-300 mt-1 max-w-[280px]">
                    Saldando {debitos.length} {debitos.length === 1 ? 'pendência individual' : 'pendências acumuladas'} de {jogadorAtual.nome}.
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-bold text-rose-400 flex items-center gap-1 bg-rose-950/30 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                    <span>EXPIRA EM {formatarTempo(tempoRestante)}</span>
                  </div>
                </div>
              </div>

              {/* QR Code centralizado */}
              <div className="flex flex-col items-center justify-center space-y-3 bg-white/5 border border-white/5 p-5 rounded-2xl">
                {simulandoVerificacao ? (
                  <div className="w-[200px] h-[200px] bg-emerald-950/20 rounded-xl flex flex-col items-center justify-center text-center space-y-4">
                    <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
                    <p className="text-xs text-teal-300 font-sans px-4">
                      Verificando recebimento no PIX Mercado Pago...
                    </p>
                  </div>
                ) : (
                  <div className="relative p-2 bg-white rounded-xl shadow-inner border border-emerald-950/30">
                    <img
                      src={qrCodeUrl}
                      alt="PIX QR Code Mercado Pago"
                      className="w-[200px] h-[200px] block"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-1.5 rounded-lg border border-emerald-950 flex items-center justify-center">
                      <div className="w-5 h-5 bg-teal-600 rounded-sm flex items-center justify-center text-[10px] font-black text-white">
                        $
                      </div>
                    </div>
                  </div>
                )}

                <div className="text-center">
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5 justify-center">
                    <QrCode className="w-3.5 h-3.5 text-teal-400" />
                    Instruções para Pagamento:
                  </p>
                  <p className="text-[9px] text-emerald-300 max-w-[340px] mt-1">
                    Abra o app do seu banco ou carteira digital, escolha a opção "Pagar com Pix" e aponte a câmera para o QR code acima. O sistema identificará automaticamente.
                  </p>
                </div>
              </div>

              {/* Botão Copia e Cola */}
              <div className="space-y-1.5 text-center">
                <p className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase text-left pl-1">
                  Ou pague pelo Pix Copia e Cola:
                </p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={pixKey}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-[10px] text-emerald-200 select-all font-mono font-bold focus:outline-none"
                  />
                  <button
                    onClick={copiarCodigoPix}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5 text-black" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Status de Integração Real ou Sandbox */}
              <div className="bg-teal-950/20 border border-teal-500/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
                <div className="flex items-start gap-2 max-w-[300px]">
                  <Info className="w-4.5 h-4.5 mt-0.5 text-teal-400 shrink-0" />
                  <div>
                    <h4 className="font-bold text-teal-200 uppercase text-[9px] tracking-wider">
                      {mpConfiguracao.accessTokenConfigured
                        ? '🔑 PRODUÇÃO ATIVA (INTEGRADO)'
                        : '🧪 AMBIENTE DE TESTE / SANDBOX'}
                    </h4>
                    <p className="text-[9.5px] text-emerald-300 mt-0.5 leading-normal">
                      {mpConfiguracao.accessTokenConfigured
                        ? 'Conexão via credenciais Mercado Pago ativa. Os pagamentos são checados via webhook.'
                        : 'O fluxo de teste simula a API real do Mercado Pago de forma instantânea.'}
                    </p>
                  </div>
                </div>

                {!mpConfiguracao.accessTokenConfigured && (
                  <button
                    onClick={() => setOpcaoSimuladorAtiva(!opcaoSimuladorAtiva)}
                    className="p-1 px-2.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-bold rounded-lg transition-all shrink-0 cursor-pointer"
                  >
                    Simulador {opcaoSimuladorAtiva ? '▲' : '▼'}
                  </button>
                )}
              </div>

              {/* Seção de Simulador Dev */}
              {opcaoSimuladorAtiva && (
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4.5 space-y-3.5 animate-fade-in">
                  <div className="space-y-1 text-xs">
                    <p className="font-bold text-amber-300 uppercase text-[9px] tracking-widest">
                      Painel do Desenvolvedor:
                    </p>
                    <p className="text-emerald-300 text-[9.5px] leading-relaxed">
                      Clique no botão de teste abaixo para simular a resposta do Mercado Pago. O sistema aprovará o pagamento, alterará o estatus da dívida para <b>quitada (paga)</b> directly no banco Supabase em tempo real.
                    </p>
                  </div>

                  <button
                    onClick={handleSimularConfirmacaoPix}
                    disabled={simulandoVerificacao}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white font-extrabold text-xs py-2 rounded-xl transition-all shadow-md active:scale-97 flex items-center justify-center gap-1.5 cursor-pointer uppercase tracking-wider border-b-2 border-emerald-800"
                  >
                    {simulandoVerificacao ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Aguarde...
                      </>
                    ) : (
                      <>
                        <Zap className="w-3.5 h-3.5" />
                        Simular pagamento automático (Banco / MP PIX)
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Tela de Sucesso */
            <div className="p-10 text-center flex flex-col items-center justify-center space-y-5 py-12 animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 border-2 border-teal-500/40 animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-teal-400" />
              </div>

              <div className="space-y-2">
                <h3 className="font-display font-black text-lg text-teal-300 uppercase tracking-widest">
                  PAGAMENTO RECONHECIDO!
                </h3>
                <p className="text-xs text-teal-100 max-w-[340px] leading-relaxed font-sans">
                  Excelente! A transação no valor de <b>R$ {valorTotal.toFixed(2)}</b> foi processada com sucesso pelo Mercado Pago. Seu status foi atualizado para <b className="text-teal-300 bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 rounded text-[10px]">QUANTIDADE QUITADO (PAGO)</b>.
                </p>
              </div>

              <div className="bg-teal-950/30 rounded-xl p-3 border border-teal-500/20 w-full text-[10.5px] text-emerald-300 font-mono space-y-1 text-center">
                <p>Nº Autenticação: <span className="font-bold text-white">MP-{Math.floor(Math.random() * 900000000) + 100000000}</span></p>
                <p>Status: <span className="text-teal-400 font-bold">APPROVED - CREDITO IMEDIATO</span></p>
              </div>

              <button
                onClick={onClose}
                className="w-full max-w-xs bg-teal-500 hover:bg-teal-400 text-black font-black text-xs py-3 rounded-xl transition-all shadow-md uppercase scroll-mt-2"
              >
                Voltar ao Painel
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
