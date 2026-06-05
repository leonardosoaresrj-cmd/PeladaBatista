import express from 'express';
import cors from 'cors';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const app = express();
app.use(express.json());
app.use(cors());

// Token Secreto persistido com segurança nas variáveis de ambiente da nuvem
const client = new MercadoPagoConfig({ 
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || '' 
});

// Endpoint que gera o PIX diretamente na API do Mercado Pago
app.post('/api/criar-pagamento-pix', async (req, res) => {
  const { valor, emailJogador, nomeJogador, idDebito } = req.body;

  try {
    const payment = new Payment(client);
    const response = await payment.create({
      body: {
        transaction_amount: Number(valor),
        description: `Racha - Quitação de Débito`,
        payment_method_id: 'pix',
        external_reference: idDebito, // Guarda o ID da dívida para atualizar no Supabase depois
        notification_url: 'SUA_URL_DO_RENDER/api/webhook-mercadopago', // Endpoint de Webhook
        payer: {
          email: emailJogador,
          first_name: nomeJogador,
        }
      }
    });

    res.json({
      qrCodeCopiaECola: response.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      idTransacao: response.id
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao gerar fatura PIX' });
  }
});
