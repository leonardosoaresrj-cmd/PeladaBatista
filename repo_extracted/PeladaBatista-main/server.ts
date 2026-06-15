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

      // Configuração do Nodemailer com forçamento de IPv4 (Render block workaround)
      const resolveIpv4 = (host: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          dns.lookup(host, { family: 4 }, (err, address) => {
            if (err) reject(err);
            else resolve(address);
          });
        });
      };

      let smtpHost = 'smtp.gmail.com';
      try {
        smtpHost = await resolveIpv4('smtp.gmail.com');
      } catch(e) {
        console.warn('Fallback: não foi possível resolver o IP de smtp.gmail.com');
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: 465,
        secure: true,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS, // Senha de App do Gmail
        },
        tls: {
          servername: 'smtp.gmail.com', // Necessário para validação de certificado TLS
        }
      });

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

      await transporter.sendMail(mailOptions);

      return res.status(200).json({ success: true, message: "E-mail enviado com sucesso" });

    } catch (error: any) {
      console.error("[RECOVERY EMAIL ERROR]", error);
      return res.status(500).json({ 
        error: "Falha ao enviar o e-mail",
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
    app.use(express.static(distPath));
    // Fallback para SPA em produção, express 4 é get('*')
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
    console.log(`Pronto para interceptar envios de bot e evitar CORS!`);
  });
}

startServer();
