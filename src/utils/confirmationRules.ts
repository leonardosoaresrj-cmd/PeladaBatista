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
export function isFechamentoMensalistas(data: Date = new Date()): { emPeriodo: boolean; descricao: string } {
  const dia = data.getDate();
  const mes = data.getMonth(); // 0-indexed (0 = Jan, 11 = Dez)
  const ano = data.getFullYear();

  // Último dia do mês anterior
  const ultimoDiaMesAnteriorObj = new Date(ano, mes, 0);
  const totalDiasMesAnterior = ultimoDiaMesAnteriorObj.getDate();

  // Última semana do mês anterior significa: dias do mês anterior que vão desde (totalDiasMesAnterior - 6) até (totalDiasMesAnterior)
  // Ou seja, se o dia atual for nos primeiros 7 dias do mês atual, estamos na primeira semana!
  // E para cair na última semana do mês anterior, estaríamos nela se estivéssemos nos últimos 7 dias daquele mês.
  
  // Vamos verificar se a dada 'data' está na primeira semana do seu próprio mês (dia <= 7)
  const isPrimeiraSemana = dia <= 7;

  // Ou na última semana do seu próprio mês (dia >= (total de dias do próprio mês - 6))
  const totalDiasMesAtual = new Date(ano, mes + 1, 0).getDate();
  const isUltimaSemana = dia >= (totalDiasMesAtual - 6);

  const emPeriodo = isPrimeiraSemana || isUltimaSemana;
  
  let descricao = '';
  if (isPrimeiraSemana) {
    descricao = `Primeira semana do mês corrente (01 a 07 de ${getMesNome(mes)}). Período de FECHAMENTO de mensalistas ativo!`;
  } else if (isUltimaSemana) {
    descricao = `Última semana do mês (${(totalDiasMesAtual - 6)} a ${totalDiasMesAtual} de ${getMesNome(mes)}). Antecipação para o próximo mês ativa!`;
  } else {
    descricao = 'Janela comum. Período de fechamento ocorre apenas na transição de meses (últimos 7 dias e primeiros 7 dias).';
  }

  return { emPeriodo, descricao };
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
 * 1. Mensagem de Confirmação de Presença de Jogo
 */
export function obterTextoConfirmacaoJogador(jogadorNome: string, partidaTitulo: string, dataStr: string, horario: string, local: string): string {
  return `⚽ *CONFIRMAÇÃO DE PELADA - FC* ⚽\n\nFala galera! O atleta *${jogadorNome}* confirmou presença para a partida:\n\n🏆 *${partidaTitulo}*\n📅 Data: *${dataStr}*\n🕒 Horário: *${horario}h*\n📍 Local: *${local}*\n\n_Bora pro jogo tirar aquela onda!_ 💪🏃‍♂️💨`;
}

/**
 * 2. Mensagem de Recebimento de Mensalidade (especialmente no período de fechamento)
 */
export function obterTextoPagamentoMensalidade(jogadorNome: string, mesRef: string, valor: number, emPeriodoFechamento: boolean): string {
  const statusMensagem = emPeriodoFechamento 
    ? `⚠️ *FECHAMENTO DE LISTA ATIVO* ⚠️\n💰 *MENSALIDADE PAGA (DENTRO DO PRAZO)* 💰`
    : `💰 *PAGAMENTO DE MENSALIDADE RECEBIDO* 💰`;

  return `⚽ *CONTROLE FINANCEIRO - FC* ⚽\n\n${statusMensagem}\n\nAtleta: *${jogadorNome}*\nReferência: *${mesRef}*\nValor: *R$ ${valor.toFixed(2)}*\nStatus: *QUITADO* ✅\n\nTrabalho sério para manter a pelada ativa com campo pago e bola cheia! Agradecemos o compromisso. Edição de mensalistas atualizada no portal! 📈`;
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
  valor5Sabados: number
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
    // Meses a verificar
    const meses = ['2026-05', '2026-06'];
    for (const mes of meses) {
      const [ano, mesNum] = mes.split('-').map(Number);
      
      // Contar sábados
      const tempDate = new Date(ano, mesNum - 1, 1);
      let count = 0;
      while (tempDate.getMonth() === mesNum - 1) {
        if (tempDate.getDay() === 6) {
          count++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
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
    return `${index + 1}. *${j.nome} ${j.sobrenome}* - ${j.posicao}${goldSuffix}`;
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
  const dataAmigavel = dataJogoDate.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

  return `⚽ *PELADA BATISTA SÁBADO* ⚽
🏆 *CONVOCAÇÃO & PRESENÇA ATUALIZADA* 🏆

📅 Jogo: *${partida.titulo}*
🗓️ Data: *${dataAmigavel}* às *${partida.horario}h*
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
${grupoLinkWeb || 'https://pelada-batista.web.app'}`;
}

/**
 * Formata mensagem de quitação de mensalidade com ícone de medalha se for gold e contador de mensalistas pagos
 */
export function obterTextoQuitacaoMensalidade(
  jogador: Jogador,
  mesRef: string,
  valor: number,
  totalQuitadosCount: number
): string {
  const isGold = !!jogador.isGold;
  const mesFormatado = mesRef.split('-').reverse().join('/');
  const medalha = isGold ? ' 🏅' : '';
  
  return `💰 *QUITAÇÃO DE MENSALIDADE - PELADA BATISTA SÁBADO* 💰

Atleta: *${jogador.nome} ${jogador.sobrenome}* (${jogador.posicao})${medalha}
Referência: *${mesFormatado}*
Valor Quitado: *R$ ${valor.toFixed(2)}*
Status: *PAGO & CONFIRMADO* ✅

📊 *Informativo Financeiro:*
- Total de mensalistas quitados neste período: *${totalQuitadosCount}* (Limite regulamentado de 25 mensalistas)

Muito obrigado pelo compromisso em manter o nosso futebol rodando redondo de campo pago e bola cheia! 🤝⚽🏃‍♂️💨`;
}

/**
 * Retorna o status de membro efetivo do jogador (tratando mensalistas inadimplentes como diaristas)
 */
export function obterStatusMembroEfetivo(jogador: Jogador, pagamentos: Pagamento[]): 'mensalista' | 'diarista' | 'isento' {
  if (jogador.posicao === 'Goleiro') return 'isento';
  if (jogador.membroStatus !== 'mensalista') return jogador.membroStatus as 'diarista' | 'isento';

  // Se o jogador é cadastrado como mensalista, ele precisa ter pagamentos com status 'pago' para os meses de cobrança ('2026-05' e '2026-06').
  // Caso tenha algum débito de mensalidade com status diferente de 'pago' em algum destes meses, seu status efetivo passa a ser 'diarista'.
  const mesesCobranca = ['2026-05', '2026-06'];
  for (const mes of mesesCobranca) {
    const pago = pagamentos.some(p => p.jogadorId === jogador.id && p.mesRef === mes && p.status === 'pago');
    if (!pago) {
      return 'diarista';
    }
  }

  return 'mensalista';
}

