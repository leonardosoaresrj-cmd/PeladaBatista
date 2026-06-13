/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type PosicaoJogador = 'Goleiro' | 'Defesa' | 'Meio' | 'Ataque';
export type StatusJogador = 'pendente_aprovacao' | 'ativo' | 'suspenso';
export type MembroStatus = 'mensalista' | 'diarista' | 'isento';
export type RoleUsuario = 'admin' | 'jogador';

export interface Jogador {
  id: string;
  nome: string;
  sobrenome: string;
  posicao: PosicaoJogador;
  dataNascimento: string;
  foto: string;
  membroStatus: MembroStatus;
  membroStatusDb?: MembroStatus;
  email: string;
  senha: string; // PIN de 4 dígitos
  status: StatusJogador;
  role: RoleUsuario;
  createdAt: string;
  isGold?: boolean;
  isGoldDb?: boolean;
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
  status: 'pago' | 'pendente' | 'pendente_confirmacao' | 'cancelado';
  dataPagamento: string | null;
  valor: number;
  partidaId?: string;
}

export interface LancamentoAvulso {
  id: string;
  tipo: 'receita' | 'despesa';
  descricao: string;
  valor: number;
  data: string; // YYYY-MM-DD
  categoria: string; // 'mensalidade' | 'diaria' | 'aluguel' | 'goleiro' | 'outros_receita' | 'outros_despesa'
}

export interface BotLog {
  id?: string;
  evento: string;
  tabela: string;
  mensagem: string;
  enviado_em?: string;
}

