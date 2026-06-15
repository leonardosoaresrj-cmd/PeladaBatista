// recover-password v11 — deno-smtp (biblioteca testada, sem esm.sh)
import { serve }      from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const ADMIN: Record<string, {nome:string;sobrenome:string;senha:string}> = {
  "leonardo.soares.rj@gmail.com":{nome:"Leonardo",sobrenome:"Soares",senha:"1234"},
};

const CORS = {
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods":"POST, OPTIONS",
};
const R = (d:unknown,s=200) => new Response(JSON.stringify(d),{status:s,headers:{...CORS,"Content-Type":"application/json"}});

serve(async (req) => {
  if (req.method==="OPTIONS") return new Response("ok",{headers:CORS});
  console.log("v11 start");

  const GMAIL_USER = Deno.env.get("GMAIL_USER");
  const GMAIL_PASS = Deno.env.get("GMAIL_PASS");
  const SB_URL     = Deno.env.get("SUPABASE_URL");
  const SB_SVC     = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!GMAIL_USER||!GMAIL_PASS) return R({error:"GMAIL_USER/GMAIL_PASS ausentes"},500);

  const body  = await req.json().catch(()=>({}));
  const email = ((body.email||body.recoveryEmail||"") as string).toLowerCase().trim();
  if (!email) return R({error:"email obrigatório"},400);
  console.log("email:",email);

  let nome="", senha="", dest=email;

  if (ADMIN[email]) {
    nome=`${ADMIN[email].nome} ${ADMIN[email].sobrenome}`; senha=ADMIN[email].senha;
  } else if (SB_URL&&SB_SVC) {
    const r = await fetch(
      `${SB_URL}/rest/v1/jogadores?select=nome,sobrenome,email,senha&email=eq.${email}&limit=1`,
      {headers:{apikey:SB_SVC,Authorization:`Bearer ${SB_SVC}`,Accept:"application/json"}}
    );
    const rows:any[] = await r.json().catch(()=>[]);
    console.log("rows:",rows.length);
    if (!rows.length) return R({success:true,message:"ok"});
    nome  = `${rows[0].nome||""} ${rows[0].sobrenome||""}`.trim()||"Atleta";
    senha = rows[0].senha?String(rows[0].senha):"(não cadastrado)";
    dest  = rows[0].email;
  } else return R({error:"banco ausente"},500);

  const html = `<div style="font-family:Arial,sans-serif;background:#f4f4f4;padding:20px">
    <div style="max-width:500px;margin:0 auto;background:#fff;padding:30px;border-radius:8px">
      <h2 style="color:#064e3b;text-align:center">⚽ Pelada Batista</h2>
      <p>Olá <b>${nome||dest}</b>,</p>
      <p>Você solicitou a recuperação do seu PIN de acesso ao portal.</p>
      <div style="background:#ecfdf5;border:1px dashed #10b981;padding:15px;text-align:center;margin:20px 0">
        <p style="color:#064e3b;font-size:13px;text-transform:uppercase;margin:0 0 8px">Sua Senha / PIN:</p>
        <p style="color:#047857;font-size:36px;font-weight:bold;font-family:monospace;letter-spacing:6px;margin:0">${senha}</p>
      </div>
      <p style="color:#666;font-size:13px">Se não solicitou, ignore este e-mail.</p>
      <p style="color:#666;font-size:13px">Equipe Pelada Batista ⚽</p>
    </div></div>`;

  console.log("conectando Gmail SMTP...");
  const client = new SMTPClient({
    connection: {
      hostname: "smtp.gmail.com",
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_PASS },
    },
  });

  try {
    await client.send({
      from:    GMAIL_USER,
      to:      dest,
      subject: "Recuperação de Acesso (PIN) — Pelada Batista",
      html,
    });
    await client.close();
    console.log("✅ enviado para", dest);
    return R({success:true,message:"E-mail enviado com sucesso"});
  } catch(e) {
    await client.close().catch(()=>{});
    console.error("Erro Gmail:",String(e));
    return R({error:"Falha ao enviar: "+String(e)},500);
  }
});
