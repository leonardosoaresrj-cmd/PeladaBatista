/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Partida } from '../types';

/**
 * Retorna as datas de todos os sábados num intervalo de datas útil
 */
export function obterSábadosNoIntervalo(dataInicioStr: string, dataFimStr: string): string[] {
  const sabados: string[] = [];
  const atual = new Date(dataInicioStr + 'T12:00:00');
  const fim = new Date(dataFimStr + 'T12:00:00');
  
  while (atual <= fim) {
    if (atual.getDay() === 6) { // 6 = Sábado
      const yyyy = atual.getFullYear();
      const mm = String(atual.getMonth() + 1).padStart(2, '0');
      const dd = String(atual.getDate()).padStart(2, '0');
      sabados.push(`${yyyy}-${mm}-${dd}`);
    }
    atual.setDate(atual.getDate() + 1);
  }
  return sabados;
}

/**
 * Combina as partidas salvas no banco com as partidas automáticas de sábado,
 * garantindo que novos sábados sem registros apareçam automaticamente.
 */
export function mesclarPartidasAutomáticas(partidasSalvas: Partida[]): Partida[] {
  // Definindo um intervalo de geração automática para cobrir 25 e 26/27, iniciando em startupMonth
  const startupMonth = typeof window !== 'undefined' ? localStorage.getItem('futebol_startup_month') || '2026-06' : '2026-06';
  const dataInicioGen = `${startupMonth}-01`;
  const sabados = obterSábadosNoIntervalo(dataInicioGen, '2027-12-31');
  
  // Criar cópia dos matches salvos
  const result: Partida[] = [...partidasSalvas];
  
  // Para cada sábado, verificar se já existe uma partida gravada para aquela data
  sabados.forEach(sabadoData => {
    const existe = partidasSalvas.some(p => p.data === sabadoData);
    if (!existe) {
      // Criar a partida automática com as configurações padrão
      result.push({
        id: `sat-${sabadoData}`,
        titulo: 'Pelada Batista Sábado',
        data: sabadoData,
        horario: '08:00 às 10:00',
        local: 'Campo do Meio do Colégio Batista - Tijuca',
        confirmados: [],
        recusados: [],
        criadoPor: 'sistema',
        createdAt: '2026-01-01T08:00:00Z'
      });
    }
  });
  
  // Ordenar as partidas por data crescente de forma simples
  return result.sort((a, b) => a.data.localeCompare(b.data));
}
