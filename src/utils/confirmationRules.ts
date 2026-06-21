/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Partida, Pagamento, Jogador } from '../types';

/**
 * Retorna as datas de início (Terça-feira 00:00) e fim (Sexta-feira 23:59)
 * da janela de confirmação para uma partida de acordo com a data do jogo.
 */
export function getJanelaConfirmacao(dataJogoStr: string): { inicio: Date; fim: Date; status: 'aberto' | 'fechado' } {
  // Ajusta string de data "AAAA-MM-DD" para um objeto Date seguro
  const dataJogo = new Date(`${dataJogoStr}T12:00:00`);
  
  // Encontra o Domingo da semana do jogo (0 = Domingo)
  const diaSemana = dataJogo.getDay();
  const domingoSemana = new Date(dataJogo);
  domingoSemana.setDate(dataJogo.getDate() - diaSemana);
  domingoSemana.setHours(0, 0, 0, 0);

  // Terça-feira (Domingo + 2 dias) às 00:00:00
  const tercaFeira = new Date(domingoSemana);
  tercaFeira.setDate(domingoSemana.getDate() + 2);
  tercaFeira.setHours(0, 0, 0, 0);

  // Sexta-feira (Domingo + 5 dias) às 23:59:59
  const sextaFeira = new Date(domingoSemana);
  sextaFeira.setDate(domingoSemana.getDate() + 5);
  sextaFeira.setHours(23, 59, 59, 999);

  // Data atual da simulação/sistema
  const agora = new Date();

  const status = (agora >= tercaFeira && agora <= sextaFeira) ? 'aberto' : 'fechado';

  return { inicio: tercaFeira, fim: sextaFeira, status };
}

/**
 * Determina se a data informada cai no período de fechamento da lista de mensalistas.
 * O período é compreendido SEMPRE da última semana do mês anterior até o fim da primeira semana do mês atual.
 */
export function obterJanelaRenovacaoParaMesRef(refAno: number, refMes: number): { inicio: Date; fim: Date } {
  // 1. Encontrar o último sábado do mês anterior (refMes - 1)
  const ultimoDiaMesAnterior = new Date(refAno, refMes, 0); // O dia 0 do refMes é o último dia do refMes-1
  let ultimoSabadoAnt = new Date(ultimoDiaMesAnterior);
  while (ultimoSabadoAnt.getDay() !== 6) {
    ultimoSabadoAnt.setDate(ultimoSabadoAnt.getDate() - 1);
  }
  
  const inicioRenovacao = new Date(ultimoSabadoAnt);
  inicioRenovacao.setDate(ultimoSabadoAnt.getDate() + 2); // Primeira segunda-feira após o último sábado (2 dias após sábado)
  inicioRenovacao.setHours(0, 0, 0, 0);

  // 2. Encontrar o 2º sábado do mês de referência (refMes)
  const primeiroDiaRef = new Date(refAno, refMes, 1);
  let primeiroSabadoRef = new Date(primeiroDiaRef);
  while (primeiroSabadoRef.getDay() !== 6) {
    primeiroSabadoRef.setDate(primeiroSabadoRef.getDate() + 1);
  }
  const segundoSabadoRef = new Date(primeiroSabadoRef);
  segundoSabadoRef.setDate(primeiroSabadoRef.getDate() + 7);

  const fimRenovacao = new Date(segundoSabadoRef);
  fimRenovacao.setDate(segundoSabadoRef.getDate() - 1); // Sexta-feira anterior
  fimRenovacao.setHours(23, 59, 59, 999);

  return { inicio: inicioRenovacao, fim: fimRenovacao };
}

/**
 * Determina se a data informada cai no período de fechamento da lista de mensalistas.
 * O período é compreendido SEMPRE da primeira segunda-feira após o último sábado do mês anterior até a sexta-feira antes do 2º sábado do mês de renovação.
 */
