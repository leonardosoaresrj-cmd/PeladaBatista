/**
 * server.ts — PeladaBatista (SITE)
 *
 * CORREÇÕES aplicadas:
 *
 * BUG 1 — PORT hardcoded em 3000
 *   O Render injeta a porta via process.env.PORT.
 *   Com PORT=3000 fixo, o servidor pode não escutar na porta correta.
 *   FIX: const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
 *
 * BUG 2 — fetch do bot-proxy sem timeout
 *   O futebolbot.onrender.com (Free tier) pode demorar ~30s para acordar.
 *   Sem timeout, o fetch pendura indefinidamente, o cliente desiste
 *   e o log mostra "sucesso" (o log é gravado antes da resposta).
 *   FIX: AbortController com timeout de 35 segundos.
 *
 * BUG 3 — Nenhum log de diagnóstico no proxy
 *   Sem logs, é impossível saber se o proxy está sendo chamado,
 *   qual URL está sendo usada, e qual resposta o bot retornou.
 *   FIX: logs detalhados em cada etapa do proxy.
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();

  // FIX 1: usa process.env.PORT (Render injeta automaticamente)
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json());

  // ── Rota de diagnóstico ───────────────────────────────────────────────────
  // Permite verificar se o server.ts está rodando e qual porta
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      porta: PORT,
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV || "unknown",
    });
  });

  // ── Proxy: Frontend → server.ts → futebolbot.onrender.com/teste ──────────
  app.post("/api/bot-proxy", async (req, res) => {
    const { url, secret, payload } = req.body;

    // Log de entrada — confirma que o proxy foi chamado
    console.log(`[BOT-PROXY] Recebido. URL destino: ${url || "AUSENTE"}`);

    if (!url) {
      console.error("[BOT-PROXY] ERRO: campo 'url' ausente no body");
      return res.status(400).json({ error: "Campo url ausente" });
    }

    if (!secret) {
      console.warn("[BOT-PROXY] AVISO: campo 'secret' ausente — bot pode rejeitar");
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (secret) {
      headers["x-webhook-secret"] = secret;
    }

    const bodyStr = JSON.stringify(payload);
    console.log(`[BOT-PROXY] Enviando para: ${url}`);
    console.log(`[BOT-PROXY] Payload: ${bodyStr.substring(0, 120)}`);

    // FIX 2: timeout de 35s — Free tier do Render pode demorar ~30s para acordar
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error("[BOT-PROXY] TIMEOUT — bot não respondeu em 35s");
    }, 35000);

    try {
      const respostaBot = await fetch(url, {
        method: "POST",
        headers,
        body: bodyStr,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseText = await respostaBot.text();
      console.log(`[BOT-PROXY] Resposta do bot: HTTP ${respostaBot.status} — ${responseText.substring(0, 200)}`);

      if (!respostaBot.ok) {
        console.error(`[BOT-PROXY] Bot retornou erro ${respostaBot.status}`);
        return res.status(respostaBot.status).json({
          error: "Erro no bot",
          details: responseText,
          bot_status: respostaBot.status,
        });
      }

      let responseJson;
      try {
        responseJson = JSON.parse(responseText);
      } catch {
        responseJson = { response: responseText };
      }

      console.log("[BOT-PROXY] ✅ Mensagem entregue com sucesso ao bot");
      return res.status(200).json({ success: true, data: responseJson });

    } catch (error: any) {
      clearTimeout(timeoutId);

      // Identifica se foi timeout ou outro erro de rede
      const isTimeout = error.name === "AbortError";
      const errorMsg = isTimeout
        ? `Timeout de 35s — o bot (${url}) não respondeu. Pode estar dormindo (Free tier). Tente novamente em 30s.`
        : `Falha de rede: ${error.message}`;

      console.error(`[BOT-PROXY] ${isTimeout ? "TIMEOUT" : "ERRO DE REDE"}: ${errorMsg}`);

      return res.status(503).json({
        error: errorMsg,
        is_timeout: isTimeout,
        tip: isTimeout
          ? `Acesse ${url.replace("/teste", "/")} no navegador para acordar o servidor, depois tente novamente.`
          : undefined,
      });
    }
  });

  // ── Frontend (Vite dev / static prod) ─────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`✅ Servidor do site rodando na porta ${PORT}`);
    console.log(`🔗 Bot-proxy disponível em: /api/bot-proxy`);
    console.log(`🩺 Health check em: /api/health`);
  });
}

startServer().catch((err) => {
  console.error("Erro fatal ao iniciar servidor:", err);
  process.exit(1);
});
