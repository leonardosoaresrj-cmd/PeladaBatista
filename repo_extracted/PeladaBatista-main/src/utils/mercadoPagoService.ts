// SDK do Mercado Pago oficial recém-instalado no ambiente
import { MercadoPagoConfig, Payment } from 'mercadopago';

/**
 * Inicializa e retorna o cliente do Mercado Pago utilizando o token providenciado.
 * @param accessToken Token de acesso configurado pelo administrador nas configurações
 */
export function obterMercadoPagoClient(accessToken: string) {
  if (!accessToken || accessToken.trim() === '') {
    throw new Error('Access Token do Mercado Pago não configurado.');
  }
  return new MercadoPagoConfig({ accessToken });
}

/**
 * Estrutura de exemplo para criar um pagamento via PIX no seu backend ou servidor de produção
 */
export async function criarPagamentoPixExemplo(
  accessToken: string,
  dados: {
    valor: number;
    descricao: string;
    emailPagador: string;
    nomePagador: string;
  }
) {
  try {
    const client = obterMercadoPagoClient(accessToken);
    const payment = new Payment(client);

    const requisicao = {
      body: {
        transaction_amount: dados.valor,
        description: dados.descricao,
        payment_method_id: 'pix',
        payer: {
          email: dados.emailPagador,
          first_name: dados.nomePagador,
          last_name: 'Futebol',
        },
      }
    };

    const resposta = await payment.create(requisicao);
    return {
      id: resposta.id,
      status: resposta.status,
      qrCode: resposta.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: resposta.point_of_interaction?.transaction_data?.qr_code_base64,
      copiaECola: resposta.point_of_interaction?.transaction_data?.ticket_url,
    };
  } catch (error) {
    console.error('Erro ao processar pagamento com o SDK do Mercado Pago:', error);
    throw error;
  }
}
