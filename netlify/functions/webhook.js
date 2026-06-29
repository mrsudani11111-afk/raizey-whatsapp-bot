exports.handler = async (event) => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

  if (event.httpMethod === "GET") {
    const params = event.queryStringParameters;
    if (params["hub.mode"] === "subscribe" && params["hub.verify_token"] === VERIFY_TOKEN) {
      return { statusCode: 200, body: params["hub.challenge"] };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  if (event.httpMethod === "POST") {
    try {
      const body = JSON.parse(event.body);
      const entry = body.entry[0];
      const change = entry.changes[0];
      const message = change.value.messages && change.value.messages[0];
      if (message) {
        const from = message.from;
        const text = message.text?.body || "";
        await sendWhatsAppMessage(from, `أهلاً بك في RAIZEY STORE 🎮\nاستلمت رسالتك: ${text}`);
      }
    } catch (e) {
      console.error(e);
    }
    return { statusCode: 200, body: "EVENT_RECEIVED" };
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};

async function sendWhatsAppMessage(to, text) {
  const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
  const ACCESS_TOKEN = process.env.WHATSAPP_TOKEN;
  await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      text: { body: text },
    }),
  });
}
