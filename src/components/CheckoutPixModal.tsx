/**
 * CheckoutPixModal — Integração REAL com Mercado Pago via Supabase Edge Functions
 *
 * Fluxo:
 * 1. Modal abre → chama Edge Function pix-criar → MP gera cobrança real
 * 2. Exibe QR Code oficial do MP (base64 real)
 * 3. Polling a cada 5s em pix-status → detecta aprovação
 * 4. Quando pago: chama onConfirmarPagamentoTotal → Supabase atualiza status
 * 5. Em paralelo: pix-webhook do MP também grava e notifica o robô WhatsApp
 *
 * Fallback: se Edge Functions não estiverem configuradas,
 * exibe PIX estático (chave direta) com confirmação manual.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Copy, Check, Loader2, QrCode, CheckCircle2,
  DollarSign, AlertCircle, ShieldCheck, Info
} from 'lucide-react';
import { Jogador } from '../types';

// URL base das Edge Functions — ajuste se o project ref mudar
const SUPABASE_FUNCTIONS_URL = 'https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1';

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

type Step = 'gerando' | 'qrcode' | 'sucesso' | 'erro';

export default function CheckoutPixModal({
  isOpen,
  onClose,
  jogadorAtual,
  valorTotal,
  debitos,
  onConfirmarPagamentoTotal,
}: CheckoutPixModalProps) {
  const [copied, setCopied]             = useState(false);
  const [step, setStep]                 = useState<Step>('gerando');
  const [tempoRestante, setTempoRestante] = useState(600);
  const [erroMsg, setErroMsg]           = useState('');
  const [debugInfo, setDebugInfo]       = useState('');
  const [mpPaymentId, setMpPaymentId]   = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64] = useState<string | null>(null);
  const [qrCodeText, setQrCodeText]     = useState<string>('');
  const [modoFallback, setModoFallback] = useState(false);
  const [directPixInfo, setDirectPixInfo] = useState({ chave: '', nome: 'Pelada Batista', cidade: 'RIO DE JANEIRO' });

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Ao abrir: inicia criação do PIX real
  useEffect(() => {
    if (!isOpen) return;
    setStep('gerando');
    setErroMsg('');
    setMpPaymentId(null);
    setModoFallback(false);
    setDirectPixInfo({
      chave: localStorage.getItem('direto_pix_chave') || '',
      nome:  localStorage.getItem('direto_pix_nome')  || 'Pelada Batista',
      cidade:localStorage.getItem('direto_pix_cidade')|| 'RIO DE JANEIRO',
    });
    criarCobrancaMP();
    return () => pararTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const pararTudo = () => {
    if (timerRef.current)   clearInterval(timerRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
  };

  // ── Criar cobrança via Edge Function pix-criar ────────────────────────────
  const criarCobrancaMP = async () => {
    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/pix-criar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorTotal,
          jogadorId:   jogadorAtual.id,
          jogadorNome: `${jogadorAtual.nome} ${jogadorAtual.sobrenome}`,
          debitos: debitos.map(d => ({
            mesRef:    d.mesRef,
            valor:     d.valor,
            partidaId: d.partidaId,
          })),
        }),
      });

      const data = await resp.json();
      const debugMsg = `HTTP ${resp.status} | ${JSON.stringify(data).substring(0, 120)}`;
      setDebugInfo(debugMsg);
      console.log('[pix-criar] resposta:', debugMsg);

      if (resp.ok && data.success && data.qrCodeText) {
        // ✅ MP real — exibe QR oficial
        setMpPaymentId(String(data.paymentId));
        setQrCodeBase64(data.qrCodeBase64 || null);
        setQrCodeText(data.qrCodeText);
        setStep('qrcode');
        iniciarContador();
        iniciarPolling(String(data.paymentId));
      } else {
        // Edge Function indisponível ou MP não configurado → fallback
        ativarFallback(data?.error);
      }
    } catch (e: any) {
      setDebugInfo(`Erro: ${e?.message || String(e)}`);
      ativarFallback();
    }
  };

  // ── Fallback: PIX estático (chave direta) ─────────────────────────────────
  const ativarFallback = (motivo?: string) => {
    const chave = localStorage.getItem('direto_pix_chave') || '';
    if (!chave) {
      setStep('erro');
      setErroMsg(
        motivo
          ? `Pagamento online indisponível: ${motivo}. Configure a Chave PIX direta nas Configurações do portal.`
          : 'Pagamento online indisponível. Configure o Mercado Pago ou uma Chave PIX direta nas Configurações.'
      );
      return;
    }
    setModoFallback(true);
    setQrCodeText(gerarPixEstatico(chave));
    setStep('qrcode');
    iniciarContador();
  };

  // ── Polling de status a cada 5s ───────────────────────────────────────────
  const iniciarPolling = (paymentId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(
          `${SUPABASE_FUNCTIONS_URL}/pix-status?id=${paymentId}`
        );
        const data = await resp.json();
        if (data.pago) {
          pararTudo();
          setStep('sucesso');
          onConfirmarPagamentoTotal(
            debitos.map(d => ({ mesRef: d.mesRef, valor: d.valor, partidaId: d.partidaId }))
          );
        }
      } catch { /* tenta no próximo ciclo */ }
    }, 5000);
  };

  // ── Contador de expiração ─────────────────────────────────────────────────
  const iniciarContador = () => {
    setTempoRestante(600);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setTempoRestante(prev => {
        if (prev <= 1) { pararTudo(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // ── PIX estático EMV (fallback) ───────────────────────────────────────────
  const removerAcentos = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();

  const calcCRC16 = (str: string): string => {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      for (let j = 0; j < 8; j++) {
        const bit = ((c >> (7 - j)) & 1) === 1;
        const c15 = ((crc >> 15) & 1) === 1;
        crc <<= 1;
        if (c15 !== bit) crc ^= 0x1021;
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  };

  const gerarPixEstatico = (chave: string) => {
    const val  = valorTotal.toFixed(2);
    const nome = removerAcentos(directPixInfo.nome.substring(0, 25).trim() || 'PELADA BATISTA');
    const cidade = removerAcentos(directPixInfo.cidade.substring(0, 15).trim() || 'RIO DE JANEIRO');
    const sub  = `0014br.gov.bcb.pix01${chave.length.toString().padStart(2,'0')}${chave}`;
    const t26  = `26${sub.length.toString().padStart(2,'0')}${sub}`;
    const base = `000201${t26}52040000530398654${val.length.toString().padStart(2,'0')}${val}5802BR59${nome.length.toString().padStart(2,'0')}${nome}60${cidade.length.toString().padStart(2,'0')}${cidade}62070503***6304`;
    return base + calcCRC16(base);
  };

  const formatarTempo = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const copiarCodigo = () => {
    navigator.clipboard.writeText(qrCodeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Imagem do QR: MP retorna base64 real; fallback usa gerador externo
  const qrSrc = qrCodeBase64
    ? `data:image/png;base64,${qrCodeBase64}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=280x280&color=052e16&bgcolor=f0fdf4&data=${encodeURIComponent(qrCodeText)}`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-start justify-center p-4 overflow-y-auto pt-[80px]">
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 15 }}
          className="bg-emerald-990 border border-emerald-500/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-left relative font-sans text-white flex flex-col max-h-[calc(100vh-120px)]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-950/60 to-emerald-900/40 p-6 border-b border-white/5 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <h2 className="font-display font-bold text-sm tracking-wide text-amber-400 uppercase">Checkout PIX Seguro</h2>
                <p className="text-[10px] text-emerald-300 font-mono">
                  {modoFallback ? 'PIX DIRETO (CHAVE ESTÁTICA)' : 'MERCADO PAGO PAYMENT GATEWAY'}
                </p>
              </div>
            </div>
            <button onClick={() => { pararTudo(); onClose(); }}
              className="w-8 h-8 rounded-full bg-black/30 text-slate-400 hover:text-white flex items-center justify-center hover:bg-black/50 transition-all cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── GERANDO ── */}
          {step === 'gerando' && (
            <div className="p-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
              <p className="text-xs text-teal-300">Gerando cobrança PIX no Mercado Pago...</p>
              {debugInfo && <p className="text-[10px] text-yellow-400 font-mono mt-2 text-center max-w-[320px] break-all">{debugInfo}</p>}
            </div>
          )}

          {/* ── ERRO ── */}
          {step === 'erro' && (
            <div className="p-8 flex flex-col items-center justify-center space-y-4 text-center">
              <AlertCircle className="w-12 h-12 text-rose-400" />
              <p className="text-xs text-rose-200 max-w-[340px] leading-relaxed">{erroMsg}</p>
              <button onClick={onClose}
                className="px-6 py-2.5 bg-rose-500 text-black font-bold text-xs rounded-xl cursor-pointer">
                Fechar
              </button>
            </div>
          )}

          {/* ── QR CODE ── */}
          {step === 'qrcode' && (
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Resumo */}
              <div className="bg-emerald-950/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">Total a pagar:</p>
                  <p className="text-xl font-mono font-black text-white mt-1">R$ {valorTotal.toFixed(2)}</p>
                  <p className="text-[9.5px] text-emerald-300 mt-1 max-w-[280px]">
                    {debitos.length} {debitos.length === 1 ? 'pendência' : 'pendências'} de {jogadorAtual.nome}
                  </p>
                </div>
                <div className="text-[9px] font-bold text-rose-400 flex items-center gap-1 bg-rose-950/30 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  EXPIRA EM {formatarTempo(tempoRestante)}
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center justify-center space-y-3 bg-white/5 border border-white/5 p-5 rounded-2xl">
                <div className="relative p-2 bg-white rounded-xl shadow-inner border border-emerald-950/30">
                  <img src={qrSrc} alt="PIX QR Code" className="w-[200px] h-[200px] block" referrerPolicy="no-referrer" />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-bold text-white flex items-center gap-1.5 justify-center">
                    <QrCode className="w-3.5 h-3.5 text-teal-400" />
                    Escaneie com o app do seu banco
                  </p>
                  {!modoFallback && (
                    <p className="text-[9px] text-teal-300 max-w-[340px] mt-1 flex items-center gap-1 justify-center">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Confirmação automática em até 5s após pagar
                    </p>
                  )}
                </div>
              </div>

              {/* Copia e Cola */}
              <div className="space-y-1.5">
                <p className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase pl-1">Pix Copia e Cola:</p>
                <div className="flex items-center gap-2">
                  <input type="text" readOnly value={qrCodeText}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3.5 py-2 text-[10px] text-emerald-200 select-all font-mono font-bold focus:outline-none" />
                  <button onClick={copiarCodigo}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-extrabold text-xs rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Status */}
              {modoFallback ? (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 flex gap-3 text-xs">
                  <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-amber-300 uppercase text-[9px] tracking-wider">PIX DIRETO — CONFIRMAÇÃO MANUAL</h4>
                    <p className="text-[10px] text-amber-100 mt-0.5 leading-relaxed">
                      Pagamento vai direto para <b>{directPixInfo.nome}</b> (chave: <span className="font-mono text-amber-300">{directPixInfo.chave}</span>).
                      Após pagar, avise o administrador para confirmar a quitação.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-teal-950/50 border border-teal-500/30 rounded-2xl p-4 flex gap-3 text-xs">
                  <ShieldCheck className="w-5 h-5 text-teal-400 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-bold text-teal-300 uppercase text-[9px] tracking-wider">MERCADO PAGO ATIVO — CONFIRMAÇÃO AUTOMÁTICA</h4>
                    <p className="text-[10px] text-teal-100 mt-0.5 leading-relaxed">
                      Assim que o PIX cair, o sistema quita automaticamente e notifica o grupo no WhatsApp. Não feche esta janela.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── SUCESSO ── */}
          {step === 'sucesso' && (
            <div className="p-10 text-center flex flex-col items-center justify-center space-y-5 py-12 overflow-y-auto flex-1">
              <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 border-2 border-teal-500/40 animate-bounce shrink-0">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <div className="space-y-2">
                <h3 className="font-display font-black text-lg text-teal-300 uppercase tracking-widest">PAGAMENTO CONFIRMADO!</h3>
                <p className="text-xs text-teal-100 max-w-[340px] leading-relaxed">
                  R$ {valorTotal.toFixed(2)} aprovado pelo Mercado Pago.
                  Status atualizado para <b className="text-teal-300 bg-teal-950/60 border border-teal-500/30 px-2 py-0.5 rounded text-[10px]">QUITADO</b>.
                </p>
              </div>
              {mpPaymentId && (
                <div className="bg-teal-950/30 rounded-xl p-3 border border-teal-500/20 w-full text-[10.5px] text-emerald-300 font-mono text-center">
                  <p>ID MP: <span className="font-bold text-white">{mpPaymentId}</span></p>
                  <p>Status: <span className="text-teal-400 font-bold">APPROVED</span></p>
                </div>
              )}
              <button onClick={onClose}
                className="w-full max-w-xs bg-teal-500 hover:bg-teal-400 text-black font-black text-xs py-3 rounded-xl transition-all shadow-md uppercase cursor-pointer tracking-wider">
                Concluir e Fechar
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