export function isFechamentoMensalistas(data: Date = new Date()): { emPeriodo: boolean; descricao: string } {
  const dia = data.getDate();
  const mes = data.getMonth(); // 0-indexed (0 = Jan, 11 = Dez)
  const ano = data.getFullYear();

  // Testa a janela usando o mês atual de renovação
  const janelaAtual = obterJanelaRenovacaoParaMesRef(ano, mes);
  // Testa a janela usando o próximo mês como referência (caso estejamos no fim do mês atual)
  const janelaProximo = obterJanelaRenovacaoParaMesRef(ano, mes + 1);

  if (data >= janelaAtual.inicio && data <= janelaAtual.fim) {
    const nomeMes = getMesNome(mes);
    return { 
      emPeriodo: true, 
      descricao: `Período de RENOVAÇÃO de mensalistas ativo para o mês de ${nomeMes}.` 
    };
  }

  if (data >= janelaProximo.inicio && data <= janelaProximo.fim) {
    // Para resolver a virada de ano no nome do mês
    const dataProximoMes = new Date(ano, mes + 1, 1);
    const nomeMes = getMesNome(dataProximoMes.getMonth());
    return { 
      emPeriodo: true, 
      descricao: `Período de RENOVAÇÃO de mensalistas ativo (antecipação para o mês de ${nomeMes}).` 
    };
  }

  return { 
    emPeriodo: false, 
    descricao: 'Janela comum. O período de renovação ocorre entre o fim e o início de cada mês.' 
  };
}

function getMesNome(mesIndex: number): string {
  const nomes = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return nomes[mesIndex] || '';
}

/**
 * Formata texto profissional para envio via link do WhatsApp API
 */
export function gerarLinkCompartilhamento(texto: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(texto)}`;
}

/**
 * Mensagem de Renovação de Mensalidade
 */
export function obterTextoListaRenovacao(
  mesRef: string,
  jogadores: Jogador[],
  pagamentos: Pagamento[],
  valor4Sabados: number = 85,
  valor5Sabados: number = 105
): string {
  const mesFormatado = mesRef.split('-').reverse().join('/');
  const [anoStr, mesStr] = mesRef.split('-');
  const ano = parseInt(anoStr, 10);
  const mes = parseInt(mesStr, 10);

  // Calcular sábados do mês
  const tempDate = new Date(Date.UTC(ano, mes - 1, 1, 12, 0, 0));
  let countSabados = 0;
  while (tempDate.getUTCMonth() === mes - 1) {
    if (tempDate.getUTCDay() === 6) {
      countSabados++;
    }
    tempDate.setUTCDate(tempDate.getUTCDate() + 1);
  }

  const valorMensalidade = countSabados === 5 ? valor5Sabados : valor4Sabados;

  // Datas de abertura e fechamento do período
  const janela = obterJanelaRenovacaoParaMesRef(ano, mes - 1);
  const dtInicio = janela.inicio.toLocaleDateString('pt-BR');
  const dtFim = janela.fim.toLocaleDateString('pt-BR');
  
  // ATUAIS MENSALISTAS: jogadores cadastrados como 'mensalista'
  const atuaisMensalistas = jogadores.filter(j => j.membroStatus === 'mensalista');
  
  // NOVOS MENSALISTAS: jogadores cadastrados como 'diarista' (ou não mensalistas)
  // que têm pagamento de mensalidade Pago para este mês.
  const pagantesDesteMesIds = pagamentos
    .filter(p => p.mesRef === mesRef && !p.partidaId && p.status === 'pago')
    .map(p => p.jogadorId);

  const novosMensalistas = jogadores.filter(
    j => j.membroStatus !== 'mensalista' && j.posicao !== 'Goleiro' && pagantesDesteMesIds.includes(j.id)
  );

  const formatarLinhaAtual = (j: Jogador, index: number) => {
    const pagou = pagamentos.some(p => p.jogadorId === j.id && p.mesRef === mesRef && !p.partidaId && p.status === 'pago');
    const goldPrefix = j.isGold ? '🏅' : '';
    const statusSign = pagou ? ' - 💰' : ' -';
    return `${index + 1}. ${goldPrefix}*${j.nome} ${j.sobrenome}* (${j.posicao})${statusSign}`;
  };

  const formatarLinhaNovo = (j: Jogador, index: number) => {
    const goldPrefix = j.isGold ? '🏅' : '';
    return `${index + 1}. ${goldPrefix}*${j.nome} ${j.sobrenome}* (${j.posicao}) - 💰`;
  };

  const strAtuais = atuaisMensalistas.length > 0
    ? atuaisMensalistas.map((j, i) => formatarLinhaAtual(j, i)).join('\n')
    : '_Nenhum mensalista cadastrado_';

  const strNovos = novosMensalistas.length > 0
    ? novosMensalistas.map((j, i) => formatarLinhaNovo(j, i)).join('\n')
    : '_Nenhum novo mensalista ainda_';

  return `⚽ *PELADA BATISTA SÁBADO* ⚽
