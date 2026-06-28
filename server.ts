import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import nodemailer from "nodemailer";
import dns from "dns";

// Forçar uso do IPv4 por padrão devido a bloqueios de IPv6 via porta de email (Render/GCP)
dns.setDefaultResultOrder("ipv4first");

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Usa middleware JSON para APIs criadas aqui
  app.use(express.json());

  // Função de envio via SMTP direta por Nodemailer com resolução de IPv4, idêntica à que funcionava perfeitamente antes
  const enviarEmailSMTP = async (mailOptions: any) => {
    const smtpHostEnv = process.env.SMTP_HOST || 'smtp.gmail.com';
    const smtpPortEnv = Number(process.env.SMTP_PORT) || 465;
    const isSecure = smtpPortEnv === 465;

    const resolveIpv4 = (host: string): Promise<string> => {
      return new Promise((resolve) => {
        dns.lookup(host, { family: 4 }, (err, address) => {
          if (err) resolve(host);
          else resolve(address);
        });
      });
    };

    let targetHost = smtpHostEnv;
    if (smtpHostEnv === 'smtp.gmail.com') {
      try {
        targetHost = await resolveIpv4('smtp.gmail.com');
      } catch (e) {
        console.warn('Fallback: não foi possível resolver o IP de smtp.gmail.com');
      }
    }

    const transporter = nodemailer.createTransport({
      host: targetHost,
      port: smtpPortEnv,
      secure: isSecure,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        servername: smtpHostEnv, // Necessário para validação do certificado TLS do Gmail
      }
    });

    console.log(`[SMTP] Enviando e-mail para ${mailOptions.to} via ${smtpHostEnv} na porta ${smtpPortEnv}...`);
    const info = await transporter.sendMail({
      ...mailOptions,
      from: mailOptions.from || `"Pelada Batista" <${process.env.SMTP_USER}>`
    });
    console.log(`[SMTP] E-mail enviado com sucesso! MessageID: ${info.messageId}`);
    return info;
  };

  // Rota de recuperação de senha via E-mail
  app.post("/api/recover-password", async (req, res) => {
    try {
      const { email, nome, senha } = req.body;

      if (!email || !nome || !senha) {
        return res.status(400).json({ error: "Dados incompletos para envio de e-mail." });
      }

      // Verifica se as configurações de SMTP estão preenchidas
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({ 
          error: "Servidor de e-mail não configurado. Por favor, adicione SMTP_USER e SMTP_PASS nas variáveis de ambiente." 
        });
      }

      const mailOptions = {
        from: `"Pelada Batista" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Recuperação de Acesso (PIN) - Pelada Batista",
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-w: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <h2 style="color: #064e3b; text-align: center; font-size: 24px; margin-bottom: 20px;">Pelada Batista</h2>
              <p style="color: #333333; font-size: 16px;">Olá <b>${nome}</b>,</p>
              <p style="color: #333333; font-size: 16px;">Você solicitou a recuperação do seu PIN de acesso ao portal do nosso racha.</p>
              
              <div style="background-color: #ecfdf5; border: 1px dashed #10b981; padding: 15px; text-align: center; margin: 25px 0;">
                <p style="color: #064e3b; font-size: 14px; margin: 0 0 5px 0; text-transform: uppercase; letter-spacing: 1px;">Sua Senha / PIN é:</p>
                <p style="color: #047857; font-size: 32px; font-weight: bold; font-family: monospace; letter-spacing: 5px; margin: 0;">${senha}</p>
              </div>
              
              <p style="color: #666666; font-size: 14px;">Se você não solicitou esta recuperação, por favor ignore este e-mail.</p>
              <br/>
              <p style="color: #666666; font-size: 14px;">Um abraço,<br/>Equipe Pelada Batista</p>
            </div>
          </div>
        `,
      };

      await enviarEmailSMTP(mailOptions);

      return res.status(200).json({ success: true, message: "E-mail enviado com sucesso" });

    } catch (error: any) {
      console.error("[RECOVERY EMAIL ERROR]", error);
      return res.status(500).json({ 
        error: "Falha ao enviar o e-mail",
        details: error.message 
      });
    }
  });

  // Rota para envio de e-mail de Boas-vindas (Conta Aprovada)
  app.post("/api/send-welcome-email", async (req, res) => {
    try {
      const { email, nome } = req.body;

      if (!email || !nome) {
        return res.status(400).json({ error: "Dados incompletos para envio de e-mail." });
      }

      // Verifica se as configurações de SMTP estão preenchidas
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({ 
          error: "Servidor de e-mail não configurado. Por favor, adicione SMTP_USER e SMTP_PASS nas variáveis de ambiente." 
        });
      }

      const mailOptions = {
        from: `"Pelada Batista" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "Bem-vindo ao Pelada Batista! Conta Aprovada 🎉",
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 5px solid #059669;">
              <h2 style="color: #064e3b; text-align: center; font-size: 24px; margin-bottom: 20px;">Pelada Batista</h2>
              <p style="color: #333333; font-size: 16px;">Olá, <b>${nome}</b>! 🎉</p>
              <p style="color: #333333; font-size: 16px; line-height: 1.5;">Temos o prazer de informar que o seu cadastro no portal <b>Pelada Batista</b> foi aprovado pelo administrador!</p>
              
              <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 15px; text-align: center; margin: 25px 0; border-radius: 6px;">
                <p style="color: #065f46; font-size: 15px; font-weight: bold; margin: 0;">Sua conta está ativa e pronta para uso!</p>
              </div>

              <p style="color: #333333; font-size: 15px; line-height: 1.5;">A partir de agora, você já pode acessar o nosso portal oficial para:</p>
              <ul style="color: #4b5563; font-size: 14px; line-height: 1.6; padding-left: 20px;">
                <li>Confirmar presença nas próximas peladas agendadas</li>
                <li>Verificar seu histórico mensal de partidas e presença</li>
                <li>Declarar pagamentos de mensalidades de forma simples</li>
                <li>Visualizar as estatísticas completas do nosso grupo</li>
              </ul>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://peladabatista.onrender.com" target="_blank" style="background-color: #059669; color: #ffffff; padding: 12px 25px; text-decoration: none; font-weight: bold; border-radius: 6px; display: inline-block;">Acessar o Portal</a>
              </div>
              
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #666666; font-size: 14px;">Nos vemos em campo!</p>
              <p style="color: #666666; font-size: 14px; margin: 0;">Um abraço,<br/>Equipe Pelada Batista</p>
            </div>
          </div>
        `,
      };

      await enviarEmailSMTP(mailOptions);
      return res.status(200).json({ success: true, message: "E-mail de boas-vindas enviado com sucesso." });

    } catch (error: any) {
      console.error("[WELCOME EMAIL ERROR]", error);
      return res.status(500).json({ 
        error: "Falha ao enviar o e-mail de boas-vindas",
        details: error.message 
      });
    }
  });

  // Rota para envio de Recibo de Pagamento (Pagamento Aprovado)
  app.post("/api/send-receipt-email", async (req, res) => {
    try {
      const { email, nome, valor, referencia, dataPagamento } = req.body;

      if (!email || !nome || !valor || !referencia) {
        return res.status(400).json({ error: "Dados incompletos para emissão de recibo." });
      }

      // Verifica se as configurações de SMTP estão preenchidas
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        return res.status(500).json({ 
          error: "Servidor de e-mail não configurado. Por favor, adicione SMTP_USER e SMTP_PASS nas variáveis de ambiente." 
        });
      }

      const valorFormatado = Number(valor).toFixed(2).replace('.', ',');
      const dataFormatada = dataPagamento 
        ? new Date(dataPagamento).toLocaleDateString('pt-BR') 
        : new Date().toLocaleDateString('pt-BR');

      const numRecibo = Math.floor(100000 + Math.random() * 900000);

      const mailOptions = {
        from: `"Pelada Batista" <${process.env.SMTP_USER}>`,
        to: email,
        subject: `Recibo de Pagamento Confirmado - Pelada Batista (Nº ${numRecibo}) 🧾`,
        html: `
          <div style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
            <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); border-top: 5px solid #0d9488;">
              <h2 style="color: #0f766e; text-align: center; font-size: 24px; margin-bottom: 5px;">Pelada Batista</h2>
              <p style="text-align: center; color: #6b7280; font-size: 13px; margin-top: 0; margin-bottom: 25px;">COMPROVANTE DE PAGAMENTO</p>
              
              <p style="color: #333333; font-size: 16px;">Olá, <b>${nome}</b>,</p>
              <p style="color: #333333; font-size: 15px; line-height: 1.5;">O seu pagamento manual foi <b>aprovado pelo administrador</b>! Segue abaixo as informações detalhadas do seu recibo:</p>
              
              <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; padding: 20px; border-radius: 8px; margin: 25px 0;">
                <table style="width: 100%; border-collapse: collapse; font-size: 14px; color: #374151;">
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #0f766e;">Recibo Nº:</td>
                    <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 15px;">#${numRecibo}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #0f766e;">Pagador:</td>
                    <td style="padding: 8px 0; text-align: right;">${nome}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #0f766e;">Referência:</td>
                    <td style="padding: 8px 0; text-align: right; font-weight: bold;">${referencia}</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px 0; font-weight: bold; color: #0f766e;">Data de Confirmação:</td>
                    <td style="padding: 8px 0; text-align: right;">${dataFormatada}</td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0 4px 0; font-weight: bold; font-size: 16px; color: #115e59;">Valor Total:</td>
                    <td style="padding: 12px 0 4px 0; text-align: right; font-weight: bold; font-size: 18px; color: #115e59;">R$ ${valorFormatado}</td>
                  </tr>
                </table>
              </div>

              <p style="color: #4b5563; font-size: 13px; text-align: center; margin-top: 30px; line-height: 1.4;">Este é um e-mail automático enviado após a validação administrativa de comprovante Pix ou transferência.</p>
              
              <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
              <p style="color: #666666; font-size: 14px; margin: 0;">Agradecemos sua colaboração!<br/>Equipe Pelada Batista</p>
            </div>
          </div>
        `,
      };

      await enviarEmailSMTP(mailOptions);
      return res.status(200).json({ success: true, message: "Recibo enviado com sucesso." });

    } catch (error: any) {
      console.error("[RECEIPT EMAIL ERROR]", error);
      return res.status(500).json({ 
        error: "Falha ao enviar o recibo de pagamento",
        details: error.message 
      });
    }
  });

  // Rota de Proxy: Front-end -> Nosso Servidor -> Robô do Render
  // Isso resolve os problemas de CORS quando o site roda do nosso lado
  app.post("/api/bot-proxy", async (req, res) => {
    try {
      const { url, secret, payload } = req.body;
      
      if (!url) {
        return res.status(400).json({ error: "Campo url ausente" });
      }

      console.log(`[PROXY] Enviando POST para ${url}`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json"
      };

      if (secret) {
        headers["x-webhook-secret"] = secret;
      }

      // Faz a requisição para o bot real
      const respostaRender = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload)
      });

      const responseText = await respostaRender.text();

      if (!respostaRender.ok) {
        console.error(`[PROXY ERROR] Status ${respostaRender.status}: ${responseText}`);
        return res.status(respostaRender.status).json({ 
          error: "Erro no bot", 
          details: responseText 
        });
      }

      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch (err) {
        responseJson = { response: responseText };
      }

      return res.status(200).json({ success: true, data: responseJson });

    } catch (error: any) {
      console.error("[PROXY FATAL ERROR]", error);
      return res.status(500).json({ 
        error: "Falha de rede ao conectar com o robô",
        details: error.message 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        // Se for o index.html ou qualquer arquivo .html servido estaticamente, desativar cache completamente
        if (filePath.endsWith('.html') || path.basename(filePath) === 'index.html') {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        } else if (filePath.match(/\.(js|css|woff2?|eot|ttf|otf|png|gif|jpe?g|svg|ico|webp)$/)) {
          // Arquivos estáticos compilados com hash pelo Vite podem ter cache agressivo de 1 ano
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    }));
    // Fallback para SPA em produção, express 4 é get('*')
    app.get('*', (req, res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Pronto para interceptar envios de bot e evitar CORS!`);
  });
}

startServer();
