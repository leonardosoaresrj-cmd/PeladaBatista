/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Jogador, PosicaoJogador, MembroStatus, Partida } from '../types';
import { AVATAR_PRESETS } from '../data';
import { Users, Trash2, Shield, Calendar, Edit2, Check, X, ShieldAlert, Award } from 'lucide-react';

interface ListaCadastradosProps {
  jogadores: Jogador[];
  partidas: Partida[];
  jogadorAtual: Jogador;
  onExcluirJogador: (id: string) => void;
  onEditarJogador: (id: string, camposAtualizados: Partial<Jogador>) => void;
}

export default function ListaCadastrados({
  jogadores,
  partidas,
  jogadorAtual,
  onExcluirJogador,
  onEditarJogador,
}: ListaCadastradosProps) {
  // Filtrar apenas jogadores "Ativo" para a área pública de cadastrados
  const jogadoresAtivos = jogadores.filter(j => j.status === 'ativo');

  // Separar e contar ativos para goleiros, mensalistas e diaristas
  const goleirosAtivos = jogadoresAtivos.filter(j => j.posicao === 'Goleiro');
  const mensalistasAtivos = jogadoresAtivos.filter(j => j.posicao !== 'Goleiro' && j.membroStatus === 'mensalista');
  const diaristasAtivos = jogadoresAtivos.filter(j => j.posicao !== 'Goleiro' && j.membroStatus === 'diarista');

  // Controle de Edição Administrativa e Pessoal
  const [jogadorEditandoId, setJogadorEditandoId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editSobrenome, setEditSobrenome] = useState('');
  const [editPosicao, setEditPosicao] = useState<PosicaoJogador>('Meio');
  const [editMembro, setEditMembro] = useState<MembroStatus>('mensalista');
  const [editIsGold, setEditIsGold] = useState(false);
  const [editFoto, setEditFoto] = useState('');
  const [editDataNascimento, setEditDataNascimento] = useState('');
  const [editSenha, setEditSenha] = useState('');
  const [showConfirmacaoCadastrados, setShowConfirmacaoCadastrados] = useState(false);

  // Função para verificar a janela de renovação mensal
  const checkJanelaRenovacao = () => {
    const agora = new Date();
    const ano = agora.getFullYear();
    const mes = agora.getMonth(); // 0-11

    // Primeira segunda-feira do mês às 00:01
    const inicio = new Date(ano, mes, 1, 0, 1, 0, 0);
    while (inicio.getDay() !== 1) { // 1 = Segunda
      inicio.setDate(inicio.getDate() + 1);
    }

    // Primeiro jogo do mês
    const partidasDoMes = (partidas || []).filter(p => {
      if (!p.data) return false;
      const [pAno, pMes] = p.data.split('-').map(Number);
      return pAno === ano && pMes === (mes + 1);
    });

    // Ordenar partidas por data crescente
    const sortedPartidas = [...partidasDoMes].sort((a, b) => a.data.localeCompare(b.data));

    let primeiroJogoDataStr = '';
    let dataReferenciaJogo: Date;

    if (sortedPartidas.length > 0) {
      primeiroJogoDataStr = sortedPartidas[0].data;
      const [y, m, d] = primeiroJogoDataStr.split('-').map(Number);
      dataReferenciaJogo = new Date(y, m - 1, d, 23, 59, 59);
    } else {
      // Fallback: Primeiro sábado do mês
      const sab = new Date(ano, mes, 1, 23, 59, 59);
      while (sab.getDay() !== 6) { // 6 = Sábado
        sab.setDate(sab.getDate() + 1);
      }
      dataReferenciaJogo = sab;
      primeiroJogoDataStr = `${sab.getFullYear()}-${(sab.getMonth() + 1).toString().padStart(2, '0')}-${sab.getDate().toString().padStart(2, '0')}`;
    }

    // Sexta-feira do primeiro jogo do mês às 23:59
    const diaSemanaJogo = dataReferenciaJogo.getDay();
    const diffParaSexta = 5 - diaSemanaJogo; // 5 = Sexta
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

  const janelaInfo = checkJanelaRenovacao();

  const formatarData = (d: Date) => {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} às ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleEditFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setEditFoto(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const calcularIdade = (dataNascimento: string) => {
    if (!dataNascimento) return 0;
    const hoje = new Date();
    const nasc = new Date(dataNascimento);
    let idade = hoje.getFullYear() - nasc.getFullYear();
    const m = hoje.getMonth() - nasc.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) {
      idade--;
    }
    return idade;
  };

  const handleSalvarEdicao = (id: string) => {
    if (editSenha.length !== 4 || isNaN(Number(editSenha))) {
      alert('O PIN de segurança deve possuir exatamente 4 dígitos numéricos.');
      return;
    }

    onEditarJogador(id, {
      nome: editNome,
      sobrenome: editSobrenome,
      posicao: editPosicao,
      membroStatus: editMembro,
      isGold: editIsGold,
      foto: editFoto,
      dataNascimento: editDataNascimento,
      senha: editSenha,
    });
    setJogadorEditandoId(null);
    setShowConfirmacaoCadastrados(true);
  };

  const iniciarEdicao = (jog: Jogador) => {
    setJogadorEditandoId(jog.id);
    setEditNome(jog.nome);
    setEditSobrenome(jog.sobrenome);
    setEditPosicao(jog.posicao);
    setEditMembro(jog.membroStatus);
    setEditIsGold(!!jog.isGold);
    setEditFoto(jog.foto || '');
    setEditDataNascimento(jog.dataNascimento || '');
    setEditSenha(jog.senha || '');
  };

  // Helper para renderizar um card de jogador
  const renderJogadorCard = (j: Jogador) => {
    const isEditing = jogadorEditandoId === j.id;
    const jersey = AVATAR_PRESETS.find(p => p.id === j.foto) || AVATAR_PRESETS[0];

    return (
      <div
        id={`jogador-card-${j.id}`}
        key={j.id}
        className="bg-emerald-900/40 border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:border-white/15 backdrop-blur-sm transition-all flex flex-col justify-between"
      >
        {/* Cabeçalho do Card */}
        <div className="p-4 flex gap-4 items-start">
          
          {/* Jersey / Visual Avatar */}
          <div 
            className="w-14 h-14 rounded-full flex flex-col items-center justify-center shrink-0 border border-white/10 relative shadow-inner overflow-hidden"
            style={{ backgroundColor: jersey.color }}
          >
            {j.foto && (j.foto.startsWith('http') || j.foto.startsWith('data:')) ? (
              <img src={j.foto} className="w-full h-full object-cover rounded-full" alt="Avatar" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-xl font-bold font-display" style={{ color: jersey.text === '⚪' ? '#fff' : '#000' }}>
                {j.posicao === 'Goleiro' ? '🧤' : j.posicao === 'Defesa' ? '🛡️' : j.posicao === 'Meio' ? '🧠' : '🚀'}
              </span>
            )}
            <span className="text-[8px] text-white font-extrabold bg-emerald-955/90 px-1.5 py-0.5 border border-white/10 rounded absolute -bottom-1 uppercase font-mono tracking-wider whitespace-nowrap">
              {j.posicao === 'Goleiro' ? '🧤 GOL' : j.posicao === 'Defesa' ? '🛡️ DEF' : j.posicao === 'Meio' ? '🧠 MEI' : '🚀 ATA'}
            </span>
          </div>

          {/* Informações de Perfil */}
          <div className="flex-1 overflow-hidden">
            {isEditing ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    id={`input-edit-nome-${j.id}`}
                    value={editNome}
                    onChange={(e) => setEditNome(e.target.value)}
                    placeholder="Nome"
                    className="bg-emerald-950/80 border border-white/10 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-white"
                  />
                  <input
                    id={`input-edit-sobrenome-${j.id}`}
                    value={editSobrenome}
                    onChange={(e) => setEditSobrenome(e.target.value)}
                    placeholder="Sobrenome"
                    className="bg-emerald-950/80 border border-white/10 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <select
                    id={`select-edit-posicao-${j.id}`}
                    value={editPosicao}
                    onChange={(e) => setEditPosicao(e.target.value as PosicaoJogador)}
                    disabled={jogadorAtual.role !== 'admin'}
                    className="bg-emerald-950 border border-white/10 text-white text-[11px] rounded px-1.5 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option className="bg-emerald-950 text-white" value="Goleiro">Goleiro</option>
                    <option className="bg-emerald-950 text-white" value="Defesa">Defesa</option>
                    <option className="bg-emerald-950 text-white" value="Meio">Meio</option>
                    <option className="bg-emerald-950 text-white" value="Ataque">Ataque</option>
                  </select>

                  <select
                    id={`select-edit-membro-${j.id}`}
                    value={editMembro}
                    onChange={(e) => setEditMembro(e.target.value as MembroStatus)}
                    disabled={jogadorAtual.role !== 'admin' && !janelaInfo.estaAberta}
                    className="bg-emerald-950 border border-white/10 text-white text-[11px] rounded px-1.5 py-1 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option className="bg-emerald-950 text-white" value="mensalista">Mensal</option>
                    <option className="bg-emerald-950 text-white" value="diarista">Diário</option>
                  </select>
                </div>

                {jogadorAtual.role !== 'admin' && !janelaInfo.estaAberta && (
                  <p className="text-[9px] text-rose-400 font-medium leading-tight">
                    * Alteração de plano indisponível fora do período de renovação.
                  </p>
                )}

                {/* Configurações do Avatar */}
                <div className="bg-black/20 p-2 rounded border border-white/5 space-y-1 my-1">
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Avatar do Atleta</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      id={`edit-avatar-upload-${j.id}`}
                      accept="image/*"
                      onChange={handleEditFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor={`edit-avatar-upload-${j.id}`}
                      className="px-2 py-1 bg-white/10 hover:bg-white/15 border border-white/10 rounded text-[9px] text-white cursor-pointer transition-all"
                    >
                      Carregar Foto
                    </label>
                    <input
                      type="text"
                      placeholder="Ou URL da foto"
                      value={editFoto.startsWith('data:') ? '' : editFoto}
                      onChange={(e) => setEditFoto(e.target.value)}
                      className="flex-1 bg-emerald-950 border border-white/10 text-white text-[10px] rounded px-1.5 py-0.5"
                    />
                  </div>
                </div>

                {/* Data de Nascimento e PIN de Segurança (Alteração Completa para o Usuário) */}
                <div className="grid grid-cols-2 gap-2 my-1.5 p-1 rounded bg-black/15 border border-white/5">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide">Nascimento</label>
                    <input
                      type="date"
                      required
                      value={editDataNascimento}
                      onChange={(e) => setEditDataNascimento(e.target.value)}
                      className="w-full bg-emerald-950/90 border border-white/10 text-white text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-white"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-emerald-400 uppercase tracking-wide">PIN (4 de Acesso)</label>
                    <input
                      type="text"
                      maxLength={4}
                      required
                      placeholder="PIN"
                      pattern="\d{4}"
                      value={editSenha}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setEditSenha(val);
                      }}
                      className="w-full bg-emerald-950/90 border border-white/10 text-white text-[10px] text-center font-mono rounded px-1.5 py-0.5 focus:outline-none focus:border-white"
                    />
                  </div>
                </div>

                {jogadorAtual.role === 'admin' && (
                  <label className="flex items-center gap-2 mt-1.5 text-[11px] font-bold text-amber-400 select-none cursor-pointer p-1 rounded bg-black/20 border border-white/5">
                    <input
                      type="checkbox"
                      checked={editIsGold}
                      onChange={(e) => setEditIsGold(e.target.checked)}
                      className="rounded border-white/20 bg-emerald-955 focus:ring-amber-500 text-amber-500 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span>🏅 Jogador Gold</span>
                  </label>
                )}
              </div>
            ) : (
              <div>
                <h3 className="font-display font-bold text-base text-white truncate flex items-center gap-1.5 flex-wrap">
                  <span>{j.nome} {j.sobrenome}</span>
                  {j.isGold && (
                    <span className="text-sm shrink-0 select-none" title="Jogador Gold">🏅</span>
                  )}
                  {j.role === 'admin' && (
                    <Shield className="w-3.5 h-3.5 text-amber-400 shrink-0" title="Administrador Geral" />
                  )}
                </h3>
                <p className="text-xs text-emerald-300 truncate">{j.email}</p>
                
                {/* Tags */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {j.isGold && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-black uppercase font-mono border bg-amber-955/75 border-amber-500/30 text-amber-400 flex items-center gap-0.5 shadow-sm select-none">
                      🏅 GOLD
                    </span>
                  )}
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase font-mono border ${
                    j.posicao === 'Goleiro' ? 'bg-amber-955/50 border-amber-500/20 text-amber-400' :
                    j.posicao === 'Defesa' ? 'bg-blue-955/50 border-blue-500/20 text-blue-400' :
                    j.posicao === 'Meio' ? 'bg-purple-955/50 border-purple-500/20 text-purple-400' :
                    'bg-red-955/50 border-red-500/20 text-red-400'
                  }`}>
                    {j.posicao === 'Goleiro' ? '🧤 Goleiro' : j.posicao === 'Defesa' ? '🛡️ Defesa' : j.posicao === 'Meio' ? '🧠 Meio' : '🚀 Ataque'}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase font-mono border ${
                    j.membroStatus === 'mensalista' 
                      ? 'bg-teal-950/60 border-teal-500/25 text-teal-400' 
                      : 'bg-amber-950/60 border-amber-500/25 text-amber-400'
                  }`}>
                    {j.membroStatus}
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* Linha Divisória de Info Secundária */}
        <div className="px-4 py-2.5 bg-emerald-950/60 flex flex-wrap items-center justify-between text-[10px] text-emerald-300 border-t border-b border-white/10 font-mono">
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            Nasc: {j.dataNascimento ? j.dataNascimento.split('-').reverse().join('/') : '-'} ({calcularIdade(j.dataNascimento)} anos)
          </span>
          <span>PIN: ••••</span>
        </div>

        {/* Área de Ações (Admin ou Próprio Jogador) */}
        {(jogadorAtual.role === 'admin' || jogadorAtual.id === j.id) && (
          <div className="p-3 bg-emerald-950/40 border-t border-white/10 flex items-center justify-end gap-2 shrink-0">
            {isEditing ? (
              <>
                <button
                  id={`btn-salvar-edicao-${j.id}`}
                  type="button"
                  onClick={() => handleSalvarEdicao(j.id)}
                  className="bg-white hover:bg-emerald-50 text-black text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  Salvar
                </button>
                <button
                  id={`btn-cancelar-edicao-${j.id}`}
                  type="button"
                  onClick={() => setJogadorEditandoId(null)}
                  className="bg-emerald-950 border border-white/10 text-emerald-300 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </>
            ) : (
              <>
                <button
                  id={`btn-editar-atleta-${j.id}`}
                  type="button"
                  onClick={() => iniciarEdicao(j)}
                  className="text-[11px] font-bold text-white hover:bg-white/10 bg-white/5 border border-white/5 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                  title="Editar cadastro do atleta"
                >
                  <Edit2 className="w-3 h-3 text-emerald-450" />
                  Editar
                </button>
                
                {/* Permitir exclusão se o usuário for administrador (e não for ele mesmo) ou se for o próprio usuário acessando seu perfil */}
                {((jogadorAtual.role === 'admin' && j.id !== jogadorAtual.id) || j.id === jogadorAtual.id) && (
                  <button
                    id={`btn-excluir-atleta-${j.id}`}
                    type="button"
                    onClick={() => {
                      const msg = j.id === jogadorAtual.id
                        ? 'Tem certeza que deseja excluir sua conta e informações do portal definitivamente?'
                        : `Tem certeza que deseja excluir as informações de ${j.nome} ${j.sobrenome} definitivamente?`;
                      if (confirm(msg)) {
                        onExcluirJogador(j.id);
                      }
                    }}
                    className="text-[11px] font-bold text-rose-350 hover:bg-rose-950/30 hover:text-white bg-rose-950/15 border border-rose-500/15 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                    title={j.id === jogadorAtual.id ? "Excluir minha conta do portal" : "Remover atleta do portal"}
                  >
                    <Trash2 className="w-3 h-3" />
                    Excluir
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* Banner / Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-emerald-900/40 border border-white/10 rounded-2xl p-5 shadow-lg backdrop-blur-sm">
        <div>
          <h2 id="titulo-cadastrados" className="font-display font-semibold text-lg text-white flex items-center gap-2 uppercase tracking-wide">
            <Users className="w-5 h-5 text-emerald-400" />
            Jogadores Cadastrados
          </h2>
          <p className="text-xs text-emerald-300/80 font-sans mt-0.5">Elenco oficial de atletas com cadastro ativo e aprovado no portal.</p>
        </div>
        
        <div className="flex items-center gap-3 self-start sm:self-center font-mono text-xs bg-emerald-950/40 px-3.5 py-1.5 rounded-lg border border-white/10">
          <span className="text-emerald-300">Total no Elenco:</span>
          <span className="text-white font-bold">{jogadoresAtivos.length} Ativos</span>
        </div>
      </div>

      {jogadoresAtivos.length === 0 ? (
        <div className="text-center py-16 bg-emerald-900/40 rounded-2xl border border-dashed border-white/10 text-emerald-300 max-w-lg mx-auto">
          <ShieldAlert className="w-12 h-12 text-emerald-500/50 mb-3 mx-auto" />
          <h3 className="font-display font-semibold text-base text-white">Nenhum atleta ativo</h3>
          <p className="text-xs text-emerald-450 mt-1">Nenhum jogador aprovado consta como ativo na pelada no momento.</p>
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* SEÇÃO JOGADORES GOLEIROS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="text-amber-400">🧤</span>
                Goleiros Cadastrados
              </h3>
              <span className="text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-0.5 rounded-full">
                {goleirosAtivos.length} Ativos
              </span>
            </div>

            {goleirosAtivos.length === 0 ? (
              <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-emerald-450 text-xs italic">
                Nenhum goleiro ativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {goleirosAtivos.map((j) => renderJogadorCard(j))}
              </div>
            )}
          </div>

          {/* SEÇÃO JOGADORES MENSALISTAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="text-teal-400">🛡️</span>
                Jogadores Mensalistas
              </h3>
              <span className="text-xs font-mono font-bold bg-teal-500/15 border border-teal-500/30 text-teal-400 px-3 py-0.5 rounded-full">
                {mensalistasAtivos.length} Ativos
              </span>
            </div>

            {mensalistasAtivos.length === 0 ? (
              <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-emerald-450 text-xs italic">
                Nenhum jogador mensalista ativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {mensalistasAtivos.map((j) => renderJogadorCard(j))}
              </div>
            )}
          </div>

          {/* SEÇÃO JOGADORES DIARISTAS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-display font-bold text-base text-white flex items-center gap-2">
                <span className="text-amber-400">⚡</span>
                Jogadores Diaristas
              </h3>
              <span className="text-xs font-mono font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 px-3 py-0.5 rounded-full">
                {diaristasAtivos.length} Ativos
              </span>
            </div>

            {diaristasAtivos.length === 0 ? (
              <div className="text-center py-8 bg-black/10 rounded-2xl border border-dashed border-white/5 text-emerald-450 text-xs italic">
                Nenhum jogador diarista ativo cadastrado.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {diaristasAtivos.map((j) => renderJogadorCard(j))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* POPUP DE CONFIRMAÇÃO DE ALTERAÇÃO SALVA */}
      {showConfirmacaoCadastrados && (
        <div 
          id="confirmacao-sucesso-cadastrados-popup"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <div className="bg-emerald-900 border border-emerald-500/35 rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            <div className="w-16 h-16 bg-emerald-500/10 border-2 border-emerald-500 text-teal-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8" />
            </div>
            <h3 className="font-display font-semibold text-lg text-white mb-2">Alterações Salvas!</h3>
            <p className="text-xs text-emerald-200 leading-relaxed mb-6">
              As informações cadastrais do atleta foram gravadas e atualizadas com sucesso!
            </p>
            <button
              id="btn-confirmar-edicao-cadastrados"
              type="button"
              onClick={() => setShowConfirmacaoCadastrados(false)}
              className="w-full bg-white hover:bg-emerald-100 text-black font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-97 text-xs"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
