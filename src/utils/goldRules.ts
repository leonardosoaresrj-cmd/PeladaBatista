/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Jogador, Pagamento } from '../types';

/**
 * Retorna true se o jogador for "Gold" funcionalmente:
 * - Diaristas NUNCA são Gold.
 * - Mensalistas/Isentos marcados pelo admin manualmente (jogador.isGold) são Gold.
 * - Mensalistas que têm 12 meses ininterruptos pagos também recebem o selo Gold automaticamente.
 */
export function isJogadorFuncionalmenteGold(jogador: Jogador, pagamentos: Pagamento[]): boolean {
  if (jogador.membroStatus === 'diarista') {
    return false;
  }
  
  if (jogador.isGold) {
    return true;
  }

  // Se não foi marcado manualmente pelo admin e não é diarista, 
  // verifica se tem 12 meses ininterruptos pagos na mensalidade.
  const pagamentosDoJogador = pagamentos
    .filter(p => p.jogadorId === jogador.id && p.status === 'pago' && !p.partidaId)
    // Filtra para garantir formato mesRef adequado (YYYY-MM)
    .map(p => ({ ...p, dateVal: new Date(`${p.mesRef}-01T12:00:00`).getTime() }))
    .filter(p => !isNaN(p.dateVal))
    .sort((a, b) => b.dateVal - a.dateVal); // Ordena do mais recente para o mais antigo

  if (pagamentosDoJogador.length < 12) {
    return false;
  }

  // Verifica se há alguma sequência ininterrupta de 12 meses.
  // Como filtramos apenas 'pago', precisamos ver se a distância entre eles é de 1 mês.
  let consecutiveCount = 1;
  let maxConsecutive = 1;

  for (let i = 0; i < pagamentosDoJogador.length - 1; i++) {
    const atual = new Date(pagamentosDoJogador[i].dateVal);
    const anterior = new Date(pagamentosDoJogador[i+1].dateVal); // Lembrando que está do MAIS RECENTE p/ mais antigo
    
    const diffMeses = (atual.getFullYear() - anterior.getFullYear()) * 12 + (atual.getMonth() - anterior.getMonth());
    
    if (diffMeses === 1) {
      consecutiveCount++;
      if (consecutiveCount > maxConsecutive) {
        maxConsecutive = consecutiveCount;
      }
    } else if (diffMeses > 1) {
      // Seq quebrada
      consecutiveCount = 1;
    }
  }

  return maxConsecutive >= 12;
}
