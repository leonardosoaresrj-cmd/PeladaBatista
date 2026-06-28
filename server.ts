import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

const SUPABASE_SEND_EMAIL_URL =
  "https://gqasacnaubkhokqyrpwc.supabase.co/functions/v1/send-email";

async function enviarEmailGmail(
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const resp = await fetch(SUPABASE_SEND_EMAIL_URL, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ to, subject, html }),
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`[send-email] erro ${resp.status}: ${JSON.stringify(err)}`);
  }
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
  app.use(express.json());

  app.post("/api/recover-password", async (req, res) => {
    try {
      const { email, nome, senha } = req.body;
      if (!email || !nome || !senha) return res.status(400).json({ error: "Dados incompletos." });
      await enviarEmailGmail(email, "Recuperacao de Acesso (PIN) - Pelada Batista",
        `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Pelada Batista</h2><p>Ola <b>${nome}</b>,</p><p>Seu PIN de acesso e:</p><div style="background:#ecfdf5;padding:15px;text-align:center;margin:20px 0"><p style="font-size:32px;font-weight:bold;font-family:monospace;color:#047857">${senha}</p></div><p>Se nao solicitou, ignore este e-mail.</p><p>Equipe Pelada Batista</p></div>`
      );
      console.log("[RECOVERY EMAIL OK]", email);
      return res.status(200).json({ success: true, message: "E-mail enviado com sucesso" });
    } catch (error: any) {
      console.error("[RECOVERY EMAIL ERROR]", error.message);
      return res.status(500).json({ error: "Falha ao enviar o e-mail", details: error.message });
    }
  });

  app.post("/api/send-welcome-email", async (req, res) => {
    try {
      const { email, nome } = req.body;
      if (!email || !nome) return res.status(400).json({ error: "Dados incompletos." });
      await enviarEmailGmail(email, "Bem-vindo ao Pelada Batista! Conta Aprovada",
        `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Pelada Batista</h2><p>Ola, <b>${nome}</b>!</p><p>Seu cadastro foi <b>aprovado pelo administrador</b>!</p><p>Acesse o portal: <a href="https://peladabatista.onrender.com">peladabatista.onrender.com</a></p><p>Nos vemos em campo!<br/>Equipe Pelada Batista</p></div>`
      );
      console.log("[WELCOME EMAIL OK]", email);
      return res.status(200).json({ success: true, message: "E-mail de boas-vindas enviado com sucesso." });
    } catch (error: any) {
      console.error("[WELCOME EMAIL ERROR]", error.message);
      return res.status(500).json({ error: "Falha ao enviar o e-mail de boas-vindas", details: error.message });
    }
  });

  app.post("/api/send-receipt-email", async (req, res) => {
    try {
      const { email, nome, valor, referencia, dataPagamento } = req.body;
      if (!email || !nome || !valor || !referencia) return res.status(400).json({ error: "Dados incompletos." });
      const valorFormatado = Number(valor).toFixed(2).replace(".", ",");
      const dataFormatada = dataPagamento ? new Date(dataPagamento).toLocaleDateString("pt-BR") : new Date().toLocaleDateString("pt-BR");
      const numRecibo = Math.floor(100000 + Math.random() * 900000);
      await enviarEmailGmail(email, `Recibo de Pagamento - Pelada Batista (No ${numRecibo})`,
        `<div style="font-family:Arial,sans-serif;padding:20px"><h2>Pelada Batista - Recibo #${numRecibo}</h2><p>Ola, <b>${nome}</b>,</p><p>Seu pagamento foi <b>aprovado pelo administrador</b>!</p><table style="width:100%;border-collapse:collapse;margin:20px 0"><tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Pagador:</b></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${nome}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Referencia:</b></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${referencia}</td></tr><tr><td style="padding:8px;border-bottom:1px solid #eee"><b>Data:</b></td><td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${dataFormatada}</td></tr><tr><td style="padding:8px"><b>Valor:</b></td><td style="padding:8px;text-align:right;font-size:18px;font-weight:bold;color:#115e59">R$ ${valorFormatado}</td></tr></table><p>Agradecemos!<br/>Equipe Pelada Batista</p></div>`
      );
      console.log("[RECEIPT EMAIL OK]", email);
      return res.status(200).json({ success: true, message: "Recibo enviado com sucesso." });
    } catch (error: any) {
      console.error("[RECEIPT EMAIL ERROR]", error.message);
      return res.status(500).json({ error: "Falha ao enviar o recibo de pagamento", details: error.message });
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