🔄 *RENOVAÇÃO DE MENSALIDADE - ${mesFormatado}* 🔄

⏰ *Período de Renovação:* De *${dtInicio}* até *${dtFim}*
💰 *Valor da Mensalidade:* *R$ ${valorMensalidade.toFixed(2)}* (${countSabados} sábados)

Abaixo a situação atual dos mensalistas:

A - ATUAIS MENSALISTAS:
${strAtuais}

B - NOVOS MENSALISTAS:
${strNovos}

----------------------------------------
📲 Acesse o portal oficial para mais informações:
https://peladabatista.onrender.com`;
}

/**
 * 3. Alerta Semanal de Abertura / Fechamento de Confirmações
 */
export function obterTextoAlertaSemanal(partidaTitulo: string, dataStr: string, horario: string, local: string, janelaInicioStr: string, janelaFimStr: string): string {
  return `📢 *ALERTA DA PELADA FC - JANELA DE CONFIRMAÇÕES* 📢\n\nGalera, está aberta/fechando a janela de confirmação de presença para a próxima partida!\n\n🏆 *${partidaTitulo}*\n📅 Data do Jogo: *${dataStr}* às *${horario}h*\n📍 Local: *${local}*\n\n⏰ *Janela Oficial do Regulamento:* \n🗓️ Início: Terça-feira (*${janelaInicioStr}*) às 00:00\n🗓️ Término: Sexta-feira (*${janelaFimStr}*) às 23:59\n\nPor favor, acessem o Portal da Pelada, escolham "Sim, vou jogar" ou "Não vou" e garantam a sua vaga na lista de escalados!\n\n🔗 Acesse aqui para confirmar sua presença!`;
}

