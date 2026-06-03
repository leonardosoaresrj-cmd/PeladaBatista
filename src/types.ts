/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PosicaoJogador = 'Goleiro' | 'Defesa' | 'Meio' | 'Ataque';
export type StatusJogador = 'pendente_aprovacao' | 'ativo' | 'suspenso';
export type MembroStatus = 'mensalista' | 'diarista';
export type RoleUsuario = 'admin' | 'jogador';

export interface Jogador {
  id: string;
  nome: string;
  sobrenome: string;
  posicao: PosicaoJogador;
  dataNascimento: string;
  foto: string;
  membroStatus: MembroStatus;
  email: string;
  senha: string; // PIN de 4 dígitos
  status: StatusJogador;
  role: RoleUsuario;
  createdAt: string;
  isGold?: boolean;
}

export interface Partida {
  id: string;
  titulo: string;
  data: string; // Formato YYYY-MM-DD
  horario: string; // Formato HH:MM
  local: string;
  confirmados: string[]; // IDs de jogadores confirmados (Sim)
  recusados: string[]; // IDs de jogadores recusados (Não)
  criadoPor: string;
  createdAt: string;
  cancelada?: boolean;
}

export interface Pagamento {
  id: string;
  jogadorId: string;
  mesRef: string; // Formato YYYY-MM
  status: 'pago' | 'pendente' | 'pendente_confirmacao';
  dataPagamento: string | null;
  valor: number;
}

export interface LancamentoAvulso {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string; // 'mensalidade' | 'diaria' | 'aluguel' | 'goleiro' | 'outros_receita' | 'outros_despesa'
}

