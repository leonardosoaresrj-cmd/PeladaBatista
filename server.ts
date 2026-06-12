import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Usa middleware JSON para APIs criadas aqui
  app.use(express.json());

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