export function obterDebitosDoJogador(
  jogadorId: string,
  membroStatus: string,
  posicao: string,
  partidas: Partida[],
  pagamentos: Pagamento[],
  valorDiaria: number,
  valor4Sabados: number,
  valor5Sabados: number,
  jogadorCadastroData?: string
) {
  if (posicao === 'Goleiro') return [];

  const hojeStr = new Date().toISOString().split('T')[0]; // ex: "2026-06-04"

  const debitos: {
    id: string;
    tipo: 'mensalidade' | 'diaria';
    referencia: string;
    dataOrigem: string;
    mesRef: string;
    valor: number;
    status: 'pendente' | 'pendente_confirmacao' | 'pago';
    partidaId?: string;
    pagamentoId?: string;
  }[] = [];

  if (membroStatus === 'mensalista') {
    // Meses a verificar (inicializado dinamicamente a partir do primeiro registro ou mês atual)
    const obterMesAtual = (): string => {
      const d = new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    };

    const mesLimit = obterMesAtual(); // ex: '2026-06'
    const mesSet = new Set<string>();
    mesSet.add(mesLimit);

    partidas.forEach(p => {
      if (p.data && p.data.length >= 7) {
        const m = p.data.substring(0, 7);
        if (m <= mesLimit) {
          mesSet.add(m);
        }
      }
    });

    pagamentos.forEach(p => {
      if (p.mesRef && p.mesRef.length >= 7) {
        if (p.mesRef <= mesLimit) {
          mesSet.add(p.mesRef);
        }
      }
    });

    const listaMeses = Array.from(mesSet).sort();
    let meses: string[] = [];
    if (listaMeses.length > 0) {
      const minMes = listaMeses[0];
      const maxMes = mesLimit;
      const [minY, minM] = minMes.split('-').map(Number);
      const [maxY, maxM] = maxMes.split('-').map(Number);

      let curY = minY;
      let curM = minM;
      while (curY < maxY || (curY === maxY && curM <= maxM)) {
        const mesStr = `${curY}-${String(curM).padStart(2, '0')}`;
        meses.push(mesStr);
        curM++;
        if (curM > 12) {
          curM = 1;
          curY++;
        }
      }
    } else {
      meses = [mesLimit];
    }

    if (jogadorCadastroData && jogadorCadastroData.length >= 7) {
      const mesCadastro = jogadorCadastroData.substring(0, 7);
      meses = meses.filter(m => m >= mesCadastro);
    }

    for (const mes of meses) {
      const [ano, mesNum] = mes.split('-').map(Number);
      
      // Contar sábados
      const tempDate = new Date(Date.UTC(ano, mesNum - 1, 1, 12, 0, 0));
      let count = 0;
      while (tempDate.getUTCMonth() === mesNum - 1) {
        if (tempDate.getUTCDay() === 6) {
          count++;
        }
        tempDate.setUTCDate(tempDate.getUTCDate() + 1);
      }
      const valorMensalidade = count === 5 ? valor5Sabados : valor4Sabados;

      const pag = pagamentos.find(p => p.jogadorId === jogadorId && p.mesRef === mes);
      if (!pag) {
        debitos.push({
          id: `mensalidade-${mes}`,
          tipo: 'mensalidade',
          referencia: `Mensalidade de ${mes.split('-').reverse().join('/')}`,
          dataOrigem: `${mes}-01`,
          mesRef: mes,
          valor: valorMensalidade,
          status: 'pendente'
        });
      } else if (pag.status !== 'pago' && pag.status !== 'cancelado') {
        debitos.push({
          id: pag.id,
          tipo: 'mensalidade',
          referencia: `Mensalidade de ${mes.split('-').reverse().join('/')}`,
          dataOrigem: `${mes}-01`,
          mesRef: mes,
          valor: pag.valor,
          status: pag.status,
          pagamentoId: pag.id
        });
      }
    }
  } else if (membroStatus === 'diarista') {
    // Diaristas pagam por partidas passadas que confirmaram presenca
    const partidasPassadasConfirmadas = partidas.filter(p => {
      return p.data < hojeStr && !p.cancelada && p.confirmados.includes(jogadorId);
    });

    for (const partida of partidasPassadasConfirmadas) {
      const pag = pagamentos.find(p => {
        return p.jogadorId === jogadorId && (p.partidaId === partida.id || (p.mesRef === partida.data.substring(0, 7) && !p.partidaId && (p.status === 'pago' || p.status === 'cancelado')));
      });

      if (!pag) {
        debitos.push({
          id: `diaria-${partida.id}`,
          tipo: 'diaria',
          referencia: `Diária do jogo: ${partida.titulo}`,
          dataOrigem: partida.data,
          mesRef: partida.data.substring(0, 7),
          valor: valorDiaria,
          status: 'pendente',
          partidaId: partida.id
        });
      } else if (pag.status !== 'pago' && pag.status !== 'cancelado') {
        debitos.push({
          id: pag.id,
          tipo: 'diaria',
          referencia: `Diária do jogo: ${partida.titulo}`,
          dataOrigem: partida.data,
          mesRef: partida.data.substring(0, 7),
          valor: pag.valor,
          status: pag.status,
          partidaId: partida.id,
          pagamentoId: pag.id
        });
      }
    }
  }

  return debitos;
}

