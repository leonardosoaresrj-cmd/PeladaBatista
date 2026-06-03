/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
