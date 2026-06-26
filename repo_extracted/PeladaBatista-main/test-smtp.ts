import nodemailer from "nodemailer";
import dns from "dns";

const resolveIpv4 = (host: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    dns.lookup(host, { family: 4 }, (err, address) => {
      if (err) reject(err);
      else resolve(address);
    });
  });
};

async function testEmail() {
  try {
    const ip = await resolveIpv4('smtp.gmail.com');
    console.log("Resolved IPv4:", ip);
    
    const transporter = nodemailer.createTransport({
      host: ip,
      port: 465,
      secure: true,
      auth: {
        user: "test@gmail.com",
        pass: "123"
      },
      tls: {
        servername: 'smtp.gmail.com', // Required for TLS certificate checking
      }
    });

    console.log("Attempting to connect or verify...");
    await transporter.verify();
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err);
  }
}

testEmail();