/**
 * Formata a lista de presença completa com as 5 seções requeridas:
 * A - Mensalistas por ordem de confirmacao (Nome - Posicao)
 * B - Diaristas por ordem de confirmacao (Nome - Posicao)
 * C - Goleiros por ordem de confirmacao (Nome)
 * D - Jogadores ausentes (Nome - Posição)
 * E - Lista de espera (Nome - Posicao)
 */
export function obterTextoListaCompletaPartida(
  partida: Partida,
  jogadores: Jogador[],
  grupoLinkWeb: string
): string {
  const obterJogadorPorId = (id: string) => jogadores.find((j) => j.id === id);

  const rawConfirmados = (partida.confirmados || []).map(obterJogadorPorId).filter(Boolean) as Jogador[];
  const recusados = (partida.recusados || []).map(obterJogadorPorId).filter(Boolean) as Jogador[];

  // Processar listas usando as regras de prioridade de 25 jogadores de linha
  const finalConfirmed: Jogador[] = [];
  const waitingList: Jogador[] = [];

  for (const jogador of rawConfirmados) {
    if (jogador.posicao === 'Goleiro') {
      finalConfirmed.push(jogador);
    } else {
      const linePlayersConfirmed = finalConfirmed.filter(j => j.posicao !== 'Goleiro');

      if (linePlayersConfirmed.length < 25) {
        finalConfirmed.push(jogador);
      } else {
        if (jogador.membroStatus === 'mensalista') {
          // Procurar o último diarista de linha nos confirmados para rebaixar para a fila de espera
          const lastDiaristaLinhaIndex = finalConfirmed.map(j => j.posicao !== 'Goleiro' && j.membroStatus === 'diarista').lastIndexOf(true);
          
          if (lastDiaristaLinhaIndex !== -1) {
            const diaristaParaSair = finalConfirmed[lastDiaristaLinhaIndex];
            finalConfirmed.splice(lastDiaristaLinhaIndex, 1);
            finalConfirmed.push(jogador);
            waitingList.unshift(diaristaParaSair);
          } else {
            waitingList.push(jogador);
          }
        } else {
          waitingList.push(jogador);
        }
      }
    }
  }

  // Filtrar grupos conforme requisitado
  const mensalistasConfirmados = finalConfirmed.filter(j => j.posicao !== 'Goleiro' && j.membroStatus === 'mensalista');
  const diaristasConfirmados = finalConfirmed.filter(j => j.posicao !== 'Goleiro' && j.membroStatus === 'diarista');
  const goleirosConfirmados = finalConfirmed.filter(j => j.posicao === 'Goleiro');

  const formatarLinha = (j: Jogador, index: number) => {
    const goldSuffix = j.isGold ? ' 🏅' : '';
    return `${index + 1}. *${j.nome} ${j.sobrenome}* (${j.posicao})${goldSuffix}`;
  };

  const formatarLinhaGoleiro = (j: Jogador, index: number) => {
    const goldSuffix = j.isGold ? ' 🏅' : '';
    return `${index + 1}. *${j.nome} ${j.sobrenome}*${goldSuffix}`;
  };

  const strMensalistas = mensalistasConfirmados.length > 0 
    ? mensalistasConfirmados.map((j, i) => formatarLinha(j, i)).join('\n')
    : '_Nenhum mensalista confirmado ainda_';

  const strDiaristas = diaristasConfirmados.length > 0
    ? diaristasConfirmados.map((j, i) => formatarLinha(j, i)).join('\n')
    : '_Nenhum diarista confirmado ainda_';

  const strGoleiros = goleirosConfirmados.length > 0
    ? goleirosConfirmados.map((j, i) => formatarLinhaGoleiro(j, i)).join('\n')
    : '_Nenhum goleiro confirmado ainda_';

  const strAusentes = recusados.length > 0
    ? recusados.map((j, i) => formatarLinha(j, i)).join('\n')
    : '_Nenhuma ausência registrada_';

  const strEspera = waitingList.length > 0
    ? waitingList.map((j, i) => formatarLinha(j, i)).join('\n')
    : '_Nenhum jogador em lista de espera_';

  const dataJogoDate = new Date(`${partida.data}T12:00:00`);
  let dataAmigavel = dataJogoDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  dataAmigavel = dataAmigavel.charAt(0).toUpperCase() + dataAmigavel.slice(1);
  const horario = partida.horario.split(' ')[0];

  return `⚽ *PELADA BATISTA SÁBADO* ⚽
🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆

📅 Jogo: *${partida.titulo}*
🗓️ Data: *${dataAmigavel}* às *${horario}*
📍 Local: *${partida.local}*

*A - MENSALISTAS:*
${strMensalistas}

*B - DIARISTAS:*
${strDiaristas}

*C - GOLEIROS:*
${strGoleiros}

*D - JOGADORES AUSENTES:*
${strAusentes}

*E - LISTA DE ESPERA:*
${strEspera}

----------------------------------------
📲 Acesse o portal oficial para confirmar ou alterar sua presença:
https://peladabatista.onrender.com`;
}

