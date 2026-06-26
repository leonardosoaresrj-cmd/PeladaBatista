/**
 * CheckoutPixModal — Integração REAL com Mercado Pago via Supabase Edge Functions
 *
 * FLUXO PRINCIPAL (MP real):
 *   1. Modal abre → chama pix-criar → MP gera cobrança dinâmica
 *   2. Exibe QR Code real (base64 do MP)
 *   3. Polling a cada 5s em pix-status → detecta pagamento aprovado
 *   4. Quando aprovado: chama onConfirmarPagamentoTotal(debitos, 'pago')
 *
 * FLUXO FALLBACK (chave PIX estática):
 *   - Se pix-criar falhar → exibe QR estático
 *   - Botão "Já Paguei" → onConfirmarPagamentoTotal(debitos, 'pendente_confirmacao')
 *   - Botão "Confirmar Quitação" (admin) → onConfirmarPagamentoTotal(debitos, 'pago')
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Copy, Check, Loader2, QrCode,
  CheckCircle2, DollarSign, AlertCircle, ShieldCheck, Info, Clock
} from 'lucide-react';
import { Jogador } from '../types';

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
  onConfirmarPagamentoTotal: (
    debitList: Array<{ mesRef: string; valor: number; partidaId?: string }>,
    status?: 'pago' | 'pendente_confirmacao'
  ) => void;
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
  const [step, setStep]                     = useState<Step>('gerando');
  const [copied, setCopied]                 = useState(false);
  const [tempoRestante, setTempoRestante]   = useState(600);
  const [erroMsg, setErroMsg]               = useState('');
  const [mpPaymentId, setMpPaymentId]       = useState<string | null>(null);
  const [qrCodeBase64, setQrCodeBase64]     = useState<string | null>(null);
  const [qrCodeText, setQrCodeText]         = useState('');
  const [modoFallback, setModoFallback]     = useState(false);
  const [tipoSucesso, setTipoSucesso]       = useState<'imediato' | 'pendente'>('imediato');
  const [debugInfo, setDebugInfo]           = useState('');
  const [directPixInfo, setDirectPixInfo]   = useState({
    chave: '', nome: 'Pelada Batista', cidade: 'RIO DE JANEIRO'
  });

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const debitosParaConfirmar = debitos.map(d => ({
    mesRef: d.mesRef, valor: d.valor, partidaId: d.partidaId
  }));

  const pararTudo = useCallback(() => {
    if (timerRef.current)   clearInterval(timerRef.current);
    if (pollingRef.current) clearInterval(pollingRef.current);
  }, []);

  // Ao abrir
  useEffect(() => {
    if (!isOpen) return;
    setStep('gerando');
    setErroMsg('');
    setMpPaymentId(null);
    setQrCodeBase64(null);
    setModoFallback(false);
    setDebugInfo('');
    setDirectPixInfo({
      chave:  localStorage.getItem('direto_pix_chave')  || '',
      nome:   localStorage.getItem('direto_pix_nome')   || 'Pelada Batista',
      cidade: localStorage.getItem('direto_pix_cidade') || 'RIO DE JANEIRO',
    });
    criarCobrancaMP();
    return () => pararTudo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ── Criar cobrança real no MP ─────────────────────────────────────────────
  const criarCobrancaMP = async () => {
    try {
      const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/pix-criar`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valorTotal,
          jogadorId:   jogadorAtual.id,
          jogadorNome: `${jogadorAtual.nome} ${jogadorAtual.sobrenome}`,
          debitos: debitosParaConfirmar,
        }),
      });

      const data = await resp.json();
      setDebugInfo(`HTTP ${resp.status}`);

      if (resp.ok && data.success && data.qrCodeText) {
        setMpPaymentId(String(data.paymentId));
        setQrCodeBase64(data.qrCodeBase64 || null);
        setQrCodeText(data.qrCodeText);
        setModoFallback(false);
        setStep('qrcode');
        iniciarContador();
        iniciarPolling(String(data.paymentId));
      } else {
        console.warn('[pix-criar] fallback:', data?.error, data?.cause);
        ativarFallback(data?.error);
      }
    } catch (e: any) {
      ativarFallback();
    }
  };

  // ── Fallback: PIX estático ────────────────────────────────────────────────
  const ativarFallback = (motivo?: string) => {
    setModoFallback(true);
    const chave = localStorage.getItem('direto_pix_chave') || '';
    if (!chave) {
      setStep('erro');
      setErroMsg(
        motivo
          ? `Pagamento online indisponível: ${motivo}. Configure a Chave PIX direta nas Configurações.`
          : 'Pagamento online indisponível. Configure o Mercado Pago ou Chave PIX direta.'
      );
      return;
    }
    setQrCodeText(gerarPixEstatico(chave));
    setStep('qrcode');
    iniciarContador();
  };

  // ── Polling de status ─────────────────────────────────────────────────────
  const iniciarPolling = (paymentId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const resp = await fetch(`${SUPABASE_FUNCTIONS_URL}/pix-status?id=${paymentId}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.pago) {
            pararTudo();
            setTipoSucesso('imediato');
            setStep('sucesso');
            onConfirmarPagamentoTotal(debitosParaConfirmar, 'pago');
          }
        }
      } catch { /* silencioso, tenta no próximo ciclo */ }
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

  // ── Confirmações manuais ──────────────────────────────────────────────────
  const handleJaPaguei = () => {
    pararTudo();
    setTipoSucesso('pendente');
    setStep('sucesso');
    onConfirmarPagamentoTotal(debitosParaConfirmar, 'pendente_confirmacao');
  };

  const handleConfirmarQuitacao = () => {
    pararTudo();
    setTipoSucesso('imediato');
    setStep('sucesso');
    onConfirmarPagamentoTotal(debitosParaConfirmar, 'pago');
  };

  // ── PIX estático EMV ──────────────────────────────────────────────────────
  const removerAcentos = (s: string) =>
    s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, '').toUpperCase();

  const calcCRC16 = (str: string): string => {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      for (let j = 0; j < 8; j++) {
        const b = ((c >> (7 - j)) & 1) === 1;
        const c15 = ((crc >> 15) & 1) === 1;
        crc <<= 1;
        if (c15 !== b) crc ^= 0x1021;
      }
    }
    return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
  };

  const gerarPixEstatico = (chave: string) => {
    const val    = valorTotal.toFixed(2);
    const nome   = removerAcentos(directPixInfo.nome.substring(0, 25).trim() || 'PELADA BATISTA');
    const cidade = removerAcentos(directPixInfo.cidade.substring(0, 15).trim() || 'RIO DE JANEIRO');
    const sub    = `0014br.gov.bcb.pix01${chave.length.toString().padStart(2,'0')}${chave}`;
    const t26    = `26${sub.length.toString().padStart(2,'0')}${sub}`;
    const base   = `000201${t26}52040000530398654${val.length.toString().padStart(2,'0')}${val}5802BR59${nome.length.toString().padStart(2,'0')}${nome}60${cidade.length.toString().padStart(2,'0')}${cidade}62070503***6304`;
    return base + calcCRC16(base);
  };

  const formatarTempo = (s: number) =>
    `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const copiarCodigo = () => {
    navigator.clipboard.writeText(qrCodeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrSrc = qrCodeBase64
    ? `data:image/png;base64,${qrCodeBase64}`
    : `https://api.qrserver.com/v1/create-qr-code/?size=260x260&color=052e16&bgcolor=f0fdf4&data=${encodeURIComponent(qrCodeText)}`;

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[9999] flex items-start justify-center p-4 overflow-y-auto pt-16">
        <motion.div
          initial={{ opacity:0, scale:0.93, y:15 }}
          animate={{ opacity:1, scale:1, y:0 }}
          exit={{ opacity:0, scale:0.93, y:15 }}
          className="bg-[#0a1a0d] border border-emerald-500/30 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-white flex flex-col"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-950/80 to-emerald-900/40 p-5 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-teal-400" />
              </div>
              <div>
                <p className="font-bold text-[11px] tracking-widest text-amber-400 uppercase">Checkout PIX Seguro</p>
                <p className="text-[9px] text-emerald-400 font-mono mt-0.5">
                  {modoFallback ? 'PIX DIRETO (CHAVE ESTÁTICA)' : 'MERCADO PAGO — PRODUÇÃO'}
                </p>
              </div>
            </div>
            <button onClick={() => { pararTudo(); onClose(); }}
              className="w-8 h-8 rounded-full bg-black/30 text-slate-400 hover:text-white flex items-center justify-center hover:bg-black/50 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── GERANDO ── */}
          {step === 'gerando' && (
            <div className="p-12 flex flex-col items-center gap-4">
              <Loader2 className="w-10 h-10 text-teal-400 animate-spin" />
              <p className="text-xs text-teal-300">Gerando cobrança PIX no Mercado Pago...</p>
              {debugInfo && <p className="text-[10px] text-yellow-400 font-mono">{debugInfo}</p>}
            </div>
          )}

          {/* ── ERRO ── */}
          {step === 'erro' && (
            <div className="p-10 flex flex-col items-center gap-4 text-center">
              <AlertCircle className="w-12 h-12 text-rose-400" />
              <p className="text-xs text-rose-200 max-w-[320px] leading-relaxed">{erroMsg}</p>
              <button onClick={onClose}
                className="px-6 py-2.5 bg-rose-500 text-black font-bold text-xs rounded-xl">
                Fechar
              </button>
            </div>
          )}

          {/* ── QR CODE ── */}
          {step === 'qrcode' && (
            <div className="p-5 space-y-4 overflow-y-auto">

              {/* Resumo do valor */}
              <div className="bg-emerald-950/50 rounded-2xl p-4 border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-emerald-400 font-mono uppercase tracking-wider">Total a pagar:</p>
                  <p className="text-2xl font-mono font-black text-white mt-0.5">R$ {valorTotal.toFixed(2)}</p>
                  <p className="text-[9px] text-emerald-300 mt-1">
                    {debitos.length} {debitos.length === 1 ? 'pendência' : 'pendências'} — {jogadorAtual.nome}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-950/40 border border-rose-500/25 px-3 py-1.5 rounded-xl">
                  <Clock className="w-3 h-3 text-rose-400" />
                  <span className="text-[11px] font-bold text-rose-400 font-mono">
                    {formatarTempo(tempoRestante)}
                  </span>
                </div>
              </div>

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3 bg-white/4 border border-white/5 p-5 rounded-2xl">
                <div className="p-2 bg-white rounded-xl shadow-inner">
                  <img
                    src={qrSrc}
                    alt="QR Code PIX"
                    className="w-[180px] h-[180px] block"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <p className="text-[11px] font-semibold text-white flex items-center gap-1.5">
                  <QrCode className="w-3.5 h-3.5 text-teal-400" />
                  Escaneie com o app do seu banco
                </p>
                {!modoFallback && (
                  <p className="text-[9px] text-teal-300 flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Verificando pagamento automaticamente...
                  </p>
                )}
              </div>

              {/* Copia e Cola */}
              <div>
                <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wider mb-1.5">PIX Copia e Cola:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={qrCodeText}
                    className="flex-1 bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-emerald-200 font-mono select-all focus:outline-none"
                  />
                  <button onClick={copiarCodigo}
                    className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-black font-bold text-xs rounded-xl flex items-center gap-1.5 shrink-0 transition-all">
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              {/* Botões de ação */}
              {modoFallback ? (
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-2xl p-4 space-y-3">
                  <div className="flex gap-2.5">
                    <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-amber-300 text-[10px] uppercase tracking-wider">PIX Direto — Confirmação Manual</p>
                      <p className="text-[10px] text-amber-100 mt-0.5 leading-relaxed">
                        Pague para <b>{directPixInfo.nome}</b> (chave: <span className="font-mono text-amber-300">{directPixInfo.chave}</span>).
                        Após pagar, clique em "Já Paguei" — o admin confirma depois.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleJaPaguei}
                      className="flex-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold text-[10px] py-2.5 rounded-xl uppercase tracking-wider">
                      ✅ Já Paguei
                    </button>
                    <button onClick={handleConfirmarQuitacao}
                      className="flex-1 bg-amber-500 text-black font-bold text-[10px] py-2.5 rounded-xl uppercase tracking-wider">
                      ⚡ Confirmar Quitação
                    </button>
                  </div>
                </div>
              ) : (
                <div className="bg-teal-950/40 border border-teal-500/25 rounded-2xl p-4 space-y-3">
                  <div className="flex gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-teal-300 text-[10px] uppercase tracking-wider">Mercado Pago — Produção</p>
                      <p className="text-[10px] text-teal-100 mt-0.5 leading-relaxed">
                        Confirmação automática em até 5s. Se já pagou e a tela não atualizou, clique abaixo.
                      </p>
                    </div>
                  </div>
                  <button onClick={handleConfirmarQuitacao}
                    className="w-full bg-teal-500/15 border border-teal-500/35 text-teal-300 font-bold text-[10px] py-2.5 rounded-xl uppercase tracking-wider">
                    ✅ Já Paguei — Confirmar
                  </button>
                </div>
              )}

              {/* Debug (apenas dev) */}
              {debugInfo && (
                <p className="text-[9px] text-white/20 font-mono text-center">{debugInfo}</p>
              )}
            </div>
          )}

          {/* ── SUCESSO ── */}
          {step === 'sucesso' && (
            <div className="p-10 text-center flex flex-col items-center gap-5">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 ${
                tipoSucesso === 'imediato'
                  ? 'bg-teal-500/20 text-teal-400 border-teal-500/40'
                  : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
              }`}>
                <CheckCircle2 className="w-9 h-9" />
              </div>

              {tipoSucesso === 'imediato' ? (
                <div>
                  <h3 className="font-black text-base text-teal-300 uppercase tracking-widest">Pagamento Confirmado!</h3>
                  <p className="text-xs text-teal-100 mt-2 max-w-[300px] leading-relaxed">
                    R$ {valorTotal.toFixed(2)} aprovado pelo Mercado Pago.
                    Status atualizado para <b className="text-teal-300">QUITADO</b>.
                  </p>
                  {mpPaymentId && (
                    <p className="text-[10px] text-emerald-400 font-mono mt-2">
                      MP ID: {mpPaymentId}
                    </p>
                  )}
                </div>
              ) : (
                <div>
                  <h3 className="font-black text-base text-amber-300 uppercase tracking-widest">Pagamento Registrado!</h3>
                  <p className="text-xs text-amber-100 mt-2 max-w-[300px] leading-relaxed">
                    Pagamento registrado como <b className="text-amber-300">PENDENTE DE CONFIRMAÇÃO</b>.
                    O administrador irá confirmar a quitação em breve.
                  </p>
                </div>
              )}

              <button onClick={onClose}
                className="w-full max-w-[260px] bg-teal-500 hover:bg-teal-400 text-black font-black text-xs py-3 rounded-xl transition-all uppercase tracking-wider">
                Concluir e Fechar
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