/**
 * Mensagem de jogo cancelado
 */
export function obterTextoPartidaCancelada(partida: Partida): string {
  const dataJogoDate = new Date(`${partida.data}T12:00:00`);
  let dataAmigavel = dataJogoDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  dataAmigavel = dataAmigavel.charAt(0).toUpperCase() + dataAmigavel.slice(1);
  
  // Limpa o "-feira" se quiser ou apenas usa como vem. Pegando o horário e formatando.
  const horario = partida.horario.split(' ')[0]; // Pega só o "08:00" do "08:00 às 10:00"

  return `⚽ *PELADA BATISTA SÁBADO* ⚽
❌ *JOGO CANCELADO!* ❌

📋 *${partida.titulo}*
🗓️ Data: *${dataAmigavel} às ${horario}*
📍 Local: *${partida.local}*

📲 Acesse nosso portal:
https://peladabatista.onrender.com`;
}

/**
 * Retorna o status de membro efetivo do jogador (tratando mensalistas inadimplentes como diaristas)
 */
export function obterStatusMembroEfetivo(jogador: Jogador, pagamentos: Pagamento[]): 'mensalista' | 'diarista' | 'isento' {
  if (jogador.posicao === 'Goleiro') return 'isento';
  
  const statusOriginal = (jogador.membroStatus || 'diarista') as 'mensalista' | 'diarista' | 'isento';
  if (statusOriginal === 'mensalista') return 'mensalista';

  // Promoção de novos mensalistas para o próximo mês de forma dinâmica
  // Se o diarista pagou a mensalidade de algum mês, e o período de renovação já fechou,
  // ou já estamos em mês cronológico posterior, ele se torna mensalista oficial!
  const mensalidadesPagas = pagamentos.filter(p => p.jogadorId === r_j_id(jogador.id) && !p.partidaId && p.status === 'pago');
  if (mensalidadesPagas.length > 0) {
    const agora = new Date();
    for (const pag of mensalidadesPagas) {
      const [anoStr, mesStr] = pag.mesRef.split('-');
      const ano = parseInt(anoStr, 10);
      const mes = parseInt(mesStr, 10);
      const janela = obterJanelaRenovacaoParaMesRef(ano, mes);
      
      const mesRefDate = new Date(ano, mes - 1, 1);
      const agoraMesDate = new Date(agora.getFullYear(), agora.getMonth(), 1);

      if (agora > janela.fim || agoraMesDate > mesRefDate) {
        return 'mensalista';
      }
    }
  }

  return statusOriginal;
}

// Função auxiliar simples de id
function r_j_id(idStr: any): string {
  return String(idStr);
}

